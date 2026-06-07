import { describe, it, expect } from 'vitest';
import { bodyPlanOf, planById } from './bodyPlan';

describe('gabarits auto-enregistrés (plans/defs/ → PLANS dérivé)', () => {
  it('planById résout les 11 gabarits sans registre central', () => {
    for (const id of ['biped', 'quadruped', 'winged', 'serpentine', 'arachnid', 'avian', 'cephalopod', 'spectral', 'squig', 'amorphous', 'jabberslythe']) {
      const p = planById(id);
      expect(p, id).toBeTruthy();
      expect(p.id, `${id} déclare son propre id`).toBe(id);
    }
  });
});

describe('bodyPlanOf', () => {
  it('quadrupèdes → quadruped', () => {
    for (const n of ['Cheval', 'Loup', 'Sanglier', 'Rat géant', 'Ours', 'Chien',
      // exotiques rapatriés en quad (reptilien/batracien/multi-têtes)
      'Basilic', 'Crapaud géant', 'Hydre']) {
      expect(bodyPlanOf(n)).toBe('quadruped');
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
      expect(bodyPlanOf(n)).toBe('biped');
    }
  });
  it('ailés (griffon/pégase/hippogriffe/dragon) → winged', () => {
    for (const n of ['Griffon', 'Pégase', 'Hippogriffe', 'Dragon', 'Wyverne', 'Demigriffon',
      'Manticore', 'Varghulf', 'Chauve-souris vampire']) { // jalon 3 : sortis du monolithique
      expect(bodyPlanOf(n)).toBe('winged');
    }
  });
  it('nouveaux squelettes exotiques → leur plan dédié', () => {
    expect(bodyPlanOf('Grand serpent venimeux')).toBe('serpentine');
    expect(bodyPlanOf('Sangsue des marais')).toBe('serpentine');
    expect(bodyPlanOf('Araignée géante')).toBe('arachnid');
    expect(bodyPlanOf('Pigeon voyageur')).toBe('avian');
    expect(bodyPlanOf('Pieuvre des tourbières')).toBe('cephalopod');
  });
  it('morts-vivants spectraux → spectral', () => {
    for (const n of ['Spectre de cairn', 'Fantôme', 'Banshee']) expect(bodyPlanOf(n)).toBe('spectral');
  });
  it('squig → squig', () => {
    expect(bodyPlanOf('Squig des cavernes')).toBe('squig');
    expect(bodyPlanOf('Squig vorace')).toBe('squig');
  });
  it('bête des marais → amorphous (gabarit hulk réutilisable)', () => {
    expect(bodyPlanOf('Bête des marais')).toBe('amorphous');
  });
  it('bêtes du Chaos (jabberslythes nommés) → jabberslythe — bespoke ANIMÉ, plus de monolithique', () => {
    for (const n of ['Jabberslythe', 'Slenderthigh Whiptongue', "Fr'hough Mournbreath", 'Bête de Nurgle']) {
      expect(bodyPlanOf(n)).toBe('jabberslythe');
    }
  });
  it('nom inconnu → bipède par défaut (le monolithique n’est plus qu’un fallback opt-in via def)', () => {
    expect(bodyPlanOf('Créature totalement inconnue xyz')).toBe('biped');
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
