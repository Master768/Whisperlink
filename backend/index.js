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
app.set('trust proxy', 1);
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
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: (req, file, cb) => {
        const allowed = [
            'image/', 'video/', 'audio/',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain',
            'text/x-python', 'application/x-python-code',
            'application/octet-stream', // covers .ipynb and unknown types
            'application/json',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
            'application/vnd.ms-excel' // xls
        ];
        const isAllowed = allowed.some(type => file.mimetype.startsWith(type) || file.mimetype === type);
        const allowedExtensions = /\.(jpg|jpeg|png|gif|webp|mp4|mov|mp3|wav|pdf|docx|doc|txt|py|ipynb|zip|csv|r|json|xlsx|xls)$/i;
        const extOk = allowedExtensions.test(file.originalname);
        if (isAllowed || extOk) {
            cb(null, true);
        } else {
            cb(new Error('File type not supported'), false);
        }
    }
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
        fileUrl: `${req.protocol}://${req.get('host')}/api/download/${req.file.filename}`,
        fileName: req.file.originalname,
        fileSize: req.file.size
    });
});

// File Download
app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        const parts = req.params.filename.split('-');
        const originalName = parts.length > 2 ? parts.slice(2).join('-') : req.params.filename;
        res.download(filePath, originalName, (err) => {
            if (err && !res.headersSent) {
                console.error('Error downloading file:', err);
                res.status(500).json({ error: 'Error downloading file' });
            }
        });
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// File View (Inline delivery for PDF/Images)
app.get('/api/view/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'File not found' });
    }
});

// Socket.io Logic
const roomUsers = {}; // { roomId: [{ id: socketId, name: username }] }
const disconnectTimers = {}; // { `${roomId}:${username}`: timeoutId }

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (data) => {
        const { roomId, username } = typeof data === 'string' ? { roomId: data, username: 'Anonymous' } : data;

        socket.join(roomId);
        socket.username = username || 'Anonymous';
        socket.roomId = roomId;

        const timerKey = `${roomId}:${socket.username}`;

        // Check if this user is reconnecting within the grace period
        const isReconnecting = !!disconnectTimers[timerKey];

        if (isReconnecting) {
            // Cancel the pending "user left" broadcast
            clearTimeout(disconnectTimers[timerKey]);
            delete disconnectTimers[timerKey];
            console.log(`[Socket] ${socket.username} reconnected to ${roomId} (grace period active, no leave/join messages)`);
        }

        if (!roomUsers[roomId]) {
            roomUsers[roomId] = [];
        }

        // Remove stale IDs for same username if they exist
        roomUsers[roomId] = roomUsers[roomId].filter(u => u.name !== socket.username || u.id === socket.id);

        if (!roomUsers[roomId].some(u => u.id === socket.id)) {
            roomUsers[roomId].push({ id: socket.id, name: socket.username });
        }

        // Always broadcast updated room data (user count / list)
        io.to(roomId).emit('room_data', {
            userCount: roomUsers[roomId].length,
            users: roomUsers[roomId],
        });

        // Only send join notification if this is a fresh join (not a reconnect)
        if (!isReconnecting) {
            console.log(`[Socket] ${socket.username} joined ${roomId}. Count: ${roomUsers[roomId].length}`);
            socket.to(roomId).emit('receive_message', {
                sender: 'system',
                username: 'WhisperLink',
                message: `${socket.username} has entered the room.`,
                type: 'system',
                timestamp: new Date()
            });
        }
    });

    socket.on('send_message', async (data) => {
        const { roomId, message, type, fileName, fileUrl } = data;
        const messageId = Date.now() + Math.random().toString(36).substr(2, 9);
        const timestamp = new Date();

        io.to(roomId).emit('receive_message', {
            id: messageId,
            sender: socket.id,
            username: socket.username || 'Anonymous',
            message,
            type,
            fileName,
            fileUrl,
            timestamp,
            seenBy: [socket.username] // Sender has seen it
        });

        // Update room activity
        try {
            const room = await Room.findOne({ roomId });
            if (room) await room.updateActivity();
        } catch (err) {
            console.error('Error updating room activity:', err);
        }
    });

    socket.on('mark_seen', ({ roomId, messageId, username }) => {
        io.to(roomId).emit('message_seen', { messageId, username });
    });

    socket.on('edit_message', ({ roomId, messageId, newMessage, timestamp }) => {
        const now = new Date();
        const msgTime = new Date(timestamp);
        const diffMinutes = (now - msgTime) / 1000 / 60;

        if (diffMinutes <= 5) {
            io.to(roomId).emit('message_edited', { messageId, newMessage });
        }
    });

    // Typing indicators
    socket.on('typing_start', ({ roomId }) => {
        socket.to(roomId).emit('user_typing', { username: socket.username });
    });

    socket.on('typing_stop', ({ roomId }) => {
        socket.to(roomId).emit('user_stop_typing', { username: socket.username });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const roomId = socket.roomId;
        const username = socket.username || 'Anonymous';

        if (!roomId || !roomUsers[roomId]) return;

        // Remove this socket from the room immediately
        roomUsers[roomId] = roomUsers[roomId].filter(u => u.id !== socket.id);

        // Update count for remaining users right away (so sidebar count is accurate)
        if (roomUsers[roomId] && roomUsers[roomId].length > 0) {
            io.to(roomId).emit('room_data', {
                userCount: roomUsers[roomId].length,
                users: roomUsers[roomId]
            });
        }

        const timerKey = `${roomId}:${username}`;

        // Grace period: wait 10 seconds before broadcasting "left" message
        // This handles mobile app-switching / background tab drops
        disconnectTimers[timerKey] = setTimeout(() => {
            delete disconnectTimers[timerKey];
            console.log(`[Socket] ${username} confirmed left ${roomId} (grace period elapsed)`);

            // Broadcast exit message
            io.to(roomId).emit('receive_message', {
                sender: 'system',
                username: 'WhisperLink',
                message: `${username} left the chat.`,
                type: 'system',
                timestamp: new Date()
            });

            if (roomUsers[roomId]) {
                if (roomUsers[roomId].length === 0) {
                    delete roomUsers[roomId];
                } else {
                    io.to(roomId).emit('room_data', {
                        userCount: roomUsers[roomId].length,
                        users: roomUsers[roomId]
                    });
                }
            }
        }, 40000); // 40-second grace period
    });
});

// Start Cleanup Job
startCleanupJob();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
