import React from 'react';
import { Badge } from '../ui/Badge.jsx';
import { Video, Sparkles, CheckSquare, ShieldCheck, Search, Cpu, ArrowRight } from 'lucide-react';

const features = [
  {
    icon: Video,
    title: 'Enterprise Video Meetings',
    description:
      'Engineered for low-latency WebRTC streams, adaptive bitrate rendering, and crystal-clear acoustic quality across all team environments.',
    badge: 'Core Conferencing',
    badgeVariant: 'brand',
  },
  {
    icon: Sparkles,
    title: 'Real-Time AI Summaries',
    description:
      'Eliminate manual meeting minutes. Relay continuously parses audio streams into succinct, executive-level summaries organized by key agenda topics.',
    badge: 'Intelligent AI',
    badgeVariant: 'ai',
  },
  {
    icon: CheckSquare,
    title: 'Automated Action Items',
    description:
      'Never lose track of deliverables. Relay identifies verbal commitments, assignees, and deadlines in real-time, exporting them directly to your workflow.',
    badge: 'Productivity',
    badgeVariant: 'success',
  },
  {
    icon: Search,
    title: 'Semantic Meeting Search',
    description:
      'Recall any conversation instantly. Search past meetings by concept, key decisions, or speaker questions rather than skimming hours of video recordings.',
    badge: 'Knowledge Base',
    badgeVariant: 'default',
  },
  {
    icon: ShieldCheck,
    title: 'Zero-Trust Security & Privacy',
    description:
      'Meeting streams and transcripts are protected with industry-standard encryption. Your proprietary conversational data is never used to train public models.',
    badge: 'Security',
    badgeVariant: 'default',
  },
  {
    icon: Cpu,
    title: 'Modern Monorepo Architecture',
    description:
      'Built with Node.js Express backend and React Vite frontend in an npm workspaces monorepo for maximum velocity, modularity, and maintainability.',
    badge: 'Clean Code',
    badgeVariant: 'brand',
  },
];

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-20 bg-relay-900/50 border-t border-relay-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Heading */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <Badge variant="brand" size="md">
            Capabilities
          </Badge>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built for focused discussions and actionable outcomes.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-relay-300">
            Relay unifies real-time communication infrastructure with intelligent language models,
            transforming passive video calls into organized knowledge assets.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={idx}
                className="relative rounded-2xl bg-relay-850 border border-relay-700/70 p-6 hover:border-relay-600 transition-all duration-200 group flex flex-col justify-between hover:shadow-xl hover:shadow-black/20"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-relay-800 border border-relay-700 flex items-center justify-center text-brand-light group-hover:scale-105 transition-transform duration-200">
                      <Icon className="w-5 h-5" />
                    </div>
                    <Badge variant={feature.badgeVariant} size="sm">
                      {feature.badge}
                    </Badge>
                  </div>

                  <h3 className="text-lg font-semibold text-white tracking-tight group-hover:text-brand-light transition-colors">
                    {feature.title}
                  </h3>

                  <p className="mt-2.5 text-sm text-relay-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-relay-800/80 flex items-center text-xs text-relay-400 group-hover:text-brand-light transition-colors font-medium">
                  <span>Learn more</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5 transition-transform group-hover:translate-x-1" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
