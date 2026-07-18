/**
 * Icônes & résumé des États (malus) et buffs (`activeEffects`) — couche AFFICHAGE partagée
 * (pion sur le terrain, panneau Perso, ordre de bataille, fiche express au survol).
 * Aucune règle ici : on lit `conditions[]` et `activeEffects[]` déjà gérés par le moteur.
 */
import { CHAR_LABELS, type ConditionInstance, type ActiveEffect, type CharKey, type Combatant, type EffectSource, type EffectSourceKind } from '../engine/types';
import type { IconId } from '../ui/icons';
import {
  conditionLabel, findConditionById, findPsychologyById, findSpellById,
  creatures, maladies, maneuvers, mutations, qualities, regles, symptoms, talents, trappings, traits,
} from '../data';
import { ACTIVITIES } from '../engine/activities';
import { slugId } from '../data/slug';
import { isFrenzied } from '../engine/psychology';
import { conditionSeverity } from '../engine/conditions';
import { roundsLabel } from '../engine/duration';

/** Clés STABLES des états-drapeaux (`EffectFlags`) — vocabulaire d'identité partagé par `flagChips`
 *  (production) et `chipCodex` (routage Codex). */
export type FlagId = 'frenzied' | 'defensiveStance' | 'aiming' | 'focusDr' | 'hunger' | 'fear';

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
  /** id STABLE du sort/prière SOURCE d'un buff (`ActiveEffect.sourceSpellId`) — résolution Codex Sorts. */
  sourceSpellId?: string;
  /** id STABLE de l'effet lui-même (`ActiveEffect.effectId`) — 2ᵉ ancrage de règle d'un buff, quand il
   *  n'est pas issu d'un lancement (ivresse, exposition, chanson de marin…). */
  effectId?: string;
  /** Entité SOURCE de l'effet (`ActiveEffect.source`) — ancrage de règle GÉNÉRAL, tous types confondus. */
  source?: EffectSource;
  /** id STABLE de l'état-drapeau (clé d'`EffectFlags`) — SEUL moyen d'identifier un drapeau en aval
   *  (routage Codex de `chipCodex`) : le `label` est de l'affichage, jamais une clé de logique. */
  flagId?: FlagId;
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
    sourceSpellId: e.sourceSpellId,
    effectId: e.effectId,
    source: e.source,
  }));
}

/** Détail PARAMÉTRÉ d'une pastille (bonus + carac, Rounds restants, empilement) — la part variable
 *  que le catalogue ne porte pas. Vide quand la pastille n'a que son libellé. Pur. */
export function chipDetail(c: EffectChip): string {
  const parts: string[] = [];
  if (c.bonus) parts.push(`${c.bonus > 0 ? '+' : ''}${c.bonus}${c.char ? ` ${CHAR_LABELS[c.char]}` : ''}`);
  if (c.rounds != null) parts.push(`${roundsLabel(c.rounds)} restant${c.rounds > 1 ? 's' : ''}`);
  if ((c.count ?? 1) > 1) parts.push(`×${c.count}`);
  return parts.join(' · ');
}

/** Cible d'information d'une pastille d'effet, IDENTIQUE pour toute la famille (`EffectChips`,
 *  `StateChips`, section « Effets actifs ») : un seul mécanisme, `CodexRef` — État vers le catalogue
 *  États, buff vers son sort source, et à défaut un popover de secours portant le détail. Jamais
 *  d'infobulle native (`title`), qui concurrencerait le popover. Pur. */
export interface ChipCodex {
  category: string;
  /** id STABLE de l'entrée catalogue — toujours présent : sans lui il n'y a pas de cible. */
  id: string;
  label: string;
  /** Libellé paramétré (détail inclus) — en tête du popover, le libellé catalogue en sous-titre. */
  instance?: string;
}

/** Existence d'une entrée par id STABLE, par catégorie Codex — une cible ne se PRÉSUME pas.
 *  Arbitrage user 2026-07-18 : « une chips de ce genre n'a de sens que si elle est reliée à une règle ». */
const byId = (list: readonly { id: string }[]) => (id: string) => list.some((e) => e.id === id);
const CATALOGUE_HAS: Record<string, (id: string) => boolean> = {
  etats: (id) => !!findConditionById(id),
  spells: (id) => !!findSpellById(id),
  psychologies: (id) => !!findPsychologyById(id),
  regles: byId(regles),
  talents: byId(talents),
  traits: byId(traits),
  trappings: byId(trappings),
  qualities: byId(qualities),
  maladies: byId(maladies),
  symptoms: byId(symptoms),
  mutations: byId(mutations),
  maneuvers: byId(maneuvers),
  creatures: byId(creatures),
  activities: byId(ACTIVITIES),
};

/** Catégories fouillées pour un `ActiveEffect.effectId` (ivresse, exposition, chanson de marin…), dans
 *  cet ordre — l'effet n'étant pas issu d'un lancement, sa règle vit hors du catalogue Sorts. */
const EFFECT_ID_CATEGORIES = ['regles', 'etats', 'psychologies'] as const;

/** Catégorie Codex d'une `EffectSource` — TOTALE sur `EffectSourceKind` : une source nommée ouvre sa
 *  fiche, quel que soit son TYPE (sort, talent, trait, objet…). Prières et bénédictions vivent au
 *  catalogue Sorts (`spells.json`) comme les sorts. */
const CATEGORY_BY_SOURCE_KIND: Record<EffectSourceKind, string> = {
  spell: 'spells', prayer: 'spells', talent: 'talents', trait: 'traits', trapping: 'trappings',
  quality: 'qualities', disease: 'maladies', symptom: 'symptoms', mutation: 'mutations',
  condition: 'etats', psychology: 'psychologies', maneuver: 'maneuvers', creature: 'creatures',
  activity: 'activities', rule: 'regles',
};
/** Entrée CATALOGUE d'un état-drapeau — routage par id STABLE (`FlagId`), jamais par libellé. La table
 *  est TOTALE : un état affiché sans règle derrière lui serait un défaut d'affichage, pas une donnée
 *  manquante (arbitrage user 2026-07-18). */
const FLAG_CODEX: Record<FlagId, { category: string; id: string }> = {
  frenzied: { category: 'psychologies', id: 'frenesie' },
  fear: { category: 'psychologies', id: 'peur' },
  focusDr: { category: 'regles', id: 'focalisation-etendue' },
  defensiveStance: { category: 'regles', id: 'sur-la-defensive' },
  hunger: { category: 'regles', id: 'faim-et-soif' },
  aiming: { category: 'regles', id: 'viser' },
};

/** Règle ADOSSÉE à une pastille, ou `null` quand la pastille n'en a aucune. Priorité, toujours par id
 *  STABLE : drapeau (table totale) → État par `condId` → ENTITÉ SOURCE de l'effet (`source` : sort,
 *  talent, trait, objet, maladie…) → sort source (`sourceSpellId`) → `effectId`. `null` = pastille
 *  NON RÉSOLUE : elle reste affichée (masquer un état
 *  mécanique actif serait pire) mais SANS aucune affordance d'information — pas de `CodexRef`, pas de
 *  popover, pas de `title`. Aucun repli : une pastille est reliée à une règle, ou elle ne promet rien
 *  (arbitrage user 2026-07-18, « j'aime pas ta fallback »). Pur. */
export function chipCodex(c: EffectChip): ChipCodex | null {
  const detail = chipDetail(c);
  const at = (category: string, id: string | undefined, instance: string | undefined): ChipCodex | null =>
    id && CATALOGUE_HAS[category]?.(id) ? { category, id, label: c.label, instance } : null;
  const withDetail = detail ? `${c.label} — ${detail}` : undefined;

  const flag = c.flagId ? FLAG_CODEX[c.flagId] : undefined;
  if (flag) return at(flag.category, flag.id, withDetail ?? c.label);
  if (c.kind !== 'buff') return at('etats', c.condId, withDetail);
  const bySource = c.source ? at(CATEGORY_BY_SOURCE_KIND[c.source.kind], c.source.id, withDetail) : null;
  if (bySource) return bySource;
  const bySpell = at('spells', c.sourceSpellId, withDetail);
  if (bySpell) return bySpell;
  for (const cat of EFFECT_ID_CATEGORIES) {
    const byEffect = at(cat, c.effectId, withDetail);
    if (byEffect) return byEffect;
  }
  return null;
}

/** États-drapeaux (hors `conditions[]`) : postures/actions vivant sur le Combatant. */
export interface EffectFlags {
  frenzied?: boolean;
  defensiveStance?: boolean;
  aiming?: boolean;
  /** DR de Focalisation cumulé (undefined = pas de Focalisation en cours). */
  focusDr?: number;
  /** Faim (#T2, LDB 18 l.337-343) : jours sans manger + échecs (malus de caracs actifs). */
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
  if (flags?.frenzied) out.push({ key: 'f-frenzied', flagId: 'frenzied', icon: 'flag/frenzy', label: 'Frénésie', kind: 'state', severity: 68 });
  if (flags?.defensiveStance) out.push({ key: 'f-def', flagId: 'defensiveStance', icon: 'flag/defensive', label: 'Sur la défensive (+20 en défense)', kind: 'state', severity: 60 });
  if (flags?.aiming) out.push({ key: 'f-aim', flagId: 'aiming', icon: 'action/aim', label: 'En joue (+20 au prochain tir)', kind: 'state', severity: 55 });
  if (flags?.focusDr != null) out.push({ key: 'f-focus', flagId: 'focusDr', icon: 'flag/focus', label: `Focalisation (DR ${flags.focusDr})`, kind: 'state', severity: 50, count: flags.focusDr });
  if (flags?.hunger) {
    const h = flags.hunger;
    out.push({
      key: 'f-hunger', flagId: 'hunger', icon: 'flag/hungry', kind: 'state', severity: 62,
      label: `Affamé (${h.days} j sans manger${h.failures >= 2 ? ' — −10 à toutes les Caractéristiques' : h.failures === 1 ? ' — −10 Force/Endurance' : ''}) : pas de récupération naturelle`,
    });
  }
  if (flags?.fear != null) {
    out.push({
      key: 'f-fear', flagId: 'fear', icon: 'flag/fear', kind: 'state', severity: 66,
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
