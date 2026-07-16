---
name: game-arene-editor-data-project
description: "L'arène = projet de DONNÉES éditeur (hub + 4 zones tactiques) + Médecin PNJ (vente soins/prothèses + actes payants medicalAid)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4e6c5100-25b0-4b77-aea8-b26dd13e5d75
---

L'**arène** est un **projet de scènes pur** : `src/scenes/arene/arene-projet.json` (généré par
`scripts/arene/generate.mjs` — **Arène 2.0**, bundle cloud FF `23365f6` 2026-06-11 ; l'ancien
`scripts/_author-arene.mjs` existe encore mais est SUPERSÉDÉ ; le JSON reste l'artefact éditable).
**CAMPAGNE DE LANCEMENT** : `campaign.ts` importe le JSON, « Nouvelle partie » y démarre.

**ARÈNE 2.0 (Jalon 8.7, 5 commits f0c7341→23365f6)** : 20 scènes (24×16 à 40×28) — **Bourg**
hub extérieur 32×22 (taverne/chapelle à intérieurs door+transitionBack, forge/échoppe cutaway,
4 marchands/PNJ dont Tavernière, horloge jour/nuit) ; 13 zones refaites en grand (ids/flags
conservés, fouilles piégées, 2ᵉ rencontres optionnelles, sorciers ennemis à spells, Horreurs EDO,
corruptionExposure/maladies/cauchemars, learnSpell, réveil anticipé du dragon via Discrétion) ;
**carte du monde #T2** (4 lieux/4 routes, diligence, perilDie, embuscade) + 3 expéditions de
contrat ; finale = titre de champion (document + 100 XP + interlude). Props multi-cases rendus à
l'échelle de leur empreinte (`foot`). Tests réécrits (36) + scénario navigateur `18-arene`.
Authoring documenté dans CLAUDE.md (§ arène). **C'est une DÉMO pour
montrer la PUISSANCE du système** (le user : « améliore le système au besoin, mais GÉNÉRIQUE/éditeur,
pas de hack arène » — cf. [[feedback-contenu-donnee-editeur-pas-code]]).

**AUTORAT EN CARTES ASCII** (commits b4494c4/8556419, 2026-06-08) : `_author-arene.mjs` = un décodeur
de grilles ASCII (1 char = 1 tuile) → layouts cohérents PAR CONSTRUCTION (vraies enceintes/piliers/
couloirs/herses en terrain `mur`, qui rend en bloc 3D `wallBlock` + bloque vue/déplacement). Le user
exigeait de VRAIS MURS (« y'a même pas de mur, empilement d'objet aléatoire ») → l'ASCII les pose.
**Le décodeur accepte des LÉGENDES PAR ZONE** (`spec.terrain`/`spec.decor`, char→id) qui ÉTENDENT les
globales (TERRAIN_CH/PROP_CH) : le mono-char global ne tenait pas 56 props, donc chaque salle réutilise
ses symboles locaux (zéro collision). `roster` (char→ennemi), `ridesChar` résout le cavalier vers la
monture. **Footprints** : un grand (2×2/3×3/4×4) = UN seul char-anchor (coin NO), garder N×N de sol
libre vers +x/+y (test golden valide le footprint ENTIER marchable).

**13 zones (hub + 13 = 14 scènes), rampe LONGUE croissante, topologie UNIQUE par salle** : 1 Cour
(sable) · 2 Ruines murs brisés irréguliers (dalle) · 3 Égouts NUÉE canaux (sol+eau) · 4 Charnier
niches/Peur+butin (ossuaire) · 5 Lices CAVALERIE murée (terre) · 6 Marais EMBUSCADE organique (herbe+
boue) · 7 Nid POISON Vouivre Énorme (tourbe) · 8 Fosse Minotaure/pilier (roche) · 9 Caverne Troll/herse
(pierre) · 10 Nid de Vermine HORDE skaven labyrinthe (pave) · 11 Cercle Maudit CHAOS Champion/Corruption/
Démoniaque (sang) · 12 Sépulcre TERREUR caveau-niche (marbre) · 13 Antre FINALE Dragon MONSTRUEUX 4×4 +
Souffle ténèbres + coulées de lave (cendre+lave). ~30 créatures du bestiaire (Snotling→Dragon, +Rat
géant/Zombie/Ungor/Squig/Fantôme/Banshee/Chamane-Brey/Cultiste). **10 terrains ajoutés** (sable/ossuaire/
roche/pierre/marbre/cendre/tourbe/sang/lave/boue = TerrainDef + dégradé g_* dans sprites.ts ; lave=
infranchissable). **34 props thématiques ajoutés** (1 def/fichier `catalog/decor/defs/`, registry codegen
`npm run gen`) : mannequin/rack-armes/étendard/tribune/barrière/rack-lances, colonne-brisée/arche-ruine/
gravats, grille/détritus, ossements/tombe/sarcophage/urne/chandelier, roseaux/souche/menhir, toile/cocon/
champignon, stalagmite/rocher/marmite, terrier/cage/roue-dentée, cercle-runique/autel/pieu/crâne-monstre,
tas-or/œuf-dragon. Boîte 120×150 pieds (60,150), ombre au sol, fills plats, classes d'ambiance existantes
(`warm`/`glow`/`sway`). QC = planche-contact `scripts/_qc-decor-sheet.mts` → `public/qc-decor.html`.
Props authored par WORKFLOW (1 agent/prop, écrit son def) puis relu au navigateur — l'art à l'aveugle
reste relu (cf. [[game-bestiary-sprite-bar]]).

**Fix cheval allié** (pickBackend) : un acteur NON-bipède basculé allié (`side:'ally'` → `kind='hero'`
dans store) doit garder son GABARIT (plan), pas devenir un humanoïde — on route par PLAN CORPOREL
(`classifyEnemy(name)==='rig'`), PAS par `kind` (qui est surchargé PJ-bipède OU allié-créature). Vérifié
au navigateur (scénario « Combat monté » : Cheval rendu en QUADRUPÈDE).

**Ne pas surcharger les zones du début** (premiers niveaux faciles ; chaque mécanique = une zone à son
palier). UI nettoyée : plus de « Dormir » global ni « Octroyer +PX ». Maître = look Répurgateur + épée
bâtarde, Médecin = look Apothicaire. Régénérer : `node scripts/_author-arene.mjs` puis tests `src/scenes/arene/*.test.ts`.
Plus de helper `arena()` ni de `WAVES.map()` pour elle. Boucle 100 % données : on entre dans une zone
tactique (terrain + couvert : statue/tonneaux/charrette/bois/eau/murs) → un **trigger `once`** déclenche
`startCombat` → `onVictory` donne argent/XP/loot + pose `zoneN_clear` + `transition` vers le **hub** →
la porte de la zone suivante (choix de dialogue) est gated par le flag. Bestiaire réel par palier
(Snotling/Gobelin → Troll/Minotaure). Authoring via `scripts/_author-arene.mjs` (one-off qui ÉMET le
JSON ; le JSON est l'artefact éditable — le script n'est pas du runtime). Tests : `src/scenes/arene/*.test.ts`.

**Hub** : maître d'arène (= marchand `armurier`) + **Médecin** (PNJ). Le Médecin :
- vend **soins (Herbes et potions, LDB 72) + Prothèses** via l'archétype marchand `medecin`
  (`src/state/merchants/defs/Medecin.ts`, curatifs garantis en stock). Cf. [[game-marchand-v1]].
- propose des **actes de soin PAYANTS** (Effet générique `medicalAid`, exposé dans l'EffectList) : le
  PNJ (JAMAIS dans le groupe) fait un jet de Guérison/Chirurgie de SA compétence (skill/intBonus sur
  l'Effet ; nom/id de l'entité via `entityId`), prix = coût du choix de dialogue (LDB 75, 4-6 pistoles).
  `act` = wounds | bleed | surgery. Le JOUEUR choisit la cible (`pendingHeal.candidateIds` + sélecteur HealModal).

**Butin de victoire — 2 effets DISTINCTS (à garder)** : `giveItem` = objets de GROUPE non-équipables (quête/handouts « Lettre/Affidavit », babioles à vendre « Anneau/Médaillon » → liste `store.inventory`, attribuables sur l'écran) ; `giveTrapping` = vrai ÉQUIPEMENT à stats sur un héros (arme/armure + `qualities`/`identified`/`skin` magiques). **L'arène donne son loot en `giveTrapping`** (Dague Dévastatrice non identifiée, etc.). **Fix 2026-06-11 (`799a3da`)** : à la victoire, les `giveTrapping` de `onVictory` ne partent plus d'office au 1er héros — ils vont dans `pendingVictory.gear` et l'écran de victoire affiche une section « Équipement — qui l'emporte ? » ATTRIBUABLE par portrait (qualités conservées, ✨ si magique) ; reliquat non attribué → 1er héros à la fermeture. Aucune donnée d'arène changée (le manque était moteur). `assignVictoryGear(index, heroId)` + capture dans `checkBattleOver`. Cf. [[game-playtest-feedback-2026-06-10]] #9.

**Chirurgie = Test ÉTENDU de Guérison** (LDB 10 l.154 / 12 l.200) : `surgeryPass` cumule le DR jusqu'à
la cible (5-10, défaut 7 ; repart à 0 sous 0) ; CHAQUE passe = 1d10 PB + 1 Hémorragie ; à 0 PB l'op
s'interrompt ; à la cible → `removeSurgicalTrauma(idx choisi)` + Résistance +20 ou Infection. Corrige
AUSSI la chirurgie du groupe (`healConfirm` partagé). Audit consumables : Potion de guérison/vitalité,
Soude commune, Faxtoryll ACTIFS (combat+hors) ; Cataplasme/Racine/Tonique/drogues = passifs. Le
parseur consumables exige désormais un contexte de RÉCUPÉRATION (récupérez/regagnez/soigne) pour lire
un soin → un poison d'arme/drogue (Lotus noir/Bonnet de fou : « subissent/perd N Points de Blessure »)
ne soigne plus (corrigé). Cf. [[feedback-contenu-donnee-editeur-pas-code]].
