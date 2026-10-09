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

function snippetFor(raw, words) {
  const text = raw.replace(/\s+/g, ' ').trim();
  const lower = norm(text);
  // norm() can change string length (accents), so only trust positions when the lengths match.
  if (lower.length !== text.length) return null;
  const idx = lower.indexOf(words.find((w) => lower.includes(w)) || '');
  if (idx < 0) return null;
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + 70);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}
