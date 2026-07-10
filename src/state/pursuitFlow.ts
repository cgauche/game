/**
 * POURSUITE TERRESTRE jouable (LDB 15 l.87-109 — « Poursuites » ; catalogue `docs/raw/deplacement.md`).
 *
 * Le MOTEUR est déjà là et testé (`engine/pursuit.ts` : `pursuitOutcome`/`pursuitMoveBonus`/
 * `PURSUIT_ESCAPE_DISTANCE`, primitives PARTAGÉES avec la poursuite NAVALE `seaVoyageFlow`). Ce module
 * n'ajoute que la MISE EN SCÈNE terrestre : la boucle de manches jouée à l'écran.
 *
 * DRAMATURGIE (miroir de la crise « poursuite » du voyage maritime, MDG ch.13) : une MANCHE par MODALE,
 * la boucle y reste jusqu'à l'issue. Chaque manche est présentée par la CASCADE influençable (state/cascade,
 * `purpose:'pursuite'`) — chaque héros lance son Test de Mouvement (Athlétisme/Chevaucher/Conduite
 * d'attelages, `skill` en DONNÉE, aucun nom en dur), influençable (Chance/Résilience/Pacte) ; les
 * adversaires (PNJ) roulent en clôture de manche. On compare (LDB 15 l.512-515) le DR le plus BAS des
 * poursuivis au DR le plus HAUT des poursuivants, la Distance varie de la différence, puis l'issue est
 * jugée par `pursuitOutcome` : rattrapés (Distance ≤ 0 → combat) / semés (≥ escapeAt) / la manche suivante.
 */
import type { Get, Set } from './flowTypes';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { effectiveMovement } from '../engine/encumbrance';
import { findSkillById } from '../data/index';
import { battleRng } from './battleRng';
import { startCascade, registerCascadeApplier } from './cascade';
import { pursuitOutcome, pursuitMoveBonus, PURSUIT_ESCAPE_DISTANCE } from '../engine/pursuit';
import type { CascadeStep, PendingCascade } from './pendings';

/** Un adversaire de la poursuite (côté opposé au groupe) — Mouvement (bonus de DR de vitesse, l.105-108)
 *  et valeur de Test de Mouvement. `label` = affichage (aucune logique keyée dessus). */
export interface PursuitFoe {
  label: string;
  movement: number;
  skill: number;
}

/** Spécification d'auteur d'une poursuite (posée par l'Effet `startPursuit`). */
export interface PursuitSpec {
  /** Le GROUPE fuit (défaut) ou poursuit. */
  partyRole?: 'fleeing' | 'pursuing';
  /** Distance de départ (LDB 15 l.500-504 : 1 = presque à portée … 8 = presque hors de portée). */
  distance: number;
  /** Seuil d'évasion (défaut `PURSUIT_ESCAPE_DISTANCE` = 10, l.520). */
  escapeAt?: number;
  /** Compétence de Mouvement testée par le groupe (id STABLE : Athlétisme à pied / Chevaucher / Conduite d'attelages). */
  skill: string;
  /** Adversaires du groupe. */
  foes: PursuitFoe[];
  /** Rencontre ouverte au RATTRAPAGE (Distance ≤ 0) — combat. Absente : la poursuite se dénoue au récit. */
  encounter?: string;
}

/** Poursuite terrestre EN COURS (persiste entre les manches — la Distance et les adversaires survivent
 *  aux cascades successives). */
export interface PursuitState extends PursuitSpec {
  escapeAt: number;
  partyRole: 'fleeing' | 'pursuing';
  round: number;
}

const PURSUIT_MOVE_KIND = 'pursuitMove';

/** Applier de l'étape de manche : MUET côté conséquence (la résolution de la manche est GLOBALE — elle
 *  compare tous les DR à la clôture, `continuePursuitRound`) ; ne pousse qu'une ligne de journal lisible. */
registerCascadeApplier(PURSUIT_MOVE_KIND, (_get, _set, step, hero) => {
  const dr = step.result?.sl ?? 0;
  return { journal: [`${hero?.name ?? step.actorId} — ${step.rollLabel ?? 'Mouvement'} : ${dr >= 0 ? '+' : ''}${dr} DR.`] };
});

/** Héros du groupe ENCORE en course (vivants et dans la rencontre). */
function runners(get: Get) {
  return get().party.filter((h) => !h.dead && !h.outOfRencontre);
}

/** Démarre une poursuite terrestre (Effet `startPursuit`) : pose l'état puis ouvre la 1ʳᵉ manche. */
export function startGroundPursuit(get: Get, set: Set, spec: PursuitSpec): void {
  if (!spec.foes.length || !runners(get).length) { get().log('Poursuite : aucun participant.'); return; }
  const escapeAt = spec.escapeAt ?? PURSUIT_ESCAPE_DISTANCE;
  // Distance de départ bornée dans la course (1 .. escapeAt−1) — hors bornes = déjà rattrapé/semé.
  const distance = Math.max(1, Math.min(escapeAt - 1, Math.round(spec.distance)));
  const state: PursuitState = { ...spec, partyRole: spec.partyRole ?? 'fleeing', escapeAt, distance, round: 0 };
  set({ pursuit: state });
  const label = findSkillById(spec.skill)?.label ?? spec.skill;
  get().log(`Poursuite — ${state.partyRole === 'fleeing' ? 'le groupe prend la fuite' : 'le groupe se lance à la poursuite'} (Distance ${distance}, évasion à ${escapeAt} — LDB 15).`);
  openPursuitRound(get, set, label);
}

/** Ouvre une manche : une étape de Test de Mouvement influençable PAR héros en course (cascade). */
export function openPursuitRound(get: Get, set: Set, skillLabel?: string): void {
  const p = get().pursuit;
  if (!p) return;
  const label = skillLabel ?? findSkillById(p.skill)?.label ?? p.skill;
  const steps: CascadeStep[] = runners(get).map((h) => {
    const target = testValue(h, p.skill);
    return {
      id: `pursuit-${p.round}-${h.id}`,
      kind: PURSUIT_MOVE_KIND,
      actorId: h.id,
      icon: 'travel/foot',
      label: `${h.name} — ${label}`,
      rollLabel: label,
      base: target,
      target,
      result: null,
      interactive: true,
    };
  });
  if (!steps.length) { set({ pursuit: null }); return; }
  const p2 = { ...p, round: p.round + 1 };
  set({ pursuit: p2 });
  startCascade(get, set, {
    title: `Poursuite — manche ${p2.round} (Distance ${p.distance}/${p.escapeAt})`,
    icon: 'travel/foot',
    purpose: 'pursuite',
    steps,
  });
}

/** Clôture d'une manche (cascade `purpose:'pursuite'` finalisée) : roule les adversaires, actualise la
 *  Distance (LDB 15 l.512-515) et juge l'issue. Reprend une manche tant que la poursuite continue. */
export function continuePursuitRound(get: Get, set: Set, done: PendingCascade): void {
  const p = get().pursuit;
  if (!p) return;
  const partyRolls = done.participants
    .filter((s) => s.kind === PURSUIT_MOVE_KIND)
    .map((s) => ({ actorId: s.actorId, sl: s.result?.sl ?? 0 }));
  const rng = battleRng();
  // DR de vitesse (l.105-108) : chaque participant plus rapide que le PLUS LENT de la course gagne
  // autant de DR bonus. Plus lent = min des Mouvements de TOUS les participants (héros + adversaires).
  const heroM = runners(get).map((h) => ({ id: h.id, m: effectiveMovement(h) }));
  const slowest = Math.min(...heroM.map((h) => h.m), ...p.foes.map((f) => f.movement));
  const partyTotals = partyRolls.map((r) => r.sl + pursuitMoveBonus(heroM.find((h) => h.id === r.actorId)?.m ?? slowest, slowest));
  const foeTotals = p.foes.map((f) => {
    const t = rollTest(f.skill, 'intermediaire', rng);
    get().log(`${f.label} — Mouvement : ${t.roll}/${t.target} → ${t.sl >= 0 ? '+' : ''}${t.sl} DR.`);
    return t.sl + pursuitMoveBonus(f.movement, slowest);
  });
  const fleeingTotals = p.partyRole === 'fleeing' ? partyTotals : foeTotals;
  const pursuerTotals = p.partyRole === 'fleeing' ? foeTotals : partyTotals;
  // Distance += (DR le plus BAS des poursuivis − DR le plus HAUT des poursuivants) (l.512-515).
  const delta = Math.min(...fleeingTotals) - Math.max(...pursuerTotals);
  const distance = p.distance + delta;
  const outcome = pursuitOutcome(distance, p.escapeAt);
  set({ pursuit: { ...p, distance } });
  get().log(`Manche ${p.round} : ${delta >= 0 ? 'les poursuivis creusent l\'écart' : 'les poursuivants gagnent du terrain'} (${delta >= 0 ? '+' : ''}${delta} → Distance ${distance}/${p.escapeAt}).`);
  if (outcome === 'ongoing') { openPursuitRound(get, set); return; }
  // Issue TERMINALE : nettoyer l'état PUIS dénouer.
  set({ pursuit: null });
  if (outcome === 'escaped') {
    get().log(p.partyRole === 'fleeing' ? 'Le groupe a semé ses poursuivants — fuite réussie (LDB 15 l.520).' : 'La proie s\'est échappée — la poursuite est perdue (LDB 15 l.520).');
    return;
  }
  // 'caught' (Distance ≤ 0, l.518) : rattrapage → combat si une rencontre est fournie, sinon récit.
  get().log(p.partyRole === 'fleeing' ? 'Rattrapés ! Les poursuivants fondent sur le groupe (LDB 15 l.518).' : 'Le groupe rejoint sa proie (LDB 15 l.518).');
  if (p.encounter) get().startCombat(p.encounter);
}

/** Abandon de la poursuite (le groupe renonce à courir/traquer) — dénoue sans manche supplémentaire. */
export function pursuitAbandon(get: Get, set: Set): void {
  const p = get().pursuit;
  if (!p) return;
  set({ pursuit: null, pendingCascade: null });
  if (p.partyRole === 'fleeing') {
    // Renoncer à fuir = se laisser rattraper (l.518) : combat si une rencontre est fournie.
    get().log('Le groupe cesse de fuir et fait face.');
    if (p.encounter) get().startCombat(p.encounter);
  } else {
    get().log('Le groupe abandonne la poursuite.');
  }
}
