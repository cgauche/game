import { describe, it, expect } from 'vitest';
import { resolveRender, planById, type RenderResolution } from './bodyPlan';
import { creatureMatch, creaturePlanMatch, bipedSpeciesMatch, bipedSpeciesScale, creatureSpeciesScale } from './creatures';
import { isSwarm } from '../../engine/traits/dispatch';
import { creatures, findCreature } from '../../data';
import creaturesJson from '../../data/creatures.json';

/** Résolution de rendu recomposée à la main depuis les matchers FEUILLES (creaturePlanMatch + isSwarm
 *  + creatureMatch + bipedSpeciesMatch + échelles) — référence INDÉPENDANTE des wrappers qui délèguent
 *  désormais à `resolveRender`. resolveRender DOIT reproduire ceci (repli name-match, espèce absente). */
function current(name: string): RenderResolution {
  const swarm = isSwarm(findCreature(name)?.traits);
  const nb = creaturePlanMatch(name);
  if (swarm || nb) {
    const plan = swarm ? 'swarm' : nb!;
    const sp = creatureMatch(name)?.name ?? (plan !== 'monolithic' ? planById(plan)?.speciesNames()[0] : '') ?? '';
    return { kind: 'plan', plan, species: sp, scale: creatureSpeciesScale(name) };
  }
  return { kind: 'rig', plan: 'biped', species: bipedSpeciesMatch(name) ?? 'Humain', scale: bipedSpeciesScale(name) };
}

// Tout le bestiaire (labels creatures.json) + rôles génériques non présents comme record.
const NAMES = [...new Set([...creatures.map((c) => c.label), 'Bandit', 'Cultiste', 'Mutant', 'Villageois', 'Soldat'])];

describe('resolveRender — résolution de rendu data-driven byte-identique au name-match (P5)', () => {
  it('le REPLI (sans espèce) reproduit exactement le name-match actuel', () => {
    for (const name of NAMES) {
      const traits = findCreature(name)?.traits;
      expect(resolveRender(undefined, traits, name), name).toEqual(current(name));
    }
  });

  it('bestiaire OFFICIEL : la voie EXPLICITE (espèce posée par 5b) reproduit le name-match', () => {
    // Byte-identité garantie sur le bestiaire officiel (5b a posé species = résolution par le nom).
    // NB : les créatures frenchy.bzh ont une espèce AUTORITAIRE (fixée par l'import) qui peut
    // CORRIGER un faux positif du matcher flou (ex. « Porte-Peste de Nurgle » : un alias matche à
    // tort → classé créature, alors que l'espèce explicite est bipède) → divergence VOULUE, exclue ici.
    for (const c of creaturesJson as { label: string; traits?: string[]; appearance?: { species?: string } }[]) {
      const r = resolveRender(c.appearance?.species, c.traits, c.label);
      const ref = current(c.label);
      expect({ kind: r.kind, plan: r.plan }, c.label).toEqual({ kind: ref.kind, plan: ref.plan });
    }
  });
});
