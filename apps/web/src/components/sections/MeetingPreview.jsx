import React, { useState } from 'react';
import { Badge } from '../ui/Badge.jsx';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Share2,
  MessageSquare,
  Users,
  Sparkles,
  PhoneOff,
  CheckCircle,
  Clock,
  ListTodo,
  FileText,
  Bot,
} from 'lucide-react';

export const MeetingPreview = () => {
  const [activeTab, setActiveTab] = useState('summary'); // 'summary' | 'actions' | 'transcript'
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);

  return (
    <section id="preview" className="py-16 md:py-24 bg-relay-950 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge variant="ai" size="md" dot dotColor="bg-ai-accent">
            In-Meeting Experience
          </Badge>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Designed for seamless conversations and zero note-taking friction.
          </h2>
          <p className="mt-4 text-base sm:text-lg text-relay-300">
            Preview the Relay in-room experience. A distraction-free video grid on the left, backed
            by a continuous AI copilot generating real-time meeting synthesis on the right.
          </p>
        </div>

        {/* Video Conference Container */}
        <div className="relative rounded-2xl border border-relay-700/80 bg-relay-900 shadow-2xl overflow-hidden">
          {/* Mock Browser/Window Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-relay-950/90 border-b border-relay-800">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-3 text-xs font-medium text-relay-400 hidden sm:inline-block">
                relay.app/room/eng-quarterly-sync
              </span>
            </div>

            {/* Room metadata */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-relay-300 bg-relay-800/80 px-2.5 py-1 rounded-md border border-relay-700">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="font-mono">REC 24:18</span>
              </div>
              <Badge variant="brand" size="sm">
                4 Participants
              </Badge>
            </div>
          </div>

          {/* Main Conference Body: Video Grid + AI Sidepanel */}
          <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[580px]">
            {/* Left Column: Video Participants Grid (8 cols on lg) */}
            <div className="lg:col-span-8 p-4 sm:p-5 flex flex-col justify-between bg-relay-950/60">
              {/* 2x2 Video Tile Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
                {/* Tile 1: Active Speaker */}
                <div className="relative rounded-xl overflow-hidden bg-relay-900 border-2 border-brand/80 shadow-lg shadow-brand/10 min-h-[170px] sm:min-h-[200px] flex items-center justify-center group">
                  <div className="absolute inset-0 bg-gradient-to-t from-relay-950/90 via-transparent to-transparent z-10" />

                  {/* Subtle video background representation */}
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                    AM
                  </div>

                  {/* Active Speaker wave */}
                  <div className="absolute top-3 left-3 z-20 flex items-center gap-1 bg-brand/20 border border-brand/40 px-2 py-0.5 rounded-full">
                    <div className="w-1 bg-brand-light rounded animate-wave-1" />
                    <div className="w-1 bg-brand-light rounded animate-wave-2" />
                    <div className="w-1 bg-brand-light rounded animate-wave-3" />
                    <div className="w-1 bg-brand-light rounded animate-wave-4" />
                    <span className="text-[10px] text-brand-light font-medium ml-1">Speaking</span>
                  </div>

                  {/* Tile Footer */}
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-xs">
                    <span className="font-medium text-white flex items-center gap-1.5">
                      Aditya Mehta <span className="text-relay-400 text-[10px]">(Tech Lead)</span>
                    </span>
                    <span className="p-1 rounded bg-relay-800/90 text-emerald-400">
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Tile 2: Participant 2 */}
                <div className="relative rounded-xl overflow-hidden bg-relay-900 border border-relay-800 min-h-[170px] sm:min-h-[200px] flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-relay-950/90 via-transparent to-transparent z-10" />
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                    PP
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-xs">
                    <span className="font-medium text-white">Priya Patel</span>
                    <span className="p-1 rounded bg-relay-800/90 text-red-400">
                      <MicOff className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Tile 3: Participant 3 */}
                <div className="relative rounded-xl overflow-hidden bg-relay-900 border border-relay-800 min-h-[170px] sm:min-h-[200px] flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-relay-950/90 via-transparent to-transparent z-10" />
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                    MV
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-xs">
                    <span className="font-medium text-white">Manish Verma</span>
                    <span className="p-1 rounded bg-relay-800/90 text-emerald-400">
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>

                {/* Tile 4: Participant 4 (You) */}
                <div className="relative rounded-xl overflow-hidden bg-relay-900 border border-relay-800 min-h-[170px] sm:min-h-[200px] flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-t from-relay-950/90 via-transparent to-transparent z-10" />
                  <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-inner">
                    You
                  </div>
                  <div className="absolute top-3 right-3 z-20">
                    <span className="text-[10px] bg-relay-800/80 px-2 py-0.5 rounded text-relay-300 border border-relay-700">
                      Host
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center justify-between text-xs">
                    <span className="font-medium text-white">You (Organizer)</span>
                    <span className="p-1 rounded bg-relay-800/90 text-emerald-400">
                      <Mic className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom In-Meeting Controls Bar */}
              <div className="mt-4 pt-3 border-t border-relay-800/80 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setMicActive(!micActive)}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      micActive
                        ? 'bg-relay-800 border-relay-700 text-white hover:bg-relay-750'
                        : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                    }`}
                    title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}
                  >
                    {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setCameraActive(!cameraActive)}
                    className={`p-2.5 rounded-xl border transition-colors ${
                      cameraActive
                        ? 'bg-relay-800 border-relay-700 text-white hover:bg-relay-750'
                        : 'bg-red-500/20 border-red-500/40 text-red-400 hover:bg-red-500/30'
                    }`}
                    title={cameraActive ? 'Turn Off Camera' : 'Turn On Camera'}
                  >
                    {cameraActive ? (
                      <Video className="w-4 h-4" />
                    ) : (
                      <VideoOff className="w-4 h-4" />
                    )}
                  </button>

                  <button
                    className="p-2.5 rounded-xl bg-relay-800 border border-relay-700 text-relay-300 hover:text-white hover:bg-relay-750 transition-colors"
                    title="Share Screen"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    className="p-2.5 rounded-xl bg-relay-800 border border-relay-700 text-relay-300 hover:text-white hover:bg-relay-750 transition-colors"
                    title="In-call Chat"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </button>

                  <button
                    className="p-2.5 rounded-xl bg-relay-800 border border-relay-700 text-relay-300 hover:text-white hover:bg-relay-750 transition-colors flex items-center gap-1.5 text-xs"
                    title="Participant List"
                  >
                    <Users className="w-4 h-4" />
                    <span>4</span>
                  </button>

                  <button
                    className="px-3.5 py-2 rounded-xl bg-red-600/90 hover:bg-red-600 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                    title="Leave Meeting"
                  >
                    <PhoneOff className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Leave</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: AI Meeting Assistant Panel (4 cols on lg) */}
            <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-relay-800 bg-relay-900/95 flex flex-col justify-between">
              {/* Assistant Header */}
              <div>
                <div className="p-4 border-b border-relay-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-ai/20 border border-ai/40 flex items-center justify-center text-ai-accent">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white flex items-center gap-1.5">
                        Relay AI Assistant
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </h3>
                      <p className="text-[10px] text-relay-400">Processing live audio stream</p>
                    </div>
                  </div>
                  <Badge variant="ai" size="sm">
                    Listening
                  </Badge>
                </div>

                {/* Sub Navigation tabs */}
                <div className="flex items-center border-b border-relay-800 px-3 pt-2 gap-1 bg-relay-950/40">
                  <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'summary'
                        ? 'border-brand text-white'
                        : 'border-transparent text-relay-400 hover:text-relay-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Live Notes</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('actions')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'actions'
                        ? 'border-brand text-white'
                        : 'border-transparent text-relay-400 hover:text-relay-200'
                    }`}
                  >
                    <ListTodo className="w-3.5 h-3.5" />
                    <span>Action Items</span>
                    <span className="px-1.5 py-0.2 bg-brand/20 text-brand-light text-[10px] rounded-full">
                      3
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab('transcript')}
                    className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'transcript'
                        ? 'border-brand text-white'
                        : 'border-transparent text-relay-400 hover:text-relay-200'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Transcript</span>
                  </button>
                </div>

                {/* Content based on Active Tab */}
                <div className="p-4 space-y-3.5 text-xs overflow-y-auto max-h-[350px]">
                  {activeTab === 'summary' && (
                    <>
                      <div className="p-3 rounded-lg bg-relay-800/70 border border-relay-700/60">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-ai-accent block mb-1">
                          Key Topic: Architecture Alignment
                        </span>
                        <p className="text-relay-200 leading-relaxed text-xs">
                          Team agreed on npm workspaces monorepo structure with Express API and
                          React Vite frontend. Next phase connects LiveKit SFU for WebRTC
                          audio/video feeds.
                        </p>
                      </div>

                      <div className="p-3 rounded-lg bg-relay-800/70 border border-relay-700/60">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-ai-accent block mb-1">
                          Live Summary Digest
                        </span>
                        <ul className="space-y-1.5 text-relay-300">
                          <li className="flex items-start gap-1.5">
                            <span className="text-brand-light mt-0.5">•</span>
                            <span>Aditya confirmed sub-100ms audio latency benchmark target.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-brand-light mt-0.5">•</span>
                            <span>Priya demonstrated the dark charcoal design system.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-brand-light mt-0.5">•</span>
                            <span>
                              Express health check endpoint configured at{' '}
                              <code className="text-brand-light">/api/health</code>.
                            </span>
                          </li>
                        </ul>
                      </div>
                    </>
                  )}

                  {activeTab === 'actions' && (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-relay-800/80 border border-relay-700 flex items-start gap-2.5">
                        <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-white font-medium text-xs">Setup monorepo workspace</p>
                          <p className="text-[10px] text-relay-400 mt-0.5">
                            Assigned: Engineering • Status: Completed
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-relay-800/80 border border-relay-700 flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded border border-relay-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-white font-medium text-xs">
                            Verify Express health check
                          </p>
                          <p className="text-[10px] text-relay-400 mt-0.5">
                            Assigned: Backend Team • In Progress
                          </p>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-relay-800/80 border border-relay-700 flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded border border-relay-500 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-white font-medium text-xs">
                            Plan LiveKit SFU integration (Phase 2)
                          </p>
                          <p className="text-[10px] text-relay-400 mt-0.5">
                            Assigned: Aditya Mehta • Next Milestone
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'transcript' && (
                    <div className="space-y-3 font-mono text-[11px]">
                      <div>
                        <span className="text-brand-light font-sans font-semibold">
                          Aditya Mehta
                        </span>
                        <span className="text-relay-500 ml-2">10:14:02 AM</span>
                        <p className="text-relay-300 mt-0.5 font-sans">
                          "The monorepo structure makes shared utilities and types consistent
                          between the Express backend and React frontend."
                        </p>
                      </div>
                      <div>
                        <span className="text-purple-400 font-sans font-semibold">Priya Patel</span>
                        <span className="text-relay-500 ml-2">10:14:26 AM</span>
                        <p className="text-relay-300 mt-0.5 font-sans">
                          "Tailwind CSS colors are tuned to dark charcoal with a restrained blue
                          accent for enterprise appeal."
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Assistant Query Bar */}
              <div className="p-3 border-t border-relay-800 bg-relay-950/60">
                <div className="relative flex items-center">
                  <Bot className="w-4 h-4 text-ai-accent absolute left-3 pointer-events-none" />
                  <input
                    type="text"
                    readOnly
                    value="Ask assistant: 'What was decided about Phase 2?'"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg bg-relay-800 border border-relay-700 text-relay-300 cursor-not-allowed select-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
