/**
 * Narration du combat — couche AFFICHAGE pure (aucune règle).
 *
 * À partir d'un ÉVÉNEMENT structuré (`CombatEvent` : `kind` + acteur/cible + texte) et de la liste
 * des combattants, dérive :
 *  - une ICÔNE unifiée, déduite du `kind` (plus aucun devinage par mots-clés) ; pour les états
 *    appliqués (`condition`/`detail`) on réutilise l'icône de `effectIcons` (source unique),
 *  - les NOMS colorés par camp (allié vert / ennemi rouge) sous forme de segments,
 *  - l'IMPORTANCE (les événements importants remontent dans le bandeau haut ; le reste reste au journal).
 */
import { conditionMeta } from './effectIcons';
import { etats } from '../data';
import type { CombatEvent, CombatEventKind } from '../state/combatLog';

export interface NarratedSegment {
  text: string;
  team?: 'ally' | 'enemy';
}

export interface NarratedLine {
  raw: string;
  icon: string;
  important: boolean;
  segments: NarratedSegment[];
}

interface ComLite {
  id: string;
  name: string;
  kind: string;
}

/** Icône par type d'événement (source unique pour journal + bandeau + pastilles). */
const KIND_ICON: Record<CombatEventKind, string> = {
  charge: '✊', attack: '⚔️', shoot: '🏹', cast: '✨', item: '🧪', heal: '❤️‍🩹',
  move: '👣', flee: '🏃', defensive: '🛡️', aim: '🎯', focus: '🔮', frenzy: '🐗',
  reload: '🔁', parry: '🛡️', dodge: '🤸', damage: '💥', crit: '⭐',
  condition: '🩸', fear: '😱', death: '☠️', round: '🔔', detail: '·', info: '•',
};

/** Types d'événements affichés dans le bandeau haut (les temps forts/actions/postures). */
const IMPORTANT: Set<CombatEventKind> = new Set([
  'charge', 'attack', 'shoot', 'cast', 'item', 'heal', 'flee',
  'defensive', 'aim', 'focus', 'frenzy', 'crit', 'fear', 'death', 'round',
]);

/** États (LDB ch.16) reconnus dans le texte d'un événement `condition`/`detail` → icône via la
 *  source unique `conditionMeta` (jeu de noms FERMÉ, pas du devinage de verbe libre). */
// Le texte d'un événement est en FRANÇAIS (journal) → on scanne le LIBELLÉ (etats.json + Pétrifié),
// puis on mappe à l'`id` pour l'icône (conditionMeta keyé par id). Data-driven (zéro liste figée).
const STATE_LABEL_TO_ID: [string, string][] = [...etats.map((e): [string, string] => [e.label, e.id]), ['Pétrifié', 'petrifie']];

function stateMeta(text: string): { icon: string; important: boolean } | null {
  for (const [label, id] of STATE_LABEL_TO_ID) {
    if (text.includes(label)) {
      const m = conditionMeta(id);
      return { icon: m.icon, important: m.important };
    }
  }
  return null;
}

function iconOf(e: CombatEvent): string {
  if (e.kind === 'condition' || e.kind === 'detail') {
    const s = stateMeta(e.text);
    if (s) return s.icon;
  }
  return KIND_ICON[e.kind];
}

function importantOf(e: CombatEvent): boolean {
  if (IMPORTANT.has(e.kind)) return true;
  if (e.kind === 'condition') {
    const s = stateMeta(e.text);
    return !!s && s.important; // un État incapacitant appliqué (Sonné, À Terre…) monte au bandeau
  }
  return false;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Découpe le texte en segments, colorant chaque occurrence d'un nom de combattant par son camp. */
function colorize(text: string, combatants: ComLite[]): NarratedSegment[] {
  const named = combatants.filter((c) => c.name && c.name.trim());
  if (!named.length) return [{ text }];

  const teamOf = new Map<string, 'ally' | 'enemy'>();
  for (const c of named) if (!teamOf.has(c.name)) teamOf.set(c.name, c.kind === 'hero' ? 'ally' : 'enemy');

  // Noms uniques, du plus long au plus court (évite « Rat » de mordre dans « Rat géant »).
  const names = [...new Set(named.map((c) => c.name))].sort((a, b) => b.length - a.length);
  const re = new RegExp('(' + names.map(escapeRe).join('|') + ')', 'g');

  const segs: NarratedSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segs.push({ text: text.slice(last, m.index) });
    segs.push({ text: m[0], team: teamOf.get(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) segs.push({ text: text.slice(last) });
  return segs.length ? segs : [{ text }];
}

/** Narre un événement de combat : icône unifiée + importance + segments colorés par camp. */
export function narrateEvent(e: CombatEvent, combatants: ComLite[] = []): NarratedLine {
  return { raw: e.text, icon: iconOf(e), important: importantOf(e), segments: colorize(e.text, combatants) };
}

/** Les `max` derniers événements IMPORTANTS (pour le bandeau haut), ordre chronologique préservé. */
export function combatFeed(events: CombatEvent[], combatants: ComLite[] = [], max = 3): NarratedLine[] {
  const important = events.filter((e) => importantOf(e)).map((e) => narrateEvent(e, combatants));
  return important.slice(-max);
}
