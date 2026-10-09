// Simple on-device search over the recordings the app already loaded.
// Words are matched anywhere in the title, the date (month names in the app language and in English,
// the year, the day, the numeric date) and the transcript. Accents and capital letters are ignored.
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function monthNames(date, lang) {
  const out = [];
  for (const l of new Set([lang, 'en'])) {
    for (const month of ['long', 'short']) {
      try { out.push(new Intl.DateTimeFormat(l, { month }).format(date)); } catch { /* unknown language: skip */ }
    }
  }
  return out;
}

export function sessionHaystacks(s, lang) {
  const d = new Date(s.created_at);
  const date = [
    ...monthNames(d, lang),
    String(d.getFullYear()),
    String(d.getDate()),
    d.toLocaleDateString(lang),
    d.toISOString().slice(0, 10),
  ].join(' ');
  return {
    title: norm(s.name),
    date: norm(date),
    text: norm(`${s.raw_transcript || ''} ${s.translated_transcript || ''}`),
    rawText: `${s.raw_transcript || ''} ${s.translated_transcript || ''}`,
  };
}

// Every word typed must be found somewhere in the recording.
export function searchSessions(sessions, query, lang) {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return sessions.map((s) => ({ s, snippet: null }));
  const hits = [];
  for (const s of sessions) {
    const h = sessionHaystacks(s, lang);
    const all = `${h.title} ${h.date} ${h.text}`;
    if (!words.every((w) => all.includes(w))) continue;
    const inTitleOrDate = words.every((w) => h.title.includes(w) || h.date.includes(w));
    hits.push({ s, snippet: inTitleOrDate ? null : snippetFor(h.rawText, words), titleHit: words.some((w) => h.title.includes(w)) });
  }
  // Recordings whose title matches come first; otherwise newest first (the list is already newest first).
  return hits.sort((a, b) => Number(b.titleHit) - Number(a.titleHit));
}

// Lower-case, accent-free copy of a text, plus where each character came from in the original,
// so matches can be located (and highlighted) in the text the person actually sees.
function normMap(text) {
  let n = '';
  const map = [];
  let i = 0;
  for (const ch of String(text || '')) {
    const piece = norm(ch);
    for (let k = 0; k < piece.length; k++) map.push(i);
    n += piece;
    i += ch.length;
  }
  return { n, map };
}

// Pieces of `text` for display: [{ text, hit }], where hit pieces are what the person typed.
export function highlightParts(text, query) {
  const src = String(text || '');
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!src || !words.length) return [{ text: src, hit: false }];
  const { n, map } = normMap(src);
  const ranges = [];
  for (const w of words) {
    for (let at = n.indexOf(w); at !== -1; at = n.indexOf(w, at + w.length)) {
      const from = map[at];
      const to = map[at + w.length - 1] + 1;
      // the character before the end may be a surrogate pair or a letter with accent marks
      let end = to;
      while (end < src.length && /[\u0300-\u036f]/.test(src[end])) end++;
      ranges.push([from, end]);
    }
  }
  if (!ranges.length) return [{ text: src, hit: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for (const [a, b] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (a <= last[1]) last[1] = Math.max(last[1], b); else merged.push([a, b]);
  }
  const parts = [];
  let pos = 0;
  for (const [a, b] of merged) {
    if (a > pos) parts.push({ text: src.slice(pos, a), hit: false });
    parts.push({ text: src.slice(a, b), hit: true });
    pos = b;
  }
  if (pos < src.length) parts.push({ text: src.slice(pos), hit: false });
  return parts;
}

function snippetFor(raw, words) {
  const text = String(raw || '').replace(/\s+/g, ' ').trim();
  const { n, map } = normMap(text);
  let at = -1;
  for (const w of words) { at = n.indexOf(w); if (at !== -1) break; }
  if (at < 0) return null;
  const idx = map[at];
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + 70);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
