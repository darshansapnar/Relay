import React, { useState } from 'react';
import {
  X,
  Sparkles,
  FileText,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Bot,
  BrainCircuit,
  Clock,
} from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';

export const AssistantPanel = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'summary' | 'actions'

  if (!isOpen) return null;

  return (
    <aside
      aria-label="AI Meeting Assistant panel"
      className="w-full sm:w-80 md:w-96 bg-relay-900 border-l border-relay-800 flex flex-col h-full shrink-0 select-none z-20 animate-in slide-in-from-right duration-200"
    >
      {/* Panel Header */}
      <div className="p-4 border-b border-relay-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ai/20 border border-ai/40 flex items-center justify-center text-ai-accent">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white">Relay Copilot</h2>
              <Badge variant="ai" size="sm">
                AI Demo
              </Badge>
            </div>
            <p className="text-[10px] text-relay-400">Intelligent Meeting Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-relay-400 hover:text-white hover:bg-relay-800 transition-colors"
          aria-label="Close assistant panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Disconnected / UI Demo Notice Banner */}
      <div className="p-3 bg-relay-950/70 border-b border-relay-800">
        <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-ai/10 border border-ai/20 text-ai-accent text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-ai-accent mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-semibold block text-white">AI Stream Disconnected</span>
            WebRTC audio and video streams are live. Speech-to-text transcription and intelligent
            meeting synthesis will be connected in Phase 4.
          </div>
        </div>
      </div>

      {/* Tab Selectors */}
      <div className="flex items-center border-b border-relay-800 px-3 pt-2 gap-1 bg-relay-950/40 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'overview'
              ? 'border-ai text-white'
              : 'border-transparent text-relay-400 hover:text-relay-200'
          }`}
        >
          <BrainCircuit className="w-3.5 h-3.5" />
          <span>Overview</span>
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'summary'
              ? 'border-ai text-white'
              : 'border-transparent text-relay-400 hover:text-relay-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Summary</span>
        </button>
        <button
          onClick={() => setActiveTab('actions')}
          className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors ${
            activeTab === 'actions'
              ? 'border-ai text-white'
              : 'border-transparent text-relay-400 hover:text-relay-200'
          }`}
        >
          <ListTodo className="w-3.5 h-3.5" />
          <span>Actions</span>
        </button>
      </div>

      {/* Main Empty State Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Visual Empty State */}
            <div className="p-6 rounded-2xl bg-relay-850/60 border border-relay-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-ai/15 border border-ai/30 text-ai-accent mx-auto flex items-center justify-center shadow-glow-ai">
                <Bot className="w-6 h-6" />
              </div>
              <h3 className="text-xs font-semibold text-white">Relay Assistant Standby</h3>
              <p className="text-[11px] text-relay-400 leading-relaxed">
                When transcription is active, Relay will analyze speech in real-time, generate
                rolling summaries, and extract actionable next steps without manual note-taking.
              </p>
            </div>

            {/* Feature Placeholder Cards */}
            <div className="space-y-2">
              <div className="p-3 rounded-xl bg-relay-850/40 border border-relay-800">
                <div className="flex items-center gap-2 text-white font-medium mb-1">
                  <FileText className="w-3.5 h-3.5 text-brand-light" />
                  <span>Executive Summaries</span>
                </div>
                <p className="text-[11px] text-relay-400">
                  Concise digests organized by discussion topic and timestamp.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-relay-850/40 border border-relay-800">
                <div className="flex items-center gap-2 text-white font-medium mb-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Action Item Extraction</span>
                </div>
                <p className="text-[11px] text-relay-400">
                  Identifies deliverables, assignees, and target completion dates.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-relay-850/40 border border-relay-800">
                <div className="flex items-center gap-2 text-white font-medium mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Key Decisions Log</span>
                </div>
                <p className="text-[11px] text-relay-400">
                  Automatically flags consensus decisions reached during meetings.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'summary' && (
          <div className="p-6 rounded-2xl bg-relay-850/60 border border-relay-800 text-center space-y-2">
            <FileText className="w-8 h-8 text-relay-500 mx-auto" />
            <h3 className="text-xs font-semibold text-white">No Meeting Summary Yet</h3>
            <p className="text-[11px] text-relay-400">
              Summaries will populate dynamically as participants speak once audio stream
              transcription is enabled in Phase 3.
            </p>
          </div>
        )}

        {activeTab === 'actions' && (
          <div className="p-6 rounded-2xl bg-relay-850/60 border border-relay-800 text-center space-y-2">
            <ListTodo className="w-8 h-8 text-relay-500 mx-auto" />
            <h3 className="text-xs font-semibold text-white">No Action Items Detected</h3>
            <p className="text-[11px] text-relay-400">
              Assigned deliverables and follow-ups will be listed here automatically when verbal
              commitments are detected.
            </p>
          </div>
        )}
      </div>

      {/* Assistant Prompt Input Bar (Disabled preview) */}
      <div className="p-3 border-t border-relay-800 bg-relay-950/60">
        <div className="relative flex items-center">
          <Bot className="w-4 h-4 text-ai-accent absolute left-3 pointer-events-none" />
          <input
            type="text"
            readOnly
            disabled
            placeholder="Ask Copilot (Available in Phase 3)..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-relay-800/60 border border-relay-700/60 text-relay-400 cursor-not-allowed select-none placeholder-relay-500"
          />
        </div>
      </div>
    </aside>
  );
};
