import React, { useState } from 'react';
import { Shield, ArrowRight, Zap, Hash, Eye, EyeOff, RefreshCw, Shuffle, Lock } from 'lucide-react';

const SARCASTIC_NAMES = [
    'SelfProclaimed Genius', 'Professionally Mediocre', 'Technically Not Wrong',
    'Obviously Right Again', 'Unsolicited Opinion', 'Reluctant Participant',
    'Definitely Future Legend', 'Questionably Present', 'Master of Obvious',
    'Barely Trying', 'Gloriously Average', 'Suspiciously Confident',
    'Politely Disagreeable', 'Honestly Confused', 'Perfectly Fine Thanks',
    'Definitely Not Lost', 'Mildly Concerned', 'Casually Brilliant',
    'Professionally Unavailable', 'Expert in Everything'
];

const getRandomName = () => SARCASTIC_NAMES[Math.floor(Math.random() * SARCASTIC_NAMES.length)];

const JoinRoom = ({ onJoin }) => {
    const [roomId, setRoomId] = useState('');
    const [secretPhrase, setSecretPhrase] = useState('');
    const [username, setUsername] = useState(getRandomName);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const generateRoomCode = () => { setRoomId(Math.floor(10000 + Math.random() * 90000).toString()); setError(''); };

    const handleSubmit = async (e) => {
        e?.preventDefault();
        setError('');
        if (!username || username.trim().length < 2) { setError('Alias must be at least 2 characters'); return; }
        if (roomId && roomId.trim().length < 4) { setError('Room ID must be at least 4 characters'); return; }
        if (!secretPhrase || secretPhrase.length < 4) { setError('Cipher key must be at least 4 characters'); return; }
        setIsLoading(true);
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const res = await fetch(`${backendUrl}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: roomId.trim() || undefined, secretPhrase })
            });
            const data = await res.json();
            if (res.ok) { onJoin(data.roomId, secretPhrase, username.trim(), data.createdAt); }
            else { 
                const msg = data.error || 'Access Denied';
                setError(msg.includes('phrase') ? 'Incorrect Cipher Key' : 'Room not found or Shredded'); 
            }
        } catch { setError('Server unreachable. Check your connection.'); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-8" style={{ backgroundColor: '#0e1116' }}>

            {/* Header */}
            <div className="w-full max-w-[400px] mb-8 text-center fade-in">
                <div className="inline-flex items-center justify-center p-3 rounded-2xl mb-4"
                    style={{ backgroundColor: '#161a22', border: '1px solid #2b303b' }}>
                    <Shield className="w-8 h-8" style={{ color: '#2f81f7' }} />
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-white mb-2">WhisperLink</h1>
                <p className="text-sm font-medium" style={{ color: '#848d97' }}>
                    Secure, Ephemeral, Zero-Log Communication
                </p>
            </div>

            {/* Main Card */}
            <div className="w-full max-w-[400px] rounded-2xl p-6 sm:p-8 card-shadow fade-in"
                style={{ backgroundColor: '#161a22', border: '1px solid #2b303b', animationDelay: '0.1s' }}>

                <form onSubmit={handleSubmit} className="space-y-5">

                    {/* Alias */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#848d97' }}>
                            Alias <span className="lowercase font-normal ml-1 opacity-70">(min 2)</span>
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="Display name"
                                maxLength={30}
                                className="flex-1 input-clean px-4 py-3 rounded-xl text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setUsername(getRandomName())}
                                className="btn-secondary px-3.5 rounded-xl flex items-center justify-center"
                                title="Randomize Alias"
                            >
                                <Shuffle className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Room ID */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#848d97' }}>
                            Room ID <span className="lowercase font-normal ml-1 opacity-70">(optional, min 4)</span>
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                                <input
                                    type="text"
                                    value={roomId}
                                    onChange={e => setRoomId(e.target.value)}
                                    placeholder="Enter or generate"
                                    maxLength={12}
                                    className="w-full input-clean pl-10 pr-4 py-3 rounded-xl text-sm"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={generateRoomCode}
                                className="btn-secondary px-3.5 rounded-xl flex items-center justify-center"
                                title="Generate Room Code"
                            >
                                <RefreshCw className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Cipher Key */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#848d97' }}>
                            Cipher Key <span className="lowercase font-normal ml-1 opacity-70">(min 4)</span>
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-50" />
                            <input
                                type={showPassword ? 'text' : 'password'}
                                value={secretPhrase}
                                onChange={e => setSecretPhrase(e.target.value)}
                                placeholder="Secret entry phrase"
                                className="w-full input-clean pl-10 pr-11 py-3 rounded-xl text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3.5 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition-opacity"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-3 rounded-xl text-sm font-medium text-center"
                            style={{ backgroundColor: 'rgba(248, 81, 73, 0.1)', color: '#f85149', border: '1px solid rgba(248, 81, 73, 0.2)' }}>
                            {error}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="btn-primary w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold mt-6"
                    >
                        {isLoading ? 'Connecting...' : 'Establish Connection'}
                        {!isLoading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>
            </div>

            {/* Footer Features */}
            <div className="flex items-center gap-6 mt-8 fade-in" style={{ animationDelay: '0.2s', color: '#848d97' }}>
                <div className="flex items-center gap-2 text-xs font-medium">
                    <Zap className="w-3.5 h-3.5" style={{ color: '#2f81f7' }} />
                    Auto-shreds in 45m
                </div>
                <div className="flex items-center gap-2 text-xs font-medium">
                    <Shield className="w-3.5 h-3.5" style={{ color: '#3fb950' }} />
                    Zero server logs
                </div>
            </div>

        </div>
    );
};

export default JoinRoom;
