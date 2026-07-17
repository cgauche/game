import { describe, it, expect, afterEach } from 'vitest';
import { resolveAACritical, aaCriticalOffset, aaCriticalIsTrivial, aaDeathByCriticalCount, aaTableFor } from './aaCritical';
import { rollCritical, resolvePostEncounterAmputations } from './critical';
import { setRule, resetRule } from './policy';
import aaJson from '../data/aa-criticals.json';
import locJson from '../data/localisation.json';
import type { Combatant, HitLocation } from './types';
import type { RNG } from './dice';

const seq = (...vals: number[]): RNG => {
  let i = 0;
  return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
};

const CHARS = { 'capacite-de-combat': 40, 'capacite-de-tir': 40, force: 40, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const target = (): Combatant =>
  ({ id: 't', name: 'Cible', kind: 'enemy', characteristics: CHARS, wounds: { current: 10, max: 10 }, conditions: [], skills: [], bodyShape: 'humanoide' } as unknown as Combatant);

describe('#38 — Système ALTERNATIF de Blessures Critiques (Aux Armes)', () => {
  afterEach(() => resetRule('combat-aa-blessures'));

  it('décalage +10 par Blessure au-delà de 0 (l.2480)', () => {
    expect(aaCriticalOffset(0)).toBe(0);
    expect(aaCriticalOffset(8)).toBe(80); // exemple l.2498
  });

  it('résout via la table AA, applique les Blessures (colonne) + les États immédiats', () => {
    // Torse, d100 15 → « Rien qu'une égratignure ! » (11-20) : Blessures 1 + 1 État Hémorragique.
    const r = resolveAACritical(target(), 'corps', seq(15), 0);
    expect(r.name).toBe("Rien qu'une égratignure !");
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1 }, { op: 'condition', name: 'hemorragique', value: 1 }]);
    expect(r.lethal).toBe(false);
  });

  it('Test de Résistance de ligne auto-résolu : échec → États onFail ajoutés (l.2584)', () => {
    // Torse 21-25 « Coup au ventre » : 1 Sonné + Résistance Facile (+40) sous peine À Terre.
    // E 30 → cible 70 ; jet de résistance 90 > 70 → échec → À Terre.
    const r = resolveAACritical(target(), 'corps', seq(22, 90), 0);
    expect(r.name).toBe('Coup au ventre');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1 }, { op: 'condition', name: 'sonne', value: 1 }, { op: 'condition', name: 'a-terre', value: 1 }]);
  });

  it('décalage +10/Blessure pousse vers la ligne LÉTALE plafond « 00 ou plus » (l.2601)', () => {
    // Torse, d100 40 + overkill 8 (+80) = 120 ≥ 116 → « Éventré » (Mort).
    const r = resolveAACritical(target(), 'corps', seq(40), 8);
    expect(r.roll).toBe(120);
    expect(r.name).toBe('Éventré');
    expect(r.lethal).toBe(true);
  });

  it('lignes triviales « T » (l.2521) détectées pour ne pas compter dans la mort', () => {
    expect(aaCriticalIsTrivial('brasD', 5)).toBe(true);   // 01-10 « Choc au poignet » = T
    expect(aaCriticalIsTrivial('brasD', 25)).toBe(false); // 21-25 « Coupure mineure » = 1
  });

  it('mort par accumulation de Blessures Critiques (l.2517)', () => {
    expect(aaDeathByCriticalCount(true, 0, 3, 2)).toBe(true);   // Inconscient + 0 PB + 3 > BE 2
    expect(aaDeathByCriticalCount(false, 0, 3, 2)).toBe(false); // pas Inconscient
    expect(aaDeathByCriticalCount(true, 4, 3, 2)).toBe(false);  // PB > 0
    expect(aaDeathByCriticalCount(true, 0, 2, 2)).toBe(false);  // 2 n'est pas > 2
  });

  // #125 — sous-effets RÉCURRENTS/chiffrés désormais STRUCTURÉS (GameOp à durée), plus un texte arbitré.
  // #153 — « Vous lâchez ce que vous teniez dans cette main » désormais STRUCTURÉ (op `disarm`).
  it('« Choc au bras » (AA bras 11-20, l.2557) : lâche l’objet tenu + main inutilisable 1d10−BE Rounds (min 1) — STRUCTURÉ', () => {
    const r = resolveAACritical(target(), 'brasG', seq(15), 0);
    expect(r.name).toBe('Choc au bras');
    expect(r.ops).toEqual([
      { op: 'disarm' },
      {
        op: 'maxWeaponHands', hands: 1,
        durationRounds: { sum: [{ dice: { n: 1, sides: 10 } }, { times: { of: { bonusOf: 'endurance' }, factor: -1 } }] },
      },
    ]);
  });

  it('« Clef de bras » (AA bras 51-55, l.2562) : lâche l’objet tenu + bras inutilisable 1d10 Rounds — STRUCTURÉ', () => {
    const r = resolveAACritical(target(), 'brasG', seq(53), 0);
    expect(r.name).toBe('Clef de bras');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2 }, { op: 'disarm' }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Clavicule tordue » (AA corps 41-45, l.2588) : lâche l’objet tenu + bras (au hasard) inutilisable 1d10 Rounds — STRUCTURÉ', () => {
    const r = resolveAACritical(target(), 'corps', seq(43), 0);
    expect(r.name).toBe('Clavicule tordue');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2 }, { op: 'disarm' }, { op: 'maxWeaponHands', hands: 1, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Cheville tordue » (AA jambe 21-25, l.2610) : -10 Ag pendant 1d10 Rounds — STRUCTURÉ (charMod)', () => {
    const r = resolveAACritical(target(), 'jambeG', seq(23), 0);
    expect(r.name).toBe('Cheville tordue');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 1 }, { op: 'charMod', char: 'agilite', mod: -10, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it('« Genou tordu » (AA jambe 51-55, l.2614) : -20 Ag pendant 1d10 Rounds — STRUCTURÉ (charMod)', () => {
    const r = resolveAACritical(target(), 'jambeG', seq(53), 0);
    expect(r.name).toBe('Genou tordu');
    expect(r.ops).toEqual([{ op: 'wounds', amount: 2 }, { op: 'charMod', char: 'agilite', mod: -20, durationRounds: { dice: { n: 1, sides: 10 } } }]);
  });

  it("« Orteil contusionné » (AA jambe 01-10, l.2608) : Résistance échouée → -10 Ag 1 Round (« jusqu'à la fin du prochain Round », convention drunkIgnore) — STRUCTURÉ", () => {
    const r = resolveAACritical(target(), 'jambeG', seq(5, 90), 0); // loc 5 → ligne ; test 90 > cible 50 (E30+20) → échec
    expect(r.name).toBe('Orteil contusionné');
    expect(r.ops).toEqual([{ op: 'charMod', char: 'agilite', mod: -10, durationRounds: 1 }]);
  });

  it("« Perte d'équilibre » (AA jambe 11-20, l.2609) : Test d'ATHLÉTISME (pas Résistance) — resist.skill", () => {
    const r = resolveAACritical(target(), 'jambeG', seq(15, 90), 0); // loc 15 → ligne ; Athlétisme (Ag30+0) 90 > 30 → échec
    expect(r.name).toBe("Perte d'équilibre");
    expect(r.ops).toEqual([{ op: 'condition', name: 'a-terre', value: 1 }]);
  });

  it('le toggle bifurque rollCritical : ldb (défaut) ≠ aa', () => {
    const aa = (() => { setRule('combat-aa-blessures', 'aa'); return rollCritical(target(), 'corps', seq(15), 0); })();
    expect(aa.name).toBe("Rien qu'une égratignure !"); // table AA
    resetRule('combat-aa-blessures');
    const ldb = rollCritical(target(), 'corps', seq(15), 0);
    expect(ldb.name).not.toBe("Rien qu'une égratignure !"); // table LDB (nom différent)
  });

  // #153 — Amputation AA DÉSORMAIS DÉCLARÉE STRUCTURELLEMENT (`entry.amputation`), même cascade que
  // `rollCritical` LDB (Test de Résistance → séquelle permanente via `permanentAmputations`, SOURCE UNIQUE).
  describe('#153 — Amputation AA structurée (l.328-333, même patron que data/criticals.ts)', () => {
    it('« Oreille mutilée » (AA tête 61-65, Amputation Accessible) : Résistance échouée → À Terre + séquelle permanente (needsSurgery + oreille-perdue)', () => {
      // E30 → cible Accessible 50 ; jet de résistance 60 > 50 → échec (DR −1, pas de Sonné/Inconscient).
      const r = resolveAACritical(target(), 'tete', seq(63, 60), 0);
      expect(r.name).toBe('Oreille mutilée');
      expect(r.traumas.some((t) => t.needsSurgery && t.label.startsWith('Amputation'))).toBe(true);
      expect(r.traumas.some((t) => t.traumaId === 'oreille-perdue')).toBe(true);
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(true);
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'sonne')).toBe(false);
    });

    it('« Oreille mutilée » : Résistance RÉUSSIE → séquelle quand même (le membre reste perdu), sans À Terre du choc', () => {
      const r = resolveAACritical(target(), 'tete', seq(63, 5), 0); // 5 ≤ 50 → réussite
      expect(r.traumas.some((t) => t.traumaId === 'oreille-perdue')).toBe(true);
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(false);
    });

    it('échec catastrophique (DR ≤ −4) ajoute Sonné ET Inconscient (même cascade que LDB 18 l.328-333)', () => {
      const r = resolveAACritical(target(), 'tete', seq(63, 99), 0); // cible 50 ; 99 → DR −4
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'sonne')).toBe(true);
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'inconscient')).toBe(true);
    });

    it('« Coup défigurant » (AA tête 86-94, Amputation Difficile) cumule 2 séquelles (œil + nez)', () => {
      // Cible Difficile = E30−20 = 10 ; jet de résistance 5 ≤ 10 → réussite (séquelles quand même, sans à-terre).
      const r = resolveAACritical(target(), 'tete', seq(90, 5), 0);
      expect(r.name).toBe('Coup défigurant');
      expect(r.traumas.some((t) => t.traumaId === 'oeil-perdu')).toBe(true);
      expect(r.traumas.some((t) => t.traumaId === 'nez-ampute')).toBe(true);
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(false);
    });

    it('toutes les entrées AA `amputation` portent `{difficulty,sequels}` non vide (garde de cohérence, cf. critical.test.ts)', () => {
      let count = 0;
      for (const table of [aaJson.tete, aaJson.bras, aaJson.corps, aaJson.jambe]) {
        for (const e of table as { amputation?: { difficulty: string; sequels: string[] } }[]) {
          if (e.amputation) {
            count += 1;
            expect(e.amputation.difficulty).toBeTruthy();
            expect(Array.isArray(e.amputation.sequels)).toBe(true);
            expect(e.amputation.sequels.length).toBeGreaterThan(0);
          }
        }
      }
      expect(count).toBeGreaterThan(0);
    });
  });

  // #195 (revue) — les VARIANTES d'amputation (timing différé, graduation par DR) valent AUSSI pour l'AA :
  // même texte RAW que le LDB (« Une fois la rencontre terminée… » / « un orteil par DR ») → même patron partagé.
  describe('#195 — variantes d’amputation AA (timing/loss), même patron que le LDB', () => {
    it('« Coupure à l’orteil » (AA jambe 56-60, AA 07 l.171) : timing postEncounter → marqueur pendingAmputation, AUCUN jet ni séquelle immédiate', () => {
      const r = resolveAACritical(target(), 'jambeD', seq(58), 0); // 58 → aa-jambe-56 ; aucun autre tirage
      expect(r.name).toBe("Coupure à l'orteil");
      expect(r.traumas.some((t) => t.pendingAmputation)).toBe(true);
      expect(r.traumas.some((t) => t.needsSurgery)).toBe(false);
      expect(r.traumas.some((t) => t.traumaId === 'orteil-ampute')).toBe(false); // rien posé PENDANT le combat
      expect(r.ops.some((o) => o.op === 'condition' && (o.name === 'a-terre' || o.name === 'sonne'))).toBe(false);
    });

    it('« Coupure à l’orteil » : résolution post-rencontre AA — gate Intermédiaire RÉUSSI → aucun orteil (le bug « séquelle toujours » est corrigé)', () => {
      const c = target();
      c.traumas = resolveAACritical(target(), 'jambeD', seq(58), 0).traumas; // le marqueur
      resolvePostEncounterAmputations(c, seq(10, 10)); // gate Intermédiaire cible E30 : 10 ≤ 30 → réussi : pas d'amputation
      expect(c.traumas!.some((t) => t.pendingAmputation)).toBe(false); // marqueur consommé
      expect(c.traumas!.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
      expect(c.traumas!.some((t) => t.needsSurgery)).toBe(false);
    });

    it('« Pied écrasé » (AA jambe 106-115, AA 07 l.180) : loss.perDR → orteils gradués par DR sur ÉCHEC', () => {
      // overkill 6 → +60 : d100 50 → roll 110 (aa-jambe-106). Test Accessible (E30+20=50) : 75 → DR −2 → 1+2 = 3 orteils.
      const r = resolveAACritical(target(), 'jambeD', seq(50, 75), 6);
      expect(r.name).toBe('Pied écrasé');
      const orteil = r.traumas.find((t) => t.traumaId === 'orteil-ampute')!;
      expect(orteil).toBeTruthy();
      expect(orteil.count).toBe(3);
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(true);
    });

    it('« Pied écrasé » : Test Accessible RÉUSSI → aucun orteil (loss gate LUI-MÊME la perte — plus de séquelle systématique)', () => {
      const r = resolveAACritical(target(), 'jambeD', seq(50, 10), 6); // 10 ≤ 50 → réussite
      expect(r.name).toBe('Pied écrasé');
      expect(r.traumas.some((t) => t.traumaId === 'orteil-ampute')).toBe(false);
      expect(r.ops.some((o) => o.op === 'condition' && o.name === 'a-terre')).toBe(false);
    });
  });

  /**
   * Repli « Tableau des Bras » AA (même patron que `criticalTableFor` LDB, `data/criticals.test.ts`) —
   * LDB 76 l.21 : « Si un animal possède une Localisation sans Tableau de Critiques, comme un tentacule,
   * une queue ou une aile, faites un jet sur le Tableau des Bras et décrivez le résultat de façon
   * appropriée. » Garde EXHAUSTIVE (la classe, pas les cas) sur le chemin AA.
   */
  describe('aaTableFor — repli Tableau des Bras AA (LDB 76 l.21)', () => {
    const shapes = (locJson as { personnage: { shapes: Record<string, { loc: HitLocation }[]> } }).personnage.shapes;
    const producedLocs = new Set<HitLocation>();
    for (const entries of Object.values(shapes)) for (const e of entries) producedLocs.add(e.loc);

    it('localisation.json (humanoide/serpent/araignee) ne produit que des locs déjà couvertes côté AA', () => {
      expect(producedLocs.size).toBeGreaterThan(0);
      for (const loc of producedLocs) {
        expect(aaTableFor(loc).length, `loc ${loc}`).toBeGreaterThan(0);
      }
    });

    it("les 6 HitLocation résolvent TOUTES sur une table AA dédiée DISTINCTE (aucun trou ni repli silencieux aujourd'hui)", () => {
      expect(aaTableFor('brasG')).toBe(aaTableFor('brasD')); // même table (LDB : un seul Tableau des Bras)
      expect(aaTableFor('jambeG')).toBe(aaTableFor('jambeD'));
      expect(aaTableFor('tete')).not.toBe(aaTableFor('brasD'));
      expect(aaTableFor('corps')).not.toBe(aaTableFor('brasD'));
      expect(aaTableFor('jambeG')).not.toBe(aaTableFor('brasD'));
    });

    it('une loc SANS table AA dédiée (tentacule/queue/aile future) retombe réellement sur la table AA des Bras', () => {
      const brasTable = aaTableFor('brasD');
      for (const exotic of ['tentacule', 'queue', 'aile'] as unknown as HitLocation[]) {
        expect(aaTableFor(exotic)).toBe(brasTable);
      }
    });
  });
});
