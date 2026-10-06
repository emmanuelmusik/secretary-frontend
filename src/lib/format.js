// "1h 05m" style text from seconds, using the translated unit keys.
export function formatSeconds(t, seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? t('duration.hm', { h, m }) : t('duration.m', { m });
}
