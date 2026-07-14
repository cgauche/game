import type { HairArt } from '../hairstyles/types';

/**
 * Une TÊTE = un fichier `defs/<Race>-<Sexe>.ts`. Art de face du VISAGE (variantes) + coiffure par
 * DÉFAUT de l'espèce, en tokens @peau/@cheveux (recoloriés par la palette de race). Clé `key` =
 * 'Race:Sexe' (== `baseSpeciesOf(species):sex`) → auto-matché par `cosmeticPart`. `visage` est un
 * TABLEAU de variantes (≥1) choisi par seed/override (bouton « Variante » du créateur) — MÊME
 * convention que le pool de coiffures. La coiffure par défaut porte SES vues (cf. `HairArt`,
 * profil/dos/`behind` compris) — seules les vues profil/dos du VISAGE restent génériques
 * (art partagé dans cosmetic.ts).
 */
export type HeadDef = { key: string; visage?: string[]; cheveux?: HairArt };
