/**
 * Grimoire — apprentissage et mémorisation des sorts (LDB 46 « Mémoriser des
 * Sorts » l.44-47, 47 « Grimoires » l.33-34, et Talents de lanceur, LDB 10) :
 *
 *  - Magie mineure : mémorise BFM sorts au Talent ; sorts supplémentaires par
 *    bandes de BFM à 50/100/150… PX (« Jusqu'à Bonus FM ×1 : 50 PX… »).
 *  - Magie des Arcanes (Domaine) : sorts du Domaine + Sorts d'Arcane communs,
 *    par bandes de Bonus d'Intelligence à 100/200/300… PX.
 *  - Invocation (Culte) : « l'un des Miracles de son culte » au Talent (le 1er
 *    est inclus) ; suivants à 100 PX × Miracles connus.
 *  - Béni (Culte) : « reçoit les SIX Bénédictions de son culte » (LDB 41,
 *    Bénédictions par culte — table verbatim ci-dessous), aucun achat.
 *  - Magie du Chaos : chaque sort = reprise du Talent (100 PX + 1 Corruption).
 *
 * Objet grimoire (LDB 47 l.34) : un sort de son Domaine NON mémorisé peut être
 * lancé depuis un grimoire porté, à deux mains, au NI DOUBLÉ.
 */
import { Combatant } from './types';
import { bonus, effectiveChar } from './characteristics';
import { spells, type SpellData } from '../data';

/** Bénédictions par culte (LDB 41, verbatim). Clé = culte ; valeurs = suffixe du label
 *  (« Bataille » → « Bénédiction de Bataille »). */
export const CULT_BLESSINGS: Record<string, string[]> = {
  Manann: ['Bataille', 'Courage', 'Sauvagerie', 'Souffle', 'Ténacité', 'Vigueur'],
  Morr: ['Chance', 'Courage', 'Droiture', 'Sagesse', 'Souffle', 'Ténacité'],
  Myrmidia: ['Bataille', 'Chance', 'Conscience', 'Courage', 'Droiture', 'Protection'],
  Ranald: ['Chance', 'Charisme', 'Conscience', 'Finesse', 'Protection', 'Vivacité'],
  Rhya: ['Conscience', 'Convalescence', 'Grâce', 'Guérison', 'Protection', 'Souffle'],
  Shallya: ['Conscience', 'Convalescence', 'Guérison', 'Protection', 'Souffle', 'Ténacité'],
  Sigmar: ['Bataille', 'Courage', 'Droiture', 'Puissance', 'Protection', 'Vigueur'],
  Taal: ['Bataille', 'Conscience', 'La Chasse', 'Sauvagerie', 'Souffle', 'Vigueur'],
  Ulric: ['Bataille', 'Courage', 'Puissance', 'Sauvagerie', 'Ténacité', 'Vigueur'],
  Verena: ['Chance', 'Conscience', 'Courage', 'Droiture', 'Sagesse', 'Vivacité'],
};

/** Labels complets des six Bénédictions d'un culte. */
export function blessingsOf(cult: string): string[] {
  return (CULT_BLESSINGS[cult] ?? []).map((x) => `Bénédiction de ${x}`);
}

export interface CasterTalent {
  kind: 'mineure' | 'arcane' | 'invocation' | 'beni' | 'chaos';
  /** Domaine (Feu, Ombres, Nécromancie…) ou Culte (Sigmar…), si spécialisé. */
  spec?: string;
}

/** Talents de lanceur du héros — specs extraites du NOM complet (« Invocation (Sigmar) »). */
export function casterTalents(c: Combatant): CasterTalent[] {
  const out: CasterTalent[] = [];
  for (const t of c.talents) {
    const m = t.name.match(/^(Magie mineure|Magie des Arcanes|Invocation|Béni|Magie du Chaos)(?:\s*\(([^)]+)\))?$/);
    if (!m) continue;
    const kind = m[1] === 'Magie mineure' ? 'mineure'
      : m[1] === 'Magie des Arcanes' ? 'arcane'
      : m[1] === 'Invocation' ? 'invocation'
      : m[1] === 'Béni' ? 'beni' : 'chaos';
    // « (Au choix) » (libellé générique des carrières) = non encore spécialisé → joker.
    const spec = m[2]?.trim();
    out.push({ kind, spec: spec && !/^au choix$/i.test(spec) ? spec : undefined });
  }
  return out;
}

/** Famille d'achat d'un sort (pour le comptage et l'éligibilité). */
function familyOf(spell: SpellData): CasterTalent['kind'] | null {
  if (spell.type === 'Magie mineure') return 'mineure';
  if (spell.type === 'Magie des Arcanes') return 'arcane';
  if (spell.type === 'Invocation') return 'invocation';
  if (spell.type === 'Béni') return 'beni';
  if (spell.type === 'Magie du Chaos') return 'chaos';
  return null;
}

/** Nombre de sorts CONNUS de la famille (référence des bandes de coût). */
export function knownCount(c: Combatant, family: CasterTalent['kind']): number {
  let n = 0;
  for (const label of c.spells ?? []) {
    const sp = spells.find((s) => s.label === label);
    if (sp && familyOf(sp) === family) n++;
  }
  return n;
}

/** Le héros a-t-il un Talent rendant CE sort apprenable ? */
export function eligibleTalent(c: Combatant, spell: SpellData): CasterTalent | undefined {
  const fam = familyOf(spell);
  const talents = casterTalents(c);
  if (fam === 'mineure') return talents.find((t) => t.kind === 'mineure');
  if (fam === 'arcane') {
    // Sorts d'Arcane communs (subType null) : n'importe quel Domaine connu ;
    // sorts de Domaine : le Talent du MÊME Domaine (ou un Talent non spécialisé — données légères).
    return talents.find((t) => t.kind === 'arcane' && (spell.subType == null || t.spec == null || t.spec === spell.subType));
  }
  if (fam === 'invocation') return talents.find((t) => t.kind === 'invocation' && (t.spec == null || t.spec === spell.subType));
  if (fam === 'beni') return talents.find((t) => t.kind === 'beni' && (t.spec == null || blessingsOf(t.spec).includes(spell.label)));
  if (fam === 'chaos') return talents.find((t) => t.kind === 'chaos' && (t.spec == null || t.spec === spell.subType));
  return undefined;
}

/**
 * Coût en PX pour APPRENDRE `spell` maintenant (LDB 10 — Talents de lanceur) ;
 * null si inapprenable (déjà connu / aucun Talent éligible).
 *  - Bénédictions : 0 (« reçoit les six Bénédictions de son culte »).
 *  - Magie mineure : 50 × (⌊connus/BFM⌋ + 1).
 *  - Arcanes : 100 × (⌊connus/BInt⌋ + 1).
 *  - Invocation : le 1er Miracle est inclus au Talent (0), puis 100 × connus.
 *  - Chaos : 100 PX (et +1 Point de Corruption — appliqué par l'acheteur).
 */
export function spellCost(c: Combatant, spell: SpellData): number | null {
  if ((c.spells ?? []).includes(spell.label)) return null;
  const talent = eligibleTalent(c, spell);
  if (!talent) return null;
  const fam = familyOf(spell)!;
  if (fam === 'beni') return 0;
  if (fam === 'chaos') return 100;
  const known = knownCount(c, fam);
  if (fam === 'mineure') {
    const band = Math.max(1, bonus(effectiveChar(c, 'FM')));
    return 50 * (Math.floor(known / band) + 1);
  }
  if (fam === 'arcane') {
    const band = Math.max(1, bonus(effectiveChar(c, 'Int')));
    return 100 * (Math.floor(known / band) + 1);
  }
  // Invocation
  return known === 0 ? 0 : 100 * known;
}

/** Tous les sorts apprenables MAINTENANT par le héros, avec leur coût. */
export function learnableSpells(c: Combatant): { spell: SpellData; cost: number }[] {
  const out: { spell: SpellData; cost: number }[] = [];
  for (const sp of spells) {
    const cost = spellCost(c, sp);
    if (cost != null) out.push({ spell: sp, cost });
  }
  return out;
}

/** Un objet-grimoire PORTÉ (LDB 47 l.34 — lecture à deux mains). */
export function carriedGrimoire(c: Combatant): { name: string } | undefined {
  return (c.items ?? []).find((i) => /grimoire|livre de sorts/i.test(i.name) && !i.destroyed);
}

/** Sort lançable DEPUIS le grimoire porté (LDB 47 l.34) : non mémorisé, du Domaine
 *  d'un Talent Magie des Arcanes du lanceur — le NI est DOUBLÉ à l'incantation. */
export function canCastFromGrimoire(c: Combatant, spell: SpellData): boolean {
  if ((c.spells ?? []).includes(spell.label)) return false; // mémorisé : pas besoin du livre
  if (!carriedGrimoire(c)) return false;
  if (spell.type !== 'Magie des Arcanes') return false; // un grimoire transcrit des Sorts (pas des Prières)
  return !!eligibleTalent(c, spell);
}