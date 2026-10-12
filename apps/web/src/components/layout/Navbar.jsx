import React, { useState, useEffect } from 'react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Video, Sparkles, Menu, X } from 'lucide-react';

export const Navbar = ({ onCreateMeeting, onJoinMeeting }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking'); // 'checking', 'online', 'offline'

  useEffect(() => {
    // Check backend health status quietly
    fetch('/api/health')
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
    <header className="sticky top-0 z-40 w-full border-b border-relay-800/80 bg-relay-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <a href="#" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand to-ai flex items-center justify-center text-white shadow-md shadow-brand/20 group-hover:scale-105 transition-transform duration-200">
                <Video className="w-5 h-5" />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold text-white tracking-tight">Relay</span>
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-brand/15 text-brand-light border border-brand/30">
                  AI
                </span>
              </div>
            </a>

            {/* Navigation links - Desktop */}
            <nav className="hidden md:flex items-center gap-1">
              <a
                href="#features"
                className="px-3 py-1.5 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-900 transition-colors"
              >
                Features
              </a>
              <a
                href="#preview"
                className="px-3 py-1.5 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-900 transition-colors"
              >
                In-Meeting Copilot
              </a>
              <a
                href="#health"
                className="px-3 py-1.5 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-900 transition-colors"
              >
                System Status
              </a>
              <a
                href="#architecture"
                className="px-3 py-1.5 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-900 transition-colors"
              >
                Architecture
              </a>
            </nav>
          </div>

          {/* Right actions - Desktop */}
          <div className="hidden sm:flex items-center gap-3">
            {/* Backend health status badge */}
            <div className="hidden lg:flex items-center">
              {apiStatus === 'online' ? (
                <Badge variant="success" size="sm" dot dotColor="bg-emerald-400">
                  API Connected
                </Badge>
              ) : apiStatus === 'offline' ? (
                <Badge variant="warning" size="sm" dot dotColor="bg-amber-400">
                  API Standby
                </Badge>
              ) : (
                <Badge variant="default" size="sm" dot dotColor="bg-slate-400">
                  Checking API...
                </Badge>
              )}
            </div>

            <Button variant="secondary" size="sm" onClick={onJoinMeeting}>
              Join Meeting
            </Button>
            <Button variant="primary" size="sm" icon={Sparkles} onClick={onCreateMeeting}>
              Create Meeting
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
        <div className="md:hidden border-b border-relay-800 bg-relay-900/95 px-4 pt-3 pb-5 space-y-3">
          <nav className="flex flex-col gap-1">
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-800"
            >
              Features
            </a>
            <a
              href="#preview"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-800"
            >
              In-Meeting Copilot
            </a>
            <a
              href="#health"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-800"
            >
              System Status
            </a>
            <a
              href="#architecture"
              onClick={() => setMobileMenuOpen(false)}
              className="px-3 py-2 text-sm text-relay-300 hover:text-white rounded-lg hover:bg-relay-800"
            >
              Architecture
            </a>
          </nav>
          <div className="pt-2 border-t border-relay-800 flex flex-col gap-2">
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
              Create Meeting
            </Button>
          </div>
        </div>
      )}
    </header>
  );
};
