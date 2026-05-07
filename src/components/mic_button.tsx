'use client';

import { useEffect, useRef, useState } from 'react';

function mic_log(...args: unknown[]) {
  // Lightweight breadcrumbs for debugging voice input in Preview / production.
  // Prefix makes them easy to filter in devtools.
  console.log('[mic]', ...args);
}

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { isFinal: boolean; 0: SpeechRecognitionAlternative; length: number };
type SpeechRecognitionResultList = { length: number; [i: number]: SpeechRecognitionResult };
type SpeechRecognitionEvent = { resultIndex: number; results: SpeechRecognitionResultList };
type SpeechRecognitionErrorEvent = { error: string };

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function get_recognition_ctor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const error_messages: Record<string, string> = {
  'not-allowed': 'Microphone permission denied',
  'service-not-allowed': 'Microphone permission denied',
  'audio-capture': 'No microphone detected',
  'no-speech': 'No speech heard',
  'network': 'Network error',
};

type Phase = 'idle' | 'starting' | 'recording' | 'stopping';

interface Props {
  textarea_ref: React.RefObject<HTMLTextAreaElement | null>;
  value: string;
  on_change: (next: string) => void;
  lang?: string;
  className?: string;
}

export default function MicButton({ textarea_ref, value, on_change, lang = 'en-US', className }: Props) {
  const [supported, set_supported] = useState(false);
  const [phase, set_phase] = useState<Phase>('idle');
  const [status_text, set_status_text] = useState('');
  const [is_error, set_is_error] = useState(false);

  const recognition_ref = useRef<SpeechRecognitionInstance | null>(null);
  const value_ref = useRef(value);
  const on_change_ref = useRef(on_change);
  const wants_recording_ref = useRef(false);
  const cancelled_ref = useRef(false);
  const startup_watchdog_ref = useRef<number | null>(null);

  useEffect(() => { value_ref.current = value; }, [value]);
  useEffect(() => { on_change_ref.current = on_change; }, [on_change]);

  useEffect(() => {
    const ctor = get_recognition_ctor();
    const has_md = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
    const has_perms = typeof navigator !== 'undefined' && !!(navigator as Navigator & { permissions?: unknown }).permissions;
    let in_iframe: boolean | 'unknown' = 'unknown';
    if (typeof window !== 'undefined') {
      try { in_iframe = window.top !== window.self; } catch { in_iframe = true; }
    }
    let policy_allows: boolean | 'unknown' = 'unknown';
    try {
      const fp = (typeof document !== 'undefined'
        ? (document as Document & { featurePolicy?: { allowsFeature?: (n: string) => boolean } }).featurePolicy
        : undefined);
      if (fp?.allowsFeature) policy_allows = fp.allowsFeature('microphone');
    } catch { /* ignore */ }
    mic_log('feature detection:', {
      has_speech_recognition_ctor: !!ctor,
      has_SpeechRecognition: typeof window !== 'undefined' && 'SpeechRecognition' in window,
      has_webkitSpeechRecognition: typeof window !== 'undefined' && 'webkitSpeechRecognition' in window,
      has_getUserMedia: has_md,
      has_permissions_api: has_perms,
      is_secure_context: typeof window !== 'undefined' && window.isSecureContext,
      in_iframe,
      feature_policy_allows_microphone: policy_allows,
      origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
    if (!ctor) {
      set_supported(false);
      return;
    }
    set_supported(true);

    const recognition = new ctor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = lang;

    recognition.onstart = () => {
      mic_log('onstart fired');
      clear_watchdog();
      set_phase('recording');
      set_is_error(false);
      set_status_text('Listening');
    };

    recognition.onresult = (event) => {
      mic_log('onresult', { resultIndex: event.resultIndex, results_length: event.results.length });
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const transcript = result[0].transcript;
        insert_transcript(transcript);
      }
    };

    recognition.onerror = (event) => {
      mic_log('onerror', { error: event.error });
      clear_watchdog();
      const friendly = error_messages[event.error] ?? `Voice input error: ${event.error}`;
      set_status_text(friendly);
      set_is_error(true);
      wants_recording_ref.current = false;
      set_phase('idle');
    };

    recognition.onend = () => {
      mic_log('onend', { wants_recording: wants_recording_ref.current, cancelled: cancelled_ref.current });
      if (cancelled_ref.current) return;
      if (wants_recording_ref.current) {
        try {
          recognition.start();
        } catch (err) {
          mic_log('restart threw', err);
          if ((err as { name?: string }).name !== 'InvalidStateError') {
            wants_recording_ref.current = false;
            set_phase('idle');
            set_status_text('Voice input error');
            set_is_error(true);
          }
        }
      } else {
        set_phase('idle');
        set_status_text((prev) => (prev === 'Listening' ? '' : prev));
      }
    };

    recognition_ref.current = recognition;

    return () => {
      cancelled_ref.current = true;
      wants_recording_ref.current = false;
      clear_watchdog();
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onstart = null;
      try { recognition.abort(); } catch { /* ignore */ }
      recognition_ref.current = null;
    };
  }, [lang]);

  function clear_watchdog() {
    if (startup_watchdog_ref.current !== null) {
      window.clearTimeout(startup_watchdog_ref.current);
      startup_watchdog_ref.current = null;
    }
  }

  function insert_transcript(transcript: string) {
    const current = value_ref.current;
    const ta = textarea_ref.current;

    let start = current.length;
    let end = current.length;
    if (ta) {
      const s = ta.selectionStart;
      const e = ta.selectionEnd;
      if (typeof s === 'number' && typeof e === 'number' && s >= 0 && e >= s && e <= current.length) {
        start = s;
        end = e;
      }
    }

    const before = current.slice(0, start);
    const after = current.slice(end);

    let inserted = transcript;
    const prev_char = before.slice(-1);
    if (prev_char && !/\s/.test(prev_char) && !/^\s/.test(inserted)) {
      inserted = ' ' + inserted;
    }
    const next_char = after.slice(0, 1);
    if (next_char && !/\s/.test(next_char) && !/\s$/.test(inserted)) {
      inserted = inserted + ' ';
    }

    const next_value = before + inserted + after;
    value_ref.current = next_value;
    on_change_ref.current(next_value);

    const caret = (before + inserted).length;
    requestAnimationFrame(() => {
      const ta_now = textarea_ref.current;
      if (ta_now) {
        try { ta_now.setSelectionRange(caret, caret); } catch { /* ignore */ }
      }
    });
  }

  async function handle_click() {
    mic_log('click', { supported, phase, has_recognition: !!recognition_ref.current });
    if (!supported) return;
    if (phase === 'starting' || phase === 'stopping') return;

    const recognition = recognition_ref.current;
    if (!recognition) {
      set_status_text('Voice input not initialized');
      set_is_error(true);
      return;
    }

    if (phase === 'recording') {
      wants_recording_ref.current = false;
      set_phase('stopping');
      try { recognition.stop(); } catch { /* ignore */ }
      return;
    }

    if (phase !== 'idle') return;

    set_phase('starting');
    set_status_text('');
    set_is_error(false);

    // Diagnostic only: log the pre-flight permission state, but DO NOT gate
    // on it. Some environments (Permissions-Policy, stale browser state)
    // report 'denied' even when an actual call would succeed or surface the
    // prompt. We let getUserMedia be the source of truth.
    const pre_state = await query_mic_permission();
    mic_log('pre-flight permission state', pre_state);

    if (!navigator.mediaDevices?.getUserMedia) {
      mic_log('getUserMedia unavailable');
      set_phase('idle');
      set_status_text('Voice input unavailable in this browser.');
      set_is_error(true);
      return;
    }

    // Always call getUserMedia. On a fresh profile this triggers the actual
    // browser permission prompt. On a previously-denied origin it rejects
    // immediately with NotAllowedError and we use permissions.query AFTER
    // the rejection to distinguish "user just dismissed/denied" from
    // "browser-level block".
    let stream: MediaStream;
    try {
      mic_log('calling getUserMedia({ audio: true })');
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mic_log('getUserMedia granted');
    } catch (err) {
      const name = (err as DOMException).name;
      const message = (err as Error).message;
      mic_log('getUserMedia rejected', { name, message });
      set_phase('idle');
      set_is_error(true);

      if (name === 'NotAllowedError' || name === 'SecurityError') {
        // Disambiguate via permissions.query. If state is now 'denied', the
        // origin is blocked at the browser level (sticky); the user must
        // reset it manually. If still 'prompt', they dismissed without a
        // permanent decision — clicking again may show the prompt again.
        const post_state = await query_mic_permission();
        mic_log('post-rejection permission state', post_state);
        if (post_state === 'denied') {
          set_status_text('Mic is blocked at the browser level. Click the address-bar lock icon → reset Microphone → reload.');
        } else {
          set_status_text('Permission not granted. Click the mic again to retry.');
        }
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        set_status_text('No microphone detected.');
      } else if (name === 'NotReadableError') {
        set_status_text('Microphone is in use by another app.');
      } else {
        set_status_text(`Microphone error: ${name || message || 'unknown'}`);
      }
      return;
    }

    // We don't need the stream — SpeechRecognition manages its own audio.
    // Releasing tracks promptly avoids leaving the browser's mic indicator on
    // longer than necessary.
    stream.getTracks().forEach((t) => { try { t.stop(); } catch { /* ignore */ } });

    // Step 3: now start recognition. Permission is granted at this point;
    // start() should fire onstart shortly. The watchdog catches the rare case
    // where neither onstart nor onerror fires.
    wants_recording_ref.current = true;
    try {
      mic_log('calling recognition.start()');
      recognition.start();
      mic_log('recognition.start() returned');
      clear_watchdog();
      startup_watchdog_ref.current = window.setTimeout(() => {
        mic_log('startup watchdog fired — no onstart/onerror within 3s');
        wants_recording_ref.current = false;
        set_phase('idle');
        set_status_text('Mic did not start. Try again, or reload the page.');
        set_is_error(true);
      }, 3000);
    } catch (err) {
      mic_log('start() threw', err);
      wants_recording_ref.current = false;
      set_phase('idle');
      set_status_text(`Voice input error: ${(err as Error).message ?? 'unknown'}`);
      set_is_error(true);
    }
  }

  async function query_mic_permission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
    type PermsLike = { query: (d: { name: string }) => Promise<{ state: string }> };
    const perms = (navigator as Navigator & { permissions?: PermsLike }).permissions;
    if (!perms?.query) return 'unknown';
    try {
      const result = await perms.query({ name: 'microphone' });
      const state = result.state;
      if (state === 'granted' || state === 'denied' || state === 'prompt') return state;
      return 'unknown';
    } catch (err) {
      mic_log('permissions.query threw', err);
      return 'unknown';
    }
  }

  const recording = phase === 'recording' || phase === 'starting';
  const base_class = 'p-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:opacity-40 disabled:cursor-not-allowed';
  const color_class = recording
    ? 'text-red-400 animate-pulse'
    : 'text-gray-400 hover:text-cyan-400';
  const merged_class = [base_class, color_class, className].filter(Boolean).join(' ');

  const title = !supported
    ? 'Voice input needs Chrome or Edge'
    : recording
      ? 'Stop voice input'
      : 'Start voice input';

  // Show status text visibly when it's an error or a non-listening message,
  // so silent failures (permission denied, Permissions-Policy block, etc.) are
  // never invisible. "Listening" stays visual-only via the red-pulse mic.
  const visible_status = is_error ? status_text : '';
  const visible_status_class = 'text-xs text-red-400 leading-tight';

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={handle_click}
        disabled={!supported}
        title={title}
        aria-label={recording ? 'Stop voice input' : 'Start voice input'}
        aria-pressed={recording}
        className={merged_class}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
          aria-hidden="true"
        >
          <rect x="9" y="3" width="6" height="12" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="8" y1="22" x2="16" y2="22" />
        </svg>
      </button>
      {visible_status && (
        <span className={visible_status_class} title={visible_status}>
          {visible_status}
        </span>
      )}
      <span role="status" aria-live="polite" className="sr-only">
        {status_text}
      </span>
    </span>
  );
}
