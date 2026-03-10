require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Room = require('./models/Room');
const { startCleanupJob } = require('./utils/cleanup');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
    credentials: true
}));
app.use(express.json());
// Ensure uploads directory exists on startup
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
}

app.use('/uploads', express.static(uploadsDir));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));

// Multer Setup for File Uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath);
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
});

// Routes
// Create or Join Room
app.post('/api/rooms', async (req, res) => {
    let { roomId, secretPhrase } = req.body;
    try {
        console.log(`[API] Room request: roomId=${roomId}, secretPhrase=${secretPhrase ? '****' : 'none'}`);

        // Ensure database is connected
        if (mongoose.connection.readyState !== 1) {
            console.error('[API] Database not connected. State:', mongoose.connection.readyState);
            return res.status(503).json({ error: 'Database connection unstable. Retrying...' });
        }

        // If no roomId is provided, generate a unique 6-digit numeric ID
        if (!roomId) {
            let isUnique = false;
            let attempts = 0;
            while (!isUnique && attempts < 10) {
                roomId = Math.floor(100000 + Math.random() * 900000).toString();
                const existing = await Room.findOne({ roomId });
                if (!existing) isUnique = true;
                attempts++;
            }
        }

        let room = await Room.findOne({ roomId });
        if (room) {
            // Join existing room
            if (room.secretPhrase === secretPhrase) {
                // Update room activity to prevent expiry
                await room.updateActivity();
                return res.status(200).json({ message: 'Room joined successfully', roomId, createdAt: room.createdAt });
            } else {
                return res.status(401).json({ error: 'Incorrect secret phrase' });
            }
        } else {
            // Create new room
            room = new Room({ roomId, secretPhrase });
            await room.save();
            return res.status(201).json({ message: 'Room created successfully', roomId, createdAt: room.createdAt });
        }
    } catch (err) {
        console.error('[API] Room error details:', err.message);
        res.status(500).json({ error: `Server error: ${err.message}` });
    }
});

// File Upload
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    res.status(200).json({
        message: 'File uploaded successfully',
        fileUrl: `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size
    });
});

// Socket.io Logic
const roomUsers = {}; // { roomId: [{ id: socketId, name: username }] }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (data) => {
        const { roomId, username } = typeof data === 'string' ? { roomId: data, username: 'Anonymous' } : data;

        socket.join(roomId);
        socket.username = username || 'Anonymous';
        socket.roomId = roomId;

        if (!roomUsers[roomId]) {
            roomUsers[roomId] = [];
        }

        // Remove stale IDs for same username if they exist
        roomUsers[roomId] = roomUsers[roomId].filter(u => u.name !== socket.username || u.id === socket.id);

        if (!roomUsers[roomId].some(u => u.id === socket.id)) {
            roomUsers[roomId].push({ id: socket.id, name: socket.username });
        }

        console.log(`[Socket] ${socket.username} joined ${roomId}. Count: ${roomUsers[roomId].length}`);

        io.to(roomId).emit('room_data', {
            userCount: roomUsers[roomId].length,
            users: roomUsers[roomId],
            createdAt: roomUsers[roomId].length === 1 ? new Date() : undefined // We'll get this from DB for existing rooms
        });

        // System notification
        socket.to(roomId).emit('receive_message', {
            sender: 'system',
            username: 'WhisperLink',
            message: `${socket.username} has entered the room.`,
            type: 'system',
            timestamp: new Date()
        });
    });

    socket.on('send_message', async (data) => {
        const { roomId, message, type, fileName, fileUrl } = data;

        // Broadcast message to room members
        io.to(roomId).emit('receive_message', {
            sender: socket.id,
            username: socket.username || 'Anonymous',
            message,
            type,
            fileName,
            fileUrl,
            timestamp: new Date()
        });

        // Update room activity
        try {
            const room = await Room.findOne({ roomId });
            if (room) {
                await room.updateActivity();
            }
        } catch (err) {
            console.error('Error updating room activity:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomId = socket.roomId;
        if (roomId && roomUsers[roomId]) {
            const username = socket.username || 'Anonymous';
            roomUsers[roomId] = roomUsers[roomId].filter(u => u.id !== socket.id);

            // Broadcast exit message
            io.to(roomId).emit('receive_message', {
                sender: 'system',
                username: 'WhisperLink',
                message: `${username} left the chat.`,
                type: 'system',
                timestamp: new Date()
            });

            if (roomUsers[roomId].length === 0) {
                delete roomUsers[roomId];
            } else {
                io.to(roomId).emit('room_data', {
                    userCount: roomUsers[roomId].length,
                    users: roomUsers[roomId]
                });
            }
        }
    });
});

// Start Cleanup Job
startCleanupJob();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
