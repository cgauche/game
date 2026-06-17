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
import { CREATURES, defByName } from '../creatures';
import { resolveByName } from '../bodyPlan';
import { creatures as bestiary } from '../../../data';

type Resolved = { plan: string; species: string | null; def: string | null; scale: number };

/** Snapshot de la résolution de PROD (`resolveByName` = resolveRender data-driven : record/espèce
 *  exacte, plus de name-match flou). Fige plan/espèce/def/échelle de tout le bestiaire. */
function resolve(name: string): Resolved {
  const r = resolveByName(name);
  return { plan: r.plan, species: r.species || null, def: defByName(r.species)?.name ?? null, scale: r.scale };
}

const mapOf = (names: string[]): Record<string, Resolved> =>
  Object.fromEntries([...new Set(names)].sort().map((n) => [n, resolve(n)]));

describe('golden — résolution nom→apparence (anti-régression de-POC match-par-nom)', () => {
  it('defs du registre : name → (plan, espèce, def, échelle)', () => {
    expect(mapOf(CREATURES.map((c) => c.name))).toMatchSnapshot();
  });
  it('bestiaire (creatures.json) : label → (plan, espèce, def, échelle)', () => {
    // Clé d'affichage = label ; résolution PAR ID (record du bestiaire).
    const entries = bestiary.map((c) => [c.label, resolve(c.id)] as const).sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    expect(Object.fromEntries(entries)).toMatchSnapshot();
  });
});
