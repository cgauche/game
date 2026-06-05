# Feuille de route — RPG Warhammer Fantasy v4 (web)

Statut au 2026-06-04. Architecture **data-driven** : moteur de règles pur + testé,
schéma de Scène unique partagé éditeur ⇄ runtime ⇄ campagne, base générée depuis
les sources. Rendu **isométrique SVG** (React), pas de Phaser. Dépôt : `cgauche/game`.

---

## ✅ Jalon 0 — Fondations + tranche jouable

- Pipeline de données → base propre `src/data` (LDB + Archives I & II).
- Moteur de règles testé : Tests/DR, Blessures, combat (touche/localisation/dégâts), états.
- Créateur de personnage (aléatoire/manuel) + pré-tirés + groupe de 4.
- Schéma de Scène partagé ; Tome 1 ouverture ; coop hotseat.

## ✅ Jalon 0.5 — Rendu, fidélité, moteur de campagne, éditeur *(fait, post-PR1)*

- **Rendu isométrique SVG** (`src/gameIso/`) remplaçant Phaser : tuiles en losanges,
  murs/arbres 3D, sprites SVG, **caméra qui suit**, carte **responsive plein écran**,
  ambiance (lumière+vignette), **dégâts flottants**, idle bob.
- **Audit de fidélité** (workflow multi-agents) → 3 bugs de règles corrigés (table de
  Difficulté canon, départage des Tests opposés, déclenchement de la Blessure critique).
- **Moteur de campagne minimal** (3 briques) : **transitions de scènes** (registre +
  conservation groupe/flags/inventaire/argent), **tests de compétence interactifs**
  (effet `test` → modal → branches), **inventaire + argent + handouts/documents**.
- **Système d'inventaire/équipement par personnage** : objets à stats (depuis
  `trappings.json`), armes/armure actives **dérivées de l'équipement**
  (`recomputeLoadout`), **fiche de personnage** (caractéristiques, PA par localisation,
  encombrement, compétences, talents, équiper/déséquiper).
- **Sprites du bestiaire** : 57/58 créatures générées depuis l'**art officiel** du LDB
  (workflow) → `src/gameIso/creatureSprites.json`. Galerie QC `/sprites-gallery.html`.
- **Éditeur remis à niveau** : rendu **iso WYSIWYG**, **triggers + effets** structurés,
  **dialogues** structurés, **rencontres** structurées, **outil Zone** (dessin de trigger
  à la souris), inspecteur enrichi (aperçu sprite, dialogue en menu, butin), **palette à
  onglets** (Carte / Logique / Scène).
- **Workflow d'extraction de campagne** → `src/scenes/tome1-dossiers.json` (9 chapitres
  Tome 1 : scènes, PNJ, dialogues, rencontres, triggers ; matière première pour les scènes).

## ✅ Jalon 0.6 — Tilesets, bâtiments & décors data-driven *(fait)*

- **Catalogues extensibles** (registres par id, **sémantique pure ↔ présentation**, fallback)
  pour **sols / bâtiments / décors** : ajouter du contenu = **une entrée de catalogue**, reprise
  automatiquement par le jeu **et** l'éditeur — fini les unions `export type` figées et les `switch`.
- **Sols enrichis + raccord d'arêtes** (crossers façon NWN) : `Terrain` = id de catalogue,
  précédence de débordement, wedges de transition (`gameIso/ground.ts`) ; nouveaux sols
  pavé / terre / dallage. Palette de l'éditeur générée depuis le catalogue.
- **Bâtiments multi-tuiles procéduraux** (`gameIso/catalog/buildings.ts`) : maison à colombages,
  taverne, forge, échoppe, chapelle, tour, manoir — rendu en **3 calques** (murs / intérieur / toit).
- **Occlusion « admirable »** : **toit-cutaway** (le toit se fond quand le groupe entre — petits
  bâtiments jouables in-scene) **+ porte → transition** vers une scène d'intérieur (monuments) ;
  **choix par bâtiment** dans l'éditeur.
- **Walkability d'empreinte** pure et testée (`state/buildings.ts` : périmètre bloquant, porte
  franchissable, intérieur selon le mode `cutaway`/`door`).
- **Décors / placeables procéduraux** (puits, charrette, fontaine, statue, lampadaire, étal,
  feu de camp, tas de foin…) posés librement via le catalogue (`propSprite(ref)`).
- **Éditeur générique piloté par catalogue** : palette sols/bâtiments auto-générée, **pose de
  bâtiment par drag** (empreinte), inspecteur (params via `ParamFields` depuis `paramsSchema`,
  bascule cutaway/porte, tuile-porte, scène d'intérieur), sélecteur de décor.
- **Animations d'ambiance** portées d'`ambush.html` (`gameIso/anim.css` : respiration, flamme,
  fumée de cheminée, enseigne qui balance).
- **RNG de combat seedable** (`store.seedRng`) : combat enfin déterministe — flaky test éliminé,
  socle pour la coop réseau.
- **Polish 0.6 (D1–D4)** : `facing` **pilote la porte** (`defaultDoor` pur) **et est lu par le rendu** ;
  **intérieurs réutilisables** via l'effet **`transitionBack`** + `makeInteriorScene` (aller-retour
  porte → intérieur → retour, `previousScene` au store) ; **art des bâtiments enrichi** (rangs de
  tuiles/ardoises/chaume, **fenêtres** allumées la **nuit** — halo + flicker, **porte côté `facing`**,
  colombages en croix de St-André, ombre portée) ; **validé en navigateur** (pose drag, 3 calques,
  cutaway, raccord d'arêtes, palette catalogue, `facing`→porte).

## ✅ Jalon 0.7 — Couche magie au combat *(fait)*

- **Moteur d'incantation pur et testé** (`src/engine/magic.ts`) : routage du Test selon la branche
  (Sorts → **Langue (Magick)** / Int ; Prières → **Prière** / Soc ; **Focalisation** / FM), seuil
  **DR ≥ NI** pour les Sorts (succès simple pour les Prières), **Projectile magique** (Dégâts du sort
  + DR + BFM, localisation = jet inversé, réduction BE+PA, flags *ignore PA / ignore Bonus
  d'Endurance*), **Focalisation** (accumulation du DR → lancement à NI 0).
- **Effets actifs temporisés** (`Combatant.activeEffects`) : buffs/malus de caractéristique,
  **meilleur bonus + pire pénalité** sans cumul (LDB l.168), durées en rounds (littéral **et**
  formule « (Bonus de X) Rounds »), décrément en fin de round ; soin, application/retrait d'États.
- **Incantations Imparfaites & Colère des dieux** (`src/engine/miscast.ts`) : tables d100
  table-driven (Mineure / Majeure / Colère, +10 par Point de Péché, relances cascade/multiplication).
  **Fidélité stricte** : seuls les effets modélisés (États nommés, Blessures ignorant BE+PA,
  réduction à 0 + Inconscient) sont auto-appliqués ; le reste (Corruption, Pénitence, perte de
  Talents, invocation, mutations…) est **journalisé et laissé au MJ** — rien d'inventé.
- **Compétences Avancées** : Prière/Langue/Focalisation exigent ≥ 1 augmentation, sinon le Test est
  refusé (pas de repli sur la Caractéristique nue).
- **UI** : action **« Incanter »** + liste de sorts + ciblage allié/ennemi/soi (`BattlePanel`,
  `IsoStage`) ; deux pré-tirés incantateurs (Sorcier, Prêtre) dans « Test rapide ».
- **Audit de fidélité multi-agents** (58 agents) → **4 correctifs** (ignore-BE, soin paramétré,
  retrait d'État, durée non inventée) + **pire pénalité**, tous sourcés au Livre de base.

## ✅ Jalon 0.8 — Apparences par calques, rôle découplé, décors d'embuscade *(fait)*

- **Moteur d'apparence par calques** (`gameIso/appearance.ts`, pur + testé) : une créature =
  liste de calques, chaque calque a N variantes ; `composeAppearance(name, seed, pins)` tire une
  variante par calque via le **RNG seedable**, concatène. **Auto-variée au seed** (id de l'entité)
  → une foule paraît variée sans réglage ; **override éditeur** par `pins` (slot → variante).
  **Fallback** sur le sprite monolithique (`creatureSprites.json`) pour les créatures non enrichies.
- **Apparence découplée du rôle** : `entitySprite(ent)` est la **source unique** de rendu d'entité,
  partagée par le jeu (`IsoStage`) et l'éditeur (fin de la duplication). Un personnage porte
  **n'importe quelle apparence** via `ref` ; le combat reste piloté par les **encounters** et
  l'interaction par `dialogueId` — orthogonaux.
- **Fusion `pnj` + `ennemi` → `kind: 'personnage'`** : la distinction ne portait plus que le sprite
  par défaut. `EntityKind = heroStart | personnage | objet | prop` ; `normalizeEntityKind` assure la
  **compat des scènes anciennes**. Inspecteur **unifié** (« Personnage » : apparence = bestiaire +
  Villageois, dialogue/quête, variante de calque + 🎲). → débloque « **un pigeon qui donne une quête** ».
- **Apparences enrichies (pilotes)** : **Humain** (4 tuniques par swap de palette, silhouette
  préservée) ; **Mutant** (calque `forme` = **8 corps / 5 morphologies** : humanoïde à la hache ×4
  teintes, charognard quadrupède, lézard arbalétrier, homme-chien hurlant, bras-tentacule — types
  repris d'`ambush.html`). Le vert **est permis** pour un mutant Chaos à silhouette lisible.
- **Décors d'embuscade** (`gameIso/catalog/decor.ts`) : `cadavre`, `mare-sang`, `cheval-mort`,
  `epave-carrosse` — repris d'`ambush.html`, posables via la palette décor.
- **Vérifié en navigateur** (Playwright) : éditeur, pigeon-quête, planches QC des nouveaux sprites.

---

## 🎯 Jalon 1 — Profondeur des règles de combat *(prochain)*

- **Jets par MODALE** ✅ : attaque, tests hors combat ET **défense réactive** passent par une
  modale — « 🎲 Lancer » / « 🛡️ Défendre » puis dépense possible d'un point de **Chance** pour
  relancer (LDB Destin). L'attaque permet de **viser une localisation** (Complexe -10). Quand un
  ennemi frappe un héros en mêlée, le tour de l'IA est **suspendu** : le joueur choisit
  Parade/Esquive, relance sa défense par Chance, puis applique (l'IA reprend).
- Actions : ✅ **Défense totale** (« Sur la défensive » : +1 DR en défense, expire à son tour).
  Restent : **Charge, Désengagement, ramasser**.
- ✅ **Avantage** (gain +1/attaque réussie & à la fuite, -1 si aucun gain au Round ; perte totale K.O.).
- **Critiques & Maladresses** : tables de Blessures critiques par localisation (LDB p.172+). *(non modélisé — laissé au MJ)*
- **Distance** : ✅ **bandes de portée** (Bout portant→Extrême, hors-portée bloqué) ; reste ligne de vue, couvert, rechargement, munitions.
- ✅ **Qualités/Défauts d'armes** (Précise, Pointue, Perforante, Empaleuse, Assommante, Défensive, À enroulement).
- ✅ **Esquive vs Parade** comme choix défensif réel (meilleure valeur, Encombrement inclus) ; reste armes à 2 mains, bouclier.
- ✅ **États pleinement actifs en combat** (pénalités de test non-cumul, bonus attaquant, dégâts par round ; **Sonné** = +1 Avantage à l'attaquant en mêlée + récupération par Test de Résistance puis Exténué — corrigés par l'audit de fidélité). *(Reste : Sonné « incapable d'Action » + demi-Mouvement = changement d'économie de tour à valider en jeu.)*
- ✅ Dépense de **Chance** en jeu (relancer le jet — modales attaque + hors combat). Reste : Détermination, ajout direct de DR.
- ✅ **Barre d'action en bas** (hotbar) qui suit le combattant actif (déplacer/attaquer/incanter/défensive/fin).
- ✅ **IA d'ennemi enrichie** (cible le plus faible, tir à distance, sorts, Esquive/Parade —
  `state/ai.ts` pur+testé). Reste, lié aux actions ci-dessus : charge, désengagement, Avantage complet.

## 🎯 Jalon 2 — Magie & Religion *(socle fait — Jalon 0.7)*

- ✅ Sorts/Bénédictions/Miracles en combat, Incantation, Focalisation, Projectiles, effets actifs,
  Incantations Imparfaites & Colère des dieux (socle), gating des compétences Avancées, UI Incanter.
- Reste (fidélité fine, hors périmètre 0.7) : **tables d'Imparfaites/Colère pleinement mécaniques**
  (aujourd'hui : entrées combat appliquées, le reste laissé au MJ), **effets modulés par le DR**
  (« pour chaque +2 DR »), **États récurrents** (un par round), **durées d'États** en rounds,
  **Points de Péché** + déclencheur Colère sur prière réussie, **risques de Focalisation**
  (interruption Calme −20, contrecoup Critique, spécialisation par **Vent**), **Corruption/mutations**.
- Reste (contenu/UI) : **grimoire** (apprentissage/mémorisation des sorts), ciblage de **zone**
  (gabarits AoE), sorts à effet non chiffré (relance, arme magique, peur…) par identité de sort.

## 🎯 Jalon 3 — Création de personnage complète

- ✅ **Compétences/Talents raciaux** appliqués à la création (LDB l.510 : 3 compétences d'espèce
  à +5, 3 à +3, additif ; talents fixes, choix « A ou B », et « N Talent aléatoire » tirés sur le
  Tableau des Talents aléatoires d100). Restent : richesse initiale, détails physiques, noms.
- **Avancement** : dépense d'XP, **changement de carrière**.

## 🎯 Jalon 4 — Campagne « L'Ennemi Intérieur » (contenu)

- **Réécrire le vrai Chapitre 1** (soirée à l'auberge : Gustav, Isolde, Phillipe + partie de
  cartes, inspection de la diligence, Document 1, départ) — **0 combat obligatoire**, social.
- **Chapitre 2** = « Du Sang Sur la Route » (l'embuscade des mutants, séparée du Ch.1).
- Puis Tomes 1-3, en s'appuyant sur `tome1-dossiers.json` et **l'éditeur** (tout est éditable).
- ⚠️ Le `tome1-intro` actuel est une **démo** (walk-to-trigger), pas le vrai Ch.1.

## 🎯 Jalon 5 — Méta-jeu & persistance

- **Sauvegarde/chargement** (localStorage + export/import).
- **Entre deux aventures** : achats/marchandage, fabrication, activités, soins/maladies.
- ✅ **Encombrement** appliqué (pénalités LDB p.295 : Mouvement −1/−2 + planchers, immobilisé
  au-delà de ×3, malus d'Agilité −10/−20 sur l'Esquive ; câblé au combat). Reste : Fatigue du
  voyage (échelle voyage, hors combat).

## 🎯 Jalon 6 — Éditeur avancé *(largement entamé — Jalons 0.5 & 0.6)*

- Fait : palette à onglets, triggers/dialogues/rencontres structurés, outil Zone, **bâtiments &
  décors data-driven posés par drag**, inspecteur générique (`ParamFields`), sélection de bâtiment,
  **kind `personnage` unifié** (apparence = ref bestiaire + variante de calque + dialogue/quête).
- ✅ **Sélection d'une zone trigger au clic** (surbrillance + inspecteur : rect, condition, effets, suppr.).
- ✅ **Placement des ennemis sur la carte**, **undo/redo**, **projet multi-scènes** (basculer / lier les
  intérieurs sans toucher `campaign[]`). Reste : éditeur de statblocks.

## 🎯 Jalon 7 — Coop en ligne

- Du hotseat au **réseau** (WebSocket ou WebRTC). **RNG de combat seedable** (`store.seedRng`,
  Jalon 0.6) + état sérialisable déjà en place.

## 🎯 Jalon 8 — Polish & production

- **Sprites de carrières** (héros) via workflow (réfs prêtes : `mapping.json` 64/71) ;
  **sprites composables** (l'équipement se voit) ; **animations** marche/attaque/mort.
- ✅ **Reprise des sprites de bestiaire ratés (galerie QC)** — régénérés via workflow
  best-of-2 (lecture art officiel + desc canon + consigne silhouette) : ~52/57 redessinés,
  fin du vert mutant par défaut, silhouettes reconnaissables. Restent perfectibles : Dragon
  (plus élancé), Manticore, Mutant.
- Sons & musique, accessibilité ; ✅ **code-splitting** (éditeur/rendu lazy) ; ✅ **CI** (tests+build ; lint à venir).

---

## Dette technique connue

- **Sprites** par équipement non reflétés (sprites figés par carrière, pas composables).
- Sprites de bestiaire **régénérés** (workflow best-of-2, fidélité silhouette + palette) ;
  restent quelques complexes perfectibles (Dragon, Manticore, Mutant). Le SVG dessiné main
  plafonne sur les gros ailés.
- **Apparences par calques** en place (auto-variées au seed + override éditeur), mais seuls
  **Humain** (tuniques) et **Mutant** (5 morphologies) sont enrichis — le reste du bestiaire
  = apparence unique (fallback). Proportions des morphologies mutant **homme-chien / tentacule**
  perfectibles (corps « ballon », jambes fines).
- ✅ **IA d'ennemi enrichie** (cible le plus faible atteignable, tir à distance, sorts offensifs,
  choix Esquive/Parade — `state/ai.ts` pur + testé).
- ✅ **Éditeur : annuler/rétablir** (`useSceneHistory`, Ctrl+Z/Y) **+ placement des ennemis de
  rencontre sur la carte** (outil dédié ; points d'apparition visibles et cliquables).
- **Art des bâtiments** enrichi (tuiles/ardoises/chaume, fenêtres + éclairage nuit, porte côté
  `facing`, colombages, ombre) ; reste perfectible vers le niveau d'`ambush.html` (textures fines,
  variantes par type, rotation pleine selon `facing`).
- ✅ **`reveal:'door'` + intérieur concret + projet multi-scènes** : la salle de bar « La Diligence »
  (`tome1-auberge-interieur`, sourcée) est créée, enregistrée et liée par la porte du bâtiment taverne de
  tome1-intro (boucle vérifiée). L'éditeur gère désormais un **projet de plusieurs scènes** (basculer /
  ajouter / retirer, export-import au niveau projet, `store.loadProject`) : on crée et lie un intérieur
  **sans toucher `campaign[]`**.
- ✅ **Rendu `mur`/`bois` centralisé** : les branches dupliquées à l'identique dans `IsoStage` ET
  `Editor` passent par une source unique (`sprites.terrainOverlay` + registre `TERRAIN_OVERLAYS`).
  `bois` et `mur` sont **gardés comme terrains bloquants** (les migrer en décor `arbre` les rendrait
  franchissables — changement de gameplay non souhaité ; le décor `arbre` reste pour les arbres non bloquants).
- ✅ **Code mort retiré** : renderers obsolètes Phaser (`src/game/`) + three.js (`src/game3d/`)
  supprimés ; dépendances `phaser`/`three`/`@types/three` retirées (~188 Mo de node_modules, ~900 l.).
- ✅ **Code-splitting** : éditeur + rendu de jeu (`CampaignView`) + vendor + **tables de règles
  (`gamedata`)** en chunks séparés (`React.lazy` + `manualChunks`) — le chunk applicatif passe de
  ~1,2 Mo à **~580 Ko**, les données (~760 Ko) cachées indépendamment du code. Reste (optionnel) :
  chargement *paresseux* des données (demande de découpler le moteur pur du dossier `src/data`).
- ✅ **CI + lint** (`.github/workflows/ci.yml`) : `build:data` → typecheck → **ESLint** → tests → build
  sur push/PR (config ESLint volontairement lenient ; base à 0 erreur).
- ✅ **Éclairage nocturne des fenêtres** : recette navigateur rejouée (Playwright — verre ambré
  `#f2c45a` + halo + flicker confirmés vs verre froid `#33414d` de jour) + test unitaire de la
  branche `night` (`buildings.test.ts`).

## Principes directeurs

1. **Rien n'est inventé** : toute règle/contenu vient de `Source/` (LDB + Archives I & II).
   La fidélité se vérifie (cf. workflow d'audit) ; ne pas utiliser tes connaissances.
2. **Tout est éditable** : le contenu de campagne reste des documents au schéma de Scène,
   créables dans l'éditeur.
3. **Le moteur reste pur et testé** (`src/engine`) ; le store, l'UI (React) et le rendu (iso SVG)
   en dépendent, jamais l'inverse.
4. **Livrer par tranches jouables**, vérifier dans le navigateur (Playwright), committer souvent.
5. **UI qui scale** : dès qu'un panneau dépasse ~2 sections → onglets / zones contextuelles.
