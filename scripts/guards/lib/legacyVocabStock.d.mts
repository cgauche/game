export interface SiteVocab {
  /** Chemin POSIX depuis la racine du dépôt. */
  fichier: string;
  /** Libellé de la famille qui a signalé le site — TROISIÈME composante de la clé (un commentaire à
   *  deux motifs = deux lignes de stock). */
  motif: string;
  /** Ancre de TEXTE recopiée du commentaire (jamais un numéro de ligne). */
  ancre: string;
  /** Chantier qui éteint la ligne, pris dans l'ensemble FERMÉ des lots de #1486 (validé par le test). */
  lot: string;
  /** Date de la mesure d'origine. */
  date: string;
}

export const LEGACY_VOCAB_SITES: SiteVocab[];
