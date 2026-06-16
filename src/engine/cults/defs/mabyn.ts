import type { CultDef } from '../types';

// Culte app-owned (registre auto-chargé) — éditable à la main ou via l'éditeur de données in-app.
export const cult: CultDef = {
  "key": "Mabyn",
  "title": "Déesse gnome des ombres",
  "blessings": [
    "Bénédiction de Bataille",
    "Bénédiction de Droiture",
    "Bénédiction de Protection",
    "Bénédiction de Ténacité",
    "Bénédiction de Sagesse",
    "Bénédiction de Vigueur"
  ],
  "miracles": [
    "Masque mortuaire",
    "Vous ne m'avez pas vu, n'est-ce pas?",
    "Épée de justice"
  ],
  "desc": "<b>Sphères: </b>Ombres, Vengeance, Magie<br><b>Adorateurs: </b>Assassins, Ennemis morts des sorciers, gnomes, épées, victimes d'injustice artefacts magiques<br><br>Mabyn est la déesse gnome des ombres, de la vengeance et de la magie. Dépourvue d'une forme permanente, elle n'est généralement représentée que sous la forme d'un manteau et d'un chapeau pointu gris, et d'une lame argentée, que portent habituellement aussi ses dévots. Elle est connue pour son dévouement fanatique à la race gnome, et pour son absence totale de ce que la plupart des mortels considéreraient comme une morale. Le culte de Mabyn a nettement augmenté à Glimdwarrow après la destruction de ses galeries par Grom la Panse il y a un siècle. Elle est la divinité principale de la Garde du Dwarrow.<br><b><h3>Commandements</h3></b><ul><li>Protéger les galeries des gnomes quel qu'en soit le coût.</li><li>Toujours prendre sa revanche pour tout tort caus�� à soi, à son clan ou à son terrier.</li><li>Ne jamais révéler à l'extérieur l'emplacement de son terrier.</li><li>S'exercer au maniement de l'épée pendant au moins une heure par jour.</li><li>Ne jamais être repéré lorsqu'on cherche à passer inaperçu.</li></ul>",
  "source": {
    "book": "NADJ",
    "page": 90
  }
};
