import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Send, FileUp, Download, Shield, Hash, Users, X, Paperclip, WifiOff, LogOut, AlertTriangle, Lock, Sparkles } from 'lucide-react';

const USER_COLORS = [
    '#e879f9', '#a78bfa', '#fbbf24', '#34d399', '#60a5fa',
    '#f472b6', '#fb923c', '#c084fc', '#38bdf8', '#4ade80',
    '#f87171', '#818cf8', '#facc15', '#2dd4bf', '#e879f9',
    '#d946ef', '#8b5cf6', '#f59e0b', '#06b6d4', '#a3e635',
];

function getUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function getFileLabel(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return { py: '🐍 Python', ipynb: '📓 Notebook', txt: '📄 Text', docx: '📝 Word', doc: '📝 Word', pdf: '📕 PDF', zip: '🗜️ Archive', csv: '📊 CSV' }[ext] || '📎 File';
}

const TYPING_TIMEOUT = 2500;
const MSG_KEY = r => `wl_messages_${r}`;
const MSG_EXPIRY_KEY = r => `wl_expiry_${r}`;

const ChatRoom = ({ roomId, secretPhrase, username, createdAt, onLeave }) => {
    const [messages, setMessages] = useState(() => {
        try {
            const exp = localStorage.getItem(MSG_EXPIRY_KEY(roomId));
            if (exp && Date.now() > Number(exp)) { localStorage.removeItem(MSG_KEY(roomId)); localStorage.removeItem(MSG_EXPIRY_KEY(roomId)); return []; }
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
                localStorage.setItem(MSG_EXPIRY_KEY(roomId), String(new Date(createdAt).getTime() + 45 * 60 * 1000));
            }
        } catch { }
    }, [messages, roomId, createdAt]);

    useEffect(() => {
        if (!createdAt) return;
        const shredTime = new Date(createdAt).getTime() + 45 * 60 * 1000;
        const updateTimer = () => {
            const diff = shredTime - Date.now();
            if (diff <= 0) { setTimeLeft('00:00'); setIsShredded(true); localStorage.removeItem(MSG_KEY(roomId)); localStorage.removeItem(MSG_EXPIRY_KEY(roomId)); clearInterval(iv); return; }
            const m = Math.floor((diff % (3600000)) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
        };
        updateTimer();
        const iv = setInterval(updateTimer, 1000);
        return () => clearInterval(iv);
    }, [createdAt, roomId]);

    useEffect(() => {
        const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
        socketRef.current = io(url, { transports: ['websocket', 'polling'], reconnectionAttempts: 5 });
        const sk = socketRef.current;
        sk.on('connect', () => { setIsConnected(true); sk.emit('join_room', { roomId, username }); });
        sk.on('disconnect', () => setIsConnected(false));
        sk.on('receive_message', msg => setMessages(p => [...p, msg]));
        sk.on('room_data', d => { setUserCount(d.userCount); setMembers(d.users || []); });
        sk.on('user_typing', ({ username: u }) => setTypingUsers(p => p.includes(u) ? p : [...p, u]));
        sk.on('user_stop_typing', ({ username: u }) => setTypingUsers(p => p.filter(x => x !== u)));
        return () => { if (sk) sk.disconnect(); };
    }, [roomId, username]);

    useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typingUsers]);

    const handleInputChange = e => {
        setInput(e.target.value);
        if (!isConnected || isShredded || !socketRef.current) return;
        if (!isTypingRef.current) { isTypingRef.current = true; socketRef.current.emit('typing_start', { roomId }); }
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => { isTypingRef.current = false; socketRef.current.emit('typing_stop', { roomId }); }, TYPING_TIMEOUT);
    };

    const sendMessage = e => {
        e?.preventDefault();
        if (!input.trim() || !isConnected || isShredded) return;
        clearTimeout(typingTimerRef.current);
        isTypingRef.current = false;
        socketRef.current.emit('typing_stop', { roomId });
        socketRef.current.emit('send_message', { roomId, message: input, type: 'text' });
        setInput('');
    };

    const handleFileUpload = async e => {
        const file = e.target.files[0];
        if (!file || !isConnected || isShredded) return;
        if (file.size > 25 * 1024 * 1024) { alert('File too large (Max 25MB)'); return; }
        setIsUploading(true); setUploadFileName(file.name);
        const fd = new FormData(); fd.append('file', file);
        try {
            const url = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const res = await fetch(`${url}/api/upload`, { method: 'POST', body: fd });
            const data = await res.json();
            if (res.ok) socketRef.current.emit('send_message', { roomId, type: 'file', fileName: data.fileName, fileUrl: data.fileUrl });
        } catch (err) { console.error(err); }
        finally { setIsUploading(false); setUploadFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }
    };

    const typingLabel = (() => {
        if (!typingUsers.length) return null;
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing`;
        if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
        return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`;
    })();

    const myColor = getUserColor(username);

    // ── Shredded ─────────────────────────────────────────────────────
    if (isShredded) return (
        <div className="flex h-[100dvh] items-center justify-center p-6 text-center"
            style={{ background: '#08040f' }}>
            <div className="space-y-6 animate-fade-up">
                <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
                    style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}>
                    <Shield className="w-8 h-8" style={{ color: '#f43f5e' }} />
                </div>
                <div>
                    <h1 className="font-syne text-4xl font-black italic tracking-tighter" style={{ color: '#fdf4ff' }}>SHREDDED</h1>
                    <p className="text-sm mt-2" style={{ color: 'rgba(253,244,255,0.3)' }}>All messages destroyed after 45 min</p>
                </div>
                <button onClick={onLeave} className="btn-jewel px-8 py-3 rounded-xl text-sm">Return to Home</button>
            </div>
        </div>
    );

    // ── Main ─────────────────────────────────────────────────────────
    return (
        <div className="flex h-[100dvh] overflow-hidden font-sans" style={{ background: '#08040f', color: '#fdf4ff' }}>

            {/* ── LEAVE MODAL ────────────────────────────────────────── */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center px-4"
                    style={{ background: 'rgba(8,4,15,0.85)', backdropFilter: 'blur(16px)' }}
                    onClick={() => setShowLeaveConfirm(false)}>
                    <div className="w-full max-w-[290px] jewel-card" onClick={e => e.stopPropagation()}>
                        <div className="jewel-card-inner p-7 text-center space-y-5">
                            <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center"
                                style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)' }}>
                                <AlertTriangle className="w-7 h-7" style={{ color: '#f43f5e' }} />
                            </div>
                            <div className="space-y-1.5">
                                <h2 className="font-syne font-black text-base" style={{ color: '#fdf4ff' }}>Leave Room?</h2>
                                <p className="text-[11px] leading-relaxed" style={{ color: 'rgba(196,181,253,0.5)' }}>
                                    Your session ends and messages<br />will be cleared from this device.
                                </p>
                            </div>
                            <div className="flex gap-2.5">
                                <button onClick={() => setShowLeaveConfirm(false)}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(232,121,249,0.15)', color: '#c4b5fd' }}>
                                    Stay
                                </button>
                                <button onClick={onLeave}
                                    className="flex-1 py-2.5 rounded-xl text-sm font-black flex items-center justify-center gap-1.5"
                                    style={{ background: 'linear-gradient(135deg,#f43f5e,#e11d48)', color: '#fff', boxShadow: '0 4px 20px rgba(244,63,94,0.35)' }}>
                                    <LogOut className="w-3.5 h-3.5" /> Leave
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile backdrop */}
            {showMembers && (
                <div className="fixed inset-0 z-40 lg:hidden"
                    style={{ background: 'rgba(8,4,15,0.8)', backdropFilter: 'blur(8px)' }}
                    onClick={() => setShowMembers(false)} />
            )}

            {/* ── SIDEBAR ────────────────────────────────────────────── */}
            <aside className={`fixed inset-y-0 left-0 w-[210px] z-50 flex flex-col transform transition-transform duration-300
                ${showMembers ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
                style={{ background: 'linear-gradient(180deg, #0f0820 0%, #0a041a 100%)', borderRight: '1px solid rgba(232,121,249,0.08)' }}>

                {/* Top accent */}
                <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(232,121,249,0.4), transparent)' }} />

                {/* Room info */}
                <div className="p-4 space-y-3" style={{ borderBottom: '1px solid rgba(232,121,249,0.07)' }}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: 'rgba(232,121,249,0.1)', border: '1px solid rgba(232,121,249,0.2)' }}>
                                <Hash className="w-4 h-4" style={{ color: '#e879f9' }} />
                            </div>
                            <div className="min-w-0">
                                <p className="text-xs font-black truncate" style={{ color: '#fdf4ff' }}>{roomId}</p>
                                <p className="text-[8px] uppercase tracking-widest font-black" style={{ color: 'rgba(232,121,249,0.45)' }}>Secure Room</p>
                            </div>
                        </div>
                        <button onClick={() => setShowMembers(false)} className="lg:hidden p-1 rounded-lg"
                            style={{ color: 'rgba(196,181,253,0.4)' }}>
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                        style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.08)' }}>
                        <Lock className="w-3 h-3 shrink-0" style={{ color: 'rgba(232,121,249,0.4)' }} />
                        <span className="text-[8px] font-black uppercase tracking-wider" style={{ color: 'rgba(196,181,253,0.3)' }}>
                            End-to-end encrypted
                        </span>
                    </div>
                </div>

                {/* Members */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    <p className="text-[8px] uppercase font-black tracking-[0.3em] px-1 mb-2" style={{ color: 'rgba(196,181,253,0.25)' }}>
                        Members · {userCount}
                    </p>
                    {members.map(member => {
                        const c = getUserColor(member.name);
                        const isMe = member.name === username;
                        return (
                            <div key={member.id} className="flex items-center gap-2.5 px-2 py-2 rounded-xl transition-all"
                                style={{ background: isMe ? 'rgba(232,121,249,0.06)' : 'transparent', border: isMe ? '1px solid rgba(232,121,249,0.1)' : '1px solid transparent' }}>
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-black"
                                    style={{ background: c + '18', border: `1px solid ${c}30`, color: c }}>
                                    {member.name[0].toUpperCase()}
                                </div>
                                <p className="text-[11px] font-bold truncate flex-1" style={{ color: isMe ? '#e879f9' : '#c4b5fd' }}>
                                    {member.name}{isMe && <span className="ml-1 text-[8px] opacity-40">(you)</span>}
                                </p>
                                <span className="w-1.5 h-1.5 rounded-full shrink-0 animate-soft-pulse" style={{ background: '#e879f9', opacity: 0.7 }} />
                            </div>
                        );
                    })}
                </div>

                {/* Timer */}
                <div className="p-4" style={{ borderTop: '1px solid rgba(232,121,249,0.07)' }}>
                    <p className="text-[8px] uppercase font-black tracking-[0.3em] text-center mb-2" style={{ color: 'rgba(196,181,253,0.25)' }}>
                        Auto-shred in
                    </p>
                    <div className="text-center py-3 rounded-xl"
                        style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.1)' }}>
                        <span className="font-syne text-2xl font-black tabular-nums text-fuchsia-grad">
                            {timeLeft}
                        </span>
                    </div>
                    {/* Bottom accent */}
                    <div className="mt-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.2), rgba(232,121,249,0.15), transparent)' }} />
                </div>
            </aside>

            {/* ── MAIN ───────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col h-full min-w-0">

                {/* Header */}
                <header className="flex items-center justify-between px-4 sm:px-5 py-3 shrink-0"
                    style={{ background: 'rgba(15,8,32,0.9)', borderBottom: '1px solid rgba(232,121,249,0.08)', backdropFilter: 'blur(20px)' }}>
                    {/* Top gradient accent */}
                    <div className="absolute top-0 left-0 right-0 h-px"
                        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(232,121,249,0.3) 30%, rgba(251,191,36,0.2) 60%, transparent 100%)' }} />

                    <div className="flex items-center gap-3 min-w-0">
                        <button onClick={() => setShowMembers(true)}
                            className="lg:hidden p-2 rounded-xl transition-all"
                            style={{ background: 'rgba(232,121,249,0.06)', border: '1px solid rgba(232,121,249,0.12)' }}>
                            <Users className="w-4 h-4" style={{ color: '#e879f9' }} />
                        </button>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="font-syne text-sm font-black tracking-tight truncate" style={{ color: '#fdf4ff' }}>
                                    # {roomId}
                                </span>
                                <span className="hidden sm:flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider"
                                    style={{ background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.15)', color: '#e879f9' }}>
                                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: isConnected ? '#e879f9' : '#f43f5e' }} />
                                    {isConnected ? `${userCount} online` : 'disconnected'}
                                </span>
                            </div>
                            <p className="hidden sm:block text-[8px] uppercase tracking-[0.22em] font-bold mt-0.5" style={{ color: 'rgba(196,181,253,0.3)' }}>
                                Secure · Ephemeral · Encrypted
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(232,121,249,0.05)', border: '1px solid rgba(232,121,249,0.1)' }}>
                            <span className="w-2 h-2 rounded-full" style={{ background: myColor }} />
                            <span className="text-[10px] font-black max-w-[90px] truncate" style={{ color: myColor }}>{username}</span>
                        </div>
                        <button onClick={() => setShowLeaveConfirm(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all"
                            style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.15)', color: '#f43f5e' }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(244,63,94,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(244,63,94,0.08)'}>
                            <LogOut className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">Leave</span>
                        </button>
                    </div>
                </header>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-4">

                    {messages.filter(m => m.type !== 'system').length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                                style={{ background: 'rgba(232,121,249,0.06)', border: '1px solid rgba(232,121,249,0.12)' }}>
                                <Sparkles className="w-7 h-7" style={{ color: 'rgba(232,121,249,0.35)' }} />
                            </div>
                            <p className="text-xs tracking-[0.2em] font-bold uppercase" style={{ color: 'rgba(196,181,253,0.2)' }}>
                                No messages yet.<br />Start a secure conversation.
                            </p>
                        </div>
                    )}

                    {messages.map((msg, i) => {
                        const isMe = msg.username === username;
                        const isSystem = msg.type === 'system';
                        const uc = getUserColor(msg.username || '');

                        if (isSystem) return (
                            <div key={i} className="flex justify-center animate-fade-up">
                                <div className="flex items-center gap-2 px-4 py-1.5 rounded-full"
                                    style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.1)' }}>
                                    <span className="w-1 h-1 rounded-full" style={{ background: '#e879f9' }} />
                                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(196,181,253,0.4)' }}>
                                        {msg.message}
                                    </span>
                                </div>
                            </div>
                        );

                        return (
                            <div key={i} className={`flex gap-3 animate-fade-up ${isMe ? 'flex-row-reverse' : ''}`}>
                                {!isMe && (
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-black self-end mb-5"
                                        style={{ background: uc + '18', border: `1px solid ${uc}30`, color: uc }}>
                                        {msg.username[0].toUpperCase()}
                                    </div>
                                )}
                                <div className={`flex flex-col max-w-[75%] sm:max-w-[60%] gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                                    {!isMe && (
                                        <span className="text-[9px] font-black uppercase tracking-widest ml-1" style={{ color: uc }}>
                                            {msg.username}
                                        </span>
                                    )}
                                    <div className="px-4 py-2.5 rounded-2xl"
                                        style={isMe
                                            ? { background: 'linear-gradient(135deg,#e879f9 0%,#a78bfa 60%,#c084fc 100%)', borderBottomRightRadius: '6px', color: '#08040f', fontWeight: 600, boxShadow: '0 4px 20px rgba(232,121,249,0.25)' }
                                            : { background: '#170d30', border: `1px solid ${uc}20`, borderBottomLeftRadius: '6px', color: '#e4d8ff' }
                                        }>
                                        {msg.type === 'file' ? (
                                            <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 group/file">
                                                <div className="p-2 rounded-lg shrink-0"
                                                    style={isMe ? { background: 'rgba(8,4,15,0.15)' } : { background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.2)' }}>
                                                    <Paperclip className="w-4 h-4" style={{ color: isMe ? 'rgba(8,4,15,0.6)' : '#e879f9' }} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black truncate" style={{ color: isMe ? '#08040f' : '#fdf4ff' }}>{msg.fileName}</p>
                                                    <p className="text-[9px] uppercase font-black tracking-widest mt-0.5"
                                                        style={{ color: isMe ? 'rgba(8,4,15,0.4)' : 'rgba(232,121,249,0.6)' }}>
                                                        {getFileLabel(msg.fileName)}
                                                    </p>
                                                </div>
                                                <Download className="w-3.5 h-3.5 shrink-0 group-hover/file:translate-y-0.5 transition-transform"
                                                    style={{ color: isMe ? 'rgba(8,4,15,0.35)' : 'rgba(196,181,253,0.3)' }} />
                                            </a>
                                        ) : (
                                            <p className="text-sm leading-relaxed break-words">{msg.message}</p>
                                        )}
                                    </div>
                                    <span className="text-[9px] px-1 font-bold" style={{ color: 'rgba(196,181,253,0.2)' }}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Status */}
                <div className="px-4 sm:px-6 shrink-0 space-y-1.5">
                    {typingLabel && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.1)' }}>
                            <div className="flex items-end gap-[3px] h-3">
                                {[0, 120, 240].map(d => (
                                    <span key={d} className="w-1 rounded-full animate-bounce"
                                        style={{ height: d === 120 ? '6px' : '4px', background: 'rgba(232,121,249,0.5)', animationDelay: `${d}ms` }} />
                                ))}
                            </div>
                            <span className="text-[10px] font-bold italic" style={{ color: 'rgba(232,121,249,0.6)' }}>{typingLabel}...</span>
                        </div>
                    )}
                    {isUploading && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                            style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.12)' }}>
                            <div className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin shrink-0"
                                style={{ borderColor: '#e879f9', borderTopColor: 'transparent' }} />
                            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#e879f9' }}>
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

                {/* Input */}
                <div className="px-4 sm:px-6 pb-4 pt-2 shrink-0">
                    <form onSubmit={sendMessage}
                        className="flex items-center gap-2 px-2 py-2 rounded-2xl"
                        style={{ background: '#0f0820', border: '1px solid rgba(232,121,249,0.1)' }}
                        onFocus={e => e.currentTarget.style.borderColor = 'rgba(232,121,249,0.3)'}
                        onBlur={e => e.currentTarget.style.borderColor = 'rgba(232,121,249,0.1)'}>
                        <label className={`shrink-0 p-2.5 rounded-xl cursor-pointer transition-all ${isUploading || !isConnected || isShredded ? 'opacity-30 cursor-not-allowed' : ''}`}
                            style={{ background: 'rgba(232,121,249,0.06)', border: '1px solid rgba(232,121,249,0.1)' }}
                            onMouseEnter={e => { if (!isUploading) e.currentTarget.style.borderColor = 'rgba(232,121,249,0.3)'; }}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(232,121,249,0.1)'}>
                            <FileUp style={{ width: '18px', height: '18px', color: isUploading ? '#e879f9' : 'rgba(196,181,253,0.4)' }} />
                            <input ref={fileInputRef} type="file"
                                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mov,.mp3,.wav,.pdf,.docx,.doc,.txt,.py,.ipynb,.zip,.csv"
                                className="hidden" onChange={handleFileUpload}
                                disabled={isUploading || !isConnected || isShredded} />
                        </label>
                        <input type="text"
                            placeholder={isShredded ? 'Room terminated' : isConnected ? 'Send a message...' : 'Reconnecting...'}
                            className="flex-1 min-w-0 bg-transparent text-sm outline-none italic"
                            style={{ color: '#e4d8ff' }}
                            value={input} onChange={handleInputChange}
                            disabled={!isConnected || isShredded} />
                        <button type="submit"
                            disabled={!isConnected || isShredded || !input.trim()}
                            className="shrink-0 p-2.5 rounded-xl transition-all active:scale-95"
                            style={isConnected && input.trim() && !isShredded
                                ? { background: 'linear-gradient(135deg,#e879f9,#a78bfa)', color: '#08040f', boxShadow: '0 3px 14px rgba(232,121,249,0.3)' }
                                : { background: 'rgba(232,121,249,0.04)', color: 'rgba(196,181,253,0.2)' }}>
                            <Send style={{ width: '16px', height: '16px' }} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatRoom;
