/**
 * Corruption & mutations — flux store (LDB 19, moteur pur : engine/corruption).
 *
 *  - `gainCorruption` : ajoute des Points, puis applique le SEUIL (l.80) — au-delà
 *    de BFM+BE, Test de Résistance Intermédiaire (auto-résolu, révélé au joueur) ;
 *    échec → MUTATION (−BFM Points, d100 corps/esprit par espèce, tirage sur le
 *    Tableau physique/mentale) ; puis LIMITES (l.95) → damné (hors-jeu définitif).
 *  - Sombre Pacte (l.16/41) : +1 Point volontaire pour RELANCER un Test raté, même
 *    après une relance de Chance — branché dans les modales de jet (ChanceButtons).
 *  - Effets d'éditeur : `corruptionExposure` (Test différé par modale) et
 *    `giveCorruption` (gain direct, artefact maudit…).
 */
import type { GameState } from './store';
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

/**
 * Ajoute `n` Points de Corruption à `hero`, applique seuil → mutation → limites.
 * Mute le héros EN PLACE (l'appelant pousse le patch de re-rendu) et renvoie les
 * lignes de journal. La révélation (dés du Test/de la table) est poussée dans la
 * file `pendingReveals` (« un jet = une modale », jet SUBI → révélation témoin).
 */
export function gainCorruption(get: () => GameState, set: any, hero: Combatant, n: number): string[] {
  const rng = battleRng();
  const lines: string[] = [];
  hero.corruption = (hero.corruption ?? 0) + n;
  lines.push(`${hero.name} : +${n} Point${n > 1 ? 's' : ''} de Corruption (total ${hero.corruption}).`);

  // Seuil « Corrompu » (l.80) : à CHAQUE gain au-delà de BFM+BE, Test de Résistance
  // Intermédiaire (+0) ; succès = contenu « pour cette fois », échec = mutation.
  if (!corruptionThresholdExceeded(hero)) return lines;
  const t = rollTest(testValue(hero, 'Résistance'), 'intermediaire', rng);
  if (t.success) {
    lines.push(`${hero.name} contient sa Corruption — pour cette fois (Résistance : ${t.roll}/${t.target}).`);
    if (hero.kind === 'hero')
      pushReveal(set, { kind: 'mutation', title: 'Corruption contenue', dice: t.roll, lines: [...lines], subjectId: hero.id });
    return lines;
  }

  // Dissolution du corps et de l'esprit (l.82-91) : −BFM Points, puis d100 corps/esprit
  // selon l'espèce, puis tirage sur le Tableau de Corruption physique/mentale.
  const lost = bonus(effectiveChar(hero, 'FM'));
  hero.corruption = Math.max(0, hero.corruption - lost);
  const kindRoll = d100(rng);
  const kind = mutationKindFor(hero.species, kindRoll);
  const m = rollMutation(kind, rng);
  attachMutation(hero, m);
  // Effets dérivés immédiats : PA naturels (loadout) + Blessures max si F/E/FM permanents.
  if (hero.items?.length) recomputeLoadout(hero);
  refreshWounds(hero);
  lines.push(
    `${hero.name} MUTE (Résistance ${t.roll}/${t.target} ratée) : ${m.label} — Corruption ${kind} (${kindRoll} → ${kind === 'physique' ? 'corps' : 'esprit'}, table ${m.roll}).`,
  );
  if (m.note) lines.push(`${m.label} : ${m.note}`);

  // Limites de Corruption (l.95) : plus de mutations physiques que BE ou mentales que
  // BFM → l'âme appartient aux Dieux Sombres. Hors-jeu définitif (traité comme mort).
  if (mutationLimitExceeded(hero)) {
    hero.damned = true;
    hero.dead = true;
    lines.push(`${hero.name} a BASCULÉ dans le Chaos — damné, perdu pour le groupe (LDB 19, Limites de Corruption).`);
  }
  if (hero.kind === 'hero')
    pushReveal(set, { kind: 'mutation', title: `Mutation — ${m.label}`, dice: m.roll, lines: [...lines], subjectId: hero.id });
  return lines;
}

/** Cible d'un effet de Corruption : héros désigné, sinon le premier vivant. */
export function corruptionTarget(s: GameState, heroId?: string): Combatant | undefined {
  const pool = s.battle?.combatants.filter((c) => c.kind === 'hero') ?? s.party;
  return (heroId ? pool.find((h) => h.id === heroId) : undefined) ?? pool.find((h) => !h.dead && !h.outOfRencontre);
}
