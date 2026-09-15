import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Everything under the app's own key prefix except the two API keys --
// those are secrets the user typed in, not app data, and shouldn't end up
// in a file they might share or upload somewhere.
const EXCLUDED_KEYS = new Set(['kailo:apiKey', 'kailo:recipeApiKey']);

export async function buildBackupJson(): Promise<string> {
  const allKeys = await AsyncStorage.getAllKeys();
  const kailoKeys = allKeys.filter((k) => k.startsWith('kailo:') && !EXCLUDED_KEYS.has(k));
  const entries = await AsyncStorage.getMany(kailoKeys);

  const data: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entries)) {
    if (value == null) continue;
    try {
      data[key] = JSON.parse(value);
    } catch {
      data[key] = value;
    }
  }

  return JSON.stringify({ app: 'CalorVault', exportedAt: new Date().toISOString(), data }, null, 2);
}

export class ExportError extends Error {}

export async function exportBackup(): Promise<void> {
  const json = await buildBackupJson();
  const filename = `calorvault-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (Platform.OS === 'web') {
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(json);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new ExportError('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export CalorVault data',
  });
}
