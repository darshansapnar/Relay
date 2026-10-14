import React, { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Sparkles, KeyRound, Shield, CheckCircle2, Zap } from 'lucide-react';

export const HeroSection = ({ onCreateMeeting, onJoinMeeting, onJoinWithCode }) => {
  const [roomCode, setRoomCode] = useState('');

  const handleJoinSubmit = e => {
    e.preventDefault();
    const trimmed = roomCode.trim();
    if (trimmed && onJoinWithCode) {
      onJoinWithCode(trimmed);
    } else {
      onJoinMeeting();
    }
  };

  return (
    <section className="relative pt-12 pb-16 md:pt-20 md:pb-24 overflow-hidden bg-grid-subtle">
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[280px] bg-brand/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[220px] bg-ai/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Release / Feature Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-relay-900/90 border border-relay-700/60 text-xs text-relay-300 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-ai-accent" />
          <span className="font-medium text-white">In-Meeting AI Intelligence</span>
          <span className="text-relay-500">•</span>
          <span className="text-relay-400">LiveKit WebRTC</span>
        </div>

        {/* Hero Heading - One prominent, commanding headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.12] max-w-4xl mx-auto">
          Online meetings made{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
            smarter
          </span>{' '}
          with real-time AI.
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-5 text-base sm:text-lg text-relay-300 max-w-2xl mx-auto leading-relaxed font-normal">
          High-performance video conferencing paired with an in-meeting AI assistant that
          transcribes conversations, generates structured notes, and extracts action items as you
          speak.
        </p>

        {/* Primary Essential Meeting Controls Bar */}
        <div className="mt-8 sm:mt-10 max-w-xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            variant="primary"
            size="lg"
            icon={Sparkles}
            onClick={onCreateMeeting}
            className="w-full sm:w-auto px-7 py-3.5 text-base font-semibold shadow-lg shadow-brand/20 hover:shadow-brand/30 transition-all shrink-0"
          >
            Start Meeting
          </Button>

          {/* Quick Join Input */}
          <form
            onSubmit={handleJoinSubmit}
            className="w-full sm:w-auto flex-1 flex items-center bg-relay-900/90 border border-relay-700/80 rounded-xl p-1.5 focus-within:border-brand/70 focus-within:ring-1 focus-within:ring-brand/40 transition-all"
          >
            <div className="pl-3 pr-2 text-relay-400 pointer-events-none">
              <KeyRound className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value)}
              placeholder="Enter meeting code"
              className="w-full bg-transparent text-sm text-white placeholder-relay-400 focus:outline-none font-mono py-1"
            />
            <Button
              variant="secondary"
              size="md"
              type="submit"
              className="shrink-0 px-4 py-2 text-xs font-semibold"
            >
              Join
            </Button>
          </form>
        </div>

        {/* Minimal inline value props without heavy borders */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-relay-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>HD Video & Audio</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-ai-accent shrink-0" />
            <span>Live Speech Transcription</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-brand-light shrink-0" />
            <span>Instant Structured Notes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Encrypted WebRTC</span>
          </div>
        </div>
      </div>
    </section>
  );
};
