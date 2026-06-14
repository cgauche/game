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
import { actorIn } from './combatOrParty';
import { rollTest } from '../engine/tests';
import { battleRng } from './battleRng';

/**
 * Conséquence d'une étape, appliquée à la VALIDATION. Mute le héros (via get/set), renvoie les lignes
 * de journal et d'éventuelles étapes à INSÉRER juste après l'étape courante (dépendance). Vit dans le
 * registre — pas dans le pending (coop). `step.result` est garanti non-null si `step.target != null`.
 * `ctx` donne les étapes DÉJÀ jouées (`ctx.steps[0..index-1]` committées) : une escalade cumulative
 * (Exposition au froid : 1ᵉʳ échec → −10 CT/Ag/Dex, 2ᵉ → reste, 3ᵉ → Blessures) lit le nombre
 * d'échecs précédents de CE héros — c'est cette dépendance qui rend la séquence séquentielle.
 */
export type CascadeApplier = (
  get: Get,
  set: Set,
  step: CascadeStep,
  hero: Combatant | undefined,
  ctx: { steps: CascadeStep[]; index: number },
) => { journal?: string[]; insert?: CascadeStep[] } | void;

/** Issue COURTE d'un kind pour la modale (préview AVANT validation, ex. « X récupère des Blessures »,
 *  « X contracte la maladie ») — la CONSÉQUENCE, pas « X réussit ». Co-localisée avec l'`apply` (qui
 *  produit la ligne chiffrée au journal à la validation), donc ajouter un kind ne touche JAMAIS l'UI. */
export type CascadeDescriber = (success: boolean, name: string) => string;

/** Une entrée de registre : la conséquence appliquée (`apply`) + son libellé d'issue (`describe`). */
export interface CascadeKind {
  apply: CascadeApplier;
  describe?: CascadeDescriber;
}

/** Registre par `kind` — source unique extensible (+1 entrée par nature d'étape : `apply` + `describe`).
 *  Peuplé par les modules de domaine (restFlow, travelFlow) à leur chargement et par les tests. */
export const cascadeAppliers: Record<string, CascadeKind> = {};

/** Enregistre (ou remplace) la conséquence d'un `kind` d'étape de cascade (+ son issue de modale). */
export function registerCascadeApplier(kind: string, apply: CascadeApplier, describe?: CascadeDescriber): void {
  cascadeAppliers[kind] = { apply, describe };
}

/** Ouvre une cascade interactive (≥ 1 étape influençable). Le curseur démarre sur la 1ʳᵉ étape. */
export function startCascade(
  get: Get,
  set: Set,
  opts: { title: string; icon?: string; purpose: PendingCascade['purpose']; steps: CascadeStep[]; log?: string[]; travelHalt?: boolean },
): void {
  if (!opts.steps.length) return;
  set({
    pendingCascade: {
      title: opts.title, icon: opts.icon, purpose: opts.purpose,
      participants: opts.steps, cursor: 0, log: opts.log ?? [], travelHalt: opts.travelHalt,
    },
  });
}

/** Applique la conséquence d'une étape + ses insertions ; renvoie le tableau d'étapes mis à jour et
 *  les lignes de journal. Partagé par les deux pilotes (interactif et immédiat). */
function commitStep(get: Get, set: Set, steps: CascadeStep[], i: number): { steps: CascadeStep[]; journal: string[] } {
  const step = steps[i];
  const hero = step.actorId ? actorIn(get(), step.actorId) : undefined;
  const out = cascadeAppliers[step.kind]?.apply(get, set, step, hero, { steps, index: i });
  const journal = out?.journal ?? [];
  for (const l of journal) get().log(l);
  // L'étape VALIDÉE garde sa conséquence (`outcome`) pour rester LISIBLE dans la pile à l'écran.
  let next = steps.map((x, k) => (k === i ? { ...x, committed: true, outcome: journal } : x));
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
  if (cur && cur.target != null && !cur.result) return null; // jet requis d'abord
  let steps = p.participants;
  // La conséquence d'une étape vit sur l'ÉTAPE (`outcome`, affichée dans la pile) — pas dupliquée
  // dans `log` (réservé aux notes hors-jet : entretien). Évite le doublon « X contracte… » écran/journal.
  if (cur) steps = commitStep(get, set, steps, p.cursor).steps;
  const next = p.cursor + 1;
  if (next >= steps.length) {
    set({ pendingCascade: null });
    return { ...p, participants: steps, log: p.log };
  }
  set({ pendingCascade: { ...p, participants: steps, cursor: next } });
  return null;
}

/** « Renoncer » d'une cascade : RÉSOUT d'office les étapes restantes (RNG, sans influence) — on ne
 *  peut pas « dé-dormir » : les conséquences subies s'appliquent quand même. Renvoie la cascade
 *  finalisée (suite propre au `purpose`). */
export function finishCascadeRest(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  let steps = p.participants;
  let log = p.log;
  for (let i = p.cursor; i < steps.length; i++) {
    const st = steps[i];
    if (st.target != null && !st.result) {
      const t = rollTest(st.target, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target, sl: t.sl, success: t.success };
      steps = steps.map((x, k) => (k === i ? { ...x, result } : x));
    }
    const r = commitStep(get, set, steps, i);
    steps = r.steps;
    log = [...log, ...r.journal];
  }
  set({ pendingCascade: null });
  return { ...p, participants: steps, log };
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
    if (st.target != null && !st.result) {
      const t = rollTest(st.target, 'intermediaire', battleRng());
      const result: CascadeRoll = { roll: t.roll, target: st.target, sl: t.sl, success: t.success };
      cur = cur.map((x, k) => (k === i ? { ...x, result } : x));
    }
    cur = commitStep(get, set, cur, i).steps;
  }
  return cur;
}
