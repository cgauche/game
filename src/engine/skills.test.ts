import { describe, it, expect } from 'vitest';
import { testValue, partyBest, partyAssisted, skillCharKeyById, resolveSkillBest, bestForSkills, bestForCombined, bestAssistedOption } from './skills';
import { makeRNG } from './dice';
import { Combatant, SkillInstance } from './types';

const mk = (chars: Partial<Record<string, number>>, skills: { skillId: string; advances: number; spec?: string }[] = []): Combatant =>
  ({
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'dexterite' }) as SkillInstance),
  }) as unknown as Combatant;

describe('skills — testValue / partyBest / skillCharKeyById', () => {
  it('caractéristique fournie → valeur de la caractéristique', () => {
    expect(testValue(mk({ sociabilite: 55 }), undefined, 'sociabilite')).toBe(55);
  });
  it('compétence (inconnue de la base) → repli sur Dextérité + avances de la compétence portée', () => {
    const c = mk({ dexterite: 40 }, [{ skillId: 'bidouille', advances: 7 }]);
    expect(testValue(c, 'bidouille')).toBe(47);
  });
  it('compétence sans avances → caractéristique de repli seule', () => {
    expect(testValue(mk({ dexterite: 33 }), 'inexistante')).toBe(33);
  });
  it('partyBest renvoie le meilleur membre du groupe', () => {
    const a = mk({ sociabilite: 40 });
    const b = mk({ sociabilite: 60 });
    const c = mk({ sociabilite: 50 });
    expect(partyBest([a, b, c], undefined, 'sociabilite')).toEqual({ actor: b, value: 60 });
  });
  it('partyBest sur groupe vide → null', () => {
    expect(partyBest([], undefined, 'sociabilite')).toBeNull();
  });
  it('partyBest transmet la spécialisation à testValue (bonne instance de Métier)', () => {
    const h = mk({}, [
      { skillId: 'metier', advances: 10, spec: 'Forgeron' },
      { skillId: 'metier', advances: 40, spec: 'Serrurier' },
    ]);
    const forgeron = partyBest([h], 'metier', undefined, undefined, 'Forgeron')!;
    const serrurier = partyBest([h], 'metier', undefined, undefined, 'Serrurier')!;
    expect(serrurier.value - forgeron.value).toBe(30); // 40 − 10 d'avances, même caractéristique de base
  });
  it('partyAssisted — carac pure : tous soutiennent ; meneur + n×10 plafonné au Bonus de Carac', () => {
    const a = { ...mk({ sociabilite: 40 }), id: 'a' }, b = { ...mk({ sociabilite: 60 }), id: 'b' }, c = { ...mk({ sociabilite: 50 }), id: 'c' };
    const r = partyAssisted([a, b, c], undefined, 'sociabilite')!;
    expect(r.actor.id).toBe('b'); // le plus compétent lance
    expect(r.support).toEqual({ count: 2, bonus: 20 }); // 2 soutiens × 10 (plafond BSoc 6)
    expect(r.value).toBe(80); // 60 + 20
  });
  // (escamotage : compétence avancée Dex SANS gate d'outil — le −10 « sans outils de crochetage »
  //  de Crochetage (SkillData.tool, LDB 09 l.168) est testé à part dans item-skill-bonus.test.)
  it('testValue transmet `sense` à traumaSkillPenalty — Surdité restreinte aux Tests auditifs (LDB 18)', () => {
    const deaf = (): Combatant => ({
      ...mk({ initiative: 40 }),
      traumas: [{ label: 'Surdité', traumaId: 'surdite', location: 'tete', ops: [{ op: 'skillMod', skill: 'perception', mod: -20, sense: 'ouie' }] }],
    } as Combatant);
    expect(testValue(deaf(), 'perception')).toBe(20); // sens inconnu : pénalité appliquée par défaut
    expect(testValue(deaf(), 'perception', undefined, undefined, 'ouie')).toBe(20); // Test auditif : pénalisé
    expect(testValue(deaf(), 'perception', undefined, undefined, 'vue')).toBe(40); // Test visuel : exempté
  });
  it('partyAssisted — compétence : seuls les membres QUI LA POSSÈDENT soutiennent', () => {
    const a = { ...mk({ dexterite: 50 }, [{ skillId: 'escamotage', advances: 20 }]), id: 'a' }; // 70, possède
    const b = { ...mk({ dexterite: 30 }), id: 'b' }; // ne possède pas → ne soutient pas
    const c = { ...mk({ dexterite: 40 }, [{ skillId: 'escamotage', advances: 5 }]), id: 'c' }; // 45, possède
    const r = partyAssisted([a, b, c], 'escamotage')!;
    expect(r.actor.id).toBe('a');
    expect(r.support.count).toBe(1); // seul c soutient
    expect(r.value).toBe(80); // 70 + 10
  });
  it('partyAssisted — plafonne au Bonus de Caractéristique du meneur', () => {
    const lead = { ...mk({ dexterite: 20 }, [{ skillId: 'escamotage', advances: 30 }]), id: 'L' }; // 50, BDex 2
    const helpers = [1, 2, 3, 4].map((n) => ({ ...mk({ dexterite: 10 }, [{ skillId: 'escamotage', advances: 0 }]), id: 'h' + n }));
    const r = partyAssisted([lead, ...helpers], 'escamotage')!;
    expect(r.support.count).toBe(2); // 4 aptes, plafond BDex 2
    expect(r.value).toBe(70); // 50 + 20
  });
  it('soutienBonus/partyAssisted — filtre `eligible` (adjacence, LDB 12 l.196) exclut un membre capable écarté', () => {
    const a = { ...mk({ dexterite: 50 }, [{ skillId: 'escamotage', advances: 20 }]), id: 'a' }; // 70, possède
    const b = { ...mk({ dexterite: 40 }, [{ skillId: 'escamotage', advances: 10 }]), id: 'b' }; // possède, mais écarté (non adjacent)
    const c = { ...mk({ dexterite: 40 }, [{ skillId: 'escamotage', advances: 5 }]), id: 'c' }; // possède, éligible
    const eligible = (x: Combatant) => x.id !== 'b';
    const r = partyAssisted([a, b, c], 'escamotage', undefined, undefined, undefined, eligible)!;
    expect(r.actor.id).toBe('a');
    expect(r.support.count).toBe(1); // seul c compte (b écarté par `eligible`)
    expect(r.value).toBe(80); // 70 + 10
  });
  it('soutienBonus — `eligible` absent (défaut) : comportement INCHANGÉ, tous les capables comptent', () => {
    const a = { ...mk({ dexterite: 50 }, [{ skillId: 'escamotage', advances: 20 }]), id: 'a' };
    const b = { ...mk({ dexterite: 40 }, [{ skillId: 'escamotage', advances: 10 }]), id: 'b' };
    const r = partyAssisted([a, b], 'escamotage')!;
    expect(r.support.count).toBe(1);
  });
  it('skillCharKeyById : compétence inconnue → undefined', () => {
    expect(skillCharKeyById('competence-totalement-imaginaire')).toBeUndefined();
  });
});

describe('resolveSkillBest — Test du meilleur parmi N compétences (primitive NEUTRE poste/voyage/naval)', () => {
  it('prend la compétence où l’acteur est le meilleur (spec-aware) + cible = sa valeur', () => {
    const hero = mk({ dexterite: 30 }, [
      { skillId: 'metier', spec: 'Cartographe', advances: 60 },
      { skillId: 'art', spec: 'Dessin', advances: 10 },
    ]);
    const r = resolveSkillBest(hero, [
      { skillId: 'metier', spec: 'Cartographe' },
      { skillId: 'art', spec: 'Dessin' },
    ], 'intermediaire', makeRNG(5));
    expect(r.used).toEqual({ skillId: 'metier', spec: 'Cartographe' }); // 30+60 > 30+10
    expect(r.value).toBe(testValue(hero, 'metier', undefined, 'Cartographe'));
    expect(r.target).toBe(r.value); // Difficulté Intermédiaire (+0), pas de mod
    expect(r.success).toBe(r.roll <= r.target);
  });

  it('le modificateur décale la cible ; option unique = cette compétence', () => {
    const hero = mk({ initiative: 40 }, [{ skillId: 'perception', advances: 20 }]);
    const a = resolveSkillBest(hero, [{ skillId: 'perception' }], 'intermediaire', makeRNG(7), 0);
    const b = resolveSkillBest(hero, [{ skillId: 'perception' }], 'intermediaire', makeRNG(7), -30);
    expect(a.target - b.target).toBe(30);
    expect(a.used).toEqual({ skillId: 'perception' });
  });
});

describe('bestForSkills — meilleur PJ pour des compétences AU CHOIX', () => {
  it('prend l’ACTEUR et l’option qui maximisent la valeur (spec-aware)', () => {
    const a = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 50 }]), id: 'a' }; // discr 80, perc 30
    const b = { ...mk({ initiative: 45 }, [{ skillId: 'perception', advances: 20 }]), id: 'b' }; // perc 65, discr 30
    const r = bestForSkills([a, b], [{ skillId: 'discretion' }, { skillId: 'perception' }], undefined)!;
    expect(r.actor.id).toBe('a'); // 80 (Discrétion) est la plus haute de toutes les combinaisons acteur×option
    expect(r.skillId).toBe('discretion');
    expect(r.value).toBe(80);
  });
  it('skills vide/absent → chemin de PURE Caractéristique (skillId indéfini)', () => {
    const a = { ...mk({ 'force-mentale': 40 }), id: 'a' }, b = { ...mk({ 'force-mentale': 55 }), id: 'b' };
    const r = bestForSkills([a, b], undefined, 'force-mentale')!;
    expect(r.actor.id).toBe('b');
    expect(r.value).toBe(55);
    expect(r.skillId).toBeUndefined();
    expect(r.spec).toBeUndefined();
  });
  it('groupe vide → null', () => {
    expect(bestForSkills([], [{ skillId: 'perception' }], undefined)).toBeNull();
  });
});

describe('bestAssistedOption — Scène à compétences AU CHOIX résolue en Soutien (ADE II ch.8)', () => {
  it('un seul PJ (pas de soutien) → valeur == bestForSkills (aucun +10)', () => {
    const a = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 50 }]), id: 'a' }; // discr 80
    const solo = bestAssistedOption([a], [{ skillId: 'discretion' }, { skillId: 'perception' }], undefined)!;
    const ref = bestForSkills([a], [{ skillId: 'discretion' }, { skillId: 'perception' }], undefined)!;
    expect(solo.value).toBe(ref.value);        // 80, aucun soutien
    expect(solo.skillId).toBe('discretion');
    expect(solo.support).toEqual({ count: 0, bonus: 0 });
  });
  it('N PJ possédant la compétence → valeur = meneur + 10×assistants (plafonné BCarac)', () => {
    // Meneur Discrétion 60 (BDex 3) ; deux autres la possèdent → +20 (2 soutiens, sous le plafond 3).
    const lead = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 30 }]), id: 'L' }; // 60, BDex 3
    const h1 = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 5 }]), id: 'h1' };
    const h2 = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 0 }]), id: 'h2' };
    const r = bestAssistedOption([lead, h1, h2], [{ skillId: 'discretion' }], undefined)!;
    expect(r.actor.id).toBe('L');
    expect(r.support).toEqual({ count: 2, bonus: 20 });
    expect(r.value).toBe(80); // 60 + 20
  });
  it('équipage vide → null', () => {
    expect(bestAssistedOption([], [{ skillId: 'perception' }], undefined)).toBeNull();
  });
});

describe('bestForCombined — Test COMBINÉ : facteur limitant le plus élevé', () => {
  it('choisit l’acteur maximisant min(v1,v2) (le maillon faible)', () => {
    // a : 70/40 → min 40 ; b : 50/50 → min 50 (meilleur maillon faible) ; c : 90/20 → min 20.
    const a = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 40 }, { skillId: 'perception', advances: 10 }]), id: 'a' };
    const b = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 20 }, { skillId: 'perception', advances: 20 }]), id: 'b' };
    const c = { ...mk({ dexterite: 30 }, [{ skillId: 'discretion', advances: 60 }, { skillId: 'perception', advances: 0 }]), id: 'c' };
    const r = bestForCombined([a, b, c], { skillId: 'discretion' }, { skillId: 'perception' }, undefined)!;
    expect(r.actor.id).toBe('b');
    expect(r.value1).toBe(50);
    expect(r.value2).toBe(50);
  });
  it('groupe vide → null', () => {
    expect(bestForCombined([], { skillId: 'discretion' }, { skillId: 'perception' }, undefined)).toBeNull();
  });
});
