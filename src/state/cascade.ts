/**
 * CASCADE séquentielle influençable — cœur générique (régime choisi par l'utilisateur pour les jets
 * de NUIT et de VOYAGE : un jet à la suite de l'autre, chacun influençable par la Chance/Résilience/
 * Pacte, AVANT que sa conséquence ne soit validée). Cf. docs/superpowers/specs/2026-06-14-multi-roll-
 * modal-design.md, Étape 3.
 *
 * Le JET d'une étape est kind-agnostique (Test « +0 » sur `step.target`, géré par `FLOWS.cascade`).
 * La CONSÉQUENCE d'une étape dépend de son `kind` et vit dans le REGISTRE `cascadeAppliers` (code,
 * identique hôte/invité — jamais une closure dans le pending, qui est snapshoté/transmis en coop).
 * Une conséquence peut INSÉRER des étapes suivantes (dépendance : un abri réussi réduit le nombre de
 * jets d'Exposition des campeurs).
 *
 * Deux pilotes du MÊME plan d'étapes (zéro duplication de la logique de conséquence) :
 *  - INTERACTIF (`advanceCascade` au fil de la modale `CascadeModal`) — nuit d'une journée, halte ;
 *  - IMMÉDIAT (`runCascadeImmediate`) — repos de plusieurs jours, reprise auto, triche de recette :
 *    on lance chaque étape (RNG, sans influence) et on applique sa conséquence, sans modale.
 */
import type { Get, Set } from './flowTypes';
import type { Combatant } from '../engine/types';
import type { CascadeStep, PendingCascade, CascadeRoll } from './pendings';
import type { Consequence } from './rollSeam';
import { resultLine } from './rollSeam';
import { actorIn } from './combatOrParty';
import { rollTest } from '../engine/tests';
import { battleRng } from './battleRng';

/**
 * Conséquence d'une étape, appliquée à la VALIDATION. Mute le héros (via get/set), renvoie les
 * conséquences (rendues par `resultLine`, #295 Lot 0) et d'éventuelles étapes à INSÉRER juste après
 * l'étape courante (dépendance). Vit dans le registre — pas dans le pending (coop). `step.result` est
 * garanti non-null si `step.target != null`. `ctx` donne les étapes DÉJÀ jouées
 * (`ctx.steps[0..index-1]` committées) : une escalade cumulative (Exposition au froid : 1ᵉʳ échec →
 * −10 CT/Ag/Dex, 2ᵉ → reste, 3ᵉ → Blessures) lit le nombre d'échecs précédents de CE héros — c'est
 * cette dépendance qui rend la séquence séquentielle.
 *
 * `journal` : @deprecated canal STRING LIBRE toléré en fallback transitoire (#295 Lot 0, Décision 1c —
 * « union dépréciée `journal` tolérée par `commitStep` ») tant que les ~51 appliers existants n'ont pas
 * migré vers `consequences` (#295 Lot 1). AUCUN nouvel applier ne doit l'utiliser — `commitStep` ne le
 * lit QUE si `consequences` est absent (repli, jamais les deux mélangés).
 */
export type CascadeApplier = (
  get: Get,
  set: Set,
  step: CascadeStep,
  hero: Combatant | undefined,
  ctx: { steps: CascadeStep[]; index: number },
) => { journal?: string[]; consequences?: Consequence[]; insert?: CascadeStep[] } | void;

/** Une entrée de registre : la conséquence appliquée (`apply`) + son libellé d'issue FALLBACK
 *  (préview avant validation, ex. « X récupère des Blessures ») — @deprecated `describe` (ex-
 *  `CascadeDescriber`, #295 Lot 0 Décision 1c : type nommé SUPPRIMÉ, forme structurelle tolérée en
 *  transition tant que `CascadeModal` lit `.describe` pour son repli « réussit »/« échoue », migré au
 *  Lot 2). Ajouter un kind ne touche JAMAIS l'UI. */
export interface CascadeKind {
  apply: CascadeApplier;
  describe?: (success: boolean, name: string) => string;
}

/** Registre par `kind` — source unique extensible (+1 entrée par nature d'étape : `apply` + `describe`).
 *  Peuplé par les modules de domaine (restFlow, travelFlow) à leur chargement et par les tests. */
export const cascadeAppliers: Record<string, CascadeKind> = {};

/** Enregistre (ou remplace) la conséquence d'un `kind` d'étape de cascade (+ son issue de modale). */
export function registerCascadeApplier(kind: string, apply: CascadeApplier, describe?: CascadeKind['describe']): void {
  cascadeAppliers[kind] = { apply, describe };
}

/** Type d'INTERACTION d'une étape, inféré de ses champs (zéro migration des étapes-jet existantes) :
 *  un Test (`target`), un choix du joueur (`options`), ou un pur affichage (ni l'un ni l'autre). */
export function stepInteraction(step: CascadeStep): 'jet' | 'choix' | 'affichage' {
  if (step.target != null) return 'jet';
  if (step.options != null) return 'choix';
  return 'affichage';
}

/** L'étape est-elle prête à être validée ? jet → lancée (`result`) ; choix → tranchée (`chosen`) ;
 *  affichage → toujours (rien à résoudre avant la conséquence). */
export function stepReady(step: CascadeStep): boolean {
  switch (stepInteraction(step)) {
    case 'jet': return !!step.result;
    case 'choix': return step.chosen != null;
    case 'affichage': return true;
  }
}

/** Pose le choix du joueur sur l'étape « choix » COURANTE (valide que `key ∈ options`). Analogue de
 *  `cascadeRoll` côté jet : prépare l'étape ; la VALIDATION (conséquence) reste à `advanceCascade`. */
export function setCascadeChoice(get: Get, set: Set, stepId: string, key: string): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId) return;
  if (!cur.options?.some((o) => o.key === key)) return;
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? { ...x, chosen: key } : x)) } });
}

/** Ouvre une cascade interactive (≥ 1 étape influençable). Le curseur démarre sur la 1ʳᵉ étape. */
export function startCascade(
  get: Get,
  set: Set,
  opts: { title: string; icon?: string; purpose: PendingCascade['purpose']; steps: CascadeStep[]; log?: string[]; travelHalt?: boolean; roundBoundary?: boolean; combatEndBoundary?: boolean },
): void {
  if (!opts.steps.length) return;
  set({
    pendingCascade: {
      title: opts.title, icon: opts.icon, purpose: opts.purpose,
      participants: opts.steps, cursor: 0, log: opts.log ?? [], travelHalt: opts.travelHalt, roundBoundary: opts.roundBoundary, combatEndBoundary: opts.combatEndBoundary,
    },
  });
}

/** Applique la conséquence d'une étape + ses insertions ; renvoie le tableau d'étapes mis à jour et
 *  les lignes de journal. Partagé par les deux pilotes (interactif et immédiat). */
function commitStep(get: Get, set: Set, steps: CascadeStep[], i: number, liveMerge = false): { steps: CascadeStep[]; journal: string[] } {
  const step = steps[i];
  const hero = step.actorId ? actorIn(get(), step.actorId) : undefined;
  const out = cascadeAppliers[step.kind]?.apply(get, set, step, hero, { steps, index: i });
  // `consequences` (#295 Lot 0) prime : rendu par `resultLine` en UNE ligne. Repli `journal` (canal
  // string libre @deprecated, cf. `CascadeApplier`) tant qu'un applier n'a pas migré (#295 Lot 1) —
  // jamais les deux mélangés (un applier migré ne renvoie plus `journal`).
  const journal = out?.consequences ? [resultLine(out.consequences)].filter((l) => l.length > 0) : (out?.journal ?? []);
  for (const l of journal) get().log(l);
  // L'étape VALIDÉE garde sa conséquence (`outcome`) pour rester LISIBLE dans la pile à l'écran. Une
  // étape d'AFFICHAGE porte son contenu d'avance (`outcome` pré-rempli) avec un applier muet → on le
  // PRÉSERVE (sinon le journal vide l'effacerait à la validation).
  const shown = journal.length ? journal : (step.outcome ?? []);
  // Pilote INTERACTIF (`liveMerge`) : l'applier d'une conséquence de combat FOLDÉE (déviation) re-déclenche
  // le reste de l'attaque, qui APPEND des étapes au pending (via pushReveal). On repart alors des
  // participants COURANTS (post-applier) pour préserver ces appends — le pending est EN PHASE ici
  // (advanceCascade). Les pilotes BATCH ne l'activent PAS (leur tableau local porte des jets/choix pas
  // encore posés dans le pending).
  const live = liveMerge ? get().pendingCascade?.participants : undefined;
  const base = live && live.length >= steps.length && live[i]?.id === step.id ? live : steps;
  let next = base.map((x, k) => (k === i ? { ...x, committed: true, outcome: shown } : x));
  if (out?.insert?.length) next = [...next.slice(0, i + 1), ...out.insert, ...next.slice(i + 1)];
  return { steps: next, journal };
}

/**
 * Pilote INTERACTIF : valide l'étape courante (conséquence + insertions), avance le curseur. À la
 * fin, ferme le pending et RENVOIE la cascade finalisée (pour la suite propre au `purpose` — reprise
 * de voyage, bilan… — gérée par le store). Renvoie `null` tant qu'on avance encore. L'étape courante
 * influençable doit être lancée (sinon no-op : la modale force d'abord le jet).
 */
export function advanceCascade(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  const cur = p.participants[p.cursor];
  if (cur && !stepReady(cur)) return null; // jet non lancé / choix non tranché → la modale force d'abord
  let steps = p.participants;
  // La conséquence d'une étape vit sur l'ÉTAPE (`outcome`, affichée dans la pile) — pas dupliquée
  // dans `log` (réservé aux notes hors-jet : entretien). Évite le doublon « X contracte… » écran/journal.
  if (cur) steps = commitStep(get, set, steps, p.cursor, true).steps; // liveMerge : préserve les appends d'une conséquence foldée
  const next = p.cursor + 1;
  if (next >= steps.length) {
    set({ pendingCascade: null });
    return { ...p, participants: steps, log: p.log };
  }
  set({ pendingCascade: { ...p, participants: steps, cursor: next } });
  return null;
}

/** « Tout lancer » : RÉSOUT d'office les étapes restantes (RNG, sans influence) — on ne peut pas
 *  « dé-dormir », les conséquences subies s'appliquent quand même — puis place le curseur EN FIN
 *  (`cursor === participants.length`) = état BILAN. La modale RESTE ouverte pour montrer TOUTES les
 *  conséquences ; c'est `finalizeCascade` (« Terminer ») qui ferme et enchaîne la suite. */
export function resolveRemainingCascade(get: Get, set: Set): void {
  const p = get().pendingCascade;
  if (!p) return;
  let steps = p.participants;
  let log = p.log;
  for (let i = p.cursor; i < steps.length; i++) {
    const st = steps[i];
    if (stepInteraction(st) === 'jet' && !st.result) {
      const t = rollTest(st.target!, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target!, sl: t.sl, success: t.success };
      steps = steps.map((x, k) => (k === i ? { ...x, result } : x));
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      // « Tout résoudre » ne TRANCHE pas un CHOIX du joueur (dévier/subir, piéger…) : on s'arrête dessus.
      set({ pendingCascade: { ...p, participants: steps, cursor: i, log } });
      return;
    } // affichage : rien à résoudre avant la conséquence
    const r = commitStep(get, set, steps, i);
    steps = r.steps;
    log = [...log, ...r.journal];
  }
  set({ pendingCascade: { ...p, participants: steps, cursor: steps.length, log } });
}

/** « Terminer » du BILAN (curseur en fin) : ferme la cascade et RENVOIE la cascade finalisée (suite
 *  propre au `purpose` — reprise de voyage… — gérée par le store). */
export function finalizeCascade(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  set({ pendingCascade: null });
  return p;
}

/**
 * Pilote IMMÉDIAT (sans modale) : lance chaque étape (RNG) et applique sa conséquence dans l'ordre,
 * insertions comprises. Pour les repos de plusieurs jours, la reprise automatique et la triche de
 * recette. Renvoie les étapes résolues (pour un éventuel bilan en lecture seule).
 */
export function runCascadeImmediate(get: Get, set: Set, steps: CascadeStep[]): CascadeStep[] {
  let cur = steps;
  for (let i = 0; i < cur.length; i++) {
    const st = cur[i];
    if (stepInteraction(st) === 'jet' && !st.result) {
      const t = rollTest(st.target!, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target!, sl: t.sl, success: t.success };
      cur = cur.map((x, k) => (k === i ? { ...x, result } : x));
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      const key = st.defaultChoice ?? st.options![0]?.key;
      if (key != null) cur = cur.map((x, k) => (k === i ? { ...x, chosen: key } : x));
    } // affichage : rien à résoudre avant la conséquence
    cur = commitStep(get, set, cur, i).steps;
  }
  return cur;
}

/** Un groupe de conséquences déjà calculées (lignes prêtes à afficher) — brique d'entrée pour
 *  rapatrier les conséquences d'un jet INLINE dans la modale. */
export interface ConsequenceGroup {
  kind: string;
  label: string;
  lines: string[];
  icon?: string;
  actorId?: string;
}

/** Construit une SÉQUENCE d'étapes d'AFFICHAGE à partir de groupes de conséquences (imparfaite/colère,
 *  critique, Assommante…) — pour les montrer INLINE plutôt qu'en RevealModal séparée. Les groupes
 *  vides sont ignorés (pas de bruit). Les mutations restent appliquées par le moteur ; ces étapes ne
 *  font qu'AFFICHER (applier muet → `commitStep` préserve l'`outcome` pré-posé). */
export function buildConsequenceSteps(groups: ConsequenceGroup[]): CascadeStep[] {
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g, i): CascadeStep => ({
      id: `cons-${g.kind}-${i}`,
      kind: g.kind,
      actorId: g.actorId,
      icon: g.icon,
      label: g.label,
      outcome: g.lines,
      interactive: true,
    }));
}
