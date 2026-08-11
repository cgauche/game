/**
 * BANDES de FIN DE COMBAT (#1117 L4) — fabrique UNIQUE des fenêtres de jets de bilan de combat
 * (Contraction de maladie, Exposition à la Corruption).
 *
 * « Une situation = une fenêtre » : les Tests que la MÊME entrée de règle réclame à N personnages ne
 * sont plus N étapes MONO qui défilent, mais UNE bande dont les appelés sont les RANGÉES
 * (`BatchParticipant`, jets INDÉPENDANTS `aggregate:'none'`) — calque exact des bandes de Psychologie
 * (L1/L2) et de nuit (L3, `nightBands`).
 *
 * CLÉ d'une bande = (`kind`, ENTRÉE DE RÈGLE). L'entrée en fait partie, et la maladie SEULE ne suffit
 * pas : deux entrées DISTINCTES peuvent réclamer le MÊME id de maladie au MÊME personnage —
 * l'Infection Mineure d'après Blessure critique (LDB 20 l.90) et la Contagion d'une créature Infectée
 * (LDB 20 l.25/l.51) produisent toutes deux `infection-mineure` chez un blessé exposé. Les fondre
 * donnerait une bande à DEUX rangées de même id, injoignables (les surfaces de rangée keyent par id
 * nu : `rollFlowFactory`, `CascadeModal`). Filet de dernier recours au même endroit (`bandStepId`,
 * calque `nightBands`) : une rangée dont l'id est DÉJÀ pris ouvre une bande de PLUS — c'est lui qui
 * tient les étapes LEGACY d'une sauvegarde, qui ne portent aucun discriminant d'entrée.
 */
import type { CascadeStep, CascadeStepMeta, BatchParticipant } from './pendings';
import { bandStep, bandStepId, bandCommonMeta, type BandSpec } from './rollSeam';

/** Les `kind` d'étape que cette fabrique regroupe — ceux dont l'applier exige des RANGÉES. */
const COMBAT_END_KINDS = new Set(['combatEndDisease', 'combatEndCorruption']);

/** Champs du jet MONO qui DESCENDENT sur la rangée (le reste — icône, enjeu, libellé de situation —
 *  appartient à la bande : c'est l'entrée de règle qui les porte). */
const ROW_FIELDS = ['base', 'target', 'mods', 'clamped', 'difficulty', 'menace'] as const;

/** Champs de JEU DÉJÀ POSÉ qui descendent aussi sur la rangée (influences, issue) — vides sur toute
 *  étape fraîchement construite, peuplés sur une étape venue d'une sauvegarde. */
const PLAY_FIELDS = ['rerolled', 'forced', 'fixed', 'outcome'] as const;

/** Discriminants d'ENTRÉE DE RÈGLE d'une étape de fin de combat, lus dans son `meta` : l'entrée
 *  (`entry` — Infection post-critique vs Contagion vs suites d'opération), la maladie visée et le
 *  Degré d'exposition à la Corruption. Une étape LEGACY (sauvegarde d'avant L4) n'a pas d'`entry` :
 *  le filet d'id de `combatEndBands` la sépare quand même de sa jumelle. */
const ENTRY_KEYS = ['entry', 'disease', 'level'] as const;

/** Fragments d'entrée de règle d'une étape, dans l'ordre de `ENTRY_KEYS` (vides écartés). */
function entryParts(meta: CascadeStepMeta | undefined): string[] {
  return ENTRY_KEYS.map((k) => (meta?.[k] === undefined ? '' : String(meta[k]))).filter(Boolean);
}

/** CLÉ de bande d'une étape de fin de combat : (`kind`, entrée de règle). PRIVÉE — la clé n'est le
 *  vocabulaire de personne au-dehors ; la fabrique est la seule surface publique. */
function combatEndBandKey(step: CascadeStep): string {
  return `${step.kind}|${ENTRY_KEYS.map((k) => (step.meta?.[k] === undefined ? '' : String(step.meta[k]))).join('|')}`;
}

/** Une étape MONO peut-elle rejoindre une bande ? Test de bilan de combat à JET porté par un acteur —
 *  une étape déjà en bande, un choix, ou une étape sans cible passent telles quelles. */
function bandable(step: CascadeStep): boolean {
  return COMBAT_END_KINDS.has(step.kind) && !step.participants && !step.options
    && typeof step.actorId === 'string' && step.target != null;
}

/** RANGÉE dérivée d'une étape MONO — le jet descend, la situation reste à la bande. Les champs de JEU
 *  DÉJÀ POSÉ (résultat, influences, issue) descendent aussi : une étape venue d'une save peut avoir
 *  été lancée avant la sauvegarde. Le `meta` ENTIER voyage sur la rangée : ce qui diverge d'un porteur
 *  à l'autre (l'incubation « Instantanée » d'un Contagieux) n'est lisible que là. */
function combatEndRow(step: CascadeStep): BatchParticipant {
  const row: Record<string, unknown> = { id: step.actorId, interactive: true, result: step.result ?? null, label: step.rollLabel };
  for (const f of ROW_FIELDS) if (step[f] !== undefined) row[f] = step[f];
  for (const f of PLAY_FIELDS) if (step[f] !== undefined) row[f] = step[f];
  if (step.meta) row.meta = step.meta;
  return row as unknown as BatchParticipant;
}

/**
 * FABRIQUE : regroupe des étapes MONO de fin de combat en BANDES, dans l'ordre de leur PREMIÈRE
 * émission. Les étapes hors périmètre (autre `kind`, bande déjà formée, pas de porteur ni de cible)
 * traversent INTACTES, à leur place. SOURCE UNIQUE de la conversion : la migration de sauvegarde
 * (`MIGRATIONS[19]`) l'appelle, elle ne redécrit pas une forme cible qui dériverait ensuite.
 *
 * La POSSESSION des bandes est celle du socle (`bandStep`, #1262) : plusieurs porteurs →
 * `groupOwner`, un seul → SON `actorId`.
 *
 * L'`id` de bande est dérivé de la CLÉ (jamais du premier `step.id`, qui nomme un porteur) : deux
 * bandes de la même séquence ne peuvent donc pas se confondre, et le rang de dédoublement (`#n`) du
 * filet d'id est porté à côté. Ids RUNTIME-ONLY : aucune sauvegarde ne les rejoue (elle restaure la
 * séquence telle quelle ; `MIGRATIONS[19]` les reconstruit par cette même fabrique).
 */
export function combatEndBands(steps: CascadeStep[]): CascadeStep[] {
  const out: CascadeStep[] = [];
  const bands = new Map<string, { spec: BandSpec; rows: BatchParticipant[]; metas: (CascadeStepMeta | undefined)[]; at: number }>();
  for (const step of steps) {
    if (!bandable(step)) { out.push(step); continue; }
    const cle = combatEndBandKey(step);
    const key = bandStepId(bands, cle, step.actorId!);
    const held = bands.get(key);
    if (held) { held.rows.push(combatEndRow(step)); held.metas.push(step.meta); continue; }
    const n = key === cle ? 1 : Number(key.slice(cle.length + 1));
    const spec: BandSpec = {
      id: ['bande', step.kind, ...entryParts(step.meta)].join('-') + (n > 1 ? `#${n}` : ''),
      kind: step.kind,
      ...(step.label !== undefined ? { label: step.label } : {}),
      ...(step.icon ? { icon: step.icon } : {}),
      ...(step.stake ? { stake: step.stake } : {}),
      ...(step.menace ? { menace: step.menace } : {}),
    };
    bands.set(key, { spec, rows: [combatEndRow(step)], metas: [step.meta], at: out.length });
    out.push(step); // place RÉSERVÉE : la bande la remplace une fois toutes ses rangées connues
  }
  for (const { spec, rows, metas, at } of bands.values()) {
    const meta = bandCommonMeta(metas);
    const band = bandStep({ ...spec, ...(meta ? { meta } : {}) }, rows);
    if (band) out[at] = band;
  }
  return out;
}

/** CHARGE utile d'une rangée de bande de fin de combat : le `meta` de la BANDE (l'entrée de règle
 *  commune) enrichi de celui de la RANGÉE (ce qui diverge par porteur). SOURCE UNIQUE de lecture des
 *  appliers — une bande venue d'une save porte l'un, l'autre, ou les deux. */
export function combatEndRowMeta(band: CascadeStep, row: BatchParticipant): CascadeStepMeta {
  return { ...band.meta, ...row.meta };
}
