import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Send, FileUp, Download, Shield, Hash, Users, X, Paperclip, User, WifiOff } from 'lucide-react';

const ChatRoom = ({ roomId, secretPhrase, username, createdAt, onLeave }) => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [userCount, setUserCount] = useState(0);
    const [members, setMembers] = useState([]);
    const [isConnected, setIsConnected] = useState(false);
    const [showMembers, setShowMembers] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    const [isShredded, setIsShredded] = useState(false);
    const scrollRef = useRef();
    const socketRef = useRef();
    const fileInputRef = useRef();

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
                clearInterval(timerInterval);
                return;
            }

            const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            setTimeLeft(
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
            );
        };

        updateTimer();
        const timerInterval = setInterval(updateTimer, 1000);

        return () => clearInterval(timerInterval);
    }, [createdAt]);

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

        socket.on('disconnect', () => {
            setIsConnected(false);
        });

        socket.on('receive_message', (message) => {
            setMessages((prev) => [...prev, message]);
        });

        socket.on('room_data', (data) => {
            setUserCount(data.userCount);
            setMembers(data.users || []);
        });

        return () => {
            if (socket) socket.disconnect();
        };
    }, [roomId, username]);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = (e) => {
        e?.preventDefault();
        if (!input.trim() || !isConnected || isShredded) return;

        socketRef.current.emit('send_message', {
            roomId,
            message: input,
            type: 'text'
        });
        setInput('');
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file || !isConnected || isShredded) return;
        if (file.size > 25 * 1024 * 1024) {
            alert('File too large (Max 25MB)');
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/upload`, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (response.ok) {
                socketRef.current.emit('send_message', {
                    roomId,
                    type: 'file',
                    fileName: data.fileName,
                    fileUrl: data.fileUrl
                });
            }
        } catch (err) {
            console.error('Upload failed', err);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // Shredded state
    if (isShredded) {
        return (
            <div className="flex h-[100dvh] bg-black text-white items-center justify-center p-6 text-center">
                <div className="space-y-6 animate-fade-in">
                    <div className="w-16 h-16 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto">
                        <Shield className="w-8 h-8 text-red-500" />
                    </div>
                    <h1 className="text-3xl font-black italic tracking-tighter uppercase">Room Shredded</h1>
                    <p className="text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">
                        The 45-minute silence has ended. All messages have been permanently destroyed.
                    </p>
                    <button
                        onClick={onLeave}
                        className="px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-105 transition-transform"
                    >
                        Return to Void
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-[100dvh] bg-[#050505] text-white overflow-hidden font-sans relative">
            {/* Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

            {/* Members Sidebar Overlay (mobile) */}
            {showMembers && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 lg:hidden"
                    onClick={() => setShowMembers(false)}
                />
            )}

            {/* Members Sidebar */}
            <div className={`fixed inset-y-0 right-0 w-72 glass-dark border-l border-white/5 z-50 flex flex-col transform transition-transform duration-300 ease-out shadow-2xl
                ${showMembers ? 'translate-x-0' : 'translate-x-full'}
                lg:relative lg:translate-x-0 lg:w-64 xl:w-72`}>
                {/* Sidebar Header */}
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-black/40 shrink-0">
                    <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-primary" />
                        <h3 className="font-black text-[10px] uppercase tracking-[0.3em] text-white/90 italic">Active Ghosts</h3>
                    </div>
                    <button onClick={() => setShowMembers(false)} className="lg:hidden p-1.5 hover:bg-white/5 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-white/40" />
                    </button>
                </div>

                {/* Members List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center space-x-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03] hover:border-primary/20 transition-all group">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center border border-primary/20 shrink-0">
                                <User className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold truncate text-white">
                                    {member.name} {member.name === username && <span className="text-[9px] text-primary italic ml-1 opacity-80">You</span>}
                                </p>
                                <div className="flex items-center space-x-1.5 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)] animate-pulse shrink-0"></span>
                                    <span className="text-[9px] uppercase font-black text-white/50 tracking-tight">Online</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Timer */}
                <div className="px-5 py-4 border-t border-white/5 bg-black/60 shrink-0">
                    <div className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] text-center mb-1 italic">Shred Countdown</div>
                    <div className="text-3xl font-black text-primary text-center tracking-tighter tabular-nums drop-shadow-[0_0_12px_rgba(0,242,254,0.3)]">
                        {timeLeft}
                    </div>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                {/* Header */}
                <div className="glass px-4 sm:px-6 py-3 flex items-center justify-between border-b border-white/5 z-10 bg-black/20 backdrop-blur-2xl shrink-0">
                    <div className="flex items-center space-x-3 min-w-0">
                        <div className="p-2 rounded-xl bg-primary/5 border border-primary/10 shrink-0">
                            <Hash className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-black tracking-tight text-white/95 truncate">{roomId}</h2>
                            <div className="flex items-center space-x-1.5 text-[9px] uppercase tracking-[0.15em] font-black italic">
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isConnected ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-red-500'}`}></span>
                                <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
                                    {isConnected ? `${userCount} Ghost${userCount !== 1 ? 's' : ''}` : 'Signal Lost'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                        {/* Username badge (tablet+) */}
                        <div className="hidden sm:flex items-center space-x-2 bg-white/[0.03] border border-white/5 px-3 py-1.5 rounded-xl">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/70 italic max-w-[80px] truncate">{username}</span>
                        </div>

                        {/* Members toggle (mobile) */}
                        <button
                            onClick={() => setShowMembers(!showMembers)}
                            className="lg:hidden relative p-2 hover:bg-white/5 rounded-xl transition-all border border-white/5 bg-white/[0.02] active:scale-95"
                        >
                            <Users className="w-4 h-4 text-white/70" />
                            {userCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-black text-[9px] font-black rounded-md flex items-center justify-center border border-black italic">
                                    {userCount}
                                </span>
                            )}
                        </button>

                        {/* Leave button */}
                        <button
                            onClick={onLeave}
                            className="p-2 bg-red-500/10 hover:bg-red-500/20 rounded-xl transition-all border border-red-500/10 group active:scale-90"
                            title="Leave Room"
                        >
                            <X className="w-4 h-4 text-red-400 group-hover:text-red-300 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                    {/* Welcome */}
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <Shield className="w-12 h-12 text-white/5 mb-4" />
                        <p className="text-[9px] max-w-[240px] tracking-[0.3em] font-black text-white/40 uppercase italic leading-loose">
                            Ephemeral domain established.<br />Zero logs preserved.<br />Shredding active.
                        </p>
                    </div>

                    {messages.map((msg, i) => {
                        const isMe = msg.username === username;
                        const isSystem = msg.type === 'system';

                        if (isSystem) {
                            return (
                                <div key={i} className="flex justify-center animate-fade-in py-1">
                                    <div className="flex items-center space-x-2 px-3 py-1 rounded-full border border-white/10 bg-white/[0.04]">
                                        <div className="w-1 h-1 rounded-full bg-primary/60 shrink-0"></div>
                                        <span className="text-[9px] text-white/60 font-black uppercase tracking-[0.15em] italic">{msg.message}</span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
                                <div className={`max-w-[85%] sm:max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                    {!isMe && (
                                        <div className="flex items-center space-x-1.5 mb-1 ml-2">
                                            <span className="text-[9px] text-primary font-black uppercase tracking-[0.15em] italic opacity-90">{msg.username}</span>
                                        </div>
                                    )}
                                    <div className={`px-4 py-3 rounded-2xl ${isMe
                                        ? 'bg-gradient-to-br from-primary to-secondary text-black font-bold rounded-tr-none shadow-[0_6px_20px_rgba(0,242,254,0.15)]'
                                        : 'bg-[#121212] rounded-tl-none border border-white/5 group-hover:border-white/10'
                                        }`}>
                                        {msg.type === 'file' ? (
                                            <a
                                                href={msg.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center space-x-3 group/file min-w-[160px]"
                                            >
                                                <div className={`p-2.5 rounded-xl ${isMe ? 'bg-black/10' : 'bg-primary/5 border border-primary/10'}`}>
                                                    <Paperclip className={`w-5 h-5 ${isMe ? 'text-black' : 'text-primary'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-black truncate ${isMe ? 'text-black' : 'text-white'}`}>{msg.fileName}</p>
                                                    <p className={`text-[9px] uppercase font-black tracking-widest mt-0.5 italic ${isMe ? 'text-black/70' : 'text-primary'}`}>
                                                        Shred-Download
                                                    </p>
                                                </div>
                                                <Download className={`w-4 h-4 transition-transform group-hover/file:translate-y-0.5 ${isMe ? 'text-black' : 'text-white/60'}`} />
                                            </a>
                                        ) : (
                                            <p className="text-sm break-words leading-relaxed">{msg.message}</p>
                                        )}
                                    </div>
                                    <span className={`text-[9px] mt-1 font-black uppercase tracking-[0.15em] text-white/30 italic opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'mr-1' : 'ml-1'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <div className="shrink-0 px-3 sm:px-5 py-3 sm:py-4 bg-[#050505] border-t border-white/5">
                    {/* Disconnected banner */}
                    {!isConnected && (
                        <div className="flex justify-center mb-2">
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full flex items-center space-x-2">
                                <WifiOff className="w-3 h-3 animate-pulse" />
                                <span>Re-establishing connection...</span>
                            </div>
                        </div>
                    )}

                    <form onSubmit={sendMessage} className="flex items-center gap-2">
                        {/* File upload */}
                        <label className={`cursor-pointer shrink-0 p-2.5 rounded-xl border transition-all active:scale-90 ${isUploading || !isConnected || isShredded
                            ? 'bg-white/[0.01] border-white/5 opacity-50 cursor-not-allowed'
                            : 'bg-white/[0.03] border-white/10 hover:border-primary/40 hover:bg-white/[0.05]'}`}>
                            <FileUp className={`w-5 h-5 transition-colors ${isUploading ? 'animate-bounce text-primary' : 'text-white/50'}`} />
                            <input
                                ref={fileInputRef}
                                type="file"
                                className="hidden"
                                onChange={handleFileUpload}
                                disabled={isUploading || !isConnected || isShredded}
                            />
                        </label>

                        {/* Text input */}
                        <input
                            type="text"
                            placeholder={isShredded ? 'Room Terminated' : isConnected ? 'Leave no trace...' : 'Signal Lost'}
                            className="flex-1 min-w-0 bg-white/[0.04] border border-white/15 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all text-sm font-medium text-white placeholder:text-white/30 italic"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={!isConnected || isShredded}
                        />

                        {/* Send button — always visible, dims when inactive */}
                        <button
                            type="submit"
                            disabled={!isConnected || isShredded || !input.trim()}
                            className={`shrink-0 p-3 rounded-xl transition-all active:scale-95 ${isConnected && input.trim() && !isShredded
                                ? 'bg-gradient-to-br from-primary to-secondary text-black shadow-[0_4px_15px_rgba(0,242,254,0.25)] hover:scale-105'
                                : 'bg-white/[0.05] text-white/20 border border-white/5'
                                }`}
                        >
                            <Send className="w-5 h-5" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatRoom;
