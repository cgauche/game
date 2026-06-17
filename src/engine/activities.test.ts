/**
 * Activités « Entre deux aventures » (LDB ch.23) — moteur PUR :
 *  - Artisanat (l.65-92) : Test étendu de Métier, DR cible par gamme de prix (Bronze 5 /
 *    Argent 10 / Or 15+), « chaque Défaut diminue de moitié le nombre de DR requis, et chaque
 *    Atout ajoute +5 (ajouté après avoir appliqué les Défauts) », Difficulté par Disponibilité.
 *  - Apprentissage particulier (l.58-63) : tuteur 2d10 pa par 100 PX du Talent ; Test −20,
 *    +10 par tentative ratée.
 *  - Opérations bancaires (l.154-165) : invest — retirer rate 1d100 ≤ Indice → faillite ;
 *    planque — 1d100 ≤ 10 → perdue.
 *  - Revenus = « Gagner de l'argent grâce au Statut » (LDB 08 l.130-144) : Test Spectaculaire
 *    Accessible (+20) de la Compétence de carrière ; Bronze 2d10 sc × Standing, Argent 1d10 pa
 *    × Standing, Or 1 CO × Standing ; échec → moitié ; Échec Stupéfiant (−6) → rien.
 */
import { describe, it, expect } from 'vitest';
import type { RNG } from './dice';
import { toBrass } from './money';
import { craftTarget, apprenticeshipTutorCost, bankWithdrawOutcome, statusIncome } from './activities';

function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] ?? 1 } as RNG;
}

describe('craftTarget — Artisanat (LDB 23 l.68-85)', () => {
  it('gammes de prix : Bronze 5 / Argent 10 / Or 15 DR', () => {
    expect(craftTarget('bronze', 'Commune', 0, 0).dr).toBe(5);
    expect(craftTarget('argent', 'Commune', 0, 0).dr).toBe(10);
    expect(craftTarget('or', 'Commune', 0, 0).dr).toBe(15);
  });
  it('chaque Défaut ÷2 (avant Atouts), chaque Atout +5 après', () => {
    expect(craftTarget('argent', 'Commune', 0, 1).dr).toBe(5); // 10 ÷ 2
    expect(craftTarget('argent', 'Commune', 0, 2).dr).toBe(3); // 10 ÷ 4 → arrondi sup (min 1)
    expect(craftTarget('argent', 'Commune', 2, 0).dr).toBe(20); // 10 + 2×5
    expect(craftTarget('argent', 'Commune', 1, 1).dr).toBe(10); // (10 ÷ 2) + 5 — Atouts APRÈS Défauts
  });
  it('difficulté par Disponibilité (Commune +20 … Exotique −30)', () => {
    expect(craftTarget('bronze', 'Commune', 0, 0).difficulty).toBe('accessible');
    expect(craftTarget('bronze', 'Limitée', 0, 0).difficulty).toBe('intermediaire');
    expect(craftTarget('bronze', 'Rare', 0, 0).difficulty).toBe('complexe');
    expect(craftTarget('bronze', 'Exotique', 0, 0).difficulty).toBe('tresDifficile');
  });
});

describe('apprenticeshipTutorCost — « 2D10 pistoles d’argent par 100PX » (LDB 23 l.63)', () => {
  it('un Talent à 100 PX : un seul 2d10 en pa', () => {
    const m = apprenticeshipTutorCost(100, seq([4, 6])); // 10 pa
    expect(toBrass(m)).toBe(10 * 12);
  });
  it('un Talent à 300 PX : trois tranches de 2d10', () => {
    const m = apprenticeshipTutorCost(300, seq([1, 2, 3, 4, 5, 6])); // 3+7+11 = 21 pa
    expect(toBrass(m)).toBe(21 * 12);
  });
});

describe('bankWithdrawOutcome — Opérations bancaires (LDB 23 l.157-159)', () => {
  it('invest : d100 ≤ Indice → faillite ; sinon capital + intérêts', () => {
    expect(bankWithdrawOutcome('invest', 6, 6)).toBe('lost');
    expect(bankWithdrawOutcome('invest', 6, 7)).toBe('ok');
  });
  it('planque : d100 ≤ 10 → découverte ; pas d’intérêts', () => {
    expect(bankWithdrawOutcome('stash', 0, 10)).toBe('lost');
    expect(bankWithdrawOutcome('stash', 0, 11)).toBe('ok');
  });
});

describe('statusIncome — « Gagner de l’argent grâce au Statut » (LDB 08 l.135-144)', () => {
  it('Bronze N : N × 2d10 sous de cuivre', () => {
    const m = statusIncome('bronze', 2, seq([3, 4, 5, 6]), 'success'); // (3+4)+(5+6) = 18 sc
    expect(toBrass(m)).toBe(18);
  });
  it('Argent N : N × 1d10 pistoles ; Or N : N couronnes', () => {
    expect(toBrass(statusIncome('argent', 2, seq([1, 2]), 'success'))).toBe(3 * 12);
    expect(toBrass(statusIncome('or', 3, seq([]), 'success'))).toBe(3 * 240);
  });
  it('échec : la moitié ; Échec Stupéfiant : rien', () => {
    expect(toBrass(statusIncome('argent', 1, seq([10]), 'fail'))).toBe(Math.floor((10 * 12) / 2));
    expect(toBrass(statusIncome('or', 5, seq([]), 'astoundingFail'))).toBe(0);
  });
});

// ── Catalogues UI (sélecteurs alimentés par la donnée — audit POC→produit) ──────────────────
import { craftSpecOf, craftCatalog, learnableTalents, orderCatalog, tutorCostRange, metierOf } from './activities';
import { createHero } from './character';
import { makeRNG } from './dice';
import { findTrappingById, skillInstanceLabel, talentConcrete } from '../data';

describe('craftSpecOf — dérivation partagée flux/catalogue', () => {
  it('matériaux = ¼ du prix (ch.23 l.66), gamme par pièce dominante', () => {
    const dague = findTrappingById('dague')!;
    const spec = craftSpecOf(dague);
    expect(spec.materialsBrass).toBe(Math.max(1, Math.floor(spec.priceBrass / 4)));
    expect(['bronze', 'argent', 'or']).toContain(spec.tier);
  });
  it('Disponibilité ND/absente → Rare prudent (arbitrage documenté)', () => {
    expect(craftSpecOf({ price: { gold: 0, silver: 5, bronze: 0 }, availability: 'ND' }).avail).toBe('Rare');
    expect(craftSpecOf({ price: { gold: 0, silver: 5, bronze: 0 }, availability: null }).avail).toBe('Rare');
  });
});

describe('craftCatalog / orderCatalog', () => {
  it('le catalogue d’Artisanat ne liste que des objets à prix chiffré, avec cible de Test', () => {
    const cat = craftCatalog();
    expect(cat.length).toBeGreaterThan(100);
    for (const o of cat.slice(0, 20)) {
      expect(o.priceBrass).toBeGreaterThan(0);
      expect(o.dr).toBeGreaterThanOrEqual(1);
    }
    // « Épée » n’existe pas : le sélecteur évite le piège du libellé deviné (audit B1).
    expect(cat.some((o) => o.label === 'Épée bâtarde')).toBe(true);
  });
  it('Passer commande : objets Exotiques/jamais en vente, payables (prix > 0)', () => {
    const cat = orderCatalog();
    expect(cat.length).toBeGreaterThan(0);
    for (const o of cat) expect(o.priceBrass).toBeGreaterThan(0);
    expect(cat.every((o) => { const t = findTrappingById(o.id)!; return t.availability === 'Exotique' || t.availability === 'ND' || t.availability == null; })).toBe(true);
  });
});

describe('learnableTalents — « un Talent en dehors de votre Carrière » (ch.23 l.59)', () => {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'T', rng: makeRNG(7) });
  it('exclut les talents de la Carrière courante (eux passent par l’Avancement)', () => {
    const labels = learnableTalents(hero).map((t) => t.label);
    // « Guerrier né » est un talent du Soldat Niveau 1 (Recrue) → exclu de l'Apprentissage.
    expect(labels).not.toContain('Guerrier né');
    expect(labels).not.toContain('Infatigable');
    expect(labels).toContain('Chanceux'); // hors carrière Soldat
  });
  it('coût PX de la prochaine acquisition + fourchette tuteur 2d10 pa/100 PX', () => {
    const lt = learnableTalents(hero);
    const fresh = lt.find((x) => !hero.talents.some((t) => talentConcrete(t) === x.label))!;
    expect(fresh.xpCost).toBe(100); // 1re acquisition
    // Chanceux est déjà pris 1× (tirage de création) → la 2e acquisition coûte 200 PX.
    expect(lt.find((x) => x.label === 'Chanceux')!.xpCost).toBe(200);
    expect(fresh.tutorMinBrass).toBe(tutorCostRange(fresh.xpCost).minBrass);
    expect(tutorCostRange(250)).toEqual({ minBrass: 3 * 2 * 12, maxBrass: 3 * 20 * 12 }); // 3 tranches
  });
  it('metierOf : Compétence Métier avec avances seulement', () => {
    expect(metierOf(hero)).toBeUndefined();
    hero.skills.push({ skillId: 'metier', spec: 'Forgeron', characteristic: 'Dex', advances: 5 });
    expect(skillInstanceLabel(metierOf(hero)!)).toBe('Métier (Forgeron)');
  });
});
