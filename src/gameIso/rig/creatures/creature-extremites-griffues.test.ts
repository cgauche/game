import { describe, it, expect } from 'vitest';
import { CREATURES } from './index';
import { raceById } from '../races';
import { baseSpeciesOf } from '../skeletons';
import { TENUE_DEFS } from '../parts/tenues/_registry.generated';

// Garde de CLASSE #736 Lot 1 : une tenue de corps « nu » qui ne déclare pas le slot `pied`
// (`resolve.ts`) retombe sur le repli d'espèce (`extremites` — 'lisses' civilisé ou 'griffues'
// monstrueux). Trois de ces tenues sont des nu-pieds LISSES civilisés (humanoïde en tenue légère,
// pas un monstre) : Nu (corps de chair par défaut), Chevaucheur-de-blaireau, Gardechamps. Toutes
// les AUTRES tenues sans `pied` habillent un corps MONSTRUEUX (démon, squelette, géant, rat-ogre…)
// et veulent un pied GRIFFU — toute créature qui les porte doit donc résoudre `extremites: 'griffues'`
// (par sa race OU par son `perso.extremites`), sinon elle rend un PLAINFOOT d'humain civilisé.
const LISSE_LEGITIME = new Set(['nu', 'chevaucheur-de-blaireau', 'gardechamps']);

const nuGriffuTenues = new Set(
  TENUE_DEFS.filter((t) => !t.set.pied && !LISSE_LEGITIME.has(t.id)).map((t) => t.id),
);

describe('extrémités griffues des créatures en tenue nu-griffue (#736 Lot 1)', () => {
  it('liste des tenues nu-griffu (garde-fou de dérive de la classe)', () => {
    expect([...nuGriffuTenues].sort()).toEqual(
      ['chamane-bray', 'demonette', 'geant', 'rat-ogre', 'sanguinaire', 'squelette'],
    );
  });

  it('toute créature bipède en tenue nu-griffue résout des extrémités griffues', () => {
    const offenders: string[] = [];
    for (const c of CREATURES) {
      if (c.plan !== 'biped') continue;
      const race = raceById(c.race ?? baseSpeciesOf(c.id));
      const tenue = c.perso?.tenue ?? race.tenue;
      if (!tenue || !nuGriffuTenues.has(tenue)) continue;
      const extremites = c.perso?.extremites ?? race.extremites ?? 'lisses';
      if (extremites !== 'griffues') offenders.push(`${c.label} (${c.id}, tenue=${tenue})`);
    }
    expect(offenders).toEqual([]);
  });

  it('aucune créature en tenue nu-pieds LISSE légitime n\'est marquée griffue par erreur', () => {
    const wrongfullyClawed: string[] = [];
    for (const c of CREATURES) {
      if (c.plan !== 'biped') continue;
      const race = raceById(c.race ?? baseSpeciesOf(c.id));
      const tenue = c.perso?.tenue ?? race.tenue;
      if (!tenue || !LISSE_LEGITIME.has(tenue)) continue;
      const extremites = c.perso?.extremites ?? race.extremites ?? 'lisses';
      if (extremites === 'griffues') wrongfullyClawed.push(`${c.label} (${c.id}, tenue=${tenue})`);
    }
    expect(wrongfullyClawed).toEqual([]);
  });
});
