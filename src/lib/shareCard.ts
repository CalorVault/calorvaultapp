import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

export class ShareCardError extends Error {}

export async function captureAndShareCard(ref: React.RefObject<any>): Promise<void> {
  if (Platform.OS === 'web') {
    const dataUri = await captureRef(ref, { format: 'png', quality: 1, result: 'data-uri' });
    const res = await fetch(dataUri);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calorvault-day.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  const uri = await captureRef(ref, { format: 'png', quality: 1 });
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new ShareCardError('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Share your day' });
}
