import React from 'react';
import { Badge } from '../ui/Badge.jsx';
import { Video, Sparkles, CheckSquare, ShieldCheck } from 'lucide-react';

const features = [
  {
    icon: Video,
    title: 'Enterprise WebRTC Conferencing',
    description:
      'Engineered for low-latency video and audio streams, adaptive bitrate rendering, and crystal-clear acoustic quality across all team sizes.',
    badge: 'Video & Audio',
    badgeVariant: 'brand',
  },
  {
    icon: Sparkles,
    title: 'Live Speech-to-Text Transcription',
    description:
      'Continuous, real-time transcription with speaker attribution as words are spoken, keeping everyone aligned without manual note-taking.',
    badge: 'Real-Time AI',
    badgeVariant: 'ai',
  },
  {
    icon: CheckSquare,
    title: 'Instant Structured Summaries',
    description:
      'Automatic synthesis of evolving discussions into executive overviews, confirmed decisions, work allocation, and unresolved follow-ups.',
    badge: 'Intelligence',
    badgeVariant: 'success',
  },
  {
    icon: ShieldCheck,
    title: 'Deliverables & Action Items',
    description:
      'Relay detects commitments, assignees, and target deadlines in real time, preventing critical follow-ups from slipping through the cracks.',
    badge: 'Productivity',
    badgeVariant: 'default',
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 bg-relay-950 border-t border-relay-800/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <Badge variant="brand" size="md">
            Capabilities
          </Badge>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built for focused discussions and actionable outcomes.
          </h2>
          <p className="mt-3 text-base text-relay-300">
            Relay combines high-fidelity real-time communication with dual-model AI synthesis,
            turning live conversations into structured knowledge.
          </p>
        </div>

        {/* Feature Cards Grid - Clean 2x2 responsive layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="relative rounded-2xl bg-relay-900/60 border border-relay-800 p-6 hover:border-relay-700 transition-all duration-200 group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-relay-800/80 border border-relay-700/80 flex items-center justify-center text-brand-light group-hover:scale-105 transition-transform duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant={feature.badgeVariant} size="sm">
                      {feature.badge}
                    </Badge>
                  </div>

                  <h3 className="text-lg font-semibold text-white tracking-tight group-hover:text-brand-light transition-colors">
                    {feature.title}
                  </h3>

                  <p className="mt-2 text-sm text-relay-300 leading-relaxed font-normal">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
