import { describe, it, expect } from 'vitest';
import { makePregens, makeArenaParty } from './pregens';

describe('Personnages pré-tirés', () => {
  it('se génèrent tous sans erreur (labels d’espèce/carrière valides)', () => {
    const errs: unknown[] = [];
    const orig = console.error;
    console.error = (...a: unknown[]) => errs.push(a);
    const pregens = makePregens();
    console.error = orig;
    expect(errs).toEqual([]); // aucun pré-tiré ignoré
    expect(pregens.length).toBe(8);
    for (const h of pregens) {
      expect(h.kind).toBe('hero');
      expect(h.wounds.max).toBeGreaterThan(0);
      expect(h.species).toBeTruthy();
    }
    // Les deux incantateurs portent bien leurs sorts.
    const sorcier = pregens.find((h) => h.career === 'Sorcier');
    const pretre = pregens.find((h) => h.career === 'Prêtre');
    expect(sorcier?.spells).toContain('Fléchette');
    expect(pretre?.spells).toContain('Bénédiction de Guérison');
  });

  it('les incantateurs portent les Talents REQUIS par leurs sorts (RAW)', () => {
    const pregens = makePregens();
    const sorcier = pregens.find((h) => h.career === 'Sorcier')!;
    const pretre = pregens.find((h) => h.career === 'Prêtre')!;
    // LDB 10 (Magie mineure) : « Vous pouvez apprendre des Sorts de Magie mineure » — requis pour Fléchette/Choc.
    expect(sorcier.talents.map((t) => t.name)).toContain('Magie mineure');
    // LDB 41 l.14 : « un Personnage avec le Talent Béni reçoit les six Bénédictions de son culte ».
    expect(pretre.talents.map((t) => t.name)).toContain('Béni (Sigmar)');
    // Et les Compétences d'incantation restent là (gating des Compétences avancées).
    expect(sorcier.skills.some((s) => s.name === 'Langue' && s.spec === 'Magick' && s.advances >= 1)).toBe(true);
    expect(pretre.skills.some((s) => s.name === 'Prière' && s.advances >= 1)).toBe(true);
  });
});

/**
 * Jalon ③ — le quatuor d'Arène doit exercer un maximum de règles DISTINCTES (la réponse à
 * « le groupe possède-t-il l'équipe qui permet d'expérimenter toutes les règles ? »). On NE prend
 * PAS `slice(0, 4)` : ce test verrouille la couverture (arme à distance, magie, soin, Spé d'arme
 * non-Base, Psychologie) pour empêcher une régression silencieuse vers les 4 premiers pré-tirés.
 */
describe('makeArenaParty — couverture des règles', () => {
  const party = makeArenaParty();
  const hasSkill = (name: string) =>
    party.some((h) => h.skills.some((s) => s.name.toLowerCase().includes(name.toLowerCase())));

  it('compte exactement 4 héros, tous de carrières distinctes', () => {
    expect(party).toHaveLength(4);
    expect(new Set(party.map((h) => h.career)).size).toBe(4);
  });

  it('n’est PAS le simple slice(0, 4) des pré-tirés (inclut un Chasseur)', () => {
    const first4 = makePregens().slice(0, 4).map((h) => h.career);
    expect(party.map((h) => h.career)).not.toEqual(first4);
    expect(party.some((h) => h.career === 'Chasseur')).toBe(true);
  });

  it('porte une arme à DISTANCE (Projectiles : bandes de portée / munitions / rechargement)', () => {
    // L'arme à distance est PORTÉE (inventaire / loadout « Distance ») même si le loadout actif est « Mêlée ».
    expect(party.filter((h) => (h.items ?? []).some((i) => i.kind === 'ranged')).length).toBeGreaterThanOrEqual(1);
  });

  it('embarque un lanceur de sorts (couche magie arcanique + Incident)', () => {
    expect(party.some((h) => (h.spells?.length ?? 0) > 0)).toBe(true);
  });

  it('dispose de Guérison en combat (soin sans repos)', () => {
    expect(hasSkill('Guérison')).toBe(true);
  });

  it('exerce une Spécialisation de Corps à corps NON-Base (prouve le Jalon 2 en jeu)', () => {
    const specs = party.flatMap((h) =>
      h.skills.filter((s) => s.name.toLowerCase().includes('corps à corps')).map((s) => (s.spec ?? '').toLowerCase()),
    );
    expect(specs.some((sp) => sp && sp !== 'base')).toBe(true);
  });

  it('exerce la Psychologie (un héros au Talent Frénésie / Sans peur)', () => {
    expect(party.some((h) => (h.talents ?? []).some((t) => /frénésie|sans peur/i.test(t.name)))).toBe(true);
  });
});
