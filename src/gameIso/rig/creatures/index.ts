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
import type { CreatureDef, CreatureBodyPlan } from './types';
import { norm } from '../../../lib/normalize';
import { CREATURES } from './_registry.generated';
import { raceById } from '../races';
import { baseSpeciesOf } from '../skeletons';

export { CREATURES };
export type { CreatureDef, CreatureBodyPlan, CreaturePerso } from './types';

/** Définition dont la CLÉ (nom) ou un ALIAS matche le nom donné (limite de mot). PUR.
 *  `aliasOnly` (rare) retire le nom des déclencheurs : seuls les alias matchent (cf. « Démon »). */
function matchIn(defs: CreatureDef[], name: string): CreatureDef | undefined {
  const n = norm(name);
  for (const d of defs) {
    const pats = d.aliasOnly ? (d.aliases ?? []) : [norm(d.name), ...(d.aliases ?? [])];
    for (const pat of pats) {
      if (new RegExp(`\\b${pat}\\b`).test(n)) return d;
    }
  }
  return undefined;
}

const QUAD = CREATURES.filter((c) => c.plan === 'quadruped');
const WING = CREATURES.filter((c) => c.plan === 'winged');
const BIPED = CREATURES.filter((c) => c.plan === 'biped');

/** Def bipède par NOM d'espèce — dérivée des fichiers defs. Les défauts d'apparence
 *  (tenue/monster/sex/parts/colors) vivent désormais sur la Race (cf. `raceById`) ;
 *  les surcharges propres à une créature non-canonique vivent sur `def.perso`. */
const BIPED_BY_NAME: Record<string, CreatureDef> = Object.fromEntries(BIPED.map((c) => [c.name, c]));
/** Def bipède canonique par nom (lookup direct), ou undefined. */
export function bipedDef(name: string): CreatureDef | undefined { return BIPED_BY_NAME[name]; }

/** Def par espèce CANONIQUE (lookup EXACT par `name`, tous plans) — la résolution data-driven
 *  (de-POC) : une entité porte son espèce explicite → on lit sa def sans match flou sur un nom libre. */
const DEF_BY_NAME: Record<string, CreatureDef> = Object.fromEntries(CREATURES.map((c) => [c.name, c]));
export function defByName(species: string): CreatureDef | undefined { return DEF_BY_NAME[species]; }
/** Échelle de token d'une espèce canonique (lookup exact) — bipède via race, non-bipède via props. */
export function speciesScale(species: string): number {
  const d = DEF_BY_NAME[species];
  if (!d) return 1;
  if (d.plan === 'biped') return d.perso?.scale ?? raceById(d.race ?? baseSpeciesOf(species)).scale ?? 1;
  return (d.quad ?? d.serpent ?? d.spider ?? d.bird ?? d.octopus ?? d.spectre ?? d.squig ?? d.hulk ?? d.jabber)?.sl ?? 1;
}

// Bipèdes triés par PRIORITÉ (plus bas = testé d'abord), comme les non-bipèdes : la résolution
// passe par `matchIn` (nom + `aliases`, limite de mot) — plus aucune regex `match` à la main.
// L'ordre désambiguïse les chevauchements (« rat ogre » → Rat ogre/Skaven avant Ogre ; « elfe
// sylvain » avant l'elfe générique). Tri STABLE → l'ordre du registre départage les ex æquo.
const BIPED_BY_PRIORITY = [...BIPED].sort((a, b) => (a.matchPriority ?? 100) - (b.matchPriority ?? 100));
/** Nom → espèce bipède (nom/alias + priorité), ou undefined (→ Humain par défaut chez l'appelant). */
export function bipedSpeciesMatch(name: string): string | undefined {
  return matchIn(BIPED_BY_PRIORITY, name)?.name;
}
/** Échelle de token d'un bipède (Géant = grand) — à multiplier au scale du token en jeu. Défaut 1.
 *  Résout l'espèce (regex+priorité), puis échelle = perso.scale ?? race.scale ?? 1. */
export function bipedSpeciesScale(name: string): number {
  const sp = bipedSpeciesMatch(name);
  if (!sp) return 1;
  const d = BIPED_BY_NAME[sp];
  return d?.perso?.scale ?? raceById(d?.race ?? baseSpeciesOf(sp)).scale ?? 1;
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
/** Noms canon des créatures riggées — source du sélecteur d'apparence de l'éditeur
 *  (remplace l'ex-`creatureNames()` qui listait les clés du bestiaire monolithique). */
export const creatureSpeciesNames = (): string[] => CREATURES.map((c) => c.name);
/** Échelle de token (sl) du gabarit rigué qui matche — lit le champ de props présent, QUEL QUE
 *  SOIT le plan (jabber/squig/hulk/spectre compris — leur sl était ignoré avant). Défaut 1. */
export function creatureSpeciesScale(name: string): number {
  const c = creatureMatch(name);
  return (c && (c.quad ?? c.serpent ?? c.spider ?? c.bird ?? c.octopus ?? c.spectre ?? c.squig ?? c.hulk ?? c.jabber)?.sl) || 1;
}
