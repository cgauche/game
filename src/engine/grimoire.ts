/**
 * Grimoire — apprentissage et mémorisation des sorts (LDB 46 « Mémoriser des
 * Sorts » l.16-20, 47 « Grimoires » l.33-34, et Talents de lanceur, LDB 10) :
 *
 *  - Magie mineure : « mémorise de façon permanente un nombre de Sorts égal à
 *    votre Bonus de Force Mentale » au Talent (LDB 10 l.587) → GRATUITS tant que
 *    le héros en connaît moins que BFM ; ensuite par bandes INCLUSIVES
 *    (« Jusqu'à Bonus FM ×1 : 50 PX », ×2 : 100…).
 *  - Magie des Arcanes (Domaine) : sorts du Domaine + Sorts d'Arcane communs,
 *    par bandes de Bonus d'Intelligence à 100/200/300… PX (mêmes bandes
 *    inclusives — aucun sort inclus au Talent, LDB 10 l.569).
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
import { spells, blessingsOf, miraclesOf, chaosSpellsOf, findSpellById, type SpellData } from '../data'; // appartenance sort→dieu par IDS (dataset gods)
import { featuresOf } from './combatFeatures/dispatch';
import type { CastingKind } from './combatFeatures/types';
import { itemCapability } from './capabilities';

export interface CasterTalent {
  kind: CastingKind;
  /** Domaine (Feu, Ombres, Nécromancie…) ou Culte (Sigmar…), si spécialisé. */
  spec?: string;
}

/** Talents de lanceur du héros — lus du REGISTRE de talents (castingKind), specs = `ctx.spec`
 *  (« Invocation (Sigmar) » → 'Sigmar'). Plus de name-match : ajouter un Talent de lanceur = une def. */
export function casterTalents(c: Combatant): CasterTalent[] {
  const out: CasterTalent[] = [];
  for (const { def, ctx } of featuresOf(c)) {
    if (!def.castingKind) continue;
    // « (Au choix) » (libellé générique des carrières) = non encore spécialisé → joker.
    const spec = ctx.spec;
    out.push({ kind: def.castingKind, spec: spec && !/^au choix$/i.test(spec) ? spec : undefined });
  }
  return out;
}

/** Famille d'achat d'un sort (pour le comptage et l'éligibilité). */
function familyOf(spell: SpellData): CasterTalent['kind'] | null {
  return spell.family; // famille STABLE portée par la donnée (multilangue ; ex-switch sur le libellé `type`)
}

/** Nombre de sorts CONNUS de la famille (référence des bandes de coût). */
export function knownCount(c: Combatant, family: CasterTalent['kind']): number {
  let n = 0;
  for (const x of c.spells ?? []) {
    const sp = findSpellById(x); // `c.spells` = ids de sort (runtime)
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
    // Sorts d'Arcane communs (domainId null) : n'importe quel Domaine connu ; sorts de Domaine : le
    // Talent du MÊME Domaine (`t.spec` = id de domaine = `spell.domainId`) ou un Talent non spécialisé.
    return talents.find((t) => t.kind === 'arcane' && (spell.domainId == null || t.spec == null || t.spec === spell.domainId));
  }
  // Invocation/Béni/Chaos : la spec du Talent est un CULTE/Dieu (`gods.id`, id STABLE) ; l'appartenance
  // sort→dieu est portée en IDS par `gods.json` (miracles/blessings/chaosSpells) — JAMAIS par le `subType`
  // (libellé d'affichage). Spec absente (« Au choix » non assigné) = joker → tout sort de la famille.
  if (fam === 'invocation') return talents.find((t) => t.kind === 'invocation' && (t.spec == null || miraclesOf(t.spec).includes(spell.id)));
  if (fam === 'beni') return talents.find((t) => t.kind === 'beni' && (t.spec == null || blessingsOf(t.spec).includes(spell.id)));
  if (fam === 'chaos') return talents.find((t) => t.kind === 'chaos' && (t.spec == null || chaosSpellsOf(t.spec).includes(spell.id)));
  return undefined;
}

/**
 * Coût en PX pour APPRENDRE `spell` maintenant (LDB 10 — Talents de lanceur) ;
 * null si inapprenable (déjà connu / aucun Talent éligible).
 *  - Bénédictions : 0 (« reçoit les six Bénédictions de son culte »).
 *  - Magie mineure : BFM sorts INCLUS au Talent (l.587 « vous mémorisez… un
 *    nombre de Sorts égal à votre Bonus de Force Mentale ») → 0 PX tant que
 *    connus < BFM ; ensuite 50 × bande (« Jusqu'à BFM ×N » — bande INCLUSIVE :
 *    à exactement BFM×N connus, le suivant est encore dans la bande N).
 *  - Arcanes : 100 × bande de BInt (mêmes bandes inclusives, rien d'inclus).
 *  - Invocation : le 1er Miracle est inclus au Talent (0), puis 100 × connus.
 *  - Chaos : 100 PX (et +1 Point de Corruption — appliqué par l'acheteur).
 */
export function spellCost(c: Combatant, spell: SpellData): number | null {
  if ((c.spells ?? []).some((x) => x === spell.id)) return null;
  const talent = eligibleTalent(c, spell);
  if (!talent) return null;
  const fam = familyOf(spell)!;
  if (fam === 'beni') return 0;
  if (fam === 'chaos') return 100;
  const known = knownCount(c, fam);
  if (fam === 'mineure') {
    const band = Math.max(1, bonus(effectiveChar(c, 'force-mentale')));
    if (known < band) return 0; // inclus au Talent (LDB 10 l.587)
    return 50 * Math.ceil(known / band);
  }
  if (fam === 'arcane') {
    const band = Math.max(1, bonus(effectiveChar(c, 'intelligence')));
    return 100 * Math.max(1, Math.ceil(known / band));
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

/** Un objet-grimoire dans le paquetage (LDB 47 l.34 — lecture à deux mains). Capacité par-OBJET
 *  `isGrimoire`, NON gatée sur le port (un grimoire dans le sac reste lisible) — lue PAR ID dans le
 *  catalogue (≠ nom — multilangue-safe). */
export function carriedGrimoire(c: Combatant): { name: string } | undefined {
  return (c.items ?? []).find((i) => itemCapability(i, 'isGrimoire') && !i.destroyed);
}

/** Sort lançable DEPUIS le grimoire porté (LDB 47 l.34) : non mémorisé, du Domaine
 *  d'un Talent Magie des Arcanes du lanceur — le NI est DOUBLÉ à l'incantation. */
export function canCastFromGrimoire(c: Combatant, spell: SpellData): boolean {
  if ((c.spells ?? []).some((x) => x === spell.id)) return false; // mémorisé : pas besoin du livre
  if (!carriedGrimoire(c)) return false;
  if (spell.family !== 'arcane') return false; // un grimoire transcrit des Sorts d'Arcane (pas des Prières)
  return !!eligibleTalent(c, spell);
}