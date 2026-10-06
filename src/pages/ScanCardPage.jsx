import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { resizeImage, shrinkDataUrl } from '../lib/image.js';
import { useAiConsent } from '../components/AiConsent.jsx';

const GUIDE_RATIO = 1.65;   // card width / height
const CROP_MARGIN = 1.06;   // keep a little around the guide so edges are never cut off
const MAX_DIM = 1600;

// The framing rectangle, centred in the camera area (in CSS pixels).
function guideRect(cw, ch, portrait) {
  const ratio = portrait ? 1 / GUIDE_RATIO : GUIDE_RATIO;
  let w = cw * 0.9;
  let h = w / ratio;
  const maxH = ch * 0.78;
  if (h > maxH) { h = maxH; w = h * ratio; }
  return { x: (cw - w) / 2, y: (ch - h) / 2, w, h };
}

export default function ScanCardPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { ensureConsent } = useAiConsent();

  const [allowed, setAllowed] = useState(false);
  const firstPhoto = state?.firstPhoto || null;      // photo picked on the Cards page
  const [step, setStep] = useState(firstPhoto ? 'confirm' : 'capture'); // capture | confirm | summary
  const [side, setSide] = useState('front');         // which side is being captured
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [pending, setPending] = useState(firstPhoto);
  const [portrait, setPortrait] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [stage, setStage] = useState({ w: 0, h: 0 });
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');

  const videoRef = useRef(null);
  const stageRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);

  // Ask for permission to send data to AI services before the camera opens.
  useEffect(() => {
    let alive = true;
    ensureConsent().then((ok) => {
      if (!alive) return;
      if (ok) setAllowed(true); else navigate('/cards', { replace: true });
    });
    return () => { alive = false; };
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  // Open the camera while we are on the capture step.
  useEffect(() => {
    if (!allowed || step !== 'capture') return undefined;
    let cancelled = false;
    setCameraError('');
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('The camera is not available here. You can choose a photo instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      } catch {
        if (!cancelled) setCameraError('Could not open the camera. Check that camera access is allowed for Secretary in your phone settings, or choose a photo instead.');
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [allowed, step]);

  // Track the size of the camera area so the guide stays centred.
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const update = () => setStage({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [allowed, step]);

  function capture() {
    const v = videoRef.current;
    const box = stageRef.current;
    if (!v || !v.videoWidth || !box) return;
    const cw = box.clientWidth, ch = box.clientHeight;
    const g = guideRect(cw, ch, portrait);

    // The video fills the camera area edge to edge ("cover"), so map the guide back to video pixels.
    const scale = Math.max(cw / v.videoWidth, ch / v.videoHeight);
    const offX = (v.videoWidth * scale - cw) / 2;
    const offY = (v.videoHeight * scale - ch) / 2;
    const padW = (g.w * (CROP_MARGIN - 1)) / 2;
    const padH = (g.h * (CROP_MARGIN - 1)) / 2;
    let sx = (g.x - padW + offX) / scale;
    let sy = (g.y - padH + offY) / scale;
    let sw = (g.w + padW * 2) / scale;
    let sh = (g.h + padH * 2) / scale;
    sx = Math.max(0, sx); sy = Math.max(0, sy);
    sw = Math.min(v.videoWidth - sx, sw); sh = Math.min(v.videoHeight - sy, sh);

    const out = Math.min(1, MAX_DIM / Math.max(sw, sh));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(sw * out));
    canvas.height = Math.max(1, Math.round(sh * out));
    canvas.getContext('2d').drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    setPending(canvas.toDataURL('image/jpeg', 0.85));
    setStep('confirm');
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPending(await resizeImage(file, MAX_DIM, 0.85));
      setStep('confirm');
    } catch (err) {
      setCameraError(err.message);
    }
  }

  function usePhoto() {
    if (side === 'front') setFront(pending); else setBack(pending);
    setPending(null);
    setStep('summary');
  }

  function retake(which) {
    setSide(which);
    setPending(null);
    setStep('capture');
  }

  async function readCard() {
    setReading(true);
    setError('');
    try {
      const images = [front, back].filter(Boolean);
      const { card, duplicate } = await api.scanCard(images);
      const thumb = await shrinkDataUrl(front, 640, 0.6);
      const thumbBack = back ? await shrinkDataUrl(back, 640, 0.6) : null;
      navigate('/cards/new', { replace: true, state: { card, duplicate, thumb, thumbBack } });
    } catch (err) {
      setError(err.message || 'Could not read the card.');
      setReading(false);
    }
  }

  if (!allowed) return <div className="scan-screen scan-center"><p className="meta">Loading…</p></div>;

  const g = guideRect(stage.w, stage.h, portrait);
  const title = side === 'front' ? 'Front of card' : 'Back of card';

  return (
    <div className="scan-screen">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {step === 'capture' && (
        <>
          <div className="scan-top">
            <button type="button" className="scan-icon-btn" onClick={() => (front ? setStep('summary') : navigate('/cards'))} aria-label="Close">✕</button>
            <span className="scan-title">{title}</span>
            <button type="button" className={`scan-icon-btn ${portrait ? 'on' : ''}`} onClick={() => setPortrait((p) => !p)} aria-label="Switch frame between horizontal and vertical" title="Rotate frame">⟳</button>
          </div>

          <div className="scan-stage" ref={stageRef}>
            <video ref={videoRef} playsInline muted autoPlay className="scan-video" />
            {!cameraError && stage.w > 0 && (
              <div className="scan-guide" style={{ left: g.x, top: g.y, width: g.w, height: g.h }}>
                <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
              </div>
            )}
            {cameraError
              ? <p className="scan-hint scan-hint-error">{cameraError}</p>
              : <p className="scan-hint">Fit the card inside the frame</p>}
          </div>

          <div className="scan-bottom">
            <button type="button" className="scan-side-btn" onClick={() => fileRef.current?.click()}>Photos</button>
            <button type="button" className="scan-shutter" onClick={capture} disabled={!!cameraError} aria-label="Take photo" />
            <span className="scan-side-btn scan-spacer" />
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="scan-top"><span /><span className="scan-title">{title}</span><span /></div>
          <div className="scan-stage scan-review"><img src={pending} alt={`${title} preview`} /></div>
          <div className="scan-bottom">
            <button type="button" className="scan-side-btn" onClick={() => retake(side)}>Retake</button>
            <button type="button" className="scan-primary" onClick={usePhoto}>Use photo</button>
          </div>
        </>
      )}

      {step === 'summary' && (
        <>
          <div className="scan-top">
            <button type="button" className="scan-icon-btn" onClick={() => navigate('/cards')} aria-label="Cancel">✕</button>
            <span className="scan-title">Your card</span>
            <span />
          </div>
          <div className="scan-summary">
            <figure>
              <img src={front} alt="Front of card" />
              <figcaption>Front <button type="button" onClick={() => retake('front')}>Retake</button></figcaption>
            </figure>
            {back ? (
              <figure>
                <img src={back} alt="Back of card" />
                <figcaption>
                  Back <button type="button" onClick={() => retake('back')}>Retake</button>{' '}
                  <button type="button" onClick={() => setBack(null)}>Remove</button>
                </figcaption>
              </figure>
            ) : (
              <button type="button" className="scan-add-back" onClick={() => retake('back')}>+ Add the back of the card</button>
            )}
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="scan-bottom">
            <button type="button" className="scan-primary" onClick={readCard} disabled={reading}>
              {reading ? 'Reading card…' : 'Read card'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
