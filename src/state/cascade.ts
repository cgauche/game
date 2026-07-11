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
import { aggregateCrewRolls, rollCrewRole } from './shipManeuver';

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
 *  un Test (`target`), un batch multi (`participants` — seam de jet #275 Décision 4 cran 1, UNE rangée
 *  par contributeur), un choix du joueur (`options`), ou un pur affichage (aucun des trois). */
export function stepInteraction(step: CascadeStep): 'jet' | 'batch' | 'choix' | 'affichage' {
  if (step.target != null) return 'jet';
  if (step.participants != null) return 'batch';
  if (step.options != null) return 'choix';
  return 'affichage';
}

/** L'étape est-elle prête à être validée ? jet → lancée (`result`) ; batch → TOUS les participants
 *  INTERACTIFS ont un `result` (les témoins — marins PNJ, `interactive:false` — sont auto-roulés à
 *  l'ouverture, jamais un frein) ; choix → tranchée (`chosen`) ; affichage → toujours. */
export function stepReady(step: CascadeStep): boolean {
  switch (stepInteraction(step)) {
    case 'jet': return !!step.result;
    case 'batch': return step.participants!.every((p) => p.interactive === false || !!p.result);
    case 'choix': return step.chosen != null;
    case 'affichage': return true;
  }
}

/** Agrège une étape « batch » PRÊTE (`stepReady`) en un `CascadeRoll` scalaire — même vocabulaire
 *  `result` qu'une étape mono, pour que l'applier `cascadeAppliers[kind]` reste kind-agnostique du
 *  nombre de contributeurs (seam de jet #275 Décision 4 cran 1). `meta` porte les paramètres de
 *  formule SÉRIALISABLES (Moral, Manque de bras, sabotage — mêmes clés que `rollSeam.buildBatchStep`,
 *  `meta.essentialRoleId`/`moraleScore`/`extraDR`/`undercrewDR`/`capSuccesMinime`/`opposeSl`). */
function aggregateBatchStep(step: CascadeStep): CascadeRoll {
  const meta = step.meta;
  const essentialRoleId = typeof meta?.essentialRoleId === 'string' ? meta.essentialRoleId : undefined;
  const moraleScore = typeof meta?.moraleScore === 'number' ? meta.moraleScore : 0;
  const extraDR = typeof meta?.extraDR === 'number' ? meta.extraDR : 0;
  const undercrewDR = typeof meta?.undercrewDR === 'number' ? meta.undercrewDR : undefined;
  const undercrew = undercrewDR != null ? { dr: undercrewDR, capSuccesMinime: !!meta?.capSuccesMinime } : undefined;
  const opposeSl = typeof meta?.opposeSl === 'number' ? meta.opposeSl : 0;
  const { sl, success } = aggregateCrewRolls(step.participants!, step.aggregate ?? 'summed-dr', { essentialRoleId, moraleScore, extraDR, undercrew, opposeSl });
  return { roll: 0, target: 0, sl, success };
}

/** Lance d'office les participants SANS influence (pilotes automatiques — `resolveRemainingCascade`/
 *  `runCascadeImmediate`) : même jet par rôle que la modale (`rollCrewRole`, MDG ch.14), simplement
 *  sans le cycle Chance/Résilience du flux `cascadeCrew`. */
function rollBatchParticipants(get: Get, step: CascadeStep) {
  const s = get();
  return step.participants!.map((p) => {
    if (p.result) return p;
    const crew = actorIn(s, p.id);
    return { ...p, result: crew ? rollCrewRole(crew, p.roleId, battleRng(), p.cumul, p.sense) : null };
  });
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

/** Applique la conséquence d'une étape + ses insertions ; renvoie le tableau d'étapes mis à jour, les
 *  lignes de journal, et `suspended` (l'applier a fait basculer le slot ACTIF vers un AUTRE contexte —
 *  `startCombat`, cf. `suspendActiveCascade` — PENDANT sa propre exécution). Partagé par les trois
 *  pilotes (interactif, « tout résoudre », immédiat). */
function commitStep(get: Get, set: Set, steps: CascadeStep[], i: number, liveMerge = false): { steps: CascadeStep[]; journal: string[]; suspended: boolean } {
  const before = get().pendingCascade;
  // Étape « batch » (participants — seam de jet #275 Décision 4 cran 1) : AGRÈGE les contributeurs
  // (déjà tous résolus, `stepReady`) en UN `CascadeRoll` scalaire — l'applier lit `step.result` comme
  // n'importe quelle étape mono, kind-agnostique du nombre de rangées.
  let step = steps[i];
  if (step.participants && !step.result) step = { ...step, result: aggregateBatchStep(step) };
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
  // encore posés dans le pending). SUSPENDUE (slot occupé par un autre contexte) → `get().pendingCascade`
  // vaut `null`, `live` retombe naturellement sur `undefined` (pas de merge, pas de crash).
  const live = liveMerge ? get().pendingCascade?.participants : undefined;
  const base = live && live.length >= steps.length && live[i]?.id === step.id ? live : steps;
  let next = base.map((x, k) => (k === i ? { ...x, ...(step.result ? { result: step.result } : {}), committed: true, outcome: shown } : x));
  if (out?.insert?.length) next = [...next.slice(0, i + 1), ...out.insert, ...next.slice(i + 1)];
  // L'applier a SUSPENDU le slot actif (`startCombat` en plein vol, cf. `suspendActiveCascade` — qui
  // vide TOUJOURS le slot à `null`) : le retour l'expose, JAMAIS écrit ici. Distinct d'un liveMerge
  // (une conséquence FOLDÉE re-déclenchée APPEND au pending, `pendingCascade` reste NON-null — pas une
  // suspension) : seul `null` signe la suspension, jamais une simple différence de référence.
  const suspended = before !== null && get().pendingCascade === null;
  return { steps: next, journal, suspended };
}

/** Cascade EN COURS de résolution suspendue EN PLEIN VOL (`commitStep` a détecté `suspended`) : replace
 *  dans `suspendedCascades` l'entrée poussée par `suspendActiveCascade` (référence `stale`, poussée
 *  DEPUIS le slot actif AVANT que l'applier n'y touche) par ses étapes À JOUR (`patch` — celles que
 *  `commitStep` vient de committer/insérer). Ne ressuscite JAMAIS le slot actif (propriété d'un AUTRE
 *  contexte désormais, ex. combat) : SEULE la pile est mise à jour. No-op si `stale` n'y est plus (déjà
 *  résumée entre-temps, cas extrême hors coop synchrone). */
function reconcileSuspended(get: Get, set: Set, stale: PendingCascade, patch: Partial<PendingCascade>): void {
  const stack = get().suspendedCascades;
  const idx = stack.lastIndexOf(stale);
  if (idx < 0) return;
  set({ suspendedCascades: stack.map((x, k) => (k === idx ? { ...x, ...patch } : x)) });
}

/** SUSPEND la cascade ACTIVE (si une l'est) : la pousse en tête de `suspendedCascades` (pile LIFO) et
 *  vide le slot `pendingCascade`. Primitive GÉNÉRIQUE (kind-agnostique, aucune mention de domaine) —
 *  déclenchée par la couture universelle `startCombat`/`transitionTo` (state/combatSlice.ts,
 *  state/store.ts) : un combat qui s'ouvre PENDANT une cascade active (ex. un abordage déclenché par
 *  l'applier d'une étape de voyage) ne doit ni écraser ni perdre les étapes restantes — le slot
 *  `pendingCascade` redevient disponible pour les cascades DU COMBAT (jets d'attaque…), gates d'action
 *  inchangés (`targetingModes.ts`/`combatSlice.ts` continuent de lire `pendingCascade` = la cascade
 *  ACTIVE). No-op si aucune cascade n'est active. */
export function suspendActiveCascade(get: Get, set: Set): void {
  const p = get().pendingCascade;
  if (!p) return;
  set({ pendingCascade: null, suspendedCascades: [...get().suspendedCascades, p] });
}

/** RÉSUME la tête de pile (`suspendedCascades`, LIFO) dans le slot `pendingCascade` — SEULEMENT si le
 *  slot est LIBRE (jamais un écrasement). Déclenchée par la couture universelle de teardown de combat
 *  (`dismissVictory`/`dismissDefeat`, state/store.ts). Renvoie `true` si une cascade a été résumée. */
export function resumeSuspendedCascade(get: Get, set: Set): boolean {
  if (get().pendingCascade) return false;
  const stack = get().suspendedCascades;
  if (!stack.length) return false;
  const top = stack[stack.length - 1];
  set({ pendingCascade: top, suspendedCascades: stack.slice(0, -1) });
  return true;
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
  let suspended = false;
  // La conséquence d'une étape vit sur l'ÉTAPE (`outcome`, affichée dans la pile) — pas dupliquée
  // dans `log` (réservé aux notes hors-jet : entretien). Évite le doublon « X contracte… » écran/journal.
  if (cur) { const r = commitStep(get, set, steps, p.cursor, true); steps = r.steps; suspended = r.suspended; } // liveMerge : préserve les appends d'une conséquence foldée
  const next = p.cursor + 1;
  // SUSPENDUE en plein vol (`startCombat` déclenché par l'applier de l'étape courante) : le slot ne
  // nous appartient plus — met à jour l'entrée de pile (étapes/curseur À JOUR), ne ressuscite RIEN.
  if (suspended) { reconcileSuspended(get, set, p, { participants: steps, cursor: Math.min(next, steps.length) }); return null; }
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
    } else if (stepInteraction(st) === 'batch') {
      steps = steps.map((x, k) => (k === i ? { ...x, participants: rollBatchParticipants(get, st) } : x));
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      // « Tout résoudre » ne TRANCHE pas un CHOIX du joueur (dévier/subir, piéger…) : on s'arrête dessus.
      set({ pendingCascade: { ...p, participants: steps, cursor: i, log } });
      return;
    } // affichage : rien à résoudre avant la conséquence
    const r = commitStep(get, set, steps, i);
    steps = r.steps;
    log = [...log, ...r.journal];
    // SUSPENDUE en plein vol (l'applier a déclenché `startCombat`) : le slot ne nous appartient plus —
    // met à jour l'entrée de pile, s'arrête là (jamais de ressuscite/écrase du slot actif).
    if (r.suspended) { reconcileSuspended(get, set, p, { participants: steps, cursor: Math.min(i + 1, steps.length), log }); return; }
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
 *
 * `ctx` (optionnel) : titre/`purpose` du fragment — SEULEMENT nécessaire pour un appelant qui résout
 * un tableau DE PLUSIEURS étapes dont l'une peut ouvrir un combat en plein vol (`startCombat`, ex. la
 * cascade auto-pilotée d'un jour de voyage routine) : si le combat s'ouvre AVANT la fin du tableau, les
 * étapes RESTANTES (non encore committées) sont poussées en pile (`suspendedCascades`) — jamais perdues
 * ni résolues À L'AVEUGLE pendant que le combat tourne. Sans `ctx` (mono-étape, l'immense majorité des
 * appels), rien à préserver : la boucle s'arrête simplement (comportement historique).
 */
export function runCascadeImmediate(get: Get, set: Set, steps: CascadeStep[], ctx?: { title: string; purpose: PendingCascade['purpose']; log?: string[] }): CascadeStep[] {
  let cur = steps;
  for (let i = 0; i < cur.length; i++) {
    const st = cur[i];
    if (stepInteraction(st) === 'jet' && !st.result) {
      const t = rollTest(st.target!, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target!, sl: t.sl, success: t.success };
      cur = cur.map((x, k) => (k === i ? { ...x, result } : x));
    } else if (stepInteraction(st) === 'batch') {
      cur = cur.map((x, k) => (k === i ? { ...x, participants: rollBatchParticipants(get, st) } : x));
    } else if (stepInteraction(st) === 'choix' && st.chosen == null) {
      const key = st.defaultChoice ?? st.options![0]?.key;
      if (key != null) cur = cur.map((x, k) => (k === i ? { ...x, chosen: key } : x));
    } // affichage : rien à résoudre avant la conséquence
    const r = commitStep(get, set, cur, i);
    cur = r.steps;
    // Un combat s'est ouvert PENDANT cette résolution immédiate (l'applier a appelé `startCombat` —
    // no-op de suspension ici puisque CE tableau n'était PAS dans le slot actif) : le reste du tableau
    // ne doit PAS continuer à se résoudre en silence pendant que le combat tourne — on le préserve.
    if (get().battle && i + 1 < cur.length) {
      if (ctx) set({ suspendedCascades: [...get().suspendedCascades, { title: ctx.title, purpose: ctx.purpose, participants: cur.slice(i + 1), cursor: 0, log: ctx.log ?? [] }] });
      return cur;
    }
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
