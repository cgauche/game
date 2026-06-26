import { describe, it, expect } from 'vitest';
import { bodyPlanById, resolveSpecies, planById } from './bodyPlan';

/** Plan d'une ESPÈCE canonique (nom de def) et plan d'un ID de record — les deux chemins explicites. */
const planOfSpecies = (s: string): string => resolveSpecies(s).plan;
const planOfId = (id: string): string => bodyPlanById(id);

describe('gabarits auto-enregistrés (plans/defs/ → PLANS dérivé)', () => {
  it('planById résout les 11 gabarits sans registre central', () => {
    for (const id of ['biped', 'quadruped', 'winged', 'serpentine', 'arachnid', 'avian', 'cephalopod', 'spectral', 'squig', 'amorphous', 'jabberslythe']) {
      const p = planById(id);
      expect(p, id).toBeTruthy();
      expect(p.id, `${id} déclare son propre id`).toBe(id);
    }
  });
});

describe('résolution espèce/id → plan (resolveSpecies / bodyPlanById)', () => {
  it('quadrupèdes → quadruped', () => {
    for (const n of ['Cheval', 'Loup', 'Sanglier', 'Rat géant', 'Ours', 'Chien',
      // exotiques rapatriés en quad (reptilien/batracien/multi-têtes)
      'Basilic', 'Crapaud', 'Hydre']) {
      expect(planOfSpecies(n), n).toBe('quadruped');
    }
  });
  it('humanoïdes peau-humaine + monstres bipèdes (Phase B) → biped', () => {
    for (const n of [
      'Soldat', 'Bandit', 'Mendiant', 'Noble', 'Guerrier des clans', 'Vermine de choc', 'Rat ogre',
      // Phase B : peaux-vertes, hommes-bêtes, morts-vivants humanoïdes, gros/démons.
      'Orc', 'Gobelin', 'Snotling', 'Gor', 'Minotaure', 'Squelette', 'Zombie', 'Goule de crypte',
      'Troll', 'Vampire', 'Sanguinaire de Khorne',
      // jalon 3 : sortis du monolithique
      'Liche', 'Démonette de Slaanesh', 'Fimir', 'Géant',
    ]) {
      expect(planOfSpecies(n), n).toBe('biped');
    }
  });
  it('ailés (griffon/pégase/hippogriffe/dragon) → winged', () => {
    // ESPÈCES-defs (sans record obligatoire) via resolveSpecies…
    for (const n of ['Hippogriffe', 'Varghulf']) expect(planOfSpecies(n), n).toBe('winged');
    // …et IDs de record (record→espèce) via bodyPlanById.
    for (const id of ['griffon', 'pegase', 'dragon', 'demigriffon', 'manticore']) expect(planOfId(id), id).toBe('winged');
  });
  it('nouveaux squelettes exotiques → leur plan dédié', () => {
    expect(planOfSpecies('Serpent')).toBe('serpentine');
    expect(planOfSpecies('Sangsue')).toBe('serpentine');
    expect(planOfSpecies('Araignée')).toBe('arachnid');
    expect(planOfSpecies('Pigeon')).toBe('avian');
    expect(planOfSpecies('Pieuvre')).toBe('cephalopod');
  });
  it('morts-vivants spectraux (ids de record) → spectral', () => {
    for (const id of ['spectre-de-cairn', 'fantome', 'banshee']) expect(planOfId(id), id).toBe('spectral');
  });
  it('squig → squig', () => {
    expect(planOfSpecies('Squig')).toBe('squig');
  });
  it('bête des marais → amorphous (gabarit hulk réutilisable)', () => {
    expect(planOfSpecies('Bête des marais')).toBe('amorphous');
  });
  it('bêtes du Chaos (jabberslythes nommés) → jabberslythe — bespoke ANIMÉ, plus de monolithique', () => {
    for (const n of ['Jabberslythe', 'Slenderthigh Whiptongue', "Fr'hough Mournbreath"]) {
      expect(planOfSpecies(n), n).toBe('jabberslythe');
    }
  });
  it('espèce inconnue → bipède par défaut (le monolithique n’est plus qu’un fallback opt-in via def)', () => {
    expect(planOfSpecies('Créature totalement inconnue xyz')).toBe('biped');
  });
});

describe('planById(winged)', () => {
  it('rend un griffon avec ailes + 4 pattes au sol', () => {
    const bones = planById('winged').resolve('Griffon', 'profile', {});
    expect(bones.length).toBeGreaterThan(8);
    expect(bones.filter((b) => b.id.startsWith('pied')).length).toBe(4);
    expect(bones.some((b) => b.id === 'aileD' || b.id === 'aileG')).toBe(true);
  });
  it('recolor : colors.corps change le markup du dragon', () => {
    const a = planById('winged').resolve('Dragon', 'profile', {});
    const b = planById('winged').resolve('Dragon', 'profile', {}, { colors: { corps: '#aa1133' } });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe('planById(quadruped)', () => {
  it('rend des os non vides avec les pieds vers le sol', () => {
    const bones = planById('quadruped').resolve('Cheval', 'profile', {});
    expect(bones.length).toBeGreaterThan(8);
    const feet = bones.filter((b) => b.id.startsWith('pied'));
    expect(feet.length).toBe(4);
    const footY = Math.max(...feet.map((b) => b.matrix[5]));
    expect(footY).toBeGreaterThan(120); // pieds dans le bas de la boîte 150
  });
  it('walkPose diffère du repos (la démarche bouge)', () => {
    expect(planById('quadruped').walkPose(0.25)).not.toEqual(planById('quadruped').restPose());
  });
  it('recolor : colors.corps change le markup', () => {
    const a = planById('quadruped').resolve('Cheval', 'profile', {});
    const b = planById('quadruped').resolve('Cheval', 'profile', {}, { colors: { corps: '#aa1133' } });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
