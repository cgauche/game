import { describe, it, expect } from 'vitest';
import { skills, traits, talents, trappings } from './index';
import { isUnarmedTrapping, isImprovisedTrapping } from '../engine/items';
import { CHAR_KEYS } from '../engine/types';
import { ruleDef } from '../engine/policy';

/**
 * PARITÉ des CHAMPS DÉCLARÉS qui ont remplacé un branchement par id (#1318 E4/C4-δ2).
 *
 * Six comportements particuliers vivaient dans le moteur sous forme de test d'identité
 * (`t.id === 'arme'`, `t.id !== 'bestial'`, `builtinId === 'mains-nues'`…). Ils vivent désormais sur
 * l'ENTRÉE du registre — soit par une déclaration NEUVE (`nonTransferable`, `unarmed`, `improvised`,
 * `altChar`, `grantsArcaneDomain`), soit par une déclaration DÉJÀ PORTÉE quand elle dit exactement la
 * précondition du site (`specsSource`). Ce fichier verrouille la MESURE : les entrées qui portent la
 * marque aujourd'hui sont EXACTEMENT celles que le moteur nommait — ni une de plus (un comportement
 * accordé par mégarde à une autre entrée), ni une de moins (le comportement perdu en silence).
 *
 * C'est le pendant du plafond `src/ui/registry-id-branch-guard.test.ts` : là-bas on compte les
 * branchements restants, ici on prouve que leur remplacement DÉCLARÉ couvre la même population.
 */
describe('#1318 E4/C4-δ2 — parité « le moteur ne nomme plus d’id, l’entrée porte la marque »', () => {
  it('TRAITS — armement : `specsSource` des catalogues d’armes = exactement les deux Traits d’armement', () => {
    // `weaponFromTrait` route sur CE champ et le passe tel quel à `catalogItem` : la source déclarée EST
    // le catalogue de résolution, donc aucun second champ ne peut se désynchroniser d'elle.
    const armes = traits.filter((t) => t.specsSource === 'weaponsMelee' || t.specsSource === 'weaponsRanged');
    expect(armes.map((t) => `${t.id}:${t.specsSource}`).sort()).toEqual(['a-distance:weaponsRanged', 'arme:weaponsMelee']);
  });

  it('TRAITS — `nonTransferable` : exactement Bestial (engine/polymorph, LDB 48 l.23)', () => {
    expect(traits.filter((t) => t.nonTransferable).map((t) => t.id)).toEqual(['bestial']);
  });

  it('POSSESSIONS — `unarmed` : exactement les Mains nues, et le prédicat du moteur les lit', () => {
    expect(trappings.filter((t) => t.unarmed).map((t) => t.id)).toEqual(['mains-nues']);
    expect(isUnarmedTrapping('mains-nues')).toBe(true);
    expect(isUnarmedTrapping('epee')).toBe(false);
    expect(isUnarmedTrapping(undefined)).toBe(false);
  });

  it('POSSESSIONS — `improvised` : exactement l’Arme improvisée, et le prédicat du moteur la lit', () => {
    expect(trappings.filter((t) => t.improvised).map((t) => t.id)).toEqual(['arme-improvisee']);
    expect(isImprovisedTrapping('arme-improvisee')).toBe(true);
    expect(isImprovisedTrapping('mains-nues')).toBe(false);
    expect(isImprovisedTrapping(undefined)).toBe(false);
  });

  it('COMPÉTENCES — `specsSource: weaponGroupsMelee` : exactement Corps à corps (conjuredWeapons, combat.parryPenalty)', () => {
    // La lecture qui a remplacé `s.skillId === 'corps-a-corps'` : une compétence dont les SPÉ sont les
    // Groupes d'armes de mêlée — la garantie même dont les deux sites ont besoin (`spec` = id de Groupe).
    expect(skills.filter((s) => s.specsSource === 'weaponGroupsMelee').map((s) => s.id)).toEqual(['corps-a-corps']);
  });

  it('TALENTS — `grantsArcaneDomain` : exactement Magie des Arcanes (engine/careerSlots)', () => {
    // Champ DÉDIÉ, pas `specsSource` : le plafond `LDB 46 l.177` porte sur le Talent qui fait PRATIQUER
    // un Domaine — nommer un Domaine dans son pool de spec ne suffirait pas à peser au plafond.
    expect(talents.filter((t) => t.grantsArcaneDomain).map((t) => t.id)).toEqual(['magie-des-arcanes']);
  });

  it('COMPÉTENCES — `altChar` : exactement Métier et Intimidation, chaque carac citée étant une CharKey réelle', () => {
    const porteuses = skills.filter((s) => s.altChar).map((s) => s.id).sort();
    expect(porteuses).toEqual(['intimidation', 'metier']);
    // Les caracs citées sont des ids de Caractéristique (`CharKey`), jamais des libellés.
    const connues = new Set<string>(CHAR_KEYS);
    const citees = skills.flatMap((s) => Object.values(s.altChar?.chars ?? {})).flat();
    expect(citees.filter((k) => !connues.has(k))).toEqual([]);
    expect(citees.length).toBeGreaterThan(0);
  });

  it('COMPÉTENCES — `altChar.chars` : aucune clé INATTEIGNABLE (une coquille rendrait l’option morte en silence)', () => {
    // La classe de bug d'origine : le code comparait la valeur de règle à `'force-mentale'` quand le
    // panneau écrit `'FM'` — deux options mortes, trois tests verts. Le schéma (`z.record`) accepte
    // n'importe quelle clé : la liaison clé ↔ valeur ATTEIGNABLE de la règle se vérifie donc ici, en
    // dérivant les valeurs du registre des règles (jamais une liste recopiée).
    const atteignables = (ruleId: string): string[] => {
      const def = ruleDef(ruleId);
      if (!def) return [];
      if (def.kind === 'flag') return ['true', 'false'];
      if (def.kind === 'mode') return (def.options ?? []).map(String);
      return []; // `param` : aucun ensemble fermé de valeurs — une carac par valeur numérique n'aurait pas de sens
    };
    const fautives = skills.flatMap((s) =>
      Object.keys(s.altChar?.chars ?? {})
        .filter((k) => !atteignables(s.altChar!.gatedByRule).includes(k))
        .map((k) => `${s.id} → « ${k} » hors des valeurs de la règle ${s.altChar!.gatedByRule} [${atteignables(s.altChar!.gatedByRule).join(', ')}]`),
    );
    expect(fautives, 'clé de `altChar.chars` qu’aucune valeur de la règle ne produira jamais').toEqual([]);
    // La garde n'est pas vide-et-verte : elle mesure bien des clés réelles.
    expect(skills.flatMap((s) => Object.keys(s.altChar?.chars ?? {})).length).toBeGreaterThan(0);
  });
});
