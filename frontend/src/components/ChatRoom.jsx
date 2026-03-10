import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
import { Send, FileUp, Download, Shield, Hash, Users, X, Paperclip, User, Wifi, WifiOff } from 'lucide-react';

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
        // Initialize socket
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
            if (socket) {
                socket.disconnect();
            }
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
        }
    };

    if (isShredded) {
        return (
            <div className="flex h-[100dvh] bg-black text-white items-center justify-center p-6 text-center">
                <div className="space-y-6 animate-fade-in">
                    <div className="w-20 h-20 bg-red-500/20 border border-red-500/40 rounded-full flex items-center justify-center mx-auto">
                        <Shield className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-4xl font-black italic tracking-tighter uppercase">Room Shredded</h1>
                    <p className="text-gray-500 max-w-xs mx-auto text-sm leading-relaxed">
                        The 45-minute silence has ended. All messages and data associated with this room have been permanently destroyed.
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
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

            {/* Members Sidebar */}
            <div className={`fixed inset-y-0 right-0 w-80 glass-dark border-l border-white/5 z-50 transform transition-transform duration-500 ease-out shadow-2xl ${showMembers ? 'translate-x-0' : 'translate-x-full'} lg:relative lg:translate-x-0 lg:flex lg:flex-col`}>
                <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/40">
                    <div className="flex items-center space-x-3">
                        <Users className="w-5 h-5 text-primary" />
                        <h3 className="font-black text-xs uppercase tracking-[0.3em] text-white/90 italic">Active Ghosts</h3>
                    </div>
                    <button onClick={() => setShowMembers(false)} className="lg:hidden p-2 hover:bg-white/5 rounded-xl">
                        <X className="w-5 h-5 text-white/40" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {members.map((member) => (
                        <div key={member.id} className="flex items-center space-x-4 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.03] hover:border-primary/20 transition-all group">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 to-transparent flex items-center justify-center border border-primary/20 group-hover:from-primary/20">
                                <User className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate text-white">
                                    {member.name} {member.name === username && <span className="text-[10px] text-primary italic ml-1.5 opacity-80">You</span>}
                                </p>
                                <div className="flex items-center space-x-2 mt-0.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse"></span>
                                    <span className="text-[10px] uppercase font-black text-white/60 tracking-tighter">Connected</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="p-8 border-t border-white/5 bg-black/60 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse"></div>
                    <div className="text-[10px] font-black text-white/50 uppercase tracking-[0.4em] text-center mb-3 italic">Shredding Imminent</div>
                    <div className="text-4xl font-black text-primary text-center tracking-tighter tabular-nums drop-shadow-[0_0_15px_rgba(0,242,254,0.3)]">
                        {timeLeft}
                    </div>
                </div>
            </div>

            {/* Mobile Sidebar Overlay */}
            {showMembers && (
                <div
                    className="fixed inset-0 bg-black/80 backdrop-blur-md z-40 lg:hidden transition-opacity"
                    onClick={() => setShowMembers(false)}
                />
            )}

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full min-w-0 relative">
                {/* Header */}
                <div className="glass px-8 py-5 flex items-center justify-between border-b border-white/5 z-10 bg-black/20 backdrop-blur-2xl">
                    <div className="flex items-center space-x-4">
                        <div className="p-3 rounded-2xl bg-primary/5 border border-primary/10 group hover:border-primary/30 transition-all cursor-default shadow-inner">
                            <Hash className="w-5 h-5 text-primary group-hover:rotate-12 transition-transform" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight text-white/95">{roomId}</h2>
                            <div className="flex items-center space-x-2 text-[10px] uppercase tracking-[0.2em] font-black italic">
                                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]'}`}></span>
                                <span className={isConnected ? 'text-green-500' : 'text-red-500 opacity-80'}>
                                    {isConnected ? `${userCount} Active Ghost${userCount !== 1 ? 's' : ''}` : 'Lost Signal...'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            onClick={() => setShowMembers(!showMembers)}
                            className="lg:hidden p-3 hover:bg-white/5 rounded-2xl transition-all border border-white/5 bg-white/[0.02] relative active:scale-95"
                        >
                            <Users className="w-5 h-5 text-white/80" />
                            {userCount > 0 && (
                                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-black text-[10px] font-black rounded-lg flex items-center justify-center border-2 border-black italic">
                                    {userCount}
                                </span>
                            )}
                        </button>

                        <div className="hidden sm:flex items-center space-x-3 bg-white/[0.03] border border-white/5 px-5 py-2 rounded-2xl hover:border-white/10 transition-all">
                            <div className="w-2 h-2 rounded-full bg-primary/40 animate-pulse"></div>
                            <span className="text-xs font-black uppercase tracking-widest text-white/80 italic">{username}</span>
                        </div>

                        <button
                            onClick={onLeave}
                            className="p-3.5 bg-red-500/10 hover:bg-red-500/20 rounded-2xl transition-all border border-red-500/10 group active:scale-90"
                            title="Abort Mission"
                        >
                            <X className="w-5 h-5 text-red-500/80 group-hover:text-red-500 transition-colors" />
                        </button>
                    </div>
                </div>

                {/* Messages Container */}
                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    <div className="flex flex-col items-center justify-center py-16 text-center group">
                        <div className="relative mb-6">
                            <Shield className="w-20 h-20 text-white/5 group-hover:text-primary/10 transition-all duration-700" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-4 h-4 bg-primary/20 blur-xl animate-pulse"></div>
                            </div>
                        </div>
                        <p className="text-[10px] max-w-[280px] tracking-[0.4em] font-black text-white/50 uppercase italic leading-loose">
                            Ephemeral Domain Established.<br />Zero logs preserved.<br />Shredding active.
                        </p>
                    </div>

                    {messages.map((msg, i) => {
                        const isMe = msg.username === username;
                        const isSystem = msg.type === 'system';

                        if (isSystem) {
                            return (
                                <div key={i} className="flex justify-center animate-fade-in py-2">
                                    <div className="flex items-center space-x-3 px-4 py-1.5 rounded-full border border-white/10 bg-white/[0.05] backdrop-blur-md">
                                        <div className="w-1 h-1 rounded-full bg-primary/60"></div>
                                        <span className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em] italic">
                                            {msg.message}
                                        </span>
                                    </div>
                                </div>
                            );
                        }

                        return (
                            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in group px-2`}>
                                <div className={`max-w-[90%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                                    {!isMe && (
                                        <div className="flex items-center space-x-2 mb-2 ml-3">
                                            <span className="text-[10px] text-primary font-black uppercase tracking-[0.2em] italic opacity-90">
                                                {msg.username}
                                            </span>
                                            <div className="w-10 h-[1px] bg-gradient-to-r from-primary/50 to-transparent"></div>
                                        </div>
                                    )}
                                    <div className={`px-6 py-4 rounded-3xl transition-all duration-300 ${isMe
                                        ? 'bg-gradient-to-br from-primary to-secondary text-black font-bold rounded-tr-none shadow-[0_10px_30px_rgba(0,242,254,0.15)] hover:shadow-[0_15px_40px_rgba(0,242,254,0.25)]'
                                        : 'bg-[#121212] rounded-tl-none border border-white/5 group-hover:border-white/10 shadow-xl'
                                        }`}>
                                        {msg.type === 'file' ? (
                                            <a
                                                href={msg.fileUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center space-x-5 group/file min-w-[220px]"
                                            >
                                                <div className={`p-3.5 rounded-2xl ${isMe ? 'bg-black/10' : 'bg-primary/5 border border-primary/10'}`}>
                                                    <Paperclip className={`w-6 h-6 ${isMe ? 'text-black' : 'text-primary'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className={`text-sm font-black truncate tracking-tight ${isMe ? 'text-black' : 'text-white'}`}>
                                                        {msg.fileName}
                                                    </p>
                                                    <p className={`text-[10px] uppercase font-black tracking-widest opacity-90 mt-0.5 italic ${isMe ? 'text-black' : 'text-primary'}`}>
                                                        Shred-Download
                                                    </p>
                                                </div>
                                                <Download className={`w-5 h-5 transition-transform group-hover/file:translate-y-1 ${isMe ? 'text-black' : 'text-white/70'}`} />
                                            </a>
                                        ) : (
                                            <p className="text-[14px] break-words leading-relaxed tracking-wide opacity-95">{msg.message}</p>
                                        )}
                                    </div>
                                    <span className={`text-[9px] mt-2 font-black uppercase tracking-[0.2em] text-white/40 italic transition-opacity group-hover:opacity-100 ${isMe ? 'mr-2' : 'ml-2'} opacity-0`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    <div ref={scrollRef} />
                </div>

                {/* Input Area */}
                <div className="p-6 sm:p-10 bg-gradient-to-t from-black via-black/90 to-transparent pt-20 border-t border-white/5 mt-auto">
                    <form onSubmit={sendMessage} className="flex items-center space-x-4 max-w-6xl mx-auto relative group">
                        {!isConnected && (
                            <div className="absolute top-0 left-0 right-0 -translate-y-[150%] flex justify-center px-4">
                                <div className="bg-red-500/10 border border-red-500/20 backdrop-blur-xl text-red-500 text-[10px] font-black uppercase tracking-[0.3em] px-6 py-2 rounded-full flex items-center space-x-3 shadow-2xl">
                                    <WifiOff className="w-3 h-3 animate-pulse" />
                                    <span>Re-establishing Connection...</span>
                                </div>
                            </div>
                        )}

                        <label className="cursor-pointer p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-primary/40 hover:bg-white/[0.05] transition-all relative group active:scale-90 shadow-xl">
                            <FileUp className={`w-6 h-6 transition-colors ${isUploading ? 'animate-bounce text-primary' : 'text-white/60 group-hover:text-primary'}`} />
                            <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading || !isConnected || isShredded} />
                            {isUploading && (
                                <div className="absolute inset-0 rounded-2xl border-2 border-primary border-t-transparent animate-spin"></div>
                            )}
                        </label>

                        <div className="flex-1 relative">
                            <input
                                type="text"
                                placeholder={isShredded ? "Room Terminated" : isConnected ? "Leave no trace..." : "Signal Lost"}
                                className="w-full bg-white/[0.04] border border-white/20 rounded-2xl px-8 py-5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.06] transition-all text-sm font-medium text-white placeholder:text-white/40 shadow-2xl tracking-wide italic"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                disabled={!isConnected || isShredded}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={!isConnected || isShredded || !input.trim()}
                            className={`p-5 rounded-2xl transition-all shadow-2xl group active:scale-95 ${isConnected && input.trim() && !isShredded
                                ? 'bg-gradient-to-br from-primary to-secondary text-black shadow-primary/20 hover:scale-105'
                                : 'bg-white/[0.02] text-white/5 border border-white/5'
                                }`}
                        >
                            <Send className={`w-6 h-6 transition-transform ${isConnected && input.trim() ? 'group-hover:translate-x-1 group-hover:-translate-y-1' : ''}`} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ChatRoom;
