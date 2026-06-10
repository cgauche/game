# Actions de combat implicites + cadre portrait du combattant actif — design

Date : 2026-06-10. Validé par l'utilisateur (lecture stricte l.77, tap-aperçu → tap-confirme,
cadre riche réservé au combattant actif).

## But

Supprimer les boutons « Déplacer », « Attaquer » et « Charger » de la hotbar : le déplacement
devient le comportement par défaut du clic, l'attaque devient le clic sur un ennemi
(move-then-attack en mêlée), la Charge devient implicite (attaque de CàC avec déplacement sans
être Engagé). Refondre le bloc portrait du combattant actif en cadre à jauges crantées de
taille fixe (Action / Mouvement / Avantage), avec cap d'Avantage à 10.

## Fondement RAW (vérifié, LDB VF)

- **Charge implicite** — LDB 15-Dépl l.74-75 : « Si vous n'êtes pas encore _Engagé_ en combat,
  vous pouvez utiliser votre Mouvement pour Charger. Si vous Chargez, votre action doit être un
  Test de Corps à corps pour attaquer un adversaire. » Conditions entièrement détectables au
  clic ; le RAW ne donne aucun inconvénient à la Charge → pas d'opt-out nécessaire.
- **Avantage de Charge (lecture STRICTE retenue)** — LDB 15-Dépl l.77 : +1 Avantage UNIQUEMENT
  si l'adversaire se trouvait « au moins à une distance, en mètres, égale à votre
  caractéristique de Mouvement » avant la Charge, dans la portée de Course. En cases (1 case =
  2 m, l.55) : `ceil(M/2) ≤ dist ≤ 2M+1`. Le +1 « de base » de la lecture cumulative
  (13-Combat l.102) est ABANDONNÉ — décision utilisateur. C'est un nerf symétrique
  (héros et IA), qui corrige aussi l'exploit actuel « Charger une cible adjacente = +1 Av ».
- **Cap d'Avantage à 10** — LDB 15-Dépl l.17 (Option : Limiter les Avantages) : « Le plafond
  d'Avantages possède une limite préétablie […] 10 fonctionne plutôt bien puisque vous pouvez
  facilement les comptabiliser avec 1d10. » Option RAW adoptée, appliquée à TOUS les
  combattants.
- **Course** = 2M cases (Tableau des Mouvements l.61-72) ; **Désengagement** l.84-89 ;
  la règle M\*A | A-M\* (mouvement non entrelacé) et « Charge = manœuvre pleine,
  movementUsed === 0 » restent inchangées.

## A. Routage des clics (tour d'un héros)

Les modes `move` / `attack` / `charge` et leurs boutons disparaissent. La portée de
déplacement restante est surlignée en permanence pendant le tour d'un héros (le surlignage
`reachable` actuel, recalculé après chaque segment/action).

Un état transitoire **`battle.preview`** porte l'aperçu du tap 1 :
`{ kind: 'move' | 'attack' | 'charge', tile?: Pt, targetId?: string, path: Pt[], cost?, adv? }`.
Effacé à chaque changement de tour/Round, par Échap/clic ailleurs, et par `reset()`.

- **Clic case atteignable** : tap 1 = aperçu (chemin tracé + coût en cases) ; tap 2 sur la
  même case = déplacement via la logique actuelle de `battleClickTile` (segments décomposables,
  M-A-M, Peur, snapshot/« Annuler dépl. » inchangés). **Engagé** → le clic sol route vers le
  flux de Désengagement existant (pas de déplacement libre).
- **Clic ennemi** — l'arme du set actif décide (logique `attackWeapon` existante) :
  - à portée d'Allonge → attaque directe (tap 1 aperçu « Attaquer », tap 2 = modale d'attaque) ;
  - au-delà, arme à distance chargée + munitions → tir (aperçu « Tir », tap 2 = modale) ;
  - au-delà, mêlée, Mouvement non entamé + non Engagé → **Charge** : aperçu = chemin vers la
    case adjacente la moins chère (`bestAdjacentReachable`, portée de Course 2M), badge
    « Charge » + « +1 Av » si `dist ≥ ceil(M/2)` cases ; tap 2 = déplacement + modale
    d'attaque (`fromCharge`). La modale d'attaque n'est pas annulable : le commit ne se fait
    qu'au tap 2 (RAW l.75 : l'Action d'une Charge DOIT être l'attaque).
  - au-delà, mêlée, Mouvement entamé → move-then-attack ordinaire dans le mouvement restant
    (pas de bonus, pas de portée Course) ; inatteignable → message.
- Les modes à bouton restants (Incanter, Soigner, Munition, Piétiner, Détermination,
  Spécial — dont Courir, Viser, Recharger…) gardent leur sémantique de clic actuelle. Quand un
  mode est actif, les clics suivent le mode (ex. clic-case en incantation = zone de sort).
- L'attaque gratuite de Frénésie post-Action reste accessible par clic ennemi direct
  (logique `freeFrenzyAttack` existante). Sonné/Brisé/Peur : gardes existantes inchangées.

## B. Charge stricte

`chargeAdvantage(M, dist)` retourne `1` si `ceil(M/2) ≤ dist ≤ 2M+1`, sinon `0` (plus de
type de retour `2`). Même fonction pour l'IA (`combatFlow` l.~2627) : nerf symétrique.
Commentaires RAW mis à jour (l.77 seul, retirer la citation 13 l.102 comme « +1 base »).
La Charge reste une manœuvre pleine : `movementUsed === 0` requis, consomme tout le
Mouvement, non décomposable.

## C. Cap d'Avantage 10

Helper unique moteur `gainAdvantage(c, n)` (clamp à 10) remplaçant TOUS les `advantage +=`
(combatFlow, store, talents éventuels). Héros ET ennemis. Les pertes/remises à zéro
(désengagement par Avantage, fin de combat…) inchangées.

## D. Cadre portrait du combattant actif (barre d'action seulement)

Layout : jauge d'**Action** verticale à gauche | **portrait 72 px** | jauge de **Mouvement**
verticale à droite ; sous le portrait : barre de **vie** horizontale (continue, `hpColor`),
puis barre d'**Avantage** crantée.

- Les trois jauges (Action / Mouvement / Avantage) = **longueur fixe découpée en N crans
  égaux** (segments flex) : Action 1-2 crans (Frénésie), Mouvement = budget du tour
  (`moveLeft + movementUsed`), Avantage 10 crans fixes. Qu'on ait 2 ou 150 points, la barre
  fait la même taille.
- `PortraitTile` du dock/frise **inchangé** (jauge PV interne conservée à 40-56 px). Le
  portrait actif n'affiche plus la jauge PV interne ni le chip « Av+N » (remplacés par les
  barres externes).
- Responsive : le cadre reste un cluster compact autour du portrait 72 px, utilisable à
  360 px (breakpoints canon 900/700/560).

## E. Tests

- **Moteur** : bornes de `chargeAdvantage` strict (adjacent → 0 ; seuil exact → 1 ; hors
  Course → 0) ; clamp de `gainAdvantage` (cumuls au-delà de 10).
- **Store** : routage des clics — ennemi lointain en mêlée = preview puis charge ;
  `movementUsed > 0` → pas de Charge ; Engagé → désengagement ; tir si arme chargée ;
  frénésie libre post-Action ; preview commit/annulation ; preview purgé par `reset()` et
  changement de tour.
- Garde-fou statique « un jet = une modale » inchangé ; golden combat inchangé hors
  ajustement des valeurs d'Avantage de charge.
- Recette navigateur (Playwright) sur un scénario de test existant : déplacement double-tap,
  charge avec badge, tir, désengagement au clic sol.

## Conséquences assumées

- **Nerf** : le +1 systématique de Charge disparaît (héros et IA).
- Le double-tap ajoute un clic au déplacement — compensé par la suppression du clic
  « Déplacer » ; le total de clics est identique et le mauvais-clic irrattrapable disparaît.
- Tout golden/test calé sur +1/+2 de charge est à mettre à jour.
