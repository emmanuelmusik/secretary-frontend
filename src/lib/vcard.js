import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

const esc = (v) => String(v ?? '')
  .replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\;');

export function cardToVCard(c) {
  const name = (c.name || '').trim();
  const parts = name.split(/\s+/);
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const first = parts.length > 1 ? parts.slice(0, -1).join(' ') : name;
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(last)};${esc(first)};;;`,
    `FN:${esc(name || c.company || 'Contact')}`,
  ];
  if (c.company) lines.push(`ORG:${esc(c.company)}`);
  if (c.job_title) lines.push(`TITLE:${esc(c.job_title)}`);
  (c.phones || []).forEach((p) => lines.push(`TEL;TYPE=WORK:${esc(p)}`));
  (c.emails || []).forEach((e) => lines.push(`EMAIL;TYPE=WORK:${esc(e)}`));
  if (c.website) lines.push(`URL:${esc(c.website)}`);
  if (c.address) lines.push(`ADR;TYPE=WORK:;;${esc(c.address)};;;;`);
  if (c.notes) lines.push(`NOTE:${esc(c.notes)}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

/** Opens the share sheet with a .vcf file so the person can add it to Contacts. */
export async function shareVCard(card) {
  const vcf = cardToVCard(card);
  const base = (card.name || card.company || 'contact').replace(/[^\w\- ]+/g, '').trim() || 'contact';
  const fileName = `${base}.vcf`;

  if (Capacitor.isNativePlatform()) {
    await Filesystem.writeFile({ path: fileName, data: vcf, directory: Directory.Cache, encoding: Encoding.UTF8 });
    const { uri } = await Filesystem.getUri({ path: fileName, directory: Directory.Cache });
    await Share.share({ title: base, url: uri });
    return;
  }

  const blob = new Blob([vcf], { type: 'text/vcard' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
