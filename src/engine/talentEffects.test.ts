import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import {
  talentCharBonus,
  applyTalentAcquisition,
  extraWounds,
  heroMaxWounds,
  fortuneMax,
  resolveMax,
  careerSkillAdditions,
  baseWithTalents,
} from './talentEffects';
import { effectiveMovement } from './encumbrance';

const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 13, max: 13 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    fate: 2,
    resilience: 1,
    charAdvances: {},
    ...over,
  }) as unknown as Combatant;

describe('« +5 à votre Caractéristique de départ » (LDB 10 — ne compte pas comme Augmentation)', () => {
  it('mapping addCharacteristic → clé courte pour les 10 talents', () => {
    expect(talentCharBonus('Guerrier né')).toBe('CC');
    expect(talentCharBonus('Tireur de précision')).toBe('CT');
    expect(talentCharBonus('Très fort')).toBe('F');
    expect(talentCharBonus('Très résistant')).toBe('E');
    expect(talentCharBonus('Vivacité')).toBe('I');
    expect(talentCharBonus('Réflexes foudroyants')).toBe('Ag');
    expect(talentCharBonus('Doigts de fée')).toBe('Dex');
    expect(talentCharBonus('Perspicace')).toBe('Int');
    expect(talentCharBonus('Imperturbable')).toBe('FM');
    expect(talentCharBonus('Affable')).toBe('Soc');
    expect(talentCharBonus('Baratiner')).toBe(null);
    // addCharacteristic non-Caractéristique (Blessure, Chance…) → pas de +5.
    expect(talentCharBonus('Dur à cuire')).toBe(null);
    expect(talentCharBonus('Chanceux')).toBe(null);
  });
  it('applyTalentAcquisition : +5 passif, valeur effective = 35, AUCUNE Augmentation comptée', () => {
    const h = hero({ talents: [{ talentId: 'tres-fort', times: 1 }] });
    applyTalentAcquisition(h, 'tres-fort'); // id stable du Talent — le talent est déjà dans la liste
    // La valeur brute reste 30 (non cuite) ; le passif charMod la porte — baseWithTalents = 35.
    expect(h.characteristics.F).toBe(30); // base INCHANGÉE (passif, plus cuit)
    expect(baseWithTalents(h, 'F')).toBe(35); // base + passif talent = 35
    expect(h.charAdvances?.F ?? 0).toBe(0);
  });
  it('Véloce : +1 Mouvement via passif moveMod (LDB 10)', () => {
    const h = hero({ talents: [{ talentId: 'veloce', times: 1 }] });
    applyTalentAcquisition(h, 'veloce'); // id stable du Talent
    // Le Mouvement brut reste 4 ; le passif moveMod le porte — effectiveMovement = 5.
    expect(h.movement).toBe(4); // base INCHANGÉE (passif, plus muté)
    expect(effectiveMovement(h)).toBe(5); // base + passif moveMod = 5
  });
});

describe('attributs dérivés des talents', () => {
  it('Dur à cuire : +BE Points de Blessure par acquisition (LDB 10)', () => {
    const h = hero({ talents: [{ talentId: 'dur-a-cuire', times: 1 }] });
    expect(extraWounds(h)).toBe(3); // BE 3
    expect(heroMaxWounds(h)).toBe(3 + 2 * 3 + 3 + 3); // BF+2BE+BFM + Dur à cuire
    h.talents[0].times = 2;
    expect(extraWounds(h)).toBe(6);
  });
  it('Chanceux : Chance max = Destin + niveaux (LDB 10)', () => {
    expect(fortuneMax(hero())).toBe(2);
    expect(fortuneMax(hero({ talents: [{ talentId: 'chanceux', times: 2 }] }))).toBe(4);
  });
  it('Obstiné : Détermination max = Résilience + niveaux (LDB 10)', () => {
    expect(resolveMax(hero())).toBe(1);
    expect(resolveMax(hero({ talents: [{ talentId: 'obstine', times: 1 }] }))).toBe(2);
  });
});

describe('« Ajoutez la Compétence X à n\'importe quelle Carrière que vous entamez » (LDB 10)', () => {
  it('Maître artisan (Forgeron) → Métier (Forgeron) ; Sorcier ! → Langue (Magick)', () => {
    const h = hero({
      talents: [
        { talentId: 'maitre-artisan', spec: 'Forgeron', times: 1 },
        { talentId: 'sorcier', times: 1 },
        { talentId: 'oreille-absolue', times: 1 },
        { talentId: 'voyageur-aguerri', times: 1 },
        { talentId: 'baratiner', times: 1 }, // sans addSkill → rien
      ],
    });
    const adds = careerSkillAdditions(h);
    expect(adds).toContain('Métier (Forgeron)');
    expect(adds).toContain('Langue (Magick)');
    expect(adds).toContain('Divertissement (Chant)');
    expect(adds).toContain('Savoir (Région)');
    expect(adds).toHaveLength(4);
  });
});
