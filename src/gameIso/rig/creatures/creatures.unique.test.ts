import { describe, it, expect } from 'vitest';
import { CREATURES, defId } from './index';
import { baseSpeciesOf } from '../skeletons';
import { RACES } from '../races';
import { creatures, species as rulesSpecies } from '../../../data';
import { slugId } from '../../../data/slug';

describe('creatures — id d’espèce (slug) STABLE et UNIQUE', () => {
  it('aucune collision de defId sur l’ensemble des defs (sinon désambiguïser via `id?`)', () => {
    const ids = CREATURES.map(defId);
    const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
    expect(dupes, `collisions de slug : ${dupes.join(', ')}`).toEqual([]);
  });
});

describe('baseSpeciesOf — chaque slug d’espèce mappe vers une RACE EXISTANTE', () => {
  // Garde-fou anti-« défaut Humain silencieux » de `raceById` : une sortie baseSpeciesOf hors
  // `raceAppearance` ferait basculer le rendu en Humain sans erreur. On fige l'invariant sur tout
  // slug d'espèce réellement présent : defs bipèdes + `appearance.species` (données) + ponts rules→rig.
  const raceIds = new Set(Object.keys(RACES));
  const slugs = new Set<string>([
    ...CREATURES.filter((c) => c.plan === 'biped').map(defId),
    ...(creatures.map((c) => c.appearance?.species).filter(Boolean) as string[]),
    ...rulesSpecies.map((s) => slugId(s.label)),
  ]);
  it('toutes les sorties baseSpeciesOf sont des race-ids connus', () => {
    for (const s of slugs) {
      const race = baseSpeciesOf(s);
      expect(raceIds.has(race), `${s} → ${race} (race inconnue de raceAppearance)`).toBe(true);
    }
  });
});
