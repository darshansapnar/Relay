import React from 'react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Video, Sparkles, Shield, Zap, CheckCircle2 } from 'lucide-react';

export const HeroSection = ({ onCreateMeeting, onJoinMeeting }) => {
  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-grid-subtle">
      {/* Background ambient light */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-brand/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[250px] bg-ai/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Release / Phase pill */}
        <div className="inline-flex items-center gap-2 mb-6">
          <Badge variant="brand" size="md" dot dotColor="bg-brand-light">
            Relay Platform • Phase 1 Foundation
          </Badge>
          <span className="hidden sm:inline-flex text-xs text-relay-400 items-center gap-1">
            <span>Powered by modern WebRTC & LLM Intelligence</span>
          </span>
        </div>

        {/* Hero Heading */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.15] max-w-4xl mx-auto">
          Online meetings made{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400">
            smarter
          </span>{' '}
          with real-time AI.
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-lg sm:text-xl text-relay-300 max-w-2xl mx-auto leading-relaxed font-normal">
          High-performance video conferencing paired with an in-meeting AI assistant that
          transcribes conversations, generates structured notes, and extracts action items as you
          speak.
        </p>

        {/* Call to Actions */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
          <Button
            variant="primary"
            size="lg"
            icon={Sparkles}
            onClick={onCreateMeeting}
            className="w-full sm:w-auto px-7 py-3.5 text-base font-semibold"
          >
            Create Meeting
          </Button>

          <Button
            variant="secondary"
            size="lg"
            icon={Video}
            onClick={onJoinMeeting}
            className="w-full sm:w-auto px-7 py-3.5 text-base"
          >
            Join Meeting
          </Button>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 pt-8 border-t border-relay-800/60 max-w-3xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-relay-400">
          <div className="flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>HD Video & Audio</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-brand-light shrink-0" />
            <span>Real-Time Summaries</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-ai-accent shrink-0" />
            <span>Action Item Extraction</span>
          </div>
          <div className="flex items-center justify-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Enterprise Security</span>
          </div>
        </div>
      </div>
    </section>
  );
};
