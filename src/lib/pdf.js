import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Builds a PDF by drawing the text on canvas pages (so every language and script prints correctly,
// including Arabic, Hindi, Japanese) and wrapping the pages as JPEG images in a minimal PDF file.
const W = 1240, H = 1754, M = 100; // A4 at ~150 dpi
const RTL = /[֐-ࣿ]/;

function wrapLines(ctx, text, maxWidth) {
  const out = [];
  for (const para of String(text || '').split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    // Split on spaces; CJK has no spaces, so also allow a break between any two characters of that kind.
    const tokens = para.match(/[぀-ヿ㐀-鿿가-힯]|[^\s぀-ヿ㐀-鿿가-힯]+\s*|\s+/g) || [para];
    let line = '';
    for (const tok of tokens) {
      const test = line + tok;
      if (ctx.measureText(test).width > maxWidth && line) { out.push(line.trimEnd()); line = tok.trimStart(); }
      else line = test;
    }
    if (line) out.push(line.trimEnd());
  }
  return out;
}

/** blocks: [{ type: 'title'|'h1'|'h2'|'meta'|'text', text }] */
async function renderPages(blocks) {
  const styles = {
    title: { size: 54, weight: '700', color: '#0f172a', gap: 30 },
    h1: { size: 40, weight: '700', color: '#0f172a', gap: 20 },
    h2: { size: 30, weight: '700', color: '#0d7377', gap: 12 },
    meta: { size: 24, weight: '400', color: '#64748b', gap: 14 },
    text: { size: 28, weight: '400', color: '#1e293b', gap: 8 },
  };
  const pages = [];
  let canvas, ctx, y;
  const newPage = () => {
    canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    y = M; pages.push(canvas);
  };
  newPage();
  for (const b of blocks) {
    if (b.type === 'break') { if (y > M) newPage(); continue; }
    const s = styles[b.type] || styles.text;
    const lineH = Math.round(s.size * 1.4);
    ctx.font = `${s.weight} ${s.size}px -apple-system, "Helvetica Neue", Arial, "Noto Sans", sans-serif`;
    ctx.fillStyle = s.color;
    ctx.textBaseline = 'top';
    for (const line of wrapLines(ctx, b.text, W - 2 * M)) {
      if (y + lineH > H - M) {
        newPage();
        ctx.font = `${s.weight} ${s.size}px -apple-system, "Helvetica Neue", Arial, "Noto Sans", sans-serif`;
        ctx.fillStyle = s.color; ctx.textBaseline = 'top';
      }
      const rtl = RTL.test(line); // direction is decided line by line so mixed-language text lays out correctly
      ctx.direction = rtl ? 'rtl' : 'ltr';
      ctx.textAlign = rtl ? 'right' : 'left';
      ctx.fillText(line, rtl ? W - M : M, y);
      y += lineH;
    }
    y += s.gap;
  }
  return pages;
}

async function pagesToPdfBytes(pages) {
  const enc = new TextEncoder();
  const parts = []; const offsets = []; let len = 0;
  const push = (data) => { const b = typeof data === 'string' ? enc.encode(data) : data; parts.push(b); len += b.length; };
  const obj = (n, body) => { offsets[n] = len; push(`${n} 0 obj\n`); push(body); push('\nendobj\n'); };
  const jpegs = [];
  for (const c of pages) {
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.85));
    jpegs.push(new Uint8Array(await blob.arrayBuffer()));
  }
  const n = pages.length;
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
  for (let i = 0; i < n; i++) {
    const page = 3 + i * 3, img = page + 1, content = page + 2;
    obj(page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${img} 0 R >> >> /Contents ${content} 0 R >>`);
    offsets[img] = len;
    push(`${img} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegs[i].length} >>\nstream\n`);
    push(jpegs[i]); push('\nendstream\nendobj\n');
    const stream = 'q 595 0 0 842 0 0 cm /Im0 Do Q';
    obj(content, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  }
  const xref = len;
  const total = 3 + n * 3;
  push(`xref\n0 ${total}\n0000000000 65535 f \n`);
  for (let i = 1; i < total; i++) push(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  const out = new Uint8Array(len); let p = 0;
  for (const b of parts) { out.set(b, p); p += b.length; }
  return out;
}

function toBase64(bytes) {
  let bin = ''; const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  return btoa(bin);
}

/** Creates the PDF and hands it to the share sheet (iPhone) or downloads it (browser). */
export async function exportPdf(fileTitle, blocks) {
  const bytes = await pagesToPdfBytes(await renderPages(blocks));
  const safe = (fileTitle || 'export').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'export';
  const fileName = `${safe}.pdf`;
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: fileName, data: toBase64(bytes), directory: Directory.Cache });
    await Share.share({ title: safe, url: uri });
    return;
  }
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
