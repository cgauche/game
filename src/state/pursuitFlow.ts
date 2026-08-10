/**
 * POURSUITE TERRESTRE jouable (LDB 15 l.87-109 — « Poursuites » ; catalogue `docs/raw/deplacement.md`).
 *
 * Le MOTEUR est déjà là et testé (`engine/pursuit.ts` : `pursuitOutcome`/`pursuitMoveBonus`/
 * `PURSUIT_ESCAPE_DISTANCE`, primitives PARTAGÉES avec la poursuite NAVALE `seaVoyageFlow`). Ce module
 * n'ajoute que la MISE EN SCÈNE terrestre : la boucle de manches jouée à l'écran.
 *
 * DRAMATURGIE (miroir de la crise « poursuite » du voyage maritime, MDG 13) : une MANCHE par FENÊTRE,
 * la boucle y reste jusqu'à l'issue. Une manche est UNE BANDE (`purpose:'pursuite'`, `aggregate:'none'`)
 * dont les coureurs sont les RANGÉES (`BatchParticipant`) — LDB 15 l.92 : « Tout participant à la
 * poursuite effectue un Test pour son Mouvement ». Compétence de Mouvement en DONNÉE (`skill` :
 * Athlétisme/Chevaucher/Conduite d'attelages, aucun nom en dur), rangée influençable (Chance/Résilience/
 * Pacte) pour tout coureur dont un siège tient le jet (`jetSurfaced`, fenêtre de GROUPE), rangée
 * AUTO-ROULÉE à la construction sinon (héros conduit par l'IA, cadence Auto/Rapide) ;
 * les adversaires (PNJ) roulent en clôture de manche. On compare (LDB 15 l.93) le DR le plus BAS des
 * poursuivis au DR le plus HAUT des poursuivants, la Distance varie de la différence, puis l'issue est
 * jugée par `pursuitOutcome` : rattrapés (Distance ≤ 0 → combat) / semés (≥ escapeAt) / la manche suivante.
 * Les MANCHES restent SÉQUENTIELLES entre elles (une manche = une question, l.94 « on retourne à l'étape 2 »).
 */
import type { Get, Set } from './flowTypes';
import { rollTest } from '../engine/tests';
import { effectiveMovement } from '../engine/encumbrance';
import { pursuitTargetMovementBonus } from '../engine/combatFeatures/dispatch';
import type { Combatant, Difficulty } from '../engine/types';
import { findSkillById, combatStakeRef } from '../data/index';
import { battleRng } from './battleRng';
import { startCascade, registerCascadeApplier, rollBatchParticipant } from './cascade';
import { actorIn } from './combatants';
import { jetSurfaced } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { freeCons, rollStep } from './rollSeam';
import { pursuitOutcome, pursuitMoveBonus, PURSUIT_ESCAPE_DISTANCE } from '../engine/pursuit';
import type { BatchParticipant, CascadeStep, PendingCascade } from './pendings';

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
  /** Distance de départ (LDB 15 l.90 : 1 = presque à portée … 8 = presque hors de portée). */
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

/** Difficulté du Test de Mouvement d'une manche : LDB 15 l.92 n'en pose aucune — le Test est nu. */
const PURSUIT_DIFFICULTY: Difficulty = 'intermediaire';

/** Applier de la BANDE de manche : MUET côté conséquence (la résolution de la manche est GLOBALE — elle
 *  compare tous les DR à la clôture, `continuePursuitRound`) ; ne pousse qu'une ligne de journal lisible
 *  PAR RANGÉE. Une bande sans rangées RENONCE (fail-closed, patron `registerNightBandApplier`). */
registerCascadeApplier(PURSUIT_MOVE_KIND, (get, _set, step) => {
  if (!step.participants) return;
  const lines: string[] = [];
  for (const row of step.participants) {
    const dr = row.result?.sl ?? 0;
    const who = actorIn(get(), row.id)?.label ?? row.id;
    lines.push(`${who} — ${row.label ?? 'Mouvement'} : ${dr >= 0 ? '+' : ''}${dr} DR.`);
  }
  return { consequences: freeCons(lines) };
});

/** Héros du groupe ENCORE en course (vivants et dans la rencontre). */
function runners(get: Get) {
  return get().party.filter((h) => !h.dead && !h.outOfRencontre);
}

/** Mouvement d'un héros DANS la course (LDB 15 l.104-108) : son Mouvement effectif, +1 pour la Cible
 *  d'une Poursuite quand une capacité le confère (Fuite ! variante AA 13 l.68 — `pursuitTargetBonus`,
 *  active en mode « Avantage de groupe »). Le groupe est la Cible quand il FUIT. SOURCE UNIQUE du M de
 *  poursuite : le plus lent de la course et le DR de vitesse en découlent tous deux. */
export function pursuedMovement(h: Combatant, partyRole: 'fleeing' | 'pursuing'): number {
  return effectiveMovement(h) + (partyRole === 'fleeing' ? pursuitTargetMovementBonus(h) : 0);
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

/** RANGÉE d'un coureur dans la manche : son Test de Mouvement, monté par le MONTEUR CANONIQUE
 *  (`rollSeam.rollStep`, hors canal combat — la poursuite se joue hors arène) : `base` NUE, tout écart
 *  en `mods` NOMMÉS, cible dérivée.
 *
 *  SURFAÇAGE par `jetSurfaced` (SEAT-AGNOSTIQUE, patron `combatFlow.ts` — rangées de Contre-sort et
 *  d'opposition de cible) : le coureur d'un AUTRE siège garde une rangée à JOUER, c'est son joueur qui
 *  la roulera (`pilotedByHuman`/`humanControlled` sont des prédicats d'affordance LOCALE : ils
 *  voleraient le jet de l'invité). Reste TÉMOIN (`interactive:false`) le coureur qu'aucun siège ne
 *  tient — héros conduit par l'IA — et toute rangée en cadence Auto/Rapide, où les jets se lancent
 *  sans influence. Une rangée témoin NAÎT avec son `result` (roulé ici) : son DR compte dans la
 *  comparaison de la manche et `stepReady` ne l'attend jamais. */
function pursuitRow(get: Get, h: Combatant, skill: string, label: string): BatchParticipant {
  const row: BatchParticipant = {
    id: h.id, label, skillId: skill, difficulty: PURSUIT_DIFFICULTY, result: null, interactive: true,
    ...rollStep({ actor: h, test: { skill }, difficulty: PURSUIT_DIFFICULTY }),
  };
  if (!cadenceAuto() && jetSurfaced(get(), h)) return row;
  return { ...row, interactive: false, result: rollBatchParticipant(row, battleRng()) };
}

/** Ouvre une manche : UNE bande, une RANGÉE par coureur (LDB 15 l.92). `undefined` sans coureur. */
function pursuitRoundBand(get: Get, p: PursuitState, label: string): CascadeStep | undefined {
  const participants = runners(get).map((h) => pursuitRow(get, h, p.skill, label));
  if (!participants.length) return undefined;
  return {
    id: `pursuit-${p.round}`,
    kind: PURSUIT_MOVE_KIND,
    icon: 'travel/foot',
    label: `Manche ${p.round} — ${label}`,
    interactive: true,
    // Fenêtre de GROUPE (calque `shareCastStep`/`forceDoor`) : la manche porte les jets de PLUSIEURS
    // sièges (LDB 15 l.92, « tout participant »). Sans ce drapeau l'arbitre rend `undefined`
    // (`modalArbiter`, entrée `cascade`) et l'invité ne verrait jamais la manche où se tient son Test.
    groupOwner: true,
    aggregate: 'none',
    participants,
    stake: combatStakeRef('pursuitMove', { values: { distance: p.distance, evasion: p.escapeAt } }),
    meta: { round: p.round },
  };
}

/** Ouvre une manche : la fenêtre UNIQUE de la manche (bande influençable, cascade `purpose:'pursuite'`). */
export function openPursuitRound(get: Get, set: Set, skillLabel?: string): void {
  const p = get().pursuit;
  if (!p) return;
  const label = skillLabel ?? findSkillById(p.skill)?.label ?? p.skill;
  const p2 = { ...p, round: p.round + 1 };
  const band = pursuitRoundBand(get, p2, label);
  if (!band) { set({ pursuit: null }); return; }
  set({ pursuit: p2 });
  startCascade(get, set, {
    title: `Poursuite — manche ${p2.round} (Distance ${p.distance}/${p.escapeAt})`,
    icon: 'travel/foot',
    purpose: 'pursuite',
    steps: [band],
  });
}

/** Champs du jet MONO d'une manche (forme d'avant la bande) qui DESCENDENT sur la rangée — le reste
 *  (icône, enjeu, libellé de manche) appartient à la bande. */
const PURSUIT_ROW_FIELDS = ['base', 'target', 'mods', 'clamped', 'difficulty', 'rerolled', 'forced', 'fixed', 'outcome'] as const;

/** Rang de manche d'une étape MONO de poursuite (`pursuit-<manche>-<coureur>`), `null` si l'étape n'en
 *  est pas une (autre kind, bande déjà formée, pas de porteur ni de cible). */
function monoPursuitRound(step: CascadeStep): string | null {
  if (step.kind !== PURSUIT_MOVE_KIND || step.participants || typeof step.actorId !== 'string' || step.target == null) return null;
  return /^pursuit-(\d+)-/.exec(step.id)?.[1] ?? '0';
}

/**
 * FABRIQUE de bandification des étapes MONO de manche — SOURCE UNIQUE de la conversion, appelée par la
 * migration de save (`MIGRATIONS[18]`) : une save prise pendant une manche jouée à l'ancienne forme
 * (une étape PAR coureur) redevient UNE bande par manche, sans quoi son applier — qui exige des
 * RANGÉES — l'abandonnerait, et la clôture comparerait une manche SANS aucun DR de groupe. Les étapes
 * hors périmètre traversent INTACTES, à leur place.
 */
export function pursuitBands(steps: CascadeStep[]): CascadeStep[] {
  const out: CascadeStep[] = [];
  const bands = new Map<string, BatchParticipant[]>();
  for (const step of steps) {
    const round = monoPursuitRound(step);
    if (round == null) { out.push(step); continue; }
    const row: Record<string, unknown> = { id: step.actorId, interactive: true, result: step.result ?? null, label: step.rollLabel };
    for (const f of PURSUIT_ROW_FIELDS) if (step[f] !== undefined) row[f] = step[f];
    const held = bands.get(round);
    if (held) { held.push(row as unknown as BatchParticipant); continue; }
    const participants = [row as unknown as BatchParticipant];
    bands.set(round, participants);
    out.push({
      id: `pursuit-${round}`, kind: PURSUIT_MOVE_KIND, icon: step.icon,
      label: `Manche ${round} — ${step.rollLabel ?? 'Mouvement'}`,
      interactive: true, aggregate: 'none', participants,
      ...(step.stake ? { stake: step.stake } : {}),
      meta: { round: Number(round) },
    });
  }
  return out;
}

/** Clôture d'une manche (cascade `purpose:'pursuite'` finalisée) : roule les adversaires, actualise la
 *  Distance (LDB 15 l.93) et juge l'issue. Reprend une manche tant que la poursuite continue. */
export function continuePursuitRound(get: Get, set: Set, done: PendingCascade): void {
  const p = get().pursuit;
  if (!p) return;
  // Les DR du groupe sont ceux des RANGÉES de la bande de manche (une par coureur).
  const partyRolls = done.participants
    .filter((s) => s.kind === PURSUIT_MOVE_KIND)
    .flatMap((s) => (s.participants ?? []).map((r) => ({ actorId: r.id, sl: r.result?.sl ?? 0 })));
  const rng = battleRng();
  // DR de vitesse (l.105-108) : chaque participant plus rapide que le PLUS LENT de la course gagne
  // autant de DR bonus. Plus lent = min des Mouvements de TOUS les participants (héros + adversaires).
  const heroM = runners(get).map((h) => ({ id: h.id, m: pursuedMovement(h, p.partyRole) }));
  const slowest = Math.min(...heroM.map((h) => h.m), ...p.foes.map((f) => f.movement));
  const partyTotals = partyRolls.map((r) => r.sl + pursuitMoveBonus(heroM.find((h) => h.id === r.actorId)?.m ?? slowest, slowest));
  const foeTotals = p.foes.map((f) => {
    // Adversaires (pas des PJ) : aucune rangée nulle part pour leur jet — le journal est la SEULE
    // surface, il PORTE le jet (#295 Lot 5, gardé nominativement).
    const t = rollTest(f.skill, 'intermediaire', rng);
    get().log(`${f.label} — Mouvement : ${t.roll}/${t.target} → ${t.sl >= 0 ? '+' : ''}${t.sl} DR.`);
    return t.sl + pursuitMoveBonus(f.movement, slowest);
  });
  const fleeingTotals = p.partyRole === 'fleeing' ? partyTotals : foeTotals;
  const pursuerTotals = p.partyRole === 'fleeing' ? foeTotals : partyTotals;
  // Distance += (DR le plus BAS des poursuivis − DR le plus HAUT des poursuivants) (l.93).
  const delta = Math.min(...fleeingTotals) - Math.max(...pursuerTotals);
  const distance = p.distance + delta;
  const outcome = pursuitOutcome(distance, p.escapeAt);
  set({ pursuit: { ...p, distance } });
  get().log(`Manche ${p.round} : ${delta >= 0 ? 'les poursuivis creusent l\'écart' : 'les poursuivants gagnent du terrain'} (${delta >= 0 ? '+' : ''}${delta} → Distance ${distance}/${p.escapeAt}).`);
  if (outcome === 'ongoing') { openPursuitRound(get, set); return; }
  // Issue TERMINALE : nettoyer l'état PUIS dénouer.
  set({ pursuit: null });
  if (outcome === 'escaped') {
    get().log(p.partyRole === 'fleeing' ? 'Le groupe a semé ses poursuivants — fuite réussie (LDB 15 l.94).' : 'La proie s\'est échappée — la poursuite est perdue (LDB 15 l.94).');
    return;
  }
  // 'caught' (Distance ≤ 0, l.94) : rattrapage → combat si une rencontre est fournie, sinon récit.
  get().log(p.partyRole === 'fleeing' ? 'Rattrapés ! Les poursuivants fondent sur le groupe (LDB 15 l.94).' : 'Le groupe rejoint sa proie (LDB 15 l.94).');
  if (p.encounter) get().startCombat(p.encounter);
}

/** Abandon de la poursuite (le groupe renonce à courir/traquer) — dénoue sans manche supplémentaire. */
export function pursuitAbandon(get: Get, set: Set): void {
  const p = get().pursuit;
  if (!p) return;
  set({ pursuit: null, pendingCascade: null });
  if (p.partyRole === 'fleeing') {
    // Renoncer à fuir = se laisser rattraper (l.94) : combat si une rencontre est fournie.
    get().log('Le groupe cesse de fuir et fait face.');
    if (p.encounter) get().startCombat(p.encounter);
  } else {
    get().log('Le groupe abandonne la poursuite.');
  }
}
