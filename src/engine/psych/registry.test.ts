import { describe, it, expect } from 'vitest';
import { parsePsychTraits } from './registry';
import { creatures, findTraitById, findGroupById } from '../../data';

describe('Psychologie data-driven (capabilities de traits.json) — LDB 21/85', () => {
  it('parse Peur/Terreur/Immunité + ciblés (Animosité/Phobie indice 1/Effrayé indice 0), Cible = id de Groupe', () => {
    const p = parsePsychTraits([{ id: 'peur', value: 2 }, { id: 'immunite-psychologique' }, { id: 'animosite', arg: 'elfe' }, { id: 'phobie', arg: 'Serpents' }, { id: 'effraye', arg: 'Feu' }]);
    expect(p.causesPeur).toBe(2);
    expect(p.psychImmune).toBe(true);
    expect(p.psychTraits).toEqual(expect.arrayContaining([
      { type: 'animosite', cible: 'elfe' },
      // « Serpents »/« Feu » ne sont PAS des ids de Groupe (`groups.json`) → Cible INERTE (pas de chaîne FR résiduelle).
      { type: 'phobie', cible: undefined, indice: 1 },
      { type: 'phobie', cible: undefined, indice: 0 },
    ]));
  });

  it('Cible « un au choix » ou vide → inerte (cible indéfinie) ; « deux au choix » → 2 wildcards inertes', () => {
    expect(parsePsychTraits([{ id: 'haine', arg: 'un au choix' }]).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
    expect(parsePsychTraits([{ id: 'haine' }]).psychTraits).toEqual([{ type: 'haine', cible: undefined }]);
    expect(parsePsychTraits([{ id: 'animosite', arg: 'deux au choix' }]).psychTraits).toEqual([
      { type: 'animosite', cible: undefined },
      { type: 'animosite', cible: undefined },
    ]);
  });

  it('VIRGULE = plusieurs Traits mono-cible : un segment reconnu (id de Groupe) + un segment inerte', () => {
    expect(parsePsychTraits([{ id: 'animosite', arg: 'Les riches, homme-bete' }]).psychTraits).toEqual([
      { type: 'animosite', cible: undefined },
      { type: 'animosite', cible: 'homme-bete' },
    ]);
  });

  it('un trait sans capacité psy est ignoré', () => {
    expect(parsePsychTraits([{ id: 'arme', value: 7 }])).toEqual({});
  });

  it('DONNÉE creatures.json : toute Cible d’un Trait psy CIBLÉ (par psychType, pas par id) est un id de Groupe connu ou un wildcard — jamais une chaîne FR (garde anti-régression du codemod, cf. effraye→phobie)', () => {
    const TARGETED = new Set(['animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']);
    const bad: string[] = [];
    const check = (arr: { id: string; arg?: string }[] | undefined, cid: string) => {
      for (const t of arr ?? []) {
        const pt = findTraitById(t.id)?.capabilities?.psychType;
        if (pt && TARGETED.has(pt) && t.arg && !/au choix/i.test(t.arg)) {
          for (const seg of t.arg.split(',')) if (!findGroupById(seg.trim())) bad.push(`${cid} :: ${t.id} → "${seg.trim()}"`);
        }
      }
    };
    for (const c of creatures as any[]) {
      check(c.traits, c.id);
      for (const v of c.variants ?? []) check(v.traits, c.id);
      for (const m of c.members ?? []) check(m.traits, c.id);
    }
    expect(bad).toEqual([]);
  });
});
