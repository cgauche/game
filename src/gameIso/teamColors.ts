/**
 * Source UNIQUE des couleurs d'identité d'équipe (anneaux des pions + portraits HUD)
 * et de la couleur d'une barre de vie. Utilisée par le rendu de carte (IsoStage, surcouche de jetons)
 * ET par le HUD React (ActionBar, CampaignView) — pas de duplication.
 */

/** Anneau jaune de l'unité active sur le terrain (réservé : ne JAMAIS l'utiliser pour une équipe). */
export const ACTIVE_RING = '#ffe066';

/** Anneau des ennemis (rouge — réservé : ne JAMAIS l'utiliser pour un héros). */
export const ENEMY_RING = '#c0392b';

/**
 * Anneaux d'identité des héros (un par héros, cyclique). 4 couleurs FROIDES distinctes,
 * choisies pour qu'AUCUNE ne puisse se confondre avec le rouge ennemi ni le jaune actif
 * (c'était le bug « un allié a un rond rouge » : l'or et le magenta tiraient vers le chaud).
 */
export const HERO_RING = ['#4f8fe0', '#37c07a', '#36b6c0', '#7a6cff'];

/**
 * Teintes SÉMANTIQUES d'équipe (Lot 1) — case sous le pion + voile léger sur le modèle :
 * allié = vert, ennemi = rouge, unité active = jaune (prime sur la couleur d'équipe pour la case).
 * Distinct des anneaux d'IDENTITÉ par héros (HERO_RING), qui restent un indice secondaire.
 */
export const ALLY_TINT = '#37c07a';
export const ENEMY_TINT = '#c0392b';
export const ACTIVE_TINT = '#ffe066';
/** Cible NEUTRE (npc) : or/jaune — distinct du jaune ACTIF réservé (#ffe066). */
export const NEUTRAL_TINT = '#ffd75e';

/** Couleur de la RELATION d'une cible au survol/visée (réticule + halo) : adversaire rouge, allié
 *  vert, neutre or. Source unique consommée par le rendu de ciblage (IsoStage). */
export function relationColor(kind: 'hero' | 'enemy' | 'npc'): string {
  return kind === 'enemy' ? ENEMY_TINT : kind === 'hero' ? ALLY_TINT : NEUTRAL_TINT;
}

/** Couleur de teinte d'une CASE selon l'appartenance (l'actif prime). */
export function tileTint(isHero: boolean, active: boolean): string {
  return active ? ACTIVE_TINT : isHero ? ALLY_TINT : ENEMY_TINT;
}

/**
 * Canal d'appartenance INDÉPENDANT de la teinte (R9 — daltonisme ~8 % des hommes) : la FORME de l'anneau
 * encode l'équipe en plus de sa couleur. Héros = anneau PLEIN (undefined) ; ennemi = anneau POINTILLÉ.
 * Renvoie un `strokeDasharray` SVG (ou undefined pour un trait plein). Source unique consommée par les
 * pions de terrain (`stage/TokenChromeOverlay`) et les portraits HUD (RigPortrait).
 */
export function teamShape(isHero: boolean): string | undefined {
  return isHero ? undefined : '5 3';
}

/** Couleur du VOILE d'équipe sur le modèle (encode l'équipe ; l'« actif » est porté par le halo/la case). */
export function veilTint(isHero: boolean): string {
  return isHero ? ALLY_TINT : ENEMY_TINT;
}

/**
 * Couleur PLEINE d'une barre de vie selon le ratio (PB courant / max) :
 * rouge sombre à 0, rouge en zone critique, orange entamé, vert sain.
 * (Corrige l'ancien dégradé rouge→vert figé qui laissait le bord vert même blessé.)
 */
export function hpColor(ratio: number): string {
  const r = Math.max(0, Math.min(1, ratio));
  if (r <= 0) return '#922b21'; // mort / 0 PB
  if (r <= 0.34) return '#e74c3c'; // critique
  if (r <= 0.67) return '#e8a33d'; // entamé
  return '#2ecc71'; // sain
}
