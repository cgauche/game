/**
 * Psychologie WFRP4 (Livre de base `21 - Psychologie.md`). Cœur PUR : déclenchement et résolution
 * des Tests de Calme / Psychologie. Jeu sans MJ → difficulté par défaut **Intermédiaire (+0)** (les
 * exemples du livre l'utilisent). P1 = Peur (Indice) / Terreur (Indice). Cf. spec :
 * docs/superpowers/specs/2026-06-07-psychologie-design.md
 */
import { Combatant } from './types';
import { RNG, defaultRNG } from './dice';
import { rollTest, evaluateTest } from './tests';
import { effectiveChar } from './characteristics';
import { SizeCategory, sizeGap } from './size';
import { groupMatch } from './groups';
import { bellicosePsychImmune } from './traits/dispatch';
import { fearImmuneVs } from './combatFeatures/dispatch';

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
  /** N° de Round du dernier Test de Calme (le Test étendu est UNE fois par Round). */
  lastTestRound?: number;
  /** Clé `round:turn` du dernier Test de Calme « la source s'approche » (LDB 21 l.29) : UN Test par
   *  Tour de la source — un déplacement DÉCOMPOSÉ en segments ne re-déclenche pas. */
  lastApproachKey?: string;
  /** Trait CIBLÉ (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie) : `true` = affliction non résistée
   *  (effets actifs, re-testable pour y mettre fin) ; `false` = testé et résisté (marqueur inerte
   *  empêchant le re-déclenchement ce rencontre). */
  active?: boolean;
}

/** Types de Traits psy CIBLÉS (résolution binaire de Calme, pilotés par un Groupe-Cible — LDB 21). */
export const CIBLE_TYPES = new Set<PsychType>(['animosite', 'haine', 'prejuge', 'amour', 'camaraderie', 'phobie']);

/** Source de Peur/Terreur que `foe` représente pour `self` : combine la Taille (LDB 85) et l'Indice
 *  inspiré au statbloc (`causesPeur`/`causesTerreur`). Terreur prime ; sinon le plus haut Indice. Pur. */
export function fearSourceFor(self: Combatant, foe: Combatant): { kind: 'peur' | 'terreur'; indice: number } | null {
  // Sans peur (LDB 10 l.859, talent possédé ciblé OU accordé par Flambeau de Vertu/Cœurs
  // ardents) : la Peur/Terreur de cet adversaire est ignorée — aucune source.
  if (fearImmuneVs(self, foe)) return null;
  const cands: { kind: 'peur' | 'terreur'; indice: number }[] = [];
  const size = peurTerreurFromSize(foe.size, self.size);
  if (size) cands.push(size);
  if (foe.causesTerreur) cands.push({ kind: 'terreur', indice: foe.causesTerreur });
  if (foe.causesPeur) cands.push({ kind: 'peur', indice: foe.causesPeur });
  if (!cands.length) return null;
  const terr = cands.filter((c) => c.kind === 'terreur');
  return (terr.length ? terr : cands).reduce((a, b) => (b.indice > a.indice ? b : a));
}

/** Traits psy CIBLÉS (LDB 21) reconnus dans les données : `Type (Cible)`. Phobie → Peur 1 (l.84-87). */
const TARGETED_TRAITS: { re: RegExp; type: PsychType }[] = [
  { re: /^Animosit[ée]\s*\(([^)]*)\)/i, type: 'animosite' },
  { re: /^Haine\s*\(([^)]*)\)/i, type: 'haine' },
  { re: /^Pr[ée]jug[ée]\s*\(([^)]*)\)/i, type: 'prejuge' },
  { re: /^Amour\s*\(([^)]*)\)/i, type: 'amour' },
  { re: /^Camaraderie\s*\(([^)]*)\)/i, type: 'camaraderie' },
  { re: /^Phobie\s*\(([^)]*)\)/i, type: 'phobie' },
  { re: /^Effray[ée]\s*\(([^)]*)\)/i, type: 'phobie' }, // Effrayé (LDB 85 p.339) : « Peur 0 de la Cible » → ciblé type phobie, Indice 0
];

/** Parse les traits de données (`creatures.json`) en propriétés psy : Peur/Terreur/Immunité (LDB 85
 *  l.143-144) ET traits ciblés (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie, LDB 21). Une Cible
 *  « (un au choix) » reste indéfinie → trait inerte (ne déclenche pas) tant qu'une Cible n'est pas
 *  assignée (éditeur). `psychTraits` n'est présent que s'il y a au moins un trait ciblé. */
export function parsePsychTraits(traits: string[]): { causesPeur?: number; causesTerreur?: number; psychImmune?: boolean; psychTraits?: PsychTrait[] } {
  const out: { causesPeur?: number; causesTerreur?: number; psychImmune?: boolean; psychTraits?: PsychTrait[] } = {};
  for (const t of traits) {
    const peur = t.match(/^Peur\s+(\d+)/i);
    const terreur = t.match(/^Terreur\s+(\d+)/i);
    if (peur) out.causesPeur = Number(peur[1]);
    if (terreur) out.causesTerreur = Number(terreur[1]);
    if (/Immunit[ée].*Psychologie/i.test(t)) out.psychImmune = true;
    for (const { re, type } of TARGETED_TRAITS) {
      const m = t.match(re);
      if (!m) continue;
      const raw = m[1].trim();
      const cible = raw === '' || /au choix/i.test(raw) ? undefined : raw; // « un au choix » → inerte
      const trait: PsychTrait = { type, cible };
      if (type === 'phobie') trait.indice = /^effray/i.test(t) ? 0 : 1; // Phobie = Peur 1 ; Effrayé = Peur 0 (LDB 85 p.339)
      (out.psychTraits ??= []).push(trait);
    }
  }
  return out;
}

/** Baume pour un esprit blessé (LDB 42) : « Tous les Traits Psychologiques sont retirés pour la
 *  durée du Miracle » — les Traits psy de `c` sont DÉPLACÉS hors de la fiche (à porter par
 *  l'ActiveEffect `suppressedPsych`) ; les afflictions actives (`psychState`), dérivées des
 *  Traits, sont apaisées avec eux. Retourne les Traits suspendus, ou null s'il n'y en a aucun. */
export function suppressPsychTraits(c: Combatant): PsychTrait[] | null {
  const traits = c.psychTraits ?? [];
  if (!traits.length) return null;
  c.psychTraits = [];
  c.psychState = [];
  return traits;
}

/** Restitue les Traits psy suspendus par les effets EXPIRÉS (fin de Round OU échéance d'horloge). */
export function restoreSuppressedPsych(c: Combatant, expired: { suppressedPsych?: PsychTrait[] }[]): void {
  for (const e of expired) {
    if (e.suppressedPsych?.length) c.psychTraits = [...(c.psychTraits ?? []), ...e.suppressedPsych];
  }
}

/** Peur/Terreur inspirée par la Taille (LDB 85 l.317-318), du point de vue de `self` face à `foe` :
 *  écart ≥ 1 cat. → Peur (Indice = écart) ; ≥ 2 → Terreur. `foe` plus petit/égal → rien. */
export function peurTerreurFromSize(foe?: SizeCategory, self?: SizeCategory): { kind: 'peur' | 'terreur'; indice: number } | null {
  const gap = sizeGap(foe, self); // > 0 si `foe` est plus grand
  if (gap >= 2) return { kind: 'terreur', indice: gap };
  if (gap >= 1) return { kind: 'peur', indice: gap };
  return null;
}

/**
 * Immunité à la Psychologie — PRÉDICAT CENTRAL (toute source d'immunité passe par ici) :
 * - trait « Immunité (Psychologie) » (`psychImmune`, LDB 85 l.143-144) ;
 * - Frénésie active (LDB 21 l.34) ;
 * - Détermination « immunisé à Psychologie jusqu'à la fin du prochain Round » (LDB 17 l.62), via le
 *   compteur `psychImmuneRoundsLeft` (décrémenté au passage de Round) → l'immunité ne fait que RETARDER :
 *   à expiration, les déclencheurs/effets reprennent (sauf si la source est morte entre-temps).
 * Round-indépendant : utilisable autant dans les déclencheurs (collectHeroPsych…) que dans les
 * modificateurs purs (attackModifiers). Futurs Talents/effets d'immunité psy : ajouter ICI.
 */
export function isPsychImmune(c: Combatant, foesMaxAdvantage?: number): boolean {
  // Belliqueux (LDB 85 p.338) : « Tant qu'elle a plus d'Avantages que son adversaire, elle gagne
  // Immunité Psychologique » — `foesMaxAdvantage` = le meilleur Avantage de ses adversaires ENGAGÉS
  // (fourni par les appelants qui ont le contexte de bataille ; absent ⇒ trait inerte).
  if (foesMaxAdvantage != null && bellicosePsychImmune(c, foesMaxAdvantage)) return true;
  return !!c.psychImmune || !!c.frenzied || (c.psychImmuneRoundsLeft ?? 0) > 0;
}

/** À sang-froid (LDB 85 p.338) : « Elle peut inverser tous ses Tests de Force Mentale échoués » —
 *  un jet RATÉ est relu avec ses chiffres inversés (91 → 19) si cela le rend réussi. Pur. */
export function coldBloodedAdjust(
  t: { roll: number; target: number; success: boolean; sl: number },
  coldBlooded: boolean,
): { roll: number; target: number; success: boolean; sl: number } {
  if (!coldBlooded || t.success) return t;
  const rev = t.roll === 100 ? 100 : (t.roll % 10) * 10 + Math.floor(t.roll / 10) || 100; // 30 → 3 ; « 00 » inchangé
  const e = evaluateTest(rev, t.target);
  return e.success ? { roll: e.roll, target: e.target, success: e.success, sl: e.sl } : t;
}

/** Détermination (LDB 17 l.62) : immunité à la Psychologie jusqu'à la fin du prochain Round. */
export function spendResolveForPsychImmunity(c: Combatant): string | null {
  if ((c.resolve ?? 0) <= 0) return null;
  c.resolve = (c.resolve ?? 0) - 1;
  c.psychImmuneRoundsLeft = 2;
  return `${c.name} : immunisé à la Psychologie jusqu'à la fin du prochain Round (Détermination).`;
}

/** Retire de TOUS les combattants les afflictions psychologiques (Peur/Terreur/traits ciblés)
 *  générées par la créature `deadId` — LDB : les effets psy d'une créature prennent fin à sa mort.
 *  Mute `psychState`. (Les États génériques déjà acquis, ex. Brisé, restent — ils ont leur propre
 *  récupération ; seul le lien Peur↔source disparaît, donc plus de re-Test ni de −1 DR vs la source.) */
export function clearPsychOf(all: Combatant[], deadId: string): void {
  for (const c of all) {
    if (c.psychState?.length) c.psychState = c.psychState.filter((p) => p.sourceId !== deadId);
  }
}

/** Le combattant peut-il entrer en Frénésie (LDB 21 l.31) ? Trait de créature OU Talent « Frénésie ». */
export function isFrenzyCapable(c: Combatant): boolean {
  return (c.traits ?? []).some((t) => /^Frénésie/i.test(t)) || (c.talents ?? []).some((t) => /^Frénésie/i.test(t.name));
}

/** Test de Force Mentale pour entrer en Frénésie (LDB 21 l.32). Succès → on entre. */
export function resolveFrenzyEntry(fm: number, rng: RNG = defaultRNG): { success: boolean; roll: number; target: number; sl: number } {
  const t = rollTest(fm, 'intermediaire', rng);
  return { success: t.success, roll: t.roll, target: t.target, sl: t.sl };
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
  coldBlooded = false, // À sang-froid (LDB 85 p.338) : inverse un Test de FM raté
): { dr: number; calmeDR: number; vaincue: boolean; roll: number; target: number; sl: number; success: boolean } {
  const t = coldBloodedAdjust(rollTest(calme, 'intermediaire', rng), coldBlooded);
  const dr = t.success ? Math.max(0, t.sl) : 0;
  const calmeDR = prevDR + dr;
  return { dr, calmeDR, vaincue: calmeDR >= indice, roll: t.roll, target: t.target, sl: t.sl, success: t.success };
}

/** Traits ciblés visant un ALLIÉ (on les défend) plutôt qu'un ennemi (LDB 21 : Amour l.74, Camaraderie l.79). */
const TARGETS_ALLY = new Set<PsychType>(['amour', 'camaraderie']);

/** Premier Trait psy CIBLÉ de `self` déclenché ce Round : un membre du groupe `cible` est VISIBLE
 *  (ennemi pour animosite/haine/prejuge/phobie ; allié pour amour/camaraderie) et le trait n'est pas
 *  déjà en affliction active. `visible` = combattants en Ligne de Vue (filtrée par l'appelant, couche
 *  state). Une Cible indéfinie (« un au choix ») est inerte. Pur. Phobie porte son Indice (Peur 1). */
export function targetedTrigger(self: Combatant, visible: Combatant[]): { type: PsychType; cible: string; sourceId: string; indice?: number } | null {
  for (const tr of self.psychTraits ?? []) {
    if (!tr.cible) continue; // « un au choix » → inerte
    if ((self.psychState ?? []).some((p) => p.type === tr.type && p.cible === tr.cible)) continue; // déjà testé/actif
    const wantAlly = TARGETS_ALLY.has(tr.type);
    const m = visible.find(
      (v) => v.id !== self.id && (wantAlly ? v.kind === self.kind : v.kind !== self.kind) && groupMatch(tr.cible!, v.groups ?? []),
    );
    if (m) return { type: tr.type, cible: tr.cible, sourceId: m.id, indice: tr.indice };
  }
  return null;
}

/** Test de Psychologie SIMPLE (Calme, Intermédiaire +0) d'un trait ciblé (LDB 21) : succès = résisté.
 *  Binaire (pas de Test étendu) — contrairement à la Peur. */
export function resolveCalmeSimple(calme: number, rng: RNG = defaultRNG): { success: boolean; roll: number; sl: number; target: number } {
  const t = rollTest(calme, 'intermediaire', rng);
  return { success: t.success, roll: t.roll, sl: t.sl, target: t.target };
}

/** Test de Terreur à la 1ʳᵉ rencontre (LDB 21 l.55-57) : échec → Brisé = Indice + |DR négatifs| ;
 *  ensuite la créature cause une Peur d'Indice équivalent (`devientPeur`). */
export function resolveTerreurTest(
  calme: number,
  indice: number,
  rng: RNG = defaultRNG,
  coldBlooded = false, // À sang-froid (LDB 85 p.338) : inverse un Test de FM raté
): { success: boolean; brise: number; devientPeur: number; roll: number; target: number; sl: number } {
  const t = coldBloodedAdjust(rollTest(calme, 'intermediaire', rng), coldBlooded);
  const brise = t.success ? 0 : indice + Math.max(0, -t.sl);
  return { success: t.success, brise, devientPeur: indice, roll: t.roll, target: t.target, sl: t.sl };
}
