/**
 * Browser file IO for backups: a plain download and a file input.
 *
 * No dependencies — the DOM already does both, and this keeps the native
 * file-system modules out of the web bundle.
 */

import { backupFilename, type Backup } from './backup';

export type SaveResult = { ok: boolean; message?: string };

export async function saveBackup(backup: Backup): Promise<SaveResult> {
  try {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = backupFilename();
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoking immediately can cancel the download in some browsers.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Could not start the download.' };
  }
}

export async function pickBackup(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      file.text().then(resolve).catch(() => resolve(null));
    };
    // A cancelled picker fires no event in most browsers, so the promise simply
    // never settles — acceptable here, the screen stays interactive either way.
    input.click();
  });
}
