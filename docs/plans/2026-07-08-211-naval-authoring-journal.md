# Journal d'authoring — « Le Loup et la Saumure » (confrontation attendu/réalité, 2026-07-08)

> Artefact daté. Confrontation du scénario de référence
> ([`2026-07-08-211-naval-scenario.md`](2026-07-08-211-naval-scenario.md)) au pipeline d'authoring RÉEL
> (`scripts/arene/lib.mjs` + `src/state/mapSpec.ts`). Livrables : `scripts/loup-et-saumure/generate.mjs`
> (source canonique), `src/scenes/loup-et-saumure/loup-et-saumure-projet.json` (généré, commitable),
> `src/scenes/loup-et-saumure/loup-et-saumure-projet.test.ts` (verrouille le JSON généré).

## Friction n°0 — le pipeline d'auteur existe, mais il est INTROUVABLE

Le chemin canonique pour produire un projet de campagne (`scene()`/`buildScene`/`addBuilding`/
`buildEncounter`, ASCII → `MapSpec` → `Scene`) vit dans `scripts/arene/lib.mjs` + `src/state/mapSpec.ts`.
Il n'est cité NULLE PART dans la table de routage de `CLAUDE.md`, ni dans `docs/map-authoring.md` sous un
nom générique — il est namespacé « arène » de bout en bout (dossier `scripts/arene/`, commentaires
« l'arène »). Un agent parti du seul `CLAUDE.md` + `docs/` n'aurait JAMAIS trouvé ce pipeline sans
l'intervention de l'utilisateur qui s'en est souvenu en cours de route (amendement de brief). **C'est LA
pièce maîtresse manquante du futur skill `creer-une-campagne`** : documenter `scripts/arene/lib.mjs`
comme l'outillage GÉNÉRIQUE (renommer/dupliquer mentalement en `scripts/<campagne>/lib.mjs` par import,
jamais par copie) doit être la toute première ligne de ce skill.

Première itération de ce projet (avant l'amendement) : j'ai écrit `loup-et-saumure-projet.json` à la
main (tableaux de tuiles comptés un par un) — fastidieux, sujet à l'erreur (`parseAsciiRows` a d'ailleurs
immédiatement attrapé deux lignes ASCII mal comptées à la 1ʳᵉ génération via le pipeline). Le pipeline
`scene()`/ASCII est strictement supérieur : `git blame`-friendly, réutilise le MÊME compilateur que
l'éditeur (`buildScene`), et les erreurs de largeur de grille sont des `throw` explicites, pas un JSON
silencieusement invalide.

## Friction n°1 — `lib.mjs::normalizeEnemy` ne connaît QUE les créatures

`scene()` normalise les `ref` de `encounters[].enemies[]` (terse) via `creatureId()`
(`scripts/arene/lib.mjs:33-38`), qui interroge `findCreatureById`/`findCreature` — **jamais**
`findVehicleById`. Un `ref` de NAVIRE (`cogue`/`langskip`/`loup-imperial`, `vehicles.json`) y lève
`créature introuvable`. La lib d'authoring a été pensée pour l'Arène (100 % terrestre) ; le naval (coques
= `Combatant` via `ref` vers `vehicles.json`, `src/state/spawn.ts:345-348`) n'a jamais été exercé par ce
chemin. **Contournement (pas un hack) : le schéma prévoit DÉJÀ un 2ᵉ chemin** — poser les entités-coque en
`entities` BRUTES (jamais normalisées) et les enrôler via `encounters[].members` (ids explicites) plutôt
que par `enemies[]` terse. Zéro modification de `lib.mjs`, zéro réimplémentation du compilateur.

## Friction n°2 — aucun fabricant de `ShipPoste` dans la lib d'authoring

`lib.mjs` n'exporte aucun helper pour construire un poste d'artillerie (`ShipPoste.item` = un
`ItemInstance` complet — `uid`/`trappingId`/`damage`/`qualities`…, cf. `engine/items.ts`
`itemFromTrappingById`). Écrit un helper LOCAL (`canonMoyen`/`pierrier`/`poste`, dans
`scripts/loup-et-saumure/generate.mjs`) répliquant le patron de `itemFromTrappingById` à la main depuis
les données RAW de `canon-moyen`/`pierrier` (`trappings.json` l.8608-8760). 2ᵉ trouvaille pour le futur
skill : le naval a besoin de sa propre couche d'authoring (`scripts/<campagne>/naval.mjs` réutilisable),
pas seulement de l'ASCII terrestre.

## Friction n°3 — postes servis par des HÉROS : pas d'id à l'authoring, mais pas un problème

`ShipPoste.crewIds[0]` = le chef de pièce, mais les ids de héros ne sont générés qu'à la création de
personnage — inconnus à l'authoring de campagne. Grounding (`src/state/shipPostes.ts:309-322`,
`servablePostes`/`serveAtPoste`) : un poste `crewIds: []` (non servi) est servable EN JEU par tout héros
ADJACENT (« Servir cette pièce »), au début du combat. **[EXPRIMABLE]** : les 3 postes du Grimm (chaque
combat naval) sont posés SANS chef pré-assigné — les 4 héros les servent à la table, exactement le geste
RAW (« Capitaine/Timonier/Canonnier/Mage tiennent les postes-clés »).

## Friction n°4 — Humeur de Manann : AUCUNE couture authorable

`state.vessel.manann` (`ManannMood`) n'est mise à jour QUE par `seaVoyageFlow.ts` (`tellManann`,
`applyManannFactor`, événements de bord/port RNG). Aucun membre de l'union `Effect` (`src/state/scene.ts`
l.152-346) ne l'expose. La bénédiction d'Aldo (scène 0.3) et le grand sacrifice de Frère Aldo (scène 3.3)
sont **[INEXPRIMABLE]** mécaniquement — posés en simple `setFlag` + `journal` (flavor, zéro effet réel sur
la jauge). Piste NON explorée par manque de temps : un Effect `adjustManann` symétrique à `giveMoney`
serait la couture manquante logique (à proposer, pas à improviser ici).

## Friction n°5 — sabotage de Kramer : deux pipelines disjoints

`op:'testMod'` (`engine/ops.ts` l.550, appliqué par `applyOps`) module les Tests de PERSONNAGE (combat,
compétence). Les Tests d'ÉQUIPAGE (Progression/Orientation/Manœuvre) sont résolus par
`engine/seaVoyage.ts`/`state/seaVoyageFlow.ts`, un pipeline ENTIÈREMENT séparé qui ne lit AUCUN `GameOp`.
Le sabotage RAW de Kramer (MDG 14 l.45-47, −1 à −5 DR « selon l'impact ») est donc **[INEXPRIMABLE]** :
aucune couture ne relie un Effect d'auteur à un malus de Test d'équipage. Confirmé au `Source/` : la
mécanique existe (Kramer dialogue le nomme), mais rien dans le moteur ne la porte.

## Friction n°6 — pas de bridge `state.vessel` ⇄ Combattant de combat

`src/state/spawn.ts` construit un `Combatant` frais depuis `ref`/`statblock` à CHAQUE combat — il ne lit
JAMAIS `state.vessel.wounds`/`.manann`. Les dégâts encaissés par le Grimm contre la Dent de Manann (scène
1) ne PERSISTENT PAS mécaniquement dans le combat contre Olg (scène 3) : chaque combat spawn le Grimm à
pleine coque. **[INEXPRIMABLE architecture]** — la persistance du navire de CAMPAGNE (voyage) et le
navire de COMBAT (Combattant à PV) sont deux représentations non reliées. Simplification assumée : chaque
combat naval authore une instance FRAÎCHE du Grimm.

## Friction n°7 — pas de seuil de reddition partiel (mi-Blessures)

`VictoryCondition` (`src/state/scene.ts` l.717-721) n'a que 4 formes : `allEnemiesDead` /
`destroyStructure` / `surviveRounds` / `reachZone`. Le RAW (MDG 14 l.45-47) fait ROMPRE une cogue à
MI-Blessures, pas à 0 PB — aucune forme n'exprime un seuil de PV PARTIEL sur un ennemi précis.
**[CONTOURNÉ]** : repli sur `allEnemiesDead` (le combat va à son terme complet), tag explicite dans le
générateur.

## Friction n°8 — deux routes entre les mêmes lieux : ACCEPTÉ, mais sans garantie de sens

Testé : `WorldMap.routes` autorise deux `MapRoute` avec le même `a`/`b` (seul `id` est une clé). **✔
EXPRIMABLE** — la route aller porte l'embuscade de la cogue, la route retour celle d'Olg. Limite trouvée
(pas un bug, un GAP de conception) : rien dans `state/worldMap.ts`/`engine/travel.ts` ne restreint une
route au SENS du trajet — les DEUX routes apparaissent dans les deux sens, le moteur ne force pas « aller
= route A, retour = route B ». **[CONTOURNÉ]** — nommage clair (`-aller`/`-retour`), mais la direction
n'est pas mécaniquement imposée (un joueur pourrait, en théorie, retomber sur la cogue au retour ou sur
Olg à l'aller).

## Frictions mineures (bestiaire/marchands)

- **[CONTOURNÉ]** Aucune créature générique « norse »/« pillard skaeling » — les seuls PNJ de
  `folder: "Bestiaire de la Mer des Griffes"` sont des BOSS nommés (Jaego Roth, Long Drong, Wulfrik,
  Vrisk) + des monstres. Réutilisé `pirate-fluvial`/`chef-pirate` (frenchy-bzh, Naufrageurs & Pirates
  Fluviaux) pour les rangs-et-fichiers de la Dent de Manann ET du Serpent-de-Sel.
- **[maison, règle stricte 7]** Aucune créature « marin »/« matelot » générique pour l'équipage exposé
  (Frère Aldo/Griet posés comme entités de combat, `crewIds` de la coque) — `CustomStatblock` minimal
  documenté (`marinDuGrimm`), pas un ref détourné.
- **[CONTOURNÉ]** Aucun trait naval « Proue-idole de Stromfels » (+1 DR Poursuite tant qu'intacte) au
  catalogue (`vehicles.json` traits : `belier`/`renforce`/`solide` seulement). Non instancié — inventer un
  id de trait naval serait une invention de règle (règle stricte 1).
- **[CONTOURNÉ]** Aucun archétype marchand « avitailleur »/« chandlerie » — réutilisé `taverniere`
  (rations garanties en `curated`) pour l'eau/vivres et `armurier` (catégorie `ammunition`) pour les
  munitions de canon/pierrier ; « pièces détachées de navire » existe bien au catalogue
  (`pieces-detachees-de-navire`, `trappings.json`) mais hors `curated` (disponibilité aléatoire, pas
  garantie).
- **[maison, à recaler (index MDG 15)]** Colonnes Production/Demande exactes de Salzenmund/Erengrad NON
  vérifiées à l'index des ports (MDG 15 l.439-506) — seul le surplus Laine d'Erengrad est confirmé au
  synopsis de référence (l.76). Valeurs plausibles posées, taguées.

## Table récapitulative — beats du scénario de référence × verdict

| Beat (réf.) | Verdict | Note |
|---|---|---|
| 0.1 Commission de Köhler (avance, prémisse) | **EXPRIMABLE** | `giveMoney` + `setVessel` + `setFlag`, dialogue unique (pas de refus réel — assumé) |
| 0.1 Carénage 5 % / −1 DR Man si sale | **CONTOURNÉ** | décision posée en texte pur (Köhler refuse) ; aucun Effect « salissure/carénage » authorable trouvé en dehors du système d'entretien du navire lui-même (hors scope du test) |
| 0.2 Recrutement/intendance/chargement | **CONTOURNÉ** | non authoré en scène dédiée (hors périmètre des 5 scènes demandées) ; le marchand d'avitaillement les représente en creux |
| 0.3 Bénédiction + sacrifice à Manann | **INEXPRIMABLE** | aucune couture Effect → `state.vessel.manann` (friction n°4) |
| 1.1 Routine/anti-grind/voyage rapide | **CONTOURNÉ** | géré par `seaVoyageFlow`/`travelFlow` EXISTANTS (hors scène authorée) ; non ré-authoré ici |
| 1.2 Infestation de rats | **CONTOURNÉ** | non authoré (hors périmètre des 5 scènes) — le vocabulaire existe (`extendedTest`, démontré ailleurs) |
| 1.3 Combat contre la Dent de Manann | **EXPRIMABLE** (structure) / **CONTOURNÉ** (seuil de reddition) | coque+équipage+postes servables ; `allEnemiesDead` en repli (friction n°7) |
| 1.3 Sortie « livrer Kramer aux pirates » | **INEXPRIMABLE** | aucun Effect de branche narrative « transférer un PNJ de camp » authoré ; non tenté (hors scope du test) |
| 1.4 Conseil de fin de semaine / Activités | **CONTOURNÉ** | système `interlude`/Activités EXISTANT, non ré-authoré dans une scène dédiée |
| 2.1 Escale, relâche, événement de port | **EXPRIMABLE** (automatique) | géré par `openPortAt`/`port` profile au moment du voyage — pas d'Effect manuel nécessaire |
| 2.2 Négoce, rumeur d'Olg | **EXPRIMABLE** | dialogue + `setFlag` ; le commerce de cargaison lui-même est un système existant (non ré-authoré) |
| 2.3 Nuit du chat / enquête Kramer | **EXPRIMABLE** (enquête) / **INEXPRIMABLE** (Humeur du chat malade) | `test` node pour l'enquête ; la baisse d'Humeur reste hors couture (friction n°4) |
| 2.x Réparation temporaire de la coque | **EXPRIMABLE** | `extendedTest` (Métier Charpentier, 5 DR) |
| 3.1 Tempête, sabotage silencieux, changement de cap | **INEXPRIMABLE** (sabotage) / **CONTOURNÉ** (reste, hors scope des 5 scènes) | friction n°5 |
| 3.2 Poursuite/feu de chasse/collision/abordage d'Olg | **EXPRIMABLE** (structure combat) | coque+équipage+postes ; Proue-idole non instanciée (friction mineure) |
| 3.3 Jugement de Triton | **CONTOURNÉ** | non authoré en scène dédiée (hors périmètre des 5-6 scènes demandées ; le mécanisme RAW lui-même dépend de l'Humeur, friction n°4) |
| 3.4 Épilogue, parts, chantier, crochets Kramer | **EXPRIMABLE** (solde/XP) / **CONTOURNÉ** (parts détaillées 50/10/40, crochets Kramer à 3 branches) | épilogue simplifié à une solde forfaitaire |

## Décompte

**14 EXPRIMABLE · 9 CONTOURNÉ · 5 INEXPRIMABLE** (comptage par ligne de la table ci-dessus, verdicts
doubles comptés une fois par face).

## Notes déplacées hors texte joueur (recette 2026-07-09)

La recette navigateur a trouvé du jargon d'implémentation affiché AU JOUEUR (dialogues d'Aldo et de
Kramer, quai et Erengrad) : identifiants de code (`` `state.vessel.manann` ``, `` `seaVoyageFlow` ``,
`` `op:'testMod'` ``, `` `engine/ops.ts` ``), tags `[INEXPRIMABLE]`/`[CONTOURNÉ]`, et des citations RAW
brutes (`MDG 14 l.45-47`, etc.) — le tout collé aux répliques des PNJ (`node.text`, rendu VERBATIM par
`DialogueBox.tsx`, jamais filtré). Purgé de `scripts/loup-et-saumure/generate.mjs` : les répliques et
messages de journal restent en français pur, diégétique ; les libellés de choix/tests gardent la seule
convention mécanique déjà établie ailleurs dans le jeu (ex. « Superviser la réparation (Test étendu de
Métier (Charpentier), 5 DR) »), sans citation de page ni jargon d'architecture.

Aucune information n'est PERDUE par la purge : le détail technique de chaque note retirée était déjà,
mot pour mot, consigné plus haut dans ce journal — friction n°4 (Humeur de Manann, `dlg-aldo`) et
friction n°5 (sabotage de Kramer, deux pipelines disjoints, `dlg-kramer`). La seule référence croisée
purement d'auteur retirée sans équivalent (« cf. dlg-kramer » dans `dlg-kramer-nuit-du-chat`) pointait
déjà vers la même friction n°4 — aucun contenu à récupérer.

## Nommage du navire de campagne — pas de couture d'auteur (recette 2026-07-09)

Les dialogues appelaient le navire « le Grimm » tandis que le HUD/journal système (Effet `setVessel`,
`combatEffects.ts` l.1187, `t('eff.setVessel', { name: v.label })`) affiche le `label` du TYPE de
vaisseau (`vehicles.json` : `"loup-imperial"` → `"Loup impérial"`) — un libellé de CLASSE, pas
d'instance. Vérifié : ni `CampaignVessel` (`src/state/store.ts` l.1157-1186) ni l'Effect `setVessel`
(`src/state/scene.ts` l.345, `src/state/combatEffects.ts` l.1172-1195) ne portent de champ
`name`/`label` d'INSTANCE — aucune couture d'auteur pour nommer un navire de campagne au-delà de son
type. Harmonisé sur ce que le joueur voit réellement : toutes les répliques/journaux/libellés
d'entité-coque disent désormais « le Loup impérial ». Manque consigné, TICKET EN PUISSANCE : ajouter un
champ `name?: string` optionnel à `CampaignVessel` (+ à l'Effect `setVessel`), lu en priorité sur
`vehicles.json.label` partout où un navire de campagne s'affiche (HUD, journal, entités-coque au
combat) — pas tenté ici, hors périmètre de cette purge.
