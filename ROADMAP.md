# Feuille de route — RPG Warhammer Fantasy v4 (web)

Statut au 2026-06-10. Architecture **data-driven** : moteur de règles pur + testé,
schéma de Scène unique partagé éditeur ⇄ runtime ⇄ campagne, base générée depuis
les sources. Rendu **isométrique SVG** (React), pas de Phaser, **+ bascule vue du dessus
(grille carrée) en jeu et éditeur** (Jalon 0.15). Dépôt : `cgauche/game`.

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
  *(⚠️ couche calques **et** sprite monolithique retirés depuis — cf. Jalon 0.12 : tout passe par le rig.)*
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
  pieuvre, hydre, squig, basilic…). *(⚠️ depuis : ces formes ont reçu leur gabarit ; le monolithique est
  **entièrement retiré** — cf. Jalon 0.12.)*
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

## ✅ Jalon 0.12 — Tout le bestiaire au rig ; retrait des couches de rendu legacy *(fait — 2026-06-08)*

Consolidation : **un seul moteur de rendu d'entité, le rig** (`pickBackend` → rig bipède humanoïde /
gabarit corporel animé / sprite **de décor**). Les deux couches de rendu legacy, devenues mortes une
fois les 57 créatures passées au rig, sont **supprimées** — non-régression vérifiée.

- **Vérité-terrain** (classifieur réel `classifyEnemy`+`bodyPlanOf` sur les 57 entrées) : **57/57
  court-circuitées** — 29 → rig bipède (Humain, Nain, Orc, Gobelin, Goule, Squelette, Zombie, Vampire,
  Minotaure, Géant, Troll, Ogre…), 28 → gabarit rigué (quadrupède 8, ailé 8, spectral 3, jabberslythe 3,
  +arachnide/aviaire/céphalopode/serpentin/squig/amorphe) ; **zéro** créature ne résout en `'monolithic'`.
- **Couche d'apparence PAR CALQUES retirée** (commit `84bef1d`) : `composeAppearance` /
  `CREATURE_APPEARANCES` / `appearanceLayers` / `creatureAppearances.ts` — mortes dans tous les chemins
  (humains/mutants modulaires composés par le rig, plus par swap de calques SVG). `appearance.ts` ne garde
  que `hashSeed` ; l'éditeur remplace les sélecteurs de variantes par le seul bouton de relance de seed.
- **Sous-système de sprites MONOLITHIQUE retiré** (commit `9bc1b1d`) : `creatureSprites.json` (57 sprites) /
  `creatureViews.json` / `enemySprite` / `creatureView` / `creatureNames` / `mutantStand` supprimés.
  **`entitySprite` réduit au décor** (props → `propSprite` ; villageois en filet). Picker d'apparence éditeur
  re-sourcé sur `creatureSpeciesNames()` (defs rig). Le **dernier chemin vivant** vers `enemySprite` était
  l'**aperçu de l'inspecteur éditeur** (fonction locale `entitySvg`, qui ne détournait QUE le quadrupède) —
  re-sourcé sur `pickBackend` (mêmes backends que le canvas). 11 scripts caducs supprimés (QC + ingestion mono).
- **Vérification** : workflow de cartographie + **vérif d'atteignabilité adversariale** (5 agents) avant toute
  suppression ; recette **browser-free** via le vrai `pickBackend` (0 créature → backend `sprite` ; décor reste
  `sprite`) ; **typecheck 0, 1497 tests verts**, poussé. *(Reste : recette navigateur visuelle des pixels
  d'aperçu — Playwright partagé verrouillé par une session //. ⚠️ « passe par le rig » ≠ bonne silhouette :
  quelques bipèdes — Minotaure, Fimir, Rat ogre — restent à QC, chantier séparé `game-bestiary-sprite-bar`.)*

## ✅ Jalon 0.13 — Apparence bipède en registres « Gabarit × Race » ; pilote Ogre + tells *(fait — 2026-06-08)*

**But** : l'apparence d'un bipède était **centralisée et rigide** (proportions dans `PROPS`, peau dans
`SPECIES_PALETTES`, posture dans `SPECIES_POSE`, config d'espèce sur les defs créature) → créatures
samey, et **l'Ogre cassé** (son gutplate = un disque/dalle flottant). On range tout en **2 registres** :
une créature = **Plan × Gabarit (carrure) × Race (peau/tête/traits/posture + défauts) × Perso**, composé
à plat par id. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-08-rig-races-gabarits-*.md`.

- **Garde-fou central : golden master** (`rig/golden/biped-golden.test.ts`, commit `80ed017`) — snapshot du
  SVG résolu de **26 espèces bipèdes × front+profil + cas héros équipés** (os arme/bouclier, palette,
  couleurs, pose mêlée). Toute la dissolution des tables est **iso-rendu (0 snapshot modifié)** ; seuls
  l'Ogre + les races « tells » bougent **intentionnellement** (`-u` + diff vérifié à la ligne près).
- **Registre Gabarit** (`rig/gabarits/defs/`, 13 carrures) — dissout `PROPS` ; `baseSkeleton` lit un
  `GabaritDef` (au lieu de `PROPS[baseSpeciesOf]`). `baseSpeciesOf` **reste le canonicaliseur** (string
  espèce → 1 des ~20 id de race, gère les variantes héros « Hauts Elfes »/« Nains (Norse) »).
- **Registre Race** (`rig/races/defs/`, ~22) — dissout `SPECIES_PALETTES` (fichier généré supprimé,
  `racePalette(id,sex)` + variante `paletteF`), `SPECIES_POSE`, et la config `biped` des defs créature
  (`bipedConfig`/`BipedConfig` **supprimés**). `composeRig` résout via `raceById(baseSpeciesOf(species))`.
  Les defs créature se réduisent à `{plan, race?, gabarit?, perso?}`.
- **Features échelonnées à l'os** (`scale:'bone'|'fixed'`, `featureToPart`) — une feature `scale:'bone'`
  hérite de l'échelle de l'os qu'elle habille → elle **REMPLIT le corps** (correctif du disque flottant) ;
  `'fixed'` = enveloppe d'échelle inverse (taille constante).
- **Pilote Ogre réparé + enrichi** : `head:'ogre'` + features (panse+plastron qui remplit le ventre,
  heaume cornu, brassards de plates couvrant les bras-moignons brute). **Audit aveugle 3× = « ogre »
  conf 4/5** (méthode QC `docs/qc-reconnaissabilite-sprites.md` réécrit pour le rig + `scripts/_qc-creatures-rig.mts`).
- **Tells de race** (changements volontaires, golden ciblé) : **Nain** barbe ancrée à la mâchoire (5/5),
  **Haut-Elfe/Elfe sylvain** oreilles pointues au niveau joue (4/5), **Guerrier du Chaos** = race dédiée
  (plastron sombre à étoile + cornes, plus « soldat de l'Empire », 4/5), **Mutant** cornes+œil+tentacule
  garantis (5/5). Piège attrapé : Démonette retombe sur la race **Démon** via `baseSpeciesOf` (préfixe).
- **Migration des 12 races restantes hors du champ `monster`** → `head`/`legs`/`armG`/`armD`/`features`
  (+`dropHeadgear` vampire), **iso-rendu (golden 0 modifié)** ; garde `hasPersoMonster` = un `perso.monster`
  non-vide override intégralement la race. `RaceDef.monster` retiré. Le champ `monster`/`monsterInjection`
  **reste pour l'éditeur + créatures scriptées + 3 perso** (Fimir/Liche/Démonette).
- **Nettoyage legacy** : overlays morts `OV_VENTRE`/`OV_COTES` + champs `ventre`/`cotes`/`RaceFeature.anchor`
  supprimés ; bridge temporaire `gabaritForSpecies` retiré ; table générée `speciesPalettes.ts` supprimée.
- **Revue finale opus** (correctness + dette legacy) : 0 bug actif. **Suite complète 1760 tests verts,
  typecheck 0**, poussé sur `feat/wfrp4-rpg-foundation`. *(Reste hors humanoïdes : **SP2 quadrupèdes**
  — longueur de pattes + corps par espèce + vue profil + tête de loup ; **SP3 sous-espèces**.)*

## ✅ Jalon 0.14 — Refacto maintenabilité : dé-duplication des flux de jet, découpe des monolithes *(fait — 2026-06-09)*

Refacto **iso-comportement** (suite complète = harnais, zéro assertion modifiée) ciblant la dette
structurelle accumulée par l'empilement des jalons. Tout est committé par phase, suite verte entre chaque.

- **Fabrique des flux de jet différé** (`state/rollFlow.ts` + specs `state/rollFlows.ts`) : le cycle
  Lancer → Chance (relance 1× sur jet propre raté / +1 DR) → Résilience → Appliquer était copié-collé
  par flux (~60 actions quasi identiques). **11 flux migrés** (trample, run, focus, psych, frenzy,
  reload, recover, test, appraise, bargain, heal) — un nouveau jet = **1 spec + 1 `xConfirm`** (le
  métier reste manuscrit). Les flux multi-phases (attack/defense/cast/disengage/fumble) restent
  dédiés (sur-abstraction refusée). Garde-fou `roll-modal-invariant` étendu (`FLOWS.*` = primitive).
- **Coquille de modale partagée** (`ui/RollFlowShell.tsx` + `<Dice>`) : les 11 modales de jet ne
  portent plus que leur contenu (titre/sous-titre/verdict) — DOM rendu inchangé ; la Chirurgie
  (Test étendu multi-passes) garde son flux dédié.
- ✅ **Panneau de jet unique** *(2026-06-11, merge bundle `7bf1b5c`)* : refonte pro des modales —
  `RollPanel` (même géométrie avant/après le jet, l'avant-jet = le résultat pré-rempli ; ligne
  adverse limitée à portrait+compétence+mods), `VsHeader` (en-tête A → B), `TableRollLine`
  (d100 sur table : Oups!/Critiques/Imparfaites), **ciblage champ de bataille** `TargetPrompt`
  (Frappe Mortelle, 2ᵉ frappe, Surincantation — CleaveModal/DualStrikeModal supprimées),
  Détermination-retire-un-État pré-jet (`spendResolveCondition`, LDB 17 l.62-66), Sombre Pacte
  partout. **Regreffes à l'intégration** : Échap/onClose par modale (a11y), `freeReroll` (L9),
  et **`InfluenceRow` partagé** (la rangée Chance/Pacte/Garantie était copiée-collée dans
  Attaque/Défense/Incantation/Désengagement — l'acteur est passé une fois, `freeRerollOf` calculé
  dedans). Recette navigateur : défense montée 30+50=80 décomposé, DR net, Échap par invariant.
- ✅ **Créateur : responsive + finition** *(2026-06-11, `e520826`)* : fiche-bandeau compacte ≤700px
  (stats masquées — l'étape 3 et le Récap les montrent), footer en 2 rangées propres (message de
  validation pleine largeur au-dessus, Précédent ⟷ Suivant sur une ligne), labels AU-DESSUS des
  champs (`.zone-section label:has(…)`), **panneau d'apparence refait** (grande figurine 184-250px,
  champs en grille, couleurs en grille de pastilles rondes — fini les 7 longues rangées),
  lignes de compétences alignées (`.skill-adv` sans display). Vérifié 360/700/1280/1440.
- **Store découpé en modules `(get,set)`** (patron combatFlow) : `pendings.ts` (types Pending*,
  ré-exportés), `partyFlow.ts` (équipement/avancement/consommables/butin), `merchantFlow.ts`
  (réassort/panier/transactions/Marchandage/Évaluation + types `MerchantState`/`MerchantStocks`).
  **store.ts : 3512 → ~2380 l.**, API d'actions inchangée (tests intacts).
- **Editor.tsx découpé** (1547 → ~790 l.) : `useSceneHistory` (undo/redo), `useEditorView` (caméra
  Q/E/molette/pan via viewBox), `tools.ts` (Tool/Rect/Layers), `Palette.tsx` (volet gauche),
  `Inspector.tsx` (volet droit) — + **test de fumée du rendu** (`Editor.test.tsx`, l'éditeur n'en avait aucun).
- **IsoStage.tsx allégé** (858 → ~670 l.) : FX de combat extraits dans `gameIso/fx/`
  (`useCombatFx` flottants/projectiles/halos/zones + `FxLayer` + `useWalkAnim`).
- **Nettoyage** : lint projet à **0 erreur** (5 erreurs préexistantes corrigées), imports morts purgés,
  alias `@deprecated carryPose` retiré (scripts QC migrés sur `weaponRest`), warnings de `src/state` purgés.
- **1962 tests verts, typecheck 0, lint 0 erreur.** Carte d'architecture de `CLAUDE.md` mise à jour.

## ✅ Jalon 0.15 — Vue du dessus (mode bascule) + caméra tactique libre *(fait — 2026-06-10)*

**Vue du dessus** orthogonale (grille **carrée**) en **mode bascule** à côté de l'iso, en **jeu ET
éditeur** — pour la lisibilité tactique. Spec/plan : `docs/superpowers/{specs,plans}/2026-06-10-vue-du-dessus*`.

- **2ᵉ axe de projection `view: 'iso' | 'top'` sur `Dims`** (exactement comme `rot`, Jalon 0.9) — couture
  **unique** dans `gameIso/iso.ts` : `tileCenter`/`diamondCorners`/`screenToTile`/`stageSize`/`depth`/`originX`
  branchent dessus (cases carrées `CELL=56`, picking carré, profondeur par rangée). Jeu **et** éditeur en
  héritent ; **`rot` + zoom continuent de marcher**. Purs + testés (`iso.test.ts`, les 2 modes × 4 rotations).
- **Acteurs → pion-portrait** (disque façon VTT) : `pickBackend(subject, view)` rend en `top` la **vue de
  face cadrée sur le visage** (`faceFrame` typé) + `flat:true` ; `BodyToken` gagne un **mode `flat`** (disque
  clippé centré, anneau circulaire, mort estompée), badges PV/icônes **partagés** avec l'iso (zéro dup). Le
  décor reste billboard. **`RigPortrait` (HUD) consomme la même `pickBackend(_, 'top')`** → cadrage visage
  **dé-dupliqué**. Monté en `top` = cavalier+monture en 2 pions distincts (composite iso seulement).
- **Décor iso-extrudé rendu à plat** en `top` (sinon « mal orienté / illisible » sur la grille carrée) :
  **murs** (`wallBlock`) = bloc plein aligné sur la case ; **bâtiments** (`buildingObj`) = plan toit + **contour
  de murs épais + porte + NOM du bâtiment** au centre du toit → il se lit comme une structure, pas des tuiles.
- **Bascule par surface** (comme zoom/rot) : store **`viewMode`/`toggleViewMode`** (jeu, préservé au reset),
  **`useEditorView.viewMode`** (éditeur) ; **bouton dans `ViewControls`** (partagé jeu↔éditeur), à droite du `+`.
- **Caméra tactique libre** (retour live) : **dézoom élargi** (plancher zoom 1 → **0.4**) ; **panoramique au
  glisser** (`camPan` au store ; seuil 6 px → le clic est **différé au relâchement** : tap = clic, glisser =
  pan) ; **refocus auto sur l'unité active** au changement de tour (`resetCamPan`). Retrait de la `date-chip`
  HUD (doublon du menu).
- **~2065 tests verts, typecheck 0** ; vérifié au navigateur (combat + éditeur en `top` : grille carrée,
  pions-portraits, murs/bâtiment alignés, dézoom, 0 erreur console). Committé sur `feat/wfrp4-rpg-foundation`.

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
- ✅ **Attaques naturelles de créature pilotées par les Traits** (`engine/creatureAttacks.ts`, pur ;
  LDB `85`) : chaque Trait d'attaque = une attaque distincte avec ses règles RAW. **Gratuites** (coût en
  Avantage, n'entament pas l'Action, Test **opposé** → modale `pendingDefense` côté héros, IA en file
  résumable à travers les modales) : **Morsure** (1 Av), **Attaque caudale** (1 Av ; cible plus petite
  perdant des PB → À Terre), **Cornes** (à la Charge, sans coût). **De ZONE** : **Souffle** (2 Av, Test
  opposé CT/Esquive, Dégâts = Indice + effet par **Type** Feu/Froid/Corrosif/Électricité/Poison/**Fumée**)
  et **Vomissement** (Troll, 3 Av, BE+4 + Sonné + corrosion). **ACTION** : **Regard pétrifiant** (opposé
  CT/Init +Avantage, Sonné/Pétrifié selon la marge), **Étreinte glaciale** (opposé CC, ignore BE+PA),
  **Langue préhensile** (à distance, Empêtré), **Hurlement fantomatique** (Banshee, zone, Brisé +
  Assourdi). Modificateurs d'Atout : **Venin** (Empoisonné), **Constricteur** (Empêtré), **Vampirique**
  (soigne l'attaquant). **Poses d'attaque dédiées** (morsure/queue/cornes/souffle/vomi/regard) sur le rig
  quad/ailé ; **Piétinement** repassé en Test **opposé** (modale, plus de version passive).
- ✅ **Souffle (Fumée) → Ligne de Vue** : le Type Fumée « remplit la zone, bloquant les Lignes de vue
  pendant BE Rounds » — branché sur le **système de Ligne de Vue EXISTANT** (`lineOfSightCover` +
  `smokeZone`, `BattleState.smoke[]` à TTL décrémentée en fin de Round) : bloque tir/sort, psychologie
  et acquisition de cible IA ; la créature **immunisée à son propre Souffle** ne s'enfume pas.

## ✅ Jalon 1.5 — Sous-système Taille *(T2→T6 + Localisation par forme + Nuée + Agrandir/Réduire + Combat monté COMPLET — LIVRÉS ; audit RAW propre)*

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
  - *Limites documentées* : Phobie traitée comme un ciblé binaire (≈ Peur 1) ; afflictions ciblées re-testées tant qu'un membre du groupe est visible (pas d'auto-fin quand le groupe disparaît — effet résiduel nul) ; contrainte d'action **héros** = journal (pas de grisage des cibles dans l'UI). *(`socialPsychMod` a depuis reçu son consommateur — Tests de Sociabilité de dialogue/scène — et la Psychologie vaut désormais **hors combat** : cf. **Jalon 1.7**.)*

**Reste (lots à part, prochains jalons Taille — par valeur/effort) :**
- ✅ **Localisation par forme de corps** (`76 - Point d'Impact des Créatures` + `13` l.144) : `BodyShape` (humanoïde/quadrupède/oiseau/serpent/araignée) dérivée au spawn du gabarit rigué ; `hitLocationByShape` (serpent 01-19 Tête/20-00 Corps ; araignée 01-09 Tête/10-79 Pattes/80-00 Abdomen ; quad/oiseau = tableau humanoïde réétiqueté, mêmes Tableaux de Critiques) + `locationLabel` (membres antérieurs/postérieurs, ailes, patte, abdomen) ; appliqué en mêlée, Projectile magique, Coup Critique et tir fratricide. **Cible ≥ 2 cat. plus grande → choix de zone GRATUIT** (pas de −10 « Localisation visée », `76` l.39) ✅.
- ✅ **T6 — Footprint multi-cases des créatures** (`15 - Déplacement` l.55 : « 1 case = 2 m ; les plus grandes occupent **2, 4 ou même plus de cases** selon leur Taille » — pas de table canon → DESIGN ancré : Grande 2×2 [= les « 4 cases »], Énorme 3×3, Monstrueuse 4×4) : `state/footprint.ts` pur (`footprintTiles`/`occupiesTile`/`footprintChebyshev`/`combatDistance`) + `gameIso/sizeScale.ts` + `entitySize`. **Occupation relative au mover** (un grand traverse/dégage les plus petits, `85` l.308-309, `displaceSmaller`) ; **pathing par empreinte** (`reachable`/`pathTo` param `foot` — ne se faufile pas dans un goulet d'1 tuile) ; adjacence/portée/Engagement par empreinte ; **rendu centré + mis à l'échelle** (remplit ses N tuiles) + **picking** sur n'importe quelle tuile, en combat ET exploration/éditeur ; **aperçu d'empreinte** au survol de sélection (éditeur) ; scénario galerie re-positionné (size-aware) + démo Monstrueuse 4×4 ; **réservation N×N sur les points de spawn** (éditeur de rencontres). ~30 tests. *(Reste mineur : recette navigateur visuelle.)*
- ✅ **Nuée — Trait Essaim** (`85` l.199-200) : `Combatant.swarm` ; au spawn (trait actif) ×5 PB + 10 CC + immunité Psychologie ; en combat ignore TOUTES les règles de Taille, +40 au tir contre elle, Frappe Mortelle sur toute touche, départ libre (ignore l'Engagement), 1 PB/Round aux Engagés. Facultatif (aucune créature ne l'a actif) → s'applique à un statbloc rendu nuée.
- ✅ **Agrandir/Réduire** — « Utiliser les Tailles » (`85` l.276-277) : `stepSize` + `resizeBySteps` (±10 F/E, ∓5 Ag par catégorie) ; contrôle « Agrandir ▲ / Réduire ▼ » dans le StatblockEditor (change la Taille + les carac.).
- ✅ **Combat monté** (`14` l.212-225) — *COMPLET (les 7 ajouts du RAW), testé.* `state/mount.ts` (module-feuille pur) :
  - ✅ **Appairage cavalier↔monture** (`Combatant.mountId`/`riderId`/`mountable`), DYNAMIQUE ; le couple partage la position et l'**empreinte de la monture** (`displaceSmaller` n'éjecte jamais son propre cavalier).
  - ✅ **Monter / Descendre** en combat (`battleMount`/`battleDismount` + boutons ActionBar sous « Mouvement ») — enfourche une monture libre **du même camp** adjacente ; **aucun jet** (Chevaucher sans Test, LDB 09 l.99) ⟹ **pas une Action**, consomme le **Mouvement** (on peut donc enfourcher PUIS attaquer — *critère : tout jet = une Action*).
  - ✅ **Mort de la monture → cavalier DÉMONTÉ** (strict RAW : à pied, **pas de chute** — le canon ne définit aucune chute liée à une monture tuée) ; balayage `sweepDismountDeaths` centralisé dans `checkBattleOver` (toute cause : touche, sort de zone, mort lente, Nuée).
  - ✅ **Mouvement solidaire** : le cavalier se déplace au **Mouvement de sa monture** (l.215), le couple bouge ensemble (move + charge).
  - ✅ **Modificateurs** : **+20** cible plus petite que la monture (l.217, injecté via `env`) ; **−10** viser le cavalier en mêlée si plus petit que la monture (l.219) ; **−20 Esquive** du cavalier sauf Talent **Acrobaties équestres** (l.225).
  - ✅ **Pré-appairage au spawn** : `EncounterDef.enemies { mount, rides, side }` — cavalerie pré-montée (`rides` = index de la monture) + montures libres côté allié (`side:'ally'`). 9 tests verts (mount + mount-combat) + scénario de test **12-monture** (« Combat monté »).
  - ✅ **Rendu en selle — PROFONDEUR AU NIVEAU DE L'OS** (refonte 2026-06-08, remplace l'ex « petit soldat de face planté sur le dos »). Le couple est fusionné en **UN corps composite trié par OS** (`rig/composite.ts` `composeComposite` + 6 tests ; `rig/mountedRig.ts`) → jambe lointaine DERRIÈRE le barillet ET buste DERRIÈRE la tête, **simultanés** (impossible avec un tri par entité). **Layer monté dédié** (pas la pose à pied surchargée) : corps assis + **tenue d'arme par classe de maniement et par vue** (lance **couchée** vers l'avant, 1-main dressée…), **rênes = bras gauche**, jambes de face **symétriques** (angles miroir), **assise AUTO dérivée du dos réel** de la monture (os `tronc`) → s'adapte cheval↔loup et par vue. Hooks d'anim extraits (`useRigAnim`/`usePlanAnim`, anti-duplication). `MountedToken` branché dans `IsoStage` (un seul `BodyToken`, ombre partagée). **Bug bestiaire corrigé au passage** : sabot/patte du gabarit quad dessiné 22·ll SOUS l'os → détaché ; corrigé `rig/quadruped/quadParts.ts` (toutes les créatures quad). Typecheck + 1724 tests verts. QC headless : `scripts/_qc-monture-merge.mts`.
  - 🚧 **Reste sur le rendu monté** (la mécanique ET les postures sont complètes) : **clips d'ATTAQUE montés** (charge lance couchée, taille à cheval — pour l'instant le clip d'attaque À PIED est plaqué par-dessus la pose montée = approximatif) — **DIFFÉRÉ** (itération visuelle coûteuse en tokens) ; main qui flotte légèrement en profil (avant-bras non dessiné = trait pré-existant du rig, pas spécifique à la monture).
  - ✅ **Recette navigateur** *(2026-06-11)* : scénario 12 joué — cavalier rendu EN SELLE (selle, jambe proche sur le flanc, profondeur par os), empreinte 2×2, charge de cavalerie IA à travers la carte, modale de défense. **Bug RAW trouvé et corrigé** : le jet d'attaque IA figé pour la défense réactive (`maybeOpenDefense`) omettait TOUT l'`env` (+20 monté, Flanc/dos, Surnombre, météo) — l'attaque montée sortait nue (30) au lieu de 30+50 ; `attackEnv` désormais injecté dans le jet figé (parité `resolveAttack`), test store RED→GREEN.
  - ✅ **Champ éditeur** : `EncountersEditor` — case « Monture », liste « Chevauche » (pré-monter, par index), select « Camp » (Ennemi/Allié).
  - ✅ **Course montée** : à cheval, l'action Course se teste en **Chevaucher** (pas Athlétisme) et utilise le **Mouvement de la monture** (l.215).
  - ✅ **Ciblage** cavalier↔monture (l.219) : cliquer un couple en attaque/charge ouvre une **modale de choix** (`MountTargetModal`/`pendingMountTarget`) — frapper le cavalier (−10 déjà appliqué) ou la monture (l'abattre désarçonne). Ciblage déterministe.
  - ✅ **Charge montée — dégâts** (l.223) : sur une charge, les dégâts utilisent la **Force + la Taille de la MONTURE** (le toucher reste la CC du cavalier) — `dmgProxy` threadé dans le moteur, construit par `resolveAttack(fromCharge)`.
  - ✅ **IA** (l.215/221) : cavalier ennemi mû à la géométrie de sa monture (couple solidaire) ; monture montée sans *Nerveux* attaque de sa propre Action un adversaire au contact (sinon passe) ; un PNJ à pied non Engagé enfourche une monture libre adjacente de son camp.
  - ✅ **IA — charge** : un cavalier ennemi non Engagé fonce à la portée de **Course** (2× le Mouvement de la monture) et `doAttack` passe `chargedThisTurn` → ses dégâts utilisent aussi la Force + la Taille de la monture (PARITÉ joueur).
  *(Queue/Langue : ✅ attaques de créature, Jalon 1. Immunité Psychologie : ✅ T5. Mécanique ET rendu en selle = complets, testés et **recettés en navigateur**. Seul reste sur ce poste : les **clips d'attaque montés** (différés, coût tokens).)*
- **Limites documentées du lot livré** (assumées, pas des bugs) : Frappe Mortelle « à portée » = **adjacent** (Allonge/reach non modélisée) ; Frappe Mortelle de **base** (tuer-en-un-coup, combattants de même Taille) hors-périmètre — seul l'**écart** de Taille déclenche le balayage ; **Force opposée** = helper pur **sans consommateur** (pas de système de lutte/empoignade modélisé).

## ✅ Jalon 1.6 — Qualité d'objet, Temps & Voyage, Marchand & Arène *(COMPLET — #1 Qualité ✓ ; Temps #T1 + #T1c + #T2 ✓ ; **#T3 Cascade ✓ (2026-06-10)** ; #2 Marchand ✓ ; #3 Arène ✓)*

Spec de conception : `docs/superpowers/specs/2026-06-07-qualite-objet-fabrication-design.md`.
Né d'une demande de **scénario d'arène** (vagues + loot + marchand entre les vagues) qui a fait
émerger le **Marchand** comme livrable central, lui-même prérequis d'un **système de qualité
d'objet** (pour qu'Évaluation ait une qualité à révéler). **Décomposé en sous-projets séquencés**
(chacun sa spec → plan → impl). **Re-séquencé 2026-06-07** (décision utilisateur) : le **Temps &
Voyage** s'insère **AVANT le Marchand** — le re-stock de Disponibilité, la Fatigue de voyage et la
guérison en dépendent. **Re-séquencé une 2e fois 2026-06-07** (décision utilisateur) : seul **#T1
Horloge** (+ **#T1c Jour/Nuit**) était nécessaire au Marchand (il est *time-ready*, l'horloge est en
place) ; **#T2 Voyage et #T3 Cascade sont MIS EN SUSPENS** et le **Marchand est remonté AVANT eux**.
Ordre : **Qualité ✓ → Temps #T1 + #T1c ✓ → Marchand ✓ → (#T2 / #T3 en suspens) → Arène** :

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
- **#T — Temps & Voyage** *(sous-projet — spec `docs/superpowers/specs/2026-06-07-temps-voyage-design.md`)* : système d'**horloge + voyage**, prérequis du re-stock marchand / Fatigue de voyage / guérison. **#T1 + #T1c + #T2 LIVRÉS ; #T3 EN SUSPENS**. Décomposé :
  - **✅ #T1 — Horloge & Calendrier impérial LIVRÉ** (2026-06-07) : module pur `clock.ts` (**calendrier impérial vérifié source FR + canon web** — EiS Annexe 3 l.20/68 « 400 j » + Fandom/Lexicanum ; 12 mois (2×32 + 10×33 = 394) + 6 intercalaires **hors semaine** + semaine de 8 jours ; **année = 400 j**), granularité **date impériale + heures**, **« tout est horodaté »** (chaque action appelle `advanceTime`), état `gameTime` + table `TIME_COST` + HUD. Départ campagne = **fin Jahrdrung 2512 CI, 08:00**. `EVT.TIME_ADVANCED` = seam #T3.
  - **✅ #T1c — Cycle jour/nuit piloté par l'horloge LIVRÉ** (2026-06-07, specs+plans `2026-06-07-cycle-jour-nuit-*`) : le jour/nuit vient de l'**heure**, plus de la scène (`ambiance` = Intérieur/Extérieur) ; **7 phases d'affichage** + obscurité binaire paramétrable (`NIGHT_WINDOW`) ; **`sceneIsDark` unique** câblé au combat (−20 tir nuit, LDB 14 l.107) + rendu ; Effet **`setTime`** (forcer une scène de nuit via trigger) ; HUD jour-de-semaine + phase + heure ; exposition éditeur (ambiance + builder `setTime`).
  - **✅ #T2 — Voyage & Nourriture LIVRÉ** *(2026-06-10)* : **carte du monde** (`state/worldMap.ts` — lieux/routes au niveau PROJET, 100 % donnée, **onglet « Monde » de l'éditeur** : lieux par glisser, routes, km, modes, prix, vitesses, péripéties — **tout paramétrable**) ; **voyage RAW** (`engine/travel.ts` + `state/travelFlow.ts`, source section « Voyage » LDB : vitesse = Mouvement le plus lent en km/h l.222, **6 h/jour sans Test** l.224, **marche forcée** (Résistance ou Exténué, +1 si Encombré), **diligence M6 / barge M8 + prix par km** l.207-219, `travelFatigue` d'Encombrement p.295 **enfin appliqué**, nuits de camp = repos RAW) ; **péripéties** (table d10 **verbatim** `data/peripeties.ts`, seuil 8 paramétrable + **péripéties d'AUTEUR par route** ; « Attaqués ! » → embuscade configurée, interruption + **« Reprendre le voyage »**) ; **NOURRITURE** (`engine/provisions.ts` — **Rations consommées par jour** (entretien `state/upkeep.ts`, anti-double-comptage), **Faim RAW LDB 18 l.417-422** : Tests −10 cumulatif, −10 F/E puis toutes caracs + 1d10 dégâts ignorant PA, **récup naturelle bloquée si affamé** (dette `rest.ts` levée), talent **Brouet**, effet éditeur **`mealParty`**) ; UI `WorldMapView` (🗺️) + badge « Affamé » ; **projet v2** (`{ scenes, worldMap }`, rétro-compat) ; carte Tome 1 + scénario de test **15-voyage** ; ~60 tests.
  - **✅ #T3 — Cascade RAW LIVRÉ** *(2026-06-10)* : l'entretien quotidien (`state/upkeep.ts`, couture unique appelée par advanceTime/repos/voyage, anti-double-comptage `lastUpkeepDay`) décompte désormais par jour franchi — repos OU PAS : **maladies** (LDB 20 : incubation/durée en jours CALENDAIRES, `dailyDiseaseUpkeep` extrait de `restRecovery` + soins d'un soignant au repos) et **convalescence des Blessures critiques** (LDB 18 l.317 : « 30 − BE jours », calendaire). `purgeClockEffects` (à CHAQUE passage d'horloge) dissipe les contrecoups `castPenalties.untilTime` **et** les buffs de sort à durée d'horloge — **bug corrigé** : la purge ne vivait que dans `advanceTime`, un contrecoup expiré restait actif après un voyage/repos. **Corruption : vérifié à la source (LDB 19) — aucun déclencheur temporel, rien à câbler** ; Fatigue/Exténué déjà couverts (#T2 voyage + repos) ; re-stock marchand déjà livré (cf. #2).
- **✅ #2 — Marchand COMPLET (v1 + lot 2 + prix paramétrables)** *(2026-06-08, suite verte, RAW cité, cf. mémoire `game-marchand-v1`)* (étend **Jalon 5** « achats/marchandage, fabrication ») :
  - **v1 transactionnel** : achat/vente, **Disponibilité RAW** (LDB 59 : Commune toujours ; Limitée 30/60/90, Rare 15/30/45 par Village/Ville/Cité), **monnaie canon** (`money.ts` — CO/pa/sc), **archétype = 7ᵉ famille `defs/`** (scopé par catégorie : herboriste ≠ arquebuses), `MerchantPanel` (vue à props testable + connecté), exposition éditeur.
  - **Marchandage** (LDB 60 l.12) = Test **opposé** (gagner −10 % / **−20 % si Succès Stupéfiant DR≥6 ou talent Négociateur**) ; **achat et vente = 2 négociations distinctes** (B), **1 jet/visite chacune** ; **botch** = perdre par net DR≥6 → **marchand méfiant** (plus de marchandage la visite, C).
  - **Évaluation** (LDB 60 l.10) : révèle la **qualité cachée** d'un **objet non identifié** (flag `identified` — masque l'affichage, qualités actives mécaniquement) + estime ±10 % Rare/Exotique. **Qualité magique** ADE2 « De plaies atroces » (= Dévastatrice) en démo.
  - **Réparation d'armure** (10 %/PA perdu, 30 % si pièce brisée — LDB 63 l.97-98).
  - **Prix paramétrables** (override archétype **et** par entité, **champs éditeur**) : **`resaleRate`** (rachat à la vente) + **`buyMarkup`** (majoration à l'achat — « vend plus cher »). **Vente Option 2** (lecture miroir LDB 60 l.22) : **¼ par défaut** (le marchand lowballe), **½ si Marchandage GAGNÉ** (½ = plafond, on ne dépasse jamais).
  - **Marchand dans un dialogue** : Effet **`openMerchant`** (`interactEntity` priorise le dialogue → un choix « voir les marchandises » ouvre la boutique). 2 scénarios de test (`10-marchand`, `11-deux-marchands`).
  - **✅ Re-stock dans le temps** *(2026-06-08)* : **stock PERSISTANT par marchand** (`merchantStocks` — la déplétion survit aux visites) ; **réassort** = re-tirage frais (nouvelle Disponibilité, seed lié à la période) seulement après **`restockDays`** écoulés sur l'horloge (#T1) ; `restockDays` paramétrable (archétype + override entité + champ éditeur, défaut 1 j) ; reset en nouvelle partie.
  - **Reste** : recette navigateur (scénarios `10-marchand` / `11-deux-marchands` prêts).
- **✅ #3 — Arène COMPLET** *(2026-06-08, banc d'essai du marchand)* : vagues croissantes + maître
  d'arène (= marchand) entre les vagues + butin. **100 % DONNÉES, zéro mécanique dédiée** (revue : on
  a abandonné un `Scene.arena`/Effets `arenaNextWave` au profit des briques existantes) : vagues =
  `encounters` (butin + `setFlag` dans `onVictory`), maître = entité `dialogueId` + `merchant`, choix de
  dialogue **gated par flags composés** (`startCombat`/`openMerchant`). Seule généralisation (générale) :
  `condMet` accepte des **flags combinés en ET** (`v1,!v2`) et est **dé-dupliqué** (source unique
  `scene.ts`). Blessures **persistantes** (attrition ; Guérison 1/rencontre + achats). Scénario test
  `12-arene` (3 vagues) + test du séquençage. Spec `docs/superpowers/specs/2026-06-08-arene-design.md`.

**Choix assumés / non-RAW** (défaut = RAW ; tracés §10 de la spec) : **Raffiné** = aucun effet
mécanique (RAW muet, juste prix/dispo/affichage) ; **Volumineux / Fatigue ×2** modélisé a minima ;
**Déviation IA** = dévie toujours (décision utilisateur) ; knobs marchand non-RAW (multiplicateur de
prix, override de remise, toggle marchandage) **avec défaut = comportement canon**.

## ✅ Jalon 1.7 — Audit « combat-only » → actions hors combat & base partagée *(fait — 2026-06-08)*

**Origine** : câbler **`socialPsychMod`** (le −20/−10 Animosité/Préjugé) à un vrai consommateur — les
**Tests de Sociabilité de dialogue/scène** (Effet `test` + `vsGroups` envers le groupe d'un interlocuteur),
comblant la limite « helper sans consommateur » du Jalon 1.5/T5. Ce branchement a révélé que **plusieurs
systèmes étaient modélisés combat-only à tort** → audit transversal, corrigé « dans l'ordre » (B→A→C→D).

- ✅ **Couture B — parité de `testValue`** : un Test hors combat passe par les **mêmes** caractéristiques
  effectives et pénalités d'État que le combat — `testValue` route via `effectiveChar` (traumatismes/buffs)
  + `testStatePenalty` (Empoisonné/Sonné/Exténué/Brisé hors Athlétisme & Discrétion) + `agilityTestPenalty`
  (encombrement). `socialPsychMod` consommé : un PJ haineux subit −20 sur un Charme vs Elfes ; le store
  choisit le **meilleur PJ effectif** (malus intégré au choix). `groupMatch` réécrit en jeu de tokens
  (corrige sur-match `Rat`/`Pirate` et sous-match `Hommes-bêtes`/`Homme-bête`).
- ✅ **Couture A — entretien hors combat** (`outOfCombatUpkeep.ts`) : quand l'horloge avance hors combat,
  rejoue `endOfRound` + `bleedDeathRoll` + `tickDeath` par Round → Hémorragie/Poison/Feu tickent même hors
  combat (héros sauvé par le Destin s'il mourrait). **Pertes de PB centralisées** dans `loseWounds`
  (−tout Avantage, LDB 15 l.40 ; À Terre à 0) — ~15 sites épars n'effaçaient pas l'Avantage.
- ✅ **Couture C — Psychologie À LA RENCONTRE** : `engine/encounterPsych.ts` (pur) + flux
  `encounterPsychFlow.ts` + `EncounterPsychModal`. À l'entrée d'une scène (startScene/transitionTo), chaque
  héros teste son Calme face aux PNJ présents (Peur/Terreur de Taille ou de statbloc, traits ciblés) — LDB 21
  « chaque fois que vous rencontrez » (ex. canonique d'Animosité **en taverne**, l.16), pas seulement au
  combat. Peur résolue en **Test SIMPLE** hors combat (≠ Test étendu du combat) ; auto-chaînée héros par héros.
- ✅ **Couture D — Incantation & Focalisation hors combat** : on rend le **flux d'incantation EXISTANT**
  optionnel au combat (**zéro duplication** d'effet, à la demande « évite de dupliquer ») — `applyCast` rendu
  battle-nullable (sortie `battle.log`+`checkBattleOver` en combat, `journal` sinon), actions `cast*`/`focus*`
  pool-aware, `oocCastSpell`/`oocFocusSpell`, section **« Sorts »** sur la fiche (🎲 Lancer / ✨ Focaliser,
  miroir du bouton « Soigner » hors combat). Sorts **non-offensifs** seulement (Projectile magique exige une
  cible ennemie → reste au combat ; gate = `isMagicMissile`). Effets modélisés (parseHeal/buffs/conditions)
  appliqués, le reste **journalisé sans rien inventer** ; miscast réutilisé tel quel.
- ✅ **Base partagée des actions joueur combat ⇄ hors combat** (fin de la duplication) : `src/state/combatOrParty.ts`
  — **`actorIn(state, id)`** (= `battle?.combatants ?? party`, inféré de `battle != null`) + **`touchActors(state)`**
  (patch de re-rendu) ; **`finishPlayerAction(get, set, lines)`** (combatFlow) pour la **sortie** (combat → conso
  de l'Action + `battle.log` + `checkBattleOver` ; hors combat → `journal`). **Soin, incantation, Focalisation**
  y sont tous câblés ; le flag `PendingHeal.inCombat` supprimé. **Patron d'une nouvelle action hors combat** :
  `résoudre (actorIn) → appliquer l'effet (propre à l'action) → finaliser (finishPlayerAction)`.
- ✅ **Correctifs de combat trouvés en chemin** : **0 PB → À Terre toujours** (bug d'overkill : branches
  mutuellement exclusives) ; **Frénésie héros = attaque CC gratuite/Round** (jusque-là réservée à l'IA) ;
  **désengagement nettoyé quand la cible meurt** (`clearEngagementOf`) ; action **« Courir »** (Action +
  Athlétisme **Accessible +20** → Marche + Course+DR, LDB 15 l.79-82, modale `pendingRun`) ; **Fuite = sens
  opposé aux adversaires** (`fleeReachable`, LDB 15 l.109).
- ✅ **Scénario de test 🔮 « Magie hors combat »** (`09-incantation-hors-combat.ts`) : Wilhelmina (Sorcier,
  **+Armure Aethyrique** focalisable, blessée) + Frère Anselm (Prêtre) — comble le manque (aucun pré-tiré
  n'avait de Sort d'Arcane focalisable) ; vérifie les 3 cas (Focaliser/Lancer arcane, refus Projectile, sort
  à État). **Vérifié au navigateur** (Playwright).
- **1445 tests verts**, typecheck propre ; committé sur `feat/wfrp4-rpg-foundation` (branche en avance, non
  encore poussée). Commits clés : base `0d8b715` + `1b89a0e`, incantation hors combat `8788140`, scénario `f567ef6`.

## ✅ Jalon 1.8 — Audit Psychologie & États (fidélité RAW) + Système de Repos *(fait — 2026-06-08)*

**Origine** : retours d'un audit multi-agents (suite Jalon 1.7) → plusieurs sous-systèmes Psychologie/États
étaient incomplets ou modélisés à tort comme combat-only. Traités **dans l'ordre** (Lots 1-5), chaque
correctif **sourcé au LDB FR** + couvert par un test. Audit : `docs/superpowers/specs/2026-06-08-psychologie-etats-fidelite-audit.md`.

- ✅ **Détermination & immunité psy** : prédicat **`isPsychImmune(c)`** centralisé (Immunité trait / Frénésie /
  immunité temporaire `psychImmuneRoundsLeft`) consommé partout ; un point de Détermination **RETARDE** l'effet
  psy (ré-exposé à l'expiration) sauf si la créature source MEURT — **tous les effets psy d'une créature prennent
  fin à sa mort** (`clearPsychOf`). « Ignorer les modifs de Critique » câblé.
- ✅ **Brisé complet + approche** : restriction d'action (fuir à couvert / se cacher), récupération (Calme fin de
  Round si pas Engagé, ou 1 Round caché), **source de Peur qui s'approche → Test de Calme** (LDB 21 l.29).
- ✅ **Surprise & orientation** : `Surpris` en début de combat (Test opposé Discrétion/Perception), **retrait après
  la 1ʳᵉ attaque** (l.136), **flanc/dos +20** (consomme le facing Dir8).
- ✅ **Finitions d'États** (LDB 16) : À Terre −20 dépl ; Sonné +1 Av ; **Inconscient** « Je ne faillirai pas ! »
  auto-réussite+critique / tir auto à bout portant (l.112, `0d9ebdd`) ; Empoisonné (Résistance fin de Round +
  Exténué) ; **Hémorragique** coagulation → Exténué (l.109, `892848e`) ; perte d'Avantage à l'ajout de TOUT État ;
  **Empêtré « se libérer »** (Test opposé de Force vs source) + **En flammes « se rouler »** (Athlétisme) — Action
  + modale `pendingStateRecovery` + IA instantanée (`b24b578`) ; helper pur partagé `recoveredStacks`.
- ✅ **Méta/éditeur** : Effet **`restoreFortune`** (Chance regagnée, max = Destin, l.47) exposé éditeur (`8e5129e`) ;
  **Trauma cauchemars** — `nightmareCheck` (Calme Facile +40 → Exténué, l.92), flag héros `nightmares`, Effet éditeur
  `inflictNightmares` (l'auteur assigne le trauma — jamais inventé).

**✅ Système de REPOS** (suite retour utilisateur — *« les cauchemars surviennent pendant le SOMMEIL »*) : actions
**« Dormir jusqu'à l'aube »** + **« Se reposer N jours »** (HUD exploration, hors combat). `restRecovery` (pur,
`engine/rest.ts`) par journée de repos : retrait de TOUT l'Exténué (16 l.91/102) ; **soin de Blessures DEUX volets**
(18 l.380) — **a** Test de Résistance Accessible (+20) → DR+BE, **b** +BE inconditionnel **par journée** ; **cauchemars**
(le trauma re-gagne un Exténué malgré le repos) ; réveille un Inconscient / relève un À Terre dès > 0 PB (l.28).
**Revue adversariale** (4 lentilles) → correctif **bloquant** (« Dormir » rejouait ~1 Round/min d'entretien → mort
par hémorragie avant tout soin ; désormais l'horloge avance SANS la spirale, et un héros Hémorragique/En flammes/
Empoisonné **refuse le repos**, l.105). Commits `e2f4229` / `623081b` / `26d35c1`.

**Dette sourcée** (hors lot) : ~~Faim/Soif bloquant la récup (l.418)~~ **levée par #T2 (2026-06-10** — rations
suivies, faim RAW, récup bloquée si affamé**)** ; **Blessures CRITIQUES** = piste SÉPARÉE
(convalescence, Guérison) → traitée au **Jalon 5** (ci-dessous). **~1657 tests verts**, typecheck propre.

## ✅ Jalon 1.9 — Loadouts d'armes & combat à deux armes *(fait — 2026-06-10)*

**Sets d'armes nommés** construits hors combat et commutés en combat, **choix de l'arme d'attaque ET de
parade**, talent **Maniement de deux armes** complet, le tout sur un **registre de capacités de combat**
extensible (talents + traits). RAW vérifié (LDB 10/14/18/62) ; spec/plans
`docs/superpowers/{specs,plans}/2026-06-10-loadouts-deux-armes*` + `…-p1…p6…`.

- **Modèle de loadouts** (`Combatant.loadouts[]` + `activeLoadoutId`) : `recomputeLoadout` dérive `c.weapons` du
  loadout ACTIF (**un seul modèle** — legacy « toutes armes équipées » supprimé), tague chaque arme `hand:'main'|'off'`,
  applique la contrainte 2 mains (`hands:1|2` via marqueur `(2M)` uniforme mêlée/distance), **auto-génère** un loadout
  par défaut (Mêlée + Distance) si absent, **auto-prune** les slots orphelins (arme vendue/transférée/**détruite**).
- **Pénalité de main secondaire** (LDB 14 l.181 : −20) appliquée à l'attaque ET à la parade (au **JET**, pas
  cosmétique), via le **registre `engine/combatFeatures/`** (calqué sur `qualities/`) : **Ambidextre** (−20→−10→0) ;
  exception **Parade** (arme 1 main Défensive + spé Corps à corps (Parade) → 0). Hooks `modifyOffHandPenalty` /
  `attackModes` (terrain prêt pour Riposte/Champion/Tir rapide, sans dispatcher mort).
- **Constructeur de loadouts** (fiche, hors combat) + **commutateur ActionBar** (switch gratuit **1/tour, autorisé
  même Engagé**) + **verrou d'équipement en combat** (armure/brassage = hors combat ; seul le switch change l'arme).
- **Choix de l'arme** d'attaque (`PendingAttack.weaponUid`, sélecteur RollModal) et de **parade**
  (`PendingDefense.parryWeaponUid`, sélecteur DefenseModal) — parité aperçu↔résolution↔affichage via `Weapon.uid` +
  `firedWeapon(weaponUid)`. Bug-fix : la pénalité de parade main-2nde était cosmétique (`rollMeleeDefender` la
  calculait en ligne sans `defenseModifiers`) → désormais appliquée au jet.
- **Talent Maniement de deux armes** (LDB 10 l.638, RAW vérifié) : mode « Des deux armes » → frappe main directrice ;
  si elle touche, **2ᵉ frappe de la main secondaire** (`resolveDualSecond` : **d100 inversé** / valeur du tableau des
  Critiques + −20 + **nouveau jet de défense**) contre une cible **au choix** ; **−10 à TOUTES ses défenses jusqu'à
  son prochain Tour** ; **+1 Avantage UNIQUE, seulement si les deux touchent** ; **borné à l'attaque-Action** (jamais
  une frappe gratuite/enchaînée). UI : `DualStrikeModal` (sélecteur de 2ᵉ cible) dans l'arbitre. Rendu **dual-wield**
  (2ᵉ arme dessinée, profondeur de profil par couches). Recette navigateur passée (scénario `13-maniement-deux-armes.ts`,
  jet inversé 60→06 + −10 défense + Avantage vérifiés en live, 0 erreur console).
- **Marchand réconcilié** : « équipé » d'une arme = `isWeaponActive` (dérivé de `c.weapons`), **shim `equipped`-sync des
  armes supprimé** ; `it.equipped` ne sert plus que pour l'armure + le seed du loadout par défaut. Lecteurs migrés
  (equipCompare, usure par `uid`, MerchantPanel, CharacterSheet, rig bouclier).
- **Amputation ↔ loadout** (vrai bug trouvé via une question utilisateur) : une main amputée ne tient plus rien
  (`handAmputated`, brasD=main / brasG=off, hors prothèse « tout ») → l'arme directrice est conservée (−20 CC/CT déjà
  appliqué, LDB 18) tant qu'une main reste, mais le **bouclier / 2ᵉ arme de main secondaire tombe** dès qu'une main
  manque ; deux mains perdues → Mains nues. *(Audit RAW : la Maladresse « lâche l'arme » et « l'unification off-hand
  du −20 » ont été ÉCARTÉES — sans base dans le Tableau des Oups ! VF, ni dans LDB 18.)*
- **~2098 tests verts, typecheck 0** ; committé par lots sur `feat/wfrp4-rpg-foundation` (arbre partagé respecté).

## ✅ Jalon 2 — Magie & Religion *(complet — 2026-06-10, 8 lots committés, suite verte entre chaque)*

**Refonte structurelle** (l'existant 0.7 était un POC : effets devinés par regex sur la `desc` à
l'application) : **vocabulaire d'ops partagé** + **specs structurées par sort**, avec repli regex
iso-POC pour les sorts non curés (curation incrémentale, zéro régression — golden curé ≡ repli).

- ✅ **Lot 0 — Socle** : `engine/ops.ts` (union `GameOp` : wounds/heal/condition[durée|récurrent]/
  charMod/test imbriqué [+ palier `onFailHard`]/corruption/castPenalty/reduceToZero/narrative +
  formules « (Bonus de X) »/dés, applicateur unique `applyOps`) ; `engine/spellspec.ts` +
  registre `data/spellspecs/` (19 Bénédictions + Domaine du Feu curés, sources citées) ;
  `applyCast` consomme la spec.
- ✅ **Lot 1 — Péché & Colère** (LDB 40) : `sinPoints` persisté, **dé des unités ≤ Péchés → Colère
  MÊME sur Prière réussie** (l.45), +10/Péché au jet, **Péché −1 après chaque jet** (l.53), Effet
  d'éditeur `giveSin`, ⚖️ sur la fiche.
- ✅ **Lot 2 — Corruption & mutations** (LDB 19) : expositions (mineure/modérée/majeure, gains par
  seuils de DR — Effet `corruptionExposure` en modale + `giveCorruption`), **seuil BFM+BE → Test de
  Résistance ou MUTATION** (−BFM, d100 corps/esprit PAR ESPÈCE, **Tableaux physique/mentale
  verbatim** dans `data/mutations.ts` — caracs permanentes, Mouvement, PA naturels, mods de Tests,
  Traits Tentacules/Frénésie), **limites → DAMNÉ** (hors-jeu) ; effets lus à la volée (patron
  Traumatismes, survit au writeback) ; **Sombre Pacte** 🩸 (+1 Corruption pour RELANCER un Test
  raté, même déjà relancé, même à 0 Chance — fabrique rollFlow + attack/cast/test) ; révélation 🧬.
- ✅ **Lot 3 — Tables d'Imparfaites/Colère pleinement mécaniques** (LDB 46/40) : Tests imbriqués
  (« Résistance ou Sonné »…), Corruption, **pénalités/blocages d'incantation temporisés**
  (`CastPenalty` : −10 Langue/Prière, Tests interdits N Rounds/minutes/jours, « Pensez à vos
  actes » = DR de Prière plafonné à 0 une semaine) — décrément fin de Round + purge horloge ;
  le non-modélisable reste journalisé (MJ).
- ✅ **Lot 4 — Risques d'incantation & Focalisation** (LDB 46) : **Incantation Critique** (l.52-59 :
  Imparfaite Mineure sauf Diction instinctive + CHOIX Blessure Critique / Puissance totale / Force
  inéluctable), **Focalisation Critique** (NI atteint + contrecoup sauf Harmonisation aethyrique),
  **maladresse de Focalisation élargie** (double OU ×0 raté → Majeure), **interruption** (Dégâts
  subis → Calme −20 ou DR perdus + Imparfaite), **spécialisation PAR VENT**, **« Repousser les
  Vents »** (−1 DR/PA d'armure portée, exemptions Métal/Bêtes), **Avantage sur l'Incantation**
  (+10/pt, jamais la Focalisation) + **convergence de Domaine** (+1 Avantage, l.176).
- ✅ **Lot 5 — Surincantation & États temporisés** (LDB 47 l.28-31, 41/42) : +2 DR → **+Durée /
  +Cible** (Sorts : au-delà du NI ; Bénédictions/Miracles : DR entier), allocation en modale,
  multi-cibles du même jet ; `ConditionInstance.roundsLeft` (États « qui durent N Rounds ») ;
  **États récurrents** (« un par Round », effet actif porteur).
- ✅ **Lot 6 — Zone d'Effet** (LDB 47 l.44) : clic-CASE en mode incantation → toutes les cibles du
  rayon (diamètre ZdE, 2 m/case) visées par le même jet, garde-fou de portée, **gabarit au survol**
  (IsoStage). *(Reportés, documentés : zones persistantes spéciales — Mur de feu —, extension ZdE
  par Surincantation post-jet, IA multi-cibles.)*
- ✅ **Lot 7 — Grimoire** (LDB 46/47/10/41) : `engine/grimoire.ts` — coûts par bandes (Magie mineure
  50×⌊connus/BFM⌋+1 ; Arcanes 100×⌊connus/BInt⌋+1 ; Invocation 1er Miracle inclus puis 100×connus ;
  Chaos 100 PX **+1 Corruption**), **Bénédictions PAR CULTE** (table LDB 41 verbatim, les six à
  0 PX) ; section « Sorts — mémorisation » (onglet Avancement) ; **lecture au grimoire porté**
  (sort non mémorisé du Domaine, **NI ×2**, 📖 sur la fiche) ; Effet d'éditeur `learnSpell`.
- ✅ **Lot 8 — Curation pilote + recette** : Domaine du Feu curé (8 sorts, ops riches + narratif MJ),
  correctif **Surincantation des Prières** (LDB 41/42), scénario 🕯️ **« Magie — Jalon 2 »**
  (`14-magie-jalon2.ts` : Péché→Colère, exposition→mutation, Sombre Pacte, ZdE, Surincantation,
  mémorisation).
- ✅ **Lot 8 bis — curation élargie + inventaire** : Magie mineure (25), Arcanes communs (23),
  Miracles de Sigmar + Shallya (12) curés — **87 specs curées**, dont : Éblouissant (Aveuglé
  RÉCURRENT), Drain (soigne le lanceur — les ops de spec curée s'appliquent désormais aussi sur la
  branche Projectile), **Armure Aethyrique enfin mécanique** (PA temporisés `ActiveEffect.apAll`,
  lus par `effectiveArmourAt` à la mitigation), Innocence immaculée (RETRAIT de Corruption),
  Poussée/Feu de l'âme/Comète (zone portée par la spec `zdeRadiusMeters`, lanceur exclu) ;
  labels en DOUBLE désambiguïsés par type (« Enchevêtrement » Arcane ≠ miracle de Taal).
  **Inventaire d'implémentation** : `docs/sorts-implementation.md` (GÉNÉRÉ par
  `npx tsx scripts/gen-sorts-doc.mts`) — état des 221 sorts (✅ 64 mécaniques · 🟡 18 partiels ·
  📜 139 « arbitrage MJ », avec pour chacun CE QUI RESTE à mécaniser) ; badge 📜/🟡 sur la fiche.
- **Backlog incrémental** (= `docs/sorts-implementation.md`, 1 fichier/famille dans
  `data/spellspecs/`) : curation des 7 Domaines restants + Miracles ×8 cultes + Sorcellerie/
  Nécromancie/Démonologie/Chaos ; effets « par identité » non modélisés (relance de Bénédiction de
  Chance, armes enchantées, Traits temporisés Peur/Protection/Vol, immunités, redirections type
  Martyr) ; **Dissipation/Contre-sort** (nécessite des lanceurs IA des deux côtés) ; composants &
  malepierre ; Vents tourbillonnants (règle optionnelle).
- **2243 tests verts**, typecheck 0, lint 0 erreur ; recette navigateur À REPASSER (session sans Playwright).

## ✅ Jalon 2.5 — Intégration des règles manquantes : qualités, traits, talents, maladies, corruption, trauma *(fait — 2026-06-10)*

**Origine** : demande utilisateur « intégrer tous les atouts/défauts d'armes, traits de créature,
talents, maladies, corruption, trauma, psychologie manquants (hors sorts) ». Architecture : **un
seul patron, trois registres** (defs/ généré + dispatch typé + **test de parité anti-empilement**)
— les qualités (existant), les **traits de créature** (`engine/traits/`, NOUVEAU) et les **talents**
(`engine/combatFeatures/` refondu). Critère « tous » mesurable : chaque entrée de la donnée est une
def, couverte ailleurs (raison documentée) ou allowlistée MJ **en conscience**. 7 lots, suite verte
+ commit entre chaque (2 321 → 2 408 tests).

- ✅ **Lot A — 10 derniers Atouts/Défauts d'armes** (LDB 62/63, allowlist vidée) : À Répétition
  (chargeur `Combatant.chambered`), Immobilisante (Empêtré), Perturbante (mode « Repousser », bouton
  ActionBar), Piège-lame (Critique défensif → piéger/briser, modale `BladeTrapModal`), Protectrice
  (PA d'opposition + opposition aux projectiles Indice ≥ 2), Rapide (pré-emption gratuite ⚡ + −10
  parade adverse), Dangereuse (Maladresse sur 9), Épuisante (Atouts de Dégâts en Charge seulement),
  Imprécise (−1 DR, prime sur Précise), Lente (frappe en dernier, +1 DR défense adverse, prime sur
  Rapide). **+ Critiques du Test opposé** (LDB 14 l.7) : un double réussi inflige une Blessure
  critique même sans gagner l'échange. Préséance `beats` enfin consommée.
- ✅ **Lot B — Atouts/Défauts d'armure intrinsèques** (LDB 63, l'ex-« C3 ») : Flexible
  (superposition rigide+souple cumulée, `wornArmourPoints`), Impénétrable (Critique sur jet impair
  ignoré), Partielle (PA ignorés sur jet pair/Critique), Points faibles (PA ignorés sur Critique
  Empaleuse). Parité étendue au subType Armure.
- ✅ **Lot C — Traits de créature** (LDB 85) : registre `engine/traits/` (40 defs), parité 81/81.
  Profil dérivé au spawn des statblocks d'ÉDITEUR (Élite/Coriace/Brutal/Rapide/Grand/Rusé/
  Intelligent/Meneur/Endurant — bestiaire imprimé final, LDB 77) ; Mutation/Corruption mentale
  tirées au spawn (graine stable). Combat : Démoniaque/Protection (sauvegarde 1d10, bannissement),
  Éthéré (attaques magiques seules), Champion, Parasité (−10), Perturbant (aura −20), Sang corrosif,
  Toile, Instable, Régénération, Insensible à la douleur, Résistance à la Magie, Immunité (Poison).
  Psy/IA : Belliqueux, À sang-froid (inverse FM ratés), Bestial (Esquive seule, fuite < ½ PB, Brisé
  par le feu), Affamé, Stupide, Rage, Nerveux (+3 Brisé magie/détonations), Effrayé (Peur 0 ciblée).
  Mouvement/vision : Vol (`flyReachable`), Bond ×2/Foulée ×1,5, Vision nocturne/Infravision, Furtif.
  Scénario 🐲 « Traits de créature » (15).
- ✅ **Lot D — Maladies** (LDB 20) : Litanie de la Pestilence **complète** (9/9 — +Courante
  Galopante, Fièvre du Rongeur, Flux Sanglant, Peste Noire, Vérole du Tanneur, Vérole Urticante avec
  immunité après guérison) ; +7 symptômes mécanisés (bubons, convulsions, démangeaisons, gangrène
  → Localisation perdue, intoxication, nausée → Sonné, toux → contagion au repos). Traits
  Infecté/Maladie câblés post-combat (`finalizeBattle`).
- ✅ **Lot E — Corruption** : talent **Âme pure** (seuil +niveau), **« Je te renie ! »** (LDB 17
  l.71 — modale `RenounceModal`, 1 Résilience pour refuser la mutation), trait **Corruption
  (Degré)** → exposition auto-résolue en fin de combat.
- ✅ **Lot F — Trauma (résidus)** : Effet d'éditeur **`inflictTrauma`** (déchirure/fracture/
  amputation rétroactives) ; note 2M périmée corrigée (les armes à distance (2M) étaient déjà couvertes).
- ✅ **Lot G — Talents** (LDB 10) : `combatFeatures/` refondu au patron defs/ (42 defs), **parité
  172/172** (création/`talentEffects` · câblé ailleurs · narratif MJ). Câblés : Coup puissant, Tir
  précis, Combat déloyal, Charge berserk, Déterminé, Tueur, Robuste, Frappe blessante, Tir sûr,
  Frappe assommante, Tir mortel, Tireur d'élite, Tireur embusqué, Combat instinctif, Tir rapide,
  Vigilance, Rechargement rapide, Artilleur, Sprinter, Fuite !, Porte-Bouclier, Riposte,
  Renversement, Maîtrise du combat, Mâchoires d'acier, Cœur vaillant, Endurci, Résistance à la
  Magie, Effrayant, Menaçant, + 7 talents d'inversion de Test raté.
- *Limites documentées* : Perturbant/Mâchoires d'acier à granularité de Round ; déviation non
  proposée sur les Critiques « secs » du Test opposé ; Battement/Feinte/Désarmer/Assaut féroce =
  manœuvres d'Action dédiées différées (allowlist en conscience) ; Vol = IA seulement (pas de vol héros).

## ✅ Jalon 2.6 — Intégration sorts ↔ systèmes : le substrat 2.5 irrigue la curation *(livré partiel — 2026-06-10)*

**Origine** : audit d'intégration des 4 gros lots parallèles (Magie / #T2 Voyage / 2.5 règles
manquantes / créateur) — la curation des sorts (Jalon 2) avait été figée AVANT que les registres
de 2.5 n'existent : des familles entières restaient « 📜 arbitrage MJ » alors que leur substrat
moteur était livré à côté. Relevé EXHAUSTIF des 157 sorts 📜/🟡 catégorisé à 100 % (66 curés à
résidu + 91 non-curés). **Inventaire : ✅ 64 → 77 mécaniques** (`docs/sorts-implementation.md`).

**Livré (suite verte + commit par lot)** :
- **Enablers d'ops** : `PerSL`/`OpsCtx.sl` (échelle « +1 par +2 DR » — applyCast fournit le DR du
  jet) ; filtre `onlyGroups` par Groupe de la CIBLE (engine/groups) ; **buffs à durée d'HORLOGE**
  (`ActiveEffect.untilTime` — « 1 heure », « (BFM) jours », « Jusqu'au lever du soleil » expirent
  à l'échéance via la cascade #T3, plus à 9999 Rounds). Curés : Comète à Deux Queues (1d10+DR),
  Enchevêtrement, Innocence immaculée, Purification (+DR En flammes, LDB 48 vérifié), Feu de l'âme
  (En flammes aux Morts-vivants/Démons).
- **Op `grantTrait`** (trait posé dans `c.traits` → TOUS les consommateurs existants ; psy dérivée
  re-synchronisée, retrait d'UNE instance à l'expiration — fin de Round ET horloge) + **VOL HÉROS**
  (`moveReachFor` route `flyReachable` sur les 8 sites de déplacement joueur — était IA-seulement).
  Curés : Envol (Vol Agilité), Effrayant (Peur+DR), Terrifiant, Protection (9+), Perturbant, Sang
  corrosif, Vision dans l'obscurité, Vaincre les impies (3 Haine ciblées), Couronne de Flammes.
- **Op `grantTalent`** (porté par l'ActiveEffect, lu par `featuresOf` — la fiche ne change pas) +
  **talent « Sans peur » MÉCANISÉ** (LDB 10 l.859, sorti de l'allowlist : immunité Peur/Terreur vs
  l'Ennemi spécifié — `fearImmuneVs`, consommé par `fearSourceFor` + `attackModifiers`). Curés :
  Flambeau de Vertu, Cœurs ardents (Sans peur + Cœur vaillant ; Coude-à-coude = MJ).
- **Op `enchantWeapon`** (demande utilisateur — qualités d'objet TEMPORAIRES) : porté par le
  PORTEUR, fusionné à l'arme à la résolution (`enchantedWeapon`) ; **nouvel Atout « Magique »**
  au registre (→ `isMagicWeapon` → blesse l'Éthéré, LDB 85). Curés : B. de Droiture, Marteau
  ardent de Sigmar (+BSoc + En flammes/À Terre à la touche), Épée ardente de Rhuin (+6,
  Percutante, En flammes), Arme aethyrique (volet création d'arme = MJ).
- **Ops maladies/soins** (croisent les moteurs 2.5 Lot D / Jalon 5) : `cureDisease` (Amère
  catharsis, purge 1+DR/2, Exténué du malaise rendu), `reduceDiseaseDays` (B. de Convalescence,
  1×/maladie), `preventInfection` (Cautériser → `woundDressed`), `cureCriticalWound` (Larmes de
  Shallya — jamais une amputation).
- **Déplacements forcés** : `SpellSpec.teleportMeters` (Téléportation — choix de case post-
  Appliquer, mode `action:'teleport'`, survol des obstacles) + `pushMeters`/`pushAway` (Poussée —
  recul en ligne jusqu'à l'obstacle, collision journalisée).
- **Fix UX relevé** (question utilisateur Fléchette) : le ciblage AVANT le jet est RAW (la
  Surincantation dépense le DR excédentaire, inconnu avant de lancer) ; petit reste UI : masquer
  le bouton « +Durée » pour les sorts Instantanés.

**Reste tracé (designs validés au plan 2026-06-10)** :
- ✅ **L9 résiduel — drapeaux** *(2026-06-11, commits `711af3d` + `0f88c21`)* : B. de Chance
  (relance GRATUITE `freeReroll` consommée aux 6 points de relance + bouton 🙏 dans les modales),
  B. de Sauvagerie (`rollCritical` 2 lancers garde le plus sévère, 4 sites), Endurance de
  l'anachorète (`ignoreStatePenalties` → combatTestPenalty/testStatePenalty), Sommeil (gates
  d'op `onlyIfCondition`/`unlessCondition` : À Terre → Inconscient, sinon À Terre), Putréfaction
  (op `damageArmour` cuir), Souffle (délégué à l'attaque de ZONE du Trait via `applyAreaAttack`
  centre imposé, Dégâts = BE, Type mappé du Domaine, portée du TRAIT), N'écoutez point la
  Sorcière (aura `castWard` rayon BSoc +BSoc/+2 DR → −20 Langue (Magick), 3 sites de jet),
  Baume pour un esprit blessé (`suppressPsych` : Traits psy suspendus portés par l'effet,
  restitués à l'expiration rounds ET horloge).
- ✅ **L10 — Suffocation** *(2026-06-11, commit `7a22bbf`)* : `engine/suffocation.ts` (−1 PB/Round,
  0 PB → Inconscient, mort après BE Rounds via `suffocationCountdown` lu par `inDeathCondition`
  → Destin/pendingFateSave gratuits) ; B. de Souffle = immunité (`noBreath`) ; démo de curation
  **Ombres étrangleuses** (Exténué + suffocation + incantation coupée) et **Transmutation de
  Chamon** (3 États persistants + 1 PA + suffocation) — familles Ombres/Métal amorcées.
- ✅ **L11 — Zones persistantes** *(2026-06-11, commit `8fc668b`)* : `battle.zones[]` {tiles,
  rounds, blocksLoS?, onCross?, perRound?} généralise la fumée (migration franche, rendu
  gris/orange) ; traversée câblée aux 5 sites de déplacement ; `SpellSpec.persistentZone`
  (disc/wall) → **Mur de feu** (mur ⊥ lanceur→cible, BFM m +BFM/+2 DR, traverser = BFM Dégâts
  + En flammes), **Grands feux d'U'Zhul** (zone qui brûle : 1d10+6 ignore PA + En flammes/Round) ;
  auras portées → **Bouclier anti-flèches** (projectiles organiques détruits en entrant) et
  **Dôme** (Protection 6+ vs tirs et Projectiles magiques extérieurs). Volet zone de
  Purification vérifié RAW : rien de plus à mécaniser (le +DR En flammes au cast couvre).
- ✅ **L12 — Dissipation** *(2026-06-10, merge `cfeb97b` + fix `7b651f0`)* : Contre-sort réactif
  joueur ET ennemi (Test opposé Langue (Magick), 1/Round) ; la modale d'incantation ennemie
  suspend le tour de l'IA.
- ✅ **L13 — Gates & redirections** *(2026-06-11, commit `bd6dfac`)* : **B. de Protection**
  (Test de FM Accessible (+20) imposé à l'attaquant à la DÉCLARATION — héros refusé sans rien
  consommer + révélation, IA renonce au coup), **Martyr** (le prêtre encaisse les Dégâts bruts
  à 2×BE + ses PA, attaques ET Projectiles ; la cible est épargnée), **Attaques en chaîne**
  (rebond mécanique sur l'ennemi le plus proche ≤ BFM m tant que la cible tombe à 0, max BFM).
- ✅ **L14 — Attributs de Domaine** *(2026-06-11, commit `8d1db0e`)* : `engine/domainAttributes`
  (strict par subType) — Métal (ignore PA métal + dégâts = PA), Cieux (ignore PA métal + arc
  2 m BFM), Ombres (ignore PA non magiques, l'apAll magique tient), Feu (+1 En flammes adverses
  + +10 Incantation/pion En flammes à BFM m), Lumière (Aveuglé + BInt ignore BE/PA aux
  Démons/MV), Mort (+1 Exténué vivants, 1× — `shyishExhausted`), Vie (purge Exténué/Hémorragique
  + BFM aux MV), Bête (Peur 1, 1d10 Rounds au lanceur). Différés documentés : +10 rural (Vie,
  pas de classification de scène), volet Focalisation du +10 d'Aqshy.
  **→ Le reliquat 2.6 est CLOS (L9-L14)** ; le « Différé réel assumé » ci-dessous reste le seul reste.
- **Différé réel assumé** : ~20 utilitaires narratifs hors grille (Bruits, Repères, Serrure
  ouverte…), volet « Commandements divins » de B. de Conscience.

## ✅ Jalon 3 — Création de personnage complète *(complet — 2026-06-11)*

- ✅ **Compétences/Talents raciaux** appliqués à la création (LDB l.510 : 3 compétences d'espèce
  à +5, 3 à +3, additif ; talents fixes, choix « A ou B », et « N Talent aléatoire » tirés sur le
  Tableau des Talents aléatoires d100).
- ✅ **Génération de noms** *(2026-06-11)* : bouton **🎲** sur le champ Nom du créateur — banque
  `src/data/names.json` (reprise du projet WarhammerV2 : ~1750 prénoms humains M/F, 1835 familles,
  pools complets nain/elfe/halfling/gnome/ogre, toutes espèces couvertes) ; moteur pur
  `engine/names.ts` (RNG injecté, 6 tests) ; cas NAIN canon : patronyme « parent + suffixe sexué »
  (LDB 05 l.622 : -sson/-snev fils/neveu, -sdottir/-sniz fille/nièce). Vérifié navigateur.
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
  ✅ Richesse initiale (`rollInitialWealth` → bourse du groupe) et détails physiques (âge/taille/
  yeux/cheveux) sont câblés dans le créateur (`creator/draft.ts`) — relevé d'audit 2026-06-10.
  ✅ **Béni (Culte concret) octroie AUTOMATIQUEMENT les six Bénédictions du culte** (LDB 10/41
  « reçoit les SIX » — `applyTalentAcquisition`, création + achat PX, Jalon 2.6).

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

- ✅ **Sauvegarde/chargement** *(2026-06-11, commit `66ce86c`)* : snapshot **zéro-maintenance**
  (clés de données de `getInitialState` — toute donnée d'état future est sauvée gratis), 3 slots
  localStorage versionnés + **export/import JSON** ; refusée en combat ; UI : modale 3 emplacements
  (scène + date impériale + horodatage) via le menu ☰ en exploration + « Charger une partie » au
  menu principal. La scène vivante, flags, horloge, groupe, marchands, voyage voyagent dans la save.
  **Recette navigateur passée** *(2026-06-11)* : sauver → recharger la page à froid → charger
  restaure scène/date/bourse/PV à l'identique ; Exporter télécharge le JSON ; ✕ vide le slot ;
  0 erreur console. Fix au passage : le libellé du slot affiche le **nom** de la scène (lisait
  `scene.label` inexistant → retombait sur l'id).
- ✅ **Entre deux aventures** *(2026-06-11, commits `3cf37b0`→`59b49ad` — spec/plan
  `docs/superpowers/*/2026-06-11-entre-deux-aventures*`)* : achats/marchandage ✅ (Marchand,
  Jalon 1.6) ; **système d'interlude complet (LDB 22-23)** — Effet d'éditeur `interlude{weeks}`,
  Événement d100 par héros (table verbatim, fx mécaniques appliqués, narratif journalisé),
  min(3, semaines) Activités, **Argent à gaspiller** (bourse dilapidée sauf banque/Revenus),
  « Avec le pouvoir » (Niveaux 3-4 sans Revenus rétrogradés), le temps passe (repos/convalescence).
  **Activités jouables** : Revenus (LDB 08, Statut × événements), **Artisanat = la « fabrication »**
  (Test étendu de Métier, matériaux ¼ prix, Atouts/Défauts choisis → objet réel), Opérations
  bancaires (invest/planque, faillite), Apprentissage particulier (Talents hors carrière — seule
  voie RAW, LDB 07 l.97 vérifié), Passer commande (Exotique, livré à l'interlude suivant).
  *Différés documentés* : Entraînement (remise de coût — le ×2 hors-carrière actuel est RAW-conforme
  sans Activité), Changement de carrière (déjà offert par la fiche), Entraînement au combat
  (inversion de Test), Consulter un expert/Invention/Dressage/Activités de Classe (narratifs).
  **Scénario `16-interlude` + recette navigateur passée** *(2026-06-11, `139cd5d`)* : flux complet
  vérifié en jeu (événements d100, Revenus avec modale, clôture) — a trouvé et corrigé le bug de
  famine à la clôture (`fedDaily` : gîte et couvert payés par l'Argent à gaspiller).
- ✅ **Repos & récupération naturelle** (Jalon 1.8) : « Dormir / Se reposer N jours » — Exténué dissipé,
  Blessures soignées (Résistance +20 → DR+BE, +BE/jour, LDB 18 l.380), cauchemars.
- ✅ **Guérison des Blessures critiques** *(2026-06-08, `c10bcf4`→`b16a45f`)* : chaque trauma porte `recoveryDays`
  (LDB 18 : déchirure mineure 30−BE ; majeure 2×(30−BE) l.326 ; fracture 30+1d10 l.300, +10 majeure l.309),
  **décompté au repos** (`tickTraumaRecovery`) → à 0 le trauma disparaît (pénalités levées) + `criticalWounds`-- ;
  la **Compétence Guérison** accélère une déchirure mineure (−1 j −1/DR, l.317) et **pose/bande une fracture** dans
  la semaine (l.302) via le mode de soin `trauma`. **Convalescence à étapes** : déchirure majeure en **2 temps**
  (−20→−10 à la mi-durée, l.326) ; fracture = **Test de Résistance de fin** (l.300/309) → échec ⟹ séquelle
  permanente −5/−10 **Agilité**, ou **−5/−10 Langue** (fracture à la Tête, `skillPenalty`→`testValue`) ; « réduite »
  par Guérison ⟹ pas de Test. **Talent Chirurgie** (mode de soin `surgery`, hors combat) : opère une fracture majeure
  OU une **amputation** (`needsSurgery`) — réussite retire le trauma, mais l'opération coûte **1d10 PB + Hémorragique**
  puis Résistance +20 ou **Infection Mineure** réellement contractée (talent Chirurgie, l.365). **Bandages/potions** =
  consommables utilisables **en combat** (Action) **ET hors combat** (bouton « Utiliser » de la fiche, `usePartyItem`).
  Effet d'éditeur `rest`.
- ✅ **Maladies et infections** (LDB 20, `engine/disease.ts`) : cycle incubation→durée→résolution décompté au
  **repos** ; `DISEASE_DEFS` (Infection Mineure, Blessure Purulente, Infection du Sang). Symptômes câblés : **malaise**
  (Exténué collant), **blessé** (bloque 1 PB de guérison + Résistance +20/jour → Blessure Purulente), **fièvre** (−10
  Tests Physiques/Sociaux), **persistant** (Test de fin → +1d10 j / Blessure Purulente / Infection du Sang selon DR).
  **Contraction** depuis 4 sources : post-critique (Résistance +60, l.72), **Chirurgie** (+20), **Guérison Échec
  Stupéfiant** (DR ≤ −6, l.09-Compétences), Effet d'éditeur **`inflictDisease`**. **Guérison** : soin de Blessures (BI+DR,
  dégât si BI+DR<0), arrêt d'Hémorragie, **traiter une maladie** (−1 j/jour de soins, min 1). Persistance hors combat.
- ✅ **Amputations** (LDB 18 l.328-370) : critique « Amputation (Difficulté) » → Test de Résistance ou À Terre
  (DR ≤ −2 +Sonné, DR ≤ −4 +Inconscient) ; **plaie chirurgicale** `needsSurgery` opérable par la Chirurgie + **séquelle
  PERMANENTE** (survit à l'opération). Toutes les parties mécanisées (latéralité connue via brasG/brasD–jambeG/jambeD,
  partie de tête via name+note ; **hypothèse : tout le monde DROITIER**, main principale = brasD) :
  jambe/pied (Mouvement÷2 + −20 Esquive ; **monture compense** via `mountMovement`), orteil (−1 Ag/CC), main
  (`noTwoHanded` → `recomputeLoadout` exclut les armes à 2 mains + −20 CC/CT si dominante), doigt (−5 CC/CT si
  dominante), nez (−20 Soc), œil (−5 Soc), oreille (−5 Soc), langue (Tests de Langue échouent), dents (−2 Soc).
  **Prothèses** (LDB 73, dans `trappings.json`, rendues équipables : Enc 0 portées) — `Trauma.prosthesis`, levé
  tant que **PORTÉ** (équipé, pas juste possédé) : Fausse jambe (déplacement ; +200 PX `trainProsthesis` → Esquive),
  Merveille (tout : oreille/main/bras/jambe), Nez doré, Œil de verre/Cache-œil, Dents en bois. Pansement/Guérison
  pendant le combat → `woundDressed` → pas d'Infection post-critique (l.382). Panneau **Afflictions** sur la fiche.
  **Cumuls par comptage** (`Trauma.count` + `consolidateAmputations`/`escalateSensoryLoss`, posés en combat) :
  doigts −5/doigt (4+ → règle de la main), dents −1 Soc/paire, DEUX yeux → Cécité (−30 vue), DEUX oreilles →
  Surdité (−20 Perception). **Crochet** = arme Dague + rachat 400 PX (armes à 2 mains), **arcs/arbalètes** (sauf
  « de poing ») bloqués pour une main amputée.
  **Résidus** : armes à DISTANCE Poudre noire/ingénierie (pistolet vs arquebuse, subType ambigu) non classées ;
  maintien/défaisage du bandage de fracture (l.302 — événement MJ, pas de déclencheur de jeu) ; appliquer
  rétroactivement une amputation à un PJ existant (pas d'Effet/outil d'édition de trauma).
- ✅ **Encombrement** appliqué (pénalités LDB p.295 : Mouvement −1/−2 + planchers, immobilisé
  au-delà de ×3, malus d'Agilité −10/−20 sur l'Esquive ; câblé au combat). ✅ **Fatigue du
  voyage** (LDB 61 l.36-44 : +1/+2 Exténué en fin de journée de route à pied si surchargé) —
  livrée avec #T2 (`travelFlow.travelFatigue`), constatée 2026-06-11.
- **Munitions — bilan 2026-06-11 (sourcé)** : achat ✅ (l'Armurier vend la catégorie
  `ammunition`, réassort #T3) ; **récupération post-combat : AUCUNE règle dans le LDB**
  (vérifié ch.62/63) → écartée (règle 1, rien d'inventé) ; **munitions ennemies** : les
  statblocks n'ont pas d'inventaire détaillé → rien à décompter sans inventer (la simplification
  « ennemis abstraits » est l'application directe des données ; à revisiter si les PNJ gagnent
  un inventaire d'items).

## 🎯 Jalon 6 — Éditeur avancé *(largement entamé — Jalons 0.5 & 0.6)*

- Fait : palette à onglets, triggers/dialogues/rencontres structurés, outil Zone, **bâtiments &
  décors data-driven posés par drag**, inspecteur générique (`ParamFields`), sélection de bâtiment,
  **kind `personnage` unifié** (apparence = ref bestiaire + variante de calque + dialogue/quête).
- ✅ **Sélection d'une zone trigger au clic** (surbrillance + inspecteur : rect, condition, effets, suppr.).
- ✅ **Placement des ennemis sur la carte**, **undo/redo**, **projet multi-scènes** (basculer / lier les
  intérieurs sans toucher `campaign[]`). ✅ **Éditeur de statblocks** (`StatblockEditor.tsx` : nom, 10
  caractéristiques, M/B, dégâts d'arme, armure ; câblé à `spawn.ts` via `statblockToCombatant`).
- ✅ **Passe confort & outils (2026-06-07, livrée + poussée)** : ids stables + **coalescence d'undo**
  (un trait = un cran) · outil **Sélection + glisser-déplacer** (entités/spawns/triggers/bâtiments) ·
  **copier/coller/dupliquer** (Ctrl+C/V/D) · **panneau de validation** (réfs cassées / hors-carte / ids
  dupliqués, clic→fautif ; `validateScene` pur testé) · **liste d'entités** (sélection hors-canvas) +
  **clavier Suppr/flèches** · **recherche** palette créatures · **pinceau 1/3/5** + **remplissage
  rectangle** · **calques masquables** (Zones/Ennemis/Bâtiments — débloque le clic dessous). Modules
  purs : `nextEntityId`, `validateScene` (10 tests). Reportés (mineurs, justifiés) : resize-confirm
  (déjà couvert par la validation), fit-to-view (≡ bouton reset).
- ✅ **Décor interactif** *(constaté livré 2026-06-11 — exécuté en session parallèle)* : le kind
  `objet` est dissous dans `prop` (`interact: { effects, consume }`, migration `sceneMigrate`
  appliquée au chargement), interaction exploration + « Ramasser » en combat re-ciblés, **halo
  d'affordance** (`interact-halo`), **clic-à-distance → déplacement → fouille** (`pendingInteract`),
  bloc « Interactif » dans l'éditeur + **auto-suggestion à la pose** (`propDefaults` : un décor
  `searchable` pré-arme `interact`). Sous-projet 2 livré aussi : sprites lettre/coffre/étagère/
  clé/bourse (+ cercle runique) au catalogue.

## ✅ Jalon 7 — Coop en ligne *(V1 complète — 2026-06-11 ; V2 documentée non engagée)*

- Du hotseat au **réseau** (WebSocket ou WebRTC). **RNG de combat seedable** (`store.seedRng`,
  Jalon 0.6) + état sérialisable déjà en place.
- ✅ **Spec ARBITRÉE** (`docs/superpowers/specs/2026-06-11-coop-en-ligne-design.md`) : WebRTC pur
  **sans broker** (« un code à partager, zéro système externe »), hôte-autoritaire + snapshots,
  combat-only V1 (exploration = miroir de l'hôte), N héros par joueur décidés au lobby, modales
  chez leur seul propriétaire, ready-check début de combat + victoire (portraits + ✓), loot
  synchronisé à dévalidation ciblée, contre-sort multi (RAW vérifié LDB 46).
- ✅ **P0 fondation** *(2026-06-11, `7d943cc`+`f8a9a8a`+`f453197`)* : `src/net/` — codes de
  signalisation (deflate natif + base64url, préfixe `W4C1.`), protocole de messages validés,
  HostSession/GuestSession sur Transport injecté (allowlist d'intents COMBAT gardée par test,
  version check, snapshots, déconnexions → héros à l'hôte), transport WebRTC nu. 16 tests.
- ✅ **P1 lobby** *(2026-06-11, `9e2f7d6`+`7990e69`)* : `netFlow.ts` (état `net` sérialisable,
  interception des actions invité → intents, broadcast throttlé 120 ms, `ownsLocally`) +
  **« 🌐 Jouer en ligne »** au menu — Héberger/Inviter (code) → Rejoindre (code de réponse) →
  attribution des héros par siège → lancement. **Recette 2 onglets PASSÉE** : P2P établi (codes
  ~700-800 caractères), miroir invité (écran/scène/groupe/ownership), session préservée au
  lancement (le reset startScene/load ne dissout plus `net` — bug trouvé en recette).
- ✅ **P2 combat** *(2026-06-11, `64e963f`)* : **modales chez leur seul PROPRIÉTAIRE** (arbitre
  `OWNER_OF` par modale + puce « ⏳ X joue… » chez les autres ; sort ennemi visible partout avec
  contre-lanceurs filtrés par possession), **barre spectateur** quand le combattant actif est à
  un autre joueur, **ready-check d'ouverture** (portraits + ✓ par siège, l'hôte lance à
  l'unanimité des sièges possédant un héros vivant), **rounds suivants enchaînés** sans pause en
  coop (arbitrage). Recette 2 onglets sur WebRTC réel : attaque de l'hôte → modale chez lui +
  puce chez l'invité ; tour de l'invité → barre chez lui + puce chez l'hôte ; ready 1/2 attend,
  2/2 lance.
- ✅ **P3 complet** *(2026-06-11, `24a7fa9`+`0a6dd44`)* : **P3a validation de possession** côté
  hôte (`netOwnership.intentAllowedFor` : modale ouverte → son owner ; sinon le combattant actif ;
  ready/main levée → tous) ; **P3b victoire synchronisée** (ready-check par siège portraits + ✓,
  fermeture à l'unanimité par l'hôte, **butin attribuable à SES héros seulement**) + bouton ✋
  « Pause Round » (rouvre la fenêtre Chance du prochain round) ; **P3c reconnexion** (section coop
  du menu ☰ hôte en partie : ré-inviter par code, réattribuer les héros d'un siège parti) ;
  **REGISTRE unique des modales** (`state/modalArbiter.ts` : une entrée = `when` + `owner`, ordre
  = priorité ; `pickActiveModalKey`/`modalOwnerOf` dérivés — partagé UI + validation réseau).
- **V2 documentée (non engagée)** : recette bout-en-bout victoire/loot à 2 onglets, exploration
  déléguée aux invités, deltas d'état (au lieu de snapshots), dissipation en Test Soutenu à
  plusieurs sur le même Domaine.

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
  vérifié navigateur) ; proportions Mutant homme-chien/tentacule perfectibles ; ✅ **UI d'override
  cosmétique** dans l'éditeur *(vérifié livré 2026-06-11 : Inspector → « 🎲 Relancer » (seed) +
  `MonsterPartsFields` — Sexe, Carrure, Coiffure (slot-picker `HAIRSTYLES`), mutations par slot,
  couleurs, carrière, arme — branché spawns ET entités)* ; **galeries QC** (rig/anim/armes/bestiaire)
  à finaliser et committer (itération visuelle — différée).
- ✅ **Sons (SFX)** *(2026-06-11)* : 19 échantillons **CC0 Kenney** (`public/audio/`, ~220 Ko) ; registre
  `SOUND_DEFS` (`src/audio/defs/` — 11 défs : dés, impact, tranche, parade, critique, sort, pas, gong de
  victoire, pièces, portes — nouvelle famille du gen-registry : **ajouter un son = 1 fichier def**) ;
  moteur `audio/engine.ts` (variante aléatoire, volume+sourdine persistants `wfrp4.audio.v1`) ; câblage
  **par le bus** (`audio/wiring.ts` : `DICE_ROLL`→dés aux 4 boutons Lancer, `ANIM_IMPACT`→critique/sort/
  tranche/contondant/parade selon contexte, `ANIM_MOVE`→pas espacés, `BATTLE_OVER`→gong) ; contrôles
  dans le menu ☰ (`AudioControls`). Recette navigateur : slider+mute visibles, persistance OK, 0 erreur
  console. **Reste** : musique/ambiances de fond (non couvertes par ces packs SFX).
- ✅ **code-splitting** (éditeur/rendu lazy) ; ✅ **CI complet**
  (build:data → typecheck → **ESLint** → tests → build — le lint y est depuis `ci.yml` ; base 0 erreur).
- ✅ **Accessibilité des modales** *(2026-06-11)* : cadre `Modal` partagé = `role=dialog`/`aria-modal`,
  focus déplacé à l'ouverture, **piège de focus** (Tab/Shift+Tab bouclent dans la boîte) et **Échap**
  mappé sur le bouton Annuler/Fermer **exactement quand il est visible** (rien sinon — un jet posé doit
  être résolu, invariant « un jet = une modale » ; seule la modale du dessus réagit). RollFlowShell
  (les 11 flux) + SaveLoad + Attaque suivent ; **CastModal et MountTargetModal convertis au cadre
  partagé** (ils roulaient leur propre overlay sans `role=dialog`). Aria-labels des boutons-icônes
  (menu ☰, carte) livrés au commit précédent. Recette navigateur : Tab boucle dans les deux sens,
  Échap ferme Sauvegarde/Attaque/Ciblage monté, Échap IGNORÉ sur la Défense réactive, 0 erreur console.
  **Suite** : comportement extrait en hook `useModalA11y` (réutilisable par les dialogues au markup
  spécifique) → **DocumentModal converti** (variant `plain` + `backdropClose` — clic-voile préservé),
  **Fiche de personnage** et **Inspection** câblés (role=dialog + piège + Échap) ; focusables filtrés
  aux VISIBLES. **Balayage final** : Cleave (Échap=Terminer), Disengage (Échap=Renoncer en phase
  choix), DualStrike (Échap=Renoncer), Heal-chirurgie (Échap=Arrêter) convertis au cadre ; FateSave
  converti SANS Échap (sacrifier le Destin ou mourir = choix explicite) ; dialogues de l'éditeur
  (Triggers/Dialogues/Rencontres) en role=dialog + piège sans Échap (champs texte — pas de perte de
  modifs sur un réflexe) ; WorldMapEditor = écran plein, exempt. **Plus aucune coquille main.**

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
- ✅ **Vérif NAVIGATEUR — dette du cycle (2026-06-05) RÉSORBÉE** : les recettes listées sont passées
  au fil des sessions suivantes (unification des modales + recettes, refonte HUD BG3 + playtest live,
  scénarios de test marchand/interlude/voyage, Chapitre 2, Engagé/Charge). *(Réflexe conservé : **hard
  reload** avant recette, le HMR du dev se périme.)*
- ✅ **Sprites/animations** (Jalon 8) : **rig 2D composable** livré et testé (équipement visible, tenues de carrière, facing 8-dir, clips par-arme/sort/ambiance ; 17 fichiers de test, 129 tests verts). ✅ **Système d'arme complet (Jalon 0.11)** : maniement clé sur la forme + prises 2-mains, **48 armes au registre** (1 fichier/arme), **couleur tokenisée + skins légendaires** (backend `Weapon.skin`/`ItemInstance.skin`), tenues normalisées, **silhouettes reconnaissables à l'aveugle** (audit + regen best-of-N), ✅ **éditeur de skin d'objet (ARME + ARMURE)** dans la fiche perso (bouton ✨ → aperçu live recoloré + sélecteurs de couleur ; armure tokenisée + `ARMOUR_PALETTES` ; validé navigateur). ✅ **vues dos/profil héros** (cosmetic.ts, nuque/profil corrects) + ✅ **tintage arcane/divin** des sorts (`spell` sur `ANIM_ATTACK` → `spellFx`, gradients `g_arcane`/`g_divine` ; projectile/halo/aura tintés ; validé navigateur). ✅ **Orientation-monde persistante** (2026-06-07) : Dir8 monde projeté au rendu (`project`+camRot) → **rotation caméra ré-oriente**, repos stable (face ennemi/attaquant), éditeur 8-dir, coquille **BodyToken** unifiée, **classifieur `pickBackend`** (4 sites de dispatch collapsés), **non-bipèdes d'exploration animés + orientés** (fin de l'asymétrie sprite figé ; `planStaticSvg` retiré), legacy monolithique retiré. **Fusion des 2 moteurs d'anim ÉCARTÉE volontairement** (verdict adversarial : asymétrie essentielle clips-rig vs poses-plan closed-form ; toute interface unique serait lossy/leaky ; bus reste par-backend). Reste **fin** (pré-existant, hors orientation) : tenues/armes héros dos/profil partielles (repli *face*, désormais un peu plus visible depuis le facing 8-dir), galeries QC à finaliser.
- **Contenu jouable** (Jalon 4) : ✅ **Chapitre 2** « Du Sang Sur la Route » livré et testé ; reste le vrai **Chapitre 1** social (auberge) — `tome1-intro` actuel n'est qu'une démo walk-to-trigger.
- **Persistance** (Jalon 5) : sauvegarde/chargement (localStorage + export/import).
- ✅ **Dette « qualités/traits en données sans code » — RÉSORBÉE** *(2026-06-10/11)* : le **registre
  de qualités** (`engine/qualities/`, Jalon 1.6 Phase 0→C2) couvre les qualités d'arme/armure/artisanat ;
  le **registre de traits** (`engine/traits/` — 40 defs + dispatch + test de parité, Jalon 2.5) couvre
  les traits de créature mécanisables (Peur/Terreur via Psychologie, Régénération, Éthéré, Vol…).
  Ajouter une qualité/un trait = **une entrée de registre** (plus de code éparpillé).

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
