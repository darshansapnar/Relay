import React from 'react';
import { Video } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="border-t border-relay-800/60 bg-relay-950 py-10 text-xs text-relay-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo and mission */}
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand to-ai flex items-center justify-center text-white shadow-sm shadow-brand/20">
              <Video className="w-3.5 h-3.5" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white tracking-tight">Relay</span>
              <span className="text-relay-400 text-xs font-normal">
                Intelligent Video Meetings
              </span>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-relay-300">
            <a href="#preview" className="hover:text-white transition-colors">
              Copilot Preview
            </a>
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#diagnostics" className="hover:text-white transition-colors">
              System Diagnostics
            </a>
          </div>

          {/* Copyright */}
          <div className="text-relay-400 text-center md:text-right">
            &copy; {new Date().getFullYear()} Relay. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
};
