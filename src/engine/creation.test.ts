import { describe, it, expect, afterEach } from 'vitest';
import { makeRNG } from './dice';
import { setRule, resetRule } from './policy';
import { CHAR_KEYS, CharKey } from './types';
import {
  randomSpeciesTable,
  rollSpecies,
  rollCareer,
  validatePointBuy,
  POINT_BUY_TOTAL,
  parseStatus,
  rollInitialWealth,
  rollAge,
  rollHeight,
  rollEyes,
  rollHair,
  rollStar,
  applyStarEffect,
  XP_SPECIES_ACCEPTED,
  XP_CAREER_FIRST,
  XP_CAREER_TOP3,
  XP_CHARS_KEPT,
  XP_CHARS_REASSIGNED,
  XP_STAR_ROLLED,
} from './creation';
import { careers, findSpeciesById, stars } from '../data';

describe('bonus de PX des choix aléatoires (LDB 04 l.87 / 05 l.191-385)', () => {
  it('valeurs verbatim', () => {
    expect(XP_SPECIES_ACCEPTED).toBe(20);
    expect(XP_CAREER_FIRST).toBe(50);
    expect(XP_CAREER_TOP3).toBe(25);
    expect(XP_CHARS_KEPT).toBe(50);
    expect(XP_CHARS_REASSIGNED).toBe(25);
  });
});

describe('rollStar — signe astral (ADE2, table d100)', () => {
  it('renvoie toujours un signe existant', () => {
    const labels = new Set(stars.map((s) => s.label));
    for (let seed = 0; seed < 200; seed++) {
      expect(labels.has(rollStar(makeRNG(seed)))).toBe(true);
    }
  });

  it('déterministe pour un même seed', () => {
    expect(rollStar(makeRNG(1234))).toBe(rollStar(makeRNG(1234)));
  });

  it('la sentinelle de test « TEST » est absente des données émises', () => {
    expect(stars.some((s) => s.label === 'TEST' || s.rand > 100)).toBe(false);
  });

  it('l\'Étoile du Sorcier : le 1d10 interne produit les 4 variantes (ADE2 l.62)', () => {
    const variants = stars.filter((s) => /Étoile du Sorcier/.test(s.label)).map((s) => s.label);
    expect(variants.length).toBe(4);
    const seen = new Set<string>();
    for (let seed = 0; seed < 3000; seed++) {
      const r = rollStar(makeRNG(seed));
      if (/Étoile du Sorcier/.test(r)) {
        expect(variants).toContain(r); // jamais une variante hors des 4 bandes
        seen.add(r);
      }
    }
    expect(seen.size).toBe(4); // les 4 bandes du d10 sont atteignables
  });
});

describe('applyStarEffect — effet d\'un signe aux ATTRIBUTS DE DÉPART (ADE2 ch.03 l.38)', () => {
  const baseChars = () => Object.fromEntries(CHAR_KEYS.map((k) => [k, 30])) as Record<CharKey, number>;

  it('XP_STAR_ROLLED = 25 (l.36)', () => {
    expect(XP_STAR_ROLLED).toBe(25);
  });

  it('applique les charMod (±carac) — Wymund : +2 Soc, +2 I, -3 Int', () => {
    const chars = baseChars();
    const talents: string[] = [];
    applyStarEffect("Wymund l'Anachorète", chars, (t) => talents.push(t));
    expect(chars.Soc).toBe(32);
    expect(chars.I).toBe(32);
    expect(chars.Int).toBe(27);
    expect(talents).toEqual([]);
  });

  it('octroie le Talent + applique la pénalité — Mummit le Fou : Chanceux, -3 FM', () => {
    const chars = baseChars();
    const talents: string[] = [];
    applyStarEffect('Mummit le Fou', chars, (t) => talents.push(t));
    expect(chars.FM).toBe(27);
    expect(talents).toEqual(['Chanceux']);
  });

  it('signe inconnu = aucun effet (pas d\'appel à addTalent)', () => {
    const chars = baseChars();
    applyStarEffect('Inexistant', chars, () => { throw new Error('addTalent ne doit pas être appelé'); });
    expect(CHAR_KEYS.every((k) => chars[k] === 30)).toBe(true);
  });
});

describe('Tableau des Races aléatoires (LDB 04 l.90) — borne = CHOIX (species.rand partagé)', () => {
  it('bornes croissantes jusqu\'à 100 ; chaque borne porte TOUTES ses espèces (choix RAW)', () => {
    const table = randomSpeciesTable();
    const bounds = table.map((e) => e.max);
    expect(bounds).toEqual([...bounds].sort((a, b) => a - b));
    expect(bounds[bounds.length - 1]).toBe(100);
    // Le jet désigne une borne ; le joueur choisit librement parmi ses espèces (plus de représentante).
    const byMax = Object.fromEntries(table.map((e) => [e.max, e.ids]));
    expect(byMax[90]).toContain('humains-reiklander');
    expect(byMax[94]).toContain('halflings');
    expect(byMax[99]).toContain('hauts-elfes');
    expect(byMax[100]).toContain('elfes-sylvains');
    // Toute id de toute borne doit résoudre vers une espèce existante.
    for (const e of table) for (const id of e.ids) expect(findSpeciesById(id), id).toBeTruthy();
  });
  it('rollSpecies : déterministe (RNG seedé) et cohérent — le jet tombe dans la borne renvoyée', () => {
    const a = rollSpecies(makeRNG(7));
    expect(a).toEqual(rollSpecies(makeRNG(7)));
    const entry = randomSpeciesTable().find((e) => a.roll <= e.max)!;
    expect(a.ids).toEqual(entry.ids);
  });
});

describe('Gnome jouable — règle optionnelle (NADJ appendice I l.10)', () => {
  afterEach(() => resetRule('creation-gnome-jouable'));
  it('off (défaut) : le Gnome (NADJ) n\'est dans AUCUNE borne du Tableau des Races aléatoires', () => {
    expect(randomSpeciesTable().some((e) => e.ids.includes('gnomes'))).toBe(false);
  });
  it('on : le Gnome est une option NORMALE de sa borne 98 — Gnome ET Ogre y co-existent (choix)', () => {
    setRule('creation-gnome-jouable', true);
    const t = randomSpeciesTable();
    const b98 = t.find((e) => e.max === 98)!;
    expect(b98.ids).toContain('gnomes'); // ajouté par la règle
    expect(b98.ids).toContain('ogres'); // l'Ogre ADE2 reste présent (aucune priorité)
  });
});

describe('Tableau des Classes et Carrières aléatoires (LDB 05 l.197+)', () => {
  it('rollCareer : la borne renvoie des carrières TOUTES accessibles à l\'espèce', () => {
    const sylvain = findSpeciesById('elfes-sylvains')!;
    for (let seed = 1; seed <= 20; seed++) {
      const r = rollCareer(careers, sylvain, makeRNG(seed))!;
      expect(r.ids.length).toBeGreaterThan(0);
      for (const id of r.ids) {
        const career = careers.find((c) => c.id === id)!;
        expect(career.rand[sylvain.refCareer], id).not.toBeNull();
      }
    }
  });
});

describe('répartition de 100 Points (LDB 05 l.385 : min 4, max 18)', () => {
  const alloc = (v: number): Record<CharKey, number> => Object.fromEntries(CHAR_KEYS.map((k) => [k, v])) as Record<CharKey, number>;
  it('valide : 10 × 10 = 100', () => {
    expect(validatePointBuy(alloc(10)).ok).toBe(true);
    expect(POINT_BUY_TOTAL).toBe(100);
  });
  it('refus : total ≠ 100, min < 4, max > 18', () => {
    expect(validatePointBuy({ ...alloc(10), CC: 11 }).ok).toBe(false); // 101
    expect(validatePointBuy({ ...alloc(10), CC: 3, CT: 17 }).ok).toBe(false); // min
    expect(validatePointBuy({ ...alloc(10), CC: 19, CT: 1 }).ok).toBe(false); // max
  });
});

describe('Richesse initiale (LDB 05 l.578-583)', () => {
  it('parseStatus : Bronze/Argent/Or + Standing ; typo de données « Agent 1 » tolérée', () => {
    expect(parseStatus('Bronze 2')).toEqual({ tier: 'Bronze', standing: 2 });
    expect(parseStatus('Argent 5')).toEqual({ tier: 'Argent', standing: 5 });
    expect(parseStatus('Or 7')).toEqual({ tier: 'Or', standing: 7 });
    expect(parseStatus('Agent 1')).toEqual({ tier: 'Argent', standing: 1 });
  });
  it('Bronze N : 2N d10 sous ; Argent N : N d10 pistoles ; Or N : N CO ; Standing 0 : rien', () => {
    const bronze = rollInitialWealth({ tier: 'Bronze', standing: 3 }, makeRNG(1));
    expect(bronze.gold).toBe(0);
    expect(bronze.silver).toBe(0);
    expect(bronze.brass).toBeGreaterThanOrEqual(6); // 6d10
    expect(bronze.brass).toBeLessThanOrEqual(60);
    const silver = rollInitialWealth({ tier: 'Argent', standing: 3 }, makeRNG(1));
    expect(silver.silver).toBeGreaterThanOrEqual(3);
    expect(silver.silver).toBeLessThanOrEqual(30);
    expect(rollInitialWealth({ tier: 'Or', standing: 3 }, makeRNG(1))).toEqual({ gold: 3, silver: 0, brass: 0 });
    expect(rollInitialWealth({ tier: 'Bronze', standing: 0 }, makeRNG(1))).toEqual({ gold: 0, silver: 0, brass: 0 });
  });
});

describe('Détails (LDB 05 l.691-744)', () => {
  it('âge/taille dans les bornes par espèce', () => {
    const human = findSpeciesById('humains-reiklander')!;
    const dwarf = findSpeciesById('nains')!;
    for (let seed = 1; seed <= 10; seed++) {
      const a = rollAge(human, makeRNG(seed));
      expect(a).toBeGreaterThanOrEqual(16); // 15 + 1d10
      expect(a).toBeLessThanOrEqual(25);
      const t = rollHeight(dwarf, makeRNG(seed)); // 130 + 3d10
      expect(t).toBeGreaterThanOrEqual(133);
      expect(t).toBeLessThanOrEqual(160);
    }
  });
  it('yeux/cheveux : libellé non vide tiré des tables, déterministe', () => {
    const elf = findSpeciesById('hauts-elfes')!;
    expect(rollEyes(elf, makeRNG(3))).toBe(rollEyes(elf, makeRNG(3)));
    expect(rollEyes(elf, makeRNG(3)).length).toBeGreaterThan(0);
    expect(rollHair(elf, makeRNG(3)).length).toBeGreaterThan(0);
  });
});
