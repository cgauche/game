import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { resolveCritique } from './critical';
import reference from './crit-rng-invariance.fixture.json';
import type { Combatant, HitLocation } from './types';
import type { JeuDeCritique } from '../data/criticals';

/**
 * INVARIANCE du flux de RNG des Blessures critiques (#1657 B2a, #1682, B3-1).
 *
 * Ce qu'il verrouille, qu'aucun autre test ne voit : l'ORDRE de consommation des dés. Un jet déplacé
 * d'une ligne (le 1d10 de fracture avant l'amputation, un dé de plus tiré quelque part) laisse toutes
 * les assertions de comportement vertes et change TOUTES les parties à seed égale. 480 cas : 40 seeds
 * × 6 Localisations × 2 jeux, la moitié avec 8 points d'overkill pour exercer le modificateur de
 * sévérité de chaque jeu.
 *
 * PÉRIMÈTRE, depuis B3-1 : le résolveur ne roule PLUS le nœud `test` de la rangée (il le REND en
 * `testFlow`, la porte le joue) — l'issue de ce Test n'est donc PAS déterministe par seed, et n'a pas
 * à l'être : c'est une fenêtre de joueur (Chance = relance). Restent invariants, et ce test les fige :
 * le d100 de SÉVÉRITÉ (`roll`), la RANGÉE atteinte (`entryId`/`label`/`lethal`/`desc`), les effets
 * immédiats, les séquelles, et le nœud RENDU lui-même (branches + enjeu posé).
 *
 * La RÉFÉRENCE (`crit-rng-invariance.fixture.json`) a été RE-CAPTURÉE au lot B3-1. Mesure faite au
 * moment de la recapture, sur la référence PRÉ-B3-1 (capturée, elle, sur `a8220854d` avant toute
 * refacto) : les 480 cas rendent le MÊME `roll`, le MÊME `entryId`, le MÊME `label`, le MÊME `lethal`
 * et la MÊME `desc` — 0 divergence. Le dé de sévérité et la ligne tirée n'ont pas bougé d'un cran ;
 * seul ce qui dépendait du dé du nœud a changé, comme attendu.
 */

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const cible = (): Combatant =>
  ({
    id: 't', name: 'Cible', label: 'Cible', kind: 'enemy', characteristics: CHARS,
    wounds: { current: 10, max: 10 }, conditions: [], skills: [], traumas: [], critEntriesSuffered: [], bodyShape: 'humanoide',
  }) as unknown as Combatant;

/** Stringify STABLE (clés triées récursivement) — l'ORDRE des tableaux, lui, reste significatif :
 *  c'est justement lui qui porte la séquence d'ops et de séquelles. */
function stable(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return Object.fromEntries(Object.keys(o).sort().map((k) => [k, stable(o[k])]));
  }
  return v;
}

const REFERENCE = reference as unknown as Record<string, unknown>;
const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

describe('invariance du RNG des Blessures critiques — référence figée AVANT la fusion des lecteurs', () => {
  it('la référence couvre bien 40 seeds × 6 Localisations × 2 jeux', () => {
    expect(Object.keys(REFERENCE).length).toBe(480);
    const jeux = new Set(Object.keys(REFERENCE).map((k) => k.split('|')[0]));
    expect([...jeux].sort()).toEqual(['aa', 'ldb']);
  });

  it('la référence porte bien des nœuds RENDUS (sinon elle ne mesurerait plus la porte)', () => {
    const avecNoeud = Object.values(REFERENCE).filter((c) => (c as { testFlow?: unknown }).testFlow);
    expect(avecNoeud.length, 'aucun `testFlow` dans la référence : le nœud de rangée a disparu du chemin').toBe(122);
  });

  it('les 480 cas rendent un `CriticalResolved` IDENTIQUE à la référence', () => {
    const divergences: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const overkill = seed % 2 === 0 ? 8 : 0;
      for (const loc of LOCS) {
        for (const jeu of ['ldb', 'aa'] as JeuDeCritique[]) {
          const cle = `${jeu}|${seed}|${loc}|${overkill}`;
          const obtenu = JSON.stringify(stable(resolveCritique(jeu, cible(), loc, makeRNG(seed), { overkill })));
          const attendu = JSON.stringify(stable(REFERENCE[cle]));
          if (obtenu !== attendu) divergences.push(`${cle}\n    attendu : ${attendu}\n    obtenu  : ${obtenu}`);
        }
      }
    }
    expect(divergences, `${divergences.length} cas divergent de la référence :\n  ${divergences.slice(0, 5).join('\n  ')}`).toEqual([]);
  });

  it('la référence n’est pas vide de substance (elle exercerait sinon un chemin trivial)', () => {
    const cas = Object.values(REFERENCE) as { ops: unknown[]; traumas: unknown[]; lethal: boolean; label: string }[];
    expect(new Set(cas.map((c) => c.label)).size).toBeGreaterThan(50); // 65 lignes distinctes atteintes
    expect(cas.filter((c) => c.traumas.length).length).toBeGreaterThan(100); // séquelles réellement posées
    expect(cas.filter((c) => c.lethal).length).toBeGreaterThan(10); // lignes « Mort » atteintes
    expect(cas.filter((c) => c.ops.length).length).toBeGreaterThan(300);
  });
});
