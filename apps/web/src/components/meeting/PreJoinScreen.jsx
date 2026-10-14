import React, { useState } from 'react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  Video,
  Mic,
  MicOff,
  VideoOff,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Radio,
} from 'lucide-react';

export const PreJoinScreen = ({
  roomId,
  initialName = '',
  onJoin,
  onCancel,
  loading = false,
  error = null,
  onRetry,
}) => {
  const [displayName, setDisplayName] = useState(initialName || '');
  const [validationError, setValidationError] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  const handleSubmit = e => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (!trimmed) {
      setValidationError('Please enter your display name to join.');
      return;
    }
    if (loading) return;
    setValidationError('');
    localStorage.setItem('relay_displayName', trimmed);
    onJoin({
      displayName: trimmed,
      audio: micEnabled,
      video: camEnabled,
    });
  };

  return (
    <div className="min-h-screen bg-relay-950 text-relay-100 flex flex-col justify-center items-center p-4 sm:p-6 bg-grid-subtle relative">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-brand/10 blur-[140px] rounded-full pointer-events-none" />

      <div className="w-full max-w-lg bg-relay-900 border border-relay-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 z-10 animate-in fade-in zoom-in-95 duration-150">
        {/* Brand header */}
        <div className="flex items-center justify-between pb-5 border-b border-relay-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand to-ai flex items-center justify-center text-white shadow-md">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-base">Relay</span>
              <span className="text-[11px] text-relay-400 ml-2">LiveKit Meeting</span>
            </div>
          </div>
          <Badge variant="brand" size="sm" dot dotColor="bg-brand-light">
            Real-Time Room
          </Badge>
        </div>

        {/* Room Title */}
        <div className="mt-5 text-center">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Ready to join the meeting?
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-relay-400">
            Room:{' '}
            <code className="text-brand-light font-mono px-2 py-0.5 rounded bg-relay-800 border border-relay-700">
              {roomId}
            </code>
          </p>
        </div>

        {/* Error notification if token issuance failed */}
        {error && (
          <div className="mt-5 p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-xs text-red-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-white block">Connection Setup Notice</span>
                <p className="mt-0.5 text-red-300 leading-relaxed">{error}</p>
              </div>
            </div>
            {onRetry && (
              <div className="pt-2 border-t border-red-900/50 flex justify-end">
                <Button variant="secondary" size="sm" icon={RefreshCw} onClick={onRetry}>
                  Retry Connection
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {validationError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-950/40 border border-red-800/70 text-red-300 text-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-relay-300 mb-1.5">
              Your Display Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={displayName}
              onChange={e => {
                setDisplayName(e.target.value);
                if (validationError) setValidationError('');
              }}
              placeholder="Enter your name"
              className="w-full px-3.5 py-2.5 rounded-lg bg-relay-800 border border-relay-700 text-white placeholder-relay-500 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand font-medium"
            />
          </div>

          {/* Initial Audio/Video preference toggles */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={() => setMicEnabled(!micEnabled)}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                micEnabled
                  ? 'bg-relay-850 border-relay-700 text-white'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {micEnabled ? (
                  <Mic className="w-4 h-4 text-emerald-400" />
                ) : (
                  <MicOff className="w-4 h-4" />
                )}
                <span>{micEnabled ? 'Mic On' : 'Mic Off'}</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${micEnabled ? 'bg-emerald-400' : 'bg-red-400'}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setCamEnabled(!camEnabled)}
              className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                camEnabled
                  ? 'bg-relay-850 border-relay-700 text-white'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {camEnabled ? (
                  <Video className="w-4 h-4 text-emerald-400" />
                ) : (
                  <VideoOff className="w-4 h-4" />
                )}
                <span>{camEnabled ? 'Cam On' : 'Cam Off'}</span>
              </div>
              <span
                className={`w-2 h-2 rounded-full ${camEnabled ? 'bg-emerald-400' : 'bg-red-400'}`}
              />
            </button>
          </div>

          <div className="p-3 rounded-xl bg-relay-850/60 border border-relay-800 text-[11px] text-relay-400 flex items-start gap-2">
            <Radio className="w-4 h-4 text-brand-light shrink-0 mt-0.5" />
            <div>
              <span>
                Browser media permissions (mic & camera) will be requested when connecting to the
                LiveKit room.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-between gap-3">
            <Button variant="ghost" size="md" icon={ArrowLeft} onClick={onCancel} type="button">
              Back to Home
            </Button>

            <Button
              variant="primary"
              size="md"
              type="submit"
              disabled={loading || !displayName.trim()}
              icon={loading ? RefreshCw : ArrowRight}
              iconPosition="right"
              className={loading ? 'opacity-80' : ''}
            >
              {loading ? 'Connecting to Room...' : 'Join Meeting Now'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
