// Copies text to the clipboard. Uses the async Clipboard API when available
// and falls back to a hidden textarea for older WebViews.
export async function copyText(text) {
  const value = text ?? '';
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

// Plain-text version of an insight, for the "copy all" button.
export function insightToText(a, t = (k) => k) {
  if (!a) return '';
  const list = (items) => (items || []).map((x) => `- ${x}`).join('\n');
  const parts = [];
  if (a.summary) parts.push(`${t('insight.summary').toUpperCase()}\n${a.summary}`);
  if (a.key_points?.length) parts.push(`${t('insight.key_points').toUpperCase()}\n${list(a.key_points)}`);
  if (a.action_items?.length) {
    parts.push(`${t('insight.action_items').toUpperCase()}\n${a.action_items
      .map((i) => `- ${i.item}${i.owner ? ` — ${i.owner}` : ''}${i.due ? ` (${i.due})` : ''}`)
      .join('\n')}`);
  }
  if (a.decisions?.length) parts.push(`${t('insight.decisions').toUpperCase()}\n${list(a.decisions)}`);
  if (a.quotes?.length) {
    parts.push(`${t('insight.quotes').toUpperCase()}\n${a.quotes
      .map((q) => `- "${q.quote}"${q.speaker ? ` — ${q.speaker}` : ''}`)
      .join('\n')}`);
  }
  if (a.questions_raised?.length) parts.push(`${t('insight.questions').toUpperCase()}\n${list(a.questions_raised)}`);
  return parts.join('\n\n');
}
