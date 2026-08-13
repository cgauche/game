/**
 * LE CONTRAT D'ORCHESTRATEUR (#1279) — ce qu'un SYSTÈME DÉCLARE pour se faire jouer en MANCHES, et
 * RIEN de ce qui le joue. Le cahier des charges du chantier tient en une phrase (#1279) : une
 * structure d'orchestrateur utilisée par l'ENSEMBLE des systèmes (énormément d'éléments y sont
 * dupliqués aujourd'hui), dont UNE implémentation gère les systèmes les plus simples sans surcharge.
 *
 * D'où la SÉPARATION, visible au type :
 *  - CE FICHIER = la STRUCTURE, destinée à TOUS les systèmes (poursuite, jeux, crises de mer, et
 *    demain les gros : combat, voyage, bataille de masse s'ils l'adoptent). Trois choses, pas une de
 *    plus : un ÉTAT (`SequenceState`, générique sur sa charge utile), une FABRIQUE DE MANCHE
 *    (`SequenceDef.round`), une CLÔTURE-SOUS-ID (`SequenceDef.close`, réducteur PUR enregistré sous
 *    l'id que porte l'état — patron `registerCascadeApplier` : l'id est la donnée, la fonction est du
 *    TS enregistré ; un état de séquence se snapshote en JSON, une closure y serait effacée en silence).
 *  - `sequenceCore.ts` = L'IMPLÉMENTATION LÉGÈRE de ce contrat : le registre, le cycle
 *    ouvrir→clore→rouvrir, l'accumulateur par camp, les formules de score, les départages, la borne.
 *    C'est celle que consomment les systèmes SIMPLES (un jeu de taverne opposé n'y coûte que son
 *    entrée de donnée). Un système lourd pourra en écrire une AUTRE sans toucher au contrat.
 *
 * Aucune fonction ici : ce fichier ne joue rien, il DIT. Les seules valeurs sont les invariants du
 * vocabulaire (borne dure, issue réservée, `purpose` de fenêtre) — ce sur quoi les deux côtés
 * s'accordent.
 */
import type { Get, Set } from './flowTypes';
import type { PendingCascade } from './pendings';
import type { BuiltCascadeStep } from './rollSeam';
import type { RNG } from '../engine/dice';

/** Borne DURE de manches — invariant DU CONTRAT : une séquence dont aucun camp ne conclut S'ARRÊTE
 *  (le `round >= 50` que chaque jeu bricolait chez lui). Aucune implémentation ne peut la dépasser. */
export const SEQUENCE_MAX_ROUNDS = 50;

/** Issue RÉSERVÉE rendue quand la borne est atteinte — le système la reçoit dans son `settle` et
 *  décide ce qu'elle vaut chez lui (nul, abandon…). */
export const SEQUENCE_BORNE = 'borne';

/** `purpose` des fenêtres ouvertes pour une manche : la clôture se route dessus (store). */
export const SEQUENCE_PURPOSE = 'sequence' as const;

/** PARAMÈTRES D'AUTEUR d'une séquence — de la DONNÉE, sérialisée avec l'état : ce qui règle la
 *  machinerie sans la recompiler (cible de cumul, plafond, départage, borne, formules de score).
 *  C'est ce qui permet à un jeu N+1 à mécanismes CONNUS de n'être qu'une entrée de donnée. */
export interface SequenceParams {
  /** Cumul vers cible (Test opposé étendu, LDB 12 l.170-179) — ex. Bras de fer : 10 DR. */
  target?: number;
  /** Plafond de DR d'une manche (Boules NADAJ 16 l.57 : 6 DR). */
  drCap?: number;
  /** Id du départage d'égalité ENREGISTRÉ. Absent = l'égalité reste une égalité. */
  tieBreak?: string;
  /** Borne de manches propre à la séquence — jamais au-dessus de `SEQUENCE_MAX_ROUNDS`. */
  maxRounds?: number;
  /** Formule de score PAR CAMP (id enregistré : `min`/`max`/`sum`/`first`), keyée par camp. */
  score?: Record<string, string>;
}

/** ÉTAT d'une séquence EN COURS — GÉNÉRIQUE sur sa charge utile : l'orchestrateur ne lit JAMAIS
 *  `payload`, il le transporte. C'est ce qui rend la MÊME structure instanciable par une poursuite,
 *  un jeu de taverne ou une crise de mer sans qu'aucun champ de l'un n'entre ici. */
export interface SequenceState<P = unknown> {
  /** Id de la DÉFINITION enregistrée — la donnée qui nomme les fonctions. */
  def: string;
  /** Manche courante (0 = aucune encore ouverte). */
  round: number;
  /** ACCUMULATEUR PAR CAMP — source UNIQUE des cumuls (aucun système n'en tient un second). */
  cum: Record<string, number>;
  params: SequenceParams;
  payload: P;
}

/** UNE MANCHE déclarée par le système : sa fenêtre et ses étapes MINTÉES. `immediate` = aucune
 *  surface à montrer (cadence auto, aucun siège humain sur le porteur) — l'orchestrateur résout
 *  d'office au lieu d'ouvrir une fenêtre que personne ne joue. */
export interface SequenceRound<P = unknown> {
  title: string;
  icon?: string;
  steps: readonly BuiltCascadeStep[];
  log?: string[];
  immediate?: boolean;
  /** Charge utile MISE À JOUR par l'ouverture (le système compte ce qu'il veut dans sa manche — rang
   *  de manche, phase…). Omise : inchangée. Appliquée AVANT l'ouverture de la fenêtre. */
  payload?: P;
}

/** VERDICT du réducteur de clôture : la séquence continue (avec son état à jour) ou s'achève sur une
 *  issue NOMMÉE par le système (`outcome`, lue par son `settle`). `cum`/`payload` omis = inchangés. */
export type SequenceVerdict<P> =
  | { go: 'continue'; cum?: Record<string, number>; payload?: P; log?: string[] }
  | { go: 'end'; outcome: string; cum?: Record<string, number>; payload?: P; log?: string[] };

/** Ce que le réducteur de clôture REÇOIT : l'état, les rangées CLOSES de la manche, et un RNG injecté
 *  (les jets d'un camp sans porteur jouable s'y roulent — un réducteur ne tire jamais son propre dé). */
export interface SequenceCloseCtx<P> {
  get: Get;
  seq: SequenceState<P>;
  done: PendingCascade;
  rng: RNG;
}

/**
 * LA DÉCLARATION D'UN SYSTÈME — les trois seules choses qu'il doit à l'orchestrateur.
 *  · `round`  : sa manche (des étapes MINTÉES — un littéral d'étape n'entre pas) ;
 *  · `close`  : son réducteur PUR sur les rangées closes (lire → juger → boucler/clore) ;
 *  · `settle` : son dénouement (bourse, combat, modale) — joué APRÈS le retrait de l'état.
 * Tout le reste (persistance, cycle, cumuls, borne) appartient à l'implémentation.
 */
export interface SequenceDef<P = unknown> {
  /** Fabrique la manche `seq.round` (déjà incrémentée). `undefined` = plus rien à ouvrir : la
   *  séquence s'éteint sans issue (aucun participant). */
  round: (get: Get, seq: SequenceState<P>, rng: RNG) => SequenceRound<P> | undefined;
  /** RÉDUCTEUR de clôture : lit les rangées closes, rend le verdict. Ne mute RIEN du store. */
  close: (ctx: SequenceCloseCtx<P>) => SequenceVerdict<P>;
  /** DÉNOUEMENT terminal (bourse, combat, modale de résultat) — appelé APRÈS le retrait de l'état. */
  settle?: (get: Get, set: Set, seq: SequenceState<P>, outcome: string) => void;
}
