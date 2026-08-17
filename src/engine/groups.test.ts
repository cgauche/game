import { describe, it, expect } from 'vitest';
import { groupsFor, groupMatch } from './groups';
import { findCreatureById, findGodById, findGroupById, findSpeciesById, findTalentById } from '../data';

describe('Groupes — dérivation par id canonique & matching strict (LDB 21, P3)', () => {
  it('folder créature → id de catégorie (règles ordonnées, la plus spécifique d’abord)', () => {
    expect(groupsFor({ folder: 'Les hordes de peaux-vertes' })).toContain('peau-verte');
    expect(groupsFor({ folder: 'Les morts sans repos' })).toContain('mort-vivant');
    expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).toContain('homme-bete');
    expect(groupsFor({ folder: 'Les bêtes du Reikland' })).toContain('bete');
    expect(groupsFor({ folder: 'Hommes-bêtes, les enfants du Chaos' })).not.toContain('bete'); // spécificité
    expect(groupsFor({ folder: 'Démons, les armées baragouinantes' })).toContain('demon');
    expect(groupsFor({ folder: 'Princes démons' })).toContain('demon');
    expect(groupsFor({ folder: 'Les ignobles hommes-rats' })).toContain('skaven');
    expect(groupsFor({ folder: 'Les peuples du Reikland' })).toEqual([]); // pas de catégorie de monstre
  });

  it('espèce → ids DÉCLARÉS par l’entrée (`grantGroups`) + carrière + extras (dédup, ids)', () => {
    const g = groupsFor({ speciesId: 'humains-reiklander', careerId: 'soldat', extras: ['sigmarite'] });
    expect(g).toEqual(expect.arrayContaining(['humain', 'soldat', 'sigmarite']));
  });

  it('dédup : un même id n’apparaît qu’une fois', () => {
    const g = groupsFor({ speciesId: 'humains-reiklander', extras: ['humain'] });
    expect(g.filter((x) => x === 'humain').length).toBe(1);
  });

  it('Trait (mort-vivant/demoniaque) → id de Groupe, même hors folder (unifie avec domainAttributes)', () => {
    expect(groupsFor({ traits: [{ id: 'mort-vivant' }] })).toEqual(['mort-vivant']);
    expect(groupsFor({ traits: [{ id: 'demoniaque' }] })).toEqual(['demon']);
    expect(groupsFor({ traits: [{ id: 'vol' }] })).toEqual([]); // trait sans règle → aucun Groupe
  });

  it('classe « Roublards » → Groupe « criminel » auto-dérivé (Épée de justice / Traits psy ciblés)', () => {
    for (const id of ['voleur', 'hors-la-loi', 'charlatan', 'receleur']) {
      expect(groupsFor({ careerId: id })).toContain('criminel');
    }
    expect(groupsFor({ careerId: 'soldat' })).not.toContain('criminel'); // classe Guerriers
    expect(groupMatch('criminel', groupsFor({ careerId: 'voleur' }))).toBe(true);
  });

  it('carrières MILITAIRES précises (soldat/garde/chevalier) → leur propre id — pas toute la classe Guerriers', () => {
    expect(groupsFor({ careerId: 'soldat' })).toContain('soldat');
    expect(groupsFor({ careerId: 'garde' })).toContain('garde');
    expect(groupsFor({ careerId: 'chevalier' })).toContain('chevalier');
    // Cavalier est aussi classe Guerriers mais N'EST PAS une des 3 carrières militaires ciblées.
    expect(groupsFor({ careerId: 'cavalier' })).toEqual([]);
  });

  it('groupMatch : appartenance STRICTE par id (plus de tolérance pluriel/casse/sous-type)', () => {
    expect(groupMatch('elfe', ['elfe'])).toBe(true);
    expect(groupMatch('mort-vivant', ['mort-vivant'])).toBe(true);
    expect(groupMatch('peau-verte', ['peau-verte'])).toBe(true);
    expect(groupMatch('nain', ['humain'])).toBe(false);
    expect(groupMatch('Elfe', ['elfe'])).toBe(false); // casse différente → id DIFFÉRENT (pas de normalisation)
    expect(groupMatch('elfe', ['Elfe'])).toBe(false);
    expect(groupMatch('elfe', ['elfe-noir'])).toBe(false); // pas de raffinement de sous-type (YAGNI)
  });

  it('SOUS-ESPÈCE Tiléen : aplatit la hiérarchie — l’entrée déclare le racial ET le sous-type', () => {
    expect(groupsFor({ speciesId: 'humains-tileens' })).toEqual(expect.arrayContaining(['humain', 'tileen']));
    expect(groupsFor({ speciesId: 'humains-reiklander' })).not.toContain('tileen'); // pas de faux positif
  });

  it('carrières Bailli/Juriste/Noble → leur propre id de Groupe (Traits psy ciblés, LDB 21)', () => {
    expect(groupsFor({ careerId: 'bailli' })).toContain('bailli');
    expect(groupsFor({ careerId: 'juriste' })).toContain('juriste');
    expect(groupsFor({ careerId: 'noble' })).toContain('noble');
  });

  it('Talent Béni(Sigmar/Ulric) → Groupe religieux (comble le trou Phase 2 : sigmarite n’était dérivé de rien)', () => {
    expect(groupsFor({ talents: [{ talentId: 'beni', spec: 'sigmar' }] })).toContain('sigmarite');
    expect(groupsFor({ talents: [{ talentId: 'beni', spec: 'ulric' }] })).toContain('ulricain');
    expect(groupsFor({ talents: [{ talentId: 'beni', spec: 'manann' }] })).toEqual([]); // culte sans Groupe dédié
    expect(groupsFor({ talents: [{ talentId: 'autre-talent' }] })).toEqual([]); // pas Béni → rien
  });

  it('le culte n’est lu QUE via un Talent porteur de `grantSpecGroups` (le `spec` seul ne suffit pas)', () => {
    // Les deux faces du champ, sur la donnée RÉELLE : Béni le porte, Invocation non — même `spec`,
    // même dieu, un seul des deux ouvre le Groupe.
    expect(findTalentById('beni')?.grantSpecGroups).toBe(true);
    expect(findTalentById('invocation')?.grantSpecGroups).toBeUndefined();
    expect(findGodById('sigmar')?.grantGroups).toEqual(['sigmarite']);
    expect(groupsFor({ talents: [{ talentId: 'invocation', spec: 'sigmar' }] })).toEqual([]);
  });

  it('cibles spéciales : « tout » matche toujours, « vivant » exclut mort-vivant/démon', () => {
    expect(groupMatch('tout', [])).toBe(true);
    expect(groupMatch('tout', ['demon'])).toBe(true);
    expect(groupMatch('vivant', ['humain'])).toBe(true);
    expect(groupMatch('vivant', ['mort-vivant'])).toBe(false);
    expect(groupMatch('vivant', ['demon'])).toBe(false);
  });

  it('vérité — une créature avec Animosité (tileen) réagit à un combattant Tiléen', () => {
    expect(groupMatch('tileen', groupsFor({ speciesId: 'humains-tileens' }))).toBe(true);
    expect(groupMatch('tileen', groupsFor({ speciesId: 'humains-reiklander' }))).toBe(false);
  });

  it('vérité — Préjugé (noble) cible un combattant de carrière Noble', () => {
    expect(groupMatch('noble', groupsFor({ careerId: 'noble' }))).toBe(true);
    expect(groupMatch('noble', groupsFor({ careerId: 'soldat' }))).toBe(false);
  });

  it('vérité — Haine (vivant) d’un mort-vivant frappe les vivants, pas les morts-vivants', () => {
    const vivant = groupsFor({ speciesId: 'humains-reiklander' });
    const mortVivant = groupsFor({ traits: [{ id: 'mort-vivant' }] });
    expect(groupMatch('vivant', vivant)).toBe(true);
    expect(groupMatch('vivant', mortVivant)).toBe(false);
  });

  it('DÉMON du bestiaire : le Groupe de son dieu est DÉCLARÉ sur l’entrée, plus dérivé du folder', () => {
    const nurgling = findCreatureById('nurglings')!;
    expect(nurgling.grantGroups).toEqual(['nurgle']);
    // Le folder seul (sans la déclaration) n'émet plus que la catégorie « demon » : la dérivation
    // par mot-clé de dossier est MORTE — le dieu vient de la donnée portée par la créature.
    expect(groupsFor({ folder: nurgling.folder })).toEqual(['demon']);
    expect(groupsFor({ folder: nurgling.folder, extras: nurgling.grantGroups })).toEqual(['demon', 'nurgle']);
  });

  it('ESPÈCE : les 27 entrées portent leur `grantGroups` (aucune ne dépend plus d’un mot-clé de label)', () => {
    expect(findSpeciesById('gnomes')?.grantGroups).toEqual(['gnome']);
    expect(findSpeciesById('hauts-elfes')?.grantGroups).toEqual(['elfe']);
    expect(findSpeciesById('humains-tileens')?.grantGroups).toEqual(['humain', 'tileen']);
  });

  it('JOKER : `groupMatch` lit `matchesAll`/`exceptGroups` sur l’entrée de `groups.json`', () => {
    expect(findGroupById('tout')?.matchesAll).toBe(true);
    expect(findGroupById('vivant')?.exceptGroups).toEqual(['mort-vivant', 'demon']);
    expect(findGroupById('humain')?.matchesAll).toBeUndefined(); // un Groupe ordinaire n'est pas joker
    expect(groupMatch('groupe-inexistant', ['humain'])).toBe(false); // id fantôme → aucun joker implicite
  });
});
