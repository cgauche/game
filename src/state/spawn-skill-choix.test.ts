/**
 * CONTRAT POSITIF (#1456 L3') — l'emplacement NON DÉSIGNÉ d'un statbloc (`SkillRef.choix`, forme
 * unique #1463) est DÉSIGNÉ au spawn : l'instance persistée est CONCRÈTE. Chemin RÉEL :
 * `creatures.json` → `creatureToCombatant` → `skillsFromBook` → `testValue`.
 *
 * ARBITRAGE #1456 (règle 7 — le RAW confie ce choix au MJ, et il n'y a pas de MJ) : tirage SEEDÉ sur
 * l'id d'instance, parmi `specOptions` si la donnée borne, sinon parmi le POOL de la Compétence.
 * `LDB 09 l.40` (« vous devrez choisir une *Spécialisation* vous-même »), `LDB 09 l.44` (« chaque
 * *Spécialisation* étant traitée comme une Compétence unique »).
 */
import { describe, it, expect } from 'vitest';
import { creatureToCombatant } from './spawn';
import { creatures, findCreatureById, findSkillById, specPoolOf, skillInstanceLabel } from '../data';
import { testValue, actorHasSkill } from '../engine/skills';
import { knowsCastingSkill } from '../engine/magic';
import { traitCapability } from '../engine/traits/dispatch';

const spawn = (creatureId: string, uid = `${creatureId}-1`) => {
  const c = findCreatureById(creatureId);
  expect(c, `créature « ${creatureId} » absente de creatures.json`).toBeTruthy();
  return creatureToCombatant(c!, uid, { x: 0, y: 0 });
};

describe('désignation au spawn d’un `choix` de spécialisation (#1456)', () => {
  it('citadin : Musicien 35 est porté par UNE spec du pool, désignée', () => {
    const c = spawn('citadin');
    const musicien = c.skills.filter((s) => s.skillId === 'musicien');
    expect(musicien).toHaveLength(1);
    const designee = musicien[0].spec;
    expect(specPoolOf(findSkillById('musicien')!)).toContain(designee);
    expect(testValue(c, 'musicien', undefined, designee)).toBe(35);
    const autre = specPoolOf(findSkillById('musicien')!).find((id) => id !== designee)!;
    expect(testValue(c, 'musicien', undefined, autre)).toBe(30); // Dextérité seule : Compétence unique
    expect(skillInstanceLabel(musicien[0])).not.toContain('Au choix');
  });

  it('ungor-adulte : la désignation reste DANS specOptions', () => {
    const c = spawn('ungor-adulte');
    const metier = c.skills.filter((s) => s.skillId === 'metier');
    expect(metier).toHaveLength(1);
    expect(['armurier', 'forgeron']).toContain(metier[0].spec);
    expect(testValue(c, 'metier', undefined, metier[0].spec)).toBe(55);
    expect(testValue(c, 'metier', undefined, 'tailleur')).toBe(45); // Dex 40 + Doigts de fée 5
  });

  it('sorcier-du-chaos : la Divinité désignée est un des 3 Dieux Sombres bornés', () => {
    const c = spawn('sorcier-du-chaos');
    const savoir = c.skills.filter((s) => s.skillId === 'savoir');
    expect(savoir).toHaveLength(1);
    expect(['tzeentch', 'slaanesh', 'nurgle']).toContain(savoir[0].spec);
  });

  it('DÉTERMINISME : même uid → même désignation ; un autre uid peut désigner autrement', () => {
    const specOf = (uid: string) => spawn('citadin', uid).skills.find((s) => s.skillId === 'musicien')!.spec;
    expect(specOf('citadin-a')).toBe(specOf('citadin-a'));
    const vus = new Set(Array.from({ length: 40 }, (_, i) => specOf(`citadin-${i}`)));
    expect(vus.size, `40 uids → ${[...vus].join(', ')}`).toBeGreaterThan(1);
  });

  it('Langue (Au choix) : `magick` n’est VRAI que si magick a été désigné', () => {
    // Le `choix` ne « répond » plus : `actorHasSkill(c,'langue','magick')` suit la spec RÉELLEMENT
    // désignée, jamais l'emplacement (19 statblocs portent ce `choix`).
    for (const uid of ['m-1', 'm-2', 'm-3', 'm-4', 'm-5']) {
      const c = spawn('marchand-services-urbains-frequents-usuels', uid);
      const langues = c.skills.filter((s) => s.skillId === 'langue').map((s) => s.spec);
      expect(langues.every((sp) => sp != null)).toBe(true);
      expect(actorHasSkill(c, 'langue', 'magick')).toBe(langues.includes('magick'));
    }
  });

  // Le grief du juge : deux prédicats DIVERGENTS sur le même combattant. Ils lisent désormais la MÊME
  // instance concrète ; leurs seuls écarts restants sont ceux que `knowsCastingSkill` DÉCLARE (Trait
  // `spellcaster`, et l'exigence d'au moins 1 Augmentation, `LDB 09 l.32`). Balaye tout le bestiaire —
  // et prouve du même coup qu'aucun `choix` n'a un pool VIDE (un spawn qui échoue rougit ici).
  it('CONCORDANCE `actorHasSkill` ⇄ `knowsCastingSkill` sur les 490 statblocs', () => {
    const ecarts: string[] = [];
    for (const cr of creatures) {
      const c = creatureToCombatant(cr, `${cr.id}-cc`, { x: 0, y: 0 });
      const inst = c.skills.find((s) => s.skillId === 'langue' && s.spec === 'magick');
      if (actorHasSkill(c, 'langue', 'magick') !== (inst != null)) ecarts.push(`${cr.id} : actorHasSkill fantôme`);
      const attendu = traitCapability(c.traits, 'spellcaster') || (inst != null && inst.advances >= 1);
      if (knowsCastingSkill(c, 'langue', 'magick') !== attendu) ecarts.push(`${cr.id} : knowsCastingSkill hors contrat`);
    }
    expect(ecarts, ecarts.join(' | ')).toEqual([]);
  });
});
