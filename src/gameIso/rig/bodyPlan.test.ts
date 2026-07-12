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
    expect(planOfSpecies('jabberslythe')).toBe('jabberslythe');
  });
  it('princes démons humanoïdes (illustration LDB p.338) → biped + parts monstrueuses', () => {
    // Fr'hough Mournbreath (LDB 336) rebâti en biped+monster (comme Slenderthigh Whiptongue) —
    // plus de gabarit jabberslythe monolithique pour cette figure humanoïde bipède.
    for (const id of ['slenderthigh-whiptongue', 'fr-hough-mournbreath']) {
      expect(planOfSpecies(id), id).toBe('biped');
    }
  });
  it('engins de siège (baliste / canon) → engin (corps statique, pas un bipède)', () => {
    for (const id of ['baliste', 'canon-petit']) expect(planOfSpecies(id), id).toBe('engin');
  });
});

describe('planById(engin) — engin de siège statique, ANCRÉ au sol', () => {
  it('enregistré (auto-découverte plans/defs/) et 3 vues distinctes par type', () => {
    const p = planById('engin');
    expect(p?.id).toBe('engin');
    const baliste = (v: 'front' | 'profile' | 'back') => JSON.stringify(p.resolve('baliste', v, {}));
    const canon = (v: 'front' | 'profile' | 'back') => JSON.stringify(p.resolve('canon-petit', v, {}));
    // Les 3 vues d'un engin diffèrent entre elles…
    expect(new Set([baliste('front'), baliste('profile'), baliste('back')]).size).toBe(3);
    // …et la baliste ≠ le canon (silhouettes propres par espèce).
    expect(baliste('profile')).not.toEqual(canon('profile'));
  });
  it('base ANCRÉE à la ligne de sol (y=150) — pas de lévitation', () => {
    for (const v of ['front', 'profile', 'back'] as const) {
      const bones = planById('engin').resolve('canon-petit', v, {});
      expect(bones.length).toBe(1);
      expect(bones[0].matrix[5]).toBe(150); // contact au sol exactement sur l'ancrage BodyToken
    }
  });
  it('cadre son PROPRE portrait (le bloc est au BAS de la boîte → pas de disque vide)', () => {
    // Sans `portraitBox`, le défaut haut-avant (`CREATURE_BOX`, y 14→94) raterait l'engin (y 84→150).
    const box = planById('engin').portraitBox!.split(' ').map(Number);
    expect(box).toHaveLength(4);
    expect(box[1] + box[3]).toBeGreaterThan(120); // le cadre descend dans le BAS de la boîte (≈ sol)
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
