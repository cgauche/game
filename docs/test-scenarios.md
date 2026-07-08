# Scénarios de test

Le menu **« Scénarios de test »** (`<Icon id="nav/test-scenarios">`, écran `'test'`) liste des
scénarios de vérification : chacun
fixe un **groupe** et une **scène adaptée** à ce qu'on veut tester, avec combat direct (`autoCombat`)
quand c'est utile.

## Vérifier une feature au navigateur

1. Lance `npm run dev`, ouvre le menu → **Scénarios de test**.
2. **Passe par le scénario adapté.** S'il n'en existe pas pour ce que tu vérifies, **crée-en un**.

## Ajouter un scénario = un fichier

Dépose un fichier `src/scenes/test-scenarios/<NN>-<slug>.ts` exportant `scenario` :

```ts
import { arena } from './_shared';
import type { TestScenario } from './_shared';
// (+ createHero / makePregens / itemFromTrappingById selon le groupe voulu)

const scene = arena({ id: 'test-xxx', nom: '…', heroStart: { x: 2, y: 4 } });
scene.encounters = [{ id: 'enc-xxx', enemies: [{ ref: 'Gobelin', pos: { x: 9, y: 4 } }] }];

export const scenario: TestScenario = {
  id: 'xxx', order: 7, category: 'combat', icon: 'scenario/ambush', title: '…',
  tests: 'ce que ça vérifie', partyNote: 'le groupe',
  makeParty: () => [/* … */], scene, autoCombat: 'enc-xxx',
};
```

`category` est une clé SANS emoji (`'combat' | 'magie' | 'creatures' | 'survie' | 'marche' |
'scenarios' | 'naval' | 'rendu'`, `SCENARIO_SECTIONS` dans `_shared.ts`) — le libellé/icône de
section sont portés par la donnée, pas par le scénario. `icon` est un `IconId` du registre SVG
(`src/ui/icons`, famille `scenario/*`), jamais un emoji.

`index.ts` le ramasse via le **registre généré** (`scripts/gen-registry.mjs` → `_registry.generated.ts`,
auto en dev ; après ajout/suppression d'un fichier, lance `npm run gen`). Les scénarios sont triés par
`order`, puis **groupés par `category`** en sections dans le menu (`TestScenariosScreen`). Les `*.test.ts`
et les fichiers `_*` sont exclus.

## Conventions

- **Équipement à la main** : `createHero(...)` puis réassigner `items` (`itemFromTrappingById` +
  `recomputeLoadout`). Ex. arbalétrier = Arbalète + Carreaux équipés (`recomputeLoadout` dérive
  `reload`/`subType`).
- **Ennemis** : vraies créatures du bestiaire via `ref` (`creatures.json`, LDB/ADE) ; fixture
  (`statblock` inline) seulement quand aucun équivalent canon n'existe (ex. le **mannequin** passif
  `M 0`, beaucoup de Blessures).
- Le moteur reste couvert par Vitest ; les scénarios sont des fixtures de vérif manuelle/visuelle.

## Catalogue actuel (par section)

Chaque scénario est volontairement DENSE : il exerce une famille de systèmes liés plutôt qu'une seule
mécanique (un terrain bien agencé, des mannequins bien placés).

| Section | Scénario | Vérifie |
|---|---|---|
| ⚔️ Combat | 🎯 Terrain d'entraînement | sandbox : tir/rechargement, **Tir rapide** (interruption à distance à la pause de début de Round : badge de la frise → cible), ciblage & LdV (muret), brouillard/vision (lanterne/vision nocturne/Lumière), Engagé/charge/désengagement & deux armes, forme d'arme, combat monté, Explosion en zone |
| ⚔️ Combat | 🩸 L'Embuscade | combat complet exploration → dialogue → 5 mutants ; y surviennent Critiques & mort (héros fragile), sauvetage par le Destin/Résilience, Action Soigner |
| ⚔️ Combat | 🏰 Bélier — porte | engin de siège CREWÉ (ADE II 08) : le bélier est un POSTE servi par une Équipe de 6 (le Soldat chef de pièce, 5 servants PNJ) — Équipe incomplète −20, affût inutilisable sous la moitié ; POUSSER l'engin en formation (plafond maison 2 cases/poussée) jusqu'à une porte brèchable puis l'assener : jet sur la Force du chef (jamais la CC), seule la porte encaisse (Atout Bélier) |
| ⚔️ Combat | 🏰 Siège — défendre la muraille | siège à grande échelle (30×46, 2 couches) : champ d'approche profond (~76 m) + camp & BATTERIE assaillante (canon direct + catapulte indirecte) qui BRÈCHE la porte de loin (IA cible la structure, Atout Siège) ; rivière + pont canalisant l'assaut ; enceinte à porte brèchable ; chemin de ronde (couche 1 à 4 m) rejoint par une rampe au flanc gauche, parapet z1 ; pièces servies + archers PNJ alliés-IA ; combat VERTICAL (LdV plongeante, mêlée refusée à travers le vide) |
| ✨ Magie | ✨ Magie en combat | concile (toutes familles) + duel de lanceurs (casters 2 camps, Contre-sort/dissipation) + Jalon 2 (Péché/Colère, Corruption, ZdE, mémorisation) |
| ✨ Magie | 🔮 Magie hors combat | incantation depuis la fiche : soin/bénédiction, Focalisation + Sort d'Arcane, refus des Projectiles |
| 🐲 Créatures | 🐲 Bestiaire, traits & états | ménagerie : traits (Éthéré/Démoniaque/Régénération/Toile…), états + purge Shallya, Énorme/Piétinement, statblocs d'auteur, 19 mutations sur les héros |
| 🐲 Créatures | 🐺 Métamorphose — Enfant d'Ulric | transformation volontaire (op `transform`) : un Enfant d'Ulric humain adopte sa forme hybride (delta de profil RAW + Traits + apparence tête-de-loup, persistant, réversible) au prix de 2 Actions ; auto-transformation IA (self-buff data-driven), rendu du rig hybride |
| 🧭 Survie | 🧭 Voyage & temps long | carte du monde, voyage à pied/diligence, postes d'Étapes (EDOC), haltes de nuit (récupération/faim/maladie/cauchemars), interlude d'Activités à l'arrivée (lieu `altdorf` : Activités d'Altdorf ACE Annexe I atteignables) |
| 🛒 Marché | 🛒 Marché & équipement | Acheter/Vendre/Marchander/Évaluer/Réparer, 2 archétypes (armurier + herboriste via dialogue), écran d'EMPLACEMENTS (couches d'armure, sets d'armes) |
| 🛒 Marché | 🛳️ Commerce fluvial (le Reik) | commerce de cargaison T2C ch.11 JOUABLE : le Reik peuplé de vraies localités marchandes (Index géographique, Taille/Richesse/Produits verbatim) reliées par routes de BARGE ; boucle du marchand acheter/descendre le fleuve/revendre (profit), Marchandage/Évaluation, exposition hydrique (T2C ch.14) en approchant d'Altdorf |
| 🗺️ Scénarios complets | 🎭 Opéra | théâtre Staatsoper multi-niveaux ; bombe à minuterie (désamorçage Poudre noire), pétards/Glimbrin, étudiants saboteurs, dialogue gaté de la Comtesse |
| 🗺️ Scénarios complets | 🪤 Le Caveau piégé | vitrine Flow+Condition : interactions (levier/clé → flags), condition composée, dalle piégée (Test à branches) |
| 🗺️ Scénarios complets | 🏟️ Arène — le Bourg | campagne vitrine complète (Bourg, 13 zones, contrats, carte du monde, marchands, fouilles) |
| 🗺️ Scénarios complets | ⚔️ Bataille de masse | Puissance de Bataille (ADE II 08) : Activités pré-combat, SITUATION par Round (sous-ensemble + menace Intrus + enchaînements), Scènes multi-PJ en Soutien (Test ou combat nourrissant la Puissance en touches/kills), Rassemblement (Résistance), Test spectaculaire de Puissance (10 + DR, min 5), issue |
| 🗺️ Scénarios complets | 🏘️ Effets scriptés | quatre Effets d'auteur testés au moteur mais orphelins de scénario (#96/#97), câblés à un déclencheur réel : `medicalAid` (dialogue du médecin, soins payants), `petitePriere` (autel interactif, LDB 25), `ambitionLost` (dialogue du messager, ADE II Annexe I), `fall`+`inflictTrauma` (trappe vermoulue, LDB 15/18) |
| ⛵ Naval | ⛵ Combat naval | postes d'artillerie servis (MDG), navire-Combattant à PV + Blindage, Critiques de NAVIRE, équipage lié ; VICTOIRE par NAUFRAGE (coque coulée → équipage par-dessus bord) **ou** par ABORDAGE (le Tueur + le Sorcier traversent, engagent et vainquent l'équipage → la cogue est prise) |
| ⛵ Naval | ⚓ Voyage maritime | traversée en mer JOUABLE (MDG ch.13/15) : route maritime (milles) entre 2 ports, appareillage sur le navire de campagne (cogue), journée = météo/vent + Tests d'équipage (Progression/Orientation/Perception au phare) + entretien de coque, haltes de nuit, ACCOSTAGE au Grand Port (réparer/caréner/commerce) |
| ⛵ Naval | 🏹 Embuscade fluviale | combat de bateau FLUVIAL (T2C ch.5) distinct de la mer par ses données (Localisation/Critique fluviaux via le même moteur naval MDG) ; équipage exposé lié (Éclats/critique « Équipage » sur de vrais pirates) ; bestiaire ch.13 (Anguille du Reik) |
| 🖼️ Rendu | 🖼️ Siège — exploration (sans combat) | carte du siège (30×46, 2 couches) chargée en EXPLORATION, sans démarrer le combat : déplacement et caméra libres pour inspecter le rendu (rempart, rampe du flanc gauche, chemin de ronde à 4 m, parapet, toits, relief, brouillard) |
| 🖼️ Rendu | 🖼️ Pont — vitrine | relief métrique 100 % données (2 couches + hauteurs parallèles) : marcher SOUS le pont (couche 0) et DESSUS (couche 1 « planches », h=2 m), accès par 2 rampes auto-dérivées (aucun escalier) |
| 🖼️ Rendu | 🖼️ Galerie de modèles | tous les modèles : créatures + toutes les carrières + toutes les armes + mutants (énumérés depuis la data), exploration sans combat |

Un scénario peut embarquer **plusieurs scènes** (`extraScenes`) et une **carte du monde** (`worldMap`) :
il est alors chargé comme un projet (`loadProject`).
