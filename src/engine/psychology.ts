/**
 * Psychologie WFRP4 (Livre de base `21 - Psychologie.md`). Cœur PUR : déclenchement et résolution
 * des Tests de Calme / Psychologie. Jeu sans MJ → difficulté par défaut **Intermédiaire (+0)** (les
 * exemples du livre l'utilisent). P1 = Peur (Indice) / Terreur (Indice). Cf. spec :
 * docs/superpowers/specs/2026-06-07-psychologie-design.md
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { effectiveChar } from './characteristics';
import { SizeCategory, sizeGap } from './size';

export type PsychType =
  | 'peur'
  | 'terreur'
  | 'frenesie'
  | 'animosite'
  | 'haine'
  | 'prejuge'
  | 'amour'
  | 'camaraderie'
  | 'phobie'
  | 'trauma';

/** Trait psychologique POSSÉDÉ (Animosité(Elfes), Phobie(Serpents), capacité de Frénésie…). */
export interface PsychTrait {
  type: PsychType;
  cible?: string;
  indice?: number;
}

/** Affliction psychologique ACTIVE en combat, posée après un Test de Psychologie raté. Conservée
 *  pour la rencontre (évite le re-déclenchement) ; « sous Peur » ⟺ `calmeDR < indice`. */
export interface PsychAffliction {
  type: PsychType;
  /** Créature source (Peur/Terreur) ou groupe ciblé. */
  sourceId?: string;
  cible?: string;
  /** Indice de Peur à surmonter (Test étendu de Calme). `0` = source déjà surmontée/passée (inerte). */
  indice?: number;
  /** DR cumulé du Test ÉTENDU de Calme (Peur), vers l'Indice. */
  calmeDR?: number;
}

/** Source de Peur/Terreur que `foe` représente pour `self` : combine la Taille (LDB 85) et l'Indice
 *  inspiré au statbloc (`causesPeur`/`causesTerreur`). Terreur prime ; sinon le plus haut Indice. Pur. */
export function fearSourceFor(self: Combatant, foe: Combatant): { kind: 'peur' | 'terreur'; indice: number } | null {
  const cands: { kind: 'peur' | 'terreur'; indice: number }[] = [];
  const size = peurTerreurFromSize(foe.size, self.size);
  if (size) cands.push(size);
  if (foe.causesTerreur) cands.push({ kind: 'terreur', indice: foe.causesTerreur });
  if (foe.causesPeur) cands.push({ kind: 'peur', indice: foe.causesPeur });
  if (!cands.length) return null;
  const terr = cands.filter((c) => c.kind === 'terreur');
  return (terr.length ? terr : cands).reduce((a, b) => (b.indice > a.indice ? b : a));
}

/** Parse les traits de données (`creatures.json`) en propriétés psy. P1 : Peur/Terreur/Immunité
 *  (LDB 85 l.143-144). Les traits ciblés (Animosité/Haine…) sont parsés en P3. */
export function parsePsychTraits(traits: string[]): { causesPeur?: number; causesTerreur?: number; psychImmune?: boolean } {
  const out: { causesPeur?: number; causesTerreur?: number; psychImmune?: boolean } = {};
  for (const t of traits) {
    const peur = t.match(/^Peur\s+(\d+)/i);
    const terreur = t.match(/^Terreur\s+(\d+)/i);
    if (peur) out.causesPeur = Number(peur[1]);
    if (terreur) out.causesTerreur = Number(terreur[1]);
    if (/Immunit[ée].*Psychologie/i.test(t)) out.psychImmune = true;
  }
  return out;
}

/** Peur/Terreur inspirée par la Taille (LDB 85 l.317-318), du point de vue de `self` face à `foe` :
 *  écart ≥ 1 cat. → Peur (Indice = écart) ; ≥ 2 → Terreur. `foe` plus petit/égal → rien. */
export function peurTerreurFromSize(foe?: SizeCategory, self?: SizeCategory): { kind: 'peur' | 'terreur'; indice: number } | null {
  const gap = sizeGap(foe, self); // > 0 si `foe` est plus grand
  if (gap >= 2) return { kind: 'terreur', indice: gap };
  if (gap >= 1) return { kind: 'peur', indice: gap };
  return null;
}

/** Valeur de Calme : Force Mentale effective + avances de la compétence Calme (« Sang-froid »). */
export function calmeValue(c: Combatant): number {
  const adv = c.skills.find((s) => s.name.toLowerCase().startsWith('calme'))?.advances ?? 0;
  return effectiveChar(c, 'FM') + adv;
}

/** Un Round de Test ÉTENDU de Calme contre la Peur (LDB 21 l.27) : cumule le DR jusqu'à l'Indice.
 *  `prevDR` = DR déjà accumulé. `vaincue` = la Peur est surmontée (DR cumulé ≥ Indice). */
export function resolvePeurTest(
  calme: number,
  indice: number,
  prevDR: number,
  rng: RNG = defaultRNG,
): { dr: number; calmeDR: number; vaincue: boolean; roll: number } {
  const t = rollTest(calme, 'intermediaire', rng);
  const dr = t.success ? Math.max(0, t.sl) : 0;
  const calmeDR = prevDR + dr;
  return { dr, calmeDR, vaincue: calmeDR >= indice, roll: t.roll };
}

/** Test de Terreur à la 1ʳᵉ rencontre (LDB 21 l.55-57) : échec → Brisé = Indice + |DR négatifs| ;
 *  ensuite la créature cause une Peur d'Indice équivalent (`devientPeur`). */
export function resolveTerreurTest(
  calme: number,
  indice: number,
  rng: RNG = defaultRNG,
): { success: boolean; brise: number; devientPeur: number; roll: number } {
  const t = rollTest(calme, 'intermediaire', rng);
  const brise = t.success ? 0 : indice + Math.max(0, -t.sl);
  return { success: t.success, brise, devientPeur: indice, roll: t.roll };
}
