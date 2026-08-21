/**
 * FAÇADE des teintes de SURBRILLANCE d'arène (grilles de portée, zones, anneaux de cible, bandes de
 * portée, halos d'interaction/d'actif, lien d'engagement, refus de visée). La DONNÉE vit dans
 * `src/data/teintesJeu.json` (schéma et invariants : `src/data/schemas/defs/teintesJeu.ts`) ; ce
 * module la NOMME pour les peintres. Catalogue TS et non variables CSS : le backend volumique
 * (`THREE.Color`) ne résout pas `var(--x)`, et l'environnement de test `node` n'a pas de CSS.
 *
 * Les vars CSS homonymes de `src/ui/styles/base.css` servent les feuilles de style ;
 * `HIGHLIGHT_TINTS` en est la projection `id de teinte → var CSS`, et `highlightTints.test.ts` garde
 * l'égalité des deux valeurs — une retouche d'un seul côté ferait diverger la couleur à l'écran.
 *
 * `teamColors.ts` sert l'autre moitié du même JSON : l'IDENTITÉ d'unité (anneaux réservés, teintes
 * d'équipe, couleurs par héros). Les deux familles ne partagent aucun octet, sauf partage NOMMÉ au
 * schéma (`PARTAGES_NOMMES`) ou entrée UNIQUE lue des deux côtés — c'est le cas de `anneau-actif`,
 * le MÊME signal « voici l'unité qui joue », servi ici en halo de case et là en anneau/voile.
 */
import { teintesJeu } from '../data';
import type { TeinteId } from '../data/schemas/defs/teintesJeu';

/** Teinte → var CSS de repli homonyme (`src/ui/styles/base.css`), la table de la garde d'égalité.
 *  CRITÈRE d'entrée : la var est DÉCLARÉE dans `base.css`. Une teinte sans var déclarée n'y figure
 *  pas (les huit teintes d'identité, que seul le volumique peint) ; le NOMBRE de feuilles qui
 *  consomment la var n'est pas le critère — `base.css` est une base de tokens, et la mesure du
 *  2026-08-21 donne 5 vars consommées sur les 19 projetées (`--combat-gold` 10, `--combat-enemy` 4,
 *  `--combat-ally` 3, `--combat-walk` 1, `--iso-active-halo` 1). Ce que la table garde est l'ÉGALITÉ
 *  des deux valeurs, pas la popularité de la var. */
export const HIGHLIGHT_TINTS = {
  'zone-marche': '--combat-walk',
  'zone-course': '--combat-run',
  'zone-intention': '--combat-intent',
  'zone-fumee': '--iso-zone-smoke',
  'zone-feu': '--iso-zone-fire',
  'bande-bonus': '--combat-range-bonus',
  'bande-neutre': '--combat-range-neutre',
  'bande-malus': '--combat-range-malus',
  'signal-cible': '--combat-target',
  'signal-foule': '--combat-crowd',
  'signal-allie': '--combat-ally',
  'signal-ennemi': '--combat-enemy',
  'signal-engagement': '--iso-engage',
  'signal-menace': '--iso-threat',
  'signal-invalide': '--iso-invalid',
  'or-surbrillance': '--combat-gold',
  'or-contour': '--combat-gold-dk',
  'or-halo': '--combat-halo',
  'anneau-actif': '--iso-active-halo',
} as const satisfies Partial<Record<TeinteId, string>>;

/** Portée de Marche. */
export const WALK_TINT = teintesJeu['zone-marche'];
/** Portée de Course. */
export const RUN_TINT = teintesJeu['zone-course'];
/** Portée de l'INTENTION armée depuis l'interface (spec HUD zone 4) — distincte de Marche et Course :
 *  elle se superpose à elles pour dire « voilà jusqu'où porte LE geste que j'ai choisi ». */
export const INTENT_TINT = teintesJeu['zone-intention'];
/** Anneau d'une cible d'attaque. */
export const RING_TARGET_TINT = teintesJeu['signal-cible'];
/** Repère ENNEMI d'un télégraphe d'IA (tracé de déplacement, réticule de visée) — distinct de
 *  `ENEMY_TINT` (teamColors), qui est la couleur d'IDENTITÉ d'équipe. */
export const ENEMY_CUE_TINT = teintesJeu['signal-ennemi'];
/** Anneau d'une cible éligible à la Foule. */
export const RING_CROWD_TINT = teintesJeu['signal-foule'];
/** Anneau d'une cible alliée. */
export const RING_ALLY_TINT = teintesJeu['signal-allie'];
/** Gabarit de visée REFUSÉ : case hors portée ou hors Ligne de Vue. */
export const INVALID_TINT = teintesJeu['signal-invalide'];
/** Surbrillance or : trajet d'aperçu, réticule héros, halo d'interaction. */
export const GOLD_TINT = teintesJeu['or-surbrillance'];
/** Contour sombre du glyphe or. */
export const GOLD_DARK_TINT = teintesJeu['or-contour'];
/** Halo d'interaction (survol PNJ/objet). */
export const HALO_TINT = teintesJeu['or-halo'];
/** Zone persistante opaque (fumée). */
export const ZONE_SMOKE_TINT = teintesJeu['zone-fumee'];
/** Zone de feu/effet. */
export const ZONE_FIRE_TINT = teintesJeu['zone-feu'];
/** Lien d'engagement (tether de mêlée). */
export const ENGAGE_TINT = teintesJeu['signal-engagement'];
/** Télégraphe de ZONE ennemie (l'aire annoncée avant résolution). */
export const THREAT_TINT = teintesJeu['signal-menace'];
/** Contour de case active / position du groupe — MÊME entrée que l'anneau d'unité active
 *  (`ACTIVE_RING`/`ACTIVE_TINT`, `teamColors.ts`) : un seul signal, trois surfaces. */
export const ACTIVE_HALO_TINT = teintesJeu['anneau-actif'];

/** Bande de portée d'un tir, par ton de modificateur (`builders/highlights`, kind `rangeBand`). */
export const RANGE_BAND_TINT: Record<'bonus' | 'neutre' | 'malus', string> = {
  bonus: teintesJeu['bande-bonus'],
  neutre: teintesJeu['bande-neutre'],
  malus: teintesJeu['bande-malus'],
};
