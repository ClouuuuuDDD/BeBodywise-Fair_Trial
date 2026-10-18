import { useCallback, useEffect, useRef, useState } from 'react';
import type { PhotoRegion } from '../contracts';
import { cameraSupported, captureBurst, FRAME_ASPECT, inAppBrowser, nextFrame, playVideo, startCamera, stopCamera } from './capture';
import { CAMERA_COPY } from './copy';
import { GUIDE_OVAL } from '../engine/config';

interface Props {
  site: PhotoRegion;
  /** Burst of frames (3 from the camera; 1 from the file input). Blobs stay on the device. */
  onCapture: (frames: Blob[]) => void;
}

const pct = (v: number): string => `${(v * 100).toFixed(2)}%`;

const btn = {
  minHeight: 48,
  minWidth: 44,
  padding: '0 24px',
  borderRadius: 999,
  border: 0,
  background: 'var(--primary)',
  color: '#fff',
  font: '700 var(--fs-body) var(--font-display)',
  cursor: 'pointer',
} as const;

/**
 * Camera with an oval guide and a CARD marker (screen 08 camera card). Rear camera via getUserMedia,
 * started on a tap; if unavailable or denied, a file input with capture="environment". Owner: E3.
 */
export function CameraCapture({ site, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'busy' | 'fallback'>(cameraSupported() ? 'idle' : 'fallback');
  // The browser refused to play the preview without a tap (Android in-app browsers, or the tap expired during the prompt).
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => () => stopCamera(streamRef.current), []);

  const start = useCallback(async () => {
    setState('starting');
    try {
      const stream = await startCamera();
      streamRef.current = stream;
      const v = videoRef.current;
      let playing = false;
      if (v) {
        v.srcObject = stream;
        // Some phones never settle play() on a video that is not shown yet; don't hang on "Starting camera…".
        playing = await Promise.race([playVideo(v), new Promise<boolean>((r) => setTimeout(() => r(!v.paused), 3000))]);
      }
      setState('live');
      setNeedsTap(!playing);
    } catch {
      stopCamera(streamRef.current);
      streamRef.current = null;
      setState('fallback');
    }
  }, []);

  // Coming back from the permission prompt or another app can leave the preview paused: start it again.
  useEffect(() => {
    if (state !== 'live') return;
    const resume = () => {
      const v = videoRef.current;
      if (document.visibilityState !== 'visible' || !v || !v.paused || !streamRef.current) return;
      void playVideo(v).then((ok) => setNeedsTap(!ok));
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [state]);

  const tapToStart = useCallback(async () => {
    const v = videoRef.current;
    if (v) setNeedsTap(!(await playVideo(v)));
  }, []);

  const take = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    // A paused preview is a frozen picture: start it from this tap, then measure fresh frames.
    if (v.paused && streamRef.current) {
      if (!(await playVideo(v))) {
        setNeedsTap(true);
        return;
      }
      setNeedsTap(false);
      await nextFrame(v);
    }
    // No frames (playback blocked): offer the photo chooser instead of a dead shutter.
    if (!v.videoWidth) {
      stopCamera(streamRef.current);
      streamRef.current = null;
      setState('fallback');
      return;
    }
    setState('busy');
    try {
      onCapture(await captureBurst(v));
      setState('live');
    } catch {
      setState('fallback');
    }
  }, [onCapture]);

  const o = GUIDE_OVAL;
  const showVideo = state === 'live' || state === 'busy';

  return (
    <div data-testid="camera-capture">
      <div
        style={{
          position: 'relative',
          aspectRatio: String(FRAME_ASPECT),
          // Never taller than about half the screen: the box narrows and stays 3:4, so the guide oval lines up.
          width: `min(100%, calc(var(--camera-max-h, 50dvh) * ${FRAME_ASPECT}))`,
          marginInline: 'auto',
          background: 'var(--ink-display)',
          borderRadius: 24,
          overflow: 'hidden',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          // Laid out but invisible until live (a display:none video won't play on iPhone Safari).
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: showVideo ? 1 : 0 }}
        />
        {state !== 'fallback' && (
          <>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: pct(o.cx - o.rx),
                top: pct(o.cy - o.ry),
                width: pct(o.rx * 2),
                height: pct(o.ry * 2),
                border: '3px dashed #fff',
                borderRadius: '50%',
              }}
            />
            <div
              aria-hidden
              style={{
                position: 'absolute',
                right: 12,
                bottom: 12,
                width: '26%',
                aspectRatio: '1.4',
                border: '3px solid #fff',
                borderRadius: 8,
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                font: '700 12px var(--font-display)',
                letterSpacing: '0.06em',
              }}
            >
              {CAMERA_COPY.card}
            </div>
            <p style={{ position: 'absolute', left: 12, right: 12, top: 12, margin: 0, color: '#fff', fontSize: 14 }}>
              {site === 'underarm' ? CAMERA_COPY.instrUnderarm : CAMERA_COPY.instrInner}
            </p>
          </>
        )}
        {state === 'live' && needsTap && (
          <button
            type="button"
            onClick={() => void tapToStart()}
            data-testid="camera-tap-start"
            style={{ position: 'absolute', inset: 0, zIndex: 2, width: '100%', border: 0, background: 'rgba(1, 39, 73, 0.55)', color: '#fff', font: '800 18px var(--font-display)', cursor: 'pointer' }}
          >
            {CAMERA_COPY.tapToStart}
          </button>
        )}
        {state === 'starting' && (
          <p role="status" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', margin: 0 }}>
            Starting camera…
          </p>
        )}
        {state === 'fallback' && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', color: '#fff' }}>
            <p style={{ margin: 0 }}>{CAMERA_COPY.noCamera}</p>
          </div>
        )}
      </div>
      <p style={{ color: 'var(--ink-muted)', fontSize: 14 }}>{CAMERA_COPY.cardTip}</p>
      {inAppBrowser() ? <p style={{ margin: '0 0 6px', color: 'var(--ink-soft)', fontSize: 13, fontWeight: 700 }}>{CAMERA_COPY.inApp}</p> : null}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {state === 'idle' && (
          <button type="button" style={btn} onClick={start} data-testid="primary">
            {CAMERA_COPY.primary}
          </button>
        )}
        {showVideo && (
          <button type="button" style={btn} onClick={take} disabled={state === 'busy'} data-testid="primary">
            {CAMERA_COPY.primary}
          </button>
        )}
        {state === 'fallback' ? (
          <button type="button" style={{ ...btn, flex: 1 }} onClick={() => fileRef.current?.click()}>
            {CAMERA_COPY.upload}
          </button>
        ) : state !== 'starting' ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={state === 'busy'}
            aria-label={CAMERA_COPY.uploadLabel}
            data-testid="upload-photo"
            style={{ ...btn, flex: 'none', padding: '0 18px', background: 'var(--surface)', color: 'var(--primary)', boxShadow: 'var(--shadow-chip)' }}
          >
            {CAMERA_COPY.uploadShort}
          </button>
        ) : null}
        {/* One picker for both: gallery, files or the phone's own camera app (no capture attribute, so she can choose). */}
        <input
          ref={fileRef}
          data-testid="photo-upload"
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-hidden="true"
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1, pointerEvents: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCapture([f]);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}
