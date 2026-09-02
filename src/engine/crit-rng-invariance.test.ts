import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import { resolveCritique } from './critical';
import reference from './crit-rng-invariance.fixture.json';
import type { Combatant, HitLocation } from './types';
import type { JeuDeCritique } from '../data/criticals';

/**
 * INVARIANCE du flux de RNG des Blessures critiques (#1657 B2a, #1682) — le vrai gate de la fusion.
 *
 * La RÉFÉRENCE (`crit-rng-invariance.fixture.json`) a été CAPTURÉE sur l'arbre `a8220854d`, AVANT la
 * moindre ligne de refacto, en appelant les DEUX lecteurs d'alors (`rollCritical` LDB et
 * `resolveAACritical`). Ce test rejoue les mêmes 480 cas (40 seeds × 6 Localisations × 2 jeux, la
 * moitié avec 8 points d'overkill pour exercer le modificateur de sévérité de chaque jeu) à travers
 * le lecteur UNIQUE, et exige un `CriticalResolved` IDENTIQUE, champ pour champ.
 *
 * Ce qu'il verrouille, qu'aucun autre test ne voit : l'ORDRE de consommation des dés. Un jet déplacé
 * d'une ligne (le nœud `test` avant l'effet immédiat, le 1d10 de fracture avant l'amputation, un dé
 * de plus tiré sur une branche `success` vide) laisse toutes les assertions de comportement vertes
 * et change TOUTES les parties à seed égale.
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

/**
 * LES DEUX SEULES transformations admises sur la référence — toutes deux DÉCLARÉES, toutes deux
 * SÉMANTIQUEMENT NEUTRES, et toutes deux BORNÉES par un compte asserté (elles ne peuvent pas
 * s'étendre en silence à un cas qui divergerait vraiment) :
 *
 *  (a) `critTrigger` — le déclencheur d'escalade posé sur une séquelle (« Commotion cérébrale »,
 *      LDB 18 l.74) portait une graphie propriétaire `{resist:{difficulty, onFail}}` ; il porte
 *      désormais le nœud `test` du Flow (`SAVE_VERSION` 38 → 39).
 *  (b) `wounds` — la colonne « Blessures » d'Aux Armes (AA 07 l.40) était construite en TS SANS
 *      déclarer sa mitigation ; descendue en donnée, elle l'ÉCRIT (garde
 *      `wounds-mitigation-declaree`). `applyOps` ignore BE+PA par DÉFAUT sur `wounds` : écrire
 *      `ignoreTB:true, ignoreAP:true` ne change RIEN à ce qui est appliqué — c'est la même op, dite.
 */
function normaliseCritTrigger(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normaliseCritTrigger);
  if (!v || typeof v !== 'object') return v;
  const o = v as Record<string, unknown>;
  const trig = o.critTrigger as { resist?: { difficulty: unknown; onFail: unknown[] } } | undefined;
  if (!trig?.resist) return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, normaliseCritTrigger(x)]));
  const { resist, ...reste } = trig;
  return {
    ...o,
    critTrigger: {
      ...reste,
      test: {
        kind: 'test',
        test: { difficulty: resist.difficulty },
        success: { kind: 'seq', steps: [] },
        fail: { kind: 'do', effect: { type: 'ops', ops: resist.onFail, on: 'target' } },
      },
    },
  };
}

function normaliseMitigation(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normaliseMitigation);
  if (!v || typeof v !== 'object') return v;
  const o = v as Record<string, unknown>;
  const dedans = Object.fromEntries(Object.entries(o).map(([k, x]) => [k, normaliseMitigation(x)]));
  if (o.op !== 'wounds' || ('ignoreTB' in o && 'ignoreAP' in o)) return dedans;
  return { ...dedans, ignoreTB: true, ignoreAP: true };
}

const normalise = (v: unknown): unknown => normaliseMitigation(normaliseCritTrigger(v));

const REFERENCE = reference as unknown as Record<string, unknown>;
const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

describe('invariance du RNG des Blessures critiques — référence figée AVANT la fusion des lecteurs', () => {
  it('la référence couvre bien 40 seeds × 6 Localisations × 2 jeux', () => {
    expect(Object.keys(REFERENCE).length).toBe(480);
    const jeux = new Set(Object.keys(REFERENCE).map((k) => k.split('|')[0]));
    expect([...jeux].sort()).toEqual(['aa', 'ldb']);
  });

  it('la normalisation du `critTrigger` ne touche QU’UN cas de la référence — elle ne peut pas s’étendre', () => {
    const touches = Object.entries(REFERENCE)
      .filter(([, v]) => JSON.stringify(normaliseCritTrigger(v)) !== JSON.stringify(v))
      .map(([k]) => k);
    expect(touches).toEqual(['ldb|36|tete|8']); // « Commotion cérébrale », seule ligne à armer un déclencheur
  });

  it('la normalisation de la MITIGATION ne touche QUE des cas Aux Armes, et aucun cas LDB', () => {
    const touches = Object.entries(REFERENCE).filter(([, v]) => JSON.stringify(normaliseMitigation(v)) !== JSON.stringify(v));
    expect(touches.length, 'aucun cas touché : la normalisation ne mesure plus rien').toBeGreaterThan(0);
    // Le LDB ÉCRIVAIT déjà sa mitigation en donnée (LDB 18 l.62) : seule la colonne « Blessures »
    // d'AA, construite en TS, ne la disait pas. Un cas LDB touché serait une vraie divergence.
    expect(touches.filter(([k]) => k.startsWith('ldb|')).map(([k]) => k)).toEqual([]);
  });

  it('les 480 cas rendent un `CriticalResolved` IDENTIQUE à la référence', () => {
    const divergences: string[] = [];
    for (let seed = 1; seed <= 40; seed++) {
      const overkill = seed % 2 === 0 ? 8 : 0;
      for (const loc of LOCS) {
        for (const jeu of ['ldb', 'aa'] as JeuDeCritique[]) {
          const cle = `${jeu}|${seed}|${loc}|${overkill}`;
          const obtenu = JSON.stringify(stable(resolveCritique(jeu, cible(), loc, makeRNG(seed), { overkill })));
          const attendu = JSON.stringify(stable(normalise(REFERENCE[cle])));
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
