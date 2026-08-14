# La Diligence — peau architecturale V1

**Date : 2026-08-14**  
**Statut : spécification proposée, à valider avant plan d’implémentation**

## Décisions utilisateur du 2026-08-14

Les décisions suivantes fixent le périmètre et priment sur toute optimisation technique :

> « Ah ca je refuse que tu modifie le plan, j'ai fait de mon mieux pour placer les murs et les portes »

> « Tu peux toucher aux fenetres ! Comme indiqué, je n'y ai pas touché »

> « Mais tu peux faire des murs moins haut, a l'entre a gauche il y a normalement un jardin ou un potagé je crois, mais actuellement bloqué par un mur en hauteur pleine par exemple au lieu d'une haie »

> « Je voudrais deja une premiere version qui s'occupe des points les plus importants et on affinera apres piece par piece »

> « ce qui est le plus prioritaire pour moi ce n'est pas du nouveau code applicatif mais l'édition de la carte en personnalisant les éléments en place, si tu pense avoir assez de quota tu peux aussi ajouter des nouveaux types de murs/portes/fenetre/etc ... dans notre bibliotheque d'élément et les utiliser. Et vraiment, en dernier lieu, modifier le code de l'application »

## Objectif

Donner à La Diligence l’identité visuelle de l’illustration de référence et rendre ses grandes familles de pièces immédiatement lisibles, sans déplacer ni reconstruire son plan. La V1 pose un vocabulaire architectural réutilisable et éditable ; les passes ultérieures pourront affiner chaque pièce sans ajouter de cas particulier dans le renderer.

La V1 doit produire cinq gains visibles :

1. une façade de relais impérial reconnaissable ;
2. des fenêtres crédibles, correctement proportionnées et librement authorées ;
3. des portes simples ou doubles lisibles, sans déplacer leurs passages ;
4. des intérieurs différenciés par grandes familles de fonctions ;
5. des limites extérieures à la bonne hauteur, notamment une haie, une clôture ou un muret autour du jardin potager à la place d’un mur d’étage.

## Non-objectifs de la V1

- Aucun meuble, objet intérieur, PNJ, rencontre ou logique de jeu n’est ajouté.
- Aucun affinage pièce par pièce au-delà des familles décrites ci-dessous.
- Aucune modification de dimensions, de relief, d’escalier, de zone, de circulation ou d’emplacement de porte.
- Aucun renderer spécial à La Diligence et aucune décision fondée sur un libellé affiché.
- Les ornements extérieurs intégrés à l’architecture — enseigne, cheminées et éléments de pignon — restent autorisés ; l’interdit d’objets concerne l’aménagement intérieur de cette V1.

## Invariant : le plan est sanctuarisé

Un golden de topologie de La Diligence est commité avant la transformation. Il sérialise et compare après transformation :

- les dimensions et les couches complètes ;
- la grille, la marchabilité et le relief ; les ids de terrain peuvent changer uniquement vers un terrain de même comportement pour personnaliser visuellement les sols ;
- chaque arête par `x`, `y`, `z` et `side` ;
- pour chaque arête, `door`, `closed`, `structure` et `climb` ;
- les aires et cases exactes de chaque zone ;
- les entités, points d’entrée et escaliers ;
- la connectivité horizontale et verticale déjà couverte par les tests de la scène.

Le golden ignore uniquement les champs explicitement autorisés par ce chantier : fenêtre, rôle architectural, hauteur et identifiants d’apparence. Ainsi, une fenêtre peut être ajoutée, retirée ou déplacée, mais une porte ou une arête ne peut pas bouger silencieusement.

## 1. Séparer structure, rôle et apparence d’une arête

Aujourd’hui, un `WallSeg` porte surtout sa géométrie de plan et éventuellement un identifiant de structure mécanique. La V1 ajoute des données architecturales indépendantes :

- `edgeRole` : `wall`, `fence`, `hedge` ou `low-wall` ; défaut rétrocompatible `wall` ;
- `heightM` optionnel : surcharge métrique locale ;
- `appearance` optionnel : identifiant stable d’apparence, distinct de `structure`.

La séparation est volontaire :

- `structure` continue de désigner la structure mécanique destructible ;
- `appearance` choisit uniquement la matière et la géométrie visuelles ;
- `edgeRole` porte les conséquences architecturales communes ;
- `heightM` permet une exception locale sans créer une nouvelle apparence pour chaque hauteur.

### Sémantique des rôles

| Rôle | Mouvement | Vision | Enveloppe/toiture | Hauteur par défaut |
|---|---|---|---|---|
| `wall` | bloqué hors porte/brèche | bloquée | participe | hauteur d’étage |
| `fence` | bloqué hors ouverture | non bloquée | exclue | basse |
| `hedge` | bloqué hors ouverture | non bloquée en V1 | exclue | basse à mi-hauteur |
| `low-wall` | bloqué hors ouverture | non bloquée | exclue | basse |

Les valeurs métriques par défaut vivent dans les définitions d’apparence. Une surcharge `heightM` reste exceptionnelle et éditable.

Les rôles bas sont exclus de la détection d’intérieur, des façades porteuses et de la dérivation des toitures. Une haie fermant graphiquement un jardin ne doit jamais transformer ce jardin en pièce couverte.

### Application à La Diligence

Les arêtes existantes entourant `zone-J-z0` (Jardin potager) sont reclassées explicitement en haie, clôture ou muret selon leur côté, sans modifier leurs coordonnées. Les autres grandes limites non porteuses — cours et passages extérieurs — sont auditées dans la même passe, mais aucune arête ne change de position.

## 2. Géométries de fenêtres et de portes pilotées par les apparences

Les proportions d’ouverture ne doivent plus être des constantes universelles du builder.

### Fenêtres

La définition d’apparence d’une structure peut préciser :

- largeur de l’ouverture dans la travée ;
- hauteur d’appui et hauteur de tête ;
- nombre et disposition des meneaux et traverses ;
- apparence du verre, du cadre et de l’appui ;
- variante éclairée de nuit.

Le booléen `window` reste le marqueur authoré sur l’arête. Ses positions peuvent être entièrement reprises dans La Diligence, conformément à la décision utilisateur. La variante du relais impérial privilégie des fenêtres étroites, verticales, au verre froid bleuté et aux croisillons fins.

### Portes

L’emplacement et l’état fonctionnel des portes restent intacts. Leur apparence peut préciser :

- hauteur d’ouverture crédible, indépendante de la hauteur totale du mur ;
- vantail simple ou double ;
- panneaux, planches, pentures et poignées ;
- chambranle bois ou encadrement maçonné ;
- variante cintrée pour l’entrée principale.

Une apparence posée sur une arête de porte ne modifie ni sa collision, ni son état ouvert/fermé, ni sa structure mécanique. Les grandes ouvertures des écuries, remises et de l’entrée peuvent recevoir des doubles vantaux ; les portes de chambres et de service restent simples.

## 3. Façade extérieure de relais impérial

La V1 compose la façade à partir du registre partagé, en partant de l’apparence existante `auberge-relais-imperiale` et en l’étendant seulement lorsque la référence l’exige.

Éléments attendus :

- enduit ivoire et ocre irrégulier ;
- ossature bois sombre, avec contreventements diagonaux moins répétitifs ;
- soubassement plus robuste ;
- grand pignon central et pignon secondaire ;
- entrée principale maçonnée et cintrée autour de la porte existante ;
- fenêtres redistribuées sur les deux niveaux ;
- couverture sombre patinée ;
- cheminées et enseigne extérieure.

Un pignon couvrant plusieurs travées devient une primitive de façade multi-arêtes, au lieu d’étirer artificiellement une feature attachée à une seule arête. Cette primitive reste générique et éditable.

Les façades sont authorées par sections explicites sur les arêtes existantes. Aucun choix d’apparence n’est dérivé de l’identifiant ou du nom de la scène.

## 4. Finitions intérieures par zone

Une zone descriptive intérieure reçoit un `finishId` stable et optionnel. Il référence une définition partagée de finition intérieure. Le label de la zone n’est jamais consulté pour prendre une décision.

Une finition V1 décrit seulement :

- matière visuelle du sol, sans changer la tuile ni sa marchabilité ;
- parement intérieur des murs ;
- plafond et poutres ;
- boiseries principales.

Le renderer résout le sol et le plafond depuis la zone contenant la case. Pour un mur séparant deux pièces, chaque face intérieure est résolue depuis la zone adjacente correspondante : une cuisine peut avoir un parement utilitaire du côté cuisine et un enduit clair du côté salle, sans dupliquer ni déplacer l’arête.

Le champ est éditable dans l’inspecteur de zone. Une valeur inconnue échoue en validation d’authoring et prend un repli d’alarme visible en développement, jamais une finition voisine choisie silencieusement.

### Familles initiales

| Identifiant stable | Pièces visées | Direction V1 |
|---|---|---|
| `auberge-public` | salle principale, salle commune, salon privé, salles de réunion | plancher chaleureux, enduit clair, grosses poutres sombres |
| `auberge-domestique` | chambres, quartiers, couloirs, galerie, balcons intérieurs | plancher plus sobre, enduit clair, boiseries simples |
| `auberge-service` | cuisine, brasserie, celliers, réserves, portier, passage couvert | dalles ou plancher utilitaire, enduit robuste, poutres fonctionnelles |
| `auberge-atelier` | forge, écuries et remise | pierre sombre ou terre battue visuelle, parements robustes et patinés |

Les cours, le jardin et les espaces réellement extérieurs ne reçoivent pas de finition intérieure.

La table d’affectation de La Diligence est explicite et keyée par les ids de zones. Les pièces aux labels identiques peuvent donc être affinées indépendamment lors des passes ultérieures.

## 5. Éditabilité et authoring

Tous les nouveaux champs appartiennent au schéma de scène et sont exposés dans l’éditeur :

- rôle, hauteur et apparence dans l’inspecteur d’arête ;
- géométrie d’ouverture dans les définitions d’apparence partagées ;
- finition dans l’inspecteur de zone ;
- sections et features dans l’architecture du bâtiment.

`MapSpec` et `buildScene` acceptent les mêmes identifiants pour les nouvelles cartes. La Diligence, actuellement embarquée comme paquet éditeur, reçoit uniquement les nouveaux champs d’apparence sur ses données existantes ; le golden de topologie interdit que ce geste serve à réauthorer son plan.

## 6. Compatibilité et migration

Tous les champs sont optionnels :

- absence de `edgeRole` : `wall` ;
- absence de `heightM` : hauteur déduite de l’apparence, puis hauteur d’étage ;
- absence d’`appearance` : résolution actuelle depuis `structure` ou la façade ;
- absence de `finishId` : rendu intérieur actuel.

Les scènes existantes restent donc inchangées visuellement et mécaniquement jusqu’à authoring explicite. Aucune migration globale de contenu n’est requise.

## 7. Tests et recette

### Tests mécaniques

- golden de topologie de La Diligence avant/après ;
- tests unitaires des quatre rôles d’arête : mouvement, vision, enveloppe et toiture ;
- test garantissant qu’une haie fermée autour d’un jardin ne crée ni intérieur ni toit ;
- tests des géométries de fenêtres et des vantaux simples/doubles ;
- test des deux parements d’un mur partagé entre deux finitions ;
- validation fail-fast des ids d’apparence et de finition ;
- tests existants de connectivité de La Diligence conservés sans modification de leurs attendus structurels.

### Recette visuelle

La V1 n’est pas validée sur une seule vue générale. La recette produit :

- quatre rotations extérieures, illustration de référence en regard ;
- vue de l’entrée principale ;
- vue du jardin potager montrant la séparation basse ;
- vues intérieures représentatives des quatre familles ;
- vue rapprochée d’une fenêtre, d’une porte simple et d’une double porte ;
- contrôle de nuit des fenêtres éclairées ;
- contrôle du cutaway et de l’absence de toit fantôme sur les cours et le jardin.

Les captures passent une revue visuelle adversariale : fidélité à la référence, proportions des ouvertures, lisibilité des fonctions, répétition des motifs et cohérence aux quatre rotations.

## 8. Découpage de livraison

La réalisation suit strictement l’ordre de priorité utilisateur. Chaque palier produit une amélioration visible autonome et constitue un point d’arrêt propre si le quota restant ne justifie pas le suivant.

### Palier A — édition de la carte avec l’existant

1. golden de topologie et captures de référence ;
2. personnalisation des sols par zone avec les terrains existants de même comportement ;
3. application des apparences de murs et de la façade `auberge-relais-imperiale` existantes ;
4. redistribution des fenêtres et sélection des portes existantes sans déplacer leurs arêtes ;
5. première recette complète.

Ce palier ne crée aucun code applicatif et doit être livré avant d’envisager la suite.

### Palier B — enrichissement de la bibliothèque

Seulement si le palier A laisse des défauts visibles importants et si le quota le permet :

1. nouvelles définitions réutilisables de colombage, fenêtre étroite, porte double, portail cintré, haie et clôture ;
2. utilisation immédiate de chaque nouvelle définition dans La Diligence ;
3. galerie/QC de bibliothèque et nouvelle recette de la scène.

Ce palier privilégie les registres de données et les définitions d’art partagées ; aucune branche spéciale au nom de La Diligence n’est admise.

### Palier C — code applicatif minimal

Seulement pour un défaut démontré impossible à résoudre aux paliers A et B. Les candidats déjà identifiés sont la hauteur réelle d’une arête basse, son exclusion de l’enveloppe/toiture, les parements distincts par face et les finitions de zone sans changement de terrain.

L’ordre interne reste test-first :

1. contrat de données et golden de topologie ;
2. rôles et hauteurs d’arêtes ;
3. géométries paramétrables des fenêtres et portes ;
4. finitions intérieures par zone et parements par face ;
5. composition de la façade de La Diligence ;
6. affectation des quatre familles et des séparations basses ;
7. recette complète et corrections visuelles.

Le palier C n’est pas un prérequis artificiel au palier A. Une passe ultérieure « pièce par pièce » étendra les définitions et les affectations, sans changer les contrats effectivement livrés par cette V1.
