# Cadrage de premiers principes — la fiche de personnage (#492)

> **Date** : 2026-07-16 · **Statut** : PROPOSITION (réflexion demandée par l'utilisateur en amont
> de #492, verbatim : « Sans regarder la v3, c'est quoi une fiche de personnage, comment ça doit
> s'afficher, dans quel cas on en a besoin, pour y faire quoi ? ») — en attente de ratification.
> Une fois ratifié : les amendements §5 se gravent au ticket #492, ce document reste l'exposé des
> motifs. Artefact daté : à supprimer une fois #492 exécuté (git porte l'historique).

## 1. C'est quoi, une fiche de personnage ?

Sur table, la fiche EST l'instrument de jeu : elle porte l'état (crayonné, gommé), la référence
des règles et le brouillon de calcul. Dans un jeu vidéo, le moteur a pris tout ça : il tient
l'état, lance les dés, applique les modificateurs. Ce qui reste à la fiche, c'est **la surface où
le joueur regarde son personnage en face**. Deux natures à la fois : un **miroir** (qui je suis,
ce que je vaux, ce qui m'arrive) et un **établi** (où je façonne mes acquis).

## 2. Dans quels cas on en a besoin ? (les moments, par fréquence)

1. **La vérification en pleine action** — « pourquoi mon jet est à 37 ? », « ce Poison me fait
   quoi exactement ? », « il me reste combien de Chance ? ». Le cas le plus fréquent et le plus
   exigeant : réponse en 2 secondes, retour au jeu. Le job profond : la **transparence du
   moteur** — le jeu a calculé, la fiche explique ; c'est ce qui fabrique la confiance dans un
   jeu à règles denses.
2. **Le bilan après l'événement** — le combat finit : « qu'est-ce que j'ai pris ? ». Blessures,
   critiques, corruption, maladie qui couve. Le moment « corps et âme » — dramatique dans WFRP,
   dont la lente dégradation est le cœur du ton.
3. **La préparation avant l'action** — set d'armes, munitions, sorts en tête, surcharge.
4. **La gestion entre les scènes** — dépenser les PX, réorganiser le sac, apprendre un sort.
   Le seul moment « établi » : comparaisons, coûts, conséquences. Rare mais long — le quart
   d'heure où le joueur *rêve* son personnage.
5. **L'incarnation** — relire qui il est, d'où il vient, où va sa carrière. Presque jamais
   « utile », valeur affective énorme.

## 3. Comment ça doit s'afficher ? (déduit des moments, pas du goût)

Les moments 1-3 dominent en fréquence et partagent la même exigence : **ouverture instantanée,
sans rupture de contexte, fermeture instantanée**. Le monde reste visible derrière — on
consulte, on ne « va » pas quelque part. Ça disqualifie l'écran plein type Baldur's Gate et
impose une **surface flottante posée sur le jeu**, ouverte/fermée au même geste, qui **rouvre là
où on l'a laissée**.

Deux invariants en découlent :
- **L'identité toujours visible.** On joue une compagnie de 4 : toute question posée à la fiche
  est posée *à propos de quelqu'un*. Le joueur ne doit jamais douter de QUI il lit — et doit
  passer d'un héros à l'autre sans refermer.
- **La réponse à « pourquoi ce chiffre ? » à portée immédiate.** Chaque valeur affichée doit
  pouvoir se décomposer (base + avances + passifs) — c'est LA question du moment 1.

## 4. Pour y faire quoi ? (la frontière consulter/agir)

L'essentiel est de la **consultation**. Les seuls gestes qui appartiennent en propre à la
fiche : équiper/ranger (le corps de l'objet), dépenser des PX (l'avancement), éditer le
narratif. Tout le reste — commercer, soigner le groupe, agir en combat — a sa maison ailleurs ;
une fiche qui accumule des boutons devient un panneau de contrôle, plus un personnage.

Frontières avec les surfaces voisines, une phrase chacune :
- le **Codex** répond « qu'est-ce que X *en général* ? » (la règle) ;
- la **fiche** répond « qu'est-ce que X *pour moi, maintenant* ? » (mon instance, mes chiffres) ;
- l'**écran de groupe** répond « où en est *la compagnie* ? » (l'ensemble, la comparaison).

## 5. L'arbitrage central : format ≠ âme

**Le FORMAT appartient à la vérification en action** (le moment le plus fréquent impose les
contraintes dures : modale flottante, geste unique, persistance, deux clics max).

**Le CŒUR — celui qui gagne les arbitrages de contenu — est le bilan corps et âme.** Trois
raisons, par ordre de poids :

1. **C'est ce qui rend la fiche warhammerienne.** Caracs, compétences, inventaire : commodité
   générique de tout RPG. La lente dégradation — le bras broyé qui reste broyé, la corruption
   qui monte, la mutation qu'on cache, le Péché qui s'accumule — c'est LE contrat narratif de
   WFRP. Un joueur de Baldur's Gate consulte sa fiche pour optimiser ; un joueur de Warhammer
   devrait la consulter *avec un peu d'appréhension*.
2. **On n'a pas de MJ.** Sur table, le MJ fait exister le corps abîmé. Chez nous, la fiche est
   le SEUL endroit où le corps du personnage parle. La vérification de chiffres est déjà
   partiellement servie par les modales de jet (breakdown base+mods), l'établi par le marchand
   et l'écran de victoire ; le bilan n'a aucune autre maison.
3. **C'est le diagnostic du juge joueur-RPG (#371)** : « la mécanique est partout d'une fidélité
   impressionnante, et l'incarnation nulle part ». L'onglet État est l'endroit où la mécanique
   DEVIENT incarnation — un critique n'est pas une ligne `-10 CC`, c'est sa prose verbatim avec
   sa conséquence chiffrée en dessous. Le levier le plus court vers « je joue à un vrai RPG ».

**Règle d'arbitrage concrète** : quand deux contenus se disputent la place ou la visibilité,
**celui qui raconte l'état du personnage gagne sur celui qui liste ses moyens**. Exemple : la
colonne permanente porte, sans un clic, les signaux vitaux ET les alarmes (blessé, corrompu,
malade, psychologie active) — pas seulement les dix caracs. Un héros intact et un héros au bord
de la mutation ne doivent pas avoir la même fiche au premier regard.

## 6. Confrontation à la v3 (ticket #492 + planche-fiche-perso.html)

Le cadrage **valide la structure** de la v3 : modale flottante sur le jeu, colonne d'identité
permanente, onglet État de plein droit, détail au popover Codex, dev/commerce/soins sortis.

Trois **amendements** (ce que le ticket ne dit pas encore) :

1. **L'onglet État n'est pas un onglet parmi sept.** C'est le deuxième cœur après la colonne :
   sa qualité de rédaction (prose verbatim + rangées d'ops, doctrine #295) compte double, et ses
   **alarmes remontent en colonne permanente** (badges d'alerte visibles sans un clic, jamais un
   compteur nu).
2. **La décomposition des valeurs** (« pourquoi 37 ? ») : toute valeur calculée affichée par la
   fiche (carac effective, compétence, PA par zone, mouvement, encombrement) doit exposer sa
   décomposition base + avances + passifs — primitive existante `optionValue`/`breakdown.ts` à
   réutiliser côté calcul, affordance à définir à la planche (survol/clic).
3. **Le passage de héros sans refermer** : la modale porte un sélecteur de compagnie (portraits,
   `PortraitTile`), conserve l'onglet actif au changement de héros et rouvre sur son dernier
   état.

## 7. Ce que ça change pour les lots

L'ordre de livraison suit le cœur : la **colonne + l'onglet État** forment le premier jalon de
goût (c'est là que le verdict user pèse le plus), avant Harnois (le damier, acquis technique à
re-peau) et Magie & Foi. Les onglets « moyens » (Compétences, Sac, Avancement, Histoire)
suivent. Détail du découpage : au plan d'implémentation, pas ici.
