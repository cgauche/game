/**
 * Corruption & mutations — flux store (LDB 19, moteur pur : engine/corruption).
 *
 *  - `gainCorruption` : ajoute des Points, puis applique le SEUIL (l.80) — au-delà
 *    de BFM+BE (+ niveau d'Âme pure, LDB 10), Test de Résistance Intermédiaire en MODALE
 *    différée (pendingCorruption kind 'seuil' — Lancer/Chance/Pacte ; repli auto-résolu +
 *    révélation pour les PNJ et les gains en rafale) ; échec → MUTATION (−BFM Points, d100
 *    corps/esprit par espèce, tirage sur le Tableau physique/mentale) ; puis LIMITES (l.87)
 *    → damné (hors-jeu définitif).
 *  - « Je te renie ! » (LDB 17 l.71) : un HÉROS avec de la Résilience peut REFUSER la mutation
 *    (1 Point de Résilience ; « comme vous ne mutez pas, vous ne perdez aucun Point de
 *    Corruption ») → choix par modale (`pendingRenounce`), la mutation est suspendue.
 *  - Sombre Pacte (l.16/41) : +1 Point volontaire pour RELANCER un Test raté, même
 *    après une relance de Chance — branché dans les modales de jet (ChanceButtons).
 *  - Effets d'éditeur : `corruptionExposure` (Test différé par modale) ; gain direct
 *    via l'Effet générique `ops` (op `corruption` + champ `align` optionnel).
 */
import type { GameState } from './store';
import type { Get, Set } from './flowTypes';
import type { Combatant } from '../engine/types';
import { battleRng } from './battleRng';
import { zoneCovers } from './zones';
import { bonus, effectiveChar, refreshWounds } from '../engine/characteristics';
import { recomputeLoadout } from '../engine/items';
import { d100 } from '../engine/dice';
import {
  corruptionThresholdExceeded,
  mutationKindFor,
  mutationLimitExceeded,
  attachMutation,
  type ChaosAlign,
} from '../engine/corruption';
import { rollMutation } from '../data/mutations';
import { rule } from '../engine/policy';
import { rollTest } from '../engine/tests';
import { testValue } from '../engine/skills';
import { pushReveal } from './combatFlow';
import { checkPartyWiped } from './partyWipe';
import { evLines } from './combatLog';
import { pilotedByHuman } from './netOwnership';
import { followsCharacterRules } from '../engine/relations';
import { resultLine, freeCons } from './rollSeam';

/**
 * Ajoute `n` Points de Corruption à `hero`, applique seuil → mutation → limites.
 * Mute le héros EN PLACE (l'appelant pousse le patch de re-rendu) et renvoie les
 * lignes de journal. La révélation (dés du Test/de la table) est poussée dans la
 * file `pendingReveals` (jet SUBI → révélation témoin).
 */
export function gainCorruption(get: Get, set: Set, hero: Combatant, n: number, align?: ChaosAlign): string[] {
  const rng = battleRng();
  const lines: string[] = [];
  // Protection de Phâ (LDB 48 p.249) : un occupant d'une Zone `noCorruption` ne gagne aucune Corruption.
  if (n > 0 && hero.pos && (get().battle?.zones ?? []).some((z) => z.noCorruption && zoneCovers(z, hero.pos!))) {
    return [`${hero.label} : la lumière sacrée de Phâ écarte la Corruption (aucun gain).`];
  }
  hero.corruption = (hero.corruption ?? 0) + n;
  lines.push(`${hero.label} : +${n} Point${n > 1 ? 's' : ''} de Corruption (total ${hero.corruption}).`);

  // Seuil « Corrompu » (l.80) : à CHAQUE gain au-delà de BFM+BE (+ Âme pure), Test de Résistance
  // Intermédiaire (+0) ; succès = contenu « pour cette fois », échec = mutation.
  if (!corruptionThresholdExceeded(hero)) return lines;
  // « Un jet = une modale » : pour un pilote HUMAIN, le Test du seuil est un VRAI jet différé — modale
  // de Corruption (kind 'seuil', cycle Lancer→Chance→Pacte), résolu dans `resolveCorruption`
  // (succès = contenu ; échec = « Je te renie ! »/mutation). Repli auto-résolu + révélation
  // témoin : IA (ne tient pas de modale) et gains en RAFALE (une modale déjà ouverte).
  if (pilotedByHuman(get(), hero) && !get().pendingCorruption) {
    lines.push(`${hero.label} : la Corruption déborde son seuil — Test de Résistance.`);
    // `menace: 'mutation'` : l'échec du Test de seuil fait MUTER (l.82) → c'est le Test qui « résiste
    // à la Mutation » du talent Résistance (Menace), LDB 10 l.1015-1021.
    set({ pendingCorruption: { heroId: hero.id, kind: 'seuil', skill: 'resistance', skillLocked: true, align, menace: 'mutation' } });
    return lines;
  }
  const t = rollTest(testValue(hero, 'resistance'), 'intermediaire', rng);
  if (t.success) {
    // Le dé de Résistance est DÉJÀ affiché par la rangée `TableRollLine` de la révélation (dice: t.roll,
    // ci-dessous) — pas de re-print (#295 Lot 4).
    lines.push(resultLine(freeCons([`${hero.label} contient sa Corruption — pour cette fois.`])));
    if (pilotedByHuman(get(), hero))
      pushReveal(set, { kind: 'mutation', title: 'Corruption contenue', dice: t.roll, lines: [...lines], subjectId: hero.id, severity: 'minor' });
    return lines;
  }

  // « Je te renie ! » (LDB 17 l.71) : un pilote humain avec de la Résilience peut refuser la mutation —
  // choix par modale ; la mutation (applyMutation) n'est appliquée qu'à la résolution.
  if (pilotedByHuman(get(), hero) && (hero.resilience ?? 0) > 0) {
    // Le jet (roll/target) est repris par la rangée de `RenounceModal` juste ensuite — pas de re-print (#295 Lot 5).
    lines.push(`${hero.label} échoue à contenir sa Corruption — la mutation menace…`);
    set({ pendingRenounce: { heroId: hero.id, testRoll: t.roll, testTarget: t.target, align } });
    return lines;
  }
  lines.push(...applyMutation(get, set, hero, { roll: t.roll, target: t.target }, align));
  return lines;
}

/** Applique la MUTATION (l.82-91) : −BFM Points, d100 corps/esprit par espèce, tirage sur le
 *  Tableau de Corruption physique/mentale, effets dérivés, puis LIMITES (l.87) → damné. */
export function applyMutation(get: Get, set: Set, hero: Combatant, _test?: { roll: number; target: number }, align?: ChaosAlign): string[] {
  const rng = battleRng();
  const lines: string[] = [];
  const lost = bonus(effectiveChar(hero, 'force-mentale'));
  hero.corruption = Math.max(0, (hero.corruption ?? 0) - lost);
  const kindRoll = d100(rng);
  const kind = mutationKindFor(hero.species, kindRoll);
  // Table de Corruption : l'alignement de la SOURCE (posé par l'éditeur de niveau) PRIME ; sinon la
  // règle globale `corruption-tables-edoc` ('ldb' → Tableaux du Livre de base ; sinon table EDOC
  // alignée par Puissance). La sous-table « Tête bestiale » est ré-tirée par rollMutation.
  const mode = String(rule('corruption-tables-edoc'));
  const a = align ?? (mode === 'ldb' ? null : mode);
  const table = a ? `edoc-${kind === 'physique' ? 'phys' : 'mental'}-${a}` : kind;
  const m = rollMutation(table, rng);
  attachMutation(hero, m, rng);
  // Effets dérivés immédiats : PA naturels (loadout) + Blessures max si F/E/FM permanents.
  if (hero.items?.length) recomputeLoadout(hero);
  refreshWounds(hero);
  // Le dé de table (`m.roll`) est DÉJÀ affiché par la rangée `TableRollLine` (dice: m.roll, révélation
  // ci-dessous) — pas de re-print (#295 Lot 4). Le jet de Résistance du seuil (`test`) est lui aussi
  // déjà affiché par SA propre rangée (Corruption/Renounce) en amont — jamais réimprimé ici (#295 Lot 5).
  lines.push(resultLine(freeCons([
    `${hero.label} MUTE : ${m.label} — Corruption ${kind} (${kindRoll} → ${kind === 'physique' ? 'corps' : 'esprit'}).`,
  ])));
  if (m.note) lines.push(`${m.label} : ${m.note}`);

  // Limites de Corruption (l.87) : plus de mutations physiques que BE ou mentales que
  // BFM → l'âme appartient aux Dieux Sombres. Hors-jeu définitif (traité comme mort).
  if (mutationLimitExceeded(hero)) {
    hero.damned = true;
    hero.dead = true;
    lines.push(`${hero.label} a BASCULÉ dans le Chaos — damné, perdu pour le groupe.`);
  }
  if (pilotedByHuman(get(), hero))
    pushReveal(set, { kind: 'mutation', title: `Mutation — ${m.label}`, dice: m.roll, lines: [...lines], subjectId: hero.id, severity: 'grave' });
  checkPartyWiped(get, set); // damnation du dernier héros hors combat → défaite (no-op en combat)
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
    lines.push(`${hero.label} — « Je te renie ! » : la mutation est REFUSÉE (1 Point de Résilience ; les Points de Corruption restent).`);
    pushReveal(set, { kind: 'mutation', title: 'Je te renie !', lines: [...lines], subjectId: hero.id, severity: 'minor' });
  } else {
    lines.push(...applyMutation(get, set, hero, { roll: pr.testRoll, target: pr.testTarget }, pr.align));
  }
  const b = get().battle;
  if (b) set({ battle: { ...b, log: [...b.log, ...evLines(lines, 'info', hero.id)] } });
  else get().log(lines);
}

/** Cible d'un effet de Corruption : héros désigné, sinon le premier vivant. #152 (suite #143) : le pool
 *  en combat est celui des PERSONNAGES (`followsCharacterRules`, PAS un proxy `kind==='hero'`) — un PNJ
 *  humain hostile MODÉLISÉ (statbloc d'éditeur ou bestiaire rétro-flagué) y est éligible comme un héros. */
export function corruptionTarget(s: GameState, heroId?: string): Combatant | undefined {
  const pool = s.battle?.combatants.filter((c) => followsCharacterRules(c)) ?? s.party;
  return (heroId ? pool.find((h) => h.id === heroId) : undefined) ?? pool.find((h) => !h.dead && !h.outOfRencontre);
}
