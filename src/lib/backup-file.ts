/**
 * Native file IO for backups: write to the cache directory and hand the file
 * to the share sheet, or read one back from the document picker.
 *
 * Split from `backup-file.web.ts` so the native file/sharing modules never
 * reach the web bundle — the same `.web.ts` resolution trick used for
 * purchases and notifications.
 */

import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { backupFilename, type Backup } from './backup';

export type SaveResult = { ok: boolean; message?: string };

export async function saveBackup(backup: Backup): Promise<SaveResult> {
  try {
    const file = new File(Paths.cache, backupFilename());
    // Overwrite rather than append if today's export already exists.
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(backup, null, 2));

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Sharing is not available on this device.' };
    }
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Save your OMADCoach backup',
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, message: e?.message ?? 'Could not write the backup file.' };
  }
}

/** Returns the file's text, or null if the user cancelled. */
export async function pickBackup(): Promise<string | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
  });
  if (res.canceled || !res.assets?.[0]?.uri) return null;
  return new File(res.assets[0].uri).text();
}
