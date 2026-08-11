/**
 * BANDES de la NUIT (#1117 L3) — fabrique UNIQUE des fenêtres de jets de nuit.
 *
 * « Une situation = une fenêtre » : les Tests de nuit qui répondent à la MÊME entrée de règle le MÊME
 * jour ne sont plus N étapes MONO qui défilent, mais UNE bande dont les héros appelés sont les RANGÉES
 * (`BatchParticipant`, jets INDÉPENDANTS `aggregate:'none'`) — calque exact des bandes de Psychologie
 * (L1/L2, `encounterPsychFlow`/`combatFlow`).
 *
 * CLÉ d'une bande = (entrée de RÈGLE, JOUR). Le jour EN FAIT PARTIE : `runDailyUpkeep` boucle sur les
 * journées franchies (`upkeep.ts`), donc un saut de 3 jours émet 3 Tests de Dessoûlage pour le MÊME
 * héros — trois rangées de même id dans une seule bande seraient INJOIGNABLES (les surfaces de rangée
 * keyent par id nu : `rollFlowFactory`, `CascadeModal`). Filet de dernier recours au même endroit :
 * une rangée dont l'id est DÉJÀ pris ouvre une bande de plus (deux Convalescences échéant le même jour
 * chez le même héros), jamais un doublon.
 *
 * EAGER partout comme avant, SAUF deux endroits où l'état lu doit être POSTÉRIEUR :
 *  - abri → Exposition (l'abri décide du nombre de jets, `restFlow`) ;
 *  - vague N → vague N+1 d'Exposition (`nextExposureWave`) : l'escalade cumulative (LDB 18 l.330/334)
 *    compte les échecs déjà subis, et un délestage de Possession lourde (l.332) en ANNULE un — une
 *    vague construite avant la résolution des délestages compterait des échecs annulés.
 */
import type { CascadeStep, BatchParticipant, CascadeRoll } from './pendings';
import type { Combatant } from '../engine/types';
import type { Get, Set } from './flowTypes';
import { isNightTestKind } from '../engine/types';
import { registerCascadeApplier } from './cascade';
import { actorIn } from './combatants';
import { resultLines, bandStep, bandStepId, type Consequence, type BandSpec } from './rollSeam';
import { sealskinDR, type ExposureKind } from '../engine/exposure';

/** Champs du jet MONO qui DESCENDENT sur la rangée (le reste — icône, enjeu, libellé de situation —
 *  appartient à la bande : c'est l'entrée de règle qui les porte). */
const ROW_FIELDS = ['base', 'target', 'mods', 'clamped', 'difficulty', 'menace'] as const;

/** Champs de JEU DÉJÀ POSÉ qui descendent aussi sur la rangée (influences, issue) — vides sur toute
 *  étape fraîchement construite, peuplés sur une étape venue d'une sauvegarde. */
const PLAY_FIELDS = ['rerolled', 'forced', 'fixed', 'outcome'] as const;

/** Discriminant d'ENTRÉE DE RÈGLE d'une étape de nuit, lu dans son `meta` : la maladie et son symptôme
 *  (`diseaseTick`/`diseaseGangrene`/`diseasePersist`/`contagion` sont des entrées DIFFÉRENTES), le volet
 *  froid/chaleur de l'Exposition (LDB 18 l.330 vs l.334) et sa VAGUE. */
function bandEntry(step: CascadeStep): string {
  const m = step.meta ?? {};
  return [m.diseaseName, m.symptomId, m.kind, m.wave].map((v) => (v === undefined ? '' : String(v))).join('|');
}

/** CLÉ de bande d'une étape de nuit : (`kind`, entrée de règle, JOUR). */
export function nightBandKey(step: CascadeStep): string {
  return `${step.kind}|${bandEntry(step)}|${step.meta?.day ?? ''}`;
}

/** Une étape MONO peut-elle rejoindre une bande ? Test de nuit à JET porté par un acteur — un CHOIX
 *  (`exposure-heat-drop`) reste MONO (`stepReady` exige `result` sur les rangées d'une bande, et le
 *  choix se pose au niveau ÉTAPE : `setCascadeChoice`), et une étape déjà en bande passe telle quelle. */
function bandable(step: CascadeStep): boolean {
  return isNightTestKind(step.kind) && !step.participants && !step.options
    && typeof step.actorId === 'string' && step.target != null;
}

/** `meta` COMMUN à toutes les rangées d'une bande (l'entrée de règle mise en jeu — c'est lui que lit
 *  `applyNightStake`). Ce qui DIVERGE d'un héros à l'autre (Bonus d'Endurance de la Gangrène, siège
 *  d'une Convalescence) reste sur la rangée. */
function commonMeta(metas: (CascadeStep['meta'] | undefined)[]): CascadeStep['meta'] | undefined {
  const first = metas[0];
  if (!first) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(first)) {
    const j = JSON.stringify(v);
    if (metas.every((m) => m && JSON.stringify(m[k]) === j)) out[k] = v;
  }
  return Object.keys(out).length ? (out as CascadeStep['meta']) : undefined;
}

/** RANGÉE dérivée d'une étape MONO de nuit — le jet descend, la situation reste à la bande. Les
 *  champs de JEU DÉJÀ POSÉ (résultat, influences, issue) descendent aussi : une étape venue d'une
 *  save (MIGRATIONS[17]) peut avoir été lancée avant la sauvegarde. */
function nightRow(step: CascadeStep): BatchParticipant {
  const row: Record<string, unknown> = { id: step.actorId, interactive: true, result: step.result ?? null, label: step.rollLabel };
  for (const f of ROW_FIELDS) if (step[f] !== undefined) row[f] = step[f];
  for (const f of PLAY_FIELDS) if (step[f] !== undefined) row[f] = step[f];
  if (step.meta) row.meta = step.meta;
  return row as unknown as BatchParticipant;
}

/**
 * FABRIQUE : regroupe des étapes MONO de nuit en BANDES, dans l'ordre de leur PREMIÈRE émission. Les
 * étapes hors périmètre (kind hors vocabulaire de nuit, choix, bande déjà formée) traversent INTACTES,
 * à leur place. Ajouter un `kind` de nuit ne coûte rien ici : la clé se dérive de l'étape.
 *
 * La POSSESSION des bandes est celle du socle (`bandStep`, #1262/#1268) : plusieurs dormeurs →
 * `groupOwner`, un seul → SON `actorId`. Sans elle, l'arbitre (`modalArbiter`) rendait la fenêtre à
 * l'HÔTE SEUL et le siège qui tient le dormeur ne voyait jamais la rangée où se joue son jet de nuit.
 * Le DÉDOUBLEMENT de CLÉ (`bandStepId`) est celui du socle aussi — un seul compteur `#n`, jamais deux.
 * Il ne dit RIEN de l'unicité des `id` produits : cf. la borne au site de l'`id` ci-dessous.
 */
export function nightBands(steps: CascadeStep[]): CascadeStep[] {
  const out: CascadeStep[] = [];
  const bands = new Map<string, { spec: BandSpec; rows: BatchParticipant[]; metas: (CascadeStep['meta'] | undefined)[]; at: number }>();
  for (const step of steps) {
    if (!bandable(step)) { out.push(step); continue; }
    // Deux jets de MÊME entrée le MÊME jour chez le MÊME héros (deux Convalescences échéant ensemble) :
    // une rangée par id, donc une bande de plus — jamais deux rangées injoignables DANS une bande.
    // BORNE de cette garantie : elle porte sur les RANGÉES, pas sur l'id des bandes produites (cf. `id`
    // ci-dessous, dont le discriminant `day` court-circuite le rang de dédoublement).
    const cle = nightBandKey(step);
    const key = bandStepId(bands, cle, step.actorId!);
    const held = bands.get(key);
    if (held) { held.rows.push(nightRow(step)); held.metas.push(step.meta); continue; }
    // Rang de dédoublement de cette clé (`clé`, `clé#2`…) — l'id de bande s'en sert à défaut de jour.
    const n = key === cle ? 1 : Number(key.slice(cle.length + 1));
    const spec: BandSpec = {
      // L'id de bande porte le DISCRIMINANT de sa clé (le jour, sinon le rang de dédoublement) : deux
      // insertions issues du MÊME `step.id` à des jours différents — la gueule de bois de deux
      // Dessoûlages, `dessoulageHangover-<héros>` — se retrouveraient sinon avec le MÊME id dans la
      // séquence, et le seul lookup-par-id de prod (`meta.nextWaveOf`) comme les coordonnées de rangée
      // (`nightRowId`) viseraient la mauvaise fenêtre.
      // TROU MESURÉ, antérieur à cette fabrique et NON refermé ici : les deux discriminants sont
      // EXCLUSIFS (`day ?? n`) — quand le jour existe, le rang de dédoublement est jeté, donc deux
      // bandes dédoublées le MÊME jour (deux Convalescences du même héros) sortent avec le MÊME id.
      // Collision constructible ; sa fermeture appartient au murage (elle change des ids persistés).
      id: `bande-${step.id}-${step.meta?.day ?? n}`, kind: step.kind, label: step.label ?? '',
      ...(step.icon ? { icon: step.icon } : {}),
      ...(step.stake ? { stake: step.stake } : {}),
      ...(step.menace ? { menace: step.menace } : {}),
    };
    bands.set(key, { spec, rows: [nightRow(step)], metas: [step.meta], at: out.length });
    out.push(step); // place RÉSERVÉE : la bande la remplace une fois toutes ses rangées connues
  }
  for (const { spec, rows, metas, at } of bands.values()) {
    const meta = commonMeta(metas);
    const band = bandStep({ ...spec, ...(meta ? { meta } : {}) }, rows);
    if (band) out[at] = band;
  }
  return out;
}

/** Conséquence d'UNE RANGÉE de bande de nuit — calque de `CascadeApplier`, joué par porteur : `row`
 *  porte le jet ET la charge utile propre au héros (`row.meta`), la bande porte l'entrée de règle. */
export type NightRowApplier = (
  get: Get,
  set: Set,
  band: CascadeStep,
  row: BatchParticipant,
  hero: Combatant,
  ctx: { steps: CascadeStep[]; index: number },
) => { consequences?: Consequence[]; insert?: CascadeStep[] } | void;

/** DÉNOUEMENT de BANDE : décide de la liste FINALE d'étapes insérées, à partir de ce que les rangées
 *  ont demandé. Un `kind` qui n'en fournit pas fait passer les insertions par la fabrique (défaut).
 *  Seule l'Exposition en a besoin : ses délestages restent MONO et sa vague suivante ne se construit
 *  qu'APRÈS eux. */
export type NightBandApplier = (
  get: Get,
  set: Set,
  band: CascadeStep,
  ctx: { steps: CascadeStep[]; index: number },
  rowInserts: CascadeStep[],
) => CascadeStep[];

/**
 * Enregistre la conséquence d'un `kind` de nuit SOUS FORME DE BANDE : la boucle par rangée (verdict sur
 * SA rangée, portrait attributeur) est écrite ICI une fois pour toutes, et les étapes INSÉRÉES par les
 * rangées repassent par la fabrique — c'est ainsi que le second Test du dessoûlage (LDB 09 l.485) fait
 * UNE bande de gueule de bois et non N étapes. Une étape sans rangées RENONCE (fail-closed) : plus
 * aucun `kind` de nuit ne s'applique en MONO depuis L3.
 */
export function registerNightBandApplier(kind: string, rowFn: NightRowApplier, bandFn?: NightBandApplier): void {
  registerCascadeApplier(kind, (get, set, step, _hero, ctx) => {
    if (!step.participants) return;
    const insert: CascadeStep[] = [];
    for (const row of step.participants) {
      const hero = actorIn(get(), row.id);
      if (!hero || !row.result) { row.outcome = []; continue; }
      const out = rowFn(get, set, step, row, hero, ctx);
      const lines = out?.consequences ? resultLines(out.consequences) : [];
      row.outcome = lines;
      for (const l of lines) get().log(l.text);
      if (out?.insert?.length) insert.push(...out.insert);
    }
    set({ party: [...get().party] });
    return { consequences: [], insert: bandFn ? bandFn(get, set, step, ctx, insert) : nightBands(insert) };
  });
}

/**
 * SCINDE une bande en deux selon un prédicat sur le PORTEUR de chaque rangée — la fenêtre reste UNE
 * par entrée de règle, mais ses rangées peuvent relever de DEUX pilotes (fin de combat : un héros
 * piloté-humain-manuel joue son jet, un témoin est résolu d'office). Chaque moitié est une bande
 * ENTIÈRE, jamais une rangée `interactive:false` glissée dans la bande interactive : le pilote
 * interactif n'auto-roule pas les témoins (`rollBatchParticipants` n'est appelé que par
 * `resolveRemainingCascade`/`runCascadeImmediate`) et la conséquence d'un témoin y serait perdue.
 */
export function splitBandRows(band: CascadeStep, keep: (rowId: string) => boolean): { kept?: CascadeStep; others?: CascadeStep } {
  const rows = band.participants ?? [];
  const a = rows.filter((r) => keep(r.id));
  const b = rows.filter((r) => !keep(r.id));
  return {
    ...(a.length ? { kept: { ...band, participants: a } as CascadeStep } : {}),
    ...(b.length ? { others: { ...band, id: `${band.id}#auto`, participants: b } as CascadeStep } : {}),
  };
}

/** Clé d'une RANGÉE dans la cascade (bande + porteur) — coordonnée que porte le délestage qui ANNULE
 *  son échec (`meta.cancelsRowId`) : l'adjacence `steps[idx+1]` d'avant les bandes ne peut plus dire
 *  QUELLE rangée un choix tranche. */
export function nightRowId(band: CascadeStep, row: BatchParticipant): string {
  return `${band.id}:${row.id}`;
}

/** Échec GENUINE d'Exposition : la peau de phoque (MDG 14 l.277) retient AU FROID un échec de justesse
 *  (+1 DR) — il ne compte alors ni comme conséquence ni dans l'escalade. */
export function genuineExposureFail(hero: Combatant, kind: ExposureKind, r: CascadeRoll | null | undefined): boolean {
  if (!r || r.success) return false;
  const skin = kind === 'froid' ? sealskinDR(hero) : 0;
  return !(skin > 0 && r.sl + skin >= 1);
}

/** Échecs d'Exposition DÉJÀ subis par un héros pour CE volet (LDB 18 l.330/334, escalade cumulative),
 *  hors ceux ANNULÉS par un délestage de Possession lourde (l.332) : parcourt les bandes d'Exposition
 *  DÉJÀ jouées et les choix `exposure-heat-drop` qui les tranchent (`meta.cancelsRowId`). */
export function exposurePriorFails(steps: CascadeStep[], hero: Combatant, kind: ExposureKind): number {
  const cancelled = new Set<string>();
  for (const s of steps) {
    if (s.kind !== 'exposure-heat-drop' || s.chosen !== 'jeter') continue;
    const id = s.meta?.cancelsRowId;
    if (typeof id === 'string') cancelled.add(id);
  }
  let n = 0;
  for (const s of steps) {
    if (s.kind !== 'exposure' || !s.participants) continue;
    if (((s.meta?.kind as ExposureKind) ?? 'froid') !== kind) continue;
    for (const row of s.participants) {
      if (row.id !== hero.id || cancelled.has(nightRowId(s, row))) continue;
      if (genuineExposureFail(hero, kind, row.result)) n++;
    }
  }
  return n;
}

/**
 * VAGUE SUIVANTE d'Exposition (LDB 18 l.326-334) — matérialisée seulement quand la précédente est
 * TRANCHÉE (délestages compris) : les rangées sont celles de la vague courante (même ligne de jet, les
 * campeurs ne changent pas), remises à zéro et RE-DOTÉES de leur escalade (`meta.priorFails`) lue sur
 * les étapes déjà jouées. `[]` quand la dernière vague vient d'être jouée. SOURCE UNIQUE des TROIS
 * producteurs d'Exposition (nuit de repos, effet de scène `exposureNight`, entretien de mer).
 */
export function nextExposureWave(get: Get, band: CascadeStep, steps: CascadeStep[]): CascadeStep[] {
  const wave = Number(band.meta?.wave ?? 0) + 1;
  if (wave >= Number(band.meta?.waves ?? 1)) return [];
  const kind = (band.meta?.kind as ExposureKind) ?? 'froid';
  const rows = (band.participants ?? []).map((row) => {
    const hero = actorIn(get(), row.id);
    const meta = { ...row.meta, priorFails: hero ? exposurePriorFails(steps, hero, kind) : 0 };
    return { ...row, result: null, outcome: undefined, rerolled: undefined, forced: undefined, immune: undefined, fixed: undefined, meta };
  });
  return [{ ...band, id: `${String(band.id).split('#w')[0]}#w${wave}`, participants: rows,
    committed: undefined, outcome: undefined, result: undefined,
    meta: { ...band.meta, wave } } as CascadeStep];
}

/** Bande d'Exposition d'une PREMIÈRE vague, à partir des étapes MONO d'un producteur : chaque rangée
 *  entre à escalade NULLE (aucun Test d'Exposition n'a encore été subi dans cette séquence) et la bande
 *  porte le nombre TOTAL de vagues, que `nextExposureWave` déroule. `[]` sans campeur ni vague. */
export function exposureWaveBand(monoSteps: CascadeStep[], kind: ExposureKind, waves: number): CascadeStep[] {
  if (!monoSteps.length || waves <= 0) return [];
  const seeded = monoSteps.map((s) => ({ ...s, meta: { ...s.meta, kind, priorFails: 0 } }));
  const bands = nightBands(seeded);
  return bands.map((b) => ({ ...b, meta: { ...b.meta, kind, wave: 0, waves } }) as CascadeStep);
}
