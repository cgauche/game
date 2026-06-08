/**
 * Source UNIQUE des couleurs d'identité d'équipe (anneaux des pions + portraits HUD)
 * et de la couleur d'une barre de vie. Utilisée par le rendu iso (IsoStage, BodyToken)
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
