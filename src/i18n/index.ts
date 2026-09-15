import en, { Translations } from './en';
import ro from './ro';
import es from './es';
import fr from './fr';
import de from './de';
import it from './it';
import { LanguageCode } from './languages';

const TRANSLATIONS: Record<LanguageCode, Translations> = { en, ro, es, fr, de, it };

export function getTranslations(lang: LanguageCode): Translations {
  return TRANSLATIONS[lang] ?? en;
}

export type { Translations };
export * from './languages';
