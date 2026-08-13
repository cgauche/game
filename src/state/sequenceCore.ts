/**
 * L'IMPLÉMENTATION LÉGÈRE DU CONTRAT D'ORCHESTRATEUR (#1279) — celle qui joue les systèmes SIMPLES
 * sans cérémonie : un jeu de taverne opposé n'y coûte QUE son entrée de donnée, une poursuite n'y
 * déclare que sa manche et son réducteur. Le CONTRAT (ce qu'un système déclare : état, fabrique de
 * manche, clôture-sous-id) vit à côté, dans `sequenceContract.ts`, et ne connaît AUCUNE de ses
 * implémentations : un système lourd pourra en écrire une autre sans le toucher.
 *
 * CE QUE CETTE IMPLÉMENTATION POSSÈDE, et que plus aucun système ne recopie :
 *  - le REGISTRE des définitions (l'id est la donnée, la fonction est du TS enregistré — patron
 *    `registerCascadeApplier` : un état de séquence se snapshote en JSON, une closure y serait
 *    effacée en silence) ;
 *  - la PERSISTANCE de l'état entre les manches (slot `sequence`, snapshoté avec la partie) ;
 *  - le CYCLE ouvrir→clore→rouvrir : l'ouverture par les mints (`openSequence` — un littéral d'étape
 *    n'entre pas) et la résolution IMMÉDIATE quand aucune fenêtre n'est à montrer ;
 *  - l'ACCUMULATEUR PAR CAMP (`cum: Record<camp, total>` + `sequenceCumStep`, qui délègue au Test
 *    étendu canonique `extendedTestStep`) — jamais un `cumPlayer`/`cumOpponent` recopié par jeu ;
 *  - la FORMULE DE SCORE par camp (`registerSequenceScore`, paramétrée par la donnée : `min` pour les
 *    poursuivis, `max` pour les poursuivants, `sum` pour une équipe) ;
 *  - le DÉPARTAGE D'ÉGALITÉ (`registerSequenceTieBreak`, paramétré par la donnée : Dominos NADAJ 16
 *    l.107, Boules l.57) — jamais un branchement par id de jeu ;
 *  - la BORNE ANTI-BOUCLE (`SEQUENCE_MAX_ROUNDS`) : une séquence qui ne conclut pas S'ARRÊTE.
 *
 * DEUX PRIMITIVES RESTENT CHEZ ELLES tant qu'aucune manche ne les joue : la table par fourchette
 * (`findTableEntry`, `engine/tables.ts`) et les effets par manche (`applyOps`, `engine/ops.ts`). Elles
 * s'ajoutent à `SequenceParams` avec le système qui les exerce — le socle ne porte que du vocabulaire vivant.
 */
import type { Get, Set } from './flowTypes';
import type { PendingCascade } from './pendings';
import { openSequence } from './rollSeam';
import {
  SEQUENCE_MAX_ROUNDS, SEQUENCE_PURPOSE, SEQUENCE_BORNE,
  type SequenceDef, type SequenceParams, type SequenceState,
} from './sequenceContract';
import { runCascadeImmediate } from './cascade';
import { extendedTestStep } from '../engine/tests';
import { battleRng } from './battleRng';
import { t } from '../i18n';

/** LE CONTRAT, ré-exporté par son implémentation : un système n'a qu'une porte d'entrée à importer.
 *  Sa définition, elle, vit dans `sequenceContract.ts` — qui n'importe RIEN d'ici. */
export {
  SEQUENCE_MAX_ROUNDS, SEQUENCE_PURPOSE, SEQUENCE_BORNE,
} from './sequenceContract';
export type {
  SequenceDef, SequenceParams, SequenceState, SequenceRound, SequenceVerdict, SequenceCloseCtx,
} from './sequenceContract';

/** Registre des définitions, peuplé par les modules de DOMAINE à leur chargement. */
const sequenceDefs: Record<string, SequenceDef<never>> = {};

/** Enregistre (ou remplace) la définition d'une séquence sous son id. */
export function registerSequence<P>(id: string, def: SequenceDef<P>): void {
  sequenceDefs[id] = def as unknown as SequenceDef<never>;
}

/** La définition d'un id, ou `undefined` (état restauré d'une save dont le module n'a pas chargé). */
export function sequenceDefOf(id: string): SequenceDef<never> | undefined {
  return sequenceDefs[id];
}

/* ── FAMILLE (3) : FORMULE DE SCORE PAR CAMP ─────────────────────────────────────────────────────
 * Un camp rend UN nombre à partir des DR de ses participants. Poursuite (LDB 15 l.93) : les poursuivis
 * comptent leur DR le plus BAS, les poursuivants le plus HAUT. Middenball (NADAJ 16 l.121) : la SOMME
 * de l'équipe. La formule est un id en donnée (`params.score`), jamais un `if` par jeu. */
export type SequenceScore = (values: readonly number[]) => number;

const sequenceScores: Record<string, SequenceScore> = {
  min: (v) => (v.length ? Math.min(...v) : 0),
  max: (v) => (v.length ? Math.max(...v) : 0),
  sum: (v) => v.reduce((n, x) => n + x, 0),
  first: (v) => v[0] ?? 0,
};

/** Enregistre (ou remplace) une formule de score de camp. */
export function registerSequenceScore(id: string, fn: SequenceScore): void {
  sequenceScores[id] = fn;
}

/** Applique la formule de score du camp — id inconnu : `sum` (aucun camp ne perd son score). */
export function sequenceScoreOf(id: string | undefined, values: readonly number[]): number {
  const fn = (id ? sequenceScores[id] : undefined) ?? sequenceScores.sum;
  return fn(values);
}

/* ── FAMILLE (1bis) : DÉPARTAGE D'ÉGALITÉ DÉCLARÉ ────────────────────────────────────────────────
 * Deux camps à égalité : ce que le jeu en fait est un PARAMÈTRE (`params.tieBreak`), résolu par un
 * réducteur enregistré. `units-lowest` = Dominos (NADAJ 16 l.107) ; `nul` = Boules (l.57). */
export interface SequenceTieSide {
  /** Le d100 obtenu — son chiffre des unités est le « dé d'unités » du départage. */
  roll: number;
  sl: number;
}
export type SequenceTieBreak = (a: SequenceTieSide, b: SequenceTieSide) => 'a' | 'b' | 'tie';

const sequenceTieBreaks: Record<string, SequenceTieBreak> = {
  /** L'égalité reste une égalité. */
  nul: () => 'tie',
  /** « les joueurs comparent le résultat de leur dé d'unités pour ce Test. Celui qui a le nombre le
   *  plus bas gagne » (NADAJ 16 l.107). Le chiffre des unités d'un d100 : 100 → 0. */
  'units-lowest': (a, b) => {
    const ua = a.roll % 10;
    const ub = b.roll % 10;
    return ua < ub ? 'a' : ub < ua ? 'b' : 'tie';
  },
};

/** Enregistre (ou remplace) un départage d'égalité. */
export function registerSequenceTieBreak(id: string, fn: SequenceTieBreak): void {
  sequenceTieBreaks[id] = fn;
}

/** Départage une égalité selon l'id DÉCLARÉ. Aucun id (ou id inconnu) : l'égalité reste. */
export function resolveSequenceTie(id: string | undefined, a: SequenceTieSide, b: SequenceTieSide): 'a' | 'b' | 'tie' {
  const fn = id ? sequenceTieBreaks[id] : undefined;
  return fn ? fn(a, b) : 'tie';
}

/* ── FAMILLE (1) : ACCUMULATEUR PAR CAMP ─────────────────────────────────────────────────────────*/

/** Un pas de cumul POUR UN CAMP — délègue au Test étendu canonique (`extendedTestStep`, LDB 12
 *  l.170-179 : le DR du Round s'ajoute, le total est planché à 0, `done` à la cible). Le socle
 *  l'appelle UNE FOIS PAR CAMP sur le MÊME état : plus aucun jeu ne tient deux compteurs jumeaux. */
export function sequenceCumStep<P>(
  seq: SequenceState<P>,
  camp: string,
  r: { success: boolean; sl: number },
): { total: number; done: boolean } {
  return extendedTestStep(seq.cum[camp] ?? 0, r, seq.params.target ?? Number.POSITIVE_INFINITY);
}

/** Les cumuls de TOUS les camps après leur manche — un seul appel, un Record neuf. */
export function sequenceCumRound<P>(
  seq: SequenceState<P>,
  rounds: Record<string, { success: boolean; sl: number }>,
): { cum: Record<string, number>; done: string[] } {
  const cum: Record<string, number> = { ...seq.cum };
  const done: string[] = [];
  for (const [camp, r] of Object.entries(rounds)) {
    const step = sequenceCumStep(seq, camp, r);
    cum[camp] = step.total;
    if (step.done) done.push(camp);
  }
  return { cum, done };
}

/* ── LE CYCLE : ouvrir → clore → rouvrir/dénouer ─────────────────────────────────────────────────*/

/** Borne EFFECTIVE de manches (jamais au-dessus de l'invariant du socle). */
function borneOf(params: SequenceParams): number {
  return Math.min(params.maxRounds ?? SEQUENCE_MAX_ROUNDS, SEQUENCE_MAX_ROUNDS);
}

/**
 * DÉMARRE une séquence : pose son état PUIS ouvre la 1ʳᵉ manche. `def` doit être enregistrée (un id
 * inconnu ne pose rien — mieux vaut aucune séquence qu'une séquence qu'aucun réducteur ne clôt).
 */
export function startSequence<P>(
  get: Get, set: Set,
  init: { def: string; params?: SequenceParams; payload: P; cum?: Record<string, number> },
): void {
  if (!sequenceDefOf(init.def)) {
    console.error(`[sequence] définition « ${init.def} » inconnue — aucune séquence ouverte.`);
    return;
  }
  const state: SequenceState<P> = {
    def: init.def, round: 0, cum: init.cum ?? {}, params: init.params ?? {}, payload: init.payload,
  };
  set({ sequence: state as SequenceState });
  openSequenceRound(get, set);
}

/** La séquence EN COURS, typée par son domaine (le socle ne vérifie pas la charge : elle est à lui). */
export function activeSequence<P>(get: Get): SequenceState<P> | null {
  return (get().sequence as SequenceState<P> | null) ?? null;
}

/** Met à jour la charge utile de la séquence en cours (le domaine possède `payload`, pas le socle). */
export function setSequencePayload<P>(get: Get, set: Set, payload: P): void {
  const seq = activeSequence<P>(get);
  if (!seq) return;
  set({ sequence: { ...seq, payload } as SequenceState });
}

/** Retire la séquence en cours (dénouement, abandon) — sans dénouer : l'appelant joue sa suite. */
export function clearSequence(set: Set): void {
  set({ sequence: null });
}

/**
 * OUVRE la manche suivante : incrémente le rang, demande sa déclaration au domaine, l'ouvre par la
 * porte des mints (`openSequence`). Une manche `immediate` (aucune fenêtre à montrer) est résolue
 * d'office et CLOSE dans la foulée — le cycle ne s'arrête pas sur une cadence auto.
 * Déclaration `undefined` = plus aucun participant : la séquence s'éteint (état retiré).
 */
export function openSequenceRound(get: Get, set: Set): void {
  const seq = activeSequence(get);
  if (!seq) return;
  const def = sequenceDefOf(seq.def);
  if (!def) { clearSequence(set); return; }
  const next: SequenceState = { ...seq, round: seq.round + 1 };
  const rng = battleRng();
  const manche = def.round(get, next as never, rng);
  if (!manche || !manche.steps.length) { clearSequence(set); return; }
  if (manche.payload !== undefined) next.payload = manche.payload;
  set({ sequence: next });
  if (manche.immediate) {
    const resolues = runCascadeImmediate(get, set, [...manche.steps], { title: manche.title, purpose: SEQUENCE_PURPOSE, log: manche.log });
    for (const l of manche.log ?? []) get().log(l);
    closeSequenceRound(get, set, {
      title: manche.title, purpose: SEQUENCE_PURPOSE, participants: resolues, cursor: resolues.length, log: [],
    });
    return;
  }
  openSequence(get, set, {
    title: manche.title,
    ...(manche.icon ? { icon: manche.icon } : {}),
    purpose: SEQUENCE_PURPOSE,
    steps: manche.steps,
    ...(manche.log ? { log: manche.log } : {}),
  });
}

/**
 * CLÔT la manche jouée : passe les rangées closes au RÉDUCTEUR du domaine, applique son verdict
 * (cumuls/charge), puis ROUVRE ou DÉNOUE. La BORNE est tenue ICI, une fois pour tous les jeux : un
 * verdict « continue » à la borne devient une fin sur l'issue réservée `SEQUENCE_BORNE`.
 */
export function closeSequenceRound(get: Get, set: Set, done: PendingCascade): void {
  const seq = activeSequence(get);
  if (!seq) return;
  const def = sequenceDefOf(seq.def);
  if (!def) { clearSequence(set); return; }
  const verdict = def.close({ get, seq: seq as never, done, rng: battleRng() });
  const apres: SequenceState = {
    ...seq,
    ...(verdict.cum ? { cum: verdict.cum } : {}),
    ...(verdict.payload !== undefined ? { payload: verdict.payload } : {}),
  };
  for (const l of verdict.log ?? []) get().log(l);
  const borne = verdict.go === 'continue' && apres.round >= borneOf(apres.params);
  if (verdict.go === 'continue' && !borne) {
    set({ sequence: apres });
    openSequenceRound(get, set);
    return;
  }
  const outcome = borne ? SEQUENCE_BORNE : (verdict as { outcome: string }).outcome;
  if (borne) get().log(t('seq.borne', { max: borneOf(apres.params) }));
  clearSequence(set);
  def.settle?.(get, set, apres as never, outcome);
}

/** ABANDON de la séquence en cours (le joueur renonce) : retire l'état, ferme la fenêtre, et laisse le
 *  domaine jouer son dénouement sur l'issue qu'il nomme. */
export function abandonSequence(get: Get, set: Set, outcome: string): void {
  const seq = activeSequence(get);
  if (!seq) return;
  set({ sequence: null, pendingCascade: null });
  sequenceDefOf(seq.def)?.settle?.(get, set, seq as never, outcome);
}
