import React from 'react';
import { Badge } from '../ui/Badge.jsx';
import { Layers, Cpu, FileCode2, Check } from 'lucide-react';

export const ArchitectureSection = () => {
  return (
    <section id="architecture" className="py-16 bg-relay-900/30 border-t border-relay-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <Badge variant="brand" size="md">
            Monorepo Architecture
          </Badge>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Clean, modular structure designed for scale.
          </h2>
          <p className="mt-2 text-sm text-relay-300">
            Engineered with npm workspaces for unified dependency management and rapid iteration.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Package 1: apps/web */}
          <div className="p-5 rounded-xl bg-relay-850 border border-relay-700/80">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-lg bg-blue-500/10 text-brand-light border border-blue-500/20">
                <FileCode2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">apps/web</h3>
                <span className="text-[11px] text-relay-400">React + Vite Frontend</span>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-relay-300 mt-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Tailwind CSS design system</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>ES modules (Zero TypeScript)</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Lucide icon system</span>
              </li>
            </ul>
          </div>

          {/* Package 2: apps/api */}
          <div className="p-5 rounded-xl bg-relay-850 border border-relay-700/80">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-ai-accent border border-purple-500/20">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">apps/api</h3>
                <span className="text-[11px] text-relay-400">Express Backend Service</span>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-relay-300 mt-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Modular routes & controllers</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>CORS & Dotenv configuration</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Centralized error handling</span>
              </li>
            </ul>
          </div>

          {/* Package 3: packages/shared */}
          <div className="p-5 rounded-xl bg-relay-850 border border-relay-700/80">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">packages/shared</h3>
                <span className="text-[11px] text-relay-400">Shared Utilities</span>
              </div>
            </div>
            <ul className="space-y-1.5 text-xs text-relay-300 mt-4">
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Common app constants</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Shared route contracts</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Reusable helper routines</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
};
