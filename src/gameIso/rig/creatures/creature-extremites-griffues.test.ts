import { describe, it, expect } from 'vitest';
import { CREATURES } from './index';
import type { CreatureDef } from './types';
import { raceById } from '../races';
import { baseSpeciesOf } from '../skeletons';
import { TENUE_DEFS } from '../parts/tenues/_registry.generated';
import { GRIFFES_ART } from '../parts/elements/defs/griffes';
import { findCreatureById } from '../../../data';

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

// Indice de griffe #736 Lot 2 : DANS la donnée de la créature — soit le RIG (`perso.monster.griffes`,
// calque de mains via `monsterInjection`, ou une `perso.features` posant l'art `GRIFFES_ART` sur une
// main), soit le STATBLOC lié (`src/data/creatures.json`, arme naturelle « Griffe(s) »/« Serre(s) »,
// ex. Peau-de-Loup dont le rig n'a pas encore de calque de main dédié — #736 Lot 3). Une créature
// qui porte l'un ou l'autre est un corps MONSTRUEUX griffu, même si sa tenue de corps est
// `nu`/`chevaucheur-de-blaireau`/`gardechamps` (ex. Furie du Chaos, Sirène, Peau-de-Loup) —
// contrairement au « nu » civilisé par défaut (Nu du créateur, Gardechamps).
function hasClawEvidence(c: CreatureDef): boolean {
  if (c.perso?.monster?.griffes) return true;
  if ((c.perso?.features ?? []).some((f) => f.svg === GRIFFES_ART)) return true;
  const statblock = findCreatureById(c.id);
  const traits = [...(statblock?.traits ?? []), ...(statblock?.optionals ?? [])].filter(
    (t): t is { id: string; arg?: string } => 'id' in t,
  );
  return traits.some((t) => t.id === 'arme' && typeof t.arg === 'string' && /griffe|serre/i.test(t.arg));
}

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

  it("aucune créature en tenue nu-pieds LISSE légitime SANS indice de griffe n'est marquée griffue par erreur", () => {
    const wrongfullyClawed: string[] = [];
    for (const c of CREATURES) {
      if (c.plan !== 'biped') continue;
      const race = raceById(c.race ?? baseSpeciesOf(c.id));
      const tenue = c.perso?.tenue ?? race.tenue;
      if (!tenue || !LISSE_LEGITIME.has(tenue)) continue;
      if (hasClawEvidence(c)) continue; // #736 Lot 2 : griffue légitime malgré la tenue nu
      const extremites = c.perso?.extremites ?? race.extremites ?? 'lisses';
      if (extremites === 'griffues') wrongfullyClawed.push(`${c.label} (${c.id}, tenue=${tenue})`);
    }
    expect(wrongfullyClawed).toEqual([]);
  });
});

describe('extrémités griffues des créatures portant un indice de griffe DANS leur donnée (#736 Lot 2)', () => {
  it('toute créature bipède avec un indice de griffe (rig monster.griffes/GRIFFES_ART ou statbloc « Griffes »/« Serres ») résout des extrémités griffues', () => {
    const offenders: string[] = [];
    for (const c of CREATURES) {
      if (c.plan !== 'biped') continue;
      if (!hasClawEvidence(c)) continue;
      const race = raceById(c.race ?? baseSpeciesOf(c.id));
      const extremites = c.perso?.extremites ?? race.extremites ?? 'lisses';
      if (extremites !== 'griffues') offenders.push(`${c.label} (${c.id})`);
    }
    expect(offenders).toEqual([]);
  });
});
