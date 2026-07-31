# Refonte du HUD de combat et d’exploration — design

**Date :** 2026-07-31  
**Statut :** validé visuellement, prêt pour plan d’implémentation  
**Périmètre :** HUD de jeu sur la carte isométrique, en combat et hors combat

## 1. Problème

Le HUD actuel expose bien les informations essentielles, mais leur rôle n’est pas identifiable au premier regard : la barre de groupe peut être confondue avec l’ordre des tours, l’initiative ne porte pas clairement le round, plusieurs signaux de sélection ou d’alerte flottent sans rattachement évident, et les commandes de caméra ont toutes le même poids visuel.

Le critère de réussite est qu’un joueur puisse répondre immédiatement à quatre questions :

1. Qui compose mon groupe ?
2. Quel est le round et qui joue maintenant ?
3. Que peut faire l’acteur courant et que lui reste-t-il ?
4. Quelle information contextuelle réclame mon attention maintenant ?

## 2. Principe directeur

Chaque ancrage de l’écran reçoit une responsabilité exclusive :

| Zone | Responsabilité | Ne doit pas porter |
|---|---|---|
| Haut, centre | Identité et santé du groupe | Acteur courant, ordre des tours |
| Gauche | Temps du combat | Actions disponibles |
| Bas, centre | Décisions de l’acteur courant | État global du groupe |
| Haut, droite | Orientation, projection et zoom de la caméra | Actions de combat |
| Centre de la carte | Situation tactique et contexte immédiat | Informations persistantes déjà présentes dans le HUD |

La carte reste la surface dominante. Les panneaux sont opaques seulement là où la lisibilité l’exige et se fondent vers la scène à leur périphérie.

## 3. États couverts

| État | Question prioritaire | Informations persistantes | Informations contextuelles |
|---|---|---|---|
| Exploration | Où vais-je et pourquoi ? | Groupe, lieu/date | Objectif, interaction proche |
| Dialogue / précombat | Quel choix change la situation ? | Groupe, interlocuteur | Choix et conséquences connues |
| Tour joueur | Qui joue et que lui reste-t-il ? | Round, initiative, acteur, économie d’actions | Actions légales, états urgents |
| Déplacement | Où puis-je aller et à quel coût ? | Round, initiative, mouvement restant | Zone, trajet, coût, danger |
| Ciblage / attaque | Qui attaque qui et avec quelles valeurs ? | Acteur, cible, action engagée | Portée, opposition, localisation, risque |
| Résultat / influence | Que s’est-il passé et puis-je infléchir le résultat ? | Verdict, marge, ressources | Relance, DR, Pacte, résultat final |
| Tour ennemi | Qui agit contre qui ? | Round, acteur ennemi, initiative | Cible, action, résolution brève |

## 4. Barre de groupe — haut centre

La barre de groupe est strictement identitaire.

Chaque membre affiche :

- son portrait ;
- son nom ;
- ses Blessures courantes et maximales avec `LifeBar` ;
- une alerte rattachée à sa carte lorsqu’un état demande l’attention.

Elle n’affiche jamais :

- `JOUE`, `ACTIF`, `PRÊT`, `SUIT` ou un équivalent ;
- un liseré persistant désignant l’acteur courant ;
- un marqueur de sélection bleu ou doré ;
- l’ordre d’initiative.

Un clic peut sélectionner ou ouvrir un personnage, mais le retour persistant de cette sélection appartient à la carte ou au panneau ouvert, pas à la barre de groupe. Les états `hover` et `focus-visible` restent nécessaires sans persister après l’interaction.

Les alertes ne flottent jamais entre deux portraits. Elles sont ancrées dans le coin de la carte concernée, portent une icône issue du registre du projet et disposent d’une infobulle explicite.

## 5. Initiative — gauche

Le round est placé au-dessus de la liste, dans le même panneau :

```text
ROUND
  2
────────
INITIATIVE
```

La liste affiche, pour chaque entrée :

- nom court ;
- valeur d’initiative ;
- camp par un liseré secondaire allié/hostile ;
- acteur courant par surbrillance dorée et marqueur textuel ou iconographique ;
- entrées déjà jouées atténuées ;
- entrées suivantes normales.

La couleur n’est jamais le seul signal. L’acteur courant porte aussi un marqueur directionnel et un libellé accessible. Si la liste dépasse la hauteur disponible, le panneau indique le nombre d’entrées suivantes et reste défilable ; il ne réduit pas les cartes jusqu’à les rendre illisibles.

L’initiative disparaît intégralement hors combat.

## 6. Flux de combat — sous le groupe

Une ligne courte sous la barre de groupe annonce uniquement les événements récents ou l’instruction contextuelle immédiate : attaque manquée, début de déplacement, cible choisie.

Cette ligne :

- ne porte jamais le round ;
- ne remplace aucune information persistante ;
- disparaît automatiquement ;
- n’affiche qu’un message à la fois ;
- réserve la couleur forte au sujet ou au verdict.

## 7. Commandes de caméra — haut droite

Les commandes sont regroupées par fonction et séparées visuellement :

1. orientation : tourner la caméra à gauche ou à droite ;
2. affichage : projection isométrique/du dessus et vue subjective lorsqu’elle est disponible ;
3. zoom : diminuer, valeur courante, augmenter.

Chaque commande utilise les icônes existantes du projet, possède un nom accessible et une infobulle. Un état indisponible est réellement désactivé et visuellement atténué. Les boutons n’ont pas tous la même importance : le pourcentage de zoom est une valeur, pas une action primaire.

Sur ouverture d’une modale bloquante, ces commandes restent visibles comme contexte mais sont inactives et atténuées avec le reste de la scène.

## 8. Dock de décision — bas centre

Le dock répond à une seule phrase : « cet acteur dispose de ces ressources et peut accomplir ces actions ».

Il contient :

- identité courte de l’acteur et Blessures ;
- ressources disponibles : Action, Mouvement, Avantage et autres ressources réellement exposées par le moteur ;
- actions légales, regroupées par verbes ;
- action ou mode actuellement engagé ;
- `Fin du tour`, isolé à droite.

Les ressources utilisent une valeur explicite (`1 Action`, `4/4 cases`, `2 Avantages`) plutôt qu’une jauge abstraite sans libellé. Une ressource consommée est barrée ou marquée comme utilisée, pas seulement grisée. Le HUD ne crée aucune économie de « réaction » séparée tant que le moteur n’en porte pas une.

Le dock change de contenu selon le mode sans changer de position :

- au repos : actions principales ;
- déplacement : mouvement restant, danger, confirmer/annuler ;
- ciblage : action engagée et annulation ;
- influence : ressources d’influence et verdict.

Il disparaît hors combat.

## 9. Déplacement

La carte conserve la responsabilité de montrer la zone atteignable, le trajet et la destination. Un bandeau compact au-dessus du dock donne la lecture textuelle :

```text
Destination : 1 case · 3 mouvements resteront · trajet libre
```

Le bandeau doit toujours distinguer le coût, le reste et la légalité du trajet. Il n’invente pas un niveau de danger que le moteur ne calcule pas. Il disparaît avec la fin ou l’annulation du mode.

## 10. Attaque opposée

La modale compose `RollShell` et présente l’information dans cet ordre :

1. verbe et cible (`Frapper Terenz`) ;
2. attaquant contre défenseur ;
3. valeurs opposées principales ;
4. options de localisation et de retenue ;
5. prévision ou conséquence connue ;
6. annuler et lancer.

Le détail arithmétique reste accessible sans dominer la lecture initiale. La modale ne duplique pas le groupe ni le round. Les phases de résultat et d’influence réutilisent la même ossature afin que les valeurs ne changent pas de place entre lancer, influencer et appliquer.

## 11. Exploration

Hors combat :

- aucune initiative ;
- aucun round ;
- aucun dock d’actions de tour ;
- barre de groupe identitaire inchangée ;
- lieu et date en haut à gauche ;
- objectif courant sous le contexte de lieu ;
- interactions disponibles signalées directement sur la carte par leurs affordances existantes ; une instruction textuelle n’apparaît que pendant un survol ou une interaction engagée.

L’objectif donne un titre et une instruction courte, sans texte de tutoriel. Le HUD ne duplique pas en permanence les halos et curseurs d’interaction déjà portés par la carte.

## 12. Responsive

Les breakpoints canoniques restent 900, 700 et 560 px.

### Plus de 900 px

Disposition de référence des maquettes 1600×900.

### De 701 à 900 px

- cartes de groupe compactes, nom abrégé et barre de vie conservés ;
- initiative réduite en largeur, sans supprimer round ni acteur courant ;
- barre de caméra en icônes avec infobulles ;
- dock inférieur autorisé à s’enrouler sur deux rangées.

### De 561 à 700 px

- barre de groupe en portraits compacts avec Blessures en superposition ;
- initiative transformée en bande horizontale défilable sous le groupe, précédée du round ;
- acteur courant maintenu entièrement visible ;
- commandes de caméra secondaires rangées dans un menu d’affichage ;
- dock sur toute la largeur, actions sur deux colonnes.

### Jusqu’à 560 px

- cibles tactiles d’au moins 44 px avec `pointer: coarse` ;
- groupe de quatre portraits sur une seule rangée ;
- initiative horizontale limitée à acteur courant et deux suivants, le reste défilable ;
- dock inférieur réduit à l’action engagée et au bouton ouvrant les autres actions ;
- modales plein écran, contenu défilable et actions finales fixes.

## 13. Primitives et contraintes d’implémentation

- `PortraitTile` / `CharFrame` pour les personnages du groupe et de l’initiative ;
- `LifeBar` pour les Blessures ;
- `RollShell` pour l’attaque et l’influence ;
- registre d’icônes existant, aucun emoji ni SVG local improvisé ;
- primitives et tokens globaux de `styles.css` ;
- aucune logique métier nouvelle dans l’UI ;
- données manipulées par identifiants stables, jamais par libellés ;
- textes visibles en français ;
- états accessibles au clavier et compréhensibles sans couleur.

Les composants exacts à conserver ou extraire seront confirmés par le plan d’implémentation après cartographie du HUD actuel. Cette spécification n’autorise pas la duplication d’une primitive existante.

## 14. Critères d’acceptation

1. Le round est visible sans chercher et appartient visuellement à l’initiative.
2. L’acteur courant est identifiable dans l’initiative sans consulter la barre de groupe.
3. La barre de groupe ne contient aucun marqueur d’acteur courant ou de sélection persistante.
4. Une alerte est visuellement rattachée à un seul personnage et possède un libellé accessible.
5. Action, Mouvement et Avantage sont lisibles en texte dans le dock, sans ressource inventée par l’interface.
6. Le mode déplacement affiche coût, reste et légalité du trajet avant confirmation.
7. Les commandes supérieures droites distinguent orientation, affichage et zoom.
8. Le HUD de combat disparaît hors combat au profit du lieu, de l’objectif et des affordances d’interaction portées par la carte.
9. Les états tour joueur, déplacement, attaque, résultat, tour ennemi et exploration sont vérifiés dans le navigateur.
10. L’interface reste utilisable à 1600×900, 900 px, 700 px, 560 px et 360 px.
11. La console reste à zéro erreur pendant la recette complète.

## 15. Hors périmètre

- modification des règles d’initiative ou d’économie d’actions ;
- refonte des sprites, de la carte ou de la projection isométrique ;
- nouveau journal de combat complet ;
- nouveaux raccourcis clavier ;
- refonte artistique définitive des matières et ornements.

Les maquettes valident la hiérarchie, la densité et les responsabilités. La passe artistique finale vient après validation fonctionnelle dans le jeu réel.
