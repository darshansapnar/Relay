import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import {
  Server,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  Terminal,
  Cpu,
  FileCode2,
  Layers,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export const SystemDiagnosticsSection = () => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('health'); // 'health' | 'architecture'
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setHealthData(data);
    } catch (err) {
      setError(err.message || 'Unable to connect to Express API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <section id="diagnostics" className="py-14 bg-relay-950 border-t border-relay-800/60">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Compact Summary Header with Expand Toggle */}
        <div className="rounded-2xl bg-relay-900/50 border border-relay-800/80 p-5 sm:p-6 transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-relay-800 border border-relay-700 flex items-center justify-center text-brand-light shrink-0">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">System Diagnostics</h3>
                  <Badge
                    variant={error ? 'warning' : healthData ? 'success' : 'default'}
                    size="sm"
                    dot
                    dotColor={
                      error ? 'bg-amber-400' : healthData ? 'bg-emerald-400' : 'bg-slate-400'
                    }
                  >
                    {error ? 'API Standby' : healthData ? 'All Systems Operational' : 'Checking...'}
                  </Badge>
                </div>
                <p className="text-xs text-relay-400 mt-0.5">
                  Real-time Express API health and monorepo service architecture.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={expanded ? ChevronUp : ChevronDown}
              iconPosition="right"
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-relay-300 border-relay-700 hover:text-white"
            >
              {expanded ? 'Hide Details' : 'View Diagnostics'}
            </Button>
          </div>

          {/* Expanded Diagnostics Drawer */}
          {expanded && (
            <div className="mt-6 pt-6 border-t border-relay-800">
              {/* Tab Switcher */}
              <div className="flex items-center gap-2 mb-6 border-b border-relay-800 pb-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('health')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'health'
                      ? 'bg-brand/20 text-brand-light border border-brand/30'
                      : 'text-relay-400 hover:text-white hover:bg-relay-800'
                  }`}
                >
                  API Service Health
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('architecture')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeTab === 'architecture'
                      ? 'bg-brand/20 text-brand-light border border-brand/30'
                      : 'text-relay-400 hover:text-white hover:bg-relay-800'
                  }`}
                >
                  Monorepo Architecture
                </button>
              </div>

              {/* Tab 1: Health Diagnostic */}
              {activeTab === 'health' && (
                <div className="space-y-4 max-w-2xl mx-auto">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-relay-400">Endpoint: /api/health</span>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={RefreshCw}
                      onClick={checkHealth}
                      disabled={loading}
                      className={`text-xs ${loading ? 'animate-spin' : ''}`}
                    >
                      {loading ? 'Refreshing...' : 'Re-check'}
                    </Button>
                  </div>

                  {error ? (
                    <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
                      <div>
                        <div className="font-semibold text-white">API Connection Offline</div>
                        <div className="mt-1">{error}</div>
                        <div className="mt-2 text-relay-400">
                          Ensure the Express server is running on port 5000 (
                          <code className="text-brand-light">npm run dev</code>).
                        </div>
                      </div>
                    </div>
                  ) : healthData ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="p-3 rounded-lg bg-relay-850 border border-relay-800">
                          <span className="text-relay-400 block text-[11px]">Status</span>
                          <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400 mt-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {healthData.status?.toUpperCase()}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-relay-850 border border-relay-800">
                          <span className="text-relay-400 block text-[11px]">Service</span>
                          <span className="font-mono text-white font-medium mt-0.5 block truncate">
                            {healthData.service}
                          </span>
                        </div>
                        <div className="p-3 rounded-lg bg-relay-850 border border-relay-800">
                          <span className="text-relay-400 block text-[11px]">Environment</span>
                          <span className="font-mono text-brand-light font-medium capitalize mt-0.5 block">
                            {healthData.environment}
                          </span>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-relay-850 border border-relay-800 text-xs">
                        <div className="flex items-center justify-between text-relay-400 mb-2">
                          <span className="font-mono text-[11px] flex items-center gap-1.5">
                            <Terminal className="w-3.5 h-3.5" />
                            Raw Response
                          </span>
                          <span className="text-[10px] text-relay-500 font-mono">
                            Uptime: {healthData.uptime}s
                          </span>
                        </div>
                        <pre className="font-mono text-[11px] text-emerald-300 bg-relay-950 p-3 rounded border border-relay-800/80 overflow-x-auto">
                          {JSON.stringify(healthData, null, 2)}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-relay-400">
                      Checking server status...
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Architecture Specs */}
              {activeTab === 'architecture' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* apps/web */}
                  <div className="p-4 rounded-xl bg-relay-850 border border-relay-800">
                    <div className="flex items-center gap-2 mb-2">
                      <FileCode2 className="w-4 h-4 text-brand-light" />
                      <h4 className="text-xs font-semibold text-white">apps/web</h4>
                    </div>
                    <p className="text-[11px] text-relay-400 mb-3">React + Vite Frontend</p>
                    <ul className="space-y-1 text-xs text-relay-300">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Tailwind CSS design system</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>LiveKit video client</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Socket.IO live sync</span>
                      </li>
                    </ul>
                  </div>

                  {/* apps/api */}
                  <div className="p-4 rounded-xl bg-relay-850 border border-relay-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="w-4 h-4 text-ai-accent" />
                      <h4 className="text-xs font-semibold text-white">apps/api</h4>
                    </div>
                    <p className="text-[11px] text-relay-400 mb-3">Express Backend Service</p>
                    <ul className="space-y-1 text-xs text-relay-300">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Groq & Gemini AI pipelines</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Neon PostgreSQL database</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>LiveKit cloud room tokens</span>
                      </li>
                    </ul>
                  </div>

                  {/* packages/shared */}
                  <div className="p-4 rounded-xl bg-relay-850 border border-relay-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4 text-emerald-400" />
                      <h4 className="text-xs font-semibold text-white">packages/shared</h4>
                    </div>
                    <p className="text-[11px] text-relay-400 mb-3">Shared Utilities</p>
                    <ul className="space-y-1 text-xs text-relay-300">
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Shared route constants</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Common data contracts</span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        <span>Type definitions</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
