import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button.jsx';
import { Video, Sparkles, Menu, X } from 'lucide-react';

export const Navbar = ({ onCreateMeeting, onJoinMeeting }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking'); // 'checking', 'online', 'offline'

  useEffect(() => {
    const baseUrl = import.meta.env.VITE_API_URL
      ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '').replace(/\/$/, '')
      : '';
    fetch(`${baseUrl}/api/health`)
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('API unreachable');
      })
      .then(data => {
        if (data.status === 'ok') {
          setApiStatus('online');
        } else {
          setApiStatus('offline');
        }
      })
      .catch(() => {
        setApiStatus('offline');
      });
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-relay-800/60 bg-relay-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-8">
            <a href="#" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand to-ai flex items-center justify-center text-white shadow-md shadow-brand/20 group-hover:scale-105 transition-transform duration-200">
                <Video className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold text-white tracking-tight">Relay</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand/15 text-brand-light border border-brand/30">
                  AI
                </span>
              </div>
            </a>

            {/* Navigation links - Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <a
                href="#preview"
                className="px-3 py-1.5 text-xs font-medium text-relay-300 hover:text-white rounded-lg hover:bg-relay-900 transition-colors"
              >
                Copilot Preview
              </a>
              <a
                href="#features"
                className="px-3 py-1.5 text-xs font-medium text-relay-300 hover:text-white rounded-lg hover:bg-relay-900 transition-colors"
              >
                Features
              </a>
              <a
                href="#diagnostics"
                className="px-3 py-1.5 text-xs font-medium text-relay-400 hover:text-white rounded-lg hover:bg-relay-900 transition-colors"
              >
                Diagnostics
              </a>
            </nav>
          </div>

          {/* Right actions - Desktop */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Subtle backend health indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-relay-900/80 border border-relay-800 text-[11px] text-relay-400">
              <span
                className={`w-2 h-2 rounded-full ${
                  apiStatus === 'online'
                    ? 'bg-emerald-400 animate-pulse'
                    : apiStatus === 'offline'
                      ? 'bg-amber-400'
                      : 'bg-slate-500'
                }`}
              />
              <span className="font-medium text-relay-300">
                {apiStatus === 'online'
                  ? 'Ready'
                  : apiStatus === 'offline'
                    ? 'Offline'
                    : 'Connecting...'}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={onJoinMeeting}
              className="text-relay-300 hover:text-white"
            >
              Join
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={Sparkles}
              onClick={onCreateMeeting}
              className="font-medium shadow-sm shadow-brand/20"
            >
              Start Meeting
            </Button>
          </div>

          {/* Mobile menu trigger */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-relay-300 hover:text-white hover:bg-relay-900 transition-colors"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-relay-800 bg-relay-950/95 px-4 pt-3 pb-5 space-y-3">
          <nav className="flex flex-col gap-1">
            <a
              href="#preview"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-900"
            >
              Copilot Preview
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-900"
            >
              Features
            </a>
            <a
              href="#diagnostics"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-900"
            >
              Diagnostics
            </a>
          </nav>
          <div className="pt-2 border-t border-relay-800/80 flex flex-col gap-2">
            <Button
              variant="secondary"
              size="md"
              className="w-full justify-center"
              onClick={() => {
                setMobileMenuOpen(false);
                onJoinMeeting();
              }}
            >
              Join Meeting
            </Button>
            <Button
              variant="primary"
              size="md"
              className="w-full justify-center"
              icon={Sparkles}
              onClick={() => {
                setMobileMenuOpen(false);
                onCreateMeeting();
              }}
            >
              Start Meeting
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
