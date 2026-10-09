import { useRef, useState } from 'react';

const MIN = 0.12; // smallest crop, as a fraction of the photo

/**
 * A photo with a draggable crop frame. `crop` and `onChange` use fractions of the photo (0 to 1),
 * so the same numbers work at any screen size and on the full-resolution image.
 */
export default function CropBox({ src, alt, crop, onChange }) {
  const boxRef = useRef(null);
  const drag = useRef(null);
  const [active, setActive] = useState(false);

  function start(mode) {
    return (e) => {
      e.preventDefault();
      e.stopPropagation();
      const r = boxRef.current.getBoundingClientRect();
      drag.current = { mode, x: e.clientX, y: e.clientY, w: r.width, h: r.height, c: { ...crop } };
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setActive(true);
    };
  }

  function move(e) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.x) / d.w;
    const dy = (e.clientY - d.y) / d.h;
    let { x, y, w, h } = d.c;
    if (d.mode === 'move') {
      x = Math.min(1 - w, Math.max(0, x + dx));
      y = Math.min(1 - h, Math.max(0, y + dy));
    } else {
      let l = x, t = y, r = x + w, b = y + h;
      if (d.mode.includes('l')) l = Math.min(r - MIN, Math.max(0, l + dx));
      if (d.mode.includes('r')) r = Math.max(l + MIN, Math.min(1, r + dx));
      if (d.mode.includes('t')) t = Math.min(b - MIN, Math.max(0, t + dy));
      if (d.mode.includes('b')) b = Math.max(t + MIN, Math.min(1, b + dy));
      x = l; y = t; w = r - l; h = b - t;
    }
    onChange({ x, y, w, h });
  }

  function end() { drag.current = null; setActive(false); }

  const pct = (n) => `${n * 100}%`;
  return (
    <div className="crop-wrap">
      <div className="crop-box" ref={boxRef}>
        <img src={src} alt={alt} draggable={false} />
        <div
          className={`crop-frame ${active ? 'active' : ''}`}
          style={{ left: pct(crop.x), top: pct(crop.y), width: pct(crop.w), height: pct(crop.h) }}
          onPointerDown={start('move')}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {['tl', 'tr', 'bl', 'br'].map((h) => (
            <span
              key={h}
              className={`crop-handle ${h}`}
              onPointerDown={start(h)}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={end}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
