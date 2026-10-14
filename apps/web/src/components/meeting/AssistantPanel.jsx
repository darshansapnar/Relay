import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  FileText,
  ListTodo,
  CheckCircle2,
  AlertCircle,
  Mic,
  Power,
  RefreshCw,
  MessageSquare,
  ShieldAlert,
  Users,
  HelpCircle,
} from 'lucide-react';
import { Badge } from '../ui/Badge.jsx';
import { AI_STATUS, AI_MESSAGES } from '@relay/shared';

export const AssistantPanel = ({
  isOpen,
  onClose,
  isActive = false,
  _consentGranted = false,
  transcriptionStatus = AI_STATUS.IDLE,
  summaryStatus = AI_STATUS.IDLE,
  pauseReason = null,
  transcriptionPauseReason = null,
  transcripts = [],
  latestSummary = null,
  isGeneratingSummary = false,
  audioStreamingActive = false,
  onToggleAI,
  onTriggerSummary,
  _isHost = false,
}) => {
  const [activeTab, setActiveTab] = useState('transcript'); // 'transcript' | 'summary'
  const [toggling, setToggling] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const [activationError, setActivationError] = useState(null);
  const transcriptEndRef = useRef(null);

  // Auto-scroll transcript to bottom when new transcript segments arrive
  useEffect(() => {
    if (activeTab === 'transcript' && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts, activeTab]);

  if (!isOpen) return null;

  const handleStartWithConsent = async () => {
    if (toggling || !onToggleAI) return;
    setToggling(true);
    setActivationError(null);
    try {
      await onToggleAI(true);
    } catch (err) {
      console.error('Failed to enable AI assistant:', err);
      setActivationError(err.message || 'Failed to activate AI assistant. Please try again.');
    } finally {
      setToggling(false);
    }
  };

  const handleStop = async () => {
    if (toggling || !onToggleAI) return;
    setToggling(true);
    setActivationError(null);
    try {
      await onToggleAI(false);
    } catch (err) {
      console.error('Failed to stop AI assistant:', err);
      setActivationError(err.message || 'Failed to stop AI assistant.');
    } finally {
      setToggling(false);
    }
  };

  const formatTimestamp = ms => {
    if (ms == null || isNaN(ms)) return '00:00';
    let elapsedMs = Number(ms);

    // If ms is a raw UNIX epoch (e.g. > 1e11), normalize against meeting baseline epoch
    if (elapsedMs > 100000000000) {
      let minEpoch = elapsedMs;
      if (Array.isArray(transcripts)) {
        for (let i = 0; i < transcripts.length; i++) {
          const tMs = Number(transcripts[i]?.startTimeMs);
          if (tMs > 100000000000 && tMs < minEpoch) {
            minEpoch = tMs;
          }
        }
      }
      elapsedMs = Math.max(0, elapsedMs - minEpoch);
    }

    const totalSec = Math.max(0, Math.floor(elapsedMs / 1000));
    const hours = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const isPaused =
    summaryStatus === AI_STATUS.PAUSED ||
    transcriptionStatus === AI_STATUS.PAUSED ||
    Boolean(pauseReason) ||
    Boolean(transcriptionPauseReason);

  return (
    <aside
      aria-label="AI Meeting Assistant panel"
      className="w-full sm:w-80 md:w-96 bg-relay-900 border-l border-relay-800 flex flex-col h-full shrink-0 select-none z-20 animate-in slide-in-from-right duration-200 text-xs"
    >
      {/* Panel Header */}
      <div className="p-3.5 border-b border-relay-800 flex items-center justify-between bg-relay-950/70">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all ${
              isActive
                ? 'bg-ai/20 border-ai/50 text-ai-accent shadow-glow-ai'
                : 'bg-relay-800 border-relay-700 text-relay-400'
            }`}
          >
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white">Relay Copilot</h2>
              {isActive ? (
                <Badge variant="ai" size="sm" className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Active</span>
                </Badge>
              ) : isPaused ? (
                <Badge variant="warning" size="sm">
                  Paused
                </Badge>
              ) : (
                <Badge variant="secondary" size="sm">
                  Standby
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-relay-400">Intelligent Meeting Assistant</p>
          </div>
        </div>

        <button
          id="close-assistant-panel-btn"
          onClick={onClose}
          className="p-1.5 rounded-lg text-relay-400 hover:text-white hover:bg-relay-800 transition-colors"
          aria-label="Close assistant panel"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Activation / Action Error Banner */}
      {activationError && (
        <div
          role="alert"
          className="p-3 bg-red-950/50 border-b border-red-800/60 text-red-200 text-[11px] flex items-start justify-between gap-2"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">{activationError}</div>
          </div>
          <button
            onClick={() => setActivationError(null)}
            className="text-red-400 hover:text-red-200 p-0.5 rounded transition-colors"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Non-intrusive Pause Banners for Free-Tier Limits */}
      {pauseReason && (
        <div
          role="alert"
          className="p-3 bg-amber-950/40 border-b border-amber-800/40 text-amber-200 text-[11px] flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {pauseReason === 'quota_exhausted'
              ? AI_MESSAGES.SUMMARY_PAUSED_QUOTA
              : pauseReason}
          </div>
        </div>
      )}

      {transcriptionPauseReason && (
        <div
          role="alert"
          className="p-3 bg-amber-950/40 border-b border-amber-800/40 text-amber-200 text-[11px] flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            {transcriptionPauseReason === 'quota_exhausted'
              ? AI_MESSAGES.TRANSCRIPTION_PAUSED_QUOTA
              : transcriptionPauseReason}
          </div>
        </div>
      )}

      {/* Consent & Activation Banner (Shown when AI Assistant is not active) */}
      {!isActive && (
        <div className="p-4 bg-relay-950/80 border-b border-relay-800 space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 text-ai-accent shrink-0 mt-0.5" />
            <div className="text-[11px] text-relay-300 leading-relaxed space-y-1">
              <span className="font-semibold text-white block">Participant Consent Required</span>
              <p>
                Relay Copilot analyzes live meeting speech in real-time to generate rolling
                summaries, key decisions, and action items. Audio is processed via external AI
                services.
              </p>
            </div>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-relay-300 cursor-pointer pt-1">
            <input
              id="ai-consent-checkbox"
              type="checkbox"
              checked={consentChecked}
              onChange={e => setConsentChecked(e.target.checked)}
              className="rounded border-relay-700 bg-relay-800 text-brand focus:ring-brand"
            />
            <span>I confirm participants are informed and consent to AI processing.</span>
          </label>

          <button
            id="enable-ai-assistant-btn"
            type="button"
            disabled={!consentChecked || toggling}
            onClick={handleStartWithConsent}
            className="w-full py-2 px-3 rounded-xl bg-ai hover:bg-ai/90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2 shadow-glow-ai transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>{toggling ? 'Enabling Copilot...' : 'Enable AI Assistant'}</span>
          </button>
        </div>
      )}

      {/* Active Processing Indicator & Stop Control */}
      {isActive && (
        <div className="px-3.5 py-2.5 bg-ai/10 border-b border-ai/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
            <span className="text-[11px] font-medium text-white">
              {isGeneratingSummary
                ? 'Synthesizing Summary...'
                : audioStreamingActive
                  ? 'Listening & Transcribing...'
                  : 'AI Assistant Active'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              id="trigger-summary-btn"
              type="button"
              disabled={isGeneratingSummary}
              onClick={onTriggerSummary}
              title="Generate summary now"
              className="p-1.5 rounded-lg text-relay-300 hover:text-white hover:bg-relay-800/80 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingSummary ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="stop-ai-assistant-btn"
              type="button"
              onClick={handleStop}
              title="Stop AI Assistant"
              className="px-2 py-1 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30 text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Power className="w-3 h-3" />
              <span>Stop</span>
            </button>
          </div>
        </div>
      )}

      {/* Navigation Tabs (Live Transcript and Summary only) */}
      <div className="flex items-center border-b border-relay-800 px-3 pt-1 gap-2 bg-relay-950/50">
        <button
          id="tab-transcript"
          onClick={() => setActiveTab('transcript')}
          className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'transcript'
              ? 'border-ai text-white'
              : 'border-transparent text-relay-400 hover:text-relay-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Live Transcript</span>
          {transcripts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-relay-800 text-[10px] rounded-full text-relay-300">
              {transcripts.length}
            </span>
          )}
        </button>

        <button
          id="tab-summary"
          onClick={() => setActiveTab('summary')}
          className={`flex items-center gap-1.5 px-3 py-2 font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === 'summary'
              ? 'border-ai text-white'
              : 'border-transparent text-relay-400 hover:text-relay-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Summary</span>
          {latestSummary?.version && (
            <span className="ml-1 px-1.5 py-0.2 bg-ai/20 text-ai-accent text-[10px] rounded-full font-mono">
              v{latestSummary.version}
            </span>
          )}
        </button>
      </div>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* Tab 1: Live Transcript */}
        {activeTab === 'transcript' && (
          <div className="space-y-3">
            {transcripts.length === 0 ? (
              <div className="p-6 rounded-2xl bg-relay-850/40 border border-relay-800 text-center space-y-2.5">
                <Mic className="w-7 h-7 text-relay-500 mx-auto" />
                <h3 className="font-semibold text-white">No Transcript Available</h3>
                <p className="text-[11px] text-relay-400 leading-relaxed">
                  {isActive
                    ? 'Listening to meeting audio... Transcripts will appear as participants speak.'
                    : 'Enable AI Assistant to start real-time speech transcription.'}
                </p>
              </div>
            ) : (
              transcripts.map(seg => (
                <div
                  key={seg.id || `${seg.startTimeMs}-${seg.speakerIdentity}`}
                  className="p-3 rounded-xl bg-relay-850/60 border border-relay-800/80 space-y-1.5"
                >
                  <div className="flex items-center justify-between text-[10px] text-relay-400">
                    <span className="font-semibold text-relay-200">
                      {seg.speakerName && seg.speakerName !== 'undefined'
                        ? seg.speakerName
                        : seg.speakerIdentity && !seg.speakerIdentity.startsWith('user_')
                          ? seg.speakerIdentity
                          : 'Unknown speaker'}
                    </span>
                    <span className="font-mono text-relay-500">
                      {formatTimestamp(seg.startTimeMs)}
                    </span>
                  </div>
                  <p className="text-relay-100 text-[11px] leading-relaxed select-text">
                    {seg.text}
                  </p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}

        {/* Tab 2: Summary */}
        {activeTab === 'summary' && (
          <div className="space-y-3.5">
            {/* Loading state while summary is actively generating */}
            {isGeneratingSummary && (
              <div className="p-3.5 rounded-xl bg-ai/10 border border-ai/30 flex items-center gap-3 animate-pulse">
                <RefreshCw className="w-4 h-4 text-ai-accent animate-spin shrink-0" />
                <div className="space-y-0.5">
                  <h4 className="text-white font-medium text-xs">Synthesizing Meeting Summary...</h4>
                  <p className="text-[10px] text-relay-400">
                    Analyzing conversation to extract discussion, decisions, and action items.
                  </p>
                </div>
              </div>
            )}

            {latestSummary ? (
              <div className="space-y-3">
                {/* Executive Summary Card */}
                <div className="p-4 rounded-xl bg-ai/10 border border-ai/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-ai-accent uppercase tracking-wider">
                      Meeting Summary (v{latestSummary.version})
                    </span>
                    <span className="text-[10px] text-relay-400">
                      {latestSummary.createdAt && (
                        <>
                          Last updated:{' '}
                          {new Date(latestSummary.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-white text-[11px] leading-relaxed whitespace-pre-wrap select-text">
                    {latestSummary.summaryText}
                  </p>
                  {latestSummary.providerUsed && (
                    <div className="pt-1 flex items-center justify-between text-[10px] text-relay-400 border-t border-ai/20">
                      <span>Provider: <strong className="text-relay-200 capitalize">{latestSummary.providerUsed}</strong></span>
                      {latestSummary.modelUsed && <span className="font-mono text-[9px] text-relay-500">{latestSummary.modelUsed}</span>}
                    </div>
                  )}
                </div>

                {/* Key Discussion Points */}
                {latestSummary.keyPoints && latestSummary.keyPoints.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-relay-850/60 border border-relay-800 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <FileText className="w-3.5 h-3.5 text-brand-light" />
                      <span>Key Discussion Points</span>
                    </div>
                    <ul className="space-y-1.5 pl-4 list-disc text-relay-300 text-[11px]">
                      {latestSummary.keyPoints.map((point, idx) => (
                        <li key={idx} className="select-text">
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Decisions */}
                {latestSummary.decisions && latestSummary.decisions.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-relay-850/60 border border-relay-800 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Decisions Made</span>
                    </div>
                    <div className="space-y-1.5">
                      {latestSummary.decisions.map((decision, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-[11px] text-relay-200">
                          <span className="text-emerald-400 font-bold shrink-0">•</span>
                          <p className="select-text">{decision}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Work Allocation */}
                {latestSummary.workAllocation && latestSummary.workAllocation.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-relay-850/60 border border-relay-800 space-y-2.5">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <Users className="w-3.5 h-3.5 text-brand-light" />
                      <span>Work Allocation</span>
                    </div>
                    <div className="space-y-2">
                      {latestSummary.workAllocation.map((wa, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded-lg bg-relay-900/80 border border-relay-800 text-[11px] space-y-1.5"
                        >
                          <div className="flex items-center gap-1.5 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-light inline-block"></span>
                            <span className="text-white text-xs select-text font-bold">{wa.person}</span>
                          </div>
                          {Array.isArray(wa.responsibilities) && wa.responsibilities.length > 0 && (
                            <ul className="pl-4 space-y-1 list-disc text-relay-300 text-[10.5px]">
                              {wa.responsibilities.map((resp, rIdx) => (
                                <li key={rIdx} className="select-text leading-relaxed">
                                  {resp}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Items */}
                {latestSummary.actionItems && latestSummary.actionItems.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-relay-850/60 border border-relay-800 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <ListTodo className="w-3.5 h-3.5 text-brand-light" />
                      <span>Action Items</span>
                    </div>
                    <div className="space-y-2">
                      {latestSummary.actionItems.map((item, idx) => {
                        const owner = item.owner || item.assignee || 'Not specified';
                        const deadline = item.deadline || 'Not specified';
                        return (
                          <div
                            key={idx}
                            className="p-2.5 rounded-lg bg-relay-900/80 border border-relay-800 text-[11px] space-y-1.5"
                          >
                            <p className="text-white font-medium select-text">{item.task}</p>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-relay-400">
                              <div>
                                Owner: <span className="text-relay-200 font-semibold">{owner}</span>
                              </div>
                              <div>
                                Deadline:{' '}
                                <span
                                  className={
                                    deadline !== 'Not specified'
                                      ? 'text-amber-300 font-semibold'
                                      : 'text-relay-400'
                                  }
                                >
                                  {deadline}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Unresolved Questions & Follow-ups */}
                {latestSummary.unresolvedQuestions && latestSummary.unresolvedQuestions.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-relay-850/60 border border-relay-800 space-y-2">
                    <div className="flex items-center gap-2 text-white font-semibold">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Unresolved Questions & Follow-ups</span>
                    </div>
                    <ul className="space-y-1.5 pl-4 list-disc text-relay-300 text-[11px]">
                      {latestSummary.unresolvedQuestions.map((q, idx) => (
                        <li key={idx} className="select-text">
                          {q}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : !isGeneratingSummary ? (
              summaryStatus === AI_STATUS.PAUSED || pauseReason === 'quota_exhausted' ? (
                <div className="p-6 rounded-2xl bg-amber-950/20 border border-amber-800/40 text-center space-y-2.5">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
                  <h3 className="font-semibold text-white">Summaries Paused</h3>
                  <p className="text-[11px] text-amber-200/90 leading-relaxed">
                    {AI_MESSAGES.SUMMARY_PAUSED_QUOTA}
                  </p>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-relay-850/40 border border-relay-800 text-center space-y-2.5">
                  <FileText className="w-8 h-8 text-ai-accent mx-auto" />
                  <h3 className="font-semibold text-white">No Summary Generated Yet</h3>
                  <p className="text-[11px] text-relay-400 leading-relaxed">
                    Relay Copilot generates cumulative summaries as discussion occurs. Waiting for sufficient transcript to synthesize summary.
                  </p>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
};
