/**
 * Psychologie WFRP4 (Livre de base `21 - Psychologie.md`). Cœur PUR : déclenchement et résolution
 * des Tests de Calme / Psychologie. Jeu sans MJ → difficulté par défaut **Intermédiaire (+0)** (les
 * exemples du livre l'utilisent). P1 = Peur (Indice) / Terreur (Indice). Cf. spec :
 * docs/superpowers/specs/2026-06-07-psychologie-design.md
 */
import { Combatant } from './types';
import { t } from '../i18n';
import { RNG, defaultRNG } from './dice';
import { rollTest, evaluateTest } from './tests';
import { effectiveChar } from './characteristics';
import { findPsychologyById } from '../data';
import { SizeCategory, sizeGap } from './size';
import { groupMatch } from './groups';
import { bellicosePsychImmune, hasTraitKey } from './traits/dispatch';
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

/** Libellés des Traits psy ciblés (LDB 21) — partagé par les modales psy (combat + rencontre) ET la
 *  narration d'issue (state). Déplacé depuis ui/psychLabels pour que la couche state y accède. */
export const CIBLE_LABEL: Record<string, { emoji: string; label: string }> = {
  animosite: { emoji: '😤', label: t('cible.animosite') },
  haine: { emoji: '😡', label: t('cible.haine') },
  prejuge: { emoji: '🙄', label: t('cible.prejuge') },
  amour: { emoji: '❤️', label: t('cible.amour') },
  camaraderie: { emoji: '🤝', label: t('cible.camaraderie') },
  phobie: { emoji: '🕷️', label: t('cible.phobie') },
};

/** Source de Peur/Terreur que `foe` représente pour `self` : combine la Taille (LDB 85) et l'Indice
 *  inspiré au statbloc (`causesPeur`/`causesTerreur`). Terreur prime ; sinon le plus haut Indice. Pur.
 *  NB : « Sans Peur (Ennemi) » (LDB 10 l.864) ne supprime PLUS la source ici (ce n'était pas RAW : le
 *  talent n'accorde pas l'immunité automatique mais « un seul Test de Calme Accessible (+20) » pour
 *  l'ignorer) — la source est donc détectée, et le porteur la teste à +20 (cf. `sansPeurVs`). */
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

/** `self` possède-t-il « Sans Peur (Ennemi) » (LDB 10 l.864) contre `foe` ? Le porteur n'est PAS
 *  immunisé d'office : il teste la Peur/Terreur de cet ennemi par UN seul Test de Calme Accessible
 *  (+20). Nom sémantique pour la couche state (le prédicat sous-jacent vit dans combatFeatures). */
export function sansPeurVs(self: Combatant, foe: Pick<Combatant, 'groups'>): boolean {
  return fearImmuneVs(self, foe);
}

/** Psychologie DATA-DRIVEN (Peur/Terreur/Immunité + ciblés Animosité/Haine/Préjugé/Amour/Camaraderie/
 *  Phobie/Effrayé) : `parsePsychTraits` lit `TraitData.capabilities` (`psychType`/`psychImmune`/
 *  `psychIndice` de `traits.json`) + l'instance structurée. SOURCE UNIQUE = la DONNÉE (éditable au
 *  Codex) ; plus aucun fichier de code par trait. */
export { parsePsychTraits } from './psych/registry';

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
 * Round-indépendant : utilisable autant dans les déclencheurs (collectHeroRoundStart/EndPsych…) que
 * dans les modificateurs purs (attackModifiers). Futurs Talents/effets d'immunité psy : ajouter ICI.
 */
export function isPsychImmune(c: Combatant, foesMaxAdvantage?: number): boolean {
  // Belliqueux (LDB 85 p.338) : « Tant qu'elle a plus d'Avantages que son adversaire, elle gagne
  // Immunité Psychologique » — `foesMaxAdvantage` = le meilleur Avantage de ses adversaires ENGAGÉS
  // (fourni par les appelants qui ont le contexte de bataille ; absent ⇒ trait inerte).
  if (foesMaxAdvantage != null && bellicosePsychImmune(c, foesMaxAdvantage)) return true;
  // Immunité par DONNÉE : trait « Immunité (Psychologie) » (`c.psychImmune`), Détermination temporaire
  // (`ActiveEffect.psychImmune`), OU un état psy porté qui l'accorde (Frénésie → `psychology.json`
  // `psychImmune:true`, LDB 21 l.34) — lu GÉNÉRIQUEMENT, jamais par-nom.
  return !!c.psychImmune
    || (c.activeEffects ?? []).some((e) => e.psychImmune)
    || (c.psychState ?? []).some((p) => findPsychologyById(p.type)?.psychImmune);
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

/** Détermination (LDB 17 l.62) : immunité à la Psychologie jusqu'à la fin du prochain Round. Portée par un
 *  `ActiveEffect` à durée 2 Rounds (système de Durée unifié : décrémenté/expiré au passage de Round). */
export function spendResolveForPsychImmunity(c: Combatant): string | null {
  if ((c.resolve ?? 0) <= 0) return null;
  c.resolve = (c.resolve ?? 0) - 1;
  c.activeEffects = [
    ...(c.activeEffects ?? []).filter((e) => e.effectId !== 'determination-psych'),
    { label: 'Détermination (immunité psy)', effectId: 'determination-psych', bonus: 0, duration: { scale: 'rounds', left: 2 }, psychImmune: true },
  ];
  return t('psy.determinationImmune', { name: c.name });
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
  return hasTraitKey(c.traits, 'frenesie') || (c.talents ?? []).some((t) => t.talentId === 'frenesie');
}

/** Le combattant est-il EN Frénésie (LDB 21 l.34) ? État psychologique porté `frenesie` (`psychState`,
 *  posé par l'entrée — Action héros / décision IA / Rage) — remplace l'ancien drapeau `Combatant.frenzied`.
 *  Lu par le combat (charge, gating, +1 BF via données, immunité psy, attaque libre). */
export function isFrenzied(c: Combatant): boolean {
  return (c.psychState ?? []).some((p) => p.type === 'frenesie');
}

/** Test de Force Mentale pour entrer en Frénésie (LDB 21 l.32). Succès → on entre. */
export function resolveFrenzyEntry(fm: number, rng: RNG = defaultRNG): { success: boolean; roll: number; target: number; sl: number } {
  const t = rollTest(fm, 'intermediaire', rng);
  return { success: t.success, roll: t.roll, target: t.target, sl: t.sl };
}

/** Valeur de Calme : Force Mentale effective + avances de la compétence Calme (« Sang-froid »). */
export function calmeValue(c: Combatant): number {
  const adv = c.skills.find((s) => s.skillId === 'calme')?.advances ?? 0;
  return effectiveChar(c, 'FM') + adv;
}

/** Un Round de Test ÉTENDU de Calme contre la Peur (LDB 21 l.27) : cumule le DR jusqu'à l'Indice.
 *  `prevDR` = DR déjà accumulé. `vaincue` = la Peur est surmontée (DR cumulé ≥ Indice).
 *  `sansPeur` (Sans Peur (Ennemi), LDB 10 l.864) : « un seul Test de Calme Accessible (+20)… vous
 *  pouvez IGNORER les effets » → Test UNIQUE (binaire) à +20 ; une réussite vainc d'emblée la Peur
 *  (DR porté à l'Indice), un échec laisse le porteur sujet (re-tests ultérieurs = Peur normale +0). */
export function resolvePeurTest(
  calme: number,
  indice: number,
  prevDR: number,
  rng: RNG = defaultRNG,
  coldBlooded = false, // À sang-froid (LDB 85 p.338) : inverse un Test de FM raté
  sansPeur = false,
): { dr: number; calmeDR: number; vaincue: boolean; roll: number; target: number; sl: number; success: boolean } {
  const t = coldBloodedAdjust(rollTest(calme, sansPeur ? 'accessible' : 'intermediaire', rng), coldBlooded);
  const dr = t.success ? Math.max(0, t.sl) : 0;
  // Sans Peur : une réussite IGNORE la Peur (vaincue d'emblée → DR ≥ Indice) ; sinon cumul étendu RAW.
  const calmeDR = sansPeur && t.success ? Math.max(prevDR, indice) : prevDR + dr;
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

/** Brisé infligé par une Terreur ratée (LDB 21 l.57) : Indice + |DR négatifs| ; 0 sur un succès.
 *  SOURCE UNIQUE du calcul, partagée par la Terreur de rencontre, de combat et `resolveTerreurTest`. */
export function terreurBrise(indice: number, success: boolean, sl: number): number {
  return success ? 0 : indice + Math.max(0, -sl);
}

/** Test de Terreur à la 1ʳᵉ rencontre (LDB 21 l.55-57) : échec → Brisé = Indice + |DR négatifs| ;
 *  ensuite la créature cause une Peur d'Indice équivalent (`devientPeur`).
 *  `sansPeur` (Sans Peur (Ennemi), LDB 10 l.864) : le Test de Calme est Accessible (+20) — une
 *  réussite ignore la Terreur (et la Peur subséquente, via `devientPeur: 0`). */
export function resolveTerreurTest(
  calme: number,
  indice: number,
  rng: RNG = defaultRNG,
  coldBlooded = false, // À sang-froid (LDB 85 p.338) : inverse un Test de FM raté
  sansPeur = false,
): { success: boolean; brise: number; devientPeur: number; roll: number; target: number; sl: number } {
  const t = coldBloodedAdjust(rollTest(calme, sansPeur ? 'accessible' : 'intermediaire', rng), coldBlooded);
  return { success: t.success, brise: terreurBrise(indice, t.success, t.sl), devientPeur: sansPeur && t.success ? 0 : indice, roll: t.roll, target: t.target, sl: t.sl };
}
