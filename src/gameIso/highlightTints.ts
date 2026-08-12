/**
 * Source UNIQUE des teintes de SURBRILLANCE d'arène (grilles de portée, zones, anneaux de cible,
 * bandes de portée, halos d'interaction/d'actif, lien d'engagement). Catalogue TS et non variables
 * CSS : le backend volumique (`THREE.Color`) ne résout pas `var(--x)`, et l'environnement de test
 * `node` n'a pas de CSS — un peintre volumique doit pouvoir lire la valeur (#1176 P3-0a).
 *
 * Les valeurs sont celles des vars CSS homonymes de `src/ui/styles/base.css`, dont
 * `highlightTints.test.ts` garde l'égalité. MORT PLANIFIÉE : les tokens CSS `--combat-*`/`--iso-*` de
 * surbrillance disparaissent avec la voie affine SVG (#1176 lot P3-4) ; la garde d'égalité tombe avec eux,
 * ce catalogue reste seul.
 *
 * `teamColors.ts` porte l'IDENTITÉ d'équipe (anneaux, teintes allié/ennemi/actif) — rôles disjoints, alors
 * même que deux octets coïncident : `ACTIVE_HALO_TINT` == `ACTIVE_RING`/`ACTIVE_TINT` (#ffe066) et
 * `WALK_TINT` == `HERO_RING[0]` (#4f8fe0). Même octet, deux rôles : coïncidence de palette, pas une
 * dépendance — aucune garde ne les lie, chaque source bouge de son côté.
 */

/** Teinte par var CSS homonyme — l'entrée de catalogue, clé de la garde d'égalité. */
export const HIGHLIGHT_TINTS = {
  '--combat-walk': '#4f8fe0',
  '--combat-run': '#9b6be0',
  '--combat-target': '#ff5a4d',
  '--combat-enemy': '#e0533a',
  '--combat-crowd': '#ff7a3c',
  '--combat-ally': '#5db87a',
  '--combat-range-bonus': '#5db87a',
  '--combat-range-neutre': '#d9b23c',
  '--combat-range-malus': '#e0533a',
  '--combat-gold': '#ffd75e',
  '--combat-gold-dk': '#7a5b16',
  '--combat-halo': '#ffe27a',
  '--iso-zone-smoke': '#9aa0a6',
  '--iso-zone-fire': '#e2641e',
  '--iso-engage': '#d98a3a',
  '--iso-threat': '#d11a1a',
  '--iso-active-halo': '#ffe066',
} as const;

/** Portée de Marche. */
export const WALK_TINT = HIGHLIGHT_TINTS['--combat-walk'];
/** Portée de Course. */
export const RUN_TINT = HIGHLIGHT_TINTS['--combat-run'];
/** Anneau d'une cible d'attaque. */
export const RING_TARGET_TINT = HIGHLIGHT_TINTS['--combat-target'];
/** Repère ENNEMI d'un télégraphe d'IA (tracé de déplacement, réticule de visée) — distinct de
 *  `ENEMY_TINT` (teamColors), qui est la couleur d'IDENTITÉ d'équipe. */
export const ENEMY_CUE_TINT = HIGHLIGHT_TINTS['--combat-enemy'];
/** Anneau d'une cible éligible à la Foule. */
export const RING_CROWD_TINT = HIGHLIGHT_TINTS['--combat-crowd'];
/** Anneau d'une cible alliée. */
export const RING_ALLY_TINT = HIGHLIGHT_TINTS['--combat-ally'];
/** Surbrillance or : trajet d'aperçu, réticule héros, halo d'interaction. */
export const GOLD_TINT = HIGHLIGHT_TINTS['--combat-gold'];
/** Contour sombre du glyphe or. */
export const GOLD_DARK_TINT = HIGHLIGHT_TINTS['--combat-gold-dk'];
/** Halo d'interaction (survol PNJ/objet). */
export const HALO_TINT = HIGHLIGHT_TINTS['--combat-halo'];
/** Zone persistante opaque (fumée). */
export const ZONE_SMOKE_TINT = HIGHLIGHT_TINTS['--iso-zone-smoke'];
/** Zone de feu/effet. */
export const ZONE_FIRE_TINT = HIGHLIGHT_TINTS['--iso-zone-fire'];
/** Lien d'engagement (tether de mêlée). */
export const ENGAGE_TINT = HIGHLIGHT_TINTS['--iso-engage'];
/** Télégraphe de ZONE ennemie (l'aire annoncée avant résolution). */
export const THREAT_TINT = HIGHLIGHT_TINTS['--iso-threat'];
/** Contour de case active / position du groupe. */
export const ACTIVE_HALO_TINT = HIGHLIGHT_TINTS['--iso-active-halo'];

/** Bande de portée d'un tir, par ton de modificateur (`builders/highlights`, kind `rangeBand`). */
export const RANGE_BAND_TINT: Record<'bonus' | 'neutre' | 'malus', string> = {
  bonus: HIGHLIGHT_TINTS['--combat-range-bonus'],
  neutre: HIGHLIGHT_TINTS['--combat-range-neutre'],
  malus: HIGHLIGHT_TINTS['--combat-range-malus'],
};
