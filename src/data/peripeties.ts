/**
 * Table des Péripéties de voyage (1d10) — VERBATIM du Livre de base, section « Voyage »
 * (fichier source `51 - Magie du Chaos.md`, l.241-252 ; découpage OCR, contenu = chapitre MJ).
 *
 * La DONNÉE vit dans `peripeties.json` (éditable, comme `creatures.json`) ; ce module = type +
 * chargement. Ajouter/régler une péripétie = éditer le JSON, jamais ce fichier.
 *
 * « Certains MJ préfèrent lancer 1d10 par jour de voyage et faire survenir un événement sur un
 * résultat de 8 » (l.237) → le SEUIL est paramétrable par route (`perilDie`, défaut 8, 0 = off).
 *
 * `kind` = ce que le MOTEUR sait jouer sans rien inventer :
 *  - 'reposant'  (1)  : soin de toutes les Blessures + retrait de tous les Exténué ;
 *  - 'ereintant' (4)  : Test de Survie en extérieur Accessible (+20) sinon +1 jour et +1 Exténué ;
 *  - 'attaque'   (10) : Test de Perception Accessible (+20) raté → embuscade (rencontre de la route ;
 *                       sans rencontre configurée → narratif au journal) ;
 *  - 'narratif'  (2,3,5-9) : matière à narration (PNJ, vols, rivaux…), journalisée telle quelle.
 */
import peripetiesJson from './peripeties.json';

export interface Peripetie {
  roll: number;
  label: string;
  text: string;
  kind: 'reposant' | 'narratif' | 'ereintant' | 'attaque';
}

export const PERIPETIES = peripetiesJson as Peripetie[];
