import { describe, it, expect, afterEach } from 'vitest';
import { makeRNG } from './dice';
import type { RNG } from './dice';
import {
  resolveCritique, jeuDeCritique, critiqueTriviale, aaCriticalOffset, aaDeathByCriticalCount,
  critLocationRoll, critWoundLocation, permanentAmputations, resolvePostEncounterAmputations,
  critEntryCodexCategory, findCritEntrySuffered,
} from './critical';
import { removeSurgicalTrauma } from './trauma';
import { spellOps } from './flowCore';
import { setRule, resetRule } from './policy';
import { CRITIQUE_DOCS, critiqueTable, type JeuDeCritique } from '../data/criticals';
import locJson from '../data/localisation.json';
import type { Combatant, HitLocation } from './types';

/**
 * Blessures critiques par Localisation — UN lecteur, DEUX jeux (#1657 B2a, #1682) : le Livre de base
 * (« Traumatisme », LDB 18) et l'approche ALTERNATIVE d'Aux Armes (AA 07). Le corps de ce fichier est
 * PARAMÉTRÉ par `jeu` partout où la règle est la même — ce qui reste propre à chacun (le modificateur
 * de SÉVÉRITÉ du d100 et le libellé de journal) est nommé, et le reste est joué deux fois.
 */

/** RNG scripté : renvoie les valeurs dans l'ordre, bornées au domaine demandé. */
function seq(...values: number[]): RNG {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, values[i++])) };
}

const cible = (E = 30): Combatant =>
  ({
    id: 't', name: 'Cible', label: 'Cible', kind: 'enemy',
    characteristics: { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 0, max: 12 },
    conditions: [], skills: [], traumas: [], critEntriesSuffered: [], bodyShape: 'humanoide',
  }) as unknown as Combatant;

const LOCS: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];
const JEUX: JeuDeCritique[] = ['ldb', 'aa'];

// ---------------------------------------------------------------------------------------------
// CORPS PARAMÉTRÉ — ce que les deux jeux tiennent à l'identique.
// ---------------------------------------------------------------------------------------------
describe.each(JEUX)('resolveCritique (%s) — invariants partagés par les deux jeux', (jeu) => {
  it('résout une entrée de la table de la Localisation, avec ses ops d’effet immédiat', () => {
    const r = resolveCritique(jeu, cible(), 'tete', makeRNG(1));
    expect(r.location).toBe('tete');
    expect(typeof r.label).toBe('string');
    expect(Array.isArray(r.ops)).toBe(true); // PB + États en GameOp, appliqués par applyOps
    expect(critiqueTable(jeu, 'tete').some((e) => e.id === r.entryId)).toBe(true);
  });

  it('les traumatismes produits portent la Localisation du critique', () => {
    for (let s = 1; s <= 40; s++) {
      for (const t of resolveCritique(jeu, cible(), 'corps', makeRNG(s)).traumas) expect(t.location).toBe('corps');
    }
  });

  it('chaque `amputation` déclarée porte `{difficulty, sequels}` non vide', () => {
    let count = 0;
    for (const doc of CRITIQUE_DOCS.filter((d) => d.jeu === jeu)) {
      for (const e of doc.entries) {
        if (!e.amputation) continue;
        count++;
        expect(e.amputation.difficulty).toBeTruthy();
        expect(Array.isArray(e.amputation.sequels)).toBe(true);
        expect(e.amputation.sequels.length).toBeGreaterThan(0);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  it('chaque nœud `test` porte sa Difficulté et une branche `fail` qui applique quelque chose', () => {
    let count = 0;
    for (const doc of CRITIQUE_DOCS.filter((d) => d.jeu === jeu)) {
      for (const e of doc.entries) {
        if (!e.test) continue;
        count++;
        expect(e.test.kind, `${e.id}`).toBe('test');
        expect(e.test.test.difficulty, `${e.id} : difficulté absente`).toBeTruthy();
        expect(spellOps(e.test.fail, 'target').length, `${e.id} : branche fail vide`).toBeGreaterThan(0);
      }
    }
    expect(count).toBeGreaterThan(0);
  });

  /**
   * Repli « Tableau des Bras » (LDB 76 l.21 : « Si un animal possède une Localisation sans Tableau de
   * Critiques, comme un tentacule, une queue ou une aile, faites un jet sur le Tableau des Bras et
   * décrivez le résultat de façon appropriée. ») — garde EXHAUSTIVE, la classe et pas les cas.
   */
  describe('critiqueTable — repli Tableau des Bras (LDB 76 l.21)', () => {
    const shapes = (locJson as { personnage: { shapes: Record<string, { loc: HitLocation }[]> } }).personnage.shapes;
    const producedLocs = new Set<HitLocation>();
    for (const entries of Object.values(shapes)) for (const e of entries) producedLocs.add(e.loc);

    it('localisation.json (humanoide/serpent/araignee) ne produit que des locs déjà couvertes', () => {
      expect(producedLocs.size).toBeGreaterThan(0);
      for (const loc of producedLocs) expect(critiqueTable(jeu, loc).length, `loc ${loc}`).toBeGreaterThan(0);
    });

    it('les 6 HitLocation résolvent sur une table DÉDIÉE (les deux côtés partagent la leur, aucun repli exercé)', () => {
      expect(critiqueTable(jeu, 'brasG')).toBe(critiqueTable(jeu, 'brasD'));
      expect(critiqueTable(jeu, 'jambeG')).toBe(critiqueTable(jeu, 'jambeD'));
      expect(critiqueTable(jeu, 'tete')).not.toBe(critiqueTable(jeu, 'brasD'));
      expect(critiqueTable(jeu, 'corps')).not.toBe(critiqueTable(jeu, 'brasD'));
      expect(critiqueTable(jeu, 'jambeG')).not.toBe(critiqueTable(jeu, 'brasD'));
      for (const loc of LOCS) expect(critiqueTable(jeu, loc).length).toBeGreaterThan(0);
    });

    it('une loc SANS table dédiée (tentacule/queue/aile future) retombe réellement sur la table des Bras', () => {
      const bras = critiqueTable(jeu, 'brasD');
      for (const exotic of ['tentacule', 'queue', 'aile'] as unknown as HitLocation[]) {
        expect(critiqueTable(jeu, exotic)).toBe(bras);
      }
    });
  });
});

// ---------------------------------------------------------------------------------------------
// CE QUI DIVERGE — la SÉVÉRITÉ et le LIBELLÉ de journal, et rien d'autre.
// ---------------------------------------------------------------------------------------------
describe('sévérité et journal — les deux seules divergences entre les jeux', () => {
  it('LDB 18 l.17 : overkill > Bonus d’Endurance → −20 sur le d100 (minimum 01)', () => {
    const a = resolveCritique('ldb', cible(35), 'corps', makeRNG(7), { overkill: 0 }); // BE(35) = 3
    const b = resolveCritique('ldb', cible(35), 'corps', makeRNG(7), { overkill: 10 }); // 10 > 3 → −20
    expect(b.roll).toBe(Math.max(1, a.roll - 20));
  });

  it('AA 07 l.36 : +10 par Blessure au-delà de 0 — et le décalage pousse jusqu’à la ligne LÉTALE plafond', () => {
    expect(aaCriticalOffset(0)).toBe(0);
    expect(aaCriticalOffset(8)).toBe(80); // exemple l.54
    // Torse, d100 40 + overkill 8 (+80) = 120 ≥ 116 → « Éventré » (Mort), AA 07 l.157.
    const r = resolveCritique('aa', cible(), 'corps', seq(40), { overkill: 8 });
    expect(r.roll).toBe(120);
    expect(r.label).toBe('Éventré');
    expect(r.lethal).toBe(true);
  });

  it('le journal nomme le jeu qui a résolu', () => {
    expect(resolveCritique('ldb', cible(), 'corps', seq(15)).log.startsWith('Blessure critique (')).toBe(true);
    expect(resolveCritique('aa', cible(), 'corps', seq(15)).log.startsWith('Blessure critique AA (')).toBe(true);
  });
});

describe('jeuDeCritique — la règle optionnelle choisit le jeu, `twice` reste au chemin LDB', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('défaut = LDB ; `combat-aa-blessures = aa` = Aux Armes ; Sauvagerie (`twice`) reste LDB', () => {
    expect(jeuDeCritique()).toBe('ldb');
    setRule('combat-aa-blessures', 'aa');
    expect(jeuDeCritique()).toBe('aa');
    expect(jeuDeCritique(true)).toBe('ldb'); // LDB 41 l.170 : l'Atout ne coexiste pas avec la variante
  });

  it('les deux jeux tirent des tables DIFFÉRENTES au même dé', () => {
    const aa = resolveCritique('aa', cible(), 'corps', seq(15));
    const ldb = resolveCritique('ldb', cible(), 'corps', seq(15));
    expect(aa.label).toBe("Rien qu'une égratignure !");
    expect(ldb.label).not.toBe(aa.label);
  });
});

// ---------------------------------------------------------------------------------------------
// LIVRE DE BASE — les lignes nommées (LDB 18).
// ---------------------------------------------------------------------------------------------
describe('Livre de base (LDB 18 « Traumatisme ») — lignes nommées', () => {
  it('le résultat 00 (létal) est mortel', () => {
    const r = resolveCritique('ldb', cible(), 'tete', makeRNG(1));
    if (r.roll === 100) expect(r.lethal).toBe(true);
  });

  it('la table Corps comporte des Fractures, qui réduisent Force et Agilité de 30', () => {
    for (let s = 1; s <= 60; s++) {
      const frac = resolveCritique('ldb', cible(), 'corps', makeRNG(s)).traumas.find((t) => t.label.startsWith('Fracture'));
      if (!frac) continue;
      expect(frac.ops).toContainEqual({ op: 'charMod', char: 'force', mod: -30 });
      expect(frac.ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -30 });
      return;
    }
    throw new Error('aucune Fracture trouvée sur 60 seeds');
  });

  // « Doigt sectionné » (BRAS 81-85) : « Amputation (Accessible) », sans nœud `test` ni fracture →
  // exactement 2 jets (d100 du critique, puis d100 du Test de Résistance d'amputation).
  it('Doigt sectionné : plaie chirurgicale + À Terre sur Résistance ratée', () => {
    const r = resolveCritique('ldb', cible(30), 'brasD', seq(83, 60)); // E30 → Accessible cible 50 ; 60 > 50 → échec (DR −1)
    expect(r.traumas.some((t) => t.needsSurgery && t.label.startsWith('Amputation'))).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'inconscient')).toBe(false); // DR −1 : pas d'Inconscient
  });

  it('Doigt sectionné : échec catastrophique (DR ≤ −4) ajoute Sonné ET Inconscient', () => {
    const r = resolveCritique('ldb', cible(30), 'brasD', seq(83, 99)); // cible 50 ; 99 → DR −4
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'sonne')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'inconscient')).toBe(true);
  });

  it('Doigt sectionné : Résistance réussie → membre amputé quand même, sans À Terre du choc', () => {
    const r = resolveCritique('ldb', cible(30), 'brasD', seq(83, 5)); // 5 ≤ 50 → réussite
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(false);
  });

  it('« Bouche explosée » : le 1d10 de la LIGNE (`unites`) pilote le comptage de bout en bout', () => {
    // d100=83 → « Bouche explosée » (81-85) ; puis le Test de Résistance de l'Amputation ; puis le 1d10
    // des dents DÉCLARÉ par la ligne (`amputation.unites`).
    const r = resolveCritique('ldb', cible(30), 'tete', seq(83, 5, 7));
    const dents = r.traumas.find((t) => t.traumaId === 'dents-perdues')!;
    expect(dents.count).toBe(7);
    expect(dents.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -3 }); // 7 dents = 3 paires
  });

  it('rollCritique (jambe) : pose la plaie chirurgicale ET la séquelle permanente de mobilité', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(95, 5)); // « Pied sectionné » (94-96), Résistance réussie
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(true);
    expect(r.traumas.some((t) => t.ops?.some((o) => o.op === 'moveScale') && !t.needsSurgery)).toBe(true);
  });

  it('la séquelle permanente survit à la Chirurgie (le membre reste absent)', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(95, 5));
    const c = cible(30);
    c.traumas = r.traumas;
    c.criticalWounds = 1;
    removeSurgicalTrauma(c); // opère la plaie chirurgicale
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(false); // plaie réparée
    expect(c.traumas!.some((t) => t.ops?.some((o) => o.op === 'moveScale'))).toBe(true); // mobilité réduite à VIE
  });

  // #195 — variantes de la table JAMBE.
  it('Orteil contusionné : le nœud de la rangée part en `testFlow` (Résistance) — la pénalité d’Agilité est sa branche `fail`', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(5)); // 5 = crit « Orteil contusionné »
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(n.kind).toBe('test');
    expect(n.test.skill).toEqual({ id: 'resistance' }); // LDB 18 l.164 : « Test de Résistance » (la COMPÉTENCE)
    expect(spellOps(n.fail, 'target')).toContainEqual({ op: 'charMod', char: 'agilite', mod: -10, durationRounds: 2 });
    expect(spellOps(n.success, 'target')).toEqual([]); // Test réussi : aucune pénalité
    expect(r.ops.some((o) => o.op === 'charMod')).toBe(false); // l'issue vient de la porte, pas du moteur
  });
  it('l’entrée porte une note maison traçant la valeur `durationRounds` (règle stricte 7)', () => {
    const e = critiqueTable('ldb', 'jambeD').find((x) => x.id === 'orteil-contusionne')!;
    expect(e.maison).toBeTruthy();
    expect(spellOps(e.test!.fail, 'target')[0]).toMatchObject({ op: 'charMod', char: 'agilite', mod: -10, durationRounds: 2 });
  });

  // « Tendon rompu » (71-75) : « Votre jambe devient inutilisable (voir Membres Amputés) » = disable DIRECT,
  // sans Test ni Difficulté d'amputation → séquelle permanente `membre-inferieur-ampute`, PAS de plaie chirurgicale.
  it('Tendon rompu : séquelle permanente « membre inférieur amputé » SANS plaie chirurgicale ni test d’amputation', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(72, 40)); // 72 = crit ; 40 = le nœud `test` (Difficile) de la ligne
    const disable = r.traumas.find((t) => t.traumaId === 'membre-inferieur-ampute')!;
    expect(disable).toBeTruthy();
    expect(disable.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(disable.ops).toContainEqual({ op: 'skillMod', skill: { id: 'esquive' }, mod: -20 });
    expect(disable.needsSurgery).toBeFalsy(); // pas une amputation chirurgicale : membre inutilisable
    expect(r.traumas.some((t) => t.needsSurgery && t.label === 'Amputation')).toBe(false);
    expect(r.traumas.some((t) => t.label.startsWith('Déchirure'))).toBe(true); // + Déchirure musculaire (Majeur)
  });

  // « Pied écrasé » (91-93) : un Test Accessible (+20) ; échec → perte d'1 orteil + 1 par DR en dessous de 0,
  // ET le pied reste une plaie chirurgicale (perte du pied sans Chirurgie sous 1d10 jours).
  it('Pied écrasé : échec à −2 DR → 3 orteils perdus, À Terre + Sonné, plaie à échéance', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(92, 70, 5)); // 92 crit ; 70 vs cible 50 → DR −2 ; 5 = 1d10 échéance
    const orteil = r.traumas.find((t) => t.traumaId === 'orteil-ampute')!;
    expect(orteil.count).toBe(3); // 1 + 2 DR
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -3 });
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'capacite-de-combat', mod: -3 });
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'sonne')).toBe(true);
    const plaie = r.traumas.find((t) => t.needsSurgery && t.label === 'Amputation')!;
    expect(plaie.amputateAfterDays).toBe(5);
    expect(plaie.amputateSequel).toBe('membre-inferieur-ampute');
  });
  it('Pied écrasé : Test réussi → aucun orteil perdu, mais le pied reste une plaie chirurgicale', () => {
    const r = resolveCritique('ldb', cible(30), 'jambeD', seq(92, 20, 7)); // 20 ≤ 50 → réussite ; 7 = 1d10 échéance
    expect(r.traumas.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
    expect(r.ops.some((o) => o.op === 'condition' && (o.id === 'a-terre' || o.id === 'sonne'))).toBe(false);
    const plaie = r.traumas.find((t) => t.needsSurgery && t.label === 'Amputation')!;
    expect(plaie.amputateAfterDays).toBe(7);
    expect(plaie.amputateSequel).toBe('membre-inferieur-ampute');
  });
});

// ---------------------------------------------------------------------------------------------
// AUX ARMES — les lignes nommées (AA 07).
// ---------------------------------------------------------------------------------------------
describe('Aux Armes (AA 07, approche alternative) — lignes nommées', () => {
  it('la colonne « Blessures » (l.40) est une op `wounds` EN TÊTE, suivie des États immédiats', () => {
    // Torse, d100 15 → « Rien qu'une égratignure ! » (11-20) : Blessures 1 + 1 État Hémorragique.
    const r = resolveCritique('aa', cible(), 'corps', seq(15));
    expect(r.label).toBe("Rien qu'une égratignure !");
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }, { op: 'condition', id: 'hemorragique', value: 1 }]);
    expect(r.lethal).toBe(false);
  });

  it('nœud `test` de la rangée : RENDU par `testFlow`, jamais roulé — sa branche `fail` porte l’À Terre (l.140)', () => {
    // Torse 21-25 « Coup au ventre » : 1 Sonné + Résistance Facile (+40) sous peine À Terre.
    const r = resolveCritique('aa', cible(), 'corps', seq(22));
    expect(r.label).toBe('Coup au ventre');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }, { op: 'condition', id: 'sonne', value: 1 }]);
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(n.test.difficulty).toBe('facile');
    expect(spellOps(n.fail, 'target')).toEqual([{ op: 'condition', id: 'a-terre', value: 1 }]);
  });

  it('lignes triviales « T » (l.79) DÉRIVÉES — non létales et sans perte de Blessure', () => {
    expect(critiqueTriviale('aa', 'brasD', 5)).toBe(true);   // 01-10 « Choc au poignet » = T
    expect(critiqueTriviale('aa', 'brasD', 25)).toBe(false); // 21-25 « Coupure mineure » = 1 Blessure
    // Une ligne LÉTALE ne perd aucune Blessure (« Mort » n'a pas de colonne) et n'est POURTANT pas
    // triviale : la clause `!lethal` de la dérivation porte tout le poids ici. Sans elle, une mort
    // n'incrémenterait plus `criticalWounds` (AA 07 l.73 : le compte qui tue).
    for (const doc of CRITIQUE_DOCS) {
      for (const e of doc.entries) {
        if (!e.lethal) continue;
        expect((e.ops ?? []).some((o) => o.op === 'wounds'), `${e.id} : une létale sans op wounds`).toBe(false);
        expect(critiqueTriviale(doc.jeu, doc.localisation === 'bras' ? 'brasD' : doc.localisation === 'jambe' ? 'jambeD' : doc.localisation, e.min), `${e.id} : la mort est comptée triviale`).toBe(false);
      }
    }
  });

  it('les 6 rangées triviales sont EXACTEMENT celles qui ne perdent aucune Blessure (bijection re-mesurée)', () => {
    const triviales = CRITIQUE_DOCS.flatMap((d) => d.entries.filter((e) => !e.lethal && !(e.ops ?? []).some((o) => o.op === 'wounds')).map((e) => e.id));
    expect(triviales.sort()).toEqual(['aa-bras-01', 'aa-bras-11', 'aa-corps-01', 'aa-jambe-01', 'aa-jambe-11', 'aa-tete-01']);
  });

  it('mort par accumulation de Blessures Critiques (l.73)', () => {
    expect(aaDeathByCriticalCount(true, 0, 3, 2)).toBe(true);   // Inconscient + 0 PB + 3 > BE 2
    expect(aaDeathByCriticalCount(false, 0, 3, 2)).toBe(false); // pas Inconscient
    expect(aaDeathByCriticalCount(true, 4, 3, 2)).toBe(false);  // PB > 0
    expect(aaDeathByCriticalCount(true, 0, 2, 2)).toBe(false);  // 2 n'est pas > 2
  });

  // #125 / #153 — sous-effets RÉCURRENTS/chiffrés STRUCTURÉS (GameOp à durée, op `disarm`).
  it('« Choc au bras » (bras 11-20, l.113) : lâche l’objet + main inutilisable 1d10−BE Rounds', () => {
    const r = resolveCritique('aa', cible(), 'brasG', seq(15));
    expect(r.label).toBe('Choc au bras');
    expect(r.ops).toEqual([
      { op: 'disarm' },
      {
        op: 'maxWeaponHands', hands: 1,
        durationRounds: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] },
      },
    ]);
  });

  it('« Clef de bras » (bras 51-55, l.118) : lâche l’objet + bras inutilisable 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'brasG', seq(53));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2, ignoreTB: true, ignoreAP: true }, { op: 'disarm' }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Clavicule tordue » (corps 41-45, l.144) : lâche l’objet + bras inutilisable 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'corps', seq(43));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2, ignoreTB: true, ignoreAP: true }, { op: 'disarm' }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Cheville tordue » (jambe 21-25, l.166) : −10 Ag pendant 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(23));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1, ignoreTB: true, ignoreAP: true }, { op: 'charMod', char: 'agilite', mod: -10, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Genou tordu » (jambe 51-55, l.170) : −20 Ag pendant 1d10 Rounds', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(53));
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2, ignoreTB: true, ignoreAP: true }, { op: 'charMod', char: 'agilite', mod: -20, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Orteil contusionné » (jambe 01-10, l.164) : la branche `fail` du nœud rendu porte −10 Ag 1 Round', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(5));
    expect(r.label).toBe('Orteil contusionné');
    expect(r.ops).toEqual([]); // aucun effet immédiat : tout tient au Test
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(spellOps(n.fail, 'target')).toEqual([{ op: 'charMod', char: 'agilite', mod: -10, durationRounds: 1 }]);
  });

  it('« Perte d’équilibre » (jambe 11-20, l.165) : le nœud teste l’ATHLÉTISME, pas la Résistance', () => {
    const r = resolveCritique('aa', cible(), 'jambeG', seq(15));
    expect(r.label).toBe("Perte d'équilibre");
    const n = r.testFlow as Extract<typeof r.testFlow, { kind: 'test' }>;
    expect(n.test.skill).toEqual({ id: 'athletisme' }); // AA 07 l.165
    expect(spellOps(n.fail, 'target')).toEqual([{ op: 'condition', id: 'a-terre', value: 1 }]);
    expect(critiqueTable('aa', 'jambeG').find((e) => e.id === 'aa-jambe-11')!.test!.test.skill).toEqual({ id: 'athletisme' });
  });

  // #153 — Amputation AA déclarée STRUCTURELLEMENT, même cascade que le chemin LDB.
  it('« Oreille mutilée » (tête 61-65, Accessible) : Résistance échouée → À Terre + séquelle permanente', () => {
    const r = resolveCritique('aa', cible(), 'tete', seq(63, 60)); // cible 50 ; 60 > 50 → échec (DR −1)
    expect(r.label).toBe('Oreille mutilée');
    expect(r.traumas.some((t) => t.needsSurgery && t.label.startsWith('Amputation'))).toBe(true);
    expect(r.traumas.some((t) => t.traumaId === 'oreille-perdue')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'sonne')).toBe(false);
  });

  it('« Oreille mutilée » : Résistance RÉUSSIE → séquelle quand même, sans À Terre du choc', () => {
    const r = resolveCritique('aa', cible(), 'tete', seq(63, 5));
    expect(r.traumas.some((t) => t.traumaId === 'oreille-perdue')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(false);
  });

  it('« Oreille mutilée » : échec catastrophique (DR ≤ −4) ajoute Sonné ET Inconscient', () => {
    const r = resolveCritique('aa', cible(), 'tete', seq(63, 99));
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'sonne')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'inconscient')).toBe(true);
  });

  it('« Coup défigurant » (tête 86-94, Difficile) cumule 2 séquelles (œil + nez)', () => {
    const r = resolveCritique('aa', cible(), 'tete', seq(90, 5)); // Difficile = E30−20 = 10 ; 5 ≤ 10 → réussite
    expect(r.label).toBe('Coup défigurant');
    expect(r.traumas.some((t) => t.traumaId === 'oeil-perdu')).toBe(true);
    expect(r.traumas.some((t) => t.traumaId === 'nez-ampute')).toBe(true);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(false);
  });

  it('« Pied écrasé » (jambe 106-115, l.180) : `loss.perDR` → orteils gradués par DR sur ÉCHEC', () => {
    // overkill 6 → +60 : d100 50 → roll 110. Test Accessible (E30+20=50) : 75 → DR −2 → 1+2 = 3 orteils.
    const r = resolveCritique('aa', cible(), 'jambeD', seq(50, 75), { overkill: 6 });
    expect(r.label).toBe('Pied écrasé');
    expect(r.traumas.find((t) => t.traumaId === 'orteil-ampute')!.count).toBe(3);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(true);
  });

  it('« Pied écrasé » : Test Accessible RÉUSSI → aucun orteil (le `loss` gate LUI-MÊME la perte)', () => {
    const r = resolveCritique('aa', cible(), 'jambeD', seq(50, 10), { overkill: 6 });
    expect(r.traumas.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
    expect(r.ops.some((o) => o.op === 'condition' && o.id === 'a-terre')).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// AMPUTATION DIFFÉRÉE — même patron pour les deux jeux (« Une fois la rencontre terminée… »).
// ---------------------------------------------------------------------------------------------
describe.each([
  { jeu: 'ldb' as JeuDeCritique, roll: 48, label: "Coupure à l'orteil" },
  { jeu: 'aa' as JeuDeCritique, roll: 58, label: "Coupure à l'orteil" },
])('amputation DIFFÉRÉE ($jeu) — « Une fois la rencontre terminée… » (l.171)', ({ jeu, roll, label }) => {
  it('pose un marqueur `pendingAmputation`, AUCUN jet ni amputation immédiate', () => {
    const r = resolveCritique(jeu, cible(30), 'jambeD', seq(roll)); // un seul dé : rien d'autre ne tire
    expect(r.label).toBe(label);
    expect(r.traumas.some((t) => t.pendingAmputation)).toBe(true);
    expect(r.traumas.some((t) => t.needsSurgery)).toBe(false);
    expect(r.traumas.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
    expect(r.ops.some((o) => o.op === 'condition' && (o.id === 'a-terre' || o.id === 'sonne'))).toBe(false);
  });

  it('résolution post-rencontre : gate Intermédiaire RATÉ → orteil amputé + plaie chirurgicale', () => {
    const c = cible(30);
    c.traumas = resolveCritique(jeu, cible(30), 'jambeD', seq(roll)).traumas;
    // gate Intermédiaire cible 30 : 55 > 30 → raté ; États Accessible cible 50 : 40 ≤ 50 → pas d'États.
    resolvePostEncounterAmputations(c, seq(55, 40));
    expect(c.traumas!.some((t) => t.pendingAmputation)).toBe(false); // marqueur consommé
    expect(c.traumas!.some((t) => t.traumaId === 'orteil-ampute')).toBe(true);
    expect(c.traumas!.some((t) => t.needsSurgery && t.label === 'Amputation')).toBe(true);
  });

  it('résolution post-rencontre : gate Intermédiaire RÉUSSI → aucun orteil, aucune plaie', () => {
    const c = cible(30);
    c.traumas = resolveCritique(jeu, cible(30), 'jambeD', seq(roll)).traumas;
    resolvePostEncounterAmputations(c, seq(10)); // 10 ≤ 30 → gate réussi : pas d'amputation du tout
    expect(c.traumas!.some((t) => t.pendingAmputation)).toBe(false);
    expect(c.traumas!.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
    expect(c.traumas!.some((t) => t.needsSurgery)).toBe(false);
  });
});

// ---------------------------------------------------------------------------------------------
// SÉQUELLES PERMANENTES et LECTURE d'un id subi.
// ---------------------------------------------------------------------------------------------
describe('permanentAmputations — séquelles permanentes par id de fiche (LDB 18 l.233-285, DROITIER)', () => {
  it('jambe : pied (membre-inferieur-ampute) → Mouvement ÷2 + −20 Esquive ; orteil → −1 Ag/CC', () => {
    const [pied] = permanentAmputations(['membre-inferieur-ampute'], 'jambeG');
    expect(pied.ops?.some((o) => o.op === 'moveScale')).toBe(true);
    expect(pied.ops).toContainEqual({ op: 'skillMod', skill: { id: 'esquive' }, mod: -20 });
    const [orteil] = permanentAmputations(['orteil-ampute'], 'jambeD');
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'agilite', mod: -1 });
    expect(orteil.ops).toContainEqual({ op: 'charMod', char: 'capacite-de-combat', mod: -1 });
  });
  it('bras (DROIT ou GAUCHE) main amputée : interdit d’arme à 2 mains, AUCUN charMod (#101 LDB 18 l.263)', () => {
    for (const loc of ['brasD', 'brasG'] as const) {
      const [main] = permanentAmputations(['main-bras-ampute'], loc);
      expect(main.ops?.some((o) => o.op === 'maxWeaponHands')).toBe(true);
      expect(main.ops?.some((o) => o.op === 'charMod')).toBeFalsy(); // la pénalité −20 est portée par amputationCombatPenalty
    }
  });
  it('bras : doigt (perte d’UN doigt) → count 1, AUCUN charMod (#101 LDB 18 l.251), pas la règle de la main', () => {
    const [doigt] = permanentAmputations(['doigt-ampute'], 'brasD');
    expect(doigt.traumaId).toBe('doigt-ampute');
    expect(doigt.count).toBe(1);
    expect(doigt.ops?.some((o) => o.op === 'charMod')).toBeFalsy();
    expect(doigt.ops?.some((o) => o.op === 'maxWeaponHands')).toBeFalsy();
  });
  it('tête : « Coup défigurant » cumule œil (−5 Soc) + nez (−20 Soc)', () => {
    const s = permanentAmputations(['nez-ampute', 'oeil-perdu'], 'tete');
    expect(s.map((x) => x.label).sort()).toEqual(['Nez amputé', 'Œil perdu']);
    expect(s.find((x) => x.label === 'Nez amputé')!.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -20 });
  });
  it('tête : « Mâchoire mutilée » — la LIGNE fait perdre 1d10 dents (`unites`), la langue n’est pas comptée', () => {
    const s = permanentAmputations(['langue-amputee', 'dents-perdues'], 'tete', 4);
    expect(s.find((x) => x.label === 'Langue amputée')!.ops).toContainEqual({ op: 'skillMod', skill: { id: 'langue' }, mod: -100 });
    expect(s.find((x) => x.label === 'Langue amputée')!.count).toBeUndefined(); // séquelle non cumulative
    const dents = s.find((x) => x.traumaId === 'dents-perdues')!;
    expect(dents.count).toBe(4);
    expect(dents.ops).toContainEqual({ op: 'charMod', char: 'sociabilite', mod: -2 }); // 4 dents = 2 paires
  });
  it('les 4 lignes qui font perdre des dents sont TOUTES en table Tête et déclarent leur quantité', () => {
    // Aucune ligne de Bras/Corps/Jambe n'octroie `dents-perdues` : le comptage vient de la LIGNE, pas
    // de la Localisation — la garde `location === 'tete'` de l'ancien moteur n'avait aucun cas à couvrir.
    const porteuses = CRITIQUE_DOCS.flatMap((d) =>
      d.entries.filter((e) => e.amputation?.sequels.includes('dents-perdues')).map((e) => ({ table: `${d.jeu}-${d.localisation}`, e })));
    expect(porteuses.map((p) => p.table).sort()).toEqual(['aa-tete', 'aa-tete', 'ldb-tete', 'ldb-tete']);
    expect(porteuses.every((p) => p.e.amputation!.unites != null)).toBe(true);
  });
});

describe('findCritEntrySuffered — UNE boucle sur les 8 documents (id subi → entrée + table + jeu)', () => {
  it('retrouve une entrée de CHAQUE document, avec sa table et son jeu', () => {
    for (const doc of CRITIQUE_DOCS) {
      const found = findCritEntrySuffered(doc.entries[0].id)!;
      expect(found, `${doc.id}`).toBeTruthy();
      expect(found.table).toBe(doc.localisation);
      expect(found.jeu).toBe(doc.jeu);
      expect(critEntryCodexCategory(found.table, found.jeu)).toBe(
        `${doc.jeu === 'aa' ? 'aaCriticals' : 'criticals'}${doc.localisation === 'tete' ? 'Tete' : doc.localisation === 'bras' ? 'Bras' : doc.localisation === 'corps' ? 'Corps' : 'Jambe'}`,
      );
    }
  });
  it('un id inconnu rend `undefined` (aucune levée : le Codex reste défensif)', () => {
    expect(findCritEntrySuffered('id-qui-n-existe-pas')).toBeUndefined();
  });
});

describe('critLocationRoll — localisation d’un Coup Critique (1d100 direct, p.159)', () => {
  it('retourne une HitLocation valide', () => {
    expect(LOCS).toContain(critLocationRoll(makeRNG(3)));
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
    // forme du corps ignorée quand l'override est fourni (c'est une loc déjà résolue en amont).
    expect(critWoundLocation(makeRNG(7), 'serpent', 'jambeD')).toBe('jambeD');
  });
});
