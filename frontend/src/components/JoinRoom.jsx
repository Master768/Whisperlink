import React, { useState } from 'react';
import { Shield, ArrowRight, Zap, Hash, User } from 'lucide-react';

const JoinRoom = ({ onJoin }) => {
    const [roomId, setRoomId] = useState('');
    const [secretPhrase, setSecretPhrase] = useState('');
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!secretPhrase || !username) return;

        setIsLoading(true);
        setError('');

        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId, secretPhrase })
            });

            const data = await response.json();

            if (response.ok) {
                onJoin(data.roomId, secretPhrase, username, data.createdAt);
            } else {
                setError(data.error || 'Access Denied');
            }
        } catch (err) {
            setError('The silence is unreachable. (Server Down)');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 bg-[#050505] relative overflow-hidden font-sans">
            {/* Ambient Background Elements */}
            <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-pulse"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[120px] rounded-full"></div>

            <div className="w-full max-w-lg space-y-12 z-10 animate-fade-in">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center justify-center p-5 mb-2 rounded-[2rem] bg-white/[0.03] border border-white/[0.05] shadow-2xl relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <Shield className="w-12 h-12 text-primary relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-6xl font-black tracking-tighter mb-3 italic">
                            WHISPER<span className="text-primary not-italic tracking-[-0.1em]">LINK</span>
                        </h1>
                        <p className="text-white/60 text-[10px] uppercase font-black tracking-[0.5em] pl-2">
                            Secure ephemeral communication layer
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6 glass-dark p-10 rounded-[2.5rem] border border-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.3em] ml-2">Identify As</label>
                        <div className="relative group">
                            <User className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Assign alias..."
                                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl pl-14 pr-6 py-4.5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm font-medium text-white placeholder:text-white/40 italic"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                maxLength={20}
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.3em] ml-2">Room Coordinate (Optional)</label>
                        <div className="relative group">
                            <Hash className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Auto-generate if empty"
                                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl pl-14 pr-6 py-4.5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm font-medium text-white placeholder:text-white/40 italic"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                maxLength={12}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-[10px] font-black text-white/50 uppercase tracking-[0.3em] ml-2">Cipher Key</label>
                        <div className="relative group">
                            <Shield className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <input
                                type="password"
                                placeholder="Entry phrase..."
                                className="w-full bg-white/[0.02] border border-white/[0.05] rounded-2xl pl-14 pr-6 py-4.5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm font-medium text-white placeholder:text-white/40 italic"
                                value={secretPhrase}
                                onChange={(e) => setSecretPhrase(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="flex items-center justify-center space-x-2 text-red-500/80 animate-pulse bg-red-500/5 py-3 rounded-xl border border-red-500/10">
                            <span className="text-[10px] font-black uppercase tracking-widest">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full group/btn relative flex items-center justify-center space-x-3 py-5 rounded-2xl font-black text-black transition-all transform active:scale-[0.98] ${isLoading
                            ? 'bg-white/10 cursor-not-allowed'
                            : 'bg-gradient-to-br from-primary to-secondary shadow-[0_10px_30px_rgba(0,242,254,0.2)] hover:shadow-[0_15px_40px_rgba(0,242,254,0.3)] hover:-translate-y-1'
                            }`}
                    >
                        <span className="uppercase tracking-[0.2em] italic text-sm">{isLoading ? 'Breaching...' : 'Establish Connection'}</span>
                        {!isLoading && <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />}
                    </button>
                </form>

                <div className="grid grid-cols-2 gap-6">
                    <div className="bg-white/[0.02] border border-white/[0.05] p-6 rounded-3xl hover:border-primary/20 transition-all group flex flex-col items-center text-center">
                        <Zap className="w-6 h-6 text-primary/60 mb-3 group-hover:text-primary transition-colors" />
                        <h3 className="text-[10px] uppercase font-black text-white/60 tracking-[0.2em] mb-1">Auto-Shred</h3>
                        <p className="text-xs font-bold text-white/90">45 Min Lifespan</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] p-6 rounded-3xl hover:border-primary/20 transition-all group flex flex-col items-center text-center">
                        <Shield className="w-6 h-6 text-primary/60 mb-3 group-hover:text-primary transition-colors" />
                        <h3 className="text-[10px] uppercase font-black text-white/60 tracking-[0.2em] mb-1">Encrypted</h3>
                        <p className="text-xs font-bold text-white/90">Zero Persistence</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoinRoom;
