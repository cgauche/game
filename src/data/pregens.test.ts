import { describe, it, expect } from 'vitest';
import { makePregens, makePregensWithWealth, makeShowcaseParty, pregen, pregenParty, PREGEN } from './pregens';
import { skillInstanceLabel, talentConcrete, findSpellById, levelsForCareer, blessingsOf } from './index';
import { parseStatus } from '../engine/creation';
import { toBrass } from '../engine/money';

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
    const sorcier = pregens.find((h) => h.career === 'sorcier');
    const pretre = pregens.find((h) => h.career === 'pretre');
    expect(sorcier?.spells).toContain('flechette'); // runtime = ids de sort
    // Sigmar n'accorde PAS « Bénédiction de Guérison » (guérison = Shallya) — les SIX bénédictions
    // RAW du culte (gods.json, id « sigmar »).
    expect(pretre?.spells).toEqual(expect.arrayContaining(blessingsOf('sigmar')));
  });

  it('les incantateurs portent les Talents REQUIS par leurs sorts (RAW)', () => {
    const pregens = makePregens();
    const sorcier = pregens.find((h) => h.career === 'sorcier')!;
    const pretre = pregens.find((h) => h.career === 'pretre')!;
    // LDB 10 (Magie mineure) : « Vous pouvez apprendre des Sorts de Magie mineure » — requis pour Fléchette/Choc.
    expect(sorcier.talents.map((t) => talentConcrete(t))).toContain('Magie mineure');
    // LDB 41 l.5 : « un Personnage avec le Talent Béni reçoit les six Bénédictions de son culte ».
    expect(pretre.talents.map((t) => talentConcrete(t))).toContain('Béni (Sigmar)');
    // Et les Compétences d'incantation restent là (gating des Compétences avancées).
    expect(sorcier.skills.some((s) => s.id === 'langue' && s.spec === 'magick' && s.advances >= 1)).toBe(true);
    expect(pretre.skills.some((s) => s.id === 'priere' && s.advances >= 1)).toBe(true);
  });

  /** Conformité RAW (#421) : chaque pré-tiré passe par le MÊME pipeline que le créateur (`buildHero`),
   *  seule l'identité (espèce/carrière/nom/motivation/talent de carrière/sorts) reste authorée. */
  describe('conformité aux règles de création (#421)', () => {
    const entries = makePregensWithWealth();

    it('Richesse initiale NON NULLE, cohérente avec le Standing de la carrière (LDB 05 l.578-583)', () => {
      for (const { hero, wealth } of entries) {
        const brass = toBrass(wealth);
        expect(brass, `${hero.label} (${hero.career}) : bourse nulle`).toBeGreaterThan(0);
        const level = levelsForCareer(hero.career!).find((l) => l.level === 1)!;
        const status = parseStatus(level.status);
        // Bornes de la formule officielle (Bronze 2d10×Standing / Argent 1d10×Standing / Or 1 CO×Standing) :
        // le jet réel du pré-tiré doit tomber dans les bornes de SA formule (seed distinct, même tier/Standing).
        const perDie = status.tier === 'Bronze' ? 2 * status.standing : status.tier === 'Argent' ? status.standing : 0;
        if (status.tier === 'Or') {
          expect(brass).toBe(status.standing * 240); // 1 CO = 20 sc = 240 br (money.ts)
        } else {
          const unit = status.tier === 'Bronze' ? 1 : 12; // 1 sc = 12 br
          expect(brass).toBeGreaterThanOrEqual(perDie * unit);
          expect(brass).toBeLessThanOrEqual(perDie * 10 * unit);
        }
      }
    });

    it('prêtre 808 : exactement les SIX bénédictions de Sigmar (jamais 2, jamais un culte tiers)', () => {
      const pretre = entries.find((e) => e.hero.id === 'pregen-808')!.hero;
      const sigmarBlessings = blessingsOf('sigmar');
      expect(sigmarBlessings).toHaveLength(6);
      expect(pretre.spells).toEqual(expect.arrayContaining(sigmarBlessings));
      expect(pretre.spells!.filter((s) => sigmarBlessings.includes(s))).toHaveLength(6);
    });

    it('sorcier 707 : sorts mineurs dans le quota BFM, tous de famille « mineure » (LDB 10 l.714)', () => {
      const sorcier = entries.find((e) => e.hero.id === 'pregen-707')!.hero;
      const bfm = Math.floor((sorcier.characteristics['force-mentale'] ?? 0) / 10); // Bonus = dizaine
      expect(sorcier.spells!.length).toBe(bfm);
      for (const id of sorcier.spells ?? []) {
        expect(findSpellById(id)?.family, `sort ${id} n'est pas de famille mineure`).toBe('mineure');
      }
      // Sorts authorés (identité) conservés.
      expect(sorcier.spells).toEqual(expect.arrayContaining(['flechette', 'choc']));
    });

    it('tout emplacement `{wildcard:\'arme\'}` est résolu — chaque pré-tiré porte une arme équipée', () => {
      for (const { hero } of entries) {
        const weapon = (hero.items ?? []).some((i) => i.equipped && (i.kind === 'melee' || i.kind === 'ranged'));
        expect(weapon, `${hero.label} (${hero.career}) : aucune arme équipée`).toBe(true);
      }
    });

    it('aucun pré-tiré ne perd d’attribut de création (Compétences/Talents/Possessions de classe+carrière)', () => {
      for (const { hero } of entries) {
        expect(hero.skills.length, `${hero.label} : Compétences`).toBeGreaterThan(0);
        expect((hero.talents ?? []).length, `${hero.label} : Talents`).toBeGreaterThan(0);
        expect((hero.items ?? []).length, `${hero.label} : Possessions`).toBeGreaterThan(0);
      }
    });
  });
});

/**
 * Jalon ③ — le quatuor d'Arène doit exercer un maximum de règles DISTINCTES (la réponse à
 * « le groupe possède-t-il l'équipe qui permet d'expérimenter toutes les règles ? »). On NE prend
 * PAS `slice(0, 4)` : ce test verrouille la couverture (arme à distance, magie, soin, Spé d'arme
 * non-Base, Psychologie) pour empêcher une régression silencieuse vers les 4 premiers pré-tirés.
 */
describe('makeShowcaseParty — couverture des règles', () => {
  const party = makeShowcaseParty();
  const hasSkill = (name: string) =>
    party.some((h) => h.skills.some((s) => skillInstanceLabel(s).toLowerCase().includes(name.toLowerCase())));

  it('compte exactement 4 héros, tous de carrières distinctes', () => {
    expect(party).toHaveLength(4);
    expect(new Set(party.map((h) => h.career)).size).toBe(4);
  });

  it('n’est PAS le simple slice(0, 4) des pré-tirés (inclut un Chasseur)', () => {
    const first4 = makePregens().slice(0, 4).map((h) => h.career);
    expect(party.map((h) => h.career)).not.toEqual(first4);
    expect(party.some((h) => h.career === 'chasseur')).toBe(true);
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
      h.skills.filter((s) => s.id === 'corps-a-corps').map((s) => (s.spec ?? '').toLowerCase()),
    );
    expect(specs.some((sp) => sp && sp !== 'base')).toBe(true);
  });

  it('exerce la Psychologie (un héros au Talent Frénésie / Sans peur)', () => {
    expect(party.some((h) => (h.talents ?? []).some((t) => /frénésie|sans peur/i.test(talentConcrete(t))))).toBe(true);
  });
});

/**
 * Sélection de groupe — API UNIQUE et intention-révélante (`pregen`/`pregenParty`/`PREGEN`), qui remplace
 * les `slice(0, n)`/`find(name)`/indexations ad hoc accrétés. On choisit par seed STABLE, jamais par position.
 */
describe('Sélection de groupe — pregen / pregenParty', () => {
  it('pregen(seed) renvoie le bon pré-tiré (id stable pregen-<seed>)', () => {
    expect(pregen(PREGEN.soldat).id).toBe('pregen-101');
    expect(pregen(PREGEN.chasseur).career).toBe('chasseur');
  });

  it('pregenParty respecte l’ordre des seeds donnés', () => {
    expect(pregenParty(PREGEN.sorcier, PREGEN.soldat).map((h) => h.career)).toEqual(['sorcier', 'soldat']);
  });

  it('lève sur un seed inconnu (pas d’undefined silencieux d’un find/slice raté)', () => {
    expect(() => pregen(9999)).toThrow();
  });

  it('makeShowcaseParty = les 4 piliers (soldat, tueur, sorcier, chasseur)', () => {
    expect(makeShowcaseParty().map((h) => h.career)).toEqual(['soldat', 'tueur', 'sorcier', 'chasseur']);
  });
});
