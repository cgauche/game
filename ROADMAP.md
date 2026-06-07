# Feuille de route — RPG Warhammer Fantasy v4 (web)

Statut au 2026-06-07. Architecture **data-driven** : moteur de règles pur + testé,
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

## ✅ Jalon 0.9 — Caméra : rotation 90° & contrôles de vue partagés *(fait)*

- **Rotation caméra par crans de 90°** (4 orientations cardinales) en **jeu ET éditeur** : `rot` est
  un **paramètre de vue** porté par `Dims`, appliqué dans la **projection centralisée** (`gameIso/iso.ts` :
  `rotTile`/`unrotTile`/`effDims`, puis `tileCenter`/`screenToTile`/`depth` rot-aware — **purs + testés**,
  round-trip picking & cadrage sur les 4 rotations). **La donnée de scène reste intacte** (état de vue,
  non sérialisé). Touches **Q/E** (la *lettre* — AZERTY comme QWERTY) + boutons.
- **Occlusion correcte sous tous les angles** (le but premier) : les bâtiments labellisent leurs faces
  **par position écran** (`footCorners` trié ; porte tournée par `rot` via `rotateFacing`) → murs/porte
  **toujours face caméra**, jamais d'arrière ni de transparence. **Facing du rig rot-aware**
  (`screenDir(dims)` tourne ses extrémités ; `camRot` lu *en live* depuis le store par `RigToken`/
  `AnimatedQuadToken` — pas de threading de props).
- **Transition « dim-and-turn »** (jeu) : la rotation iso 90° n'étant **pas** une rotation 2D rigide
  (le monde se ré-agence), creux d'opacité + dézoom bref masquent le swap ; **snap** côté éditeur.
- **Zoom éditeur** (absent jusqu'ici) : **molette** ancrée au curseur + **pan** (clic-milieu / **Espace**
  + glisser) + **reset**, piloté par le **`viewBox`** — le picking (`getScreenCTM().inverse()`) en tient
  compte donc **inchangé**, zéro modif du placement.
- **Boutons de vue PARTAGÉS** jeu ⇄ éditeur (`ui/ViewControls.tsx`, overlay HTML : zoom **+ / − / 1×**
  + rotation **⟲ / ⟳**) ; le `zoom` du jeu **remonté dans le store** pour piloter le même composant.
  **Vérifié au navigateur** (Playwright : zoom, rotation sans scène figée, occlusion, molette/pan/reset).
- *(Parties pures **commitées** — `iso.ts`/`buildings.ts`/`facing.ts`/`store.ts`/`ViewControls.tsx` ;
  le **câblage React** vit dans `IsoStage`/`Editor`/`CampaignView`, à committer avec le WIP rendu en cours.)*

## ✅ Jalon 0.10 — Registre générique « dépose un fichier → intégré » *(fait — 2026-06-06/07)*

- **But** (énoncé utilisateur) : « il suffit de mettre une créature dans un dossier et POUF, il est
  intégré au jeu » — calqué sur l'auto-chargement des scénarios de test. **Réalisé** : ajouter une
  créature = **UN fichier** `src/gameIso/rig/creatures/defs/<Nom>.ts` (un `CreatureDef`), au lieu d'en
  référencer le label dans **8 fichiers** (l'ancien smell).
- **Architecture** : `defs/*.ts` → **codegen générique** `scripts/gen-registry.mjs` écrit
  `_registry.generated.ts` (imports explicites) → `creatures/index.ts` **DÉRIVE tout** (plus aucune table
  `SPECIES_*` centrale) : routage de gabarit (`bodyPlanOf`), matchers nom→espèce
  (`quad/wing/bipedSpeciesMatch`, l'ordre `matchPriority` désambiguïse « rat ogre »→Skaven avant Ogre),
  config bipède (career/monster/sex/parts/colors), **token-scale par espèce** (rat petit, dragon/géant
  énormes). **Codegen choisi plutôt qu'`import.meta.glob`** : glob est Vite-only et **`undefined` sous tsx**
  (les scripts QC cassent) ; le codegen marche partout (Vite + Vitest + tsx), inspectable, zéro runtime.
  **Plugin Vite `registry-gen`** régénère au démarrage + à chaque ajout/suppression dans `defs/` (POUF en
  dev) ; intégré au `npm run build`.
- **Générateur GÉNÉRIQUE étendu à 4 familles** (config `REGISTRIES`, champ `importDir` pour les dossiers
  à plat) — même mécanique partout :
  - **Créatures** (`creatures/defs/`) — cf. ci-dessus.
  - **Scénarios de test** (`scenes/test-scenarios/`) : migrés de `import.meta.glob` (Vite-only, cassé sous
    tsx/Vitest) vers l'index généré → un mécanisme unique, marche partout.
  - **Tenues** (`parts/tenues/defs/`) : 8 archétypes de classe + Nu sortis de la table codée en dur de
    `career.ts` ; `TENUES`/`TENUE_NUE` dérivés. `career.ts` ne garde que la logique.
  - **Parts monstrueuses** (`parts/monster/defs/`) : 16 têtes (front/dos/profil) + 2 bras + 1 jambe sortis
    de la triple-saisie de `monstrous.ts` (union `MonsterHead/Arm/Leg` + `Record` + tableaux `_OPTIONS`) ;
    `HEADS/ARMS/LEGS` + les 3 catalogues d'OPTIONS dérivés. Fini les 3 endroits à éditer pour ajouter une
    tête (le smell du cyclope). `monstrous.ts` 557→132 l. (ne garde que `MonsterParts` + overlays +
    `monsterInjection`) ; helpers d'yeux extraits (`monster/eyes.ts`, DRY) ; **code mort supprimé**
    (`undeadEye`, `OV_COL_CAPE`). Refacto **garanti sans régression par un golden master** (snapshot du SVG
    résolu de `monsterInjection`, identique à l'octet).
- **Logique mise à plat** : `detectSpecies` (if-chain) + **5 tables `SPECIES_*`** supprimées d'`enemyProfile.ts` ;
  `quadSkeleton`/`composeWing` **re-exportent** depuis `creatures` → consommateurs inchangés. Helper **`norm`
  unifié** (1 copie, 7 inline supprimées).
- **Recatégorisations hors monolithique** : **Liche**→bipède (squelette), **Manticore/Varghulf**→ailé
  (réutilisent feline/canine + membrane), **Démonette**→bipède (cornes + griffe + peau mauve), **Fimir**→bipède
  (tête `cyclope` ajoutée à `monstrous.ts`), **Géant**→bipède (token-scale ×2.4, sinon il déborde la boîte
  120×150). Restent monolithiques **seulement** les formes qu'aucun gabarit ne couvre (serpent, araignée,
  pieuvre, hydre, squig, basilic…).
- **« Charognard » supprimé** (espèce inventée, non canon, indistincte du loup ; variante Mutant `mutantCharognard`
  conservée). **`public/qc/` gitignoré** (sorties QC régénérables — git ralentissait sur 1000+ fichiers non suivis).
- **613 tests verts** (dont registres scénarios/tenues + golden master parts), **typecheck 0** côté registre,
  poussé en prod (`feat/wfrp4-rpg-foundation`). Reste à brancher sur le pattern si besoin : palettes/cheveux
  (déjà un pipeline d'ingestion d'art à part) — **formes d'armes : FAIT (Jalon 0.11)**.

---

## ✅ Jalon 0.11 — Système d'arme : maniement, registre, couleur/skins, reconnaissabilité *(fait — 2026-06-07)*

- **Maniement clé sur la FORME, pas le Groupe de règles** (`rig/anim/handling.ts`) : l'animation d'arme
  (port/idle, attaque, parade) passe par `handlingClass(w)` dérivé de la **silhouette** (`formSlug`), PAS du
  subType WFRP — qui conflate des armes maniées différemment (1-main/2-mains, lame/hampe/arc). **15 classes**.
  `weaponClips.ts` refondu : `weaponRest(w)` = pose de base **TOUJOURS** appliquée (orientation de l'os `arme`
  + **prise 1/2 mains**) sous les clips d'attaque/parade re-tunés. **Prise 2-mains reconstruite** (lourde2m/
  hampe/arc/arbalète/arme à feu) via **port diagonal** (le rig 2D ne peut centrer l'arme ancrée à la main
  droite). Câblé dans `RigToken` (remplace l'ancien `carryPose` gaté profil) — **corrige l'arme tenue
  tête-en-bas** à l'idle. Piège : l'os `arme` est **relatif à la main** → la rotation du bras s'ajoute pendant
  l'attaque (gros delta `arme` à l'apex) ; les attaques de FACE restent limitées par le 2D (mouvement vers
  l'avant = pas de profondeur) → se jugent en profil/animées.
- **Registre d'armes (5e famille du Jalon 0.10)** : les **48 armes** sont **1 fichier `weapons/defs/<slug>.ts`**
  = `WeaponDef` unifié `{slug,label,type,group,target,art}` (FORME + ART, une seule source de vérité par arme,
  comme parts/tenues). `weaponForms.ts` et `equipment.ts` **dérivent** du registre ; monolithe
  `generated/weaponsArmour.ts` **supprimé** (armure extraite dans `generated/armour.ts`). Migration **sans perte**.
- **Couleur tokenisée + skins d'objets légendaires** : l'art des 48 armes en **`@tokens`** (`@metal/@cuir/@accent`
  + ombres auto `@O/@H`, `palette.ts`) + une `palette` par def (`StoredPalette` = couleurs exactes → **défaut
  sans perte**). `equipment.weaponPart` résout l'art contre la palette du DEF, et re-résout contre **`Weapon.skin`**
  (override par-objet) ; chaîne `ItemInstance.skin → recomputeLoadout → Weapon.skin → rendu` → un objet
  **légendaire** recolore lame/bois/or indépendamment (prouvé). ⚠️ arme = palette de l'OBJET ; tenue = palette
  du PORTEUR. Tokeniseur déterministe `_tokenize-weapons.mts` (classif HSL, dégradés → mid réel).
- **Tenues normalisées** : les tenues de **carrière** étaient déjà tokenisées ; les **9 archétypes** de classe
  (fallback, 7/71 carrières) sont passés au même mécanisme (`@vet1/@vet2/@metal` + `TenueDef.palette` → `CLASS_PALETTES`),
  résolution **unifiée** `tenuePaletteFor(career)` (palette carrière → palette classe en repli) dans `composeRig`
  → les carrières fallback héritent/recolorent comme les autres. Zéro régression.
- **Reconnaissabilité « à l'aveugle » (but d'origine) bouclée** : chaque arme = sa propre silhouette (on était à
  12 modèles par groupe). Audit aveugle des 48 (agents qui devinent l'arme sans son nom) → échecs (arbalète lue
  « croix », improvisée « fagot », lasso « cadenas »…) **regénérés en best-of-N + juge** sur 2-3 passes (la 2e
  ciblée N=5 anti-ambiguïté) jusqu'à **reconnaissables**. Reste seulement `rocher` (un caillou *est* un caillou).
  Pipeline durci : ingest filtré par slugs explicites (anti `chosen.json` périmés), tokeniseur idempotent.
- **~731 tests verts**, typecheck propre, poussé sur `feat/wfrp4-rpg-foundation`.

---

## ✅ Jalon 1 — Profondeur des règles de combat *(complet — 2026-06-07)*

- **Jets par MODALE** ✅ : attaque, tests hors combat, **défense réactive** ET **incantation/prière**
  passent par une modale — « 🎲 Lancer » / « 🛡️ Défendre » puis dépense possible d'un point de
  **Chance** pour relancer (LDB Destin). L'attaque permet de **viser une localisation** (Complexe -10).
  Quand un ennemi frappe un héros en mêlée, le tour de l'IA est **suspendu** : le joueur choisit
  Parade/Esquive, relance sa défense par Chance, puis applique (l'IA reprend). **La modale montre les
  DEUX côtés du Test opposé** (base + modificateurs = cible · d100 · DR de l'attaquant ET du défenseur)
  — fini le « un seul chiffre ». L'incantation a son flux différé `pendingCast` (NI, DR ≥ NI, Maladresse).
- Actions : ✅ **Défense totale** (« Sur la défensive »), ✅ **Charge** (se ruer au contact sur
  la portée de Course → +1/+2 Avantage, attaque obligatoire), ✅ **Désengagement** = menu de choix :
  *Sacrifier l'Avantage* / *Esquiver* (Test opposé, coûte l'Action) / ✅ **Fuir** (attaque gratuite
  dans le dos +20, Test de Calme ou État Brisé, puis Mouvement de Course) / *Renoncer*. Reste : **ramasser en plein combat** (arme tombée au sol durant un Round ; le pillage *après* combat = exploration, cf. objets cherchables `search` Jalon 4).
- ✅ **État Engagé** (LDB 13-Combat l.174-175) : posé sur toute attaque de mêlée, levé en fin de
  Round sans coup échangé ; un Engagé ne se déplace plus librement (→ Désengagement). *(L'IA ne
  fait pas de Désengagement et charge en portée de Marche — simplifications assumées.)*
- ✅ **Avantage** (gain +1/attaque réussie & à la fuite, -1 si aucun gain au Round ; perte totale K.O.).
- **Critiques** ✅ : tables de Blessures critiques par localisation (LDB 18-Traumatisme, verbatim) — **0 PB ≠ mort** (À Terre→Inconscient après BE rounds→mort si critiques cumulées > BE), déclenchées par **overkill** (dégâts > PB courants, −20 si > BE) ou **double**, **Mort Subite** pour les figurants ; effets long terme (amputation/fracture/déchirure) journalisés (→ Jalon 5). `isOutOfAction` corrigé (`wounds≤0` ne tue plus un héros).
- ✅ **Maladresses** (LDB 14 — Tableau des Oups !) : un Test de combat **raté sur un double** déclenche le Tableau des Oups ! (`engine/oups.ts` + `data/oups.ts` verbatim) — auto-blessure, Dégât d'arme + **agir en dernier** (transitoire 1 Round), −10/perte d'Action/perte de Mouvement au prochain Round, **Déchirure musculaire** (= critique), touche d'un allié à portée / soi → Sonné, **Incident de Tir** (arme à poudre, jet pair → explosion + arme détruite). **Modale héros** (`pendingFumble` : Lancer → Appliquer, invariante « un jet = une modale »), **ennemi → instantané**, **défenseur** (Test opposé) couvert. Audité multi-agents (14 correctifs).
- ✅ **Conséquences de combat persistantes** (thème max-RAW) : (a) **Persistance** — `engine/persistence.ts` réécrit vers le groupe en fin de combat les Blessures, **États persistants** (classés RAW `16-États`), Blessures critiques, **mort** (`dead`/`outOfRencontre`) et l'usure d'arme/munition (`items`) ; carry-in au combat suivant (morts non instanciés). (b) **Traumatismes en-combat** (`engine/trauma.ts`, partagés critiques ↔ Maladresse) : Déchirure musculaire jambe → Mouvement ÷2 + −10/−20 Esquive ; Fracture Torse → F/Ag −30 + Mouvement ÷2 ; Fracture jambe → Mouvement ÷2 + −20 Esquive (règle du Pied) ; reste journalisé (Jalon 5). (c) **Dégâts d'arme** (LDB 62 l.177-180, `engine/weaponDamage.ts`) : −1 Dégât/point, à +0 → **Arme improvisée** (BF+1, Atouts perdus), **Incassable** exempte, destruction (Incident de Tir) ; persisté sur l'`ItemInstance`.
- ✅ **Refacto `store.ts`** : flux de combat extrait dans **`state/combatFlow.ts`** (35 fonctions ; 2364 → ~1540 l.), `battleRng` en module, `isDoubleRoll`/`woundsFromHit` mutualisés, `parseWeaponDamage` (legacy) supprimé. Comportement préservé (tsc 0, suite verte).
- ✅ **Table « Difficultés de Combat » complète** (LDB `14 - _GoBack.md` l.77-136, max-RAW ; modules `state/lineOfSight.ts`, `state/sceneRules.ts`, `engine/size.ts`, `engine/combat.combineMods`) :
  **Ligne de Vue** (gate dur héros **et** IA, `13` l.123), **Couvert** 3 niveaux canon −10/−20/−30 (terrain `mur`/`bois`, bâtiments, décors par id, **empreinte multi-cases** `SceneEntity.foot`, **créatures intercalées**), **Combiner les Difficultés** (plafonds −30/+60, Avantage hors plafond), **obscurité/brouillard** −20, **tempête/neige** −20 (neige aussi en **esquive**), **tir-en-bougeant** −10, **tir dans la mêlée** −20 **+ redirection** vers un allié intercalé. Mods dérivés de la scène **injectés** dans `attackModifiers(opts.env)` (moteur pur préservé). **Météo** (`Scene.weather`) + **empreinte** (`SceneEntity.foot`) **exposées dans l'éditeur** (sélecteurs). **Taille T0+T1** (LDB `85` l.279-303) : champ `Combatant.size` **ordinal** dérivé au spawn (`sizeFromTraits`), **size-to-hit au tir** (−30 Minuscule…+60 Monstrueuse) + **+10 au plus petit** (mêlée & tir). tsc 0 / lint 0 / 681 tests. *(Reste, hors-lot : grisage visuel des cibles hors-LdV = recette `IsoStage`.)*
- **Distance** : ✅ **bandes de portée** (Bout portant→Extrême, hors-portée bloqué) ; ✅ **munitions + rechargement** (héros) ; ✅ **Ligne de Vue + Couvert** (cf. Table Difficultés de Combat ci-dessus).
  - **Munitions = équipement** (`kind 'ammo'`, `subType`/`qty`) : le joueur **choisit** sa munition (sélecteur hotbar), le tir **combine arme + munition** (Dégâts + Atouts, ex. Empaleuse de la Flèche), 1 consommée par tir. **Rechargement** = défaut **« Recharge N »** = **Test étendu de Projectiles** (`63 - Armures.md` l.28-29 + `12 - Tests.md` l.199-211) → **modale** `pendingReload` (cumul de DR jusqu'à l'Indice ; l'Arc, sans Recharge, tire chaque Round). Ennemis = abstraits (tirent librement). Reste (Jalon 5) : munitions ennemies / achat / récupération, talent Rechargement rapide.
- ✅ **Qualités/Défauts d'armes** (Précise, Pointue, Perforante, Empaleuse, Assommante, Défensive, À enroulement, **Pistolet**, **Recharge**).
- ✅ **Pas de tir en Combat rapproché** (LDB Armes l.297-298) : une arme à distance sans l'Atout **Pistolet**
  ne tire pas en étant Engagé/au contact → l'arme est choisie selon la distance (`attackWeapon`), et
  l'IA frappe en mêlée plutôt que de canarder au loin quand un adversaire est à son contact.
- ✅ **Esquive vs Parade** comme choix défensif réel (meilleure valeur, Encombrement inclus) ; reste armes à 2 mains, bouclier.
- ✅ **États pleinement actifs en combat** (pénalités de test non-cumul, bonus attaquant, dégâts par round ; **Sonné** = +1 Avantage à l'attaquant en mêlée, récupération par Test de Résistance puis Exténué, **« incapable d'Action » + déplacement à demi-Mouvement** côté joueur ET IA — tous corrigés via audit de fidélité).
- ✅ Dépense de **Chance** en jeu : relance (**1×/Test, et seulement sur un d100 propre raté** — 2 bugs corrigés), **+1 DR** cumulable, et **Détermination** (retirer un État, +1 PB si À Terre) — modales attaque/défense/hors-combat/incantation/désengagement (composant partagé `ChanceButtons`) + slots hotbar + **modale d'ordre de Round** (3ᵉ usage : agir en premier en dépensant 1 Chance, `RoundStartModal`).
- ✅ **Destin & Résilience sacrifiés** (LDB ch.17) : **« Comment ça a pu rater ? »** (annule un coup létal) et **« Meurs un autre jour »** (survit éjecté, `outOfRencontre`) via suspension `pendingFateSave` (coup létal + mort lente) ; **« Je ne faillirai pas ! »** = réussite garantie (opposé DR +1) dans les 5 modales. Reste : « Je te renie ! » (dépend d'un système de Corruption/mutations non modélisé) et le choix de localisation d'un Critique.
- ✅ **« Un jet = une modale », exhaustif + garde-fou** (2026-06-07, 1012 tests verts) : aucun jet pertinent ne se résout en silence. **Différés interactifs** (Lancer→Chance→Appliquer) : **Piétinement** (`pendingTrample`) et **Focalisation** (`pendingFocus`). **File de révélation témoin** (`pendingReveals`/`RevealModal`, montre le dé, sans Chance, gèle l'IA tant qu'elle est pleine) : **Colère des dieux/Incantation Imparfaite**, **Fuite** (coup dans le dos + Test de Calme), **Coup Critique**, **Assommante**, et **entretien de Round groupé** (Initiative + hémorragie + mort). **Garde-fou statique** (`roll-modal-invariant.test.ts`) : échoue si une action du store résout un jet en ligne (whitelist des résolveurs) — dette **vidée**, anti-régression. Reste : recette navigateur ; vérifier l'enchaînement Déviation Critique → révélation de Critique (deux modales, même touche).
- ✅ **Barre d'action en bas** (hotbar) qui suit le combattant actif (déplacer/attaquer/incanter/**utiliser un objet**/défensive/fin).
- ✅ **IA d'ennemi enrichie** (cible le plus faible, tir à distance, sorts, Esquive/Parade, **Charge** —
  `state/ai.ts` pur+testé). Simplifications IA assumées (revue de fidélité) : l'IA **ne se désengage
  pas** et **charge en portée de Marche** (pas de Course) — mineures, documentées dans le code.

## 🎯 Jalon 1.5 — Sous-système Taille *(T2/T3/T4/T5 LIVRÉS — audit RAW propre ; reste T6, lot à part)*

La Taille est un **Trait de créature** (7 catégories ordinales), pas une caractéristique chiffrée ;
presque tout est une **comparaison d'écart** entre combattants. Analyse : `…/specs/2026-06-07-taille-analyse-reference.md` ;
spec : `…/specs/2026-06-07-taille-combat-design.md` ; plan : `…/plans/2026-06-07-taille-combat.md`.
**T0/T1** déjà livrés (Jalon 1). **Phases 1-2 livrées (2026-06-07, moteur pur, 749 tests verts) :**
- ✅ **T2 — Dégâts** : **×N** par catégorie d'écart, **AVANT** la réduction BE+PA (confirmé) ; Atouts **Dévastatrice** (max DR/unités, +1 cat.) **+ Percutante** (+unités, +2 cat. — **cumul**), Inoffensive annule ; au tir **et** en mêlée. `62` l.279/313 + `85` l.295-297.
- ✅ **T3 partiel** : **−2 DR/cat en parade** du plus petit (`85` l.305-306) ; **Force opposée** posée en helper pur (sans consommateur). *(Reste : orchestration ci-dessous.)*
- ✅ **T4 — Blessures** : table par catégorie (Petite=2BE+BFM … Monstrueuse ×8) ; **formule par défaut, surcharge `char.B` sinon** (vérifié : 52/58 monstres = formule, 6 traités préservés) ; **dynamiques** — un sort sur E/F/FM recale max + courant (`refreshWounds`, application & dissipation). `85` l.332-352.
- ✅ **Frappe Mortelle** : drapeau `cleave` posé sur la touche d'un plus grand ; `resolveTrample` (Piétinement BF/CC) prêt.

**Phase 3 — orchestration & Phase 4 — éditeur livrées (2026-06-07, 788 tests verts) :**
- ✅ **Balayage Frappe Mortelle** : boucle jusqu'à BCC, déplacement sur la case d'une cible tuée, frappe d'un autre **à portée** (= adjacent tant que l'Allonge n'est pas modélisée) ; IA auto (`autoCleave`) + `pendingCleave` héros (`CleaveModal`). `14` l.12 / `85` l.299.
- ✅ **Désengagement gratuit** du plus grand (court-circuite `pendingDisengage` si plus grand que TOUS ses Engagés, `85` l.308-309) ; **action Piétinement** câblée (store `battleTrample` + hotbar « 🦶 Piétiner » + IA `aiMaybeTrample`, action gratuite à 1 Avantage, `85` l.320-321).
- ✅ **Éditeur** : champ Blessures optionnel (vide = formule par Taille en placeholder live, rempli = surcharge).
- ✅ **Audit de fidélité multi-agents** (8 dimensions RAW × find→verify adversariale) : **0 écart confirmé** — implémentation fidèle au `85`.

- ✅ **T5 — Sous-système Psychologie COMPLET (P1-P4) LIVRÉ** (2026-06-07, 1181 tests verts) : `engine/psychology.ts` (pur) + `engine/groups.ts`. Spec : `…/specs/2026-06-07-psychologie-design.md` ; plans P1/P2/P3 sous `…/plans/2026-06-07-psychologie-*.md`.
  - **P1 — Peur/Terreur** : dérivées de la Taille (`85` l.317-318) ET du statbloc (« Peur N »/« Terreur N » de `creatures.json`) ; **Test de Calme** héros en **modale** (`pendingPsych` : Peur = Test ÉTENDU cumulant le DR ; Terreur = 1ʳᵉ rencontre → **Brisé** ×(Indice+|DR−|) puis Peur) / **IA instantané** ; **−1 DR** vs la source (`attackModifiers`) ; **approche** bloquée ; **Immunité (Psychologie)** (`85` l.143-144).
  - **P2 — Frénésie** (`21` l.31-36) : entrée par **Test de FM** (héros = modale `pendingFrenzy` + bouton « 🐗 Frénésie » ; IA = auto) ; **+1 BF**, **immunité psy**, **attaque CC gratuite/Round** (`aiFrenzyAttack`), **cible imposée la plus proche** (IA), **fin → Exténué**.
  - **P3 — Traits ciblés & Groupes** : **Groupes** mots-clés dérivés (folder→catégorie / espèce→racial / carrière + extras manuels, `engine/groups.ts`) ; **Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie** parsés (`parsePsychTraits`, « un au choix » → inerte) ; Tests de Psy ciblés (LdV/groupe, héros modale / IA) ; **+1 DR** (Animosité/Haine/Amour/Camaraderie) & **immunités Peur** (Haine/Amour) dans `attackModifiers` ; **Soc −20/−10** (`socialPsychMod`) ; **contrainte de cible IA** (vise le groupe haï).
  - **P4 — Éditeur** : `StatblockEditor` expose le champ **Groupes** (extras) + l'aide de syntaxe des Traits psy (Peur/Terreur/Immunité/Animosité/Frénésie, assignation de Cible).
  - *Limites documentées* : Phobie traitée comme un ciblé binaire (≈ Peur 1) ; afflictions ciblées re-testées tant qu'un membre du groupe est visible (pas d'auto-fin quand le groupe disparaît — effet résiduel nul) ; contrainte d'action **héros** = journal (pas de grisage des cibles dans l'UI) ; Soc `socialPsychMod` = helper prêt **sans consommateur** (aucune interaction sociale ciblée en combat pour l'instant).

**Reste (lots à part, prochains jalons Taille — par valeur/effort) :**
- **Localisation par forme de corps** (`76 - Point d'Impact des Créatures` + `13` l.144) : tables humanoïde/quadrupède/oiseau/serpent/araignée ; cible 2 cat. plus grande → l'attaquant **choisit** la zone (`76` l.39). Aujourd'hui tout est résolu en humanoïde. Lot moyen, indépendant.
- **T6 — Footprint multi-cases des créatures MOBILES** (`15` l.55, **permissif, aucune table canon = DESIGN**) : pathing non-ponctuel + picking/rendu. Partiellement bloqué côté rig. Le plus lourd.
- **Détails RAW restants** : **Monture & Taille** (`14` l.217-223), **Queue/Langue** (`85`), **Nuée** ignore la Taille (+40 aux tirs, `85` l.199-200), trait **Agrandir/Réduire** au build de statbloc (+10 F, +10 E, −5 Ag par cat., `85` l.276-277). *(Immunité Psychologie : ✅ livrée avec T5.)*
- **Limites documentées du lot livré** (assumées, pas des bugs) : Frappe Mortelle « à portée » = **adjacent** (Allonge/reach non modélisée) ; Frappe Mortelle de **base** (tuer-en-un-coup, combattants de même Taille) hors-périmètre — seul l'**écart** de Taille déclenche le balayage ; **Force opposée** = helper pur **sans consommateur** (pas de système de lutte/empoignade modélisé).

## 🎯 Jalon 1.6 — Qualité d'objet, Temps & Voyage, Marchand & Arène *(en cours — #1 Qualité d'objet COMPLET ; Temps & Voyage en tête)*

Spec de conception : `docs/superpowers/specs/2026-06-07-qualite-objet-fabrication-design.md`.
Né d'une demande de **scénario d'arène** (vagues + loot + marchand entre les vagues) qui a fait
émerger le **Marchand** comme livrable central, lui-même prérequis d'un **système de qualité
d'objet** (pour qu'Évaluation ait une qualité à révéler). **Décomposé en sous-projets séquencés**
(chacun sa spec → plan → impl). **Re-séquencé 2026-06-07** (décision utilisateur) : le **Temps &
Voyage** s'insère **AVANT le Marchand** — le re-stock de Disponibilité, la Fatigue de voyage et la
guérison en dépendent. Ordre : **Qualité (✓) → Temps & Voyage → Marchand → Arène** :

- **#1 — Qualité d'objet (Fabrication)** *(spec faite)* : Atouts/Défauts d'objet **par instance**
  (artisanat — Léger/Pratique/Raffiné/Solide ; Bâclé/Laid/Peu Fiable/Volumineux) ; effets **prix
  ×2/÷2 + Disponibilité ∓1 cran** (purs, consommés par le marchand), **Haute Qualité**, encombrement ;
  **combat armes** (Solide(N)+sauvegarde, Bâclé, Pratique/Peu Fiable) ; **dégâts d'armure + Déviation
  Critique** (LDB 63 — l'IA ennemie **dévie toujours** tant qu'il reste de la PA → l'armure **s'use**
  au combat) ; pénalités de port, Laid en social ; **Atouts/Défauts d'armure intrinsèques**
  (Flexible/Impénétrable/Partielle/Points Faibles). **Précédé d'une Phase 0** : **registre de qualités
  unifié** (`src/engine/qualities/` + dispatcher pur) qui **absorbe les ~9 checks `hasQ()`/regex épars**
  sous **golden-master** (iso-comportement) → fin de l'empilement, ajouter une qualité = **une entrée**.
  Source : LDB 60 (Fabrication) / 63 (Armures) / 61 / 16.
  - **✅ LIVRÉ (2026-06-07 — ~800 tests verts, golden-master, RAW cité, cf. mémoire `game-qualities-registry`)** :
    - **Phase 0 — Fondation** : registre `src/engine/qualities/` (`registry`+`dispatch`+**`normalize`** : `parseQuality` = clé canonique + Indice typé, match exact, fin du `startsWith`). **TOUS** les `hasQ`/regex migrés (combat/weaponDamage/combatFlow/items/oups). Parité (échoue si une qualité de données n'est ni enregistrée ni allowlistée) + **`golden-combat.test.ts`**. Effets hookés (Dévastatrice/Percutante = `qualityDamageStep` ; Assommante = hook `onHit`).
    - **Phase A — Économie** : 8 qualités d'artisanat enregistrées (subType `Objet`) ; **`craftEconomy.ts` pur** (prix ×2/÷2, Dispo ∓1 + option Guilde, classe Haute/Qualité/Défectueuse) **prêt à être consommé par le Marchand** ; encombrement Léger −1 / Volumineux +1 (porté = 1).
    - **Phase B — Combat armes** : Solide(N) (absorbe N dégâts d'arme + sauvegarde 1d10 ≥ 10−N) ; Bâclé (casse sur Maladresse, sauvegarde Solide) ; **Pratique/Peu Fiable** (±1 DR sur un jet **RATÉ** → en mêlée opposée, change l'issue **ET** les dégâts via le DR net).
    - **Phase C1a — Armure (synchrone)** : PA dérivée **nette des dégâts** (`damageArmour` unifié héros-pièces / ennemis-plat) ; **Déviation Critique AUTO des ennemis** (sacrifie 1 PA, ignore le Critique) ; **Taille** (arme endommage l'armure frappée) ; **Bâclé-armure** (un Critique à sa localisation la brise).
  - **✅ C1b + C2 LIVRÉS (2026-06-07, 1118 tests verts)** → **#1 Qualité d'objet COMPLET** : **C1b** modale de Déviation côté **JOUEUR** (suspend re-entrant `applyAttackResult`→`pendingDeviation`, `DeviationModal` ; sous-attaques en `deviated=false` anti-imbrication) ; **C2a** Pratique/Peu Fiable & Bâclé **hors combat** (`Effect.test.tool`→`itemUid`, ±1 DR sur jet raté repêche un échec gated `requireSL`, casse Bâclé sur Maladresse) ; **C2b** **pénalités de port d'armure** (Discrétion/Perception — **déjà dans la donnée**, parsées par `wearPenalty.ts` → `skills.ts:testValue`, modulées Pratique/Peu Fiable) ; **C2c** **Laid −10 Soc** (`QualityDef.socMod` → `qualitySocMod` → `wornSocialMod` → testValue). *(Reste optionnel, plus tard : **C3** Atouts/Défauts d'armure intrinsèques (Flexible/Impénétrable/Partielle/Points Faibles) · **UI** badges de qualité (fiche).)* Plans : `docs/superpowers/plans/2026-06-07-qualite-objet-phase{C1b,C2a,C2b,C2c}-*.md`.
- **#T — Temps & Voyage** *(NOUVEAU sous-projet, **avant le Marchand** — spec `docs/superpowers/specs/2026-06-07-temps-voyage-design.md`)* : système d'**horloge + voyage**, prérequis du re-stock marchand / Fatigue de voyage / guérison. **Greenfield** (aucune horloge ; les transitions de scène existent mais sans coût-temps). Décomposé :
  - **#T1 — Horloge & Calendrier impérial** *(plan prêt : `docs/superpowers/plans/2026-06-07-temps-voyage-phaseT1-horloge.md`)* : module pur `clock.ts` (**calendrier impérial extrait+vérifié de la source FR** — EiS Annexe 3 + croisements ; 12 mois, 6 intercalaires, semaine de 8 jours ; écart canon 400/401 documenté), granularité **date impériale + heures**, **« tout est horodaté »** (chaque action appelle `advanceTime`), état `gameTime` + table `TIME_COST` + affichage HUD. Départ campagne = **fin Jahrdrung 2512 CI**.
  - **#T2 — Voyage** : graphe de lieux + distances + coût-temps (vitesse = Mouvement, RAW Déplacement) + rencontres + repos.
  - **#T3 — Cascade RAW** : ce que le temps déclenche — guérison (LDB 18), Fatigue/Exténué, maladies (LDB 20), Corruption, **re-stock marchand**.
- **#2 — Marchand** *(CADRÉ mais **PARQUÉ** derrière Temps & Voyage — décisions en **annexe** de la spec temps-voyage : v1 transactionnel #2a (monnaie `bronze`↔`brass`) + #2b (UI achat/vente) + #2f (éditeur) ; **rachat 10 % paramétrable** — aucune règle RAW, LDB 59 « achat/vente optionnels » ; **scopé par catégorie** (herboriste ≠ arquebuses) ; archétype = 6ᵉ famille `defs/` ; **time-ready** — re-stock branché une fois #T en place)* (étend **Jalon 5** « achats/marchandage, fabrication ») : pérenne et
  **paramétrable dans l'éditeur** (famille de registre + override par entité) ; **Disponibilité**
  RAW (% par taille de colonie, LDB 59) ; **Marchandage** = Test opposé (gagner −10 % / **−20 % si DR
  net ≥ 6 ou talent Négociateur**, LDB 60), **un jet par transaction VERROUILLÉ** (anti-abus de
  re-tirage) ; **Évaluation** (révèle la qualité cachée ; estime ±10 % Rare/Exotique) ; **achat/vente**
  (revente ½ prix, LDB 60) ; **réparation d'armure** (10 %/PA, LDB 63) ; `spendMoney`. Inventaire
  par **liste** ou **catégorie auto-gérée**, `restockOnVisit`.
- **#3 — Arène** (banc d'essai du marchand) : vagues croissantes + interlude marchand (restock par
  vague) + loot.

**Choix assumés / non-RAW** (défaut = RAW ; tracés §10 de la spec) : **Raffiné** = aucun effet
mécanique (RAW muet, juste prix/dispo/affichage) ; **Volumineux / Fatigue ×2** modélisé a minima ;
**Déviation IA** = dévie toujours (décision utilisateur) ; knobs marchand non-RAW (multiplicateur de
prix, override de remise, toggle marchandage) **avec défaut = comportement canon**.

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
- ✅ **Avancement — MOTEUR** (`engine/advancement.ts`, testé, verbatim LDB Carrières l.31-137) :
  coûts d'Augmentation Caractéristique/Compétence par bandes de 5 (25→520 / 10→440), **hors-carrière ×2**,
  Talents (100 + 100×déjà-acheté), **changement de carrière** (complétion = 5×niveau d'Augmentations,
  100 PX si complété / 200 sinon). Champs `xp`/`charAdvances`/`careerLevel` ajoutés.
- ✅ **Avancement — CÂBLAGE + UI** (fait) : **détection in-carrière** depuis `careerLevels.json`
  (`engine/advancement.ts` `inCareerChar/Skill/Talent` + vue `state/advancement.ts`), **actions store**
  testées (`grantXp`, `buyCharAdvance` avec recalcul des Blessures, `buySkillAdvance` qui **acquiert**
  une compétence de carrière non connue, `buyTalent` refusé hors-carrière l.97, `changeCareer`),
  **Effet de scène `giveXp`** (octroi groupe, éditable) et **fiche en onglets Fiche / Avancement**
  (`CharacterSheet.tsx` : PX, achat in/hors-carrière, complétion de niveau, changement de carrière).
  Restent : richesse initiale, détails physiques, noms (création) ; octroi auto d'XP par victoire/jalon.

## 🎯 Jalon 4 — Campagne « L'Ennemi Intérieur » (contenu)

- ✅ **Chapitre 2 — « Du Sang Sur la Route »** (`tome1-route.ts`, sourcé du ch.2 « Erreur sur la
  personne ») : l'embuscade canonique sur **une carte multi-rencontres** — Rolf Hurtsis puis la
  bande de Knud (statblocks **verbatim**, mutations par brigand), **XP/butin par rencontre**
  (`onVictory`), **corps cherchables** (les 2 lettres + cotte de mailles + XP de découverte),
  patrouilleurs de Pflaster (dialogue social). Test d'intégration vert.
- **Reste — le vrai Chapitre 1** (soirée à l'auberge : Gustav, Isolde, Phillipe + partie de cartes,
  inspection de la diligence, Document 1, départ) — **0 combat obligatoire**, social. ⚠️ `tome1-intro`
  actuel n'est qu'une **démo** walk-to-trigger, pas le vrai Ch.1.
- Puis Tomes 1-3, en s'appuyant sur `tome1-dossiers.json` et **l'éditeur** (tout est éditable).

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
  intérieurs sans toucher `campaign[]`). ✅ **Éditeur de statblocks** (`StatblockEditor.tsx` : nom, 10
  caractéristiques, M/B, dégâts d'arme, armure ; câblé à `spawn.ts` via `statblockToCombatant`).

## 🎯 Jalon 7 — Coop en ligne

- Du hotseat au **réseau** (WebSocket ou WebRTC). **RNG de combat seedable** (`store.seedRng`,
  Jalon 0.6) + état sérialisable déjà en place.

## 🎯 Jalon 8 — Polish & production

- ✅ **Rig 2D squelettique + apparence composable** (`src/gameIso/rig/`, pur + testé —
  **17 fichiers de test, 129 tests verts**) : squelette FK par espèce/morpho (**6 espèces jouables** :
  Humain, Nain, Halfling, Elfe, Ogre, Gnome) + kinematics (matrices d'os) + tweens (easing),
  **résolution par calques** (`composeAppearance` → 9 slots : visage/cheveux/tête/torse/bras/jambes/
  arme/bouclier/mutations) avec **fallback** sur le sprite monolithique du bestiaire.
- ✅ **Équipement visible** (`rig/parts/equipment.ts`) : armes (épée/hache/masse/dague/lance/bâton/
  arc/arbalète…) **et** armure par localisation, composées sur le rig depuis le `Combatant` —
  « l'équipement se voit » enfin. **Tenues par carrière** (`rig/parts/career.ts` : 8 classes, override
  manuel détaillé pour la Garde).
- ✅ **Animations par clips** (`rig/anim/`) : 9 clips de base (idle/walk/melee/ranged/cast/dodge/
  parry/hit/fall) **+ clips par groupe d'arme canonique** (attaque/parade/pose portée — escrime,
  deux-mains, hast, arc, arbalète…) **+ clips de sorts** (bolt offensif vs bénédiction) **+ clips
  d'ambiance** (mutant qui dévore, hurlement…) pilotables depuis l'éditeur (`SceneEntity.anim`).
  Réactivité par le bus (`ANIM_MOVE`/`ATTACK`/`IMPACT`).
- ✅ **Orientation-monde persistante — refonte (2026-06-07, livrée + poussée)** : l'orientation des persos
  est désormais une **donnée MONDE** `Dir8` (8 directions) — vivante dans le store + `SceneEntity.facing`
  (authored, **éditable**) — **projetée au rendu** par `project(dir, camRot)` recalculée à **chaque rendu**.
  Conséquences : **tourner la caméra ré-oriente les sprites** (bug corrigé), et les combattants **gardent leur
  orientation au repos** au lieu de toujours regarder la caméra (au spawn : face à l'ennemi le plus proche ;
  attaquant→cible ; **défenseur→attaquant** ; marche/charge/exploration ; entités d'ambiance authored). Fin du
  facing **écran éphémère** (plus de `useState` par token recalculé sur event). Snap 8→3 vues d'art (front/dos/
  profil) + miroir, héros **et** monstres ; **32 cas de projection testés** ; **sélecteur « Orientation » 8-dir**
  dans l'éditeur de scène. *(Pur : `src/state/dir8.ts` + `rig/facing.ts`. Coquille de positionnement **unique**
  `BodyToken` (4 wrappers → 1) + **classifieur `pickBackend`** (4 sites de dispatch → 1 ; `token`/`tokenNode`/
  `EntityToken` l'utilisent). **Non-bipèdes d'exploration animés + orientés** (fin de l'asymétrie sprite figé ;
  bug éditeur quadrupèdes corrigé). **Fusion des 2 moteurs d'anim rig/plan ÉCARTÉE** (verdict adversarial :
  asymétrie essentielle clips-rig vs poses-plan ; toute interface unique serait lossy/leaky). Legacy retiré :
  rendu monolithique combat, `hasCreatureViews`, `planStaticSvg`.)*
- ✅ **Sprites de carrières** : assurés par le **rig** (apparence = espèce + tenue de carrière + morpho
  + équipement) — plus de spritesheet figé par carrière à dessiner.
- ✅ **Reprise des sprites de bestiaire ratés (galerie QC)** — régénérés via workflow
  best-of-2 (lecture art officiel + desc canon + consigne silhouette) : ~52/57 redessinés,
  fin du vert mutant par défaut, silhouettes reconnaissables.
- ✅ **Gros ailés rapatriés dans le rig** : **Dragon** (déjà), **Manticore / Varghulf** (Jalon 0.10) rendus
  par le gabarit **winged** — plus de sprite monolithique pour eux. Restent monolithiques seulement les formes
  hors gabarit (serpent, araignée, pieuvre, hydre…).
- **Reste (fin)** : ✅ vues **dos/profil héros** (visage + cheveux par archétype — `cosmetic.ts` ;
  nuque/profil corrects, plus de « visage à l'arrière du crâne » ; vérifié `_qc-hero-views`/`_qc-head-views`),
  reste les tenues/armes héros partielles en fallback front ; ✅ **tintage arcane/divin** des sorts
  (`spell: label` sur `ANIM_ATTACK` → `spellFx`/`spellFxForLabel`, gradients `g_arcane`/`g_divine` ;
  projectile + halo de canalisation du lanceur + aura de bénédiction tintés ; sorts de soutien animés ;
  vérifié navigateur) ; proportions Mutant homme-chien/tentacule perfectibles ; **UI d'override cosmétique**
  dans l'éditeur (slot-picker + 🎲 seed) ; **galeries QC** (rig/anim/armes/bestiaire) à finaliser et committer.
- Sons & musique, accessibilité ; ✅ **code-splitting** (éditeur/rendu lazy) ; ✅ **CI** (tests+build ; lint à venir).

---

## Dette technique connue

### Reste à faire — synthèse *(màj 2026-06-05 — vérifié contre le code)*

- ✅ **Avancement XP — boucle complète** : moteur **+ câblage store** (grant/dépense/détection in-carrière) **+ panneau UI** (onglets Fiche/Avancement) **+ Effet `giveXp`** **+ octroi à la victoire éditable** (`EncounterDef.onVictory` → `applyEffects` au groupe, **authorable dans l'éditeur de rencontres** « À la victoire ») **+ octroi par jalon** (`giveXp` dans triggers/dialogues). Tout testé (engine + vue + actions store + rendu + éditeur).
- ✅ **Butin / fouille par corps** (fidèle au ch.2 « Erreur sur la personne » — butin curé par cadavre sur carte multi-rencontres) : **objet cherchable** (`SceneEntity.search: Effect[]` — reste en place, fouillé une fois) + Effets **`giveXp`** (XP de découverte), **`giveTrapping`** (vrai objet à stats sur un héros, équipable depuis la fiche), `giveMoney`/`document`. Spoils de combat → **`EncounterDef.onVictory` par rencontre** ; butin trouvé → objet cherchable **par corps** — **rien n'est global à la scène**.
- ✅ **Consommables en combat** : action **« 🧪 Utiliser »** dans la hotbar (`battleUseItem` + `engine/consumables.ts`) — effet **parsé du `desc`** du trapping (LDB p.307) : Potion de guérison = soin du **Bonus d'Endurance**, Potion de vitalité = retrait de l'État **Exténué** ; objet consommé, coûte l'Action ; liste groupée (plusieurs potions → ×N). *(`giveItem` party-level (noms) inchangé.)*
- ✅ **Modales de jet lisibles + incantation** : la modale montre les **DEUX côtés du Test opposé**
  (base + modificateurs = cible · d100 · DR de l'attaquant ET du défenseur — fini « un seul chiffre »),
  l'**incantation a sa modale** (`pendingCast` : Lancer → NI/DR/Maladresse → Chance → Appliquer), et le
  **tir interdit en Combat rapproché** (Atout Pistolet, LDB l.297-298 ; `attackWeapon` + IA).
- **Combat — reste** : ✅ **« ramasser » en plein combat** (un objet au sol *à la fois*, réutilise `objet`/`search`, persiste party — `battlePickup`) ; ✅ **Chance étendue** : relance **1×/Test sur jet propre raté** (fix de 2 bugs), **+1 DR** cumulable, **Détermination** = retirer un État (+1 PB si À Terre, n'importe quel État : Surpris/À Terre/Hémorragique…). ✅ **Blessures critiques & mort** (LDB 18-Traumatisme : 0 PB ≠ mort → À Terre→Inconscient→mort si critiques > BE, overkill/double, tables par localisation, Mort Subite figurants ; `isOutOfAction` corrigé). ✅ **Destin/Résilience sacrifiés** (« Comment ça a pu rater ? », « Meurs un autre jour », « Je ne faillirai pas ! » ; `pendingFateSave`/`outOfRencontre`). ✅ **Munitions + rechargement (héros)** : munition = équipement avec **choix joueur**, tir = **arme + munition** combinées (1 consommée/tir), **Recharge N = Test étendu de Projectiles par modale** (`pendingReload`, cumul de DR jusqu'à l'Indice ; Arc tire chaque Round). ✅ **Maladresses** (Tableau des Oups !, modale héros / instant ennemi / défenseur couvert, Incident de Tir). ✅ **Table Difficultés de Combat** (Ligne de Vue, Couvert 3 niveaux, Combiner −30/+60, obscurité/météo, tir-en-bougeant, tir-dans-la-mêlée + redirection ; **Taille T0+T1** size-to-hit + plus-petit). Reste : munitions ennemies / achat / récupération (Jalon 5) ; grisage visuel des cibles hors-LdV (recette). *(✅ 3ᵉ usage de la Chance — pré-emption d'initiative — fait.)*
- **Simplifications IA assumées** (mineures, documentées) : l'IA **ne se désengage pas** ; l'IA **charge en portée de Marche** (pas de Course).
- **Vérif NAVIGATEUR — dette du cycle** : toute l'UI livrée cette session est **couverte par tests/typecheck mais jamais vue en live** (profil Playwright monopolisé par la session rig parallèle). À repasser à l'œil : modales attaque/**détail des jets opposés**/défense/**incantation**, **panneau Avancement** (achat de PX), action **« Utiliser »** (potions), **fouille** de corps, éditeur **« À la victoire »**, scène **Chapitre 2**, hotbar, Engagé/Charge. *(Penser au **hard reload** : le HMR du dev se périme souvent.)*
- ✅ **Sprites/animations** (Jalon 8) : **rig 2D composable** livré et testé (équipement visible, tenues de carrière, facing 8-dir, clips par-arme/sort/ambiance ; 17 fichiers de test, 129 tests verts). ✅ **Système d'arme complet (Jalon 0.11)** : maniement clé sur la forme + prises 2-mains, **48 armes au registre** (1 fichier/arme), **couleur tokenisée + skins légendaires** (backend `Weapon.skin`/`ItemInstance.skin`), tenues normalisées, **silhouettes reconnaissables à l'aveugle** (audit + regen best-of-N), ✅ **éditeur de skin d'objet (ARME + ARMURE)** dans la fiche perso (bouton ✨ → aperçu live recoloré + sélecteurs de couleur ; armure tokenisée + `ARMOUR_PALETTES` ; validé navigateur). ✅ **vues dos/profil héros** (cosmetic.ts, nuque/profil corrects) + ✅ **tintage arcane/divin** des sorts (`spell` sur `ANIM_ATTACK` → `spellFx`, gradients `g_arcane`/`g_divine` ; projectile/halo/aura tintés ; validé navigateur). ✅ **Orientation-monde persistante** (2026-06-07) : Dir8 monde projeté au rendu (`project`+camRot) → **rotation caméra ré-oriente**, repos stable (face ennemi/attaquant), éditeur 8-dir, coquille **BodyToken** unifiée, **classifieur `pickBackend`** (4 sites de dispatch collapsés), **non-bipèdes d'exploration animés + orientés** (fin de l'asymétrie sprite figé ; `planStaticSvg` retiré), legacy monolithique retiré. **Fusion des 2 moteurs d'anim ÉCARTÉE volontairement** (verdict adversarial : asymétrie essentielle clips-rig vs poses-plan closed-form ; toute interface unique serait lossy/leaky ; bus reste par-backend). Reste **fin** : tenues/armes héros dos/profil partielles, Dragon/Manticore (hors rig), galeries QC à finaliser.
- **Contenu jouable** (Jalon 4) : ✅ **Chapitre 2** « Du Sang Sur la Route » livré et testé ; reste le vrai **Chapitre 1** social (auberge) — `tome1-intro` actuel n'est qu'une démo walk-to-trigger.
- **Persistance** (Jalon 5) : sauvegarde/chargement (localStorage + export/import).
- **Dette « qualités/traits en données sans code »** *(relevé 2026-06-07, via workflow d'inventaire)* :
  **22 qualités d'arme** (Lente, Imprécise, Dévastatrice, Percutante, Perturbante, Immobilisante,
  Protectrice, À Répétition, Dangereuse, Épuisante…), **4 qualités d'armure** (Flexible, Impénétrable,
  Partielle, Points Faibles) et **90+ traits de créature** (Peur/Terreur, Régénération, Souffle, Venin,
  Vol, Éthéré, Frénésie…) existent dans `data/qualities.json` / `data/traits.json` **sans implémentation
  en code**. Le **registre de qualités** (Jalon 1.6 Phase 0) en absorbe une première partie (qualités
  d'arme/armure/artisanat) ; le reste = **backlog** à brancher comme **entrées de registre** au fil des
  besoins (la Psychologie — Peur/Terreur — est aussi un prérequis de la Taille T5, Jalon 1.5).

### Dette « historique » (détail)

- ✅ **Sprites par équipement reflétés** : le **rig 2D** compose arme + armure depuis le `Combatant`
  (`gameIso/rig/parts/equipment.ts`) — fini les sprites figés par carrière.
- Sprites de bestiaire **régénérés** (workflow best-of-2, fidélité silhouette + palette) ; les gros
  ailés (Dragon, Manticore, Varghulf) sont désormais **riggés** (gabarit winged, Jalon 0.10) — restent
  perfectibles en proportions ; le Mutant (homme-chien/tentacule) reste le sprite le plus perfectible.
- **Apparences par calques** : le **rig 2D** (`gameIso/rig/`) enrichit désormais **6 espèces jouables**
  (Humain, Nain, Halfling, Elfe, Ogre, Gnome) + calques de mutation au seed ; le reste du bestiaire
  reste en sprite unique (fallback). Proportions des morphologies mutant **homme-chien / tentacule**
  encore perfectibles (corps « ballon », jambes fines) ; vues **dos/profil** des parts héros partielles.
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
