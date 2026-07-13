import { describe, it, expect } from 'vitest';
import {
  humanizeFlowSentence, humanizeCondition, humanizeOp, humanizeFormula, humanizeCastBonus,
} from './humanize';
import {
  domains, spells, etats, talents, traits, groups, maladies, symptoms, skills, creatures,
} from '../../data';
import { CHAR_KEYS } from '../../engine/types';
import { walkFlow, type Flow, type Condition, type EffectOp } from '../../state/flow';
import type { GameOp } from '../../engine/ops';

/** Ids KEBAB (multi-segment) connus des registres : « en-flammes », « magie-des-arcanes »,
 *  « force-mentale »… — jamais un mot français de prose (« peut-être »). Une sortie JOUEUR qui en
 *  contient un a laissé fuir un id BRUT. */
const KEBAB_IDS: string[] = [
  ...etats, ...talents, ...traits, ...groups, ...maladies, ...symptoms, ...skills, ...creatures,
].map((x) => x.id).concat(CHAR_KEYS).filter((id) => id.includes('-'));

const firstKebab = (s: string): string | undefined => KEBAB_IDS.find((id) => s.includes(id));

/** Conditions (nœuds `if`, gate/difficultyBy des `test`) d'un Flow. */
function collectConditions(flow: Flow): Condition[] {
  const out: Condition[] = [];
  walkFlow(flow, (n) => {
    if (n.kind === 'if') out.push(n.cond);
    if (n.kind === 'test') { if (n.test.gate) out.push(n.test.gate); for (const d of n.test.difficultyBy ?? []) out.push(d.cond); }
  });
  return out;
}

/** GameOps des feuilles EffectOp d'un Flow (hors `narrative` — prose verbatim, pas un id). */
function collectOps(flow: Flow): GameOp[] {
  const out: GameOp[] = [];
  walkFlow(flow, (n) => {
    if (n.kind !== 'do') return;
    const e = n.effect as EffectOp;
    if (e && e.type === 'ops') for (const o of e.ops) if (o.op !== 'narrative') out.push(o);
  });
  return out;
}

describe('humanize — registre JOUEUR', () => {
  it('rend le rider du Domaine du Feu en phrase lisible (sans →, sans NON(, sans id brut)', () => {
    const feu = domains.find((d) => d.id === 'feu')!;
    const phrase = humanizeFlowSentence(feu.effects![0].flow as Flow);
    // Lisible : État et Talent en libellé.
    expect(phrase).toContain('En flammes');
    expect(phrase).toContain('Magie des Arcanes (Feu)');
    expect(phrase).toContain('adversaire');
    expect(phrase).toContain('ne possède pas');
    // Aucune fuite technique.
    expect(phrase).not.toContain('→');
    expect(phrase).not.toContain('->');
    expect(phrase).not.toContain('NON(');
    expect(firstKebab(phrase)).toBeUndefined();
  });

  it('humanizeCondition : négation NATURELLE poussée dans la feuille (pas de « NON( … ) »)', () => {
    const c: Condition = { kind: 'not', of: { kind: 'has', who: 'target', what: 'talent', value: 'magie-des-arcanes', spec: 'feu' } };
    expect(humanizeCondition(c)).toBe('la cible ne possède pas le Talent Magie des Arcanes (Feu)');
    const rel: Condition = { kind: 'relation', who: 'target', is: 'opponent' };
    expect(humanizeCondition(rel)).toBe('la cible est un adversaire');
    // De Morgan sur any sous négation.
    const morgan: Condition = { kind: 'not', of: { kind: 'any', of: [
      { kind: 'has', who: 'target', what: 'trait', value: 'mort-vivant' },
      { kind: 'has', who: 'target', what: 'trait', value: 'demoniaque' },
    ] } };
    expect(humanizeCondition(morgan)).toBe('la cible ne possède pas le Trait Mort-vivant et la cible ne possède pas le Trait Démoniaque');
  });

  it('humanizeCondition : compare sur un État → « porte / ne porte pas »', () => {
    const has: Condition = { kind: 'compare', subject: { who: 'target', condition: 'extenue' }, op: '>=', value: 1 };
    expect(humanizeCondition(has)).toBe('la cible porte *Exténué*');
    expect(humanizeCondition({ kind: 'not', of: has })).toBe('la cible ne porte pas *Exténué*');
  });

  it('humanizeFormula : Caractéristiques et dés en clair', () => {
    expect(humanizeFormula({ bonusOf: 'force-mentale' })).toBe('le Bonus de Force Mentale');
    expect(humanizeFormula({ charOf: 'endurance' })).toBe('la Endurance');
    expect(humanizeFormula({ dice: { n: 1, sides: 10, plus: 2 } })).toBe('1d10+2');
    expect(humanizeFormula(5)).toBe('5');
  });

  it('humanizeOp : État en libellé italique, jamais l’id', () => {
    const op: GameOp = { op: 'condition', name: 'en-flammes' };
    expect(humanizeOp(op)).toBe("gagne l'État *En flammes*");
    expect(firstKebab(humanizeOp(op))).toBeUndefined();
  });

  it('humanizeCastBonus : caractéristique en abréviation canonique (BFM), unité « m »', () => {
    const feu = domains.find((d) => d.id === 'feu')!;
    expect(humanizeCastBonus(feu.castBonus!)).toBe('+10 par État *En flammes* à ≤ BFM m');
  });
});

describe('humanize — GARDE structurelle (toutes les données réelles)', () => {
  it('domaines : humanize ne jette jamais et ne fuit aucun id/→ brut', () => {
    for (const d of domains) {
      for (const e of d.effects ?? []) {
        const flow = e.flow as Flow;
        const full = humanizeFlowSentence(flow);
        expect(full, `${d.id}: →/->/NON(`).not.toMatch(/→|->|NON\(/);
        for (const c of collectConditions(flow)) {
          const s = humanizeCondition(c);
          expect(firstKebab(s), `${d.id} cond « ${s} »`).toBeUndefined();
        }
        for (const o of collectOps(flow)) {
          const s = humanizeOp(o);
          expect(firstKebab(s), `${d.id} op ${o.op} « ${s} »`).toBeUndefined();
        }
      }
      if (d.castBonus) expect(firstKebab(humanizeCastBonus(d.castBonus)), d.id).toBeUndefined();
      for (const o of (d.casterOps ?? []) as GameOp[]) {
        if (o.op === 'narrative') continue;
        expect(firstKebab(humanizeOp(o)), `${d.id} casterOp ${o.op}`).toBeUndefined();
      }
    }
  });

  it('sorts : humanize ne jette jamais et ne fuit aucun id/→ brut', () => {
    for (const s of spells) {
      const flow = s.effects as Flow | undefined;
      if (!flow) continue;
      // Les `narrative` (prose VERBATIM) peuvent porter un « → » de source → l'arbre if/test (le VRAI
      // risque « → » d'atelier) est couvert par la garde des DOMAINES (sans narrative). Ici : pas de
      // « NON( » structurel, et aucun id kebab par condition/op.
      const full = humanizeFlowSentence(flow);
      expect(full, `${s.id}: NON(`).not.toContain('NON(');
      for (const c of collectConditions(flow)) {
        const str = humanizeCondition(c);
        expect(firstKebab(str), `${s.id} cond « ${str} »`).toBeUndefined();
      }
      for (const o of collectOps(flow)) {
        const str = humanizeOp(o);
        expect(firstKebab(str), `${s.id} op ${o.op} « ${str} »`).toBeUndefined();
      }
    }
  });
});
