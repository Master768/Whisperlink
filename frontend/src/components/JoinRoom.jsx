import React, { useState } from 'react';
import { Shield, ArrowRight, Zap, Hash, User, Eye, EyeOff } from 'lucide-react';

const JoinRoom = ({ onJoin }) => {
    const [roomId, setRoomId] = useState('');
    const [secretPhrase, setSecretPhrase] = useState('');
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

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
        <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#050505] relative overflow-hidden font-sans px-4 py-8">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-primary/10 blur-[120px] rounded-full animate-pulse pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-md space-y-6 z-10 animate-fade-in">
                {/* Header */}
                <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center p-4 rounded-[1.5rem] bg-white/[0.03] border border-white/[0.05] shadow-2xl relative group">
                        <div className="absolute inset-0 bg-primary/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity rounded-[1.5rem]"></div>
                        <Shield className="w-10 h-10 text-primary relative z-10" />
                    </div>
                    <div>
                        <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mb-2 italic">
                            WHISPER<span className="text-primary not-italic tracking-[-0.1em]">LINK</span>
                        </h1>
                        <p className="text-white/50 text-[9px] uppercase font-black tracking-[0.4em]">
                            Secure ephemeral communication layer
                        </p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4 glass-dark p-6 sm:p-8 rounded-[2rem] border border-white/[0.05] shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                    {/* Username */}
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-white/50 uppercase tracking-[0.3em] ml-1">Identify As</label>
                        <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Assign alias..."
                                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm font-medium text-white placeholder:text-white/30 italic"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                maxLength={20}
                                required
                            />
                        </div>
                    </div>

                    {/* Room ID */}
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-white/50 uppercase tracking-[0.3em] ml-1">Room Coordinate (Optional)</label>
                        <div className="relative group">
                            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <input
                                type="text"
                                placeholder="Auto-generate if empty"
                                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm font-medium text-white placeholder:text-white/30 italic"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                maxLength={12}
                            />
                        </div>
                    </div>

                    {/* Cipher Key */}
                    <div className="space-y-1.5">
                        <label className="block text-[9px] font-black text-white/50 uppercase tracking-[0.3em] ml-1">Cipher Key</label>
                        <div className="relative group">
                            <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                placeholder="Entry phrase..."
                                className="w-full bg-white/[0.02] border border-white/[0.06] rounded-xl pl-11 pr-12 py-3.5 focus:outline-none focus:border-primary/40 focus:bg-white/[0.04] transition-all text-sm font-medium text-white placeholder:text-white/30 italic"
                                value={secretPhrase}
                                onChange={(e) => setSecretPhrase(e.target.value)}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-primary transition-colors p-0.5"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="flex items-center justify-center space-x-2 text-red-400 bg-red-500/5 py-2.5 rounded-xl border border-red-500/10">
                            <span className="text-[10px] font-black uppercase tracking-widest text-center px-2">{error}</span>
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full group/btn relative flex items-center justify-center gap-3 py-4 rounded-xl font-black text-black transition-all transform active:scale-[0.98] ${isLoading
                            ? 'bg-white/10 cursor-not-allowed text-white/40'
                            : 'bg-gradient-to-br from-primary to-secondary shadow-[0_8px_25px_rgba(0,242,254,0.2)] hover:shadow-[0_12px_35px_rgba(0,242,254,0.3)] hover:-translate-y-0.5'
                            }`}
                    >
                        <span className="uppercase tracking-[0.15em] italic text-sm">{isLoading ? 'Breaching...' : 'Establish Connection'}</span>
                        {!isLoading && <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />}
                    </button>
                </form>

                {/* Feature Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl hover:border-primary/20 transition-all group flex flex-col items-center text-center">
                        <Zap className="w-5 h-5 text-primary/60 mb-2 group-hover:text-primary transition-colors" />
                        <h3 className="text-[9px] uppercase font-black text-white/60 tracking-[0.2em] mb-0.5">Auto-Shred</h3>
                        <p className="text-xs font-bold text-white/90">45 Min Lifespan</p>
                    </div>
                    <div className="bg-white/[0.02] border border-white/[0.05] p-4 rounded-2xl hover:border-primary/20 transition-all group flex flex-col items-center text-center">
                        <Shield className="w-5 h-5 text-primary/60 mb-2 group-hover:text-primary transition-colors" />
                        <h3 className="text-[9px] uppercase font-black text-white/60 tracking-[0.2em] mb-0.5">Encrypted</h3>
                        <p className="text-xs font-bold text-white/90">Zero Persistence</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JoinRoom;
