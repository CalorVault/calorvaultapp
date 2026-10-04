import en, { Translations } from './en';
import ro from './ro';
import es from './es';
import fr from './fr';
import de from './de';
import it from './it';
import pt from './pt';
import nl from './nl';
import pl from './pl';
import tr from './tr';
import ru from './ru';
import uk from './uk';
import hi from './hi';
import id from './id';
import zh from './zh';
import ja from './ja';
import ko from './ko';
import { LanguageCode } from './languages';

const TRANSLATIONS: Record<LanguageCode, Translations> = {
  en, ro, es, fr, de, it, pt, nl, pl, tr, ru, uk, hi, id, zh, ja, ko,
};

export function getTranslations(lang: LanguageCode): Translations {
  return TRANSLATIONS[lang] ?? en;
}

export type { Translations };
export * from './languages';
