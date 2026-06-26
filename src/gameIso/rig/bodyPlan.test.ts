import { describe, it, expect } from 'vitest';
import { bodyPlanById, resolveSpecies, planById } from './bodyPlan';

/** Plan d'un ID d'espèce canonique (slug de def) et plan d'un ID de record — les deux chemins explicites. */
const planOfSpecies = (id: string): string => resolveSpecies(id).plan;
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
    for (const id of ['cheval', 'loup', 'sanglier', 'rat-geant', 'ours', 'chien',
      // exotiques rapatriés en quad (reptilien/batracien/multi-têtes)
      'basilic', 'crapaud', 'hydre']) {
      expect(planOfSpecies(id), id).toBe('quadruped');
    }
  });
  it('humanoïdes peau-humaine + monstres bipèdes (Phase B) → biped', () => {
    for (const id of [
      'vermine-de-choc', 'rat-ogre',
      // Phase B : peaux-vertes, hommes-bêtes, morts-vivants humanoïdes, gros/démons.
      'orc', 'gobelin', 'snotling', 'gor', 'minotaure', 'squelette', 'zombie',
      'troll', 'vampire',
      // jalon 3 : sortis du monolithique
      'liche', 'fimir', 'geant',
    ]) {
      expect(planOfSpecies(id), id).toBe('biped');
    }
  });
  it('id d’espèce inconnu (rôle générique sans def) → bipède par défaut', () => {
    for (const id of ['soldat', 'bandit', 'creature-totalement-inconnue-xyz'])
      expect(planOfSpecies(id), id).toBe('biped');
  });
  it('ailés (griffon/pégase/hippogriffe/dragon) → winged', () => {
    // IDS d'espèce-defs (sans record obligatoire) via resolveSpecies…
    for (const id of ['hippogriffe', 'varghulf']) expect(planOfSpecies(id), id).toBe('winged');
    // …et IDs de record (record→espèce) via bodyPlanById.
    for (const id of ['griffon', 'pegase', 'dragon', 'demigriffon', 'manticore']) expect(planOfId(id), id).toBe('winged');
  });
  it('nouveaux squelettes exotiques → leur plan dédié', () => {
    expect(planOfSpecies('serpent')).toBe('serpentine');
    expect(planOfSpecies('sangsue')).toBe('serpentine');
    expect(planOfSpecies('araignee')).toBe('arachnid');
    expect(planOfSpecies('pigeon')).toBe('avian');
    expect(planOfSpecies('pieuvre')).toBe('cephalopod');
  });
  it('morts-vivants spectraux (ids de record) → spectral', () => {
    for (const id of ['spectre-de-cairn', 'fantome', 'banshee']) expect(planOfId(id), id).toBe('spectral');
  });
  it('squig → squig', () => {
    expect(planOfSpecies('squig')).toBe('squig');
  });
  it('bête des marais → amorphous (gabarit hulk réutilisable)', () => {
    expect(planOfSpecies('bete-des-marais')).toBe('amorphous');
  });
  it('bêtes du Chaos (jabberslythes nommés) → jabberslythe — bespoke ANIMÉ, plus de monolithique', () => {
    for (const id of ['jabberslythe', 'slenderthigh-whiptongue', 'fr-hough-mournbreath']) {
      expect(planOfSpecies(id), id).toBe('jabberslythe');
    }
  });
});

describe('planById(winged)', () => {
  it('rend un griffon avec ailes + 4 pattes au sol', () => {
    const bones = planById('winged').resolve('griffon', 'profile', {});
    expect(bones.length).toBeGreaterThan(8);
    expect(bones.filter((b) => b.id.startsWith('pied')).length).toBe(4);
    expect(bones.some((b) => b.id === 'aileD' || b.id === 'aileG')).toBe(true);
  });
  it('recolor : colors.corps change le markup du dragon', () => {
    const a = planById('winged').resolve('dragon', 'profile', {});
    const b = planById('winged').resolve('dragon', 'profile', {}, { colors: { corps: '#aa1133' } });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});

describe('planById(quadruped)', () => {
  it('rend des os non vides avec les pieds vers le sol', () => {
    const bones = planById('quadruped').resolve('cheval', 'profile', {});
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
    const a = planById('quadruped').resolve('cheval', 'profile', {});
    const b = planById('quadruped').resolve('cheval', 'profile', {}, { colors: { corps: '#aa1133' } });
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(b));
  });
});
