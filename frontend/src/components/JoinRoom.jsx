import React, { useState } from 'react';
import { Shield, ArrowRight, Zap, Hash, User, Eye, EyeOff, RefreshCw, Shuffle, Lock } from 'lucide-react';

const SARCASTIC_NAMES = [
    'SelfProclaimed Genius', 'Professionally Mediocre', 'Technically Not Wrong',
    'Obviously Right Again', 'Unsolicited Opinion', 'Reluctant Participant',
    'Definitely Future Legend', 'Questionably Present', 'Master of Obvious',
    'Barely Trying', 'Gloriously Average', 'Suspiciously Confident',
    'Politely Disagreeable', 'Honestly Confused', 'Perfectly Fine Thanks',
    'Definitely Not Lost', 'Mildly Concerned', 'Casually Brilliant',
    'Professionally Unavailable', 'Expert in Everything',
    'Gracefully Mistaken', 'Technically Alive', 'Appropriately Caffeinated',
    'Pleasantly Oblivious', 'Enthusiastically Wrong', 'Suspiciously Normal',
    'Effortlessly Clueless', 'Subtly Judging', 'Clearly Overqualified',
    'Deeply Unbothered', 'Famously Humble', 'Silently Judging',
    'Perpetually Early', 'Aggressively Average', 'Precisely Imprecise',
    'Cheerfully Sarcastic', 'Unnecessarily Specific', 'Defiantly Mediocre',
    'Fluent in Sarcasm', 'Always Almost Ready', 'Perpetually Surprised',
    'Boldly Incorrect', 'Professionally Confused', 'Simply Misunderstood',
    'Totally Paying Attention', 'Clearly the Favorite', 'Surprisingly Coherent',
    'Mildly Functional', 'Exceptional Napper', 'Obviously the Smartest',
    'Coincidentally Present', 'Professionally Overthinking',
    'Technically Competent', 'Deeply Unimpressed', 'Blissfully Unaware',
    'Spectacularly Irrelevant', 'Humbly Excellent', 'Certainly Not Nervous',
    'Genuinely Skeptical', 'Absolutely Volunteered', 'Probably Fine',
    'Reluctant Hero', 'Thoughtfully Absent', 'Always Misquoted',
    'Highly Specific Nobody', 'Moderately Enlightened', 'Suspiciously Helpful',
    'Terminally Online', 'Certified People Person', 'Self Taught Expert',
    'Frequently Misunderstood', 'Delightfully Incorrect', 'Boldly Underprepared',
    'Vaguely Interested', 'Perpetually Right', 'Accidentally Insightful',
    'Unapologetically Late', 'Casually Overachieving', 'Professionally Dramatic',
    'Obviously Joking', 'Kindly Disagreeing', 'Completely Distracted',
    'Absolutely Listening', 'Technically Qualified', 'Tragically Overlooked',
    'Quietly Judging Everyone', 'Deeply Fascinated', 'Definitively Wrong',
    'Professionally Napping', 'Genuinely Attempting', 'Remarkably Ordinary',
    'Thoroughly Unconvinced', 'Supremely Unbothered', 'Barely Caffeinated',
    'Aggressively Calm', 'Mildly Legendary', 'Expertly Pretending',
    'Suspiciously Polite', 'Nearly Functional', 'Actually Trying',
    'Diplomatically Blunt', 'Objectively Phenomenal', 'Genuinely Bewildered',
    'Technically Present', 'Obviously Overthinking', 'Casually Unhinged',
    'Professionally Lost', 'Vigorously Neutral', 'Dangerously Optimistic',
    'Quietly Exceptional', 'Confidently Incorrect', 'Softly Judgemental',
    'Firmly Undecided',
];

const getRandomName = () => SARCASTIC_NAMES[Math.floor(Math.random() * SARCASTIC_NAMES.length)];

const JoinRoom = ({ onJoin }) => {
    const [roomId, setRoomId] = useState('');
    const [secretPhrase, setSecretPhrase] = useState('');
    const [username, setUsername] = useState(() => getRandomName());
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const generateRoomCode = () => {
        setRoomId(Math.floor(10000 + Math.random() * 90000).toString());
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!username || username.trim().length < 2) { setError('Alias must be at least 2 characters'); return; }
        if (roomId && roomId.trim().length < 4) { setError('Room coordinate must be at least 4 characters'); return; }
        if (!secretPhrase || secretPhrase.length < 4) { setError('Cipher key must be at least 4 characters'); return; }

        setIsLoading(true);
        try {
            const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
            const response = await fetch(`${backendUrl}/api/rooms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: roomId.trim() || undefined, secretPhrase })
            });
            const data = await response.json();
            if (response.ok) {
                onJoin(data.roomId, secretPhrase, username.trim(), data.createdAt);
            } else {
                setError(data.error || 'Access Denied');
            }
        } catch {
            setError('Server unreachable. Check your connection.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden font-sans px-4 py-8"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 10%, rgba(16,217,160,0.07) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 80% 90%, rgba(59,130,246,0.06) 0%, transparent 60%), #07080f' }}>

            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
                style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

            {/* Glow orbs */}
            <div className="absolute top-[10%] left-[5%] w-72 h-72 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(16,217,160,0.08) 0%, transparent 70%)', filter: 'blur(40px)' }} />
            <div className="absolute bottom-[5%] right-[5%] w-56 h-56 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.07) 0%, transparent 70%)', filter: 'blur(40px)' }} />

            <div className="w-full max-w-[420px] space-y-5 z-10 animate-fade-in">
                {/* Brand */}
                <div className="text-center space-y-4">
                    {/* Icon with ring */}
                    <div className="relative inline-flex items-center justify-center">
                        <div className="absolute inset-0 rounded-[1.4rem] animate-glow" />
                        <div className="relative p-4 rounded-[1.4rem] border"
                            style={{ background: 'linear-gradient(135deg, rgba(16,217,160,0.12) 0%, rgba(59,130,246,0.06) 100%)', borderColor: 'rgba(16,217,160,0.25)' }}>
                            <Shield className="w-10 h-10" style={{ color: '#10d9a0' }} />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-5xl sm:text-6xl font-black tracking-tighter italic leading-none">
                            <span className="text-white">WHISPER</span>
                            <span style={{ background: 'linear-gradient(135deg, #10d9a0, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>LINK</span>
                        </h1>
                        <p className="text-[9px] mt-2 font-black tracking-[0.45em] uppercase" style={{ color: 'rgba(16,217,160,0.5)' }}>
                            Encrypted · Ephemeral · Untraceable
                        </p>
                    </div>
                </div>

                {/* Card */}
                <div className="relative rounded-[1.6rem] p-[1px]"
                    style={{ background: 'linear-gradient(135deg, rgba(16,217,160,0.25) 0%, rgba(59,130,246,0.12) 50%, rgba(255,255,255,0.04) 100%)' }}>
                    <div className="rounded-[1.55rem] p-6 sm:p-8 space-y-4"
                        style={{ background: 'linear-gradient(160deg, #0e101a 0%, #0a0c14 100%)' }}>

                        {/* Username */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(16,217,160,0.6)' }}>
                                <span>Alias</span><span style={{ color: 'rgba(255,255,255,0.2)' }}>· min 2</span>
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1 group">
                                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors" style={{ color: 'rgba(255,255,255,0.25)' }} />
                                    <input type="text" placeholder="Your sarcastic alias..."
                                        className="w-full pl-10 pr-3 py-3 rounded-xl text-sm font-medium italic transition-all duration-200"
                                        style={{
                                            background: 'rgba(255,255,255,0.03)',
                                            border: '1px solid rgba(255,255,255,0.07)',
                                            color: '#f0f0f8',
                                        }}
                                        onFocus={e => { e.target.style.border = '1px solid rgba(16,217,160,0.35)'; e.target.style.background = 'rgba(16,217,160,0.05)'; }}
                                        onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; e.target.style.background = 'rgba(255,255,255,0.03)'; }}
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        maxLength={30} required
                                    />
                                </div>
                                <button type="button" onClick={() => setUsername(getRandomName())}
                                    title="Shuffle alias"
                                    className="shrink-0 px-3 rounded-xl transition-all active:scale-95"
                                    style={{ background: 'rgba(16,217,160,0.08)', border: '1px solid rgba(16,217,160,0.2)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,217,160,0.15)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,217,160,0.08)'}>
                                    <Shuffle className="w-4 h-4" style={{ color: '#10d9a0' }} />
                                </button>
                            </div>
                        </div>

                        {/* Room ID */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(16,217,160,0.6)' }}>
                                <span>Room Coordinate</span><span style={{ color: 'rgba(255,255,255,0.2)' }}>· optional, min 4</span>
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
                                    <input type="text" placeholder="Enter or generate a code..."
                                        className="w-full pl-10 pr-3 py-3 rounded-xl text-sm font-medium italic transition-all duration-200"
                                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#f0f0f8' }}
                                        onFocus={e => { e.target.style.border = '1px solid rgba(16,217,160,0.35)'; e.target.style.background = 'rgba(16,217,160,0.05)'; }}
                                        onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; e.target.style.background = 'rgba(255,255,255,0.03)'; }}
                                        value={roomId}
                                        onChange={e => setRoomId(e.target.value)}
                                        maxLength={12}
                                    />
                                </div>
                                <button type="button" onClick={generateRoomCode}
                                    title="Generate 5-digit code"
                                    className="shrink-0 px-3 rounded-xl transition-all active:scale-95"
                                    style={{ background: 'rgba(16,217,160,0.08)', border: '1px solid rgba(16,217,160,0.2)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,217,160,0.15)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,217,160,0.08)'}>
                                    <RefreshCw className="w-4 h-4" style={{ color: '#10d9a0' }} />
                                </button>
                            </div>
                            {roomId && (
                                <p className="text-[9px] ml-1 italic flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                    Code: <span className="font-black tracking-widest" style={{ color: '#10d9a0' }}>{roomId}</span>
                                    {roomId.length < 4 && <span style={{ color: '#f43f5e' }}>— {4 - roomId.length} more needed</span>}
                                </p>
                            )}
                        </div>

                        {/* Cipher Key */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.35em]" style={{ color: 'rgba(16,217,160,0.6)' }}>
                                <span>Cipher Key</span><span style={{ color: 'rgba(255,255,255,0.2)' }}>· min 4</span>
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)' }} />
                                <input type={showPassword ? 'text' : 'password'}
                                    placeholder="Secret entry phrase..."
                                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm font-medium italic transition-all duration-200"
                                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', color: '#f0f0f8' }}
                                    onFocus={e => { e.target.style.border = '1px solid rgba(16,217,160,0.35)'; e.target.style.background = 'rgba(16,217,160,0.05)'; }}
                                    onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.07)'; e.target.style.background = 'rgba(255,255,255,0.03)'; }}
                                    value={secretPhrase}
                                    onChange={e => setSecretPhrase(e.target.value)}
                                    required
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: 'rgba(255,255,255,0.3)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#10d9a0'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {secretPhrase.length > 0 && secretPhrase.length < 4 && (
                                <p className="text-[9px] italic ml-1" style={{ color: '#f43f5e' }}>{4 - secretPhrase.length} more character{4 - secretPhrase.length > 1 ? 's' : ''} needed</p>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="py-2.5 rounded-xl text-center"
                                style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: '#f43f5e' }}>{error}</span>
                            </div>
                        )}

                        {/* Submit */}
                        <button type="button" onClick={handleSubmit}
                            disabled={isLoading}
                            className="w-full flex items-center justify-center gap-3 py-4 rounded-xl font-black transition-all duration-200 active:scale-[0.98] relative overflow-hidden group"
                            style={isLoading
                                ? { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.05)', cursor: 'not-allowed' }
                                : { background: 'linear-gradient(135deg, #10d9a0 0%, #0ea5e9 100%)', color: '#07080f', boxShadow: '0 8px 32px rgba(16,217,160,0.25), 0 2px 8px rgba(0,0,0,0.5)' }
                            }
                            onMouseEnter={e => { if (!isLoading) e.currentTarget.style.boxShadow = '0 12px 40px rgba(16,217,160,0.35), 0 2px 8px rgba(0,0,0,0.5)'; }}
                            onMouseLeave={e => { if (!isLoading) e.currentTarget.style.boxShadow = '0 8px 32px rgba(16,217,160,0.25), 0 2px 8px rgba(0,0,0,0.5)'; }}>
                            <span className="uppercase tracking-[0.15em] text-sm">{isLoading ? 'Establishing...' : 'Establish Connection'}</span>
                            {!isLoading && <ArrowRight className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Feature pills */}
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { icon: <Zap className="w-4 h-4" />, label: 'Auto-Shred', value: '45 Min' },
                        { icon: <Shield className="w-4 h-4" />, label: 'Zero Logs', value: 'Encrypted' },
                    ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl transition-all"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(16,217,160,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'}>
                            <div className="p-2 rounded-lg" style={{ background: 'rgba(16,217,160,0.08)', color: '#10d9a0' }}>{icon}</div>
                            <div>
                                <p className="text-[8px] uppercase font-black tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                                <p className="text-xs font-bold" style={{ color: '#f0f0f8' }}>{value}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default JoinRoom;
