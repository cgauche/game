# Atlas RAW — Combat naval (La Mer des Griffes)

> Règles **RAW** du combat naval WFRP4, consolidées depuis **La Mer des Griffes** (MDG) ch.12-14, à usage
> d'agent. Chaque topic = **synthèse fidèle** + **Sources RAW** (`MDG NN l.X` ; NN = préfixe du fichier de
> chapitre `Source/WH - V4 - La Mer de Griffe/NN - …`, l = lignes du `.md`) + **citations verbatim** +
> **Voir aussi** + **Implémente** (module `src/`) + **État du code** (✅ fait · ⚠️ partiel · ❌ faux · ⬜ manquant).
>
> ⚠️ **Cette fiche est née d'un constat** : les implémentations naval ont répété des violations RAW faute
> d'avoir lu le mécanisme COMPLET d'abord (cf. mémoire `feedback-raw-reference-doc-before-impl`). Elle est la
> **référence** ; on implémente CONTRE elle, plus de mémoire. Abréviation `MDG` = CLAUDE.md (à inscrire dans
> `sources.md`). Combat à pied / qualités d'arme génériques → [`combat.md`](combat.md).
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Tests d'équipage : mécanisme général](#tests-dequipage-mecanisme-general)
- [Tests d'équipage : les types et leur rôle essentiel](#tests-dequipage-les-types-et-leur-role-essentiel)
- [L'équipage comme RESSOURCE — le Round naval](#lequipage-comme-ressource--le-round-naval)
- [Manœuvre / Navigation du navire](#manuvre--navigation-du-navire)
- [Stats de coque (E, B, Contenance, Man)](#stats-de-coque-e-b-contenance-man)
- [Artillerie : pièces et munitions](#artillerie--pieces-et-munitions)
- [Artillerie : Arme d'équipe et sous-effectif](#artillerie--arme-dequipe-et-sous-effectif)
- [Tir de batterie (la bordée)](#tir-de-batterie-la-bordee)
- [Infliger des Dégâts aux navires](#infliger-des-degats-aux-navires)
- [Critiques de navire (Éclats, Voie d'eau, En flammes)](#critiques-de-navire-eclats-voie-deau-en-flammes)
- [Collision / éperonnage](#collision--eperonnage)
- [Moral du navire](#moral-du-navire)

---

## Tests d'équipage : mécanisme général

**Synthèse.** Pour un grand vaisseau, au lieu de Tests individuels, on fait des **Tests d'équipage** : plusieurs
Personnages tenant des **rôles** contribuent, **chacun fait SON Test, tous les DR sont additionnés**. **Total ≥ 1
DR = succès** (le MJ peut accepter 0). Le MJ peut donner des bonus/pénalités en masse. Un rôle peut être déclaré
**essentiel** → son DR (positif OU négatif) **compte double**. **Mousse** est le rôle par défaut de ceux qui ne
sont pas utiles ailleurs (facultatif si on n'a pas un bon niveau de Voile). **Qui lance** : un PJ tenant un rôle
lance pour représenter tous ceux qui le tiennent ; plusieurs PJ au même rôle → tous lancent, total cumulé. **Si
les PJ tiennent plusieurs rôles importants, les PNJ ne contribuent pas** (la perf des PJ représente tout
l'équipage) — un PNJ ne lance QUE pour un rôle qu'aucun PJ n'occupe, ou s'il est plus compétent, ou comme némésis.
Un saboteur **ne lance pas** : le MJ impose −1 à −5 DR. **Manque de bras** : si trop peu de marins, un marin peut
**cumuler 2 rôles** (les deux jets, **+2 crans de Difficulté**) ; si on ne peut toujours pas remplir le minimum,
le Test subit **−2 DR et plafonne au Succès Minime** (sur un grand navire, le modificateur s'applique **par tranche
de 10 % d'équipage manquant**).

**Sources RAW.** `MDG 14 l.9` · `l.13` · `l.15` · `l.19` · `l.37` · `l.39-43` · `l.45-47` · `l.51-55`.

**Citations.**
- `MDG 14 l.13` — « tout le monde effectue son Test individuel et tous les DR sont additionnés… **Si le total est
  de 1 DR ou plus, le résultat global est un succès.** »
- `MDG 14 l.19` — « l'un des rôles est essentiel… **il compte double. Tout DR, ou DR négatif, qu'il génère est
  alors doublé.** »
- `MDG 14 l.39` — « Si les Personnages… jouent plusieurs rôles importants, alors **il n'est pas utile que les PNJ
  contribuent** : la performance des Personnages représente celle de tout l'équipage. »
- `MDG 14 l.53` — « un même membre d'équipage peut cumuler deux rôles… mais la **Difficulté de ces jets augmente
  de 2 crans** pour représenter leur attention divisée. »

**Voir aussi.** [Tests d'équipage : les types](#tests-dequipage-les-types-et-leur-role-essentiel) · [L'équipage
comme ressource](#lequipage-comme-ressource--le-round-naval) · [`tests.md`](tests.md) (DR, Succès Minime).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.9, l.13, l.19, l.39, l.53) → `progression`, `skill`, `progression-poursuite`, `rollCrewRole`, `ShipBatteryModal`, `isPassengerInBattle`, `maneuverCrewTotal`, `ShipManeuverModal`, `resolveVolley`, `shipCrewAssignments`, +35 — `src/data/crew-test-types.json`, `src/engine/crewMorale.ts`, `src/engine/policy.ts`, `src/engine/types.ts`, `src/engine/volley.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, +13 fichiers

**État du code.** ✅ somme des DR, essentiel ×2, Moral, « un jet par poste » (PJ + 1 marin représentant).
✅ **Manque de bras** : cumul 2 rôles = +2 crans (`crewActed` + `easeDifficulty(-2)`) ET sous-effectif d'équipage
GLOBAL −2 DR par tranche de 10 % manquant + plafond Succès Minime (`undercrewPenalty` vs `ship.crew`, branché aux
Tests de manœuvre/batterie via `maneuverCrewTotal`). ⬜ saboteur (−1 à −5 DR).
⬜ Chansonnier (bonus de chant non chiffré par le RAW → non modélisé, OK).

---

## Tests d'équipage : les types et leur rôle essentiel

**Synthèse.** Chaque situation a son type, qui définit les rôles pertinents (italique RAW = **essentiel**). Tous
partagent le pool **Capitaine / Chansonnier / Mousse / Navigateur / Timonier / Vigie / Artilleur**.

| Type | Rôle essentiel | Note |
|---|---|---|
| **Progression** (Navigation normale) | *Capitaine* | `l.63-65` |
| **Progression en Poursuite** | *Mousse* | `l.67-71` (les Mousses rament/réduisent la voilure) |
| **Manœuvre** (virage serré, obstacle) | *Timonier* | `l.74-78` |
| **Perception** (repérer un péril) | *Vigie* | `l.80-84` |
| **Orientation** (garder le cap) | *Navigateur* | `l.86-90` |
| **Affaler les voiles** (gros vent) | *Mousse* | `l.92-96` |
| **Extermination des nuisibles** (Test étendu) | *Mousse* | `l.98-104` ; Ratier (Projectiles Fronde) possible |
| **Rude épreuve** (moral en mer) | *Cuisinier* | `l.106-114` ; DR négatifs → baisse le Moral |
| **Entretien** (réparations) | *Mousse* | `l.116-124` ; −2 DR si remplace un charpentier formé |
| **Tir de batterie** (bordée) | *Artilleur* | `l.126-130` |

**Sources RAW.** `MDG 14 l.61-130`. **Données.** `src/data/crew-test-types.json` (10 types), `crew-roles.json`.

**État du code.** ✅ `manoeuvre` (Timonier ★) + `batterie` (Artilleur ★) câblés. ⬜ les 8 autres types existent en
donnée mais ne sont pas déclenchés par le jeu (perception, orientation, progression… = futurs).

---

## L'équipage comme RESSOURCE — le Round naval

**Synthèse.** ⚠️ **Le combat naval RAW est ABSTRAIT, pas un tour tactique par cases.** Il repose sur la
**Course-poursuite** (`MDG 13 l.354-420`) : une **Distance** (10 m/point) entre les navires ; **par ordre
d'Initiative, chaque navire fait UN Test de Navigation pour son Mouvement** (l.376), la Distance se recalcule, et
si les navires sont à portée ils **interagissent** (tir, sorts). **Un même Round, un navire se déplace ET peut
tirer** (l.418 : « La caraque peut à présent tirer avec son canon » pendant la poursuite). Ce n'est PAS « 2
actions pour une personne » : ce sont des **équipes différentes en parallèle** (Timonier à la barre PENDANT que
les Artilleurs servent les canons, l.37). **La VRAIE contrainte = l'équipage** : un marin tient **un rôle par
Round** ; cumuler 2 rôles = **+2 crans** (Manque de bras, l.53). Donc **gros équipage → manœuvre ET bordée
simultanées (gens différents)** ; **petit équipage (4 PJ) → on répartit (et on subit le Manque de bras) ou on
choisit**.

> Le RAW NE définit PAS de « N actions par navire par Round » (combat abstrait). Notre adaptation tactique (navire
> = acteur sur la grille) doit donc faire de **l'équipage la ressource** : qui est assigné à un rôle ce Round n'est
> pas disponible pour un autre. C'est CE modèle qui rend l'assignation d'équipage signifiante.

**Sources RAW.** `MDG 13 l.354-420` (course-poursuite, Test de Navigation par Initiative + tir) · `MDG 14 l.37`
(rôles parallèles) · `MDG 14 l.53` (cumul = +2 crans).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.354-420) → `MapPlace`, `scene`, `perilManagement` ⚠sans-appelant, `lighthouseSpotDifficulty`, `lighthouseOrientationDR`, `LIGHTHOUSE_PERIL_SPOT_BONUS` ⚠sans-appelant, `WorldMapPlacePanel`, `maelstrom-primordial`, `resolveShipUnits`, `pursuitLowMPenalty`, +10 — `src/data/schemas/defs/sea-navigation.ts`, `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-navigation.json`, `src/data/sea-perils.json`, `src/engine/seaNavigation.ts`, `src/engine/seaPerils.ts`, +6 fichiers
- `MDG 14` (l.37, l.53) → `progression`, `skill`, `progression-poursuite`, `rollCrewRole`, `ShipBatteryModal`, `isPassengerInBattle`, `ShipManeuverModal`, `resolveVolley`, `CrewTestModalView`, `withCrewActed`, +26 — `src/data/crew-test-types.json`, `src/engine/crewMorale.ts`, `src/engine/policy.ts`, `src/engine/types.ts`, `src/engine/volley.ts`, `src/scenes/test-scenarios/14-voyage-maritime.ts`, +12 fichiers

**État du code.** ✅ (R3) `battle.crewActed` (par navire, reset au round-start `enterRoundStartPause`) recense les
marins ayant contribué à un Test ce Round. Les rôles Capitaine/Chansonnier/Mousse/Timonier étant dans `manoeuvre`
ET `batterie`, un marin qui contribue aux DEUX le même Round le fait en **cumul à +2 crans** (`rollCrewRole(cumul)`
→ `easeDifficulty(-2)`) — décision GM : cumul AUTORISÉ (l.53), pas d'exclusion. La bordée est en plus bornée par la
**Recharge** (topic suivant). ✅ Manque de bras GLOBAL (−2 DR + plafond Succès Minime par tranche de 10 % manquant
vs `ship.crew`) : `undercrewPenalty` → `maneuverCrewTotal`. ✅ **Tâches d'équipage PARALLÈLES le même Round** :
manœuvre + bordée(s) + **recharge** coexistent (la bordée/recharge ne consomment PAS `acted`, seule la manœuvre =
1 déplacement/Round), bornées par l'occupation `crewActed` (l.37).

---

## Manœuvre / Navigation du navire

**Synthèse.** Le « Personnage à la barre » (ou le Test d'équipage *Timonier* ★) fait un **Test de Navigation** —
**Voile** si le navire avance à la voile, **Ramer** aux avirons. Le **Man** (Manœuvrabilité) du navire **modifie
le DR** du Test (ce n'est pas une difficulté : un stat-bloc « −1 DR »). Sur **réussite du Test** (d100 ≤ cible), le
navire **vire** ; en cas d'échec il **se déplace normalement, sans bonus** (le virage seul échoue ; il avance
quand même). Le déplacement suit la **Progression** (course-poursuite, tableau DR `MDG 13 l.378-399`). Un navire à
M ≤ 3 subit des pénalités de Poursuite (M3 = −1 DR, M2 = −2, M1 = −3, `l.399`).

**Sources RAW.** `MDG 13 l.304` (virage = Test réussi) · `MDG 13 l.376` (Test de Navigation pour le Mouvement) ·
`MDG 13 l.378-399` (Progression) · `MDG 12 l.92/94` (stat-bloc Man −1 DR) · `MDG 13 l.173` (« Peu maniable »).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.92) → `shipboardSouls`, `surcharge-3` — `src/data/sea-cargo.json`, `src/gameIso/rig/ship/defs/bateau-de-patrouille.ts`, `src/state/shipCrew.ts`
- `MDG 13` (l.173, l.304, l.376, l.378-399) → `OrientationOutcome`, `aucune`, `orientationOutcome`, `legeres`, `voyageTiles`, `abondantes`, `pursuitLowMPenalty`, `pursuitDistanceGain`, `tres-abondantes`, `caniculaire`, +26 — `src/data/schemas/defs/sea-navigation.ts`, `src/data/schemas/defs/sea-weather.ts`, `src/data/sea-navigation.json`, `src/data/sea-weather.json`, `src/data/trappings.json`, `src/engine/seaNavigation.ts`, +2 fichiers

**État du code.** ✅ Test d'équipage (Timonier ★), virage = réussite du d100 (≠ dr≥0), Man en ±DR, Progression,
placement des pièces (Contenance), « Peu maniable »/« Lissage ». ⬜ Vent (direction/force → M), affaler les voiles.

---

## Stats de coque (E, B, Contenance, Man)

**Synthèse.** Profil de navire (`MDG 12 l.85`) : **Voiles M(É)**, **Avirons M(É)**, **Man**, **Taille**, **E**,
**B**, **Contenance**, Traits/Améliorations.
- **Endurance (E)** : le **premier chiffre = BE**, **déduit de TOUS les Dégâts** avant de les appliquer aux Blessures.
- **Blessures (B)** : combien de Dégâts la coque encaisse. Le **chiffre des dizaines des Blessures COURANTES = BB**
  (Bonus de Blessures) → **change au cours de la rencontre** (utilisé pour résister aux collisions).
- **Contenance** : capacité de cargaison/équipage ; au-delà → **−M, −1 DR Manœuvre** (et pire à +20/+40/+50 %).
- **Man** : modificateur de DR des manœuvres.

**Sources RAW.** `MDG 12 l.54-77` · `l.85` (table de profil). **Données.** `src/data/vehicles.json` (facette `ship`,
`hull.rig`, E/B/Man/Contenance par navire).

**État du code.** ✅ BE déduit (`resolveVolley`/collision), Contenance (`placementPenalty`). ⚠️ **BB dynamique
(dizaines des Blessures courantes)** : vérifier qu'il est relu à l'usage et pas figé. ⬜ Taille du navire dans le
tableau Taille-vs-corps-à-corps (`MDG 13 l.616-637`).

---

## Artillerie : pièces et munitions

**Synthèse.** Pièces d'artillerie (`MDG 12 l.401-407`). Le `+N` des Dégâts = **N + SL** (notation des armes à
distance ; le SL/DR du jet de touche s'ajoute).

| Pièce | Portée | Dégâts | Atouts / Défauts |
|---|---|---|---|
| Baliste | 100 | **+12** | Arme d'équipe 2, Pointue, **Recharge 3** |
| Canon (petit) | 50 | **+10** | Arme d'équipe 2, Dangereuse, **Recharge 4** |
| Canon (moyen) | 75 | **+14** | Arme d'équipe 3, Dangereuse, **Recharge 6** |
| Canon (grand) | 150 | **+16** | Arme d'équipe 4, Dangereuse, **Recharge 8** |
| Mortier | 100 | – | Arme d'équipe 3, **Recharge 4** |
| **Pierrier** | 30 | **+14** | Dangereuse, **Recharge 4** (— **pas Arme d'équipe : solo**) |

**Munitions** (`MDG 12 l.410-424`) — façonnent Dégâts + Atouts : Canon **boulet** (Explosion 2, Percutante),
**mitraille** (−5 Dégâts, Tir de zone 5) ; Pierrier **balles** (+1, Empaleuse, Perforante, Tir de zone 3). **Tir
de zone (Indice)** (`l.466-472`) : Bout portant → +Indice aux Dégâts ; Courte-Longue → touche +Indice cibles
proches ; Extrême → −Indice Dégâts.

**Sources RAW.** `MDG 12 l.401-407` (pièces) · `l.410-424` (munitions) · `l.466-472` (Tir de zone).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.401-407, l.410-424) → `ammoSeq`, `canon`, `placementPenalty`, `VolleyShot`, `SHIP_ARC_PREF`, `resolveVolley`, `shipManeuverParams`, `applyNavalSurprisePosition`, `compatibleAmmo`, `AuthoredShipPoste`, +1 — `src/engine/items.ts`, `src/engine/types.ts`, `src/engine/volley.ts`, `src/scenes/test-scenarios/duel-naval.ts`, `src/state/combatSlice.ts`, `src/state/fireArc.ts`, +4 fichiers

**État du code.** ✅ (R1) `resolveVolley` prépare l'arme de chaque pièce comme le tir individuel : `weaponWithAmmo`
(munition du chef → Dégâts + **Perforante**/bypass via `woundsFromHit`) puis `crewedFireWeapon` (sous-effectif).
✅ **Explosion / Tir de zone** (multi-cibles, cf. [Munitions à aire](#munitions-a-aire-explosion--tir-de-zone--multi-cibles)).
⬜ RESTE : qualités à chiffre des unités (Percutante/Dévastatrice/Empaleuse) en bordée ; **Dangereuse → Incident** ;
picker de munition par poste + approvisionnement des navires.

---

## Artillerie : Arme d'équipe et sous-effectif

**Synthèse.** Une **Arme d'équipe (N)** ne fonctionne qu'avec **N servants** (tous doivent avoir **Projectiles**
adapté) ; ils en **nomment un** pour faire le jet. Des servants en plus n'aident pas au tir (mais déplacent/
compensent les pertes). **Sous-effectif** (`MDG 12 l.448-458`), pénalités **cumulatives** :

| Servants présents | Arme d'équipe 2 | Arme d'équipe 3 | Arme d'équipe 4 |
|---|---|---|---|
| 3 | — | — | **Recharge doublée** |
| 2 | — | **Recharge doublée** | + **Imprécise** |
| 1 | **Recharge doublée** | + **Imprécise** | + **Dangereuse** |

Si une pièce reçoit un Défaut qu'elle a déjà → **−10 aux Tests de Projectiles** à la place (`l.460`). **Recharger**
une Arme d'équipe : un servant peut apporter son **Soutien** (LDB 12 p.155) au Test (`l.462`). **Incident** sur une
Arme d'équipe → **tous les servants** sont touchés (`l.464`).

**Sources RAW.** `MDG 12 l.440-464`. **Citation** `l.458` : « les pénalités… sont **cumulatives**… Arme d'équipe
4 maniée par une seule personne voit son temps de recharge doublé et reçoit *Imprécise* et *Dangereuse*. »

**Voir aussi.** [Tir de batterie](#tir-de-batterie-la-bordee) · [`combat.md`](combat.md) (Imprécise = −1 DR ;
Dangereuse = Incident).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.440-464) → `crewedPenalty`, `warMachineCrewPenalty`, `ReloadModalView`, `placementPenalty`, `crewedFireWeapon`, `shipManeuverParams`, `firedWeapon`, `Weapon`, `ActionBar`, `attackModifiers`, +4 — `src/data/qualities.json`, `src/engine/combat.ts`, `src/engine/crewedWeapon.ts`, `src/engine/types.ts`, `src/engine/warMachineCrew.ts`, `src/state/combatArea.ts`, +7 fichiers

**État du code.** ✅ (R1) `resolveVolley` dérive l'arme effective de chaque pièce via `crewedFireWeapon(item,
servantsPrésents)` (exposés non-incapacités) AVANT le calcul de Dégâts → un Canon moyen (Arme d'équipe 3) à 1 servant
tire en Recharge ×2 + Imprécise (−1 DR via `attackDRAdjust`). ✅ **Recharge = Test étendu de Projectiles + Soutien**
(LDB 62 l.333 / MDG 12 l.462) : `crewedReloadStep` (cumul de DR vers Recharge N) + `soutienBonus` GÉNÉRIQUE (un servant
prête +10) → action « Recharger » du navire (`battleShipReload`), état `loaded`/`reloadProgress` sur le POSTE, reset
si interrompu. ⬜ Incident de tir (Dangereuse) noté hors périmètre.

---

## Tir de batterie (la bordée)

**Synthèse.** **Procédure complète.** **(1) Prérequis** : un ennemi à portée, dans un **arc** où le navire a des
pièces tournées vers lui ; chaque pièce est **servie** (Arme d'équipe N) et **chargée** (pas en cours de Recharge).
**(2)** Le Capitaine décide de lâcher une bordée — **l'alternative** au tir canon-par-canon (chaque pièce ferait
sinon son propre Test de Projectiles). **(3)** UN **Test d'équipage** : *Artilleur* ★ (DR ×2) + Capitaine /
Chansonnier / Mousse / Timonier ; plusieurs PJ Artilleurs lancent (un par équipe de pièce), DR **cumulés** + Moral.
**(4) Application** : « le total de DR s'applique à **toutes les armes à feu tournées vers l'ennemi, pour le
meilleur et pour le pire** » → le DR partagé **remplace le jet de touche de chaque pièce** ; par pièce :
**Dégâts = arme (+N = N + DR) + munition − BE − blindage** (plancher 0). Localisation 1d100 (voir topic suivant).
**(5) Après** : chaque pièce passe en **Recharge N Rounds** (doublée si sous-effectif ; Soutien possible) ;
Dangereuse → Incident (tous les servants).

**Sources RAW.** `MDG 14 l.126-130`. **Citation** `l.128` : « **Plutôt que de lancer les dés pour toucher pour
chaque canon**, le Test d'équipage de Tir de batterie peut être effectué et **le total de DR s'applique à toutes
les armes à feu tournées vers l'ennemi, pour le meilleur et pour le pire.** »

**Voir aussi.** [Arme d'équipe](#artillerie--arme-dequipe-et-sous-effectif) · [Pièces et munitions](#artillerie--pieces-et-munitions)
· [Dégâts aux navires](#infliger-des-degats-aux-navires) · [L'équipage comme ressource](#lequipage-comme-ressource--le-round-naval).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.126-130) → `ship-criticals`, `paie-genereuse`, `ShipBatteryModal`, `capitaine-competent`, `faveur-de-manann`, `un-officier-pour-10`, `capitaine-vaillant`, `manoeuvre`, `nourriture-au-dessus-des-rations`, `bon-presage`, +41 — `src/data/crew-morale.json`, `src/data/crew-test-types.json`, `src/data/etats.json`, `src/data/localisation.json`, `src/data/ship-criticals.json`, `src/engine/volley.ts`, +9 fichiers

**État du code.** ✅ **(1)(2)(3)(4-Dégâts)(5)** après refonte : Test d'équipage multi (Artilleur ★) → DR partagé →
chaque pièce préparée comme le tir individuel (effectif via `crewedFireWeapon`, munition via `weaponWithAmmo`) → Dégâts
(`woundsFromHit` plancher 0) + localisation 1d100 + Critique (double OU B=0) ; après tir la pièce est **DÉCHARGÉE**
(`loaded=false`), rechargée par le **Test étendu** `battleShipReload` (≠ auto-rechargement) + équipage-ressource
(`crewActed`, cumul +2 crans, tâches PARALLÈLES). ✅ **Explosion / Tir de zone** (cf. topic suivant) ; ⬜ RESTE : Dangereuse/Incident.

---

## Munitions à AIRE (Explosion / Tir de zone) — multi-cibles

**Synthèse.** Deux Atouts d'arme/munition à effet de zone, pilotés par la DONNÉE (`qualities.json`, lus par
`resolveQualities`/`caps`) — **aucun id d'arme en dur**, un SEUL résolveur (`resolveWeaponArea`) partagé par le tir
individuel ET la bordée :

- **Explosion (Indice)** (`LDB 62 p.298`) : « **Tous les Personnages situés à *Indice* mètres du point cible frappé
  subissent DR + Dégâts d'arme et gagnent tous les États infligés par l'arme.** » → DR+Dégâts (déjà calculés) +
  propagation des États par le chemin GÉNÉRIQUE `onHit` (`fireTriggers`).
- **Tir de zone (Indice)** (`MDG 12 l.466-472`) : **Bout portant** → 1 cible, **+Indice aux Dégâts** ; **Courte à
  Longue** → la cible + les **Indice cibles visibles les plus proches** ; **Extrême** → idem mais **−Indice aux
  Dégâts**. La bande dérive de la portée (`rangeBandName`), le rayon des mètres→cases via `sceneMetresPerTile`.

**Cibles secondaires EN MER — composition LITTÉRALE de deux règles RAW (INTERPRÉTATION, choix conservateur).** À
l'échelle Mer (`metresPerTile = 10`), un rayon de quelques mètres fait < 1 case : un rayon métrique strict
n'attraperait personne (dégénéré). On compose donc, sans inventer de règle :

- `MDG 13` (Dégâts aux navires) : un coup à la Localisation « **Équipage** » touche un **marin EXPOSÉ** « comme un
  combat normal » (précédent des **Éclats** : Indice marins encaissent un coup, `exposedCrew`) ;
- `MDG 12 l.466-472` / `LDB 62 p.298` : Tir de zone ajoute les *Indice* plus proches ; Explosion touche tous dans le rayon.

→ Quand la cible primaire d'une munition à aire est un **NAVIRE** (`bodyShape:'vehicule'`), les cibles secondaires
sont l'**ÉQUIPAGE EXPOSÉ de ce navire** (`exposedCrew(crewIds)`) — **jusqu'à Indice** marins pour Tir de zone, **tous**
pour Explosion. PAS de cas spécial « navires au contact » : un autre navire n'est touché QUE si la règle métrique
générique (cible = personnage, distance via `sceneMetresPerTile`) l'attrape. Les Dégâts (+Indice/−Indice par bande),
`woundsFromHit` et la propagation des États (`onHit`) sont COMMUNS aux deux branches.

**Voir aussi.** [Critiques de navire (Éclats)](#critiques-de-navire-eclats-voie-deau-en-flammes) ·
[Tir de batterie](#tir-de-batterie-la-bordee) · [Pièces et munitions](#artillerie--pieces-et-munitions).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 12` (l.466-472) → `crewedPenalty`, `ReloadModalView`, `crewedFireWeapon`, `firedWeapon`, `Weapon`, `ActionBar`, `attackModifiers`, `tir-de-zone`, `GameState`, `createCombatSlice`, +1 — `src/data/qualities.json`, `src/engine/combat.ts`, `src/engine/crewedWeapon.ts`, `src/engine/types.ts`, `src/state/combatArea.ts`, `src/state/combatFlow.ts`, +4 fichiers

**État du code.** ✅ Tir de zone (3 bandes RAW, corrige l'ancien +Indice Blessures brut → +Indice Dégâts ; ajoute la
bande Extrême) ; ✅ Explosion (rayon Indice + États propagés) ; ✅ branche navale (équipage exposé) ; ✅ extensibilité
bordée (onHit générique). ⬜ RESTE : l'AoE « point cible » libre (on vise la cible, pas une case arbitraire) — RAW vise
le « point cible frappé », ce qui coïncide avec la cible de la touche ; suffisant pour les munitions navales.

---

## Infliger des Dégâts aux navires

**Synthèse.** Un navire a **E** (modère les Dégâts via BE) et **B** (encaisse). **Localisation** : **inversez le
jet d'attaque OU lancez 1d100**, puis table par **gréement** (avirons / voile / mixte). Un coup à l'**Équipage**
touche un marin EXPOSÉ (Critique de personnage normal) ; aucun marin exposé → touche la **Coque**. Les **petites
armes** (non-artillerie) n'infligent normalement pas assez pour endommager la coque, mais peuvent toucher un marin
exposé. Le **corps-à-corps** contre la coque touche auto (Localisation au choix) mais dégrade très lentement
(tableau Taille `MDG 13 l.616-637`).

**Table de Localisation** (`MDG 13 l.573-582`, par d100) :

| d100 | Avirons | Voile | Mixte |
|---|---|---|---|
| 01-09 | Équipage | Équipage | Équipage |
| 10-20 | Avirons | Gréement | Gréement |
| 21-40 | Coque | Coque | Avirons |
| 41-65 | Coque | Coque | Coque |
| 66-84 | Équipements | Équipements | Équipements |
| 85-00 | Cargaison | Cargaison | Cargaison |

**Sources RAW.** `MDG 13 l.567-584` (Dégâts/localisation) · `l.605` (petites armes) · `l.610-637` (corps-à-corps).
**Citation** `l.571` : « inversez le résultat obtenu sur le jet d'attaque… **ou lancez 1d100.** »

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.567-584, l.616-637) → `meleeVsHullBE`, `PortView`, `resolveVolley`, `RepairTick`, `haute-mer-degagee`, `applyHit`, `GameState` — `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-navigation.json`, `src/engine/combat.ts`, `src/engine/seaPerils.ts`, `src/engine/shipBuild.ts`, `src/engine/shipMelee.ts`, +3 fichiers

**État du code.** ✅ localisation 1d100 par gréement (bordée), BE déduit, plancher 0 (vs plancher 1 perso).
⬜ petites armes vs artillerie (seuil de Dégâts), corps-à-corps contre coque, table Taille.

---

## Critiques de navire (Éclats, Voie d'eau, En flammes)

**Synthèse.** **Un jet d'attaque réussi contre un navire qui donne un DOUBLE → Critique** ; de plus **tout coup
quand B est tombé à 0 = Critique**. On détermine la Localisation, on tire sur la table de Critiques de cette
Localisation. Effets spéciaux : **Éclats (Indice)** → un nombre de marins = Indice subissent **9 Dégâts** ; **Voie
d'eau (Indice)** → total cumulé +Indice/Round ; à E/2 → −1 M et −1 DR Navigation ; à = E → **coule** ; **En flammes
(Indice)** → 1 Blessure/Round/État, propagation via le tableau **Intensité du feu** (d10).

**Sources RAW.** `MDG 13 l.654-674` (Critiques, Éclats, Voie d'eau) · `l.586-601` (En flammes + Intensité du feu).
**Citation** `l.656` : « Quand un jet d'attaque réussi contre un bateau **donne un double, il subit un Critique.
De plus, tous les coups qui touchent une fois que le score de Blessures… est tombé à 0 sont des Critiques.** »

> **Interprétation bordée (à valider avec le GM)** : la bordée n'a PAS de jet de touche par pièce (le DR partagé le
> remplace). Le 1d100 de localisation (l.571 « ou lancez 1d100 ») **substitue** le jet de touche → un **double sur
> ce 1d100 = Critique** (cohérent : un double au jet d'attaque reste un double une fois inversé). C'est une
> INTERPRÉTATION, pas une ligne RAW littérale — le GM peut préférer « pas de Critique en bordée hors B=0 ».

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.654-674) → `beginShipwreck`, `RepairTick`, `haute-mer-degagee`, `isOutOfAction`, `OPTIONAL_RULES`, `finalizeFastVoyage`, `runSeaDay`, `checkBattleOver` — `src/data/sea-navigation.json`, `src/engine/conditions.ts`, `src/engine/policy.ts`, `src/engine/shipBuild.ts`, `src/engine/volley.ts`, `src/state/combatFlow.ts`, +2 fichiers

**État du code.** ✅ `applyHullCritical` (localisation, Équipage, Éclats, Voie d'eau, En flammes en GameOp, Critiques
de Coque récursifs). ✅ (R1) **« tout coup à B=0 = Critique »** : `resolveVolley` critique sur `wounds.current ≤ 0`.
⚠️ bordée : double sur 1d100 → Critique (interprétation défendable, à valider GM).

---

## Collision / éperonnage

**Synthèse.** Quand un navire en percute un autre, **chacun reçoit IC de l'autre + le M du navire qui cause la
collision**. Modificateurs (s'éloigne / milieu de coque ×2 / manœuvre pour limiter ou aggraver via Test de
Manœuvre / frontale = IC adverse + M total des deux). Sauf précision, **les coups de collision touchent la Coque**.

**Sources RAW** : `MDG 13 l.446-464`.

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 13` (l.446-464) → `collisionIndex`, `iceberg`, `debris-marins`, `resolveCollision`, `rocher`, `bas-fonds`, `perilManagement` ⚠sans-appelant, `faible`, `strandingPenalty`, `moyen`, +6 — `src/data/schemas/defs/sea-perils.ts`, `src/data/sea-perils.json`, `src/engine/collision.ts`, `src/engine/seaPerils.ts`, `src/state/seaVoyageFlow.ts`, `src/state/shipCollision.ts`

**État du code.** ✅ `resolveCollision` (frontal/milieu/poupe/s'éloigne/manœuvre), localisation Coque.

---

## Moral du navire

**Synthèse.** Le **Moral** d'un navire débute à **75** (nouvel équipage/capitaine). Il pèse en **bande de ±DR** sur
les Tests d'équipage. Inutile à suivre si la majorité de l'équipage est des PJ ou très investie. Les DR négatifs
d'une **Rude épreuve** réduisent le Moral d'autant.

**Sources RAW** : `MDG 14 l.110` (Rude épreuve → Moral) · `l.133-141` (Moral 75).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `MDG 14` (l.110) → `manoeuvre`, `perception`, `orientation`, `affaler`, `extermination-nuisibles`, `rude-epreuve`, `entretien`, `batterie`, `rudeEpreuveMoraleDelta`, `ActionBar`, +2 — `src/data/crew-test-types.json`, `src/data/localisation.json`, `src/engine/crewMorale.ts`, `src/state/seaActivities.ts`, `src/state/seaVoyageFlow.ts`, `src/ui/ActionBar.tsx`

**État du code.** ✅ Moral 75 par défaut, bande de DR au Test d'équipage, pont campagne→combat. ⬜ évolution du
Moral en combat (Rude épreuve, mutinerie).

---

## Bilan de fidélité — après la REFONTE 2026-06-25 (R1 `3e4d9304` · R2 `09b4b77b` · R3 `84597005`)

L'audit adversarial 2026-06-25 (agent indépendant, code ↔ Source) avait confirmé 5 trous + 1 plomberie morte, **tous
issus d'UN choix structurel** : `resolveVolley` ré-implémentait son propre calcul de Dégâts EN PARALLÈLE du tir
individuel, larguant munitions/sous-effectif/qualités. **Refonte** (plan `velvety-puzzling-kettle`) : la volée orchestre
désormais les MÊMES fonctions AGNOSTIQUES que le tir individuel (`weaponWithAmmo` + `crewedFireWeapon` + `woundsFromHit`
à plancher 0), en gardant la localisation/Critique navire. État après refonte :
1. ✅ **Équipage-ressource** (R3) — `battle.crewActed` recense les marins engagés CE ROUND (reset au round-start) ; un
   marin qui fait manœuvre PUIS bordée le même Round cumule à **+2 crans** (`rollCrewRole(cumul)` → `easeDifficulty(-2)`).
   Décision GM : cumul AUTORISÉ (l.53), pas d'exclusion.
2. ✅ **Arme d'équipe / sous-effectif** (R1) — `resolveVolley` appelle `crewedFireWeapon(item, servantsPrésents)` par
   pièce → Recharge ×2 / Imprécise / Dangereuse en bordée comme en solo (fin de l'incohérence interne).
3. ✅ **Recharge** (R2) — `ShipPoste.reloadUntilRound` ; une pièce tirée est muette N Rounds (×2 si sous-effectif) ;
   `bearingPostes` exclut les pièces en recharge (bouton/réticule). NB : modèle « N Rounds » = approximation du Test
   étendu à DR cumulés (refinement noté).
4. ⚠️ **Munitions** (R1 partiel) — `weaponWithAmmo` fusionne la munition du chef (Dégâts + **Perforante**/bypass via
   `woundsFromHit`). ✅ **Explosion / Tir de zone** (multi-cibles, `resolveWeaponArea`). ⬜ RESTE : **Dangereuse → Incident**.
5. ✅ **« Tout coup à B=0 = Critique »** (R1, `MDG 13 l.656`) — `resolveVolley` critique sur double OU `wounds.current ≤ 0`.
6. ⚠️ **Manque de bras** (R3 partiel) — cumul +2 crans FAIT (réveille `doubleRole`/`easeDifficulty`). ⬜ RESTE : −2 DR
   plafond Succès Minime + tranche 10 % (sous-effectif d'ÉQUIPAGE global, distinct du sous-effectif d'une pièce).
7. ✅ **BB dynamique** confirmé conforme par l'audit (`collision.ts:15` relit `wounds.current`). ⚠️ Critique de bordée
   (double sur 1d100) = interprétation **défendable**, à valider GM. Arc 3 octants = **décision GM** (le RAW ne donne pas d'angle).

> Cette fiche est le **brouillon de référence** ; à confronter à la Source par une passe de vérification (les n° de
> ligne sont post-Marker, le chapitre est sûr, la ligne approximative). Inscrire `MDG` dans `sources.md` + ajouter
> la ligne « Combat naval » au tableau des domaines de `00-index.md`.
