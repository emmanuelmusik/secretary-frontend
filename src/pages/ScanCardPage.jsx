import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { resizeImage, shrinkDataUrl, cropDataUrl } from '../lib/image.js';
import CropBox from '../components/CropBox.jsx';
import { useAiConsent } from '../components/AiConsent.jsx';
import { useI18n } from '../i18n/index.jsx';

const GUIDE_RATIO = 1.65;   // card width / height
const CROP_MARGIN = 1.06;   // keep a little around the guide so edges are never cut off
const MAX_DIM = 1600;
const FULL = { x: 0, y: 0, w: 1, h: 1 };

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
  const { t } = useI18n();
  const { ensureConsent } = useAiConsent();

  const [allowed, setAllowed] = useState(false);
  const firstPhoto = state?.firstPhoto || null;      // photo picked on the Cards page
  const [step, setStep] = useState(firstPhoto ? 'confirm' : 'capture'); // capture | confirm | summary
  const [side, setSide] = useState('front');         // which side is being captured
  const [front, setFront] = useState(null);
  const [back, setBack] = useState(null);
  const [pending, setPending] = useState(firstPhoto);
  const [crop, setCrop] = useState(FULL);            // adjustable crop of the photo just taken
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
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  }

  // Open the camera while we are on the capture step.
  useEffect(() => {
    if (!allowed || step !== 'capture') return undefined;
    let cancelled = false;
    setCameraError('');
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError(t('scan.err_nocam'));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((tr) => tr.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) { v.srcObject = stream; await v.play().catch(() => {}); }
      } catch {
        if (!cancelled) setCameraError(t('scan.err_cam'));
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
    setCrop(FULL);
    setPending(canvas.toDataURL('image/jpeg', 0.85));
    setStep('confirm');
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setCrop(FULL);
      setPending(await resizeImage(file, MAX_DIM, 0.85));
      setStep('confirm');
    } catch (err) {
      setCameraError(err.message);
    }
  }

  async function usePhoto() {
    const untouched = crop.x < 0.005 && crop.y < 0.005 && crop.w > 0.99 && crop.h > 0.99;
    let photo = pending;
    if (!untouched) {
      try { photo = await cropDataUrl(pending, crop); } catch { photo = pending; }
    }
    if (side === 'front') setFront(photo); else setBack(photo);
    setCrop(FULL);
    setPending(null);
    setStep('summary');
  }

  function retake(which) {
    setCrop(FULL);
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
      setError(err.message || t('scan.err_read'));
      setReading(false);
    }
  }

  if (!allowed) return <div className="scan-screen scan-center"><p className="meta">{t('common.loading')}</p></div>;

  const g = guideRect(stage.w, stage.h, portrait);
  const title = side === 'front' ? t('scan.front') : t('scan.back');

  return (
    <div className="scan-screen">
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {step === 'capture' && (
        <>
          <div className="scan-top">
            <button type="button" className="scan-icon-btn" onClick={() => (front ? setStep('summary') : navigate('/cards'))} aria-label={t('scan.close')}>✕</button>
            <span className="scan-title">{title}</span>
            <button type="button" className={`scan-icon-btn ${portrait ? 'on' : ''}`} onClick={() => setPortrait((p) => !p)} aria-label={t('scan.rotate')} title={t('scan.rotate')}>⟳</button>
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
              : <p className="scan-hint">{t('scan.hint')}</p>}
          </div>

          <div className="scan-bottom">
            <button type="button" className="scan-side-btn" onClick={() => fileRef.current?.click()}>{t('scan.photos')}</button>
            <button type="button" className="scan-shutter" onClick={capture} disabled={!!cameraError} aria-label={t('scan.take')} />
            <span className="scan-side-btn scan-spacer" />
          </div>
        </>
      )}

      {step === 'confirm' && (
        <>
          <div className="scan-top"><span /><span className="scan-title">{title}</span><span /></div>
          <div className="scan-stage scan-review">
            <CropBox src={pending} alt={title} crop={crop} onChange={setCrop} />
            <p className="scan-hint">{t('scan.crop_hint')}</p>
          </div>
          <div className="scan-bottom">
            <button type="button" className="scan-side-btn" onClick={() => retake(side)}>{t('scan.retake')}</button>
            <button type="button" className="scan-primary" onClick={usePhoto}>{t('scan.use')}</button>
          </div>
        </>
      )}

      {step === 'summary' && (
        <>
          <div className="scan-top">
            <button type="button" className="scan-icon-btn" onClick={() => navigate('/cards')} aria-label={t('common.cancel')}>✕</button>
            <span className="scan-title">{t('scan.your_card')}</span>
            <span />
          </div>
          <div className="scan-summary">
            <figure>
              <img src={front} alt={t('scan.front')} />
              <figcaption>{t('scan.front')} <button type="button" onClick={() => retake('front')}>{t('scan.retake')}</button></figcaption>
            </figure>
            {back ? (
              <figure>
                <img src={back} alt={t('scan.back')} />
                <figcaption>
                  {t('scan.back')} <button type="button" onClick={() => retake('back')}>{t('scan.retake')}</button>{' '}
                  <button type="button" onClick={() => setBack(null)}>{t('scan.remove')}</button>
                </figcaption>
              </figure>
            ) : (
              <button type="button" className="scan-add-back" onClick={() => retake('back')}>{t('scan.add_back')}</button>
            )}
            {error && <p className="form-error">{error}</p>}
          </div>
          <div className="scan-bottom">
            <button type="button" className="scan-primary" onClick={readCard} disabled={reading}>
              {reading ? t('scan.reading') : t('scan.read')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
