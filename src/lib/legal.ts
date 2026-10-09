import * as WebBrowser from 'expo-web-browser';
import { colors } from '../theme';

// CalorVault's privacy policy (a published Google Doc owned by the support
// account) and Apple's standard licence agreement, which the App Store uses as
// the terms of use for apps that don't have their own.
export const PRIVACY_POLICY_URL =
  'https://docs.google.com/document/d/e/2PACX-1vS8-6u495c4ckBne34wtmb-nSO-dqQ2OMnUd1r3ClbEJ8Qudr-gmfPvjXquNXLIxsHvi9mne6cBGK3q/pub';
export const TERMS_OF_USE_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

export function openLegalPage(url: string) {
  return WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: colors.accent,
    dismissButtonStyle: 'done',
  });
}
