import { useCallback, useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { LanguageCode } from '../i18n/languages';
import { deviceLanguage } from '../lib/deviceLanguage';
import { isLanguageAutomatic, saveLanguageAutomatic } from '../storage/db';

// Whether the app follows the phone's language, and ways to pick a language
// or go back to following the phone.
export function useLanguageMode() {
  const { language, setLanguage } = useApp();
  const [automatic, setAutomatic] = useState(true);

  useEffect(() => {
    isLanguageAutomatic().then(setAutomatic).catch(() => setAutomatic(true));
  }, [language]);

  const chooseLanguage = useCallback(
    async (code: LanguageCode) => {
      await setLanguage(code);
      setAutomatic(false);
    },
    [setLanguage]
  );

  // Switch to the phone's language now, then store "automatic" so later
  // launches keep following the phone.
  const chooseAutomatic = useCallback(async () => {
    await setLanguage(deviceLanguage());
    await saveLanguageAutomatic();
    setAutomatic(true);
  }, [setLanguage]);

  return { language, automatic, chooseLanguage, chooseAutomatic };
}
