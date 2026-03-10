import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { Send, FileUp, Download, Shield, Hash, Users, X, Paperclip, User, WifiOff } from 'lucide-react';

// Deterministic color from username
const USER_COLORS = [
    '#00f2fe', '#4facfe', '#f093fb', '#f5576c', '#4facfe',
    '#43e97b', '#fa709a', '#fee140', '#a18cd1', '#fccb90',
    '#84fab0', '#f6d365', '#a1c4fd', '#fda085', '#d4fc79',
    '#96fbc4', '#ffecd2', '#cfd9df', '#e0c3fc', '#fddb92',
];

function getUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// File type icon/label helpers
function getFileLabel(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const labels = { py: '🐍 Python', ipynb: '📓 Notebook', txt: '📄 Text', docx: '📝 Word', doc: '📝 Word', pdf: '📕 PDF', zip: '🗜️ Archive', csv: '📊 CSV' };
    return labels[ext] || '📎 File';
}

const TYPING_TIMEOUT = 2500; // ms of inactivity before stop event fires

// localStorage key for messages — persists across page reloads (unlike sessionStorage which mobile browsers clear)
const MSG_KEY = (roomId) => `wl_messages_${roomId}`;
const MSG_EXPIRY_KEY = (roomId) => `wl_expiry_${roomId}`;

const ChatRoom = ({ roomId, secretPhrase, username, createdAt, onLeave }) => {
    // Load saved messages from localStorage — survives back button + mobile page reloads
    const [messages, setMessages] = useState(() => {
        try {
            // If room has expired, don't load stale messages
            const expiryStr = localStorage.getItem(MSG_EXPIRY_KEY(roomId));
            if (expiryStr && Date.now() > Number(expiryStr)) {
                localStorage.removeItem(MSG_KEY(roomId));
                localStorage.removeItem(MSG_EXPIRY_KEY(roomId));
                return [];
            }
            const saved = localStorage.getItem(MSG_KEY(roomId));
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [input, setInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [uploadFileName, setUploadFileName] = useState('');
    const [userCount, setUserCount] = useState(0);
    const [members, setMembers] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    const [isShredded, setIsShredded] = useState(false);
    const [typingUsers, setTypingUsers] = useState([]);
    const scrollRef = useRef();
    const socketRef = useRef();
    const fileInputRef = useRef();
    const typingTimerRef = useRef(null);
    const isTypingRef = useRef(false);

    // Persist messages to localStorage on every update
    useEffect(() => {
        try {
            localStorage.setItem(MSG_KEY(roomId), JSON.stringify(messages));
            // Store expiry time (45 min from room creation) so we can clean up stale messages
            if (createdAt && !localStorage.getItem(MSG_EXPIRY_KEY(roomId))) {
                const expiry = new Date(createdAt).getTime() + (45 * 60 * 1000);
                localStorage.setItem(MSG_EXPIRY_KEY(roomId), String(expiry));
            }
        } catch { /* storage full — silently ignore */ }
    }, [messages, roomId, createdAt]);

    // Timer Logic
    useEffect(() => {
        if (!createdAt) return;
        const roomCreationTime = new Date(createdAt).getTime();
        const shredTime = roomCreationTime + (45 * 60 * 1000);

        const updateTimer = () => {
            const now = Date.now();
            const difference = shredTime - now;
            if (difference <= 0) {
                setTimeLeft('00:00');
                setIsShredded(true);
                // Clear stored messages on shred
                localStorage.removeItem(MSG_KEY(roomId));
                localStorage.removeItem(MSG_EXPIRY_KEY(roomId));
                clearInterval(timerInterval);
                return;
            }
            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);
            setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        };

        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);
        return () => clearInterval(timerInterval);
    }, [createdAt, roomId]);

    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        socketRef.current = io(backendUrl, {
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 5
        });

        const socket = socketRef.current;
        socket.on('connect', () => {
            setIsConnected(true);
            socket.emit('join_room', { roomId, username });
        });
        socket.on('disconnect', () => setIsConnected(false));
        socket.on('receive_message', (message) => setMessages((prev) => [...prev, message]));
        socket.on('room_data', (data) => {
            setUserCount(data.userCount);
            setMembers(data.users || []);
        });

        // Typing indicator listeners
        socket.on('user_typing', ({ username: typingUser }) => {
            setTypingUsers(prev => prev.includes(typingUser) ? prev : [...prev, typingUser]);
        });
        socket.on('user_stop_typing', ({ username: typingUser }) => {
            setTypingUsers(prev => prev.filter(u => u !== typingUser));
        });

        return () => { if (socket) socket.disconnect(); };
    }, [roomId, username]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, typingUsers]);

    // Emit typing events
    const handleInputChange = (e) => {
        setInput(e.target.value);

        if (!isConnected || isShredded || !socketRef.current) return;

        if (!isTypingRef.current) {
            isTypingRef.current = true;
            socketRef.current.emit('typing_start', { roomId });
        }

        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            isTypingRef.current = false;
            socketRef.current.emit('typing_stop', { roomId });
        }, TYPING_TIMEOUT);
    };

    const sendMessage = (e) => {
        e?.preventDefault();
        if (!input.trim() || !isConnected || isShredded) return;

        // Stop typing indicator immediately on send
        clearTimeout(typingTimerRef.current);
        isTypingRef.current = false;
        socketRef.current.emit('typing_stop', { roomId });

        socketRef.current.emit('send_message', { roomId, message: input, type: 'text' });
        setInput('');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !isConnected || isShredded) return;
        if (file.size > 25 * 1024 * 1024) { alert('File too large (Max 25MB)'); return; }

        setIsUploading(true);
        setUploadFileName(file.name);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/upload`, { method: 'POST', body: formData });
            const data = await response.json();
            if (response.ok) {
                socketRef.current.emit('send_message', { roomId, type: 'file', fileName: data.fileName, fileUrl: data.fileUrl });
            }
        } catch (err) {
            console.error('Upload failed', err);
        } finally {
            setIsUploading(false);
            setUploadFileName('');
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Typing label builder — handles 1, 2, or many users
    const typingLabel = (() => {
        if (typingUsers.length === 0) return null;
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing`;
        if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
        return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`;
    })();

    // Shredded screen
    if (isShredded) {
        return (
            <div className="flex h-[100dvh] bg-black text-white items-center justify-center p-6 text-center">
                <div className="space-y-5 animate-fade-in">
                    <div className="w-14 h-14 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto">
                        <Shield className="w-7 h-7 text-red-500" />
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase">Room Shredded</h1>
                    <p className="text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">
                        The 45-minute silence has ended. All messages have been permanently destroyed.
                    </p>
                    <button onClick={onLeave} className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform">
                        Return to Void
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-[#050505] text-white overflow-hidden font-sans relative">
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

            {/* Sidebar overlay (mobile) */}
            {showMembers && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden" onClick={() => setShowMembers(false)} />
            )}

            {/* Members Sidebar */}
            <div className={`fixed inset-y-0 right-0 w-64 glass-dark border-l border-white/5 z-50 flex flex-col transform transition-transform duration-300 ease-out shadow-2xl
                ${showMembers ? 'translate-x-0' : 'translate-x-full'} lg:relative lg:translate-x-0`}>
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0">
                    <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-primary" />
                        <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-white/90 italic">Active Ghosts</h3>
                    </div>
                    <button onClick={() => setShowMembers(false)} className="lg:hidden p-1 hover:bg-white/5 rounded-lg">
                        <X className="w-4 h-4 text-white/40" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {members.map((member) => {
                        const color = getUserColor(member.name);
                        return (
                            <div key={member.id} className="flex items-center space-x-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.03] hover:border-white/10 transition-all">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm border"
                                    style={{ backgroundColor: color + '20', borderColor: color + '40', color }}>
                                    {member.name[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate" style={{ color }}>
                                        {member.name} {member.name === username && <span className="text-[9px] italic opacity-60">You</span>}
                                    </p>
                                    <div className="flex items-center space-x-1 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse shrink-0"></span>
                                        <span className="text-[9px] uppercase font-black text-white/40">Online</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Timer */}
                <div className="px-4 py-3 border-t border-white/5 bg-black/60 shrink-0">
                    <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] text-center mb-1 italic">Shred Countdown</div>
                    <div className="text-3xl font-black text-primary text-center tracking-tighter tabular-nums drop-shadow-[0_0_12px_rgba(0,242,254,0.3)]">
                        {timeLeft}
                    </div>
                </div>
            </div>

            {/* Main Chat */}
            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                {/* Header */}
                <div className="glass px-4 sm:px-5 py-3 flex items-center justify-between border-b border-white/5 z-10 bg-black/20 backdrop-blur-2xl shrink-0">
                    <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 rounded-xl bg-primary/5 border border-primary/10 shrink-0">
                            <Hash className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-black tracking-tight text-white/95 truncate">{roomId}</h2>
                            <div className="flex items-center space-x-1.5 text-[9px] uppercase tracking-[0.15em] font-black italic">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></span>
                                <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                                    {isConnected ? `${userCount} Ghost${userCount !== 1 ? 's' : ''}` : 'Signal Lost'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                        <div className="hidden sm:flex items-center space-x-2 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl">
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: getUserColor(username) }}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest italic max-w-[70px] truncate" style={{ color: getUserColor(username) }}>{username}</span>
                        </div>

                        <button onClick={() => setShowMembers(!showMembers)}
                            className="lg:hidden relative p-2 hover:bg-white/5 rounded-xl border border-white/5 bg-white/[0.02] active:scale-95">
                            <Users className="w-4 h-4 text-white/70" />
                            {userCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-black text-[8px] font-black rounded-md flex items-center justify-center border border-black">
                                    {userCount}
                                </span>
                            )}
                        </button>

                        <button onClick={onLeave}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl border border-red-500/10 group active:scale-90"
                            title="Leave Room">
                            <X className="w-4 h-4 text-red-400 group-hover:text-red-300 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-5 pt-4 pb-2 space-y-3 custom-scrollbar">
                    {/* Welcome placeholder */}
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Shield className="w-10 h-10 text-white/5 mb-3" />
                        <p className="text-[9px] max-w-[220px] tracking-[0.25em] font-black text-white/30 uppercase italic leading-loose">
                            Ephemeral domain established.<br />Zero logs preserved.<br />Shredding active.
                        </p>
                    </div>

                    {messages.map((msg, i) => {
                        const isMe = msg.username === username;
                        const isSystem = msg.type === 'system';
                        const userColor = isMe ? null : getUserColor(msg.username);

                        if (isSystem) {
                            return (
                                <div key={i} className="flex justify-center animate-fade-in py-0.5">
                                    <div className="flex items-center space-x-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04]">
                                        <div className="w-1 h-1 rounded-full bg-primary/60 shrink-0"></div>
                                        <span className="text-[9px] text-white/50 font-black uppercase tracking-[0.15em] italic">{msg.message}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
                                <div className={`max-w-[80%] sm:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {!isMe && (
                                        <span className="text-[9px] font-black uppercase tracking-[0.15em] italic mb-1 ml-1"
                                            style={{ color: userColor }}>
                                            {msg.username}
                                        </span>
                                    )}
                                    <div className={`px-3.5 py-2.5 rounded-2xl w-full ${isMe
                                        ? 'bg-gradient-to-br from-primary to-secondary text-black font-bold rounded-tr-none shadow-[0_4px_15px_rgba(0,242,254,0.15)]'
                                        : 'bg-[#141414] rounded-tl-none border group-hover:border-white/10'}`}
                                        style={!isMe ? { borderColor: userColor + '30' } : {}}>
                                        {msg.type === 'file' ? (
                                            <a href={msg.fileUrl} target="_blank" rel="noreferrer"
                                                className="flex items-center gap-2.5 group/file">
                                                <div className={`p-2 rounded-lg shrink-0 ${isMe ? 'bg-black/10' : 'bg-white/5 border border-white/10'}`}>
                                                    <Paperclip className={`w-4 h-4 ${isMe ? 'text-black' : 'text-primary'}`} />
                                                </div>
                                                {/* Fix: overflow hidden + min-w-0 prevents name going outside bubble */}
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-xs font-black truncate ${isMe ? 'text-black' : 'text-white'}`}>
                                                        {msg.fileName}
                                                    </p>
                                                    <p className={`text-[9px] uppercase font-black tracking-widest mt-0.5 italic ${isMe ? 'text-black/60' : 'text-primary/80'}`}>
                                                        {getFileLabel(msg.fileName)}
                                                    </p>
                                                </div>
                                                <Download className={`w-3.5 h-3.5 shrink-0 group-hover/file:translate-y-0.5 transition-transform ${isMe ? 'text-black/60' : 'text-white/40'}`} />
                                            </a>
                                        ) : (
                                            <p className="text-sm break-words leading-relaxed">{msg.message}</p>
                                        )}
                                    </div>
                                    <span className={`text-[9px] mt-0.5 font-black uppercase tracking-[0.1em] text-white/25 italic opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'mr-1' : 'ml-1'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    <div ref={scrollRef} />
                </div>

                {/* Status bar: typing / uploading / disconnected */}
                <div className="px-3 sm:px-5 shrink-0 space-y-1 mb-1">
                    {/* Typing indicator — always above input, never inside the scroll */}
                    {typingLabel && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-white/[0.06] animate-fade-in">
                            <div className="flex items-end gap-0.5 h-3 shrink-0">
                                <span className="w-1 h-1 rounded-full animate-bounce" style={{ background: 'rgba(255,255,255,0.4)', animationDelay: '0ms' }}></span>
                                <span className="w-1 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(255,255,255,0.4)', animationDelay: '150ms' }}></span>
                                <span className="w-1 h-1 rounded-full animate-bounce" style={{ background: 'rgba(255,255,255,0.4)', animationDelay: '300ms' }}></span>
                            </div>
                            <span className="text-[10px] font-black text-white/45 italic tracking-wide truncate">{typingLabel}...</span>
                        </div>
                    )}
                    {isUploading && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary/5 border border-primary/15">
                            <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0"></div>
                            <span className="text-[10px] font-black text-primary italic uppercase tracking-wider truncate">
                                Uploading {uploadFileName}...
                            </span>
                        </div>
                    )}
                    {!isConnected && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20">
                            <WifiOff className="w-3 h-3 text-red-400 animate-pulse shrink-0" />
                            <span className="text-[10px] font-black text-red-400 italic uppercase tracking-wider">Re-establishing connection...</span>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="shrink-0 px-3 sm:px-5 pb-3 pt-0">
                    <form onSubmit={sendMessage} className="flex items-center gap-2">
                        {/* File upload */}
                        <label className={`cursor-pointer shrink-0 p-2.5 rounded-xl border transition-all active:scale-90 ${isUploading || !isConnected || isShredded
                            ? 'bg-white/[0.01] border-white/5 opacity-40 cursor-not-allowed'
                            : 'bg-white/[0.03] border-white/10 hover:border-primary/40 hover:bg-white/[0.05]'}`}>
                            <FileUp className={`w-5 h-5 transition-colors ${isUploading ? 'text-primary' : 'text-white/50'}`} />
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.mp3,.wav,.pdf,.docx,.doc,.txt,.py,.ipynb,.zip,.csv"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={isUploading || !isConnected || isShredded}
                            />
                        </label>

                        {/* Text input */}
                        <input
                            type="text"
                            placeholder={isShredded ? 'Room Terminated' : isConnected ? 'Leave no trace...' : 'Signal Lost'}
                            className="flex-1 min-w-0 bg-white/[0.04] border border-white/15 rounded-xl px-4 py-2.5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all text-sm font-medium text-white placeholder:text-white/25 italic"
                            value={input}
                            onChange={handleInputChange}
                            disabled={!isConnected || isShredded}
                        />

                        {/* Send button */}
                        <button
                            type="submit"
                            disabled={!isConnected || isShredded || !input.trim()}
                            className={`shrink-0 p-2.5 rounded-xl transition-all active:scale-95 ${isConnected && input.trim() && !isShredded
                                ? 'bg-gradient-to-br from-primary to-secondary text-black shadow-[0_4px_15px_rgba(0,242,254,0.25)] hover:scale-105'
                                : 'bg-white/[0.05] text-white/20 border border-white/5'}`}>
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatRoom;
