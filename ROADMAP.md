# Feuille de route — RPG Warhammer Fantasy v4 (web)

Statut au 2026-06-05. Architecture **data-driven** : moteur de règles pur + testé,
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

## 🎯 Jalon 1 — Profondeur des règles de combat *(quasi complet — reste : Maladresses, distance fine)*

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
- **Critiques** ✅ : tables de Blessures critiques par localisation (LDB 18-Traumatisme, verbatim) — **0 PB ≠ mort** (À Terre→Inconscient après BE rounds→mort si critiques cumulées > BE), déclenchées par **overkill** (dégâts > PB courants, −20 si > BE) ou **double**, **Mort Subite** pour les figurants ; effets long terme (amputation/fracture/déchirure) journalisés (→ Jalon 5). `isOutOfAction` corrigé (`wounds≤0` ne tue plus un héros). **Maladresses** : reste.
- **Distance** : ✅ **bandes de portée** (Bout portant→Extrême, hors-portée bloqué) ; ✅ **munitions + rechargement** (héros) ; reste ligne de vue, couvert.
  - **Munitions = équipement** (`kind 'ammo'`, `subType`/`qty`) : le joueur **choisit** sa munition (sélecteur hotbar), le tir **combine arme + munition** (Dégâts + Atouts, ex. Empaleuse de la Flèche), 1 consommée par tir. **Rechargement** = défaut **« Recharge N »** = **Test étendu de Projectiles** (`63 - Armures.md` l.28-29 + `12 - Tests.md` l.199-211) → **modale** `pendingReload` (cumul de DR jusqu'à l'Indice ; l'Arc, sans Recharge, tire chaque Round). Ennemis = abstraits (tirent librement). Reste (Jalon 5) : munitions ennemies / achat / récupération, talent Rechargement rapide.
- ✅ **Qualités/Défauts d'armes** (Précise, Pointue, Perforante, Empaleuse, Assommante, Défensive, À enroulement, **Pistolet**, **Recharge**).
- ✅ **Pas de tir en Combat rapproché** (LDB Armes l.297-298) : une arme à distance sans l'Atout **Pistolet**
  ne tire pas en étant Engagé/au contact → l'arme est choisie selon la distance (`attackWeapon`), et
  l'IA frappe en mêlée plutôt que de canarder au loin quand un adversaire est à son contact.
- ✅ **Esquive vs Parade** comme choix défensif réel (meilleure valeur, Encombrement inclus) ; reste armes à 2 mains, bouclier.
- ✅ **États pleinement actifs en combat** (pénalités de test non-cumul, bonus attaquant, dégâts par round ; **Sonné** = +1 Avantage à l'attaquant en mêlée, récupération par Test de Résistance puis Exténué, **« incapable d'Action » + déplacement à demi-Mouvement** côté joueur ET IA — tous corrigés via audit de fidélité).
- ✅ Dépense de **Chance** en jeu : relance (**1×/Test, et seulement sur un d100 propre raté** — 2 bugs corrigés), **+1 DR** cumulable, et **Détermination** (retirer un État, +1 PB si À Terre) — modales attaque/défense/hors-combat/incantation/désengagement (composant partagé `ChanceButtons`) + slots hotbar + **modale d'ordre de Round** (3ᵉ usage : agir en premier en dépensant 1 Chance, `RoundStartModal`).
- ✅ **Destin & Résilience sacrifiés** (LDB ch.17) : **« Comment ça a pu rater ? »** (annule un coup létal) et **« Meurs un autre jour »** (survit éjecté, `outOfRencontre`) via suspension `pendingFateSave` (coup létal + mort lente) ; **« Je ne faillirai pas ! »** = réussite garantie (opposé DR +1) dans les 5 modales. Reste : « Je te renie ! » (dépend d'un système de Corruption/mutations non modélisé) et le choix de localisation d'un Critique.
- ✅ **Barre d'action en bas** (hotbar) qui suit le combattant actif (déplacer/attaquer/incanter/**utiliser un objet**/défensive/fin).
- ✅ **IA d'ennemi enrichie** (cible le plus faible, tir à distance, sorts, Esquive/Parade, **Charge** —
  `state/ai.ts` pur+testé). Simplifications IA assumées (revue de fidélité) : l'IA **ne se désengage
  pas** et **charge en portée de Marche** (pas de Course) — mineures, documentées dans le code.

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
  Réactivité par le bus (`ANIM_MOVE`/`ATTACK`/`IMPACT`). **Facing 8 directions** (front/dos/profil +
  miroir) pour héros **et** monstres.
- ✅ **Sprites de carrières** : assurés par le **rig** (apparence = espèce + tenue de carrière + morpho
  + équipement) — plus de spritesheet figé par carrière à dessiner.
- ✅ **Reprise des sprites de bestiaire ratés (galerie QC)** — régénérés via workflow
  best-of-2 (lecture art officiel + desc canon + consigne silhouette) : ~52/57 redessinés,
  fin du vert mutant par défaut, silhouettes reconnaissables.
- **Reste (fin)** : vues **dos/profil** des tenues/armes héros partielles (Garde fait main, le reste en
  fallback front) ; **tintage arcane/divin** des sorts (ajouter `spell: label` à l'emit `ANIM_ATTACK`
  de `store.castSpell`) ; **Dragon / Manticore** encore en sprite monolithique (hors rig) ; proportions
  Mutant homme-chien/tentacule perfectibles ; **UI d'override cosmétique** dans l'éditeur (slot-picker
  + 🎲 seed) ; **galeries QC** (rig/anim/armes/bestiaire) à finaliser et committer.
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
- **Combat — reste** : ✅ **« ramasser » en plein combat** (un objet au sol *à la fois*, réutilise `objet`/`search`, persiste party — `battlePickup`) ; ✅ **Chance étendue** : relance **1×/Test sur jet propre raté** (fix de 2 bugs), **+1 DR** cumulable, **Détermination** = retirer un État (+1 PB si À Terre, n'importe quel État : Surpris/À Terre/Hémorragique…). ✅ **Blessures critiques & mort** (LDB 18-Traumatisme : 0 PB ≠ mort → À Terre→Inconscient→mort si critiques > BE, overkill/double, tables par localisation, Mort Subite figurants ; `isOutOfAction` corrigé). ✅ **Destin/Résilience sacrifiés** (« Comment ça a pu rater ? », « Meurs un autre jour », « Je ne faillirai pas ! » ; `pendingFateSave`/`outOfRencontre`). ✅ **Munitions + rechargement (héros)** : munition = équipement avec **choix joueur**, tir = **arme + munition** combinées (1 consommée/tir), **Recharge N = Test étendu de Projectiles par modale** (`pendingReload`, cumul de DR jusqu'à l'Indice ; Arc tire chaque Round). Reste : **Maladresses** ; Distance : ligne de vue / couvert (au-delà des bandes de portée) ; munitions ennemies / achat / récupération (Jalon 5). *(✅ 3ᵉ usage de la Chance — pré-emption d'initiative — fait.)*
- **Simplifications IA assumées** (mineures, documentées) : l'IA **ne se désengage pas** ; l'IA **charge en portée de Marche** (pas de Course).
- **Vérif NAVIGATEUR — dette du cycle** : toute l'UI livrée cette session est **couverte par tests/typecheck mais jamais vue en live** (profil Playwright monopolisé par la session rig parallèle). À repasser à l'œil : modales attaque/**détail des jets opposés**/défense/**incantation**, **panneau Avancement** (achat de PX), action **« Utiliser »** (potions), **fouille** de corps, éditeur **« À la victoire »**, scène **Chapitre 2**, hotbar, Engagé/Charge. *(Penser au **hard reload** : le HMR du dev se périme souvent.)*
- ✅ **Sprites/animations** (Jalon 8) : **rig 2D composable** livré et testé (équipement visible, tenues de carrière, facing 8-dir, clips par-arme/sort/ambiance ; 17 fichiers de test, 129 tests verts). Reste **fin** : vues dos/profil héros, tintage arcane/divin (`spell` sur `ANIM_ATTACK`), Dragon/Manticore (hors rig), UI d'override cosmétique éditeur, galeries QC à finaliser.
- **Contenu jouable** (Jalon 4) : ✅ **Chapitre 2** « Du Sang Sur la Route » livré et testé ; reste le vrai **Chapitre 1** social (auberge) — `tome1-intro` actuel n'est qu'une démo walk-to-trigger.
- **Persistance** (Jalon 5) : sauvegarde/chargement (localStorage + export/import).

### Dette « historique » (détail)

- ✅ **Sprites par équipement reflétés** : le **rig 2D** compose arme + armure depuis le `Combatant`
  (`gameIso/rig/parts/equipment.ts`) — fini les sprites figés par carrière.
- Sprites de bestiaire **régénérés** (workflow best-of-2, fidélité silhouette + palette) ;
  restent quelques complexes perfectibles (Dragon, Manticore, Mutant). Le SVG dessiné main
  plafonne sur les gros ailés.
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
