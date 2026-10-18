import { useEffect, useRef, useState, type ReactNode } from 'react';
import { inAppBrowser, nextFrame, playVideo } from '../../../photo/capture';
import { add } from '../copy';
import styles from './CameraCard.module.css';

type CameraState = 'starting' | 'live' | 'unavailable';

export interface CameraCardProps {
  /** Called with the photo (a camera frame, or the file she chose). */
  onPhoto: (photo: Blob) => void;
  /** Disable the shutter and the chooser (while a read is running). */
  busy?: boolean;
  /** Which side of the pack this is, for the screen reader. */
  label: string;
  /** Text shown over the card after a capture ("Got it. Hold still."). */
  captured?: boolean;
  /** Drawn between the card and the shutter (Dr. Mehr's tip). */
  children?: ReactNode;
}

/**
 * The dark camera card on 04a: live preview with corner guides and a shutter, or a photo chooser when the camera is
 * denied or missing (data-testid="photo-upload"). Label photos only: it shows a bottle, never her body.
 */
export function CameraCard({ onPhoto, busy, label, captured, children }: CameraCardProps) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<CameraState>('starting');
  // The browser refused to play the preview without a tap (Android in-app browsers, some Chrome cases).
  const [needsTap, setNeedsTap] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('no camera api');
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        // The <video> is always mounted, so the stream can be attached the moment it arrives.
        const v = video.current;
        let playing = false;
        if (v) {
          v.srcObject = media;
          playing = await playVideo(v);
        }
        if (cancelled) return;
        setState('live');
        setNeedsTap(!playing);
      } catch {
        if (!cancelled) setState('unavailable');
      }
    }
    void start();
    return () => {
      cancelled = true;
      stream.current?.getTracks().forEach((t) => t.stop());
      stream.current = null;
    };
  }, []);

  // Coming back from the permission prompt or another app can leave the preview paused: start it again.
  useEffect(() => {
    if (state !== 'live') return;
    const resume = () => {
      const v = video.current;
      if (document.visibilityState !== 'visible' || !v || !v.paused || !stream.current) return;
      void playVideo(v).then((ok) => setNeedsTap(!ok));
    };
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('focus', resume);
    return () => {
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('focus', resume);
    };
  }, [state]);

  async function tapToStart() {
    const v = video.current;
    if (!v) return;
    setNeedsTap(!(await playVideo(v)));
  }

  async function shoot() {
    const v = video.current;
    if (busy) return;
    // A paused preview is a frozen picture: start it from this tap and take a fresh frame.
    if (v && stream.current && v.paused) {
      if (!(await playVideo(v))) {
        setNeedsTap(true);
        return;
      }
      setNeedsTap(false);
      await nextFrame(v);
    }
    // No frames yet (camera still warming up, or the browser blocked playback): never a dead tap.
    if (!v || !v.videoWidth) {
      file.current?.click();
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob((blob) => blob && onPhoto(blob), 'image/jpeg', 0.9);
  }

  function chosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f && !busy) onPhoto(f);
  }

  return (
    <>
      <div className={styles.card} role="group" aria-label={label}>
        <video
          ref={video}
          className={styles.video}
          style={state === 'live' ? undefined : { opacity: 0 }}
          autoPlay
          playsInline
          muted
          aria-hidden="true"
        />
        {state === 'starting' ? <span className={styles.spinner} role="status" aria-label="One moment…" /> : null}
        {state === 'live' && needsTap ? (
          <button type="button" className={styles.tapStart} onClick={() => void tapToStart()} data-testid="camera-tap-start">
            {add.tapToStart}
          </button>
        ) : null}
        {state === 'unavailable' ? (
          <div className={styles.fallback}>
            <p>{add.denied}</p>
            <button type="button" className={styles.choose} onClick={() => file.current?.click()} disabled={busy}>
              Choose a photo
            </button>
          </div>
        ) : null}
        <span className={`${styles.corner} ${styles.tl}`} />
        <span className={`${styles.corner} ${styles.tr}`} />
        <span className={`${styles.corner} ${styles.bl}`} />
        <span className={`${styles.corner} ${styles.br}`} />
        {captured ? <span className={styles.tip}>{add.captured}</span> : null}
      </div>
      {children}
      {inAppBrowser() ? <p className={styles.inApp}>{add.inApp}</p> : null}
      <input
        ref={file}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.input}
        data-testid="photo-upload"
        aria-label={add.take}
        tabIndex={-1}
        onChange={chosen}
      />
      <div className={styles.shutterRow}>
        <button
          type="button"
          className={styles.shutter}
          aria-label={add.take}
          data-testid="shutter"
          disabled={busy}
          aria-disabled={busy || undefined}
          onClick={state === 'live' ? () => void shoot() : () => file.current?.click()}
        >
          <span />
        </button>
      </div>
    </>
  );
}
