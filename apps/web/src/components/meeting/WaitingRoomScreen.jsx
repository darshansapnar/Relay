import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
  Video,
  Clock,
  LogOut,
  XCircle,
  CheckCircle,
  Lock,
} from 'lucide-react';

/**
 * Dedicated Waiting Room screen displayed to participants waiting for host approval.
 * Connects to the isolated Socket.IO waiting channel: waiting:${roomName}:${participantIdentity}
 * Receives real-time approval or rejection from the host.
 */
export const WaitingRoomScreen = ({
  roomName,
  participantName,
  participantIdentity,
  onApproved,
  onLeave,
}) => {
  // 'waiting' | 'approved' | 'rejected' | 'locked'
  const [status, setStatus] = useState('waiting');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!roomName || !participantIdentity) return;

    // Connect to Socket.IO as an isolated waiting participant (no LiveKit token or chat access)
    const socket = io('/', {
      auth: {
        isWaiting: true,
        participantIdentity,
        participantName,
        roomName,
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Relay Waiting Room] Connected to real-time notification channel');
    });

    socket.on('access:waiting_room_approved', data => {
      console.log('[Relay Waiting Room] Admission approved by host:', data);
      setStatus('approved');
      if (onApproved) {
        // Trigger auto-join
        setTimeout(() => {
          onApproved();
        }, 600);
      }
    });

    socket.on('access:waiting_room_rejected', () => {
      console.log('[Relay Waiting Room] Admission rejected by host');
      setStatus('rejected');
    });

    socket.on('access:meeting_locked_update', data => {
      if (data?.isLocked) {
        setStatus('locked');
      }
    });

    socket.on('connect_error', err => {
      console.warn('[Relay Waiting Room] Socket connection notice:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomName, participantIdentity, participantName, onApproved]);

  return (
    <div className="min-h-screen bg-relay-950 text-relay-100 flex flex-col justify-center items-center p-4 sm:p-6 bg-grid-subtle relative select-none">
      {/* Background ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[540px] h-[340px] bg-brand/15 blur-[150px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md bg-relay-900 border border-relay-700/80 rounded-2xl shadow-2xl p-6 sm:p-8 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Brand header */}
        <div className="flex items-center justify-between pb-5 border-b border-relay-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand to-ai flex items-center justify-center text-white shadow-md">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-base">Relay</span>
              <span className="text-[11px] text-relay-400 ml-2">Waiting Room</span>
            </div>
          </div>
          <Badge
            variant={status === 'approved' ? 'success' : status === 'rejected' ? 'danger' : 'brand'}
            size="sm"
            dot
            dotColor={
              status === 'approved'
                ? 'bg-emerald-400'
                : status === 'rejected'
                  ? 'bg-red-400'
                  : 'bg-brand-light'
            }
          >
            {status === 'approved'
              ? 'Admitted'
              : status === 'rejected'
                ? 'Declined'
                : status === 'locked'
                  ? 'Locked'
                  : 'In Queue'}
          </Badge>
        </div>

        {/* Content body based on status */}
        {status === 'waiting' && (
          <div className="py-6 flex flex-col items-center text-center space-y-4">
            {/* Animated Waiting Pulse */}
            <div className="relative flex items-center justify-center w-20 h-20 my-2">
              <div className="absolute inset-0 rounded-full bg-brand/20 animate-ping opacity-60" />
              <div className="absolute inset-2 rounded-full bg-brand/30 animate-pulse" />
              <div className="relative w-14 h-14 rounded-full bg-relay-800 border border-brand/50 flex items-center justify-center text-brand-light shadow-lg">
                <Clock className="w-7 h-7 text-brand-light animate-spin-slow" />
              </div>
            </div>

            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">
                Waiting for the host to let you in...
              </h2>
              <p className="text-xs text-relay-400 max-w-xs mx-auto leading-relaxed">
                The host has been notified that you are in the waiting room. Please hold on while they review your request.
              </p>
            </div>

            {/* Room and participant card */}
            <div className="w-full bg-relay-800/60 border border-relay-700/60 rounded-xl p-3 text-left space-y-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-relay-400">Meeting Room:</span>
                <span className="font-mono font-medium text-white">{roomName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-relay-400">Your Name:</span>
                <span className="font-medium text-relay-200">{participantName}</span>
              </div>
            </div>

            {/* Security note */}
            <div className="text-[11px] text-relay-500 pt-1">
              Audio, video, and meeting chat are strictly disabled until admission.
            </div>

            {/* Action buttons */}
            <div className="pt-3 w-full">
              <Button
                variant="ghost"
                size="md"
                onClick={onLeave}
                icon={LogOut}
                className="w-full border border-relay-700 hover:bg-relay-800"
              >
                Leave Waiting Room
              </Button>
            </div>
          </div>
        )}

        {status === 'approved' && (
          <div className="py-6 flex flex-col items-center text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Admission Approved!</h2>
              <p className="text-xs text-relay-400">Connecting you to the live meeting now...</p>
            </div>
          </div>
        )}

        {status === 'rejected' && (
          <div className="py-6 flex flex-col items-center text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-red-950/60 border border-red-500/40 flex items-center justify-center text-red-400">
              <XCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Admission Declined</h2>
              <p className="text-xs text-relay-400 max-w-xs mx-auto leading-relaxed">
                The host has declined your request to join <span className="font-mono text-relay-300">{roomName}</span>.
              </p>
            </div>
            <div className="pt-3 w-full">
              <Button
                variant="secondary"
                size="md"
                onClick={onLeave}
                className="w-full"
              >
                Return to Home
              </Button>
            </div>
          </div>
        )}

        {status === 'locked' && (
          <div className="py-6 flex flex-col items-center text-center space-y-4 animate-in fade-in">
            <div className="w-16 h-16 rounded-full bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Lock className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-white">Meeting Locked</h2>
              <p className="text-xs text-relay-400 max-w-xs mx-auto leading-relaxed">
                The host has locked this meeting. No new participants can enter at this time.
              </p>
            </div>
            <div className="pt-3 w-full">
              <Button
                variant="secondary"
                size="md"
                onClick={onLeave}
                className="w-full"
              >
                Return to Home
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
