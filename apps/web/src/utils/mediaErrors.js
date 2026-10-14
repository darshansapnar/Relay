/**
 * Helpers for turning LiveKit/getUserMedia media-device failures into
 * user-friendly text, and for telling a device failure (camera/mic
 * permission, missing hardware, device-in-use) apart from a fatal LiveKit
 * connection failure (bad token, unreachable server, etc).
 */

// DOMException names getUserMedia()/getDisplayMedia() can throw. Anything
// else caught by LiveKitRoom's onError is treated as a real connection error.
const MEDIA_DEVICE_ERROR_NAMES = new Set([
  'NotAllowedError',
  'PermissionDeniedError',
  'NotFoundError',
  'DevicesNotFoundError',
  'NotReadableError',
  'TrackStartError',
  'OverconstrainedError',
  'AbortError',
  'SecurityError',
]);

export function isMediaDeviceError(error) {
  return Boolean(error && MEDIA_DEVICE_ERROR_NAMES.has(error.name));
}

function deviceLabel(kind) {
  if (kind === 'videoinput') return 'camera';
  if (kind === 'audioinput') return 'microphone';
  return 'device';
}

/**
 * Builds a friendly message from LiveKit's `MediaDeviceFailure` enum value
 * ('PermissionDenied' | 'NotFound' | 'DeviceInUse' | 'Other', as delivered by
 * LiveKitRoom's `onMediaDeviceFailure` prop) and the affected device kind
 * ('videoinput' | 'audioinput' | undefined).
 */
export function describeMediaDeviceFailure(failure, kind) {
  const label = deviceLabel(kind);
  switch (failure) {
    case 'PermissionDenied':
      return `${capitalize(label)} access was denied. Allow ${label} access for this site in your browser settings, then try again.`;
    case 'NotFound':
      return `No ${label} was found. Connect a ${label} and try again.`;
    case 'DeviceInUse':
      return `Your ${label} could not be started — it looks like it's already in use by another app or browser tab. Close anything else using the ${label} and try again.`;
    default:
      return `Your ${label} could not be started. Check your browser's site permissions and try again.`;
  }
}

function capitalize(word) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}
