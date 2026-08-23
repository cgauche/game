/**
 * Kit de TEST pour `cascade.ts` — `spyApplier` mutualise le motif dupliqué (~13 sites,
 * `cascade.test.ts`/`rollSeam.test.ts`/`cadence-rapide.test.ts`) : un `registerCascadeApplier` qui
 * PUSH une entrée dérivée de l'étape validée dans un tableau `applied` puis renvoie une conséquence
 * (`journal`/`insert`/…) optionnelle. N'importer que depuis des `*.test.ts` — module de test, pas de
 * périmètre runtime.
 */
import { registerCascadeApplier, type CascadeApplier } from './cascade';
import type { GameState } from './store';
import type { CascadeStep } from './pendings';
import { DIFFICULTY_MODIFIERS, type Difficulty } from '../engine/types';
import type { ModLine } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';

/** Ce qu'il faut porter pour être JUGEABLE par `inexplique` — les quatre grandeurs d'une ligne de jet,
 *  toutes optionnelles. STRUCTUREL, jamais un type de porteur : `CascadeStep`, `BatchParticipant`,
 *  `RollBreakdown`/`PendingRoll` et les `Pending*` du combat les portent chacun à leur façon. */
export interface LigneJugeable { base?: number; mods?: ModLine[]; target?: number; difficulty?: Difficulty; difficultyCombined?: number; clamped?: number }

/**
 * CLIQUET « zéro chip anonyme » (#1117/#1153) : la part de l'écart base→cible qu'une étape n'explique
 * PAS. Tout ce que la ligne SAIT dire s'en retire — la Difficulté (texte de la ligne), ses
 * modificateurs NOMMÉS (`mods` : Soutien, États, passifs, malus RAW) et l'écrêtage MESURÉ (`clamped`,
 * rendu « plafond 99 »). Reste ≠ 0 ⇒ le réconciliateur de `RollLine` avouera une chip « autres » : un
 * fait que personne ne nomme. À asserter `toBe(0)` sur toute étape-jet produite par un flux.
 */
export function inexplique(st: LigneJugeable): number {
  return (st.target ?? 0) - (st.base ?? 0)
    - (st.difficultyCombined ?? (st.difficulty ? DIFFICULTY_MODIFIERS[st.difficulty] : 0))
    - (st.mods ?? []).reduce((sum, m) => sum + m.value, 0)
    - (st.clamped ?? 0);
}

/** LIGNE DE JET d'une étape : la RANGÉE du porteur quand l'étape est une BANDE (#1117 L3 — les jets
 *  de nuit vivent sur les rangées), l'étape elle-même sinon. `heroId` absent ⇒ la 1ʳᵉ rangée. Rendu
 *  STRUCTUREL (`LigneJugeable` + le libellé de Compétence), pour que les cliquets de ligne
 *  (`inexplique`, `soutienDe`) jugent la même chose des deux formes. */
export function jetDe(st: CascadeStep, heroId?: string): LigneJugeable & { label?: string } {
  const rows = st.participants;
  if (!rows?.length) return { ...st, label: st.rollLabel };
  return (heroId ? rows.find((r) => r.id === heroId) : rows[0]) ?? rows[0];
}

/** Le Soutien (LDB 12) porté par une ligne, tel qu'il s'AFFICHE : la ou les lignes de mod identifiées
 *  par leur RÈGLE (`soutienMod` — `ref.id`), jamais par leur libellé. `0` si la ligne n'en porte pas. */
export function soutienDe(st: LigneJugeable): number {
  return (st.mods ?? [])
    .filter((m) => m.ref?.id === RULE_REF.soutien.id)
    .reduce((sum, m) => sum + m.value, 0);
}

/**
 * JOUE UNE ÉTAPE de la cascade active, comme un joueur : elle est TRANCHÉE (choix → son défaut
 * authoré), LANCÉE (bande → chaque rangée non roulée ; table non tirée → son dé ; jet → son dé), puis
 * VALIDÉE. Rend le `kind` de l'étape jouée (`undefined` si aucune cascade active).
 *
 * SOURCE UNIQUE du pilotage de cascade en test (#1426) — `travel-flow`, `sea-voyage-flow`, `voyage`,
 * `14-voyage-maritime` et les sondes jouent tous CE pilote : une copie par fichier dérive, et c'est
 * ainsi qu'un flux refondu se voit reproché SA refonte par un pilote périmé.
 *
 * Une table que le socle a résolue lui-même (cadence déférée à un automate, `cascade.poserLeCurseur`)
 * se présente ici en `'affichage'` : rien à lancer, on valide — le kit n'a AUCUNE branche pour la
 * politique du socle, il joue ce que la fenêtre offre.
 */
export function avanceEtapeCascade(get: () => GameState): string | undefined {
  const p = get().pendingCascade;
  if (!p) return undefined;
  const cur = p.participants[p.cursor];
  if (cur) {
    if (cur.options && cur.chosen == null) get().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key);
    else if (cur.participants) { for (const part of cur.participants) if (!part.result) get().cascadeBatchRoll(part.id); }
    else if (cur.table && !cur.table.result) get().cascadeTableRoll(cur.id);
    else if (cur.target != null && !cur.result) get().cascadeRoll(cur.id);
  }
  get().cascadeNext();
  return cur?.kind;
}

/** DRAINE la cascade active jusqu'à sa clôture (ou `max` étapes — garde d'emballement), en jouant
 *  chaque étape par `avanceEtapeCascade`. Rend les `kind` rencontrés, dans l'ordre. */
export function draineCascade(get: () => GameState, max = 200): string[] {
  const kinds: string[] = [];
  for (let i = 0; i < max && get().pendingCascade; i++) {
    const k = avanceEtapeCascade(get);
    if (k !== undefined) kinds.push(k);
  }
  return kinds;
}

/**
 * DRAINE une séquence dont la SUITE est DIFFÉRÉE (`cascade.chainStep` → timer 0) : chaque étape est
 * jouée par `avanceEtapeCascade`, puis l'appelant fait tourner son horloge (`avancerTimers`, typiquement
 * `() => vi.runAllTimers()` sous faux timers) pour que la continuation ouvre l'étape suivante.
 *
 * C'est le pilote des flux où un dé de MONDE commande la suite (vente terrestre : acheteur → mise à
 * prix → Marchandage) : sans l'horloge, le drainage rendrait la main entre deux maillons et le geste
 * du joueur paraîtrait sans effet. Le kit ne POSSÈDE pas l'horloge du test — il la demande.
 */
export function draineCascadeDifferee(get: () => GameState, avancerTimers: () => void, max = 20): string[] {
  const kinds: string[] = [];
  for (let i = 0; i < max && get().pendingCascade; i++) {
    const k = avanceEtapeCascade(get);
    if (k !== undefined) kinds.push(k);
    avancerTimers();
  }
  return kinds;
}

/** Enregistre un applier-espion `kind` : `mapper(step)` alimente `applied`, `out(step)` (défaut : rien)
 *  fournit la conséquence renvoyée à `commitStep` (`journal`/`consequences`/`insert`). */
export function spyApplier<T>(
  kind: string,
  applied: T[],
  mapper: (step: CascadeStep) => T,
  out?: (step: CascadeStep) => ReturnType<CascadeApplier>,
): void {
  registerCascadeApplier(kind, (_get, _set, step) => {
    applied.push(mapper(step));
    return out ? out(step) : undefined;
  });
}
