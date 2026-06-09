/**
 * Narration du combat — couche AFFICHAGE pure (aucune règle).
 *
 * À partir d'une ligne de `battle.log` (string) et de la liste des combattants, dérive :
 *  - une ICÔNE unifiée (réutilise `conditionMeta` de effectIcons pour les États → source unique),
 *  - les NOMS colorés par camp (allié vert / ennemi rouge) sous forme de segments,
 *  - l'IMPORTANCE (les événements importants remontent dans le bandeau haut ; le reste reste au journal).
 *
 * NB (dette assumée) : on classe par mots-clés sur la chaîne du journal, faute d'événements
 * structurés à la source (le log est un string[] poussé à ~40 endroits). Polish ultérieur =
 * émettre des événements typés au moteur. Ici, zéro changement moteur.
 */
import { conditionMeta } from './effectIcons';

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

interface Rule {
  re: RegExp;
  icon: string;
  important: boolean;
}

/** Règles de tête : temps forts qui priment sur le verbe d'action. */
const HEAD_RULES: Rule[] = [
  { re: /^—?\s*round\s+\d/i, icon: '🔔', important: true },
  { re: /hors de combat|s'effondre|mis hors/i, icon: '☠️', important: true },
  { re: /critique/i, icon: '⭐', important: true },
  { re: /terrifié|terreur|\bpeur\b|a peur/i, icon: '😱', important: true },
];

/** États (LDB ch.16) scannés par nom → icône via `conditionMeta` (source unique partagée). */
const STATE_NAMES = [
  'Inconscient', 'Pétrifié', 'Hémorragique', 'Empoisonné', 'En flammes', 'Empêtré',
  'Aveuglé', 'Assourdi', 'Exténué', 'Surpris', 'Sonné', 'À Terre', 'Brisé',
];

/** Règles d'action / posture (après les temps forts et les États). */
const ACTION_RULES: Rule[] = [
  { re: /\bcharge\b/i, icon: '✊', important: true },
  { re: /défensiv/i, icon: '🛡️', important: true },
  { re: /\bvise\b|viser|en joue/i, icon: '🎯', important: true },
  { re: /focalisation/i, icon: '🔮', important: true },
  { re: /frénési/i, icon: '🐗', important: true },
  { re: /incante|sortilège|\bsort\b|bénédiction|invoque|miracle|\bprière\b/i, icon: '✨', important: true },
  { re: /utilise/i, icon: '🧪', important: true },
  { re: /soigne|guéri|\+\d+\s*(blessure|pb)/i, icon: '❤️‍🩹', important: true },
  { re: /se désengage|s'enfuit|\bfuit\b|\bfuir\b/i, icon: '🏃', important: true },
  { re: /\btires?\b|\btir\b/i, icon: '🏹', important: true },
  { re: /attaque|frappe|riposte/i, icon: '⚔️', important: true },
  { re: /esquive/i, icon: '🤸', important: false },
  { re: /\bpare\b|parade|dévie/i, icon: '🛡️', important: false },
  { re: /recharge/i, icon: '🔁', important: false },
  { re: /se déplace|déplacement|se relève|\brampe\b|enfourche|descend de/i, icon: '👣', important: false },
  { re: /\d+\s*(dégât|blessure)/i, icon: '💥', important: false },
];

function classify(line: string): { icon: string; important: boolean } {
  for (const r of HEAD_RULES) if (r.re.test(line)) return { icon: r.icon, important: r.important };
  for (const name of STATE_NAMES) {
    if (line.includes(name)) {
      const m = conditionMeta(name);
      return { icon: m.icon, important: m.important };
    }
  }
  for (const r of ACTION_RULES) if (r.re.test(line)) return { icon: r.icon, important: r.important };
  return { icon: '•', important: false };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Découpe la ligne en segments, colorant chaque occurrence d'un nom de combattant par son camp. */
function colorize(line: string, combatants: ComLite[]): NarratedSegment[] {
  const named = combatants.filter((c) => c.name && c.name.trim());
  if (!named.length) return [{ text: line }];

  const teamOf = new Map<string, 'ally' | 'enemy'>();
  for (const c of named) if (!teamOf.has(c.name)) teamOf.set(c.name, c.kind === 'hero' ? 'ally' : 'enemy');

  // Noms uniques, du plus long au plus court (évite « Rat » de mordre dans « Rat géant »).
  const names = [...new Set(named.map((c) => c.name))].sort((a, b) => b.length - a.length);
  const re = new RegExp('(' + names.map(escapeRe).join('|') + ')', 'g');

  const segs: NarratedSegment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) segs.push({ text: line.slice(last, m.index) });
    segs.push({ text: m[0], team: teamOf.get(m[0]) });
    last = m.index + m[0].length;
  }
  if (last < line.length) segs.push({ text: line.slice(last) });
  return segs.length ? segs : [{ text: line }];
}

/** Narre une ligne de journal : icône unifiée + importance + segments colorés par camp. */
export function narrateLine(line: string, combatants: ComLite[] = []): NarratedLine {
  const { icon, important } = classify(line);
  return { raw: line, icon, important, segments: colorize(line, combatants) };
}

/** Les `max` derniers événements IMPORTANTS (pour le bandeau haut), ordre chronologique préservé. */
export function combatFeed(lines: string[], combatants: ComLite[] = [], max = 3): NarratedLine[] {
  const important = lines.map((l) => narrateLine(l, combatants)).filter((n) => n.important);
  return important.slice(-max);
}
