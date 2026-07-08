# Programme #211 — passe NAVAL : l'attendu dérivé du RAW (2026-07-08)

> **Artefact daté** (politique `docs/`) — support de la passe « attendu vs réalité » du système
> naval (#211). À SUPPRIMER une fois la passe close (tickets ouverts, recette re-déroulée).
>
> **Statut : ATTENDU EN COURS DE VALIDATION UTILISATEUR.** Sur demande utilisateur, l'attendu a été
> dérivé du RAW SEUL (« sans regarder le code, juste les règles ») : lecture intégrale MDG 09-16
> (workflows de lecture, citations verbatim), zéro consultation de `src/`. La confrontation à la
> réalité (recette joueur → juge → tickets) vient APRÈS validation/correction de ce document.
>
> Convention de réfs : `MDG NN l.X` = chapitre NN de `Source/WH - V4 - La Mer de Griffe/`, ligne du
> `.md`. Chapitre sûr, ligne approximative (ré-extraction Marker).

---

## A. Le déroulé RAW d'un combat naval (du point de vue joueur)

**Constat structurant** : le combat naval MDG n'est **pas un combat tactique sur grille**. C'est une
**course-poursuite abstraite** (Distance scalaire entre navires, `MDG 13 l.354-420`) rythmée par des
**Tests d'équipage collectifs** (`MDG 14 l.9-19`), qui converge vers trois dénouements : quelqu'un
s'échappe, quelqu'un coule, ou les coques se touchent — et l'abordage bascule dans le combat
**normal**. Le joueur n'y pilote pas une figurine : il **tient un poste** et ses dés comptent dans
un total d'équipage.

### Acte 0 — La voile à l'horizon (préparation)
- Repérage : Vigie, Test de Perception (rôle essentiel, `MDG 14 l.80-84` ; +1/+2 DR du Nid-de-pie,
  `MDG 12 l.303`). Distance initiale fixée par la scène ; seuil d'évasion selon l'environnement
  (10 à 100, `MDG 13 l.364-370`).
- Décision stratégique : fuir / intercepter / tenir.
- Préparation : affectation des rôles (`MDG 14 l.21-32`), munition par pièce (`MDG 12 l.410-424`),
  tireur nommé (`l.442`), sabords (couvert total, 1 action, `l.364`), chanson de marin (buffs
  d'équipage, `MDG 09 l.218-248`), lever l'ancre = Test étendu de Force (`MDG 12 l.213`).
- Le vent (rose, force, allure) modifie le M des deux bords (`MDG 13 l.250-287`) ; un miracle peut
  le changer (`MDG 11 l.211`).

### Acte I — La course-poursuite (le cœur)
- **Par ordre d'Initiative, chaque navire fait UN Test de Navigation pour son Mouvement**
  (`MDG 13 l.376`) — Test d'équipage (Mousse essentiel en Poursuite, `MDG 14 l.69`) ; la Distance
  se recalcule (table dédiée `l.378-397` ; M≤3 pénalisé `l.399`).
- **Horloge à deux vitesses** : tranches de ×10 Rounds hors interaction (`l.356-358`), Round par
  Round dès qu'un seuil de portée est franchi (`l.410`).
- Décisions parallèles par équipes (un marin = un rôle/Round ; cumul = +2 crans, `MDG 14 l.53`) :
  - **Bordée** : décision du Capitaine (`MDG 14 l.128`) → UN Test d'équipage (Artilleur ★, DR ×2) →
    « le total de DR s'applique à toutes les armes à feu tournées vers l'ennemi, pour le meilleur
    et pour le pire » → par pièce : localisation par gréement (`MDG 13 l.573-582`), Dégâts − BE −
    blindage, Critique sur double ou B=0 (`l.656`).
  - **Recharge** : pièce muette N Rounds (Recharge 3-8, ×2 en sous-effectif, Soutien possible,
    `MDG 12 l.440-462`).
  - **Manœuvre/rythme forcé** : +1/+2 M contre risque d'Exténuation (`MDG 13 l.95-111`).
  - **Urgences (voleuses de bras)** : écoper la Voie d'eau (Force, par 10 Rounds, `l.676`),
    incendie (1 B/tour/État + Intensité du feu, `l.586-601`), Éclats (Indice marins à 9 Dégâts,
    `l.668`), réparation temporaire (`l.647-651`).

### Acte II — Le contact
- Distance 0 : « une collision, suivie d'un abordage déterminé, est malheureusement inévitable »
  (`MDG 13 l.420`).
- **Collision** : duel de barreurs (limiter/aggraver par Test de Manœuvre) ; Indice de Collision =
  BE + Blessures restantes ; milieu de coque ×2 ; frontale = IC adverse + M cumulé ; coups en Coque
  (`l.444-464`).
- **L'abordage n'a AUCUN sous-système RAW** (unique mention : `l.420`). Information de design, pas
  un trou : l'abordage EST le combat normal de WFRP — sabords = couvert total (`MDG 12 l.364`),
  petites armes tuent les marins exposés sans rayer la coque (`MDG 13 l.603-607`), corps-à-corps
  contre la coque touche auto, localisation au choix (`l.612`).

### Acte III — Les fins, et l'après
1. **Fuite** : Distance ≥ seuil (`l.412`).
2. **Naufrage** : Voie d'eau = E (`l.674`) ou coque pilonnée (B=0 → tout coup = Critique, `l.656`).
3. **Abordage tranché** : mêlée de pont — combat normal.
4. **Reddition/capture** : pas de règle RAW ; les parts de prise (50/10/40, `MDG 14 l.291`)
   prouvent que la capture est l'issue attendue ; le Moral est le levier (`MDG 14 l.141-196`).
- Après : réparations temporaires (dette : Test d'Endurance/jour, « la réparation temporaire
  cède », `MDG 13 l.651`) vs cale sèche (1 CO/Blessure, `l.639-643`) ; Chirurgien « essentiel …
  après les combats » (`MDG 14 l.31`) ; Moral ; butin/prise.

---

## B. Combat — les 10 éléments nécessaires et leur matérialisation

| # | Élément | Matérialisation (concept) |
|---|---|---|
| 1 | **Le navire = un personnage** (profil M/Man/Taille/E/B, BB dynamique `MDG 12 l.64`, traits, états) | Fiche de navire au rang d'une fiche de héros ; « portrait de combat » = silhouette à localisations (Coque/Gréement/Avirons/Équipements/Cargaison/Équipage) portant blessures, critiques, flammes, jauge de Voie d'eau ; contenu éditable |
| 2 | **Le plateau de l'acte I = ruban de Distance** (pas une grille) | Jauge graduée (points ×10 m) avec silhouettes et **seuils marqués** : portées de chaque bord, seuil d'évasion. Le ruban EST la carte tant que les coques ne se touchent pas |
| 3 | **L'horloge à deux vitesses** (`l.356-358`) | Rythme auto-adaptatif MIS EN SCÈNE : accéléré hors portée, arrêt-charnière « À portée extrême ! », puis tour par tour |
| 4 | **L'équipage nominal = la ressource** (1 rôle/Round, cumul +2 crans, Éclats tuent des individus) | **Plan du pont** avec postes ; affecter = geste central du Round ; marin affecté grisé ailleurs ; cumul affiché +2 crans |
| 5 | **Le Test d'équipage = primitive unique** (somme des DR, essentiel ×2, Moral en bande, 10 types = paramétrages) | Modale de jet **collective** : une ligne par contributeur, pot commun de DR, seuil ≥1 ; LE moment coop natif (chaque joueur lance sa ligne) |
| 6 | **Les pièces vivantes** (chargée/recharge N, servants N, munition, arc) | Pastilles d'état sur le plan de pont ; bouton « Lâcher la bordée ! » conditionné (arc + chargée + servie) ; résumé de salve pièce par pièce sur la silhouette ennemie ; la Recharge = métronome |
| 7 | **L'environnement acteur** (vent 4×/jour, météo, miracles) | Rose des vents permanente ; changements = événements annoncés, jamais des modificateurs silencieux |
| 8 | **Les urgences voleuses de bras** | Une urgence FAIT APPARAÎTRE un poste (« Écoper — 0/2 bras ») qui réclame des affectations ; l'arbitrage des bras EST le gameplay ; rien ne se résout en silence |
| 9 | **Le contact = bascule d'échelle** | Collision : confrontation bilatérale mise en scène. Puis le ruban se ferme, la grille s'ouvre : scène tactique auto-composée des deux ponts accolés (le plan de pont DEVIENT les positions), états persistants (feu, voie d'eau) |
| 10 | **L'arbitre sans MJ** (conduite adverse + fins) | **Profil de conduite** par adversaire en donnée (pirate veut aborder, marchand veut fuir, monstre veut manger), seuil de reddition adossé au Moral (maison), conditions de victoire authorées |

**Partis pris imposés** : (1) le joueur incarne un POSTE, pas une figurine ; (2) deux plateaux, une
bascule mise en scène ; (3) le temps est un matériau (accéléré / métronome des recharges / chrono de
la voie d'eau) ; (4) tout silence RAW reçoit un arbitrage explicite en donnée taguée maison.

### B-bis. La classe d'adversaires « monstre contre navire » (MDG 16 — ajout audit de complétude)

Le bestiaire (lu intégralement le 2026-07-08) révèle que l'adversaire d'un combat naval n'est pas
forcément un navire — et que les monstres attaquent sur **trois canaux distincts** :
- **La coque** : Léviathan noir « Assaut dévastateur » = charge → collision **IC 50** (`MDG 16
  l.274`) ; Triton, trait d'ARME « **Naufrageuse** » : Dégâts à la Coque → Test d'Endurance du
  navire Complexe sinon **Voie d'eau 1**, Critique → Difficile sinon **Voie d'eau 3** (`l.327`) ;
  **Gargantuan « Broyeur de bateaux »** (`l.133-136`) : s'enroule (1 Tour par 10 pts de Taille du
  navire), puis Test opposé ÉTENDU Force/Endurance du bateau — DR cumulé = Blessures du navire →
  « le bateau se brise » ; contre-jeu chiffré : >7 Blessures infligées → Test de Calme sinon il
  lâche ; le décrocher = être de Taille Énorme + Force opposée (0-4 DR bloque le Tour, 5+ le force
  à lâcher).
- **L'équipage sans toucher la coque** : décharge électrique du Gargantuan sur un navire Empoigné —
  « Cela n'inflige pas de Dégâts au vaisseau, mais les membres de l'équipage reçoivent tous un
  choc » 6 Dégâts (`l.143`) ; chant de la Syrène bleue = marins envoûtés qui marchent vers elle
  (`l.208`) ; appât du Léviathan-phare (Sonné).
- **Les jauges** : Triton « Faveur de Manann » — la créature LIT l'Humeur de Manann du navire et
  module son comportement (`l.313`) ; l'Élémentaire de mer lance Tourbillon (péril de mer invoqué).
Traits génériques : **Redoutable (Indice)** (Avantage plancher, `l.9-13`), **Créature marine**
(M 1 hors de l'eau, −2 DR, suffocation, `l.15-19`). Pas de kraken statué (mention narrative seule).

**Et 4 capitaines-némésis PRÊTS À L'EMPLOI, chacun avec son navire statué à règles SPÉCIALES** —
la preuve que le modèle de navire doit accepter des traits arbitraires par entité :
- **Jaego Roth / *Le Quart de nuit*** (grand canon de proue + 8 moyens ; « Héritier du
  cartographe » : Tests d'Orientation au lieu de Commandement, `l.368`) ;
- **Long Drong / *La Belle Fregar*** (vapeur ; « Flancs de fer » : coque métal, Éclats IGNORÉS,
  Critique Gréement/Avirons → table Panne de vapeur à la place, `l.421-423` ; « Carburant » :
  1 Enc charbon/heure, `l.425-431`) ;
- **Wulfrik / *Kotfotr*** (« Bénédiction des dieux » : toute attaque à distance contre le navire =
  Complexe −10, `l.452`) ;
- **Vrisk Gratte-le-Fer / *Les Crocs de Port de l'Échine*** (« Roue à aubes » : Navigation par
  INTIMIDATION du capitaine + marche arrière sur Test de Commandement, `l.527` ; canons à
  malefoudre « ZAP ! » −1 PA + ignore armures métal, `l.536`).
**Matérialisation** : l'adversaire du ruban de Distance est soit un navire, soit une CRÉATURE ; le
combat contre un colosse est un bras de fer d'équipage (le Test étendu du Broyeur EST une horloge
de mort lisible) ; les monstres anti-équipage vident les postes sans toucher la coque — deux
courbes de danger distinctes à l'écran. Les capitaines célèbres = contenu de rencontre éditable,
navires-boss inclus.

---

## C. Hors combat — la boucle RAW et les éléments nécessaires

**La boucle de jeu est donnée par le RAW lui-même** (`MDG 15 l.13-17`) : (1) vitesse du jour selon
les vents → distance ; (2) surveiller l'Humeur de Manann ; (3) tous les 1d10 jours en mer, un
événement de bord ; (4) à l'accostage, un événement de port sous 2d10 h ; (5) chaque semaine
complète, une Activité par personnage. Le compteur d'événements **traverse les escales** (`l.19`).

Le hors-combat est un jeu de **jauges et de cadences** — décisions rares mais lourdes (cap, paie,
relâche, carénage, cargaison) dont les conséquences tombent au rythme du calendrier.

### C.1 Le dossier de navire : l'entité persistante unique
Un SEUL objet traverse tous les systèmes : profil + blessures de coque, Salissures, réparations
temporaires en attente (dette quotidienne `MDG 13 l.651`), cale (cargaison, eau, vivres, pièces
détachées), équipage nominal, Moral, Humeur de Manann, bourse de bord.
**Matérialisation** : un écran « navire » unique — le même en mer, à quai, en combat. Tous les
systèmes n'en sont que des vues.

### C.2 Le journal de bord : quatre cadences superposées
Jour (distance : M → milles/jour `MDG 15 l.57-70`, ÷2 sans équipage de nuit `l.76` ; Orientation
quotidienne `MDG 13 l.311` ; météo/vent), semaine (Moral `MDG 14 l.143`, Salissures `MDG 13 l.148`,
Activités `MDG 15 l.266`), 1d10 jours (événement de bord `l.89`), escale (événement 2d10 h `l.129`).
**Matérialisation** : le voyage = un **journal de bord qui défile** en accéléré et S'ARRÊTE quand
une cadence tombe. Le joueur vit les arrêts sur image, pas la micro-gestion des jours.

### C.3 La carte, la route, le cap incertain
Index des ports (Taille/Richesse/Production/Surplus/Demande, `MDG 15 l.439-506`), distances en
milles (`l.40-47`), Orientation quotidienne dont l'échec produit une déviation silencieuse
(Changement de cap : +10 %/+25 %/90°/demi-tour, `MDG 13 l.311-331`).
**Matérialisation** : carte maritime ; le pion du navire montre la **position ESTIMÉE**, pas la
vraie. Ports = données éditables.

### C.4 La météo et le vent au quotidien
Météo d10/jour (saisonnalisée `MDG 13 l.164`), vent mis à jour 4×/jour (`l.272`), tempête = affaler
ou mouiller sinon poussé à 25 % (`l.294`).
**Matérialisation** : le MÊME widget rose des vents que le combat ; bascules = événements du journal.

### C.5 L'Humeur de Manann : la superstition devenue mathématique
Jauge cumulative PAR NAVIRE (chaque modificateur une fois, `MDG 15 l.85` ; modificateur individuel
possible `l.87`), alimentée par des ACTES (table `l.97-124` : sacrifices, prêtre à bord, chat +1d10,
partir un 13 −2d10, renommer le navire −1d10, albatros tué −5−2d10, bananes −1d10…) ; **biaise le
d100 des événements** (`l.89`) et l'événement d'escale (±1, `l.129`). Prêtre : bénédictions ≤3/lune
(`MDG 10 l.236`) ; miracles (albatros insubmersible `l.250`, Navigation bénie `l.284`) ; Stromfels
en levier inverse (Faire fi de l'Humeur `MDG 11 l.156-165`, Sacrifice = Voie d'eau ×2 `l.209`,
pacte qui se rembourse « avec intérêts » `MDG 15 l.93`).
**Matérialisation** : jauge visible avec **historique des actes** ; les actes de piété = décisions
offertes aux bons moments (départ, quart, escale).

### C.6 Le tirage d'événements : le générateur de récit
Table d100 de bord (`MDG 15 l.134-236`, de « Triton » à −65 à « Manne de Manann » à 150+ : monstres,
pirates, némésis, rats, usure, calme plat, vaisseau fantôme, bonne humeur…) ; table d'escale 2d10
(`l.243-263` : embrigadement, contrôle des quais, constructeur itinérant, fête de Manann…).
**Matérialisation** : un événement n'est JAMAIS un toast — c'est une mini-scène jouable (les rats =
Test étendu multi-nuits qui gâte la cargaison ; le vaisseau fantôme = choix à coûts ; les pirates =
bascule combat). Chaque entrée = une donnée éditable.

### C.7 Le Moral hebdomadaire : le baromètre social
Départ 75 (`MDG 14 l.141`), recalcul hebdo (`l.143`) sur ~22 facteurs qui sont des CONSÉQUENCES des
décisions (paie +2d10 / pas de paie −3d10, nourriture, relâche accordée/refusée, <1 officier/50
−3d10, maladie −2d10 — `l.149-179`) ; bandes ±DR sur tous les Tests d'équipage (`l.184-202`) ;
désertion à l'escale (1d100/marin, seuils 04/16, `l.192-202`).
**Matérialisation** : le recalcul = un **« conseil de bord »** mis en scène : les facteurs de la
semaine s'affichent ligne à ligne, la jauge bouge, les décisions sociales se prennent là.

### C.8 Les capacités de transport : QUI et QUOI embarque
Le RAW donne DEUX capacités distinctes + une géométrie de poids :
- **Équipage** = les couchettes : « le nombre de membres d'équipage que le navire peut porter sans
  problème de place » ; **l'excédent (équipage OU passagers) déborde sur la Contenance** et en
  subit les pénalités (`MDG 12 l.21`). L'espace occupé dépend de la **Taille** de la créature
  (table `MDG 12 l.23-35` : Très Petite 0,25 espace / 1 Enc … Moyenne 1 / 6 … Monstrueuse 27 / 162)
  — embarquer un ogre ou des chevaux se compte.
- **Contenance** = l'Enc de cargaison sans pénalité (`l.68`) ; surcharge par paliers : >100 % →
  −1 M −1 DR Man, >120 % → −2/−2, >140 % → −3/−3, >150 % → **« Impossible de prendre la mer »**
  (`l.70-75`).
- **Les affaires personnelles ne comptent pas** (sauf volumineux — seuil « petite caisse », laissé
  au MJ → arbitrage maison à chiffrer, `l.37`).
- **Le poids se PLACE** : artillerie >25 %/50 % de la Contenance d'un bord → pénalités M/Man/
  Navigation (`l.430-433`) ; l'équipage minimal (É) conditionne le M nominal (`l.39-45`).
- Concret (table `l.83-103`) : Barge 225 CO, Équipage 4, Contenance 300 ; Caraque 550 CO / 20 / 600 ;
  Croiseur 3 500 CO / 90 / 1 400.
**Matérialisation** : la cale = un **manifeste d'embarquement** (pas un inventaire plat) : couchettes
occupées (équipage, passagers, PRISONNIERS/rescapés des événements), tonnage par catégorie (cargaison
de négoce, provisions, pièces détachées, butin), jauge de surcharge avec ses paliers visibles, et la
répartition du poids pour l'artillerie. Les passagers payants = une source de revenu authorable
(tarifs barge/diligence LDB comme référence de prix) ; le passager clandestin (`MDG 15 l.258`) et les
rescapés (`l.213-218`) VIENNENT des événements — le manifeste est aussi du récit.

### C.9 L'intendance : les jauges consommées par le ticker
Eau 2-3 L/jour/tête (tonneau 145 L, `MDG 14 l.242`), vivres (biscuits vs vraie nourriture → Moral et
scorbut `l.230`), pièces détachées (consommable de l'Entretien, `MDG 12 l.283`).
**Matérialisation** : l'autonomie en JOURS affichée au moment de tracer la route ; la pénurie ne
bloque pas, elle dégrade (Moral, scorbut, Soif) et se voit venir.

### C.10 L'équipage dans la durée
Salaires/jour (Mousse 3 sous, Marin 9, Officier/Médecin 15 — `MDG 14 l.293-302`) avec profils PNJ
complets (`l.305-379`) ; maladies à déclencheurs élégants (mal de mer au 1er voyage `l.217`,
scorbut par MOIS sans vraie nourriture `l.230`, contagion par le tonneau d'eau `l.204-210`) ;
**Entraînement d'équipage** (Activité : Commandement −20 + Compétence −20 → l'équipage monte de DR,
2 pistoles/marin, plafonné aux Augmentations du formateur, `MDG 15 l.294-300`) ; embrigadement à
quai (`l.245`) ; parts de butin (Code Sartosien `MDG 09 l.426-443`).
**Matérialisation** : la feuille d'équipage — les MÊMES individus qu'au combat — paie qui tombe,
malades au carré, compétences qui montent. Le marin formé en traversée est celui qui lancera son dé
dans la bordée.

### C.11 Le navire qui vieillit
Salissures hebdo (5 niveaux cumulatifs → −DR Man/−M ; nettoyage 5-25 % du PRIX du navire ; cale
sèche dès Taille Moyenne, `MDG 13 l.144-159`) ; Usure (1d10 B, `MDG 15 l.200`) ; trois régimes de
réparation (fortune/artisan/cale sèche) ; améliorations = 2 semaines à 1 mois de chantier
(`MDG 12 l.230, l.293`).
**Matérialisation** : la santé du navire est une PLANIFICATION (« on tient jusqu'à Salzenmund ou on
carène ici ? ») ; écran de chantier avec devis et durées ; l'immobilisation se paie en salaires et
en calendrier.

### C.12 L'escale : le hub
Index des ports + événement de port + actions (commerce, recrutement, réparations, bénédiction,
relâche). Décision signature : la **permission de relâche** — accordée (+1d10 Moral, mais désertion
et embrigadement possibles) ou refusée (−2d10 Moral, équipage à bord — `MDG 14 l.159/167`,
`MDG 15 l.245`).
**Matérialisation** : menu de hub (le pendant maritime de la ville), tempo 2d10 h de l'événement.

### C.13 Le commerce : l'économie qui justifie la route
Disponibilité = (Taille + Richesse + Surplus) × 1d10×10 Enc (`MDG 15 l.325-331`) ; marchandage
opposé ±10/20 % (`l.335`) ; acheteur selon Production/Surplus/Demande (`l.360-372`) ; prix
SAISONNIERS par catégorie (`l.406-436`) ; vente de détresse ¼ (`l.399`) ; commerce d'opportunité en
Test étendu (`l.274-286`) ; rumeurs commerciales (Demande +2 temporaire, `l.261`).
**Matérialisation** : écran de négoce par port appuyé sur les cinq indices ; les prix saisonniers et
géographiques rendent la spéculation LISIBLE SUR LA CARTE.

### C.14 Les Activités en mer : l'interlude embarqué
1 Activité/personnage/semaine de 8 jours (`MDG 15 l.266-272`), EXEMPTÉES des règles d'interlude à
terre (Argent à gaspiller…) ; liste dédiée + 4 propres à la mer (Commerce d'opportunité,
Cartographie [+2 DR d'Orientation sur trajet cartographié, `l.288-292`], Entraînement d'équipage,
Entretien du navire).
**Matérialisation** : le système d'Activités existant MONTE À BORD — même catalogue, contexte
« en mer » qui filtre et ajoute. Pas un second système.

### C.15 Le quart et les Périodes de travail : la cadence INFRA-journalière
Omise de la synthèse initiale (audit de complétude 2026-07-08). Le RAW découpe la journée : chansons
de marin 1/quart (`MDG 09 l.40`), prières du Prêtre à chaque quart (`l.706`), Périodes de travail =
unités de fatigue (rameurs 2 h, voile/barre 8 h, puis Test contre l'Exténuation, `MDG 13 l.62,
l.109-111` — Complexe si rythme forcé).
**Matérialisation** : la journée du journal de bord est découpée en quarts ; buffs de chanson et
fatigue s'accrochent au quart, pas au jour.

### C.16 Le voyage rapide : l'auto-résolution donnée par le RAW
Omis initialement. `MDG 15 l.21-37` : UN jet résout tout un trajet — Test d'équipage de Rude
épreuve + dizaine de l'Humeur de Manann + DR → table d10 en 5 paliers (« Voyage désastreux » →
« Voyage parfait »).
**Matérialisation** : le mode « résolution rapide » d'un trajet sans enjeu est OFFERT par le RAW —
c'est le bouton « voyager vite » du jeu, avec l'Humeur et l'état du bord comme entrées. Les deux
modes (jour par jour / un jet) coexistent au choix du joueur.

### C.17 Le chantier : construire, commander, motoriser
Omis initialement. Système de construction en 4 étapes (`MDG 12 l.105-193`) : Taille (10 CO → 5 000
CO), propulsion principale (l'autre −2, min 3), style (Man vs coût −40 %/+20 %, vitesse vs
Contenance de « Escargot » à « Foudroyant »), Traits (Peu maniable −10 %/niv, Renforcé/Robuste/
Solide +10-20 %). Améliorations avec délais de chantier (Blindage : 2 semaines à 1 mois,
`l.230`). **Propulsion à vapeur** naine : M4 constant sans équipage de voile, mais table « Panne de
Vapeur » d100 (moteur qui broute, fuite ébouillantante, explosion de chaudière = Critique de Coque
— `l.305-352`).
**Matérialisation** : le chantier naval = un configurateur de navire data-driven (le pendant
maritime de la création de personnage) ; commander = un délai de campagne ; la vapeur = un profil
de propulsion à part avec son risque d'Incident.

### C.18 Les services d'escale annexes (économies parallèles)
Omis initialement. **Pilote local** pour les zones dangereuses nommées (Gueule du dragon, Cap des
Pirates, Skeers — `MDG 09 l.500-531`) ; **Séquestre des épaves** de l'Empereur : 1 CO par tranche de
10 CO de valeur signalée (`l.790`) — l'économie de la récupération d'épaves ; **journal de bord et
assureur** (`l.613-617`) — l'assurance du navire, narrative dans le RAW.
**Matérialisation** : trois actions d'escale/contenus de plus ; l'assurance chiffrée = arbitrage
maison optionnel.

### C.19 Le naufrage et la survie : la défaite n'est pas un game over
Omis initialement. Canot (amélioration Embarcation de bord, `MDG 12`), sabords ouverts qui
engloutissent (`l.364`), rescapés en canot et naufragé à la bouteille (événements `MDG 15
l.202-218`), île inconnue (eau, chasse, risques — `l.229` env.), natation/noyade (LDB).
**Matérialisation** : couler ouvre une séquence de survie (canots, rivage, récupération) au lieu
d'un écran de défaite — et symétriquement, les épaves ADVERSES produisent rescapés, butin et
recrues. Boucle avec le Séquestre des épaves (C.18).

### C.20 La magie des mers : la couture magie↔naval (MDG 02 — ajout audit de complétude)
**Section de RÈGLES ratée par les premières lectures** (`MDG 02 l.174-262`, encart du collège du
baron Henryk) : **les Domaines de magie se comportent AUTREMENT en mer** — Bête : crits/Maladresses
sur les doubles ET les résultats en 0 (`l.180`) ; Feu : −1 DR de Focalisation, mais +1 DR si le
navire cible est En flammes (`l.182`) ; Cieux : +1 DR d'Incantation en Violente tempête, −1 en
Calme plat ; Vie : DR de Focalisation DOUBLÉS en mer mais Imparfaite Majeure sur crit (`l.186`).
Plus **6 sorts navals complets** : Bourbier vivant (−2 M/−3 DR Man au navire cible), Que d'eau que
d'eau (remplit les tonneaux), **Tourbillon** (la Surincantation escalade Tourbillon → Puissant
vortex → Maelstrom → Maelstrom primordial), Bienfait de Bel Shanaar (+2 DR Orientation), Mer
d'huile (impose Calme plat), Solution de tir optimal de Niezlib (+1 DR au canon 1 Round).
**Matérialisation** : le lanceur de sorts a un VRAI poste dans le combat et le voyage naval — ses
cibles incluent le vent, la mer et les jauges du navire ; les modificateurs de Domaine en mer sont
des données d'environnement de scène, pas des cas spéciaux.

### C.21 Le contenu régional structurant (ajout audit de complétude)
Les chapitres 01-08 sont du CONTENU, mais chiffré par endroits — matière à données :
- **Périls régionaux statués** : la Gueule du dragon = rochers IC 60 + Voie d'eau 1 si ≥20
  Blessures de collision (`MDG 02 l.28`) ; routes du Wasteland = un CHOIX de route porté par un
  Test de Navigation (échec → autant de Bas-Fonds que de DR négatifs, `l.97`).
- **Services de port différenciés** : cale sèche de Dietershafen 10 CO/jour, grattage à moitié
  prix (`MDG 03 l.186`) ; pilote de Marienburg 1 pistole/mètre (`MDG 02 l.110-172`) ; figure de
  proue à 20 % de chance d'enchantement (`MDG 03 l.188`) — l'index des ports peut porter des
  SERVICES, pas que du négoce.
- **Chantier nain** : système d'engrenages de grubark (équipage de rame ÷4, +1 DR anti-épuisement,
  400 CO, détruit sur crit Avirons 5+, `MDG 06 l.145-155`) ; munition Carreau nain norse
  **Brise-coque** (+2 Dégâts + Dévastatrice contre structure en bois, `l.164`) ; runes navales
  (Clairvoyance : Perception insensible à la Visibilité, `l.249-263`).
- **Exemption naine de l'Humeur de Manann** : capitaine nain + équipage largement nain = « ni les
  avantages ni les inconvénients » de la jauge (`MDG 06 l.193`) — la jauge religieuse est
  CONDITIONNELLE à la culture du bord.
- **Création de personnage norse** complète (cultures, table de carrières d100, substitutions —
  `MDG 07 l.222-311`) ; augure Urska (Point de Chance contre Exposition à la corruption,
  `MDG 08 l.140-146`) ; sac à vent norse (table d10 de vent, `l.71-80`) ; cloche de plongée et
  Trait **Expérimental (Indice)** (`MDG 05 l.144-148`).
- Sections vérifiées SANS règles : « Les elfes sur la Mer des Griffes », « La Marine impériale »
  (hors structure d'escadron), MDG 01 — narratif pur.

### C.22 Les périls et les aides à la navigation : le « terrain » de la mer
Sous-couverts initialement. Périls chiffrés (`MDG 13 l.471-564`) : échouage (dégagement au Test de
Force pénalisé de l'Enc TOTAL), icebergs, débris, rochers (20 % d'échouage), détroits et
tourbillons (Indice M — aspiration, un miracle peut les annuler) ; phares (Tests de Perception par
distance, +Savoir Océans sur l'Orientation), clochers (+2 DR, distances ÷2 — `l.333-351`).
**Matérialisation** : la carte maritime porte des ZONES de péril et des aides à la navigation — le
tracé de route devient un choix de risque (couper par le détroit ou contourner), et le pilote local
(C.18) est la réponse économique à ce terrain.

---

## D. Les coutures inter-systèmes (le navire vit ENTRE les systèmes)

1. **Voyage → Combat** : l'événement (pirates, monstre, némésis) EST la porte du combat naval — le
   navire y entre avec ses Salissures, son Moral, sa dette de réparation, ses déserteurs en moins.
   Rien ne se remet à zéro à la frontière.
2. **Combat → Voyage** : on ressort avec cicatrices, prise, blessés ; la réparation de fortune faite
   sous le feu devient la dette quotidienne du retour.
3. **Religion → Événements** : l'Humeur biaise le d100 — la piété est une gestion du risque.
4. **Décisions → Moral → Performance** : paie/nourriture/relâche → Moral → ±DR sur TOUS les Tests
   d'équipage → vitesse, survie, combat. La boucle sociale EST une boucle de gameplay.
5. **Voyage → Interlude** : Activités embarquées ; l'escale rejoint l'interlude à terre.
6. **Économie → Tout** : salaires + vivres + entretien = coût de possession permanent → commerce,
   escorte ou piraterie. Le navire est une entreprise.
7. **Le temps traverse tout** : le compteur d'événements court à travers les escales (`MDG 15 l.19`).

---

## E. Arbitrages maison à trancher (RAW silencieux → donnée taguée, jamais contournement)

| # | Sujet | Silence RAW | Proposition |
|---|---|---|---|
| 1 | Procédure d'abordage | « inévitable » sans règle (`MDG 13 l.420`) | Bascule vers le combat tactique sur ponts accolés ; déclencheur (grappins/passerelle) à chiffrer |
| 2 | Reddition | Aucune règle ; parts de prise prouvent la capture | Seuil de reddition IA adossé au Moral, éditable par profil de conduite |
| 3 | Arcs de tir | « tournées vers l'ennemi » sans angle | Angle en donnée (octants) |
| 4 | Structure du Round naval | ×10/×1 selon interaction, rien d'autre | Horloge à deux vitesses mise en scène |
| 5 | Surprise/identification | Quasi muet | Événement de repérage progressif (Vigie) |
| 6 | Fluvial (campagne du jeu !) | LDB : barge ±30 % amont/aval, point final ; EDOC : étapes terrestres ; AUCUNE navigation fluviale détaillée | Le MÊME châssis (dossier, ticker, événements, Moral, escales) avec paramètres fluviaux réduits — un jeu de DONNÉES, pas un second système |
| 7 | Visibilité de l'Humeur de Manann | « le MJ surveille » | Jauge visible avec historique des actes ; le mystère vit dans les tirages |
| 8 | Mutinerie | Évoquée, jamais chiffrée (`MDG 14 l.139`) | Seuil maison sur le Moral |
| 9 | Procédure de recrutement | Coûts/profils oui, procédure de quai non | Action d'escale simple |
| 10 | Seuil « objets personnels vs cargaison » | « petite caisse », « le MJ doit décider » (`MDG 12 l.37`) | Seuil d'Enc chiffré en donnée |
| 11 | Assurance du navire | Narrative seulement (`MDG 09 l.613-617`) | Optionnelle, chiffrée en donnée si retenue |
| 12 | Tarif des passagers payants | LDB donne les tarifs barge/diligence côté CLIENT ; rien côté armateur | Grille de prix en donnée, ancrée sur les tarifs LDB |
| 13 | Barème du saboteur d'équipage | « le MJ pourra imposer de −1 à −5 DR » selon l'impact décrit (`MDG 14 l.45-47`) | Barème chiffré PAR ACTE de sabotage, porté par la donnée de scène |

---

## F. Suite de la passe (méthode #211)

1. ⬜ **Validation utilisateur de l'attendu** (ce document) — corrections attendues sur les partis
   pris et les matérialisations.
2. ⬜ **RÉALITÉ** : recette JOUEUR d'un scénario naval représentatif (recetteur : budget dur ~150
   appels, « l'écran fait foi », méta-rapport obligatoire, grind = trouvaille n°1).
3. ⬜ **CONFRONTATION** : audit adversarial juge, code + RAW, pièce par pièce contre les éléments
   B.1-10 et C.1-14 — auditer la FORME du modèle contre l'intention, pas que les valeurs.
4. ⬜ **SORTIE** : tickets-thèmes au gabarit (quote, Source verbatim, fix, DoD = recette re-déroulée),
   listés en commentaire de #211.

## Sources de ce document — et état de couverture du livre

Lectures intégrales (workflows de lecture, agents « lecteur », citations verbatim reconfrontables) :
`MDG 12` (475 l.), `MDG 13` (769 l., deux passes combat + voyage), `MDG 14` (382 l.), `MDG 15`
(509 l.), `MDG 09/10/11` (cultes, chansons, classe Côtier), balayage transversal `MDG 00-16` ;
Atlas `docs/raw/activites.md`, `economie.md`, `deplacement.md` (l.1-757). Aucune lecture de `src/`.

**Audit de complétude (2026-07-08, sur question utilisateur)** — trous identifiés contre le
sommaire du livre, puis comblés :
- ✅ **`MDG 16` Bestiaire** lu intégralement (610 l.) → **§ B-bis** : classe d'adversaires
  « monstre vs navire » (3 canaux : coque / équipage / jauges) + 4 capitaines-némésis avec navires
  statués à règles spéciales. Pas de kraken statué.
- ✅ **`MDG 01-08`** lus intégralement (scan mécanique) → **§ C.20** (Magie des mers : Domaines
  modifiés en mer + 6 sorts navals — vraie section de règles ratée par les premières passes) et
  **§ C.21** (contenu régional chiffré : périls IC 60, services de port différenciés, chantier
  nain/grubark/Brise-coque, exemption naine de l'Humeur, carrières norses). « Les elfes sur la Mer
  des Griffes », « La Marine impériale » et `MDG 01` vérifiés SANS règles.
- ✅ Éléments lus mais initialement OMIS de la synthèse, réintégrés en C.15-C.19 et C.22 :
  quart/Périodes de travail, voyage rapide en un jet, chantier/construction/vapeur, pilotes
  locaux/Séquestre des épaves/assurance, naufrage-survie, périls et phares.

**Couverture finale du livre : 16/16 chapitres lus** (12-15 en double passe combat/voyage,
16 intégral, 01-08 en scan mécanique intégral, 09-11 intégraux, balayage transversal en sus).
