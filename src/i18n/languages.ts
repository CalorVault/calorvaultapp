export type LanguageCode =
  | 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it' | 'nl' | 'pl' | 'ro'
  | 'tr' | 'ru' | 'uk' | 'hi' | 'id' | 'zh' | 'ja' | 'ko';

export interface LanguageMeta {
  code: LanguageCode;
  englishName: string;
  nativeName: string;
}

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', englishName: 'English', nativeName: 'English' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español' },
  { code: 'pt', englishName: 'Portuguese', nativeName: 'Português' },
  { code: 'fr', englishName: 'French', nativeName: 'Français' },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch' },
  { code: 'it', englishName: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', englishName: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pl', englishName: 'Polish', nativeName: 'Polski' },
  { code: 'ro', englishName: 'Romanian', nativeName: 'Română' },
  { code: 'tr', englishName: 'Turkish', nativeName: 'Türkçe' },
  { code: 'ru', englishName: 'Russian', nativeName: 'Русский' },
  { code: 'uk', englishName: 'Ukrainian', nativeName: 'Українська' },
  { code: 'hi', englishName: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'id', englishName: 'Indonesian', nativeName: 'Bahasa Indonesia' },
  { code: 'zh', englishName: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'ja', englishName: 'Japanese', nativeName: '日本語' },
  { code: 'ko', englishName: 'Korean', nativeName: '한국어' },
];

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}
