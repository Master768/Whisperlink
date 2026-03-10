import React, { useState, useEffect, useRef, useCallback } from 'react';
import io from 'socket.io-client';
import { Send, FileUp, Download, Shield, Hash, Users, X, Paperclip, WifiOff, LogOut, AlertTriangle } from 'lucide-react';

// Deterministic color from username — premium palette for dark bg
const USER_COLORS = [
    '#10d9a0', '#3b82f6', '#a78bfa', '#f59e0b', '#ec4899',
    '#06b6d4', '#84cc16', '#f97316', '#8b5cf6', '#14b8a6',
    '#e879f9', '#34d399', '#60a5fa', '#fbbf24', '#fb7185',
    '#38bdf8', '#a3e635', '#fb923c', '#c084fc', '#2dd4bf',
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
    const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
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
            <div className="flex h-[100dvh] items-center justify-center p-6 text-center"
                style={{ background: '#07080f' }}>
                <div className="space-y-5 animate-fade-in">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto"
                        style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
                        <Shield className="w-7 h-7" style={{ color: '#f43f5e' }} />
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase" style={{ color: '#f0f0f8' }}>Room Shredded</h1>
                    <p className="max-w-xs mx-auto text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                        The 45-minute silence has ended. All messages have been permanently destroyed.
                    </p>
                    <button onClick={onLeave}
                        className="px-8 py-3 font-bold rounded-xl transition-all hover:scale-105"
                        style={{ background: 'linear-gradient(135deg, #10d9a0, #0ea5e9)', color: '#07080f', boxShadow: '0 6px 24px rgba(16,217,160,0.25)' }}>
                        Return to Void
                    </button>
                </div>
            </div>
        );
    }

    // Leave confirmation modal
    const LeaveModal = () => (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4"
            style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)' }}
            onClick={() => setShowLeaveConfirm(false)}>
            <div className="w-full max-w-xs animate-fade-in"
                style={{ borderRadius: '1.4rem', padding: '1px', background: 'linear-gradient(135deg, rgba(244,63,94,0.4) 0%, rgba(255,255,255,0.08) 100%)' }}
                onClick={e => e.stopPropagation()}>
                <div className="p-6 space-y-5 text-center" style={{ background: '#0e101a', borderRadius: '1.35rem' }}>
                    {/* Icon */}
                    <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
                        <AlertTriangle className="w-7 h-7" style={{ color: '#f43f5e' }} />
                    </div>
                    {/* Text */}
                    <div className="space-y-2">
                        <h2 className="text-lg font-black tracking-tight" style={{ color: '#f0f0f8' }}>Leave the Room?</h2>
                        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                            You'll lose access to the current session.<br />
                            Messages will be cleared from this device.
                        </p>
                    </div>
                    {/* Buttons */}
                    <div className="flex gap-3">
                        <button onClick={() => setShowLeaveConfirm(false)}
                            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95"
                            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f8' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.09)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}>
                            Stay
                        </button>
                        <button onClick={onLeave}
                            className="flex-1 py-3 rounded-xl text-sm font-black transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2"
                            style={{ background: 'linear-gradient(135deg, #f43f5e, #e11d48)', color: '#fff', boxShadow: '0 4px 18px rgba(244,63,94,0.3)' }}
                            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 6px 24px rgba(244,63,94,0.45)'}
                            onMouseLeave={e => e.currentTarget.style.boxShadow = '0 4px 18px rgba(244,63,94,0.3)'}>
                            <LogOut className="w-4 h-4" />
                            Leave
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex h-[100dvh] overflow-hidden font-sans relative" style={{ background: '#07080f', color: '#f0f0f8' }}>
            {/* Leave confirmation modal */}
            {showLeaveConfirm && <LeaveModal />}

            {/* Sidebar overlay (mobile) */}
            {showMembers && (
                <div className="fixed inset-0 z-40 lg:hidden" style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => setShowMembers(false)} />
            )}

            {/* Members Sidebar */}
            <div className={`fixed inset-y-0 right-0 w-64 z-50 flex flex-col transform transition-transform duration-300 ease-out
                ${showMembers ? 'translate-x-0' : 'translate-x-full'} lg:relative lg:translate-x-0`}
                style={{ background: '#0a0c14', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="px-4 py-3 flex items-center justify-between shrink-0"
                    style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(7,8,15,0.6)' }}>
                    <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4" style={{ color: '#10d9a0' }} />
                        <h3 className="font-black text-[10px] uppercase tracking-[0.3em] italic" style={{ color: 'rgba(255,255,255,0.7)' }}>Active</h3>
                    </div>
                    <button onClick={() => setShowMembers(false)} className="lg:hidden p-1 rounded-lg hover:bg-white/5">
                        <X className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.4)' }} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {members.map((member) => {
                        const color = getUserColor(member.name);
                        return (
                            <div key={member.id} className="flex items-center space-x-3 p-2.5 rounded-xl transition-all"
                                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                                onMouseEnter={e => e.currentTarget.style.borderColor = color + '30'}
                                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'}>
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-black text-sm"
                                    style={{ background: color + '18', border: `1px solid ${color}35`, color }}>
                                    {member.name[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate" style={{ color }}>
                                        {member.name} {member.name === username && <span className="text-[9px] italic opacity-50">You</span>}
                                    </p>
                                    <div className="flex items-center space-x-1 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#10d9a0' }}></span>
                                        <span className="text-[9px] uppercase font-black" style={{ color: 'rgba(255,255,255,0.3)' }}>Online</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Timer */}
                <div className="px-4 py-4 shrink-0"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(7,8,15,0.6)' }}>
                    <div className="text-[9px] font-black uppercase tracking-[0.3em] text-center mb-1 italic" style={{ color: 'rgba(255,255,255,0.3)' }}>Shred Countdown</div>
                    <div className="text-3xl font-black text-center tracking-tighter tabular-nums"
                        style={{ background: 'linear-gradient(135deg, #10d9a0, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                        {timeLeft}
                    </div>
                </div>
            </div>

            {/* Main Chat */}
            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                {/* Header */}
                <div className="px-4 sm:px-5 py-3 flex items-center justify-between z-10 shrink-0"
                    style={{ background: 'rgba(10,12,20,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
                    <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 rounded-xl shrink-0"
                            style={{ background: 'rgba(16,217,160,0.08)', border: '1px solid rgba(16,217,160,0.18)' }}>
                            <Hash className="w-4 h-4" style={{ color: '#10d9a0' }} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm font-black tracking-tight truncate" style={{ color: '#f0f0f8' }}>{roomId}</h2>
                            <div className="flex items-center space-x-1.5 text-[9px] uppercase tracking-[0.15em] font-black italic">
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: isConnected ? '#10d9a0' : '#f43f5e' }}></span>
                                <span style={{ color: isConnected ? '#10d9a0' : '#f43f5e' }}>
                                    {isConnected ? `${userCount} Member${userCount !== 1 ? 's' : ''}` : 'Signal Lost'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                        <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: getUserColor(username) }}></div>
                            <span className="text-[10px] font-black uppercase tracking-widest italic max-w-[80px] truncate" style={{ color: getUserColor(username) }}>{username}</span>
                        </div>

                        <button onClick={() => setShowMembers(!showMembers)}
                            className="lg:hidden relative p-2 rounded-xl active:scale-95"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <Users className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.6)' }} />
                            {userCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 text-[8px] font-black rounded-md flex items-center justify-center"
                                    style={{ background: '#10d9a0', color: '#07080f' }}>
                                    {userCount}
                                </span>
                            )}
                        </button>

                        <button onClick={() => setShowLeaveConfirm(true)}
                            className="p-2 rounded-xl group active:scale-90 transition-all"
                            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.08)'}
                            title="Leave Room">
                            <X className="w-4 h-4" style={{ color: '#f43f5e' }} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 sm:px-5 pt-4 pb-2 space-y-3">
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <div className="w-12 h-12 rounded-full mb-4 flex items-center justify-center"
                            style={{ background: 'rgba(16,217,160,0.06)', border: '1px solid rgba(16,217,160,0.1)' }}>
                            <Shield className="w-5 h-5" style={{ color: 'rgba(16,217,160,0.4)' }} />
                        </div>
                        <p className="text-[9px] max-w-[200px] tracking-[0.25em] font-black uppercase italic leading-loose" style={{ color: 'rgba(255,255,255,0.2)' }}>
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
                                    <div className="flex items-center space-x-2 px-3 py-1 rounded-full"
                                        style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                                        <div className="w-1 h-1 rounded-full shrink-0" style={{ background: '#10d9a0' }}></div>
                                        <span className="text-[9px] font-black uppercase tracking-[0.15em] italic" style={{ color: 'rgba(255,255,255,0.4)' }}>{msg.message}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
                                <div className={`max-w-[80%] sm:max-w-[65%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {!isMe && (
                                        <span className="text-[9px] font-black uppercase tracking-[0.15em] italic mb-1 ml-1" style={{ color: userColor }}>
                                            {msg.username}
                                        </span>
                                    )}
                                    <div className={`px-3.5 py-2.5 rounded-2xl w-full ${isMe ? 'rounded-tr-none' : 'rounded-tl-none'}`}
                                        style={isMe
                                            ? { background: 'linear-gradient(135deg, #10d9a0 0%, #0ea5e9 100%)', color: '#07080f', fontWeight: 600, boxShadow: '0 4px 16px rgba(16,217,160,0.2)' }
                                            : { background: '#0e101a', border: `1px solid ${userColor ? userColor + '20' : 'rgba(255,255,255,0.06)'}`, color: '#e8e8f5' }}>
                                        {msg.type === 'file' ? (
                                            <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 group/file">
                                                <div className="p-2 rounded-lg shrink-0" style={isMe
                                                    ? { background: 'rgba(0,0,0,0.15)' }
                                                    : { background: 'rgba(16,217,160,0.08)', border: '1px solid rgba(16,217,160,0.2)' }}>
                                                    <Paperclip className="w-4 h-4" style={{ color: isMe ? 'rgba(0,0,0,0.7)' : '#10d9a0' }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black truncate" style={{ color: isMe ? '#07080f' : '#f0f0f8' }}>{msg.fileName}</p>
                                                    <p className="text-[9px] uppercase font-black tracking-widest mt-0.5 italic" style={{ color: isMe ? 'rgba(0,0,0,0.5)' : 'rgba(16,217,160,0.7)' }}>
                                                        {getFileLabel(msg.fileName)}
                                                    </p>
                                                </div>
                                                <Download className="w-3.5 h-3.5 shrink-0 group-hover/file:translate-y-0.5 transition-transform" style={{ color: isMe ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.3)' }} />
                                            </a>
                                        ) : (
                                            <p className="text-sm break-words leading-relaxed">{msg.message}</p>
                                        )}
                                    </div>
                                    <span className={`text-[9px] mt-0.5 font-black uppercase tracking-[0.1em] italic opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'mr-1' : 'ml-1'}`}
                                        style={{ color: 'rgba(255,255,255,0.2)' }}>
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
                    {typingLabel && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl animate-fade-in"
                            style={{ background: 'rgba(16,217,160,0.04)', border: '1px solid rgba(16,217,160,0.1)' }}>
                            <div className="flex items-end gap-0.5 h-3 shrink-0">
                                {[0, 150, 300].map((delay) => (
                                    <span key={delay} className="w-1 rounded-full animate-bounce"
                                        style={{ height: delay === 150 ? '6px' : '4px', background: 'rgba(16,217,160,0.5)', animationDelay: `${delay}ms` }}>
                                    </span>
                                ))}
                            </div>
                            <span className="text-[10px] font-black italic tracking-wide truncate" style={{ color: 'rgba(16,217,160,0.6)' }}>{typingLabel}...</span>
                        </div>
                    )}
                    {isUploading && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(16,217,160,0.04)', border: '1px solid rgba(16,217,160,0.12)' }}>
                            <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin shrink-0" style={{ borderColor: '#10d9a0', borderTopColor: 'transparent' }}></div>
                            <span className="text-[10px] font-black italic uppercase tracking-wider truncate" style={{ color: '#10d9a0' }}>Uploading {uploadFileName}...</span>
                        </div>
                    )}
                    {!isConnected && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)' }}>
                            <WifiOff className="w-3 h-3 animate-pulse shrink-0" style={{ color: '#f43f5e' }} />
                            <span className="text-[10px] font-black italic uppercase tracking-wider" style={{ color: '#f43f5e' }}>Re-establishing connection...</span>
                        </div>
                    )}
                </div>

                {/* Input */}
                <div className="shrink-0 px-3 sm:px-5 pb-4 pt-0">
                    <form onSubmit={sendMessage} className="flex items-center gap-2"
                        style={{ background: 'rgba(14,16,26,0.8)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '1rem', padding: '6px' }}>
                        <label className={`cursor-pointer shrink-0 p-2.5 rounded-xl transition-all active:scale-90 ${isUploading || !isConnected || isShredded ? 'opacity-40 cursor-not-allowed' : ''
                            }`}
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                            onMouseEnter={e => { if (!isUploading) e.currentTarget.style.borderColor = 'rgba(16,217,160,0.35)'; }}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'}>
                            <FileUp className="w-5 h-5 transition-colors" style={{ color: isUploading ? '#10d9a0' : 'rgba(255,255,255,0.35)' }} />
                            <input ref={fileInputRef} type="file"
                                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.mp3,.wav,.pdf,.docx,.doc,.txt,.py,.ipynb,.zip,.csv"
                                className="hidden" onChange={handleFileUpload}
                                disabled={isUploading || !isConnected || isShredded}
                            />
                        </label>

                        <input type="text"
                            placeholder={isShredded ? 'Room Terminated' : isConnected ? 'Leave no trace...' : 'Signal Lost'}
                            className="flex-1 min-w-0 py-2.5 px-3 text-sm font-medium italic transition-all"
                            style={{ background: 'transparent', border: 'none', outline: 'none', color: '#f0f0f8' }}
                            value={input}
                            onChange={handleInputChange}
                            disabled={!isConnected || isShredded}
                        />

                        <button type="submit"
                            disabled={!isConnected || isShredded || !input.trim()}
                            className="shrink-0 p-2.5 rounded-xl transition-all active:scale-95 hover:scale-105"
                            style={isConnected && input.trim() && !isShredded
                                ? { background: 'linear-gradient(135deg, #10d9a0, #0ea5e9)', color: '#07080f', boxShadow: '0 4px 16px rgba(16,217,160,0.3)' }
                                : { background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatRoom;
