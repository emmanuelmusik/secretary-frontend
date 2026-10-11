import { useEffect, useRef, useState } from 'react';

// A ⋮ menu for a list row (recording or note). `items`: [{ label, onClick, danger? }]. Safe to put inside a link.
export default function RowMenu({ items, label }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  function stop(e) { e.preventDefault(); e.stopPropagation(); }

  return (
    <span className="folder-menu row-menu" ref={ref} onClick={stop}>
      <button type="button" className="folder-menu-btn" aria-label={label} aria-expanded={open} onClick={(e) => { stop(e); setOpen((o) => !o); }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></svg>
      </button>
      {open && (
        <div className="folder-menu-pop" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={it.danger ? 'danger' : ''} onClick={(e) => { stop(e); setOpen(false); it.onClick(); }}>{it.label}</button>
          ))}
        </div>
      )}
    </span>
  );
}
