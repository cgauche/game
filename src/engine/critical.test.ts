import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import type { RNG } from './dice';
import { rollCritical, critLocationRoll, permanentAmputations } from './critical';
import { removeSurgicalTrauma } from './trauma';
import { CRITICAL_TABLES } from '../data/criticals';
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
  it("retourne une entrée de la table de la localisation, avec des ops d'effet immédiat", () => {
    const r = rollCritical(victim(), 'tete', makeRNG(1));
    expect(r.location).toBe('tete');
    expect(typeof r.name).toBe('string');
    expect(Array.isArray(r.ops)).toBe(true); // PB + États exprimés en GameOp, appliqués par applyOps
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
        expect(frac.ops).toContainEqual({ op: 'charMod', char: 'F', mod: -30 });
        expect(frac.ops).toContainEqual({ op: 'charMod', char: 'Ag', mod: -30 });
        return;
      }
    }
    throw new Error('aucune Fracture trouvée sur 60 seeds');
  });
});

describe('amputation déclarée STRUCTURELLEMENT (criticals.json, plus de regex)', () => {
  it('chaque entrée d’amputation porte `amputation.{difficulty,sequels}` non vide', () => {
    let count = 0;
    for (const loc of ['tete', 'brasD', 'jambeD'] as const) {
      for (const e of CRITICAL_TABLES[loc]) {
        if (e.amputation) {
          count++;
          expect(e.amputation.difficulty).toBeTruthy();
          expect(Array.isArray(e.amputation.sequels)).toBe(true);
          expect(e.amputation.sequels.length).toBeGreaterThan(0);
        }
      }
    }
    expect(count).toBeGreaterThan(0); // au moins une amputation existe (Doigt sectionné, etc.)
  });
});

describe('rollCritical — amputation (LDB 18 l.328-333)', () => {
  // « Doigt sectionné » (BRAS 81-85) : note « Amputation (Accessible) », sans entry.resist ni fracture →
  // exactement 2 jets (d100 du critique, puis d100 du Test de Résistance d'amputation).
  it('crée un trauma chirurgical (needsSurgery) et inflige À Terre sur Résistance ratée', () => {
    const r = rollCritical(victim(30), 'brasD', seq([83, 60])); // E30 → Accessible cible 50 ; 60 > 50 → échec (DR −1)
    expect(r.traumas.some((t) => t.needsSurgery && t.label.startsWith('Amputation'))).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'inconscient')).toBe(false); // DR −1 : pas d'Inconscient
  });

  it('échec catastrophique (DR ≤ −4) ajoute Sonné ET Inconscient', () => {
    const r = rollCritical(victim(30), 'brasD', seq([83, 99])); // cible 50 ; 99 → DR −4
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'sonne')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'inconscient')).toBe(true);
  });

  it('Résistance réussie : le membre est quand même amputé (trauma chirurgical), sans À Terre du choc', () => {
    const r = rollCritical(victim(30), 'brasD', seq([83, 5])); // 5 ≤ 50 → réussite
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(false);
  });
});

describe('permanentAmputations — séquelles permanentes par id de fiche (LDB 18 l.335-370, DROITIER)', () => {
  it('jambe : pied (membre-inferieur-ampute) → Mouvement ÷2 + −20 Esquive ; orteil → −1 Ag/CC', () => {
    const [pied] = permanentAmputations(['membre-inferieur-ampute'], 'jambeG');
    expect(pied.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(pied.ops).toContainEqual({ op: 'skillMod', skill: 'esquive', mod: -20 });
    const [orteil] = permanentAmputations(['orteil-ampute'], 'jambeD');
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'Ag', mod: -1 });
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'CC', mod: -1 });
  });
  it('bras DROIT (dominant) main : pas d’arme à 2 mains + −20 CC/CT ; bras GAUCHE : juste pas de 2 mains', () => {
    const [mainD] = permanentAmputations(['main-bras-ampute'], 'brasD');
    expect(mainD.ops?.some((o) => o.op === 'maxWeaponHands')).toBe(true);
    expect(mainD.ops).toContainEqual({ op: 'charMod', char: 'CC', mod: -20 });
    expect(mainD.ops).toContainEqual({ op: 'charMod', char: 'CT', mod: -20 });
    const [mainG] = permanentAmputations(['main-bras-ampute'], 'brasG');
    expect(mainG.ops?.some((o) => o.op === 'maxWeaponHands')).toBe(true);
    expect(mainG.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
  });
  it('bras : doigt (perte d’UN doigt) → doigt −5 CC/CT (droitier), pas la règle de la main', () => {
    const [doigt] = permanentAmputations(['doigt-ampute'], 'brasD');
    expect(doigt.traumaId).toBe('doigt-ampute');
    expect(doigt.count).toBe(1);
    expect(doigt.ops).toContainEqual({ op: 'charMod', char: 'CC', mod: -5 });
    expect(doigt.ops).toContainEqual({ op: 'charMod', char: 'CT', mod: -5 });
    expect(doigt.ops?.some((o) => o.op === 'maxWeaponHands')).toBeFalsy();
  });
  it('tête : « Coup défigurant » cumule œil (−5 Soc) + nez (−20 Soc)', () => {
    const s = permanentAmputations(['nez-ampute', 'oeil-perdu'], 'tete');
    expect(s.map((x) => x.label).sort()).toEqual(['Nez amputé', 'Œil perdu']);
    expect(s.find((x) => x.label === 'Nez amputé')!.ops).toContainEqual({ op: 'charMod', char: 'Soc', mod: -20 });
  });
  it('tête : « Mâchoire mutilée » cumule langue (parole échoue) + dents (1d10=4 → 2 paires → −2 Soc)', () => {
    const s = permanentAmputations(['langue-amputee', 'dents-perdues'], 'tete', seq([4]));
    expect(s.find((x) => x.label === 'Langue amputée')!.ops).toContainEqual({ op: 'skillMod', skill: 'langue', mod: -100 });
    const dents = s.find((x) => x.traumaId === 'dents-perdues')!;
    expect(dents.count).toBe(4);
    expect(dents.ops).toContainEqual({ op: 'charMod', char: 'Soc', mod: -2 }); // 4 dents = 2 paires
  });

  it('rollCritical (jambe) : pose la plaie chirurgicale ET la séquelle permanente de mobilité', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([95, 5])); // « Pied sectionné » (94-96), Résistance réussie
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(true);
    expect(r.traumas.some((t) => t.ops?.some((o) => o.op === 'moveScale') && !t.needsSurgery)).toBe(true);
  });

  it('la séquelle permanente survit à la Chirurgie (le membre reste absent)', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([95, 5]));
    const c = victim(30);
    c.traumas = r.traumas;
    c.criticalWounds = 1;
    removeSurgicalTrauma(c); // opère la plaie chirurgicale
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(false); // plaie réparée
    expect(c.traumas!.some((t) => t.ops?.some((o) => o.op === 'moveScale'))).toBe(true); // mobilité réduite à VIE
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
