import { describe, it, expect } from 'vitest';
import { resolveRig } from '../composeRig';
import { bonesToSvg } from '../renderBones';
import { entityRigProfile, weaponFromLabel } from '../enemyProfile';
import { resolveSpecies } from '../bodyPlan';
import type { View } from '../facing';
import type { Appearance } from '../appearance';
import type { EquipCtx } from '../parts/equipment';

// Espèces bipèdes couvertes (NOMS d'espèce canoniques) + rôles génériques. Comme un outil, on part
// d'un NOM d'espèce → on le passe en espèce EXPLICITE (resolveSpecies : def name, ou 'Humain' si rôle
// générique sans def) — plus aucun repli implicite par le nom dans entityRigProfile.
const NAMES = ['Humain', 'Nain', 'Halfling', 'Haut-Elfe', 'Elfe sylvain', 'Gnome', 'Ogre',
  'Skaven', 'Orc', 'Gobelin', 'Snotling', 'Homme-bête', 'Minotaure', 'Squelette', 'Zombie',
  'Goule', 'Troll', 'Vampire', 'Démon', 'Liche', 'Démonette', 'Fimir', 'Géant',
  'Guerrier du Chaos', 'Cultiste', 'Mutant'];
const VIEWS: View[] = ['front', 'profile'];

describe('golden master — rendu bipède (anti-régression migration gabarit/race)', () => {
  for (const name of NAMES)
    for (const view of VIEWS) {
      it(`${name} / ${view} stable`, () => {
        const prof = entityRigProfile(name, 7, { species: resolveSpecies(name).species });
        const svg = prof ? bonesToSvg(resolveRig(prof.appearance, prof.equip, {}, prof.tenue, view, [])) : '∅';
        expect(svg).toMatchSnapshot();
      });
    }
});

// ---------------------------------------------------------------------------
// Cas équipés — couvre les chemins de code arme/bouclier/armure/couleurs
// ---------------------------------------------------------------------------

describe('golden master — héros équipés (anti-régression chemins arme/armure/couleur)', () => {
  // (a) Porteur d'arme de mêlée : chemin os `arme` + twist de pose profil mêlée
  const appSoldat: Appearance = { species: 'Humain', sex: 'M', build: 0.5, seed: 3 };
  const equipSoldat: EquipCtx = {
    weapons: [weaponFromLabel('Épée')],
    armour: [],
  };
  for (const view of VIEWS) {
    it(`Humain-Soldat-épée / ${view} stable`, () => {
      const svg = bonesToSvg(resolveRig(appSoldat, equipSoldat, {}, 'Soldat', view));
      expect(svg).toMatchSnapshot();
    });
  }

  // (b) Bouclier + armure corporelle : chemin os `bouclier` + parts armure
  const appGuardien: Appearance = { species: 'Humain', sex: 'F', build: 0.6, seed: 11 };
  const equipGuardien: EquipCtx = {
    weapons: [weaponFromLabel('Hache')],
    armour: [
      { uid: 'syn-corps', name: 'Cotte de mailles', kind: 'armor', qualities: [], pa: 2, locs: ['corps'], enc: 1, equipped: true },
      { uid: 'syn-tete',  name: 'Heaume',            kind: 'armor', qualities: [], pa: 2, locs: ['tete'],  enc: 1, equipped: true },
    ],
    shield: { name: 'Bouclier rondache', type: 'melee' as const, damage: { plusBF: false, flat: 0 }, qualities: [{ id: 'protectrice', value: 1 }] },
  };
  for (const view of VIEWS) {
    it(`Humain-Noble-bouclier-armure / ${view} stable`, () => {
      const svg = bonesToSvg(resolveRig(appGuardien, equipGuardien, {}, 'Noble', view));
      expect(svg).toMatchSnapshot();
    });
  }

  // (c) Surcharge de couleur (appearance.colors) : chemin tokenMap couleur personnalisée
  const appMercenaire: Appearance = {
    species: 'Humain', sex: 'M', build: 0.45, seed: 17,
    colors: { vet1: '#3a5a7a' },
  };
  const equipMercenaire: EquipCtx = {
    weapons: [weaponFromLabel('Hache')],
    armour: [],
  };
  for (const view of VIEWS) {
    it(`Humain-Voleur-couleur-override / ${view} stable`, () => {
      const svg = bonesToSvg(resolveRig(appMercenaire, equipMercenaire, {}, 'Voleur', view));
      expect(svg).toMatchSnapshot();
    });
  }
});
