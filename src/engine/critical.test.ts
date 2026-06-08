import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import type { RNG } from './dice';
import { rollCritical, critLocationRoll, parseAmputation, permanentAmputations } from './critical';
import { removeSurgicalTrauma } from './trauma';
import type { Combatant } from './types';

/** RNG scripté : renvoie les valeurs dans l'ordre. */
function seq(values: number[]): RNG {
  let i = 0;
  return { int: () => values[i++] };
}

const victim = (E = 30): Combatant =>
  ({
    name: 'V',
    characteristics: { CC: 30, CT: 30, F: 30, E, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 0, max: 12 },
    conditions: [],
    skills: [],
    kind: 'hero',
  }) as unknown as Combatant;

describe('rollCritical — résolution d’une Blessure critique (LDB 18-Traumatisme)', () => {
  it("retourne une entrée de la table de la localisation, avec PB et États", () => {
    const r = rollCritical(victim(), 'tete', makeRNG(1));
    expect(r.location).toBe('tete');
    expect(typeof r.name).toBe('string');
    expect(r.woundsLoss).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(r.conditions)).toBe(true);
  });
  it('overkill > BE applique -20 au jet (résultat moins sévère, min 01)', () => {
    const a = rollCritical(victim(35), 'corps', makeRNG(7), 0); // BE(35)=3
    const b = rollCritical(victim(35), 'corps', makeRNG(7), 10); // overkill 10 > 3 → -20
    expect(b.roll).toBe(Math.max(1, a.roll - 20));
  });
  it("le résultat 00 (létal) est mortel", () => {
    const r = rollCritical(victim(), 'tete', makeRNG(1));
    if (r.roll === 100) expect(r.lethal).toBe(true);
  });
  it('les traumatismes produits portent la localisation du critique (corps) et incluent des Fractures', () => {
    let sawFracture = false;
    for (let s = 1; s <= 60; s++) {
      const r = rollCritical(victim(), 'corps', makeRNG(s));
      for (const t of r.traumas) {
        expect(t.location).toBe('corps');
        if (t.label.startsWith('Fracture')) sawFracture = true;
      }
    }
    expect(sawFracture).toBe(true); // la table corps comporte des Fractures (Côtes/Hanche/Cage/Clavicule)
  });
  it('une Fracture du Torse posée par un critique réduit Force/Agilité de 30', () => {
    for (let s = 1; s <= 60; s++) {
      const r = rollCritical(victim(), 'corps', makeRNG(s));
      const frac = r.traumas.find((t) => t.label.startsWith('Fracture'));
      if (frac) {
        expect(frac.charPenalty).toEqual({ F: -30, Ag: -30 });
        return;
      }
    }
    throw new Error('aucune Fracture trouvée sur 60 seeds');
  });
});

describe('parseAmputation — lecture « Amputation (Difficulté) » des notes (LDB 18)', () => {
  it('mappe chaque palier ; « Très Difficile » n’est pas capturé comme « Difficile »', () => {
    expect(parseAmputation('… — Amputation (Très Difficile).')).toBe('tresDifficile');
    expect(parseAmputation('Bras inutilisable — Amputation (Difficile).')).toBe('difficile');
    expect(parseAmputation("Perte de l'œil — Amputation (Complexe)")).toBe('complexe');
    expect(parseAmputation('Amputation (Accessible).')).toBe('accessible');
    expect(parseAmputation('Perdez 1d10 dents — Amputation (Facile)')).toBe('facile');
    expect(parseAmputation('Une simple coupure, rien de grave.')).toBeNull();
  });
});

describe('rollCritical — amputation (LDB 18 l.328-333)', () => {
  // « Doigt sectionné » (BRAS 81-85) : note « Amputation (Accessible) », sans entry.resist ni fracture →
  // exactement 2 jets (d100 du critique, puis d100 du Test de Résistance d'amputation).
  it('crée un trauma chirurgical (needsSurgery) et inflige À Terre sur Résistance ratée', () => {
    const r = rollCritical(victim(30), 'brasD', seq([83, 60])); // E30 → Accessible cible 50 ; 60 > 50 → échec (DR −1)
    expect(r.traumas.some((t) => t.needsSurgery && t.label.startsWith('Amputation'))).toBe(true);
    expect(r.conditions.some((c) => c.name === 'À Terre')).toBe(true);
    expect(r.conditions.some((c) => c.name === 'Inconscient')).toBe(false); // DR −1 : pas d'Inconscient
  });

  it('échec catastrophique (DR ≤ −4) ajoute Sonné ET Inconscient', () => {
    const r = rollCritical(victim(30), 'brasD', seq([83, 99])); // cible 50 ; 99 → DR −4
    expect(r.conditions.some((c) => c.name === 'Sonné')).toBe(true);
    expect(r.conditions.some((c) => c.name === 'Inconscient')).toBe(true);
  });

  it('Résistance réussie : le membre est quand même amputé (trauma chirurgical), sans À Terre du choc', () => {
    const r = rollCritical(victim(30), 'brasD', seq([83, 5])); // 5 ≤ 50 → réussite
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(true);
    expect(r.conditions.some((c) => c.name === 'À Terre')).toBe(false);
  });
});

describe('permanentAmputations — séquelles permanentes (LDB 18 l.335-370, tout le monde DROITIER)', () => {
  it('jambe : pied → Mouvement ÷2 + −20 Esquive ; orteil → −1 Ag/CC', () => {
    const [pied] = permanentAmputations('Pied sectionné', 'Amputation (Difficile).', 'jambeG');
    expect(pied.movementHalved).toBe(true);
    expect(pied.dodgePenalty).toBe(-20);
    const [orteil] = permanentAmputations("Coupure à l'orteil", "perte d'un orteil — Amputation (Accessible).", 'jambeD');
    expect(orteil.charPenalty).toEqual({ Ag: -1, CC: -1 });
  });
  it('bras DROIT (dominant) main : pas d’arme à 2 mains + −20 CC/CT ; bras GAUCHE : juste pas de 2 mains', () => {
    const [mainD] = permanentAmputations('Main mutilée', 'Perte de la main — Amputation (Difficile).', 'brasD');
    expect(mainD.noTwoHanded).toBe(true);
    expect(mainD.charPenalty).toEqual({ CC: -20, CT: -20 });
    const [mainG] = permanentAmputations('Main mutilée', 'Perte de la main — Amputation (Difficile).', 'brasG');
    expect(mainG.noTwoHanded).toBe(true);
    expect(mainG.charPenalty).toBeUndefined();
  });
  it('bras : « Main ouverte » (perte d’un DOIGT) → doigt −5 CC/CT (droitier), pas la règle de la main', () => {
    const [doigt] = permanentAmputations('Main ouverte', 'Perdez 1 doigt — Amputation (Complexe).', 'brasD');
    expect(doigt.label).toMatch(/Doigt/);
    expect(doigt.charPenalty).toEqual({ CC: -5, CT: -5 });
    expect(doigt.noTwoHanded).toBeFalsy();
  });
  it('tête : « Coup défigurant » cumule œil (−5 Soc) + nez (−20 Soc)', () => {
    const s = permanentAmputations('Coup défigurant', "Perte d'un œil et du nez — Amputation (Difficile).", 'tete');
    expect(s.map((x) => x.label).sort()).toEqual(['Nez amputé', 'Œil perdu']);
    expect(s.find((x) => x.label === 'Nez amputé')!.charPenalty).toEqual({ Soc: -20 });
  });
  it('tête : « Mâchoire mutilée » cumule langue (parole échoue) + dents (−2 Soc)', () => {
    const s = permanentAmputations('Mâchoire mutilée', 'perte de la langue et 1d10 dents — Amputation (Difficile).', 'tete');
    expect(s.find((x) => x.label === 'Langue amputée')!.skillPenalty).toEqual({ langue: -100 });
    expect(s.find((x) => x.label === 'Dents perdues')!.charPenalty).toEqual({ Soc: -2 });
  });

  it('rollCritical (jambe) : pose la plaie chirurgicale ET la séquelle permanente de mobilité', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([95, 5])); // « Pied sectionné » (94-96), Résistance réussie
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(true);
    expect(r.traumas.some((t) => t.movementHalved && !t.needsSurgery)).toBe(true);
  });

  it('la séquelle permanente survit à la Chirurgie (le membre reste absent)', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([95, 5]));
    const c = victim(30);
    c.traumas = r.traumas;
    c.criticalWounds = 1;
    removeSurgicalTrauma(c); // opère la plaie chirurgicale
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(false); // plaie réparée
    expect(c.traumas!.some((t) => t.movementHalved)).toBe(true); // mobilité réduite à VIE
  });
});

describe('critLocationRoll — localisation d’un Coup Critique (1d100 direct, p.159)', () => {
  it('retourne une HitLocation valide', () => {
    const loc = critLocationRoll(makeRNG(3));
    expect(['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD']).toContain(loc);
  });
  it('respecte la forme du corps (Localisations Alternatives p.312)', () => {
    // serpent : seulement Tête / Corps ; araignée : seulement Tête / Pattes(jambeD) / Abdomen(corps)
    for (let s = 1; s <= 40; s++) {
      expect(['tete', 'corps']).toContain(critLocationRoll(makeRNG(s), 'serpent'));
      expect(['tete', 'jambeD', 'corps']).toContain(critLocationRoll(makeRNG(s), 'araignee'));
    }
  });
});
