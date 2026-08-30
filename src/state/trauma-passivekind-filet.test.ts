/**
 * FILET `PassiveKind` au site (#1318 V8c₅) — la tranche finale a renommé DEUX valeurs du type
 * (`mobilité`→`mobilite`, `intrinsèque`→`intrinseque`) pour aligner la famille sur l'ASCII (`etat`,
 * `douleur`…). Ce `kind` est PERSISTÉ (`Trauma.passiveKind`, `engine/types.ts`), et le ROSTER
 * (`roster.ts`, liste localStorage NON versionnée + export `EXPORT_VERSION`) n'a pas d'axe de version
 * qui l'écarterait : une entrée écrite avant le renommage porte encore l'ancienne valeur.
 *
 * Sans le filet (`normalizePassiveKind`, `engine/ops.ts`), la table `PASSIVE_CANCELLERS` (TOTALE sur
 * l'union courante) rend `undefined` → le collecteur passif LÈVE sur son `for…of`, au premier calcul
 * de Caractéristique effective d'un héros portant une cicatrice de Critique guéri ; et un `charMod`
 * de kind `intrinsèque` basculerait du régime ADDITIF au pool non-cumul, en silence.
 */
import { describe, it, expect } from 'vitest';
import { normalizePassiveKind } from '../engine/ops';
import { passiveMods, passiveSkillSum } from '../engine/trauma';
import { effectiveChar } from '../engine/characteristics';
import type { Combatant, SkillInstance, Trauma } from '../engine/types';

/** Cobaye nu porteur de séquelles données telles quelles (formes ANCIENNES incluses) — même fixture
 *  minimale que `engine/test-value-parts.test.ts` (aucun tirage, aucune dépendance de création). */
function heroWithTraumas(traumas: unknown[]): Combatant {
  return {
    id: 'h', label: 'Sigrid', kind: 'hero', speciesId: 'humains-reiklander',
    characteristics: { sociabilite: 40, agilite: 40, dexterite: 40, intelligence: 40 } as Combatant['characteristics'],
    skills: [{ skillId: 'charme', advances: 0 }] as SkillInstance[],
    talents: [], items: [], conditions: [], advantage: 0,
    traumas: traumas as Trauma[],
  } as unknown as Combatant;
}

describe('#1318 V8c₅ — un `passiveKind` ACCENTUÉ arrivé par le roster ne casse ni ne dérive', () => {
  it('le collecteur passif ne LÈVE pas sur un kind ancien', () => {
    const c = heroWithTraumas([{ label: 'Jambe raide', ops: [{ op: 'moveScale', factor: 0.5 }], passiveKind: 'mobilité' }]);
    expect(() => passiveMods(c)).not.toThrow();
    expect(() => effectiveChar(c, 'agilite')).not.toThrow();
    // …et le kind PROPAGÉ est déjà la forme courante (aucun id ancien ne ressort du collecteur).
    expect(passiveMods(c).map((m) => m.kind)).toContain('mobilite');
  });

  it('un `charMod` de kind `intrinsèque` (ancien id) reste ADDITIF — pas de dérive silencieuse', () => {
    const ancien = heroWithTraumas([{ label: 'Trait de corps', ops: [{ op: 'skillMod', skill: { id: 'charme' }, mod: 10 }], passiveKind: 'intrinsèque' }]);
    const courant = heroWithTraumas([{ label: 'Trait de corps', ops: [{ op: 'skillMod', skill: { id: 'charme' }, mod: 10 }], passiveKind: 'intrinseque' }]);
    // `passiveSkillSum` ne somme QUE les kinds additifs : l'ancien id doit compter comme le nouveau.
    expect(passiveSkillSum(ancien, 'charme')).toBe(passiveSkillSum(courant, 'charme'));
    expect(passiveSkillSum(ancien, 'charme')).toBe(10);
  });

  it('`normalizePassiveKind` : ancien → courant, courant → lui-même, absent → undefined', () => {
    expect(normalizePassiveKind('mobilité')).toBe('mobilite');
    expect(normalizePassiveKind('intrinsèque')).toBe('intrinseque');
    expect(normalizePassiveKind('douleur')).toBe('douleur');
    expect(normalizePassiveKind(undefined)).toBeUndefined();
  });
});
