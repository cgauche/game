/**
 * Événements de combat STRUCTURÉS — remplacent l'ancien journal en chaînes (`battle.log: string[]`).
 *
 * Source unique de vérité pour le journal, le bandeau d'événements, et (à venir) le feedback
 * flottant et le cadrage caméra : `kind` (type d'événement) + `actorId`/`targetId` + texte FR
 * déjà composé. L'icône et l'importance se déduisent du `kind` (plus aucun devinage par mots-clés).
 */
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
