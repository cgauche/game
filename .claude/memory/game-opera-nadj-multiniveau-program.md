---
name: game-opera-nadj-multiniveau-program
description: "Programme « Une nuit à l'Opéra » (NADJ) — moteur iso multi-niveaux réutilisable (Approche B) livré + tranche verticale complète (traversée/chute/saut/intrigues/lumières) ; reste : foule simulée (Lot 4) + z Combatant."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5712d0f5-1e23-43ac-9ebc-d5b78277f3e8
  modified: 2026-07-26T16:32:37.164Z
---

Chantier : implémenter le scénario **« Une nuit à l'Opéra »** (`Source/Warhammer v4 - Nuits agitees & dures journées/08 - Une nuit à l'Opéra.md`). Découpé en 9 lots (V/0/1/3/2/L/4/S/C), dont l'état vit au § ÉTAT et § RESTE ci-dessous.

**Décisions utilisateur (ambition maximale, ne pas re-litiger)** : verticalité = **vrai moteur multi-niveaux marchable, réutilisable** (tours/mines/cités à étages), PAS un hack opéra ; foule = simulation complète (figurants qui fuient, piétinements) ; scénario entier en données, tout paramétrable dans l'éditeur.

**Moteur multi-niveaux (Lot V) LIVRÉ** : `Scene.tiles → levels: Level[]` (z=0=sol) ; `tileAt`/`isWalkable(scene,x,y,z)` z-aware ; projection `iso.ts` (`tileCenter`/`depth`/`screenToTileAtZ`/`LEVEL_H`) ; `path.ts` uniformément 3D ; `partyPos` porte z, `moveParty` z-aware ; entités `SceneEntity.z` ; éditeur : sélecteur d'étage + `validateScene` avertit étage/case incohérents. **Multi-niveaux entièrement éditable.**

**La traversée verticale se DÉRIVE du relief** (re-mesuré 2026-07-26) : `gradeBetween` (`src/state/relief.ts`) classe `flat`/`ramp`/`cliff` par |Δcote|, `STEP_MAX_M = 1.0` m est le pas franchissable à pied, un étage vaut `WALL_H_M` = `METRES_PER_LEVEL` = **4 m**. `src/ui/editor/editor-layers.test.ts:11` fait foi : « Aucune donnée `stairs` : la connexion EST le relief. » Un escalier = **une file de cases cotées par crans ≤ 1 m**, soit 4 cases pour un étage. Le compilateur ASCII porte un sucre `cells.stair` (`mapSpec.ts`, #780) qui interpole cette rampe ; l'éditeur expose le pinceau de cote `{ mode: 'height', metres }`.

**Sauts** : `pathTo(...,jump)` franchit un gouffre en ligne droite (atterrissage ≤ `jump` cases). Échelle tranchée = **2 m/case**. `engine/movement.ts` : `freeJumpTiles(M)=floor(M/6)` (humain M4→0 case libre), `maxJumpTiles=libre+1` (Test étend d'1 case) → tout gouffre d'1 case exige un Test pour un humain, l'échec=`fall` est le cas normal. `state/jumpMove.ts::planJump` réutilise l'Effet `test` existant + `fall` (zéro modale dédiée).

**Effet `fall`** (LDB 15 l.117-122) : 3 Dégâts/m + 1d10, réduits par BE (pas par PA) ; Blessures>BE → À Terre.

**GOTCHAS DE RENDU/PICKING (leçons dures, chaque manque = feature générale, pas un hack opéra)** :
- **Le multi-niveaux co-visible est ILLISIBLE sans traitement d'étage** — un rendu naïf « tous les étages ensemble » fait fusionner sol/étage/fosse dans le cerveau du joueur. Solution FINALE retenue : `renderLevels = z <= activeZ` (jamais les étages AU-DESSUS de l'étage actif) — asymétrique et voulu (d'en bas les loges en surplomb ne doivent pas cacher la navigation ; d'en haut voir le dessous a du sens). Bornée aux scènes multi-niveaux. (Étapes intermédiaires abandonnées : « un étage à la fois »+fantôme opacité, puis co-visible symétrique — les deux écartés après retour utilisateur en jeu.)
- **Le PICKING doit suivre la même règle que le rendu** : cliquer une case vue-mais-estompée-au-dessus ne doit PAS viser l'étage supérieur (sinon clic sur le foyer visait la galerie au-dessus → tentative de traverser le vide → saut déclenché par erreur, lu comme « mon perso fait des bonds »). Le clic vise l'étage ACTIF, ne descend qu'à travers un vide, jamais au-dessus.
- **Un escalier est STRUCTUREL, pas un prop décoratif** — il EST la rampe de cotes, rendue en vraies parois de relief (`part === 'ramp'`, `src/gameIso/backends/affineFloors.ts:75`). Les props `escalier-bois`/`escalier-loge` du catalogue de décor sont des billboards 1×1 sans aucune mécanique : les retirer d'une carte ne casse pas la traversée. Arbitrage utilisateur 2026-07-26, verbatim : « J'ai supprimé les decors dont ces horribles objets "escaliers" qui ne sont pas du tout adapté dans un monde ou les objets s'affichent comme des pancarts ».
- **Le décor directionnel doit pivoter avec la caméra** : `RenderCtx.dir?: Dir8` (orientation MONDE) + `project(ctx.dir, dims.rot)` (même helper que les rigs) — sinon un prop billboard reste figé de face quelle que soit la rotation.
- **Meubler fidèlement au PLAN officiel, pas par fonction générique** — poser un meuble générique par pièce (table/chaise partout) ne respecte pas le plan ; un agent dédié a lu `art-ref/opera/plan_p40.png` pièce par pièce.
- **Vérifier EN JEU (Playwright), jamais en QC raster isolé** — un raster PNG mono-niveau ne prouve ni le chargement ni l'occlusion multi-niveaux réelle ; plusieurs défauts (picking, lisibilité) n'apparaissaient qu'en jouant réellement la scène avec l'utilisateur.
- **Carte authorée en ASCII** (`src/state/asciiMap.ts::parseAsciiRows`, comme l'arène) — 1 grille par étage, reconstruite depuis le TEXTE du plan officiel (l.28-41) quand l'image n'est pas dans le `.md` converti.

**Systèmes composés (zéro code nouveau, tout compose des primitives existantes)** : minuterie (`delayedEffect` afterMinutes/atHour+atMinute, cancelFlag) ; `inflictDamage`/`applyCondition` (bombe = mèche→souffle+État, désamorçable, 100% données) ; `easierIf {hasSkill?,hasTalent?,steps?}` sur l'Effet `test` (detection bombe) ; `setLight` (Lot L, voile plein-viewport, éclairage dynamique) ; 3 intrigues canoniques câblées en données (bombe loge royale, pétards 20h30, Glimbrin spot-check Perception Difficile) ; combat optionnel (étudiants) ; récompenses PX + réactivité dialogue Comtesse (flags).

**ÉTAT** : tranche verticale COMPLÈTE (multi-niveaux+traversée+chute+saut+théâtre+3 intrigues+PX+lumières+dialogues réactifs+éditeur complet, tout testé). Carte fidèle au plan officiel livrée (parterre en éventail, scène surélevée+fosse, foyer courbe, puits central cerné de loges).

**RESTE** : **z Combatant** (combat multi-niveaux) ; **Lot 4 foule simulée** (public assis/réactif→panique→fuite vers les sorties, compose path-3D+agendas+zones — dernière grosse feature réelle) ; intrigues Lowenhertz/Edwina ; rideau animé ; recettes navigateur en attente (traversée loges, saut→Test→chute).

**Cadre honnête (dit à l'utilisateur)** : même tout livré, l'Opéra reste une version curée/ramifiée du sandbox MJ (intrigues = événements à branches pré-écrites, social = dialogues finis, « performance » stagée) — le lieu/verticalité/chutes/foule/intrigues, eux, pleinement modélisés.

Voir [[game-murs-aretes-systeme]] (système de murs consommé ici).
