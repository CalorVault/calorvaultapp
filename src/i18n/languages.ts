export type LanguageCode = 'en' | 'ro' | 'es' | 'fr' | 'de' | 'it';

export interface LanguageMeta {
  code: LanguageCode;
  englishName: string;
  nativeName: string;
}

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const LANGUAGES: LanguageMeta[] = [
  { code: 'en', englishName: 'English', nativeName: 'English' },
  { code: 'ro', englishName: 'Romanian', nativeName: 'Română' },
  { code: 'es', englishName: 'Spanish', nativeName: 'Español' },
  { code: 'fr', englishName: 'French', nativeName: 'Français' },
  { code: 'de', englishName: 'German', nativeName: 'Deutsch' },
  { code: 'it', englishName: 'Italian', nativeName: 'Italiano' },
];

export function isLanguageCode(value: string): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value);
}
