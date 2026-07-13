/**
 * Icônes & résumé des États (malus) et buffs (`activeEffects`) — couche AFFICHAGE partagée
 * (pion sur le terrain, panneau Perso, ordre de bataille, fiche express au survol).
 * Aucune règle ici : on lit `conditions[]` et `activeEffects[]` déjà gérés par le moteur.
 */
import type { ConditionInstance, ActiveEffect, CharKey, Combatant } from '../engine/types';
import type { IconId } from '../ui/icons';
import { conditionLabel, findConditionById } from '../data';
import { slugId } from '../data/slug';
import { isFrenzied } from '../engine/psychology';
import { conditionSeverity } from '../engine/conditions';

export interface EffectChip {
  key: string;
  /** Id d'icône du registre `src/ui/icons/` — rendu par `<Icon>` (HTML) ou `<IconG>` (SVG). */
  icon: IconId;
  label: string;
  /** malus = État négatif ; buff = effet temporisé (activeEffects) ; state = état-drapeau (Frénésie…). */
  kind: 'malus' | 'buff' | 'state';
  /** id STABLE de l'État (malus) pour la résolution Codex par id — `ConditionInstance.name` (slug
   *  d'etats.json). Absent sur buff/état-drapeau (hors catalogue États). */
  condId?: string;
  severity: number;
  /** Empilement (n>1) — ex. Hémorragique ×3. */
  count?: number;
  /** Rounds restants (buffs temporisés). */
  rounds?: number;
  /** Bonus du buff (ex. +10). */
  bonus?: number;
  char?: CharKey;
}

interface CondMeta { icon: IconId; severity: number; important: boolean; }

/** Icônes des marqueurs NARRATIFS hors LDB 16 (PAS des États `etats.json`, cf. data-wellformed.test) :
 *  Pétrifié (LDB 85), sans entrée catalogue. Sévérité : `conditionSeverity` (engine, SOURCE UNIQUE
 *  partagée avec l'importance d'un évènement de combat, `state/combatLog`). */
const NARRATIVE_ICONS: Record<string, IconId> = { petrifie: 'condition/petrified' };

/** Icône + sévérité d'AFFICHAGE d'un État — icône lue en DONNÉE (`etats.json`) ou sur un marqueur
 *  narratif (repli `journal/info`) ; sévérité déléguée à `conditionSeverity` (engine). `important` =
 *  sévérité ≥ 50 (incapacitant, créneau unique de l'ordre de bataille). Clé SLUGIFIÉE → tolère un
 *  libellé ('Pétrifié' → 'petrifie'). */
export function conditionMeta(name: string): CondMeta {
  const id = slugId(name);
  const icon = (findConditionById(id)?.icon as IconId | undefined) ?? NARRATIVE_ICONS[id] ?? 'journal/info';
  const severity = conditionSeverity(name);
  return { icon, severity, important: severity >= 50 };
}

const BUFF_CHAR_ICON: Partial<Record<CharKey, IconId>> = {
  'capacite-de-combat': 'char/cc', 'capacite-de-tir': 'char/ct', force: 'char/f', endurance: 'char/e', agilite: 'char/ag', intelligence: 'char/int', 'force-mentale': 'char/fm', sociabilite: 'char/soc',
};
function buffIcon(e: ActiveEffect): IconId {
  return (e.char && BUFF_CHAR_ICON[e.char]) || 'action/cast'; // buff sans carac = effet de sort/bénédiction
}

function malusChips(conditions: ConditionInstance[]): EffectChip[] {
  return conditions
    .map((c): EffectChip => {
      const m = conditionMeta(c.name);
      return { key: `c-${c.name}`, condId: c.name, icon: m.icon, label: conditionLabel(c.name), kind: 'malus', severity: m.severity, count: c.value > 1 ? c.value : undefined };
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
    rounds: e.duration.scale === 'rounds' ? e.duration.left : undefined,
    bonus: e.bonus,
    char: e.char,
  }));
}

/** États-drapeaux (hors `conditions[]`) : postures/actions vivant sur le Combatant. */
export interface EffectFlags {
  frenzied?: boolean;
  defensiveStance?: boolean;
  aiming?: boolean;
  /** DR de Focalisation cumulé (undefined = pas de Focalisation en cours). */
  focusDr?: number;
  /** Faim (#T2, LDB 18 l.417-422) : jours sans manger + échecs (malus de caracs actifs). */
  hunger?: { days: number; failures: number };
  /** Sous l'emprise de la PEUR (LDB 21 l.29) : Indice le plus élevé des sources non surmontées
   *  (calmeDR < Indice). Undefined = aucune Peur active. */
  fear?: number;
}

/** Extrait les états-drapeaux affichables d'un Combatant (source unique pour tous les affichages). */
export function combatantFlags(c: Combatant): EffectFlags {
  const fears = (c.psychState ?? []).filter((p) => p.type === 'peur' && (p.calmeDR ?? 0) < (p.indice ?? 1));
  return {
    frenzied: isFrenzied(c), defensiveStance: c.defensiveStance, aiming: c.aiming, focusDr: c.focus?.dr,
    hunger: (c.hunger?.days ?? 0) >= 1 ? { days: c.hunger!.days, failures: c.hunger!.failures } : undefined,
    fear: fears.length ? Math.max(...fears.map((p) => p.indice ?? 1)) : undefined,
  };
}

function flagChips(flags?: EffectFlags): EffectChip[] {
  const out: EffectChip[] = [];
  if (flags?.frenzied) out.push({ key: 'f-frenzied', icon: 'flag/frenzy', label: 'Frénésie', kind: 'state', severity: 68 });
  if (flags?.defensiveStance) out.push({ key: 'f-def', icon: 'flag/defensive', label: 'Sur la défensive (+20 en défense)', kind: 'state', severity: 60 });
  if (flags?.aiming) out.push({ key: 'f-aim', icon: 'action/aim', label: 'En joue (+20 au prochain tir)', kind: 'state', severity: 55 });
  if (flags?.focusDr != null) out.push({ key: 'f-focus', icon: 'flag/focus', label: `Focalisation (DR ${flags.focusDr})`, kind: 'state', severity: 50, count: flags.focusDr });
  if (flags?.hunger) {
    const h = flags.hunger;
    out.push({
      key: 'f-hunger', icon: 'flag/hungry', kind: 'state', severity: 62,
      label: `Affamé (${h.days} j sans manger${h.failures >= 2 ? ' — −10 à toutes les Caractéristiques' : h.failures === 1 ? ' — −10 Force/Endurance' : ''}) : pas de récupération naturelle`,
    });
  }
  if (flags?.fear != null) {
    out.push({
      key: 'f-fear', icon: 'flag/fear', kind: 'state', severity: 66,
      label: `Peur (Indice ${flags.fear}) — −1 DR contre la source ; approcher exige un Test de Calme (+0) ; Test étendu de Calme en fin de Round pour la vaincre`,
    });
  }
  return out;
}

export interface EffectSummary { visible: EffectChip[]; moreCount: number; }

/** Liste compacte des effets : malus (triés par sévérité) → états-drapeaux → buffs,
 *  tronquée à `maxVisible` ; le surplus est reporté dans `moreCount` (« +N »). */
export function summarizeEffects(
  conditions: ConditionInstance[] = [],
  effects: ActiveEffect[] = [],
  maxVisible = Infinity,
  flags?: EffectFlags,
): EffectSummary {
  const all = [...malusChips(conditions), ...flagChips(flags), ...buffChips(effects)];
  if (all.length <= maxVisible) return { visible: all, moreCount: 0 };
  return { visible: all.slice(0, maxVisible), moreCount: all.length - maxVisible };
}

/** L'État important le plus grave présent (créneau unique de l'ordre de bataille), ou null. */
export function topImportantCondition(conditions: ConditionInstance[] = []): EffectChip | null {
  // « important » = sévérité ≥ 50 (cf. conditionMeta) — lu directement sur le chip (label déjà résolu).
  const imp = malusChips(conditions).filter((c) => c.severity >= 50);
  return imp[0] ?? null;
}
