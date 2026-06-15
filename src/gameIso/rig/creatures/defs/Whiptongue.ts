import type { CreatureDef } from '../types';

// Slenderthigh Whiptongue — PRINCE DÉMON DE SLAANESH (LDB 84 l.49-53 : « Cornes +15 »,
// Taille (Grande), Terreur 3, Perturbant ; creatures.json « Prince démon de Slaanesh »). Rendu
// sur le plan jabberslythe : silhouette ÉLANCÉE (girth ↓ = « Slenderthigh »), LANGUE-FOUET
// démesurée (« Whiptongue »), cornes sombres (trait Cornes +15). Esthétique slaaneshi canon
// (LDB 84 l.38, Démonette : « peau crémeuse et pâle », couleurs contre nature) : chair crème
// pâle + accents magenta profond, ailes-membrane nacrées aux nervures vineuses.
export const creature: CreatureDef = {
  name: 'Slenderthigh Whiptongue',
  plan: 'jabberslythe',
  jabber: {
    sl: 1.05, girth: 0.7, antlers: true, tongue: 2.2,
    stored: { corps: '#e8d2c4', corpsO: '#702a52', corpsH: '#f4c2e2', cheveux: '#b34a8c', cheveuxO: '#5e2148', cuir: '#dcc49c' },
  },
};
