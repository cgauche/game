/**
 * Golden master de la RÉSOLUTION nom → apparence (plan / espèce / def / échelle) — filet
 * anti-régression de la refonte « tuer le match-par-nom POC » (plan P1). On fige ici ce que la
 * résolution actuelle (regex + priorité) produit pour CHAQUE def du registre ET chaque entrée du
 * bestiaire. Après le passage aux références explicites, la résolution (désormais par clé) DOIT
 * reproduire ces snapshots à l'identique : sinon une créature changerait d'apparence.
 *
 * Capture le mapping exact de `enemyProfile`/`pickBackend` :
 *   classifyEnemy = creaturePlanMatch(name) ? 'creature' : 'rig'
 *   non-bipède → { plan, def, scale=creatureSpeciesScale }
 *   bipède     → { plan:'biped', species=bipedSpeciesMatch ?? 'Humain', def=bipedDef(species), scale=bipedSpeciesScale }
 */
import { describe, it, expect } from 'vitest';
import {
  CREATURES, bipedSpeciesMatch, bipedDef, bipedSpeciesScale,
  creatureMatch, creaturePlanMatch, creatureSpeciesScale,
} from '../creatures';
import { creatures as bestiary } from '../../../data';

type Resolved = { plan: string; species: string | null; def: string | null; scale: number };

/** Mirroir EXACT de la résolution de production (enemyProfile.classifyEnemy/detectSpecies). */
function resolve(name: string): Resolved {
  const plan = creaturePlanMatch(name);
  if (plan) {
    return { plan, species: null, def: creatureMatch(name)?.name ?? null, scale: creatureSpeciesScale(name) };
  }
  const species = bipedSpeciesMatch(name) ?? 'Humain';
  return { plan: 'biped', species, def: bipedDef(species)?.name ?? null, scale: bipedSpeciesScale(name) };
}

const mapOf = (names: string[]): Record<string, Resolved> =>
  Object.fromEntries([...new Set(names)].sort().map((n) => [n, resolve(n)]));

describe('golden — résolution nom→apparence (anti-régression de-POC match-par-nom)', () => {
  it('defs du registre : name → (plan, espèce, def, échelle)', () => {
    expect(mapOf(CREATURES.map((c) => c.name))).toMatchSnapshot();
  });
  it('bestiaire (creatures.json) : label → (plan, espèce, def, échelle)', () => {
    expect(mapOf(bestiary.map((c) => c.label))).toMatchSnapshot();
  });
});
