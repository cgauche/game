import type { CultDef } from '../types';

// Culte app-owned (registre auto-chargé) — éditable à la main ou via l'éditeur de données in-app.
export const cult: CultDef = {
  "key": "Evawn",
  "title": "Déesse des voyages",
  "blessings": [
    "Bénédiction de Charisme",
    "Bénédiction de Courage",
    "Bénédiction de Chance",
    "Bénédiction de Finesse",
    "Bénédiction de Protection",
    "Bénédiction de Vigueur"
  ],
  "miracles": [
    "Invitation",
    "Abri de Rhya",
    "Riche, pauvre, mendiant, voleur"
  ],
  "desc": "<b>Sphères: </b>Voyage, Commerce, Vol<br><b>Adorateurs: </b>Marchands, Or, mendiants, objets volés, voleurs artefacts étrangers<br><br>Evawn est la déesse des voyages, du commerce et du vol. Elle apparaît comme une gnome inoffensive d'âge moyen portant sur son dos une haute pile de marchandises, au sommet de laquelle est perchée une pie. Ceux qui suivent ses enseignements errent à travers le monde, échangeant leurs biens contre des produits locaux tout en dérobant tout ce qui peut être utile aux gnomes du monde entier.<br><b><h3>Commandements</h3></b><ul><li>Une pièce sur dix appartient à Evawn.</li><li>Réaliser un profit chaque jour, que ce soit par le vol ou par le négoce.</li><li>Ne jamais être pris en train de mentir.</li><li>Ne jamais rester au même endroit plus d'un mois.</li><li>Voler les objets utiles aux gnomes et les ramener à son clan.</li></ul>",
  "source": {
    "book": "NADJ",
    "page": 90
  }
};
