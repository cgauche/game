---
name: game-rig-datadriven-sweep
description: "Chantier « tout le rig/apparence en defs ou JSON » — ce qui est fait, reclassé, et le reste"
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d554361-2e93-48b6-aa3d-8aeb9375d029
---

Suite à l'audit exhaustif (workflow 8 agents) du non-data-driven, chantier de migration en 5 phases
(2026-07-04). Méthode partout : **empreinte comportementale byte-identique** avant/après + goldens + suite.

**FAIT (commits, byte-identique vérifié) :**
- **Code mort** (`12386c38`) : `headViews.json`, `MATERIAL_FILL`+switch (inatteignable), `SKILL_CHAR` (0 conso).
- **Tête/cheveux → defs** (`5d34f628`) : `GENERATED_HEADS`→`heads/defs/<Race>-<Sexe>.ts`, `HAIRSTYLES`+`HAIR_VIEWS`+
  name-matcher `hairArchetype`→`hairstyles/defs` (profil/dos bakés, `order`). Empreinte `cosmeticPart` 7296 cas. −11 scripts.
- **Nuées → defs** (`add76623`) : `SWARM_FORMS` (Record central)→`swarm/defs` + registre auto. Empreinte `swarmSvg` 66 cas.
- **baseSpeciesOf → JSON** (`2b0e1939`) : if-chain 22 règles espèce→race → `data/speciesRace.json` (op prefix/includes/all+any,
  ordonné). Empreinte 1119 espèces. « Ajouter un mapping = 1 ligne JSON. »

**RECLASSÉ « laisser »** (le critic les avait sur-signalés par analogie inversée) : `wings.ts`/`cape.ts` =
appendices GÉNÉRIQUES procéduraux (comme les silhouettes `resolve.ts`, classées OK) ; seul le HEX emplumé
figé est un vernis optionnel, pas une migration defs.

**monstrous → 100% defs/ : FAIT** (2026-07-04, suite `82c3f416`). D'abord name-matcher→donnée sur la tête ;
puis multi-vues + unification en registre (cf. [[game-appendages-registry-unified]]) ; **enfin `monsterOverlays.ts`
SUPPRIMÉ** — plus UNE string SVG inline dans la couche monstre :
- cornes/queue → `appendages/defs/<id>.ts` (9, art `{front,back?,profile}`, `d91137f3`).
- griffes/crocs/plaie/verrues/membres démon/stries → OWNED par leur `elements/defs/<key>.ts` (`GRIFFES_ART`… +
  nouvel élément `membres-rouges`) ; monsterInjection + 5 creatures/defs importent de là (`35df28f1`).
Byte-identique partout (goldens 1683, suite 8618, tsc 0).

**Reste de l'inline SVG rig — TOUT SOLDÉ** (2026-07-04, audit workflow 5 agents+critic → 6 fichiers,
migrés byte-identique, suite 8619 verte). Registres defs/ créés : `appendages` (cornes/queue),
`wings` (ailes plumes/cuir), `capes`, `eyes` (+ `socle` partagé, machinerie swapEye/applyEyes gardée,
EYE_OPTIONS dérivé ordonné), `prosthesis` (moignon/crochet/…), `bodies` (corps nu). Fichiers SUPPRIMÉS :
`monsterOverlays.ts`, `wings.ts`, `cape.ts`, `eyes.ts`, `tenues/nuViews.ts`.

**Laissé À DESSEIN (procédural, PAS de la donnée catalogue)** : `cosmetic.ts` (`DEFAULT_VISAGE` = repli
générique bare `<circle @peau>+eye()`, même catégorie que ses voisins `BACK_HAIR/PROFILE_HAIR/PROFILE_FACE/
BACK_NAPE` — le critic l'avait sur-signalé) ; les COMPOSEURS de body-plan non-bipèdes (spider/bird/octopus/
crab/fish/squig/jabber/quadruped) + `composeRig`/`mountedRig` (renderers paramétriques, = `resolve.ts`) ;
`traitVisuals` (wrappers `data-trait` autour d'art de REGISTRE : appendageArt/WINGS/ARMS). Ce sont le MOTEUR,
pas de la donnée → hors defs/ légitimement.

**RESTANT — TOUT RÉSOLU :**
- **CONDITION : FAIT** (`3bafeeb3`) — icon/severity/aiThreat portés sur `etats.json` (EtatData) ; tables CODE
  `CONDITION_TABLE`/`CONDITION_THREAT` retirées. CORRIGE 2 bugs : (1) IA sous-valorisait le sonné (clés IA
  `etourdi`/`hemorragie` périmées → `sonne`/`hemorragique`), (2) icône Pétrifié jamais affichée (`conditionMeta`
  slugifie `'Pétrifié'`→`petrifie` ; `petrifie` reste marqueur narratif LDB 85 hors etats.json). Vérifié en
  ISOLATION (6 assertions) car la suite complète est bloquée par le WIP d'une autre session.
- `sprites.ts` `villager()` : VERDICT = token UI générique (comme DEFAULT_VISAGE/resolve.ts) → LAISSER ; le vrai
  fix data-driven serait « afficher le rig du meneur » = FEATURE, pas migration.
- **travelPostes emoji : DÉLÉGUÉ** — une AUTRE session le fait (commits `7d646b80 LOT 4c-g migration emoji→icônes
  SVG (hotbar, etats, journal, menus, carte)` + WIP travelPostes `void NightEntry`). PAS à moi. Elle travaille
  AUSSI les États (`8301f36d Assourdi/verrous d'États`) → **collision** : toujours committer par pathspec explicite,
  vérifier en isolation ; la suite peut être rouge à cause de LEUR WIP (travelPostes/river-voyage), pas du mien.
- **CONDITION (user: CORRIGER les bugs)** — `effectIcons.CONDITION_TABLE` (icon+severity) + `aiSpellValue.CONDITION_THREAT`
  → `etats.json`. Instruit : 2 VRAIS BUGS. (1) `CONDITION_THREAT` clé `etourdi`/`hemorragie` = PÉRIMÉ ; les vraies
  conditions infligées (criticals/miscast/spells) sont `sonne`/`hemorragique` → l'IA sous-value l'étourdissement
  (menace défaut 1 au lieu de 6). (2) `CONDITION_TABLE` clé `petrifie` mais le Regard pétrifiant inflige `'Pétrifié'`
  (LABEL, `combatManeuvers`) → `conditionMeta` rate → icône pétrifié JAMAIS affichée. Fix « rails » = hygiène de
  nommage (slug partout, `'Pétrifié'`→`petrifie`, ajouter l'État `petrifie` à etats.json) + porter icon/severity/aiThreat
  sur etats.json + corriger les clés IA + MAJ tests (ai-spell-value/ai-threat utilisent `'etourdi'`). CHANGE le
  comportement (= corrige). **À FAIRE.**
- **travelPostes emoji — VERDICT RÉVISÉ** : PAS un fix local. `ActivityDef.icon` est DÉJÀ un IconId rendu via `<Icon>`
  dans le SÉLECTEUR (bon). Mais `POSTE_ICON`/`ENCOUNTER_PRESENTATION` en emoji alimentent `NightEntry.icon` (string) du
  BILAN, et TOUT le système NightEntry/interlude/cascade rend l'icône en TEXTE emoji (restFlow `'📆'`, cascade `'🎲'`…).
  Le vrai fix = migrer `NightEntry.icon` → `IconId` + `<Icon>` sur ~4 producteurs (restFlow/interlude/travelPostes/cascade)
  + leurs rendus. Sous-chantier UI transverse, PAS travelPostes-local. Le garde-fou `no-emoji-affordance` ne le couvre
  pas À DESSEIN (narration ≠ affordance).

Détail : [[game-tenues-defs-source-unique]] (même pattern, tenues+armures). NB : une AUTRE session refactore
`RollShell/RollRow` sur la même branche en // (commits interleaved P0-P3) → toujours committer par **pathspec explicite**,
les échecs `river-voyage-flow` (Faim) sont à ELLE.
