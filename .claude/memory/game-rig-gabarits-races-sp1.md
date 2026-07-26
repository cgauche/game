---
name: game-rig-gabarits-races-sp1
description: "SP1 livré — apparence bipède en 2 registres Gabarit + Race, tables centrales dissoutes, golden gate ; + l'architecture mère « gabarits corporels » (10 gabarits, dispatch générique AnimatedPlanToken, zéro monolithique hors 3 Chaos nommés)"
metadata: 
  node_type: memory
  type: project
  originSessionId: bf030429-e9e6-4510-9862-ce4901c0d820
---

**Sous-projet 1 « Apparence créatures — Gabarits & Races » LIVRÉ (2026-06-08, branche feat/wfrp4-rpg-foundation, poussé).**

Apparence d'un bipède = **Plan × Gabarit (carrure) × Race (peau/tête/traits/posture + défauts d'espèce) × Perso (def créature)**, composition à plat par id. Deux nouvelles familles du registre codegen :
- `src/gameIso/rig/gabarits/defs/<id>.ts` (`GabaritDef` sl/st/legs/arms/head) — a dissous l'ex-`PROPS`.
- `src/gameIso/rig/races/defs/<Race>.ts` (`RaceDef`: gabarit+gabaritOverride, palette/paletteF, pose, head, features, career/colors/sex/parts/scale, monster) — a dissous `SPECIES_PALETTES`, `SPECIES_POSE`, et la config `biped` des defs créature (`bipedConfig` SUPPRIMÉ).

`baseSpeciesOf(species)` (skeletons.ts) RESTE le canonicaliseur (string espèce → 1 des ~20 id de race, gère les variantes héros « Hauts Elfes »/« Nains (Norse) »). `composeRig` résout via `raceById(baseSpeciesOf(species))` ; palette via `racePalette(id,sex)`. **Pour changer l'apparence d'une créature : éditer SA Race (ou son Gabarit), jamais une table centrale.**

**Features échelonnées à l'os** (`featureToPart`, `scale:'bone'|'fixed'`) : `'bone'` suit l'épaisseur de l'os → REMPLIT le corps (gutplate ogre). C'est le cœur du correctif « disque/dalle flottant ».

**Garde-fou** : `src/gameIso/rig/golden/biped-golden.test.ts` fige le SVG résolu (front+profil + héros équipés) → toute refacto reste iso-rendu (0 snapshot bougé) ; changement intentionnel = `-u` + diff vérifié (le rig est partagé avec les héros). A tenu vert sur toute la migration.

Pilote Ogre réparé/enrichi (head:'ogre' + features gut/heaume/brassards) ; tells Nain (barbe ancrée mâchoire), Haut-Elfe/Elfe sylvain (oreilles), nouvelle race Guerrier du Chaos (plastron sombre+cornes), Mutant (cornes+œil+tentacule garantis). Audits aveugles : Ogre/Elfe/Chaos 4/5, Nain/Mutant 5/5. Méthode QC : `docs/qc-reconnaissabilite-sprites.md` (réécrit pour le rig) + `scripts/_qc-creatures-rig.mts`.

**Migration `monster`→`head`/`legs`/`features` FAITE pour les 12 races canoniques** (iso-rendu, golden 0 modifié ; `RaceDef.monster` retiré ; composeRig porte `race.head/legs/armG/armD/dropHeadgear` + garde `hasPersoMonster` = un `perso.monster` non-vide override INTÉGRALEMENT la race — piège Démonette dont `baseSpeciesOf`→`Démon`). Le champ `monster`/`monsterInjection` reste UNIQUEMENT pour l'éditeur + créatures scriptées + les 3 perso (Fimir/Liche/Démonette).

**Reste (hors SP1)** : SP2 quadrupèdes (pattes+corps par espèce, vue profil, tête de loup) ; SP3 sous-espèces. Prolonge [[game-creature-registry]], [[game-qc-reconnaissabilite]].

## Architecture mère « gabarits corporels » (au-delà du biped SP1) — livrée intégralement

Le SP1 ci-dessus n'est que l'axe **Gabarit×Race** des bipèdes. L'architecture complète généralise le rig à
TOUT plan corporel : un **gabarit** = squelette (os+proportions) + pose de repos + ses anims propres
(démarche…) + facing, sur une machinerie DÉJÀ générique et partagée (FK `kinematics.worldTransformsG`,
palette tokenisée `buildTokenMap`/`applyTokenMap`, facing, pose de mort, recolor) — seule la liste d'os
était figée au bipède à l'origine. Objectif utilisateur : pouvoir ajouter tout monstre (2/4 pattes, ailé,
exotique) « pas les mêmes animations que les 2 jambes » ; un dragon = gabarit ailé à grande échelle (taille
= paramètre `sl`, pas un modèle bespoke).

**10 gabarits livrés** (zéro monolithique atteint, audit `creatureSprites.json` : les 57 sprites du
bestiaire rigués/animés) : biped, quadrupède (cheval/loup/sanglier/rat géant/ours…), ailé (griffon/pégase/
hippogriffe/dragon, réutilise intégralement la machinerie quad via `resolveQuadFromProps` + os d'ailes),
serpentin (serpent/sangsue), arachnide (araignée), aviaire (pigeon), céphalopode (pieuvre), spectral
(Spectre/Fantôme/Banshee, buste translucide flottant), squig (boule+mâchoire qui claque), amorphous/hulk
(Bête des marais, masse boursouflée — réutilisable golems/oozes/fenbeasts). Raison du push final : « un
monolithique ne s'anime pas ».

**Routage 100% registry-driven** : `bodyPlanOf = creaturePlanMatch(name) ?? 'biped'` (`EXOTIC_RE` — la
dernière liste de noms en dur — SUPPRIMÉ) ; un seul `AnimatedPlanToken` générique anime TOUT plan
non-biped via ses poses (walk/attack/death + `idlePose` en continu, `AnimatedQuadToken`+
`AnimatedWingToken` SUPPRIMÉS). Ajouter une créature = 1 fichier def rempli ; ajouter un NOUVEAU
squelette = un module compose (BodyPlan exporté) + 1 entrée PLANS + le champ props, AUCUN edit
IsoStage/routage. Monolithique restant = 3 bêtes du Chaos NOMMÉES à l'apparence vraiment unique
(Jabberslythe, Slenderthigh Whiptongue, Fr'hough Mournbreath), gardées par décision utilisateur explicite,
routées par `plan:'monolithic'` (fallback opt-in, pas un legacy qui traîne).
