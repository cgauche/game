import { describe, it, expect } from 'vitest';
import { makeRNG } from './dice';
import type { RNG } from './dice';
import { rollCritical, critLocationRoll, critWoundLocation, permanentAmputations, resolvePostEncounterAmputations } from './critical';
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
  it('bras (DROIT ou GAUCHE) main amputée : interdit d’arme à 2 mains, AUCUN charMod (−20 = contextuel à l’arme, #101 LDB 18 l.263)', () => {
    for (const loc of ['brasD', 'brasG'] as const) {
      const [main] = permanentAmputations(['main-bras-ampute'], loc);
      expect(main.ops?.some((o) => o.op === 'maxWeaponHands')).toBe(true);
      expect(main.ops?.some((o) => o.op === 'charMod')).toBeFalsy(); // la pénalité −20 est portée par amputationCombatPenalty
    }
  });
  it('bras : doigt (perte d’UN doigt) → count 1, AUCUN charMod (−5/doigt = contextuel à l’arme, #101 LDB 18 l.251), pas la règle de la main', () => {
    const [doigt] = permanentAmputations(['doigt-ampute'], 'brasD');
    expect(doigt.traumaId).toBe('doigt-ampute');
    expect(doigt.count).toBe(1);
    expect(doigt.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
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

describe('#195 — variantes d’amputation de la table JAMBE (LDB 18)', () => {
  // « Orteil contusionné » (01-10) : Résistance Accessible (+20) ou −10 Ag « jusqu'à la fin du prochain tour »
  // → durationRounds: 2 (arbitrage maison tagué). E30 → cible 50.
  it('Orteil contusionné : Résistance ratée → charMod Ag −10 à durée 2 Rounds (arbitrage maison)', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([5, 60])); // 5 = crit ; 60 > 50 → Résistance ratée
    expect(r.ops).toContainEqual({ op: 'charMod', char: 'Ag', mod: -10, durationRounds: 2 });
  });
  it('Orteil contusionné : Résistance réussie → aucune pénalité d’Agilité', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([5, 40])); // 40 ≤ 50 → réussite
    expect(r.ops.some((o) => o.op === 'charMod')).toBe(false);
  });
  it('l’entrée porte une note maison traçant la valeur `durationRounds` (règle stricte 7)', () => {
    const e = CRITICAL_TABLES.jambeD.find((x) => x.id === 'orteil-contusionne')!;
    expect(e.maison).toBeTruthy();
    expect(e.resist?.onFail?.[0]).toMatchObject({ op: 'charMod', char: 'Ag', mod: -10, durationRounds: 2 });
  });

  // « Tendon rompu » (71-75) : « Votre jambe devient inutilisable (voir Membres Amputés) » = disable DIRECT,
  // sans Test ni Difficulté d'amputation → séquelle permanente `membre-inferieur-ampute`, PAS de plaie chirurgicale.
  it('Tendon rompu : pose la séquelle permanente « membre inférieur amputé » SANS plaie chirurgicale ni test d’amputation', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([72, 40])); // 72 = crit ; 40 = Résistance (Difficile) de la ligne
    const disable = r.traumas.find((t) => t.traumaId === 'membre-inferieur-ampute')!;
    expect(disable).toBeTruthy();
    expect(disable.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(disable.ops).toContainEqual({ op: 'skillMod', skill: 'esquive', mod: -20 });
    expect(disable.needsSurgery).toBeFalsy(); // pas une amputation chirurgicale : membre inutilisable
    expect(r.traumas.some((t) => t.needsSurgery && t.label === 'Amputation')).toBe(false);
    expect(r.traumas.some((t) => t.label.startsWith('Déchirure'))).toBe(true); // + Déchirure musculaire (Majeur)
  });

  // « Pied écrasé » (91-93) : un Test Accessible (+20) ; échec → perte d’1 orteil + 1 par DR en dessous de 0,
  // ET le pied reste une plaie chirurgicale (perte du pied sans Chirurgie sous 1d10 jours).
  it('Pied écrasé : échec à −2 DR → 3 orteils perdus (charMod Ag/CC −3), À Terre + Sonné, plaie à échéance', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([92, 70, 5])); // 92 crit ; 70 vs cible 50 → DR −2 ; 5 = 1d10 échéance
    const orteil = r.traumas.find((t) => t.traumaId === 'orteil-ampute')!;
    expect(orteil.count).toBe(3); // 1 + 2 DR
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'Ag', mod: -3 });
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'CC', mod: -3 });
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'sonne')).toBe(true);
    const plaie = r.traumas.find((t) => t.needsSurgery && t.label === 'Amputation')!;
    expect(plaie.amputateAfterDays).toBe(5);
    expect(plaie.amputateSequel).toBe('membre-inferieur-ampute');
  });
  it('Pied écrasé : Test réussi → aucun orteil perdu, mais le pied reste une plaie chirurgicale (perte sous 1d10 j)', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([92, 20, 7])); // 20 ≤ 50 → réussite ; 7 = 1d10 échéance
    expect(r.traumas.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
    expect(r.ops.some((o) => o.op === 'condition' && (o.name === 'a-terre' || o.name === 'sonne'))).toBe(false); // pas d'États d'amputation (les 2 Hémorragique de base restent)
    const plaie = r.traumas.find((t) => t.needsSurgery && t.label === 'Amputation')!;
    expect(plaie.amputateAfterDays).toBe(7);
    expect(plaie.amputateSequel).toBe('membre-inferieur-ampute');
  });

  // « Coupure à l'orteil » (46-50) : « Une fois la rencontre terminée… » → jet DIFFÉRÉ (timing postEncounter).
  it('Coupure à l’orteil : pose un marqueur pendingAmputation, AUCUN jet ni amputation immédiate', () => {
    const r = rollCritical(victim(30), 'jambeD', seq([48])); // un seul int (le jet du critique) : rien d'autre ne tire
    expect(r.traumas.some((t) => t.pendingAmputation)).toBe(true);
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(false);
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(false);
    expect(r.ops.some((o) => o.op === 'condition' && o.name === 'hemorragique')).toBe(true); // effet immédiat conservé
  });
  it('Coupure à l’orteil : résolution post-rencontre — gate Intermédiaire raté → orteil amputé + plaie chirurgicale', () => {
    const c = victim(30);
    c.traumas = rollCritical(victim(30), 'jambeD', seq([48])).traumas; // le marqueur
    // gate Intermédiaire cible 30 : 55 > 30 → raté (orteil perdu) ; states Accessible cible 50 : 40 ≤ 50 → pas d'États.
    resolvePostEncounterAmputations(c, seq([55, 40]));
    expect(c.traumas!.some((t) => t.pendingAmputation)).toBe(false); // marqueur consommé
    expect(c.traumas!.some((t) => t.traumaId === 'orteil-ampute')).toBe(true);
    expect(c.traumas!.some((t) => t.needsSurgery && t.label === 'Amputation')).toBe(true);
  });
  it('Coupure à l’orteil : résolution post-rencontre — gate Intermédiaire réussi → aucun orteil, aucune plaie', () => {
    const c = victim(30);
    c.traumas = rollCritical(victim(30), 'jambeD', seq([48])).traumas;
    resolvePostEncounterAmputations(c, seq([10])); // 10 ≤ 30 → gate réussi : pas d'amputation du tout (states non tiré)
    expect(c.traumas!.some((t) => t.pendingAmputation)).toBe(false);
    expect(c.traumas!.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(false);
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

describe('critWoundLocation — règle UNIQUE de localisation du Coup Critique (LDB 18 l.53)', () => {
  it('sans override → 1d100 frais (= critLocationRoll au même seed)', () => {
    expect(critWoundLocation(makeRNG(3), 'humanoide')).toBe(critLocationRoll(makeRNG(3), 'humanoide'));
  });
  it('avec override (loc choisie / Critique pré-montré) → l’override, jamais le tirage', () => {
    expect(critWoundLocation(makeRNG(3), 'humanoide', 'tete')).toBe('tete');
    // forme du corps ignorée quand l’override est fourni (c’est une loc déjà résolue en amont).
    expect(critWoundLocation(makeRNG(7), 'serpent', 'jambeD')).toBe('jambeD');
  });
});
