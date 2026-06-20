import type { CreatureDef } from '../types';

// Léviathan (ZI p.92) — crustacé marin géant (bernard-l'ermite × homard), pinces perforantes
// « plus dures que l'acier trempé » (Armure 6), Taille Monstrueuse. Gabarit crustacé : carapace
// large + grosses pinces. Robe rouge-acier sombre. Sans ce def, le record était rendu en bipède.
export const creature: CreatureDef = {
  name: 'Léviathan',
  plan: 'crustace',
  crab: {
    sl: 1.15, girth: 1.22,
    stored: { corps: '#7c4032', corpsO: '#42201a', corpsH: '#b26a4e', cheveux: '#42201a', cheveuxO: '#26120d', cuir: '#caa890' },
  },
};
