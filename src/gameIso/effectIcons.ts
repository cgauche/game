/**
 * Icônes & résumé des États (malus) et buffs (`activeEffects`) — couche AFFICHAGE partagée
 * (pion sur le terrain, panneau Perso, ordre de bataille, fiche express au survol).
 * Aucune règle ici : on lit `conditions[]` et `activeEffects[]` déjà gérés par le moteur.
 */
import type { ConditionInstance, ActiveEffect, CharKey } from '../engine/types';

export interface EffectChip {
  key: string;
  icon: string;
  label: string;
  kind: 'malus' | 'buff';
  severity: number;
  /** Empilement (n>1) — ex. Hémorragique ×3. */
  count?: number;
  /** Rounds restants (buffs temporisés). */
  rounds?: number;
  /** Bonus du buff (ex. +10). */
  bonus?: number;
  char?: CharKey;
}

interface CondMeta { icon: string; severity: number; important: boolean; }

/** Table des États (LDB ch.16) → icône + sévérité. `important` = incapacitant/dangereux
 *  (affiché dans le créneau unique de l'ordre de bataille). Seuil : sévérité ≥ 50. */
const CONDITION_TABLE: Record<string, { icon: string; severity: number }> = {
  Inconscient: { icon: '😵', severity: 100 },
  Pétrifié: { icon: '🗿', severity: 95 },
  Sonné: { icon: '💫', severity: 80 },
  'À Terre': { icon: '🔻', severity: 75 },
  Brisé: { icon: '💔', severity: 70 },
  Aveuglé: { icon: '🙈', severity: 65 },
  Empêtré: { icon: '🕸️', severity: 60 },
  'En flammes': { icon: '🔥', severity: 58 },
  Empoisonné: { icon: '🤢', severity: 55 },
  Hémorragique: { icon: '🩸', severity: 52 },
  Surpris: { icon: '❗', severity: 40 },
  Assourdi: { icon: '🔇', severity: 30 },
  Exténué: { icon: '😫', severity: 20 },
};
const UNKNOWN: CondMeta = { icon: '•', severity: 10, important: false };

export function conditionMeta(name: string): CondMeta {
  const t = CONDITION_TABLE[name];
  if (!t) return UNKNOWN;
  return { icon: t.icon, severity: t.severity, important: t.severity >= 50 };
}

const BUFF_CHAR_ICON: Partial<Record<CharKey, string>> = {
  CC: '⚔️', CT: '🏹', F: '💪', E: '❤️', Ag: '🤸', Int: '🧠', FM: '🛡️', Soc: '💬',
};
function buffIcon(e: ActiveEffect): string {
  return (e.char && BUFF_CHAR_ICON[e.char]) || '✨';
}

function malusChips(conditions: ConditionInstance[]): EffectChip[] {
  return conditions
    .map((c): EffectChip => {
      const m = conditionMeta(c.name);
      return { key: `c-${c.name}`, icon: m.icon, label: c.name, kind: 'malus', severity: m.severity, count: c.value > 1 ? c.value : undefined };
    })
    .sort((a, b) => b.severity - a.severity);
}

function buffChips(effects: ActiveEffect[]): EffectChip[] {
  return effects.map((e, i): EffectChip => ({
    key: `b-${i}-${e.label}`,
    icon: buffIcon(e),
    label: e.label,
    kind: 'buff',
    severity: 50,
    rounds: e.roundsLeft,
    bonus: e.bonus,
    char: e.char,
  }));
}

export interface EffectSummary { visible: EffectChip[]; moreCount: number; }

/** Liste compacte des effets : malus (triés par sévérité décroissante) puis buffs,
 *  tronquée à `maxVisible` ; le surplus est reporté dans `moreCount` (« +N »). */
export function summarizeEffects(
  conditions: ConditionInstance[] = [],
  effects: ActiveEffect[] = [],
  maxVisible = Infinity,
): EffectSummary {
  const all = [...malusChips(conditions), ...buffChips(effects)];
  if (all.length <= maxVisible) return { visible: all, moreCount: 0 };
  return { visible: all.slice(0, maxVisible), moreCount: all.length - maxVisible };
}

/** L'État important le plus grave présent (créneau unique de l'ordre de bataille), ou null. */
export function topImportantCondition(conditions: ConditionInstance[] = []): EffectChip | null {
  const imp = malusChips(conditions).filter((c) => conditionMeta(c.label).important);
  return imp[0] ?? null;
}
