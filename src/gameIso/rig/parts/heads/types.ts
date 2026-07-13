/**
 * Une TÊTE = un fichier `defs/<Race>-<Sexe>.ts`. Art de face du VISAGE (variantes) + coiffure par
 * DÉFAUT de l'espèce, en tokens @peau/@cheveux (recoloriés par la palette de race). Clé `key` =
 * 'Race:Sexe' (== `baseSpeciesOf(species):sex`) → auto-matché par `cosmeticPart`. `visage` est un
 * TABLEAU de variantes (≥1) choisi par seed/override (bouton « Variante » du créateur) — MÊME
 * convention que le pool de coiffures. Les vues profil/dos du visage restent GÉNÉRIQUES (art
 * partagé dans cosmetic.ts), pas portées ici.
 */
export type HeadDef = { key: string; visage?: string[]; cheveux?: string };
