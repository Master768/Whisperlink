import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Send, FileUp, Download, Shield, Hash, Users, X, Paperclip, WifiOff, LogOut, AlertTriangle, Lock, Clock, Copy, Check } from 'lucide-react';

const USER_COLORS = [
    '#2f81f7', '#3fb950', '#a371f7', '#f85149', '#d29922',
    '#58a6ff', '#8b949e', '#ff7b72', '#d2a8ff', '#cca700'
];

function getUserColor(username) {
    let hash = 0;
    for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
    return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

function getFileLabel(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return { py: 'Python', ipynb: 'Notebook', txt: 'Text', docx: 'Word', doc: 'Word', pdf: 'PDF', zip: 'Archive', csv: 'CSV', r: 'R File', json: 'JSON' }[ext] || 'File';
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
    const [copiedId, setCopiedId] = useState(null);
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
        const file = e?.target?.files ? e.target.files[0] : e;
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

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image/') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    e.preventDefault();
                    const file = new File([blob], 'pasted-image.png', { type: blob.type });
                    handleFileUpload(file);
                    break;
                }
            }
        }
    };

    const handleCopy = (text, idx) => {
        navigator.clipboard.writeText(text);
        setCopiedId(idx);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const typingLabel = (() => {
        if (!typingUsers.length) return null;
        if (typingUsers.length === 1) return `${typingUsers[0]} is typing`;
        if (typingUsers.length === 2) return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
        return `${typingUsers[0]} and ${typingUsers.length - 1} others are typing`;
    })();

    // ── Shredded ─────────────────────────────────────────────────────
    if (isShredded) return (
        <div className="flex h-[100dvh] items-center justify-center p-6 text-center bg-[var(--bg-main)]">
            <div className="space-y-6 fade-in max-w-sm w-full p-8 rounded-2xl glass-panel">
                <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center bg-[var(--bg-surface)] border border-[var(--border-color)]">
                    <Shield className="w-8 h-8 text-[var(--danger)]" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white mb-2">Room Shredded</h1>
                    <p className="text-sm text-[var(--text-secondary)]">The 45-minute secure session has ended. All ephemeral data has been securely destroyed.</p>
                </div>
                <button onClick={onLeave} className="btn-primary w-full py-3 rounded-xl font-medium">Return to Home</button>
            </div>
        </div>
    );

    // ── Main Layout ──────────────────────────────────────────────────
    return (
        <div className="flex flex-col lg:flex-row h-[100dvh] overflow-hidden bg-[var(--bg-main)]">

            {/* LEAVE MODAL */}
            {showLeaveConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
                    onClick={() => setShowLeaveConfirm(false)}>
                    <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl p-6 fade-in shadow-2xl"
                        onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-red-500/10 rounded-xl">
                                <AlertTriangle className="w-6 h-6 text-[var(--danger)]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Leave Room?</h3>
                                <p className="text-sm text-[var(--text-secondary)]">You will lose access to this session.</p>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowLeaveConfirm(false)} className="flex-1 btn-secondary py-2.5 rounded-xl font-medium">Cancel</button>
                            <button onClick={onLeave} className="flex-1 bg-[var(--danger)] hover:bg-red-600 text-white py-2.5 rounded-xl font-medium transition-colors">Leave</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SIDEBAR */}
            {showMembers && (
                <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setShowMembers(false)} />
            )}

            <aside className={`fixed inset-y-0 left-0 w-72 z-50 flex flex-col transform transition-transform duration-200 bg-[var(--bg-surface)] border-r border-[var(--border-color)]
                ${showMembers ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>

                {/* Brand / Room Info */}
                <div className="p-5 border-b border-[var(--border-color)]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-[var(--primary-accent)]/10 flex items-center justify-center">
                                <Hash className="w-4 h-4 text-[var(--primary-accent)]" />
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-white">{roomId}</h2>
                                <p className="text-xs text-[var(--text-secondary)]">Ephemeral Room</p>
                            </div>
                        </div>
                        <button onClick={() => setShowMembers(false)} className="lg:hidden p-1.5 rounded-md hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)]">
                        <Lock className="w-4 h-4 text-[var(--success)]" />
                        <span className="text-xs font-medium text-[var(--text-secondary)]">End-to-End Encrypted</span>
                    </div>
                </div>

                {/* Members List */}
                <div className="flex-1 overflow-y-auto p-3">
                    <div className="px-2 mb-2">
                        <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Members — {userCount}</p>
                    </div>
                    <div className="space-y-1">
                        {members.map(member => {
                            const isMe = member.name === username;
                            const uc = getUserColor(member.name);
                            return (
                                <div key={member.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${isMe ? 'bg-[var(--bg-main)]' : 'hover:bg-[var(--bg-surface-hover)]'}`}>
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: uc }}>
                                        {member.name[0].toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-white truncate">{member.name}</p>
                                        <p className="text-xs text-[var(--text-secondary)]">{isMe ? 'You' : 'Active'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Timer Info */}
                <div className="p-5 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-[var(--bg-main)] border border-[var(--border-color)]">
                        <div className="p-2 rounded-lg bg-[var(--primary-accent)]/10">
                            <Clock className="w-4 h-4 text-[var(--primary-accent)]" />
                        </div>
                        <div>
                            <p className="text-xs text-[var(--text-secondary)]">Time Remaining</p>
                            <p className="text-lg font-mono font-semibold text-white tracking-widest leading-none mt-0.5">{timeLeft}</p>
                        </div>
                    </div>
                </div>
            </aside>

            {/* MAIN CHAT */}
            <main className="flex-1 flex flex-col min-w-0 h-full bg-[var(--bg-main)]">

                {/* Header */}
                <header className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-main)]/80 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setShowMembers(true)} className="lg:hidden p-2 rounded-lg btn-secondary text-[var(--text-secondary)]">
                            <Users className="w-5 h-5" />
                        </button>
                        <div>
                            <h1 className="text-lg font-semibold text-white">Secure Chat</h1>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-[var(--success)]' : 'bg-[var(--danger)]'}`} />
                                <span className="text-xs font-medium text-[var(--text-secondary)]">{isConnected ? 'Connected' : 'Offline'}</span>
                            </div>
                        </div>
                    </div>

                    <button onClick={() => setShowLeaveConfirm(true)} className="btn-secondary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:text-[var(--danger)] hover:border-[var(--danger)]/30">
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">Leave</span>
                    </button>
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6">
                    {messages.filter(m => m.type !== 'system').length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                            <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                                <Shield className="w-8 h-8 text-[var(--primary-accent)]" />
                            </div>
                            <div>
                                <h3 className="text-lg font-medium text-white">No messages yet</h3>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">Start a secure, untraceable conversation.</p>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => {
                        const isMe = msg.username === username;
                        const isSystem = msg.type === 'system';
                        const uc = getUserColor(msg.username || '');

                        if (isSystem) return (
                            <div key={i} className="flex justify-center my-4 fade-in">
                                <span className="px-3 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-medium text-[var(--text-secondary)]">
                                    {msg.message}
                                </span>
                            </div>
                        );

                        return (
                            <div key={i} className={`flex gap-3 fade-in ${isMe ? 'flex-row-reverse' : ''}`}>
                                {!isMe && (
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm mt-5" style={{ backgroundColor: uc }}>
                                        {msg.username[0].toUpperCase()}
                                    </div>
                                )}
                                <div className={`flex flex-col max-w-[80%] sm:max-w-[65%] gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
                                    {!isMe && <span className="text-xs font-medium ml-1" style={{ color: uc }}>{msg.username}</span>}

                                    <div className={`px-4 py-3 rounded-2xl relative group ${isMe ? 'bg-[var(--primary-accent)] text-white' : 'bg-[var(--bg-surface)] border border-[var(--border-color)] text-[var(--text-primary)]'}`}
                                        style={{ borderBottomRightRadius: isMe ? '4px' : '16px', borderBottomLeftRadius: isMe ? '16px' : '4px' }}>

                                        {msg.type === 'file' ? (
                                            <a href={msg.fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 group max-w-full overflow-hidden">
                                                <div className={`p-2 shrink-0 rounded-lg ${isMe ? 'bg-black/20' : 'bg-[var(--bg-main)] border border-[var(--border-color)]'}`}>
                                                    <Paperclip className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0 pr-2 overflow-hidden">
                                                    <p className="text-sm font-semibold truncate">{msg.fileName}</p>
                                                    <p className="text-xs opacity-70">{getFileLabel(msg.fileName)}</p>
                                                </div>
                                                <Download className="w-4 h-4 shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                                            </a>
                                        ) : (
                                            <div className="relative">
                                                <p className="text-[15px] leading-relaxed break-words whitespace-pre-wrap pr-6">{msg.message}</p>
                                                <button 
                                                    onClick={() => handleCopy(msg.message, i)}
                                                    className={`absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity rounded ${isMe ? 'bg-black/20 hover:bg-black/40' : 'bg-[var(--bg-main)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                                    title="Copy message"
                                                >
                                                    {copiedId === i ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-[10px] font-medium text-[var(--text-secondary)] px-1">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Status Items */}
                <div className="px-5 space-y-2 shrink-0">
                    {typingLabel && <div className="text-xs font-medium text-[var(--text-secondary)] italic">{typingLabel}...</div>}
                    {isUploading && (
                        <div className="flex items-center gap-2 text-xs font-medium text-[var(--primary-accent)] bg-[var(--primary-accent)]/10 px-3 py-1.5 rounded-lg w-fit">
                            <span className="w-3 h-3 rounded-full border-2 border-t-transparent animate-spin border-[var(--primary-accent)]" /> Uploading...
                        </div>
                    )}
                    {!isConnected && (
                        <div className="flex items-center gap-2 text-xs font-medium text-[var(--danger)] bg-[var(--danger)]/10 px-3 py-1.5 rounded-lg w-fit">
                            <WifiOff className="w-3 h-3" /> Reconnecting...
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-5 pt-3 bg-gradient-to-t from-[var(--bg-main)] to-transparent shrink-0">
                    <form onSubmit={sendMessage} className="flex items-end gap-2 bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-2 focus-within:border-[var(--primary-accent)] focus-within:ring-1 focus-within:ring-[var(--primary-accent)] transition-all">

                        <label className={`p-2.5 rounded-lg cursor-pointer text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-main)] transition-colors ${isUploading || !isConnected || isShredded ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <FileUp className="w-5 h-5" />
                            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading || !isConnected || isShredded} />
                        </label>

                        <textarea
                            value={input}
                            onChange={handleInputChange}
                            onPaste={handlePaste}
                            disabled={!isConnected || isShredded}
                            placeholder={isShredded ? "Session ended" : "Type a message..."}
                            className="flex-1 max-h-32 min-h-[44px] bg-transparent border-none text-[15px] text-white resize-none outline-none py-3 px-2"
                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); } }}
                        />

                        <button type="submit" disabled={!isConnected || isShredded || !input.trim()}
                            className="p-2.5 rounded-lg bg-[var(--primary-accent)] text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:bg-[var(--border-color)] transition-colors mb-0.5 mr-0.5">
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>

            </main>
        </div>
    );
};

export default ChatRoom;
