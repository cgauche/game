---
name: game-mutations-visuelles-rig
description: "Mutations physiques LDB 19 visibles sur le rig (héros + ennemis) — registre mutationVisuals, POC ennemi remplacé, recette navigateur non faite (browser pris)"
metadata: 
  node_type: memory
  type: project
  originSessionId: dbb7bc70-76e7-4534-b7a5-d556ce0815d1
---

Livré 2026-06-11 (commit d312924, poussé) : chaque mutation physique de la table de
Corruption (LDB 19) a son visuel sur le rig — y compris pour les HÉROS mutés par la
Corruption (`Combatant.mutations`).

- **Registre** : `src/gameIso/rig/parts/mutations.ts` — `MUTATION_VISUALS` (clé =
  `mutKey(label)`, apostrophe U+2019 repliée), `mutationOverlaysFor`, `mutationAppearance`
  (morpho : Corpulent/Émacié = delta build, Court sur pattes = `Appearance.legs`),
  `randomMutationOverlays(seed)` pour les ennemis « mutant » (cornes = tell garanti, halo
  Beauté surnaturelle EXCLU du pool — lit « saint »). Test d'exhaustivité contre
  `LABELS_PHYSIQUES` (data/mutations.ts) : casse si la table bouge.
- **Plomberie** : `RigOverlay.view` ('front'…) filtré dans resolveRig (détails de visage
  invisibles de dos) ; `behind` désormais honoré pour les overlays externes (layer −2) ;
  art marqué `<g data-mut="slug">` pour les tests (plus de match de couleurs hex).
- **4 sites héros** : AnimatedRigToken, pickBackend (top combatant + partyLeader),
  MountedToken. Le POC M_HORN/M_EYE/… d'enemyProfile est SUPPRIMÉ.
- **QC sans navigateur** : `npx tsx scripts/_qc-mutations.mts` → 4 planches PNG dans
  `public/qc/` (gitignoré) que je peux LIRE moi-même — pattern utile quand le browser
  Playwright est pris par une session parallèle.
- **Recette navigateur in-game PASSÉE** (2026-06-11, scénario 17) : 4 silhouettes distinctes
  en jeu (corpulent/émacié/cornes/plumes), portraits HUD mutés, détails de visage
  DISPARAISSENT de dos (rotation caméra vérifiée), Mutants ennemis seedés variés,
  0 erreur console.
- **Collisions calque×armure COUVERTES** (planche `mutations-armure.png`, commit 27bec1d) :
  cornes derrière le casque ✓, pus/bouche SUR la cuirasse = convention paper-doll assumée
  (lisibilité d'abord, comme verrues/plaie monstrous) ; sabots redessinés (couvrent
  talon→pointe + liseré clair, sinon invisibles sur bottes sombres).
- **Règle utilisateur (2026-06-11)** : une mutation CORPS ENTIER (Peau d'acier/Écailles/
  Brillante) = recolorisation PALETTE (`MutationVisual.skin` → `colors.peau`, ombres dérivées,
  visage+mains compris), PAS un patch de torse ; un MEMBRE muté (Tentacule épais) = REMPLACEMENT
  du membre (`RigOverlay.replace`, part monstrueuse du registre monster/, poing effacé) —
  « le rig est assez complet, voir comment les créatures sont personnalisées » (commit 566d7aa).
- **Intégration armes (commit fb74903)** : armes NATURELLES de mutation au loadout
  (`recomputeLoadout` : trait Tentacules → arme Tentacule +BF uid `nat-tentacule` ; mutation
  Cornes asymétriques → arme Cornes +BF, LDB p.338 Dégâts=BF) + **Attaque GRATUITE de
  tentacule héros 1/tour** (bouton Spécial 🐙 → `battle.action='tentacle'` → `battleTentacle`
  → modale d'attaque standard avec `PendingAttack.freeTentacle`, Action préservée, Empêtré
  sur Dégâts via `applyFreeAttackEffects`, reset `tentacleUsedThisTurn` en fin de tour).
- **Amputations/prothèses VISIBLES (commit b6e60c6)** : `rig/parts/injuries.ts` — même
  architecture que les mutations (trauma + prothèse PORTÉE → calques/replace) : moignon bandé /
  Crochet / main mécanique (Merveille) sur `mainG/D` ; Fausse jambe = pilon (jambe remplacée,
  pied effacé — SANS prothèse la jambe peinte reste, choix assumé pour la marche) ; Œil perdu =
  cicatrice/Cache-œil/Œil de verre, Cécité = bandage, Nez amputé/Nez doré (face seulement).
  **Source unique `combatantVisuals.ts`** (`combatantOverlays`/`combatantAppearance` = mutations
  + blessures) consommée par les 4 chemins de rendu — un futur visuel d'état se branche LÀ.
  Synonyme arme `crochet: ''` (le crochet est SUR la main, pas tenu). Section galerie dédiée.
- **Visage inversé = flip du VRAI visage** (commit 887e3e1) : `Appearance.faceFlip` → resolveRig
  retourne le slot `visage` (pivot y≈7), cheveux/crâne en place — pas d'art générique plaqué.
- **Textures paramétriques réutilisables** (commit c7756d6) : `rig/parts/textures.ts` —
  `plume()/plumeFan()/scalesPath()/scalesPatch()`, motifs SVG en tokens de palette, CONÇUS pour
  être exploités par tout le système de créatures (harpie, homme-lézard, crêtes…). Demande
  utilisateur explicite : « de la créativité, ce qu'on fait sera exploité pour les créatures ».
  Plumes éparses = éventails 2 épaules + crête derrière crâne + avant-bras ; Écailles = texture
  imbriquée tempes (front-only) + mains. Patterns SVG (defs) écartés : cassent la dérivation
  d'ombres @peauO/@peauH de la palette.
- **Règle utilisateur PEAU VISIBLE (commit 3cd8a23)** : une marque DE PEAU plate (bouche
  parasite, pus, éclats de lustre) ne se dessine JAMAIS par-dessus les vêtements (le RAW tire
  des Localisations, il ne perce pas l'habit) → visage/mains seulement. Les EXCROISSANCES 3D
  (cornes, épines, plumes, tentacule, pattes) peuvent percer habits/armure. Pattes d'animaux =
  jambes REMPLACÉES par LEGS['chevre'] (satyre) ; Bouche supplémentaire = gueule dentée au front.
- **Galerie officielle** (commit d8fc569) : `scripts/gen-mutations-gallery.mts` →
  `public/mutations-gallery.html`, dans `npm run galleries` + carte du hub ; le one-off PNG
  `_qc-mutations.mts` est SUPPRIMÉ (pour un contrôle PNG ponctuel : mini-script jetable resvg).
- **Main raccordée au bras — GÉOMÉTRIQUE** (commit ac949c0, remplace le pont de chair de
  25f324b jugé « moche, pas dans l'esprit ») : pivot du poignet à 14 (au lieu de 18) dans le
  squelette de réf → chaîne FK (18+14=32) = fin du bras peint (32 u). Zéro art rapporté.
- **SYSTÈME D'YEUX (commit 871134d)** : l'œil peint est un élément ADRESSABLE des 10 têtes
  générées (`<g data-eye="G/D" data-ec="x y">`, codemod one-off ; entrelacement Halfling:F
  réparé main). `parts/eyes.ts` : `swapEye/applyEyes` remplacent l'œil EN PLACE sur la vraie
  orbite par espèce/sexe + catalogue `EYE_OPTIONS` (verre, perdu, cache-œil redessiné, chat,
  caprin, reptilien, noir, rouge, énorme) — demande utilisateur : exploitable pour des yeux
  d'animaux custom (créatures/éditeur). Canal `Appearance.eyes{G,D}` appliqué dans resolveRig.
  Œil perdu/prothèses oculaires (`injuryAppearance`) et mutation Œil énorme (`MutationVisual.
  eyeG`) migrés dessus — plus de calque d'œil à coordonnées fixes.
- **Textures → créatures** (commit c0f2a54) : `furPath/furPatch` ajoutés ; pelage Homme-bête +
  Minotaure (poitrail/épaules), écailles Fimir (torse/épaules/cuisses). ⚠ PIÈGE appris :
  `perso.monster` (creature def) COURT-CIRCUITE les `race.features` (hasPersoMonster skip,
  composeRig) — le Fimir a migré tête cyclope/queue/couleur du perso.monster vers la RACE
  (head/palette/features). Galeries toutes régénérées+commitées (6020242).

- **TRAITS → visuels (commit fac034f)** : `parts/traitVisuals.ts` dans combatantVisuals —
  Cornes/Attaque caudale/Tentacules/Vol du STATBLOC deviennent visibles (PNJ custom d'éditeur
  + sorts grantTrait : « Envol » affiche les AILES de `parts/wings.ts`, 3 vues). ANTI-DOUBLON :
  race avec feature `behind` sur le même os (Gor/Minotaure/Démon tete, Skaven/Fimir bassin)
  fait foi. Furie du Chaos gagne ses ailes canon.
- **Yeux de RACE (b27e979)** : `RaceDef.eyes` (défaut, surchargé par Appearance.eyes) — Vampire
  aux yeux rouges braise ; l'œil de secours de cosmetic.ts (espèces SANS tête générée, ex.
  Vampire) porte aussi les ancres data-eye. PIÈGE appris : `baseSpeciesOf('Vampire')` n'a pas
  de tête générée → tombe sur la table VISAGE de secours, pas sur Humain:M.
- **Textures plans (bbfc5f5)** : scalesPatch/furPatch paramétrés par famille de tokens
  (`peau`/`corps`) ; Dragon = écailles de flanc, Griffon/Hippogriffe = collerette emplumée
  (le plan winged réutilise resolveQuadFromProps/quadParts — tête 'aigle' partagée).
- **RigOverlay.plane 'fond'/'avant' (commit dc4a35d)** : entrée z PROPRE dans le repère de
  l'os hôte — indispensable pour les AILES (le z inégal des bras, G=4/D=8, cassait la symétrie
  d'un calque torse z5) : fond de face/profil, avant de dos. Queue de trait redessinée
  (déborde la hanche + touffe, sinon invisible derrière le bassin).
- **RÈGLES DORSALES CODIFIÉES (commits 8b61ed2 + c1cd406)** — réponse au « on retombe sur ces
  bugs à chaque nouvel art » : `parts/dorsal.ts` `dorsalOverlays(bone, {front,back,profile})`
  encode une fois : face = plan fond, dos = plan avant, **profil = calque d'os NORMAL ancré au
  bord arrière (−x)** — relégué au fond la racine est occultée et l'appendice « flotte ».
  Ailes + queue migrées dessus ; tout futur appendice (cape, aura) DOIT l'utiliser.
  + section galerie « Traits 3 vues ». TOUJOURS raster les 3 vues et les REGARDER avant de livrer.
- **UN SEUL traitement des calques (c1cd406)** — l'aile éditeur (monster.ailes) divergeait du
  trait (sous le bras droit de dos) car composeRig avait DEUX boucles : les overlays de
  monsterInjection rejoignent désormais LA MÊME file que mutations/blessures/traits —
  plane/view/behind/replace n'ont qu'une implémentation, l'éditeur ne peut plus diverger.
- **Éditeur (commit 0792376)** : `EntityAppearance.eyes` (CLÉS d'EYE_OPTIONS, résolues dans
  riggedAppearance — source unique explo/combat) + `MonsterPartsSel.ailes` ; sélecteurs Œil
  G/D + case Ailes dans MonsterPartsFields (entité + spawn). Règle utilisateur réaffirmée :
  TOUT visuel nouveau doit être paramétrable/surchargeable dans l'éditeur.
- **Animations d'attaque — liaison** : bipèdes = clip par CLASSE DE MANIEMENT de l'arme
  (forme) ; plans = pose par TYPE d'attaque (creatureAttackPoses) ; le Jabberslythe a son
  FOUET DE LANGUE bespoke. **Gestes naturels câblés (commit 087b7de)** : `NATURAL_HANDLING`
  (handling.ts) route Tentacule → classe `entraves` (fouet) MIROITÉ sur le bras GAUCHE
  (le membre muté remplace ce bras — `mirrorClip` dans weaponClips) et Cornes → nouvelle
  classe `cornes` (coup de tête : recul puis projection tête/torse, parade = se couvrir).
  Clip fouet musclé (grand armé, snap easeOutBack, suivi). Galerie anims : 17 armes.
  **Refactor qualité (39dc50f + 0c2c1d5)** : POC corrigé en profondeur — useRigAnim jouait
  TOUJOURS les clips de l'arme PRINCIPALE ; l'arme employée ET `res.parryWeapon` voyagent dans
  ANIM_ATTACK ; attaque ET parade sont MIROITÉES pour une arme en main gauche (`hand:'off'`)
  ou un membre gauche muté. Règle : « le geste se joue sur le bras qui tient l'arme ».
- **CHUTE/RELEVÉ ANIMÉS (5a45730)** — clôt l'ANIM_DEATH différé : bipède = la bascule au sol
  (82°/72°) devient une TRANSITION CSS en sandwich translate·rotate·translate (unités locales —
  PAS transform-origin : le token iso n'a pas de viewport propre, l'origine viserait la scène) ;
  relevé animé gratuit. Plans = effondrement lerp repos→couché (easeOutCubic 420 ms) sur la
  transition ; montage déjà-au-sol = pas d'anim. ⚠ Recette NAVIGATEUR de la chute EN ATTENTE
  (Playwright verrouillé par la session //) — tuer un ennemi en combat et regarder la chute.
- **Pose AU SOL + réactions des plans (2480431)** : `groundPose.ts` (pur, partagé bipède/plan) —
  `corpse` (hors de combat/Inconscient, sprawl 82°) vs `prone` (À Terre CONSCIENT : coude
  relevé, tête redressée, 72° ; plan = pose de mort couchée). Un héros à 0 PB reste DEBOUT
  visuellement sauf condition (RAW l.28). Les gabarits non-bipèdes gagnent recul d'impact
  (ANIM_IMPACT) + dérobade sur esquive — cloche sin sur tronc/encolure/tete (quad/winged
  seulement, mêmes os que creatureAttackPoses).
- **VOLET RIG DU JALON 8 CLOS (e818444)** : tenues dos ✓ (substitution générique), armes de
  dos ✓ re-QC = repli front LISIBLE (chantier 48 arts directionnels NON justifié, clos sur
  constat), proportions Mutant ✓ re-QC OK post-refonte, galeries ✓. Reste hors-rig : art des
  bâtiments.
- **Dos générique des tenues (commit cc2d456, roadmap Jalon 8)** : audit — les 64 tenues de
  CARRIÈRE générées ont dos+profil (113/113 slots, E·7) ; le trou = les 9 archétypes de CLASSE
  + carrières sans art (Berger, Pamphlétaire) + Nu, qui plaquaient l'art de FACE dans le dos.
  Fix systémique : `BACK_TORSE/JAMBE/TETE` en tokens du tissu dominant substitués dans
  resolveParts (même principe que PROFILE_*) ; ceinture omise sur dos nu. Les 48 ARMES restent
  front-only (jugé acceptable au QC profil — chantier d'art directionnel possible) ; autres
  restes roadmap rig : proportions Mutant, clip d'attaque « fouet » pour Tentacule héros.
- **Jambe amputée SANS prothèse = invisible par CHOIX** (marche absurde sinon) ; option
  béquille = chantier d'animation discuté, non lancé.
- **CLIPS D'ATTAQUE MONTÉS (b0363af)** — clôt le dernier différé animation de la roadmap :
  `mountedAttackClip`/`mountedParryClip`/`seatedClip` (weaponClips.ts) + `useRigAnim {seated}`
  (MountedToken). Charge lance couchée (lance RESTE en arrêt), taille/estoc/2-mains depuis le
  port dressé, arbalète/pistolet en joue (les clips TIR à pied étaient déjà bons → repli assis).
  Règles : un geste assis ne touche JAMAIS bassin/cuisse/tibia/pied (ancrage selle) ; cavalier
  seated ignore ANIM_MOVE (sinon il « pédale » le clip walk à pied sur la selle).
  ⚠ PIÈGE DE CALIBRAGE (sonde FK, vaut pour tout art rig futur) : angle MONDE de l'arme =
  tenue + (arme+epauleD+avantBrasD+torse), additif strict ; mais en PROFIL NATIF (non-miroité)
  epauleD/torse POSITIF = poing/buste vers l'ARRIÈRE — une frappe projette en NÉGATIF et
  compense par `arme`. Ne PAS calibrer à l'œil sur la planche : sonder l'angle (atan2 de la
  matrice de l'os) avec un script jetable. QC pérenne : section « En selle » de
  public/clip-anim-gallery.html (ids d'os cavalier/monture collisionnent → suffixe par index).

Prolonge [[game-rig-gabarits-races-sp1]] + [[game-supprimer-legacy]].
