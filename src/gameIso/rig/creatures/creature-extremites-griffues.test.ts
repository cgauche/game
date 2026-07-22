import { describe, it, expect } from 'vitest';
import { CREATURES, bipedDef } from './index';
import type { CreatureDef } from './types';
import { raceById } from '../races';
import { baseSpeciesOf } from '../skeletons';
import { resolveRender } from '../bodyPlan';
import { TENUE_DEFS } from '../parts/tenues/_registry.generated';
import { GRIFFES_ART } from '../parts/elements/defs/griffes';
import { findCreatureById, creatures } from '../../../data';

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
// main), soit le STATBLOC lié (`src/data/creatures.json`, arme naturelle « Griffe(s) »/« Serre(s) »),
// soit un OVERRIDE explicite de `perso.extremites` qui DIFFÈRE du défaut de sa race (#736 Lot 3 :
// la main griffue étant le Nu STRUCTUREL de l'espèce, `resolve.ts`, ce champ divergent EST
// lui-même la décision d'auteur sourcée RAW en commentaire adjacent, ex. Urzo/Homme-bête de
// Khorne/Prédateur sanglant/Bête Impériale — aucun calque de rig séparé n'est requis en preuve).
// Une créature qui porte l'un ou l'autre est un corps
// MONSTRUEUX griffu, même si sa tenue de corps est `nu`/`chevaucheur-de-blaireau`/`gardechamps`
// (ex. Furie du Chaos, Sirène) — contrairement au « nu » civilisé par défaut (Nu du créateur,
// Gardechamps).
function hasClawEvidence(c: CreatureDef, raceExtremites: 'lisses' | 'griffues'): boolean {
  if (c.perso?.monster?.griffes) return true;
  if ((c.perso?.features ?? []).some((f) => f.svg === GRIFFES_ART)) return true;
  if (c.perso?.extremites === 'griffues' && raceExtremites !== 'griffues') return true;
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
      if (hasClawEvidence(c, race.extremites ?? 'lisses')) continue; // #736 Lot 2/3 : griffue légitime malgré la tenue nu
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
      const race = raceById(c.race ?? baseSpeciesOf(c.id));
      if (!hasClawEvidence(c, race.extremites ?? 'lisses')) continue;
      const extremites = c.perso?.extremites ?? race.extremites ?? 'lisses';
      if (extremites !== 'griffues') offenders.push(`${c.label} (${c.id})`);
    }
    expect(offenders).toEqual([]);
  });
});

// Garde de CLASSE (#736 audit EN JEU) : les deux gardes ci-dessus itèrent `CREATURES` (les DEFS de
// rig, indexées par LEUR PROPRE id — ex. Demon.ts → id "demon") et vérifient l'auto-cohérence de
// CHAQUE def. Une def générique (Démon/Skaven/Squelette) n'a PAS de bestiaire homonyme (aucune
// entrée `creatures.json` d'id "demon") : `hasClawEvidence` y retombe silencieusement sur la seule
// preuve RIG (`perso.monster`/`GRIFFES_ART`), sans jamais lire le statbloc du VRAI combattant EN JEU
// (ex. Sanguinaire de Khorne, id "sanguinaire-de-khorne"). Cette garde couvre le chemin RÉEL :
// bestiaire (`src/data/creatures.json`, `appearance.species`) → `resolveRender` → `bipedDef` →
// `raceById(baseSpeciesOf(...))` — EXACTEMENT la résolution d'`enemyRigProfile`/`entityRigProfile`
// (composeRig.tsx l.133). Une espèce de bestiaire qui ne matcherait NI une def NI une règle de
// `speciesRace.json` mordrait ICI, même si sa def partagée passe déjà les deux gardes ci-dessus.
describe('extrémités griffues — chemin RÉEL bestiaire → rig (composeRig, pas l’id de def)', () => {
  it('toute créature du bestiaire avec un indice de griffe au statbloc (arme « Griffe(s) »/« Serre(s) ») résout des extrémités griffues via SA résolution de jeu (species du RECORD, pas l’id de la def)', () => {
    const offenders: string[] = [];
    for (const rec of creatures) {
      const traits = [...(rec.traits ?? []), ...(rec.optionals ?? [])].filter(
        (t): t is { id: string; arg?: string } => 'id' in t,
      );
      const hasClaw = traits.some((t) => t.id === 'arme' && typeof t.arg === 'string' && /griffe|serre/i.test(t.arg));
      if (!hasClaw) continue;
      const r = resolveRender(rec.appearance?.species, rec.traits, rec.id);
      if (r.kind !== 'rig') continue; // gabarit non-bipède (quad/ailé/nuée…) — hors périmètre extrémités
      const bDef = bipedDef(r.species);
      const race = raceById(bDef?.race ?? baseSpeciesOf(r.species));
      const extremites = bDef?.perso?.extremites ?? race.extremites ?? 'lisses';
      if (extremites !== 'griffues') offenders.push(`${rec.label} (${rec.id}, species=${r.species})`);
    }
    expect(offenders).toEqual([]);
  });
});
