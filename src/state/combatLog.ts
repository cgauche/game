/**
 * Événements de combat STRUCTURÉS — remplacent l'ancien journal en chaînes (`battle.log: string[]`).
 *
 * Source unique de vérité pour le journal, le bandeau d'événements, et (à venir) le feedback
 * flottant et le cadrage caméra : `kind` (type d'événement) + `actorId`/`targetId` + texte FR
 * déjà composé. L'icône et l'importance se déduisent du `kind` (plus aucun devinage par mots-clés).
 */
import { etats } from '../data';
import { conditionSeverity } from '../engine/conditions';

export type CombatEventKind =
  | 'charge' | 'attack' | 'shoot' | 'cast' | 'item' | 'heal' | 'move' | 'flee'
  | 'defensive' | 'aim' | 'focus' | 'frenzy' | 'reload'
  | 'parry' | 'dodge' | 'damage' | 'crit'
  | 'condition' | 'fear' | 'death' | 'round' | 'detail' | 'info';

export interface CombatEvent {
  kind: CombatEventKind;
  text: string;
  actorId?: string;
  targetId?: string;
}

/** Télégraphe d'intention d'un combattant IA (réticule + ligne sur la carte) : qui vise qui, et de
 *  quelle manière. `kind` choisit le trait (mêlée/charge = ligne PLEINE ; tir/sort = POINTILLÉE) ET
 *  narre la bannière (« charge / attaque / vise / lance un sort »). Une seule source pour les deux. */
export type ActorAimKind = 'melee' | 'charge' | 'ranged' | 'cast';
export interface ActorAim {
  fromId: string;
  toId: string;
  kind: ActorAimKind;
}

/** Construit un événement. */
export function ev(kind: CombatEventKind, text: string, actorId?: string, targetId?: string): CombatEvent {
  return { kind, text, actorId, targetId };
}

/**
 * Enveloppe une liste de lignes (souvent renvoyées par le moteur en `string[]`) en événements.
 * Les sous-lignes indentées « ↳ … » deviennent des `detail` ; les autres prennent `mainKind`.
 */
export function evLines(
  lines: string[],
  mainKind: CombatEventKind,
  actorId?: string,
  targetId?: string,
): CombatEvent[] {
  return lines.map((t) => ({
    kind: /^\s*↳/.test(t) ? 'detail' : mainKind,
    text: t,
    actorId,
    targetId,
  }));
}

/**
 * Intensité d'un évènement → CADENCE (le Réalisateur `state/combatDirector` allonge les temps forts)
 * ET emphase visuelle de la bannière (`gameIso/combatNarration`). `grave` = un critique / une mise à
 * mort ; `strong` = une Peur. (#161 : ex-`gameIso/combatNarration.ts` — la cadence du combat en a
 * besoin, ce n'est pas QUE de l'affichage ; le rendu la reprend pour sa propre emphase, sens normal.)
 */
export type CombatTone = 'normal' | 'strong' | 'grave';

const KIND_TONE: Partial<Record<CombatEventKind, CombatTone>> = { crit: 'grave', death: 'grave', fear: 'strong' };
export function toneOf(k: CombatEventKind): CombatTone {
  return KIND_TONE[k] ?? 'normal';
}

/** Types d'événements « temps forts » (bandeau haut ET cadence) — le reste (dégâts bruts, mouvement…)
 *  reste au journal sans ralentir/marquer le rythme. */
const IMPORTANT: Set<CombatEventKind> = new Set([
  'charge', 'attack', 'shoot', 'cast', 'item', 'heal', 'flee',
  'defensive', 'aim', 'focus', 'frenzy', 'crit', 'fear', 'death', 'round',
]);

/** Libellé État (`etats.json` + Pétrifié, hors catalogue) → id — le texte d'un évènement `condition`/
 *  `detail` est en FRANÇAIS (journal) : on scanne le libellé pour retrouver l'État nommé, jeu de noms
 *  FERMÉ (pas de devinage de verbe libre). Partagé par l'icône (`gameIso/combatNarration`) ET l'importance. */
export const STATE_LABEL_TO_ID: [string, string][] = [...etats.map((e): [string, string] => [e.label, e.id]), ['Pétrifié', 'petrifie']];

/** Un évènement `condition`/`detail` est important s'il applique un État INCAPACITANT (Sonné, À terre…
 *  — sévérité ≥ 50, `conditionSeverity`). */
function isImportantConditionText(text: string): boolean {
  for (const [label, id] of STATE_LABEL_TO_ID) {
    if (text.includes(label)) return conditionSeverity(id) >= 50;
  }
  return false;
}

/** Un évènement est-il un « temps fort » (bandeau haut ET cadence) ? */
export function isImportantEvent(e: CombatEvent): boolean {
  if (IMPORTANT.has(e.kind)) return true;
  if (e.kind === 'condition') return isImportantConditionText(e.text);
  return false;
}

/** Ton du DERNIER évènement important du journal (ou `'normal'` si aucun / journal vide) — SOURCE
 *  UNIQUE de cadence pour `combatDirector.beatHold` (le bandeau, lui, garde `gameIso/combatNarration`
 *  pour l'icône/la coloration par camp, hors du périmètre `state`). */
export function lastEventTone(events: CombatEvent[]): CombatTone {
  for (let i = events.length - 1; i >= 0; i--) if (isImportantEvent(events[i])) return toneOf(events[i].kind);
  return 'normal';
}
