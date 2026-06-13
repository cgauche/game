/**
 * Corruption & mutations — flux store (LDB 19, moteur pur : engine/corruption).
 *
 *  - `gainCorruption` : ajoute des Points, puis applique le SEUIL (l.80) — au-delà
 *    de BFM+BE (+ niveau d'Âme pure, LDB 10), Test de Résistance Intermédiaire en MODALE
 *    différée (pendingCorruption kind 'seuil' — Lancer/Chance/Pacte ; repli auto-résolu +
 *    révélation pour les PNJ et les gains en rafale) ; échec → MUTATION (−BFM Points, d100
 *    corps/esprit par espèce, tirage sur le Tableau physique/mentale) ; puis LIMITES (l.95)
 *    → damné (hors-jeu définitif).
 *  - « Je te renie ! » (LDB 17 l.71) : un HÉROS avec de la Résilience peut REFUSER la mutation
 *    (1 Point de Résilience ; « comme vous ne mutez pas, vous ne perdez aucun Point de
 *    Corruption ») → choix par modale (`pendingRenounce`), la mutation est suspendue.
 *  - Sombre Pacte (l.16/41) : +1 Point volontaire pour RELANCER un Test raté, même
 *    après une relance de Chance — branché dans les modales de jet (ChanceButtons).
 *  - Effets d'éditeur : `corruptionExposure` (Test différé par modale) et
 *    `giveCorruption` (gain direct, artefact maudit…).
 */
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';
import type { Combatant } from '../engine/types';
import { battleRng } from './battleRng';
import { bonus, effectiveChar, refreshWounds } from '../engine/characteristics';
import { recomputeLoadout } from '../engine/items';
import { d100 } from '../engine/dice';
import {
  corruptionThresholdExceeded,
  mutationKindFor,
  mutationLimitExceeded,
  attachMutation,
} from '../engine/corruption';
import { rollMutation } from '../data/mutations';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { pushReveal } from './combatFlow';
import { evLines } from './combatLog';

/**
 * Ajoute `n` Points de Corruption à `hero`, applique seuil → mutation → limites.
 * Mute le héros EN PLACE (l'appelant pousse le patch de re-rendu) et renvoie les
 * lignes de journal. La révélation (dés du Test/de la table) est poussée dans la
 * file `pendingReveals` (« un jet = une modale », jet SUBI → révélation témoin).
 */
export function gainCorruption(get: Get, set: Set, hero: Combatant, n: number): string[] {
  const rng = battleRng();
  const lines: string[] = [];
  hero.corruption = (hero.corruption ?? 0) + n;
  lines.push(`${hero.name} : +${n} Point${n > 1 ? 's' : ''} de Corruption (total ${hero.corruption}).`);

  // Seuil « Corrompu » (l.80) : à CHAQUE gain au-delà de BFM+BE (+ Âme pure), Test de Résistance
  // Intermédiaire (+0) ; succès = contenu « pour cette fois », échec = mutation.
  if (!corruptionThresholdExceeded(hero)) return lines;
  // « Un jet = une modale » : pour un HÉROS, le Test du seuil est un VRAI jet différé — modale
  // de Corruption (kind 'seuil', cycle Lancer→Chance→Pacte), résolu dans `resolveCorruption`
  // (succès = contenu ; échec = « Je te renie ! »/mutation). Repli auto-résolu + révélation
  // témoin : PNJ (l'IA ne tient pas de modale) et gains en RAFALE (une modale déjà ouverte).
  if (hero.kind === 'hero' && !get().pendingCorruption) {
    lines.push(`${hero.name} : la Corruption déborde son seuil — Test de Résistance.`);
    set({ pendingCorruption: { heroId: hero.id, kind: 'seuil', skill: 'Résistance', skillLocked: true } });
    return lines;
  }
  const t = rollTest(testValue(hero, 'Résistance'), 'intermediaire', rng);
  if (t.success) {
    lines.push(`${hero.name} contient sa Corruption — pour cette fois (Résistance : ${t.roll}/${t.target}).`);
    if (hero.kind === 'hero')
      pushReveal(set, { kind: 'mutation', title: 'Corruption contenue', dice: t.roll, lines: [...lines], subjectId: hero.id, severity: 'minor' });
    return lines;
  }

  // « Je te renie ! » (LDB 17 l.71) : un héros avec de la Résilience peut refuser la mutation —
  // choix par modale ; la mutation (applyMutation) n'est appliquée qu'à la résolution.
  if (hero.kind === 'hero' && (hero.resilience ?? 0) > 0) {
    lines.push(`${hero.name} échoue à contenir sa Corruption (Résistance ${t.roll}/${t.target}) — la mutation menace…`);
    set({ pendingRenounce: { heroId: hero.id, testRoll: t.roll, testTarget: t.target } });
    return lines;
  }
  lines.push(...applyMutation(set, hero, { roll: t.roll, target: t.target }));
  return lines;
}

/** Applique la MUTATION (l.82-91) : −BFM Points, d100 corps/esprit par espèce, tirage sur le
 *  Tableau de Corruption physique/mentale, effets dérivés, puis LIMITES (l.95) → damné. */
export function applyMutation(set: Set, hero: Combatant, test?: { roll: number; target: number }): string[] {
  const rng = battleRng();
  const lines: string[] = [];
  const lost = bonus(effectiveChar(hero, 'FM'));
  hero.corruption = Math.max(0, (hero.corruption ?? 0) - lost);
  const kindRoll = d100(rng);
  const kind = mutationKindFor(hero.species, kindRoll);
  const m = rollMutation(kind, rng);
  attachMutation(hero, m);
  // Effets dérivés immédiats : PA naturels (loadout) + Blessures max si F/E/FM permanents.
  if (hero.items?.length) recomputeLoadout(hero);
  refreshWounds(hero);
  lines.push(
    `${hero.name} MUTE${test ? ` (Résistance ${test.roll}/${test.target} ratée)` : ''} : ${m.label} — Corruption ${kind} (${kindRoll} → ${kind === 'physique' ? 'corps' : 'esprit'}, table ${m.roll}).`,
  );
  if (m.note) lines.push(`${m.label} : ${m.note}`);

  // Limites de Corruption (l.95) : plus de mutations physiques que BE ou mentales que
  // BFM → l'âme appartient aux Dieux Sombres. Hors-jeu définitif (traité comme mort).
  if (mutationLimitExceeded(hero)) {
    hero.damned = true;
    hero.dead = true;
    lines.push(`${hero.name} a BASCULÉ dans le Chaos — damné, perdu pour le groupe.`);
  }
  if (hero.kind === 'hero')
    pushReveal(set, { kind: 'mutation', title: `Mutation — ${m.label}`, dice: m.roll, lines: [...lines], subjectId: hero.id, severity: 'grave' });
  return lines;
}

/** Résolution du choix « Je te renie ! » (LDB 17 l.71) : `renounce` → −1 Résilience, pas de
 *  mutation NI de perte de Points de Corruption ; sinon la mutation s'applique. */
export function resolveRenounce(get: Get, set: Set, renounce: boolean): void {
  const pr = get().pendingRenounce;
  if (!pr) return;
  set({ pendingRenounce: null });
  const hero = corruptionTarget(get(), pr.heroId);
  if (!hero) return;
  const lines: string[] = [];
  if (renounce && (hero.resilience ?? 0) > 0) {
    hero.resilience = (hero.resilience ?? 0) - 1;
    lines.push(`${hero.name} — « Je te renie ! » : la mutation est REFUSÉE (1 Point de Résilience ; les Points de Corruption restent).`);
    pushReveal(set, { kind: 'mutation', title: 'Je te renie !', lines: [...lines], subjectId: hero.id, severity: 'minor' });
  } else {
    lines.push(...applyMutation(set, hero, { roll: pr.testRoll, target: pr.testTarget }));
  }
  const b = get().battle;
  if (b) set({ battle: { ...b, log: [...b.log, ...evLines(lines, 'info', hero.id)] } });
  else set({ journal: [...get().journal.slice(-40), ...lines] });
}

/** Cible d'un effet de Corruption : héros désigné, sinon le premier vivant. */
export function corruptionTarget(s: GameState, heroId?: string): Combatant | undefined {
  const pool = s.battle?.combatants.filter((c) => c.kind === 'hero') ?? s.party;
  return (heroId ? pool.find((h) => h.id === heroId) : undefined) ?? pool.find((h) => !h.dead && !h.outOfRencontre);
}
