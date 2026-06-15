/**
 * Magie de la Grande Gueule (Domaine « Gueule ») — ADE II « Les ogres », 7 sorts.
 * Curation B4 : Traits de créature accordés (Peur, Vampirique, Régénération), bonus de Force
 * (Goinfre), Projectile magique (Broyeur d'os) ; les sorts gastromantiques utilitaires et le
 * gouffre de « La Gueule » (hasard de zone complexe) restent narratifs. Aucune op nouvelle.
 * NB : la Gueule n'est pas un des 8 Domaines de Couleur — pas d'attribut de Domaine (LDB 48).
 */
import { SpellSpec } from '../../engine/spellspec';

export const DOMAINE_GUEULE: SpellSpec[] = [
  {
    label: "Bouf 'crâne",
    // « Vous gagnez le Trait de créature Peur 2. Ceux qui connaissaient l'ancien propriétaire de la
    //   tête dévorée subissent −20 aux Tests de Calme pour résister à la Peur. » — Peur 2 accordée ;
    //   la pénalité « ceux qui connaissaient le défunt » reste journalisée.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "ADE II « Les ogres » — Magie de la Grande Gueule « Bouf 'crâne »",
  },
  {
    label: "Broyeur d'os",
    // « Projectile magique avec Dégâts +4 qui ignore les PA (pas le BE). Si l'attaque inflige une
    //   Blessure Critique, ajoutez +20 au lancer sur le Tableau des Blessures Critiques. » — Dégâts
    //   via le moteur missile ; le +20 au jet de Critique reste journalisé.
    durationRounds: null,
    curated: true,
    source: "ADE II « Les ogres » — Magie de la Grande Gueule « Broyeur d'os »",
  },
  {
    label: 'Festin des Damnés',
    // « Toutes les créatures de votre choix dans la ZdE gagnent le Trait de Créature Vampirique pour
    //   la durée… Une créature peut résister (Test de Résistance Difficile). À la fin, les non-ogres
    //   ayant blessé un adversaire testent Calme (+0) ou gagnent Sonné. » — Trait Vampirique accordé ;
    //   le ciblage « au choix », le jet de résistance et l'effet de fin restent journalisés.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "ADE II « Les ogres » — Magie de la Grande Gueule « Festin des Damnés »",
  },
  {
    label: 'Goinfre costaud',
    // « Votre cible ajoute +2 à son Bonus de Force pour les Dégâts qu'elle inflige ou pour d'autres
    //   Tests de Force appropriés. Quand le sort prend fin, elle doit se gaver ou gagner Exténué. » —
    //   +2 BF modélisé par +20 en Force (BF dérivé) ; l'appétit de fin reste journalisé.
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "ADE II « Les ogres » — Magie de la Grande Gueule « Goinfre costaud »",
  },
  {
    label: 'Goûtemort',
    // « En consommant une partie d'un cadavre, vous apprenez quand et comment la créature est
    //   morte. » — divination gastromantique utilitaire : arbitré.
    durationRounds: null,
    curated: true,
    source: "ADE II « Les ogres » — Magie de la Grande Gueule « Goûtemort »",
  },
  {
    label: 'La Gueule',
    // « Quiconque dans la zone effectue un Test d'Esquive (+0) : réussite → +8 Dégâts (−1/DR) en
    //   s'extrayant ; échec → chute dans la Gueule (+10 Dégâts + 3 États Empêtré opposés à Force 60,
    //   +10/round ; Blessure Critique si encore dedans à la fin du Sort). » — gouffre dévorant : le
    //   gate d'Esquive, l'engloutissement et l'entrave Force 60 forment un hasard de zone non
    //   modélisé : arbitré (rien d'inventé).
    durationRounds: { bonusOf: 'FM' },
    curated: true,
    source: "ADE II « Les ogres » — Magie de la Grande Gueule « La Gueule »",
  },
  {
    label: 'Trollboyaux',
    // « Votre cible gagne le Trait de créature Régénération. Tout non-ogre qui récupère des Blessures
    //   sous l'effet teste Résistance (+20) ou voit sa chair prendre une teinte de troll (cosmétique,
    //   non-mutation). » — Régénération accordée ; l'effet cutané reste journalisé.
    durationRounds: { charOf: 'E' }, // « (Endurance) Rounds »
    curated: true,
    source: "ADE II « Les ogres » — Magie de la Grande Gueule « Trollboyaux »",
  },
];
