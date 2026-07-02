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
import type { IconId } from '../ui/icons';
import type { CombatEvent, CombatEventKind, ActorAim, ActorAimKind } from '../state/combatLog';

export interface NarratedSegment {
  text: string;
  team?: 'ally' | 'enemy';
}

/** Intensité d'un évènement → tenue à l'écran (le Réalisateur allonge les temps forts) ET emphase
 *  visuelle de la bannière. `grave` = un critique / une mise à mort ; `strong` = une Peur. */
export type CombatTone = 'normal' | 'strong' | 'grave';

export interface NarratedLine {
  raw: string;
  /** Id d'icône du registre `src/ui/icons/` — rendu par `<Icon>` (HTML) ou `<IconG>` (SVG). */
  icon: IconId;
  important: boolean;
  tone: CombatTone;
  segments: NarratedSegment[];
}

interface ComLite {
  id: string;
  name: string;
  kind: string;
}

/** Icône par type d'événement (source unique pour journal + bandeau + pastilles). */
const KIND_ICON: Record<CombatEventKind, IconId> = {
  charge: 'journal/charge', attack: 'action/attack', shoot: 'action/shoot', cast: 'action/cast', item: 'item/consumable', heal: 'journal/heal',
  move: 'journal/move', flee: 'journal/flee', defensive: 'flag/defensive', aim: 'action/aim', focus: 'flag/focus', frenzy: 'flag/frenzy',
  reload: 'journal/reload', parry: 'action/defend', dodge: 'journal/dodge', damage: 'journal/damage', crit: 'journal/critical',
  condition: 'condition/bleeding', fear: 'flag/fear', death: 'journal/death', round: 'journal/round', detail: 'journal/detail', info: 'journal/info',
};

/** Types d'événements affichés dans le bandeau haut (les temps forts/actions/postures). */
const IMPORTANT: Set<CombatEventKind> = new Set([
  'charge', 'attack', 'shoot', 'cast', 'item', 'heal', 'flee',
  'defensive', 'aim', 'focus', 'frenzy', 'crit', 'fear', 'death', 'round',
]);

/** Ton par type d'évènement (source UNIQUE — lue par le Réalisateur pour la tenue ET par la bannière
 *  pour l'emphase). Tout le reste retombe sur `normal`. */
const KIND_TONE: Partial<Record<CombatEventKind, CombatTone>> = { crit: 'grave', death: 'grave', fear: 'strong' };
export function toneOf(k: CombatEventKind): CombatTone {
  return KIND_TONE[k] ?? 'normal';
}

/** États (LDB ch.16) reconnus dans le texte d'un événement `condition`/`detail` → icône via la
 *  source unique `conditionMeta` (jeu de noms FERMÉ, pas du devinage de verbe libre). */
// Le texte d'un événement est en FRANÇAIS (journal) → on scanne le LIBELLÉ (etats.json + Pétrifié),
// puis on mappe à l'`id` pour l'icône (conditionMeta keyé par id). Data-driven (zéro liste figée).
const STATE_LABEL_TO_ID: [string, string][] = [...etats.map((e): [string, string] => [e.label, e.id]), ['Pétrifié', 'petrifie']];

function stateMeta(text: string): { icon: IconId; important: boolean } | null {
  for (const [label, id] of STATE_LABEL_TO_ID) {
    if (text.includes(label)) {
      const m = conditionMeta(id);
      return { icon: m.icon, important: m.important };
    }
  }
  return null;
}

function iconOf(e: CombatEvent): IconId {
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

/** Narre un événement de combat : icône unifiée + importance + ton + segments colorés par camp. */
export function narrateEvent(e: CombatEvent, combatants: ComLite[] = []): NarratedLine {
  return { raw: e.text, icon: iconOf(e), important: importantOf(e), tone: toneOf(e.kind), segments: colorize(e.text, combatants) };
}

/** Verbe + kind (icône/ton) pour chaque manière de télégraphe d'intention. */
const INTENT: Record<ActorAimKind, { verb: string; kind: CombatEventKind }> = {
  charge: { verb: 'charge', kind: 'charge' },
  melee: { verb: 'attaque', kind: 'attack' },
  ranged: { verb: 'vise', kind: 'shoot' },
  cast: { verb: 'lance un sort sur', kind: 'cast' },
};

/** Narre l'INTENTION télégraphiée d'un combattant IA (« X charge / attaque / vise / lance un sort sur
 *  Y »). N'est PAS journalisée (doublon de la ligne de résultat) : la bannière la projette le temps du
 *  télégraphe. Réutilise la coloration par camp + l'icône/le ton par kind, comme un évènement. */
export function narrateIntent(aim: ActorAim, combatants: ComLite[] = []): NarratedLine | null {
  const from = combatants.find((c) => c.id === aim.fromId);
  const to = combatants.find((c) => c.id === aim.toId);
  if (!from || !to) return null;
  const { verb, kind } = INTENT[aim.kind];
  const text = `${from.name} ${verb} ${to.name}`;
  return { raw: text, icon: KIND_ICON[kind], important: true, tone: toneOf(kind), segments: colorize(text, combatants) };
}

/** Les `max` derniers événements IMPORTANTS (pour le bandeau haut), ordre chronologique préservé. */
export function combatFeed(events: CombatEvent[], combatants: ComLite[] = [], max = 3): NarratedLine[] {
  const important = events.filter((e) => importantOf(e)).map((e) => narrateEvent(e, combatants));
  return important.slice(-max);
}
