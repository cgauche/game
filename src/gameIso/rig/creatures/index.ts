/**
 * Registre des créatures — SOURCE UNIQUE dérivée des fichiers `defs/<Nom>.ts` (auto-collectés
 * par le générateur). Tout le routage par nom (plan, espèce quad/ailée) et les tables de props
 * en découlent : plus aucun tableau central à re-maintenir.
 */
import type { QuadProps } from '../quadruped/quadSkeleton';
import type { SerpentProps } from '../serpentine/composeSerpent';
import type { SpiderProps } from '../arachnid/composeSpider';
import type { BirdProps } from '../avian/composeBird';
import type { OctopusProps } from '../cephalopod/composeOctopus';
import type { SpectreProps } from '../spectral/composeSpectre';
import type { SquigProps } from '../squig/composeSquig';
import type { HulkProps } from '../amorphous/composeHulk';
import type { JabberProps } from '../jabberslythe/composeJabber';
import type { CreatureDef, BipedConfig, CreatureBodyPlan } from './types';
import { norm } from '../../../lib/normalize';
import { CREATURES } from './_registry.generated';

export { CREATURES };
export type { CreatureDef, CreatureBodyPlan, BipedConfig } from './types';

/** Définition dont la CLÉ (nom) ou un ALIAS matche le nom donné (limite de mot). PUR. */
function matchIn(defs: CreatureDef[], name: string): CreatureDef | undefined {
  const n = norm(name);
  for (const d of defs) {
    for (const pat of [norm(d.name), ...(d.aliases ?? [])]) {
      if (new RegExp(`\\b${pat}\\b`).test(n)) return d;
    }
  }
  return undefined;
}

const QUAD = CREATURES.filter((c) => c.plan === 'quadruped');
const WING = CREATURES.filter((c) => c.plan === 'winged');
const BIPED = CREATURES.filter((c) => c.plan === 'biped');

/** Config d'espèce bipède (career/monster/sex/parts/colors) par NOM d'espèce — dérivée des
 *  fichiers defs. Remplace les tables SPECIES_* d'enemyProfile. */
const BIPED_BY_NAME: Record<string, CreatureDef> = Object.fromEntries(BIPED.map((c) => [c.name, c]));
export function bipedConfig(species: string): BipedConfig | undefined { return BIPED_BY_NAME[species]?.biped; }

// Matchers bipèdes triés par PRIORITÉ (plus bas = testé d'abord) — chaque def porte sa regex
// EXACTE `match` (reprise de l'ancien detectSpecies). L'ordre désambiguïse les chevauchements
// (« rat ogre » → Skaven avant Ogre ; « elfe sylvain » avant l'elfe générique).
const BIPED_MATCHERS = BIPED
  .filter((c) => c.match)
  .map((c) => ({ name: c.name, re: new RegExp(c.match!), pr: c.matchPriority ?? 100 }))
  .sort((a, b) => a.pr - b.pr);
/** Nom → espèce bipède (regex+priorité), ou undefined (→ Humain par défaut chez l'appelant). */
export function bipedSpeciesMatch(name: string): string | undefined {
  const n = norm(name);
  for (const m of BIPED_MATCHERS) if (m.re.test(n)) return m.name;
  return undefined;
}
/** Échelle de token d'un bipède (Géant = grand) — à multiplier au scale du token en jeu. Défaut 1. */
export function bipedSpeciesScale(name: string): number {
  const sp = bipedSpeciesMatch(name);
  return (sp ? BIPED_BY_NAME[sp]?.biped?.scale : undefined) ?? 1;
}

/** Tables de props de rendu par espèce — dérivées des fichiers defs. */
export const QUAD_SPECIES: Record<string, QuadProps> = Object.fromEntries(QUAD.map((c) => [c.name, c.quad!]));
export const WINGED_SPECIES: Record<string, QuadProps> = Object.fromEntries(WING.map((c) => [c.name, c.quad!]));

export const quadSpeciesNames = (): string[] => QUAD.map((c) => c.name);
export const wingedSpeciesNames = (): string[] => WING.map((c) => c.name);

/** Nom de créature → espèce quadrupède (clé/alias), ou undefined si aucun quad ne matche. */
export function quadSpeciesMatch(name: string): string | undefined { return matchIn(QUAD, name)?.name; }
/** Nom de créature → espèce ailée (clé/alias), ou undefined si aucun ailé ne matche. */
export function wingSpeciesMatch(name: string): string | undefined { return matchIn(WING, name)?.name; }

// --- Nouveaux squelettes (serpentin/arachnide/aviaire/céphalopode) : tables de props par
//     espèce, dérivées des defs comme quad/winged. Chaque plan lit son propre champ de props.
export const SERPENT_SPECIES: Record<string, SerpentProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'serpentine').map((c) => [c.name, c.serpent!]));
export const SPIDER_SPECIES: Record<string, SpiderProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'arachnid').map((c) => [c.name, c.spider!]));
export const BIRD_SPECIES: Record<string, BirdProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'avian').map((c) => [c.name, c.bird!]));
export const OCTOPUS_SPECIES: Record<string, OctopusProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'cephalopod').map((c) => [c.name, c.octopus!]));
export const SPECTRE_SPECIES: Record<string, SpectreProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'spectral').map((c) => [c.name, c.spectre!]));
export const SQUIG_SPECIES: Record<string, SquigProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'squig').map((c) => [c.name, c.squig!]));
export const HULK_SPECIES: Record<string, HulkProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'amorphous').map((c) => [c.name, c.hulk!]));
export const JABBER_SPECIES: Record<string, JabberProps> = Object.fromEntries(CREATURES.filter((c) => c.plan === 'jabberslythe').map((c) => [c.name, c.jabber!]));

// --- Routage GÉNÉRIQUE (registry-driven) : un nom → la def NON-bipède qui matche, quel que soit
//     son plan (quad/winged/serpentine/arachnid/avian/cephalopod OU monolithic). Plus de chaîne
//     par-plan ni de LISTE DE NOMS codée en dur (l'ex-EXOTIC_RE) : déposer un def avec son `plan`
//     suffit — même « ça reste monolithique » est un fichier def. Les bipèdes (humanoïdes nommés
//     ou génériques) sont le DÉFAUT quand rien ne matche.
const NON_BIPED = CREATURES.filter((c) => c.plan !== 'biped');
/** Def NON-bipède qui matche le nom (gabarit rigué dédié OU monolithique legacy). */
export function creatureMatch(name: string): CreatureDef | undefined { return matchIn(NON_BIPED, name); }
/** Plan corporel d'un nom non-bipède (ou undefined → bipède par défaut chez l'appelant). */
export function creaturePlanMatch(name: string): CreatureBodyPlan | undefined { return creatureMatch(name)?.plan; }
/** Échelle de token (sl) du gabarit rigué qui matche — lit le champ de props présent. Défaut 1. */
export function creatureSpeciesScale(name: string): number {
  const c = creatureMatch(name);
  return (c && (c.quad ?? c.serpent ?? c.spider ?? c.bird ?? c.octopus)?.sl) || 1;
}
