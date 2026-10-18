import { useCallback, useEffect, useRef, useState } from 'react';
import type { PhotoRegion } from '../contracts';
import { cameraSupported, captureBurst, FRAME_ASPECT, startCamera, stopCamera } from './capture';
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
  const [state, setState] = useState<'idle' | 'starting' | 'live' | 'busy' | 'fallback'>(cameraSupported() ? 'idle' : 'fallback');

  useEffect(() => () => stopCamera(streamRef.current), []);

  const start = useCallback(async () => {
    setState('starting');
    try {
      const stream = await startCamera();
      streamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play();
      }
      setState('live');
    } catch {
      stopCamera(streamRef.current);
      streamRef.current = null;
      setState('fallback');
    }
  }, []);

  const take = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
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
          playsInline
          muted
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: showVideo ? 'block' : 'none' }}
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
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
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
        {state === 'fallback' && (
          <label style={{ ...btn, display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
            {CAMERA_COPY.upload}
            <input
              data-testid="photo-upload"
              type="file"
              accept="image/*"
              capture="environment"
              style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onCapture([f]);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}
