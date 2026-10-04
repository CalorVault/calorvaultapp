import * as WebBrowser from 'expo-web-browser';
import { colors } from '../theme';

// CalorVault's public Featurebase board, where users post ideas and bug
// reports, vote, and read the changelog.
export const FEEDBACK_BOARD_URL = 'https://calorvault.featurebase.app';

// Opens a page of the board in a sheet over the app (Safari view on iOS).
export function openFeedbackBoard(path: '' | '/changelog' = '') {
  return WebBrowser.openBrowserAsync(`${FEEDBACK_BOARD_URL}${path}`, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: colors.accent,
    dismissButtonStyle: 'done',
  });
}
