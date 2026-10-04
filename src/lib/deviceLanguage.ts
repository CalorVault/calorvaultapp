import { getLocales } from 'expo-localization';
import { DEFAULT_LANGUAGE, isLanguageCode, LanguageCode } from '../i18n/languages';

// Region used for voice recognition when the phone has none for that language.
const DEFAULT_SPEECH_LOCALE: Record<LanguageCode, string> = {
  en: 'en-US',
  ro: 'ro-RO',
  es: 'es-ES',
  fr: 'fr-FR',
  de: 'de-DE',
  it: 'it-IT',
  pt: 'pt-BR',
  nl: 'nl-NL',
  pl: 'pl-PL',
  tr: 'tr-TR',
  ru: 'ru-RU',
  uk: 'uk-UA',
  hi: 'hi-IN',
  id: 'id-ID',
  zh: 'zh-CN',
  ja: 'ja-JP',
  ko: 'ko-KR',
};

function phoneLocales() {
  try {
    return getLocales();
  } catch {
    return [];
  }
}

// The first of the phone's preferred languages that the app is translated
// into, so a new install opens in the language the phone already uses.
export function deviceLanguage(): LanguageCode {
  for (const locale of phoneLocales()) {
    if (locale.languageCode && isLanguageCode(locale.languageCode)) return locale.languageCode;
  }
  return DEFAULT_LANGUAGE;
}

// Voice recognition locale for the app's language, keeping the phone's own
// region (e.g. en-IE) when it matches so accents are recognised better.
// Built from language + region only (zh-Hans-CN becomes zh-CN), which is the
// form speech recognition expects.
export function speechLocale(language: LanguageCode): string {
  const match = phoneLocales().find((locale) => locale.languageCode === language && locale.regionCode);
  return match ? `${language}-${match.regionCode}` : DEFAULT_SPEECH_LOCALE[language];
}
