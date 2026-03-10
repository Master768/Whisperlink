import React, { useState } from 'react';
import { Shield, ArrowRight, Zap, Hash, Eye, EyeOff, RefreshCw, Shuffle, Lock } from 'lucide-react';

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
            else { setError(data.error || 'Access Denied'); }
        } catch { setError('Server unreachable. Check your connection.'); }
        finally { setIsLoading(false); }
    };

    return (
        <div className="diamond-mesh min-h-[100dvh] flex flex-col items-center justify-center relative overflow-hidden px-4 py-10"
            style={{ background: 'radial-gradient(ellipse 90% 70% at 15% 5%, rgba(232,121,249,0.12) 0%, transparent 55%), radial-gradient(ellipse 70% 60% at 85% 95%, rgba(167,139,250,0.1) 0%, transparent 55%), radial-gradient(ellipse 50% 40% at 50% 50%, rgba(251,191,36,0.04) 0%, transparent 70%), #08040f' }}>

            {/* Glow orbs */}
            <div className="orb-fuchsia" style={{ width: '500px', height: '500px', top: '-15%', left: '-10%', opacity: 0.7 }} />
            <div className="orb-violet" style={{ width: '400px', height: '400px', bottom: '-10%', right: '-8%' }} />
            <div className="orb-gold" style={{ width: '300px', height: '300px', bottom: '20%', left: '5%', opacity: 0.5 }} />

            {/* Decorative accent line top */}
            <div className="absolute top-0 left-0 right-0 h-px"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(232,121,249,0.4), rgba(251,191,36,0.3), transparent)' }} />

            <div className="w-full max-w-[420px] z-10 space-y-6 animate-fade-up">

                {/* Brand */}
                <div className="text-center space-y-4">
                    {/* Shield icon */}
                    <div className="relative inline-flex items-center justify-center">
                        <div className="absolute inset-0 rounded-2xl animate-soft-pulse"
                            style={{ background: 'radial-gradient(circle, rgba(232,121,249,0.2) 0%, transparent 70%)', filter: 'blur(12px)' }} />
                        <div className="relative p-4 rounded-2xl"
                            style={{ background: 'linear-gradient(135deg, rgba(232,121,249,0.12), rgba(167,139,250,0.06))', border: '1px solid rgba(232,121,249,0.25)' }}>
                            <Shield className="w-10 h-10" style={{ color: '#e879f9' }} />
                        </div>
                    </div>

                    <div>
                        <h1 className="font-syne text-5xl sm:text-6xl font-black tracking-tighter italic leading-none">
                            <span style={{ color: '#fdf4ff' }}>WHISPER</span>
                            <span className="text-fuchsia-grad">LINK</span>
                        </h1>
                        <div className="mt-2 flex items-center justify-center gap-2">
                            <div className="h-px flex-1 max-w-[60px]"
                                style={{ background: 'linear-gradient(to right, transparent, rgba(232,121,249,0.3))' }} />
                            <p className="text-[8px] font-bold tracking-[0.5em] uppercase" style={{ color: 'var(--text-3)' }}>
                                Encrypted · Ephemeral
                            </p>
                            <div className="h-px flex-1 max-w-[60px]"
                                style={{ background: 'linear-gradient(to left, transparent, rgba(232,121,249,0.3))' }} />
                        </div>
                    </div>
                </div>

                {/* Card */}
                <div className="jewel-card">
                    <div className="jewel-card-inner p-6 sm:p-8 space-y-5">

                        {/* Alias */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-[0.35em]" style={{ color: 'rgba(232,121,249,0.55)' }}>
                                ALIAS <span style={{ color: 'var(--text-3)' }}>· min 2</span>
                            </label>
                            <div className="flex gap-2">
                                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                                    placeholder="Your sarcastic alias..." maxLength={30}
                                    className="flex-1 min-w-0 px-4 py-3 rounded-xl text-sm font-medium italic outline-none transition-all"
                                    style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.1)', color: 'var(--text-1)' }}
                                    onFocus={e => { e.target.style.border = '1px solid rgba(232,121,249,0.4)'; e.target.style.background = 'rgba(232,121,249,0.07)'; }}
                                    onBlur={e => { e.target.style.border = '1px solid rgba(232,121,249,0.1)'; e.target.style.background = 'rgba(232,121,249,0.04)'; }}
                                />
                                <button type="button" onClick={() => setUsername(getRandomName())}
                                    className="shrink-0 px-3.5 rounded-xl transition-all active:scale-90"
                                    style={{ background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.2)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,121,249,0.16)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,121,249,0.08)'}>
                                    <Shuffle className="w-4 h-4" style={{ color: '#e879f9' }} />
                                </button>
                            </div>
                        </div>

                        {/* Room ID */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-[0.35em]" style={{ color: 'rgba(232,121,249,0.55)' }}>
                                ROOM <span style={{ color: 'var(--text-3)' }}>· optional, min 4</span>
                            </label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(232,121,249,0.3)' }} />
                                    <input type="text" value={roomId} onChange={e => setRoomId(e.target.value)}
                                        placeholder="Enter or generate..." maxLength={12}
                                        className="w-full pl-10 pr-4 py-3 rounded-xl text-sm font-medium italic outline-none transition-all"
                                        style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.1)', color: 'var(--text-1)' }}
                                        onFocus={e => { e.target.style.border = '1px solid rgba(232,121,249,0.4)'; e.target.style.background = 'rgba(232,121,249,0.07)'; }}
                                        onBlur={e => { e.target.style.border = '1px solid rgba(232,121,249,0.1)'; e.target.style.background = 'rgba(232,121,249,0.04)'; }}
                                    />
                                </div>
                                <button type="button" onClick={generateRoomCode}
                                    className="shrink-0 px-3.5 rounded-xl transition-all active:scale-90"
                                    style={{ background: 'rgba(232,121,249,0.08)', border: '1px solid rgba(232,121,249,0.2)' }}
                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,121,249,0.16)'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,121,249,0.08)'}>
                                    <RefreshCw className="w-4 h-4" style={{ color: '#e879f9' }} />
                                </button>
                            </div>
                            {roomId && (
                                <p className="text-[9px] ml-1 italic" style={{ color: 'var(--text-3)' }}>
                                    Code: <span className="font-black tracking-widest" style={{ color: '#e879f9' }}>{roomId}</span>
                                    {roomId.length < 4 && <span style={{ color: 'var(--error)', marginLeft: '6px' }}>need {4 - roomId.length} more</span>}
                                </p>
                            )}
                        </div>

                        {/* Cipher Key */}
                        <div className="space-y-1.5">
                            <label className="text-[9px] font-bold uppercase tracking-[0.35em]" style={{ color: 'rgba(232,121,249,0.55)' }}>
                                CIPHER KEY <span style={{ color: 'var(--text-3)' }}>· min 4</span>
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(232,121,249,0.3)' }} />
                                <input type={showPassword ? 'text' : 'password'} value={secretPhrase}
                                    onChange={e => setSecretPhrase(e.target.value)}
                                    placeholder="Secret entry phrase..."
                                    className="w-full pl-10 pr-11 py-3 rounded-xl text-sm font-medium italic outline-none transition-all"
                                    style={{ background: 'rgba(232,121,249,0.04)', border: '1px solid rgba(232,121,249,0.1)', color: 'var(--text-1)' }}
                                    onFocus={e => { e.target.style.border = '1px solid rgba(232,121,249,0.4)'; e.target.style.background = 'rgba(232,121,249,0.07)'; }}
                                    onBlur={e => { e.target.style.border = '1px solid rgba(232,121,249,0.1)'; e.target.style.background = 'rgba(232,121,249,0.04)'; }}
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                                    style={{ color: 'rgba(232,121,249,0.3)' }}
                                    onMouseEnter={e => e.currentTarget.style.color = '#e879f9'}
                                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(232,121,249,0.3)'}>
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                            {secretPhrase.length > 0 && secretPhrase.length < 4 && (
                                <p className="text-[9px] ml-1 italic" style={{ color: 'var(--error)' }}>
                                    {4 - secretPhrase.length} more character{4 - secretPhrase.length > 1 ? 's' : ''} needed
                                </p>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="py-2.5 rounded-xl text-center"
                                style={{ background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)' }}>
                                <span className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--error)' }}>
                                    {error}
                                </span>
                            </div>
                        )}

                        {/* Submit */}
                        <button type="button" onClick={handleSubmit} disabled={isLoading}
                            className="btn-jewel w-full flex items-center justify-center gap-3 py-4 rounded-xl text-sm"
                            style={isLoading ? { opacity: 0.5, cursor: 'not-allowed', pointerEvents: 'none' } : {}}>
                            <span className="font-syne font-black tracking-[0.12em] uppercase">
                                {isLoading ? 'Establishing...' : 'Establish Connection'}
                            </span>
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
                        <div key={label} className="flex items-center gap-3 p-3.5 rounded-xl transition-all cursor-default"
                            style={{ background: 'rgba(232,121,249,0.03)', border: '1px solid rgba(232,121,249,0.08)' }}
                            onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(232,121,249,0.2)'}
                            onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(232,121,249,0.08)'}>
                            <div className="p-2 rounded-lg" style={{ background: 'rgba(232,121,249,0.08)', color: '#e879f9' }}>{icon}</div>
                            <div>
                                <p className="text-[8px] uppercase font-black tracking-wider" style={{ color: 'var(--text-3)' }}>{label}</p>
                                <p className="text-xs font-bold" style={{ color: 'var(--text-1)' }}>{value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Bottom accent line */}
                <div className="h-px mx-8"
                    style={{ background: 'linear-gradient(90deg, transparent, rgba(251,191,36,0.25), rgba(232,121,249,0.2), transparent)' }} />
            </div>
        </div>
    );
};

export default JoinRoom;
