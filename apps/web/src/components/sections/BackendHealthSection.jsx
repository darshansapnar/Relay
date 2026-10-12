import React, { useState, useEffect } from 'react';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Server, CheckCircle2, RefreshCw, AlertTriangle, Terminal } from 'lucide-react';

export const BackendHealthSection = () => {
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
    <section id="health" className="py-16 bg-relay-950 border-t border-relay-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center mb-10">
          <Badge variant="brand" size="md">
            Integration Status
          </Badge>
          <h2 className="mt-3 text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Backend Health & Service Diagnostics
          </h2>
          <p className="mt-2 text-sm text-relay-300">
            Real-time verification of the Express API service at{' '}
            <code className="text-brand-light">GET /api/health</code>.
          </p>
        </div>

        {/* Health status card */}
        <div className="max-w-2xl mx-auto rounded-2xl bg-relay-900 border border-relay-700/80 p-6 shadow-xl">
          <div className="flex items-center justify-between pb-4 border-b border-relay-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-relay-800 border border-relay-700 flex items-center justify-center text-brand-light">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Express API Service</h3>
                <p className="text-xs text-relay-400">Endpoint: /api/health</p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={checkHealth}
              disabled={loading}
              className={loading ? 'animate-spin' : ''}
            >
              {loading ? 'Checking...' : 'Refresh'}
            </Button>
          </div>

          <div className="mt-4">
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
                <div className="flex items-center justify-between text-xs p-3 rounded-lg bg-relay-850 border border-relay-800">
                  <span className="text-relay-400">Status</span>
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    {healthData.status?.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-relay-850 border border-relay-800">
                    <span className="text-relay-400 block text-[11px]">Service Identifier</span>
                    <span className="font-mono text-white font-medium">{healthData.service}</span>
                  </div>
                  <div className="p-3 rounded-lg bg-relay-850 border border-relay-800">
                    <span className="text-relay-400 block text-[11px]">Environment</span>
                    <span className="font-mono text-brand-light font-medium capitalize">
                      {healthData.environment}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-relay-850 border border-relay-800 text-xs">
                  <div className="flex items-center justify-between text-relay-400 mb-2">
                    <span className="font-mono text-[11px] flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" />
                      Raw JSON Response
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
              <div className="p-8 text-center text-xs text-relay-400">
                Checking server status...
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
