/**
 * Table des Péripéties de voyage (1d10) — VERBATIM du Livre de base, section « Voyage »
 * (fichier source `51 - Magie du Chaos.md`, l.241-252 ; découpage OCR, contenu = chapitre MJ).
 * Exception manuscrite sourcée (comme criticals.ts / oups.ts) : la table est citée telle quelle.
 *
 * « Certains MJ préfèrent lancer 1d10 par jour de voyage et faire survenir un événement sur un
 * résultat de 8 » (l.237) → le SEUIL est paramétrable par route (`perilDie`, défaut 8, 0 = off).
 *
 * `kind` = ce que le MOTEUR sait jouer sans rien inventer :
 *  - 'reposant'  (1)  : soin de toutes les Blessures + retrait de tous les Exténué (texte explicite) ;
 *  - 'ereintant' (4)  : Test de Survie en extérieur Accessible (+20) sinon +1 jour et +1 Exténué ;
 *  - 'attaque'   (10) : Test de Perception Accessible (+20) raté → embuscade (rencontre fournie par
 *                       la route dans l'éditeur ; sans rencontre configurée → narratif au journal) ;
 *  - 'narratif'  (2,3,5-9) : matière à narration (PNJ, vols, rivaux…) — journalisé tel quel,
 *                       l'auteur peut en faire des péripéties JOUABLES par route (effets d'éditeur).
 */
export interface Peripetie {
  roll: number;
  label: string;
  text: string;
  kind: 'reposant' | 'narratif' | 'ereintant' | 'attaque';
}

export const PERIPETIES: Peripetie[] = [
  {
    roll: 1,
    label: 'Voyage reposant',
    kind: 'reposant',
    text:
      'Le voyage se déroule sans heurts, les Personnages se reposent bien, le paysage est particulièrement ' +
      'inspirant et ils rencontrent peut-être un PNJ guérisseur ou un prêtre serviable. Les Personnages ' +
      'peuvent guérir toutes les Blessures et retirer tous les États Exténué.',
  },
  {
    roll: 2,
    label: 'Quelque chose d’intéressant !',
    kind: 'narratif',
    text:
      'Une rencontre fortuite sur la route avec d’autres voyageurs, une auberge de qualité ou un ' +
      'sanctuaire, ou encore de vieilles ruines étranges constituent une merveilleuse histoire à partager.',
  },
  {
    roll: 3,
    label: 'À présent, c’est utile !',
    kind: 'narratif',
    text:
      'Les Personnages découvrent quelque chose d’intéressant dans leur aventure — un ragot, un message ' +
      'perdu, un événement dont ils n’étaient pas censés être témoins, ou autre.',
  },
  {
    roll: 4,
    label: 'Voyage éreintant !',
    kind: 'ereintant',
    text:
      'La route est bloquée. Un pont peut être effondré, une rivière bloquée ou une route inondée, ou ' +
      'quelque autre obstacle insurmontable. Un Personnage effectue un Test de Survie en extérieur ' +
      'Accessible (+20) pour trouver un bon itinéraire de substitution, sinon tout le monde arrive un ' +
      'jour plus tard avec un État Exténué.',
  },
  {
    roll: 5,
    label: 'Poursuivis !',
    kind: 'narratif',
    text:
      'Un ennemi retrouve la trace des Personnages et il doit être géré ou mis sur une fausse piste avant ' +
      'qu’ils n’atteignent leur destination. La confrontation pourrait être violente à moins qu’ils ne ' +
      's’en sortent en parlant, et semer leur poursuivant pourrait rajouter quelques jours à leur voyage.',
  },
  {
    roll: 6,
    label: 'Voleurs !',
    kind: 'narratif',
    text:
      'Les Personnages se font dévaliser. Peut-être par quelqu’un voyageant avec eux, partageant leur ' +
      'campement pour la nuit ou juste lors d’une brève conversation sur la route.',
  },
  {
    roll: 7,
    label: 'Pas encore !',
    kind: 'narratif',
    text:
      'Un rival ou une autre source de contrariété menace les Personnages pendant leur voyage — un fléau ' +
      'mineur récurrent, pas assez pour tomber dans la violence, mais pas loin.',
  },
  {
    roll: 8,
    label: 'Mauvaise influence !',
    kind: 'narratif',
    text:
      'Les Personnages rencontrent quelqu’un qui semble vouloir les aider, mais ses intentions sont ' +
      'sinistres : un raccourci douteux, une invitation à dîner dans une demeure ancestrale, les ' +
      '« meilleurs » champignons…',
  },
  {
    roll: 9,
    label: 'Même la nature vous déteste !',
    kind: 'narratif',
    text:
      'Les Personnages sont menacés par la nature : animaux mortels, orages, maladies, insectes… Cela ' +
      'pourrait mener à la violence, à recevoir un État, ou à une petite mais désagréable rencontre.',
  },
  {
    roll: 10,
    label: 'Attaqués !',
    kind: 'attaque',
    text:
      'Les Personnages sont attaqués pendant leur voyage — une rencontre malheureuse dans la zone qu’ils ' +
      'traversent, ou quelque chose prévu par leurs adversaires. S’ils ratent un Test de Perception ' +
      'Accessible (+20), ils peuvent même tomber dans une embuscade !',
  },
];
