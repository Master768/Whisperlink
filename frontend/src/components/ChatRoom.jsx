import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Send, FileUp, Download, Shield, Hash, Users, X, Paperclip, WifiOff, LogOut, AlertTriangle, Lock } from 'lucide-react';

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

function getFileLabel(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const labels = { py: '🐍 Python', ipynb: '📓 Notebook', txt: '📄 Text', docx: '📝 Word', doc: '📝 Word', pdf: '📕 PDF', zip: '🗜️ Archive', csv: '📊 CSV' };
    return labels[ext] || '📎 File';
}

const TYPING_TIMEOUT = 2500;
const MSG_KEY = (roomId) => `wl_messages_${roomId}`;
const MSG_EXPIRY_KEY = (roomId) => `wl_expiry_${roomId}`;

const ChatRoom = ({ roomId, secretPhrase, username, createdAt, onLeave }) => {
    const [messages, setMessages] = useState(() => {
        try {
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

    useEffect(() => {
        try {
            localStorage.setItem(MSG_KEY(roomId), JSON.stringify(messages));
            if (createdAt && !localStorage.getItem(MSG_EXPIRY_KEY(roomId))) {
                const expiry = new Date(createdAt).getTime() + (45 * 60 * 1000);
                localStorage.setItem(MSG_EXPIRY_KEY(roomId), String(expiry));
            }
        } catch { }
    }, [messages, roomId, createdAt]);

    useEffect(() => {
        if (!createdAt) return;
        const shredTime = new Date(createdAt).getTime() + (45 * 60 * 1000);
        const updateTimer = () => {
            const diff = shredTime - Date.now();
            if (diff <= 0) {
                setTimeLeft('00:00');
                setIsShredded(true);
                localStorage.removeItem(MSG_KEY(roomId));
                localStorage.removeItem(MSG_EXPIRY_KEY(roomId));
                clearInterval(timerInterval);
                return;
            }
            const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            const s = Math.floor((diff % (1000 * 60)) / 1000);
            setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);
        return () => clearInterval(timerInterval);
    }, [createdAt, roomId]);

    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        socketRef.current = io(backendUrl, { transports: ['websocket', 'polling'], reconnectionAttempts: 5 });
        const socket = socketRef.current;
        socket.on('connect', () => { setIsConnected(true); socket.emit('join_room', { roomId, username }); });
        socket.on('disconnect', () => setIsConnected(false));
        socket.on('receive_message', (msg) => setMessages(prev => [...prev, msg]));
        socket.on('room_data', (data) => { setUserCount(data.userCount); setMembers(data.users || []); });
        socket.on('user_typing', ({ username: u }) => setTypingUsers(p => p.includes(u) ? p : [...p, u]));
        socket.on('user_stop_typing', ({ username: u }) => setTypingUsers(p => p.filter(x => x !== u)));
        return () => { if (socket) socket.disconnect(); };
    }, [roomId, username]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typingUsers]);

    const handleInputChange = (e) => {
        setInput(e.target.value);
        if (!isConnected || isShredded || !socketRef.current) return;
        if (!isTypingRef.current) { isTypingRef.current = true; socketRef.current.emit('typing_start', { roomId }); }
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
            isTypingRef.current = false;
            socketRef.current.emit('typing_stop', { roomId });
        }, TYPING_TIMEOUT);
    };

    const sendMessage = (e) => {
        e?.preventDefault();
        if (!input.trim() || !isConnected || isShredded) return;
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
        setIsUploading(true); setUploadFileName(file.name);
        const formData = new FormData(); formData.append('file', file);
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const res = await fetch(`${backendUrl}/api/upload`, { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) socketRef.current.emit('send_message', { roomId, type: 'file', fileName: data.fileName, fileUrl: data.fileUrl });
        } catch (err) { console.error('Upload failed', err); }
        finally { setIsUploading(false); setUploadFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const typingLabel = (() => {
        if (typingUsers.length === 0) return null;
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing`;
        if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
        return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`;
    })();

    // ── Shredded screen ──────────────────────────────────────────────────────
    if (isShredded) {
        return (
            <div className="flex h-[100dvh] items-center justify-center p-6" style={{ background: '#07080f' }}>
                <div className="text-center space-y-6 animate-fade-in">
                    <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                        style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
                        <Shield className="w-8 h-8" style={{ color: '#f43f5e' }} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black italic tracking-tighter" style={{ color: '#f0f0f8' }}>SHREDDED</h1>
                        <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.35)' }}>All messages destroyed after 45 min</p>
                    </div>
                    <button onClick={onLeave} className="px-8 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95"
                        style={{ background: 'linear-gradient(135deg,#10d9a0,#0ea5e9)', color: '#07080f', boxShadow: '0 6px 24px rgba(16,217,160,0.25)' }}>
                        Return to Home
                    </button>
                </div>
            </div>
        );
    }

    // ── Main room ─────────────────────────────────────────────────────────────
    const myColor = getUserColor(username);

    return (
        <div className="flex h-[100dvh] overflow-hidden font-sans" style={{ background: '#07080f', color: '#f0f0f8' }}>

            {/* ── LEAVE CONFIRMATION MODAL (inlined — no blink) ───────────── */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4"
                    style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(14px)' }}
                    onClick={() => setShowLeaveConfirm(false)}>
                    <div className="w-full max-w-[300px]"
                        style={{ borderRadius: '1.5rem', padding: '1px', background: 'linear-gradient(135deg,rgba(244,63,94,0.5),rgba(255,255,255,0.06))' }}
                        onClick={e => e.stopPropagation()}>
                        <div className="p-7 text-center space-y-5" style={{ background: '#0d0f1c', borderRadius: '1.45rem' }}>
                            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
                                style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)' }}>
                                <AlertTriangle className="w-7 h-7" style={{ color: '#f43f5e' }} />
                            </div>
                            <div className="space-y-1.5">
                                <h2 className="font-black text-base tracking-tight" style={{ color: '#f0f0f8' }}>Leave Room?</h2>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
                                    Your session will end and messages<br />will be cleared from this device.
                                </p>
                            </div>
                            <div className="flex gap-2.5">
                                <button onClick={() => setShowLeaveConfirm(false)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#e0e0f0' }}>
                                    Stay
                                </button>
                                <button onClick={onLeave}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-black transition-all flex items-center justify-center gap-1.5"
                                    style={{ background: 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#fff', boxShadow: '0 4px 20px rgba(244,63,94,0.35)' }}>
                                    <LogOut className="w-3.5 h-3.5" /> Leave
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SIDEBAR ──────────────────────────────────────────────────── */}
            {/* Mobile backdrop */}
            {showMembers && (
                <div className="fixed inset-0 z-40 lg:hidden"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
                    onClick={() => setShowMembers(false)} />
            )}

            <aside className={`fixed inset-y-0 left-0 w-[220px] z-50 flex flex-col transform transition-transform duration-300
                ${showMembers ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
                style={{ background: '#0a0b15', borderRight: '1px solid rgba(255,255,255,0.05)' }}>

                {/* Sidebar top: room info */}
                <div className="p-4 space-y-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(16,217,160,0.1)', border: '1px solid rgba(16,217,160,0.2)' }}>
                                <Hash className="w-4 h-4" style={{ color: '#10d9a0' }} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-black truncate" style={{ color: '#f0f0f8' }}>{roomId}</p>
                                <p className="text-[9px] uppercase tracking-widest font-black" style={{ color: 'rgba(16,217,160,0.5)' }}>Room</p>
                            </div>
                        </div>
                        <button onClick={() => setShowMembers(false)} className="lg:hidden p-1 rounded-lg"
                            style={{ color: 'rgba(255,255,255,0.3)' }}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Lock indicator */}
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <Lock className="w-3 h-3 shrink-0" style={{ color: 'rgba(16,217,160,0.5)' }} />
                        <span className="text-[9px] font-black uppercase tracking-wider truncate" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            End-to-end encrypted
                        </span>
                    </div>
                </div>

                {/* Members list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
                    <p className="text-[8px] uppercase font-black tracking-[0.25em] px-1 mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        Members · {userCount}
                    </p>
                    {members.map((member) => {
                        const c = getUserColor(member.name);
                        const isMe = member.name === username;
                        return (
                            <div key={member.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all"
                                style={{ background: isMe ? 'rgba(16,217,160,0.05)' : 'transparent' }}
                                onMouseEnter={e => e.currentTarget.style.background = isMe ? 'rgba(16,217,160,0.08)' : 'rgba(255,255,255,0.03)'}
                                onMouseLeave={e => e.currentTarget.style.background = isMe ? 'rgba(16,217,160,0.05)' : 'transparent'}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black"
                                    style={{ background: c + '18', border: `1px solid ${c}30`, color: c }}>
                                    {member.name[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-bold truncate" style={{ color: isMe ? '#10d9a0' : '#c8c8e0' }}>
                                        {member.name}
                                        {isMe && <span className="ml-1 text-[8px] opacity-50">(you)</span>}
                                    </p>
                                </div>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#10d9a0', opacity: 0.8 }} />
                            </div>
                        );
                    })}
                </div>

                {/* Timer */}
                <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <p className="text-[8px] uppercase font-black tracking-[0.25em] text-center mb-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
                        Auto-shred in
                    </p>
                    <div className="text-center py-3 rounded-xl"
                        style={{ background: 'rgba(16,217,160,0.05)', border: '1px solid rgba(16,217,160,0.1)' }}>
                        <span className="text-2xl font-black tabular-nums"
                            style={{ background: 'linear-gradient(135deg,#10d9a0,#3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                            {timeLeft}
                        </span>
                    </div>
                </div>
            </aside>

            {/* ── MAIN CHAT AREA ───────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col h-full min-w-0">

                {/* Header */}
                <header className="flex items-center justify-between px-4 sm:px-5 py-3 shrink-0"
                    style={{ background: 'rgba(10,11,21,0.9)', borderBottom: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)' }}>
                    <div className="flex items-center gap-3 min-w-0">
                        {/* Mobile toggle */}
                        <button onClick={() => setShowMembers(true)}
                            className="lg:hidden p-2 rounded-xl transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            <Users className="w-4 h-4" style={{ color: '#10d9a0' }} />
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black tracking-tight truncate" style={{ color: '#f0f0f8' }}>
                                    # {roomId}
                                </span>
                                <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider"
                                    style={{ background: 'rgba(16,217,160,0.08)', border: '1px solid rgba(16,217,160,0.15)', color: '#10d9a0' }}>
                                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: isConnected ? '#10d9a0' : '#f43f5e' }} />
                                    {isConnected ? `${userCount} online` : 'disconnected'}
                                </span>
                            </div>
                            <p className="text-[9px] uppercase tracking-[0.2em] font-bold mt-0.5 hidden sm:block" style={{ color: 'rgba(255,255,255,0.2)' }}>
                                Secure · Ephemeral · Encrypted
                            </p>
                        </div>
                    </div>

                    {/* Right: username pill + leave */}
                    <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: myColor }} />
                            <span className="text-[10px] font-black truncate max-w-[90px]" style={{ color: myColor }}>{username}</span>
                        </div>
                        <button onClick={() => setShowLeaveConfirm(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all active:scale-95"
                            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', color: '#f43f5e' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.08)'}>
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Leave</span>
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4"
                    style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(16,217,160,0.1) transparent' }}>

                    {/* Empty state */}
                    {messages.filter(m => m.type !== 'system').length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-3">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                                style={{ background: 'rgba(16,217,160,0.06)', border: '1px solid rgba(16,217,160,0.1)' }}>
                                <Shield className="w-6 h-6" style={{ color: 'rgba(16,217,160,0.35)' }} />
                            </div>
                            <p className="text-xs tracking-[0.2em] font-black uppercase" style={{ color: 'rgba(255,255,255,0.15)' }}>
                                No messages yet.<br />Start a secure conversation.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, i) => {
                        const isMe = msg.username === username;
                        const isSystem = msg.type === 'system';
                        const userColor = getUserColor(msg.username || '');

                        // — System message —
                        if (isSystem) return (
                            <div key={i} className="flex justify-center animate-fade-in">
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                                    <span className="w-1 h-1 rounded-full" style={{ background: '#10d9a0' }} />
                                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>
                                        {msg.message}
                                    </span>
                                </div>
                            </div>
                        );

                        // — Chat message —
                        return (
                            <div key={i} className={`flex gap-3 animate-fade-in ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                                {/* Avatar — only for others */}
                                {!isMe && (
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black self-end mb-1"
                                        style={{ background: userColor + '18', border: `1px solid ${userColor}35`, color: userColor }}>
                                        {msg.username[0].toUpperCase()}
                                    </div>
                                )}

                                <div className={`flex flex-col max-w-[75%] sm:max-w-[60%] gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                                    {/* Name (others only) */}
                                    {!isMe && (
                                        <span className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: userColor }}>
                                            {msg.username}
                                        </span>
                                    )}

                                    {/* Bubble */}
                                    <div className="px-4 py-2.5 rounded-2xl"
                                        style={isMe
                                            ? {
                                                background: 'linear-gradient(135deg,#10d9a0,#0ea5e9)',
                                                borderBottomRightRadius: '6px',
                                                color: '#07080f',
                                                fontWeight: 600,
                                                boxShadow: '0 4px 20px rgba(16,217,160,0.18)'
                                            }
                                            : {
                                                background: '#141628',
                                                border: `1px solid ${userColor}22`,
                                                borderBottomLeftRadius: '6px',
                                                color: '#e0e0f0'
                                            }
                                        }>
                                        {msg.type === 'file' ? (
                                            <a href={msg.fileUrl} target="_blank" rel="noreferrer"
                                                className="flex items-center gap-3 group/file">
                                                <div className="p-2 rounded-lg shrink-0"
                                                    style={isMe
                                                        ? { background: 'rgba(0,0,0,0.12)' }
                                                        : { background: 'rgba(16,217,160,0.08)', border: '1px solid rgba(16,217,160,0.2)' }}>
                                                    <Paperclip className="w-4 h-4" style={{ color: isMe ? 'rgba(0,0,0,0.6)' : '#10d9a0' }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black truncate" style={{ color: isMe ? '#07080f' : '#f0f0f8' }}>
                                                        {msg.fileName}
                                                    </p>
                                                    <p className="text-[9px] uppercase font-black tracking-widest mt-0.5"
                                                        style={{ color: isMe ? 'rgba(0,0,0,0.45)' : 'rgba(16,217,160,0.65)' }}>
                                                        {getFileLabel(msg.fileName)}
                                                    </p>
                                                </div>
                                                <Download className="w-3.5 h-3.5 shrink-0 group-hover/file:translate-y-0.5 transition-transform"
                                                    style={{ color: isMe ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.25)' }} />
                                            </a>
                                        ) : (
                                            <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                                        )}
                                    </div>

                                    {/* Timestamp */}
                                    <span className="text-[9px] font-bold px-1" style={{ color: 'rgba(255,255,255,0.18)' }}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}

                    <div ref={scrollRef} />
                </div>

                {/* Status bar: typing / uploading / disconnected */}
                <div className="px-4 sm:px-6 space-y-1.5 shrink-0">
                    {typingLabel && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(16,217,160,0.04)', border: '1px solid rgba(16,217,160,0.1)' }}>
                            <div className="flex items-end gap-[3px] h-3">
                                {[0, 120, 240].map(d => (
                                    <span key={d} className="w-1 rounded-full animate-bounce"
                                        style={{ height: d === 120 ? '6px' : '4px', background: 'rgba(16,217,160,0.5)', animationDelay: `${d}ms` }} />
                                ))}
                            </div>
                            <span className="text-[10px] font-bold italic" style={{ color: 'rgba(16,217,160,0.6)' }}>{typingLabel}...</span>
                        </div>
                    )}
                    {isUploading && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(16,217,160,0.04)', border: '1px solid rgba(16,217,160,0.12)' }}>
                            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                                style={{ borderColor: '#10d9a0', borderTopColor: 'transparent' }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#10d9a0' }}>
                                Uploading {uploadFileName}...
                            </span>
                        </div>
                    )}
                    {!isConnected && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)' }}>
                            <WifiOff className="w-3 h-3 shrink-0" style={{ color: '#f43f5e' }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#f43f5e' }}>
                                Reconnecting...
                            </span>
                        </div>
                    )}
                </div>

                {/* Input bar */}
                <div className="px-4 sm:px-6 pb-4 pt-2 shrink-0">
                    <form onSubmit={sendMessage}
                        className="flex items-center gap-2 px-2 py-2 rounded-2xl transition-all"
                        style={{ background: '#111320', border: '1px solid rgba(255,255,255,0.07)' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(16,217,160,0.25)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>

                        {/* File upload */}
                        <label className={`shrink-0 p-2.5 rounded-xl cursor-pointer transition-all ${isUploading || !isConnected || isShredded ? 'opacity-30 cursor-not-allowed' : ''}`}
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
                            onMouseEnter={e => { if (!isUploading) e.currentTarget.style.borderColor = 'rgba(16,217,160,0.3)'; }}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'}>
                            <FileUp className="w-4.5 h-4.5" style={{ color: isUploading ? '#10d9a0' : 'rgba(255,255,255,0.3)', width: '18px', height: '18px' }} />
                            <input ref={fileInputRef} type="file"
                                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.mp3,.wav,.pdf,.docx,.doc,.txt,.py,.ipynb,.zip,.csv"
                                className="hidden" onChange={handleFileUpload}
                                disabled={isUploading || !isConnected || isShredded} />
                        </label>

                        {/* Text input */}
                        <input type="text"
                            placeholder={isShredded ? 'Room terminated' : isConnected ? 'Send a message...' : 'Reconnecting...'}
                            className="flex-1 min-w-0 bg-transparent text-sm outline-none italic"
                            style={{ color: '#e0e0f0' }}
                            value={input}
                            onChange={handleInputChange}
                            disabled={!isConnected || isShredded}
                        />

                        {/* Send */}
                        <button type="submit"
                            disabled={!isConnected || isShredded || !input.trim()}
                            className="shrink-0 p-2.5 rounded-xl transition-all active:scale-95"
                            style={isConnected && input.trim() && !isShredded
                                ? { background: 'linear-gradient(135deg,#10d9a0,#0ea5e9)', color: '#07080f', boxShadow: '0 3px 14px rgba(16,217,160,0.28)' }
                                : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.18)' }}>
                            <Send style={{ width: '16px', height: '16px' }} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatRoom;
