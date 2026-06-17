import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import {
  splitTopLevelOu,
  parseEntry,
  parseOption,
  isUnresolvedChoice,
  skillSlots,
  talentSlots,
  availableChars,
  inCareerStatus,
  designateSlot,
  designationsFor,
  freeSlotFor,
  talentMax,
  talentMaxReached,
  wildcardSpecs,
  parseAdvancement,
} from './careerSlots';
import { CareerLevelData } from '../data';

/** Fixtures : libellés d'avancement → `AdvancementRef[]` (la donnée est structurée). */
const A = (xs: string[]) => xs.map(parseAdvancement);

const hero = (over: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'h',
    name: 'H',
    kind: 'hero',
    career: 'C1',
    careerLevel: 1,
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 },
    advantage: 0,
    conditions: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [],
    talents: [],
    movement: 4,
    ...over,
  }) as unknown as Combatant;

describe('parsing des entrées de carrière (LDB 09 l.38 / pièges de données)', () => {
  it('splitTopLevelOu : coupe hors parenthèses uniquement', () => {
    expect(splitTopLevelOu('Perspicace ou Affable')).toEqual(['Perspicace', 'Affable']);
    expect(splitTopLevelOu('Savoir-vivre (Criminel ou Guilde)')).toEqual(['Savoir-vivre (Criminel ou Guilde)']);
    expect(splitTopLevelOu('Lire/Écrire ou Savoir-vivre (Érudits ou Nobles)')).toEqual(['Lire/Écrire', 'Savoir-vivre (Érudits ou Nobles)']);
    expect(splitTopLevelOu('Criminel ou Savoir-vivre (Criminel ou Guilde)')).toEqual(['Criminel', 'Savoir-vivre (Criminel ou Guilde)']);
  });
  it('parseOption : explicite / joker / joker restreint', () => {
    expect(parseOption('Sens aiguisé (Vue)')).toEqual({ name: 'Sens aiguisé', spec: 'Vue', wildcard: false });
    expect(parseOption('Savoir (Au choix)')).toEqual({ name: 'Savoir', wildcard: true });
    expect(parseOption('Métier (un au choix)')).toEqual({ name: 'Métier', wildcard: true });
    expect(parseOption('Corps à corps (Fléau ou À deux mains)')).toEqual({
      name: 'Corps à corps',
      wildcard: true,
      specOptions: ['Fléau', 'À deux mains'],
    });
  });
  it('parseEntry : « A ou B » de premier niveau (Guide fluvial ou Bonnes jambes)', () => {
    const options = parseEntry('Guide fluvial ou Bonnes jambes');
    expect(options).toHaveLength(2);
    expect(options[0].name).toBe('Guide fluvial');
    expect(options[1].name).toBe('Bonnes jambes');
  });
  it('isUnresolvedChoice', () => {
    expect(isUnresolvedChoice('Savoir (Au choix)')).toBe(true);
    expect(isUnresolvedChoice('Sens aiguisé (Goût ou Toucher)')).toBe(true);
    expect(isUnresolvedChoice('Sens aiguisé (Goût)')).toBe(false);
    expect(isUnresolvedChoice('Baratiner')).toBe(false);
  });
});

// Carrière factice C1 : « Sens aiguisé (Au choix) » aux niveaux 1 ET 2 (comme Érudit avec
// Savoir) — le scénario complet de désignation se joue dessus.
const C1: CareerLevelData[] = [
  {
    label: 'N1', career: 'C1', level: 1,
    skills: A(['Charme', 'Savoir (Au choix)']),
    talents: A(['Sens aiguisé (Au choix)', 'Baratiner']),
    trappings: [], characteristics: ['F', 'E', 'Soc'], status: 'Bronze 1',
  },
  {
    label: 'N2', career: 'C1', level: 2,
    skills: A(['Ragot', 'Savoir (Au choix)']),
    talents: A(['Sens aiguisé (Au choix)', 'Sociable']),
    trappings: [], characteristics: ['Ag'], status: 'Bronze 2',
  },
];

describe('disponibilité par niveaux (LDB 07 l.67/78/100)', () => {
  it('skillSlots : cumul des niveaux ≤ courant ; talentSlots : niveau courant seul', () => {
    expect(skillSlots(C1, 1).map((s) => s.entry)).toEqual(['Charme', 'Savoir (Au choix)']);
    expect(skillSlots(C1, 2).map((s) => s.entry)).toEqual(['Charme', 'Savoir (Au choix)', 'Ragot', 'Savoir (Au choix)']);
    expect(talentSlots(C1, 2).map((s) => s.entry)).toEqual(['Sens aiguisé (Au choix)', 'Sociable']);
    expect(availableChars(C1, 2)).toEqual(['F', 'E', 'Soc', 'Ag']);
  });
});

describe('scénario complet : Sens aiguisé espèce + emplacements « (Au choix) » par carrière', () => {
  it('1) désignation GRATUITE de la spec déjà possédée → in-carrière, montable (200 PX au ×2)', () => {
    const h = hero({ talents: [{ talentId: 'sens-aiguise', spec: 'Goût', times: 1 }] });
    const slots1 = talentSlots(C1, 1);
    // Avant désignation : le slot libre couvre Goût.
    expect(inCareerStatus(slots1, {}, 'Sens aiguisé', 'Goût')).toBe('free');
    const slot = freeSlotFor(slots1, {}, 'Sens aiguisé', 'Goût')!;
    expect(designateSlot(h, 'C1', slot, 'Sens aiguisé (Goût)', slots1).ok).toBe(true);
    expect(inCareerStatus(slots1, designationsFor(h, 'C1'), 'Sens aiguisé', 'Goût')).toBe('designated');
    // Une AUTRE spec n'est plus couverte par ce slot (désigné).
    expect(inCareerStatus(slots1, designationsFor(h, 'C1'), 'Sens aiguisé', 'Ouïe')).toBe(null);
  });

  it('2) au niveau 2, le NOUVEAU slot ne peut pas re-désigner la spec prise au niveau 1', () => {
    const h = hero({ careerLevel: 2, talents: [{ talentId: 'sens-aiguise', spec: 'Goût', times: 1 }, { talentId: 'sens-aiguise', spec: 'Ouïe', times: 1 }] });
    const slots1 = talentSlots(C1, 1);
    const slots2 = talentSlots(C1, 2);
    const all = [...slots1, ...slots2];
    // Niveau 1 : Ouïe avait été désignée (achat à 100 PX à l'époque).
    designateSlot(h, 'C1', slots1[0], 'Sens aiguisé (Ouïe)', all);
    const des = designationsFor(h, 'C1');
    // Le slot du niveau 2 ne peut PAS reprendre Ouïe…
    expect(designateSlot(h, 'C1', slots2[0], 'Sens aiguisé (Ouïe)', all).ok).toBe(false);
    expect(inCareerStatus(slots2, des, 'Sens aiguisé', 'Ouïe', all)).toBe(null);
    // …mais peut désigner Goût (gratuit, déjà possédé) ou Toucher (achat 100 PX).
    expect(inCareerStatus(slots2, des, 'Sens aiguisé', 'Goût', all)).toBe('free');
    expect(inCareerStatus(slots2, des, 'Sens aiguisé', 'Toucher', all)).toBe('free');
    expect(designateSlot(h, 'C1', slots2[0], 'Sens aiguisé (Goût)', all).ok).toBe(true);
  });

  it('3) changement de carrière : les désignations sont PAR carrière — tout sens redevient désignable', () => {
    const h = hero({ talents: [{ talentId: 'sens-aiguise', spec: 'Goût', times: 1 }, { talentId: 'sens-aiguise', spec: 'Ouïe', times: 1 }] });
    const slots1 = talentSlots(C1, 1);
    designateSlot(h, 'C1', slots1[0], 'Sens aiguisé (Ouïe)', slots1);
    // Carrière C2 (autre carrière, même type de slot) : aucune désignation → tout est libre.
    const C2: CareerLevelData[] = [{ ...C1[0], career: 'C2' }];
    const slots = talentSlots(C2, 1);
    const des = designationsFor(h, 'C2');
    expect(des).toEqual({});
    for (const spec of ['Goût', 'Ouïe', 'Toucher']) {
      expect(inCareerStatus(slots, des, 'Sens aiguisé', spec)).toBe('free');
    }
  });

  it('4) un slot ne peut pas désigner le libellé d\'une entrée EXPLICITE de la même carrière', () => {
    const LV: CareerLevelData[] = [{
      ...C1[0],
      talents: A(['Sens aiguisé (Vue)', 'Sens aiguisé (Au choix)']),
    }];
    const h = hero();
    const slots = talentSlots(LV, 1);
    expect(designateSlot(h, 'C1', slots[1], 'Sens aiguisé (Vue)', slots).ok).toBe(false);
    expect(designateSlot(h, 'C1', slots[1], 'Sens aiguisé (Odorat)', slots).ok).toBe(true);
  });

  it('5) joker RESTREINT « (Goût ou Toucher) » : limité à la liste', () => {
    const LV: CareerLevelData[] = [{ ...C1[0], talents: A(['Sens aiguisé (Goût ou Toucher)']) }];
    const slots = talentSlots(LV, 1);
    expect(inCareerStatus(slots, {}, 'Sens aiguisé', 'Goût')).toBe('free');
    expect(inCareerStatus(slots, {}, 'Sens aiguisé', 'Vue')).toBe(null);
  });
});

describe('Maxi des Talents (LDB 10 « Schéma des Talents »)', () => {
  it('Maxi 1 (Lire/Écrire) : atteint dès la 1re acquisition', () => {
    const h = hero({ talents: [{ talentId: 'lire-ecrire', times: 1 }] });
    expect(talentMax(h, 'Lire/Écrire')).toBe(1);
    expect(talentMaxReached(h, 'Lire/Écrire')).toBe(true);
    expect(talentMaxReached(h, 'Baratiner')).toBe(false);
  });
  it('Maxi « Bonus de Caractéristique » : par spécialisation, recalculé sur la valeur courante', () => {
    // Sens aiguisé : Maxi = Bonus d'Initiative (I 30 → 3).
    const h = hero({ talents: [{ talentId: 'sens-aiguise', spec: 'Goût', times: 3 }, { talentId: 'sens-aiguise', spec: 'Ouïe', times: 1 }] });
    expect(talentMax(h, 'Sens aiguisé (Goût)')).toBe(3);
    expect(talentMaxReached(h, 'Sens aiguisé (Goût)')).toBe(true);
    expect(talentMaxReached(h, 'Sens aiguisé (Ouïe)')).toBe(false); // spec distincte
  });
});

describe('wildcardSpecs — specs valides à joker (SOURCE UNIQUE créateur + avancement)', () => {
  it('Béni → cultes du registre (dont les dieux gnomes NADJ)', () => {
    const s = wildcardSpecs('Béni');
    expect(s).toContain('Sigmar');
    expect(s).toContain('Evawn');
  });
  it('Magie des Arcanes → domaines des sorts (subType), data-driven', () => {
    expect(wildcardSpecs('Magie des Arcanes')).toEqual(expect.arrayContaining(['Feu', 'Ombres', 'Métal']));
  });
  it('Magie du Chaos → Nurgle / Slaanesh / Tzeentch', () => {
    expect(wildcardSpecs('Magie du Chaos').sort()).toEqual(['Nurgle', 'Slaanesh', 'Tzeentch']);
  });
  it('Invocation → cultes (subType des Invocations)', () => {
    expect(wildcardSpecs('Invocation')).toContain('Sigmar');
  });
  it('libellé sans domaine/culte/specs → []', () => {
    expect(wildcardSpecs('Inexistant-xyz')).toEqual([]);
  });
});
