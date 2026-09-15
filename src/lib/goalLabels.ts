import { Translations } from '../i18n';
import { Goal } from '../types';

export function goalLabels(t: Translations): Record<Goal, string> {
  return {
    lose: t.goals.lose,
    maintain: t.goals.maintain,
    gain: t.goals.gain,
    build_muscle: t.goals.buildMuscle,
  };
}
