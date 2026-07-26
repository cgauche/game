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
EYE_OPTIONS dérivé ordonné), `prosthesis` (moignon/crochet/…), `bodies` (corps nu).

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
- **Critère de tri récurrent** : un token UI générique (silhouette de repli, pas l'identité d'une entité)
  reste du CODE — le remplacer par le rig réel de l'entité est une FEATURE, pas une migration en defs.
- **Icônes du bilan de nuit : FAIT** — `NightEntry.icon` porte un `IconId` rendu par `<Icon>` chez TOUS ses
  producteurs (`restFlow` : `'time/calendar'`/`'rest/bed'`/`'medical/infection'`/`'rest/cold'`/`'item/misc'` ;
  `travelPostes` : `POSTE_ICON[def.id] ?? 'travel/compass'` ; interlude, cascade). `ActivityDef.icon` était déjà
  un IconId dans le SÉLECTEUR. Leçon de périmètre : l'icône d'un `NightEntry` n'est PAS un fix local au producteur,
  c'est la chaîne producteur→rendu qu'il faut migrer d'un bloc. Le garde-fou `no-emoji-affordance` ne couvre pas
  ce chemin À DESSEIN (narration ≠ affordance) — c'est la revue qui tient la ligne.

**L'interdit qui en découle** : aucune string SVG inline ne revient dans la couche rig, et aucun module à plat ne se rouvre pour en héberger — `rig/monsterOverlays.ts`, `parts/wings.ts`, `parts/cape.ts`, `parts/eyes.ts`, `parts/tenues/nuViews.ts` : 0 sur le disque, et il en reste 0. Un art de partie vit dans un registre `defs/` auto-chargé (`parts/appendages`, `parts/wings`, `parts/capes`, `parts/eyes`, `parts/prosthesis`, `parts/bodies`, `parts/heads`, `parts/hairstyles`, `parts/tenues`, `rig/swarm`), jamais dans un `Record` central ni derrière un name-matcher ([[game-namematch-deleted]]). Corollaire de `nuViews` : une tenue n'importe pas les vues d'un autre def pour les recopier — elle DESSINE ses 3 vues.

Détail : [[game-tenues-defs-source-unique]] (même pattern, tenues+armures). NB : une AUTRE session refactore
`RollShell/RollRow` sur la même branche en // (commits interleaved P0-P3) → toujours committer par **pathspec explicite**,
les échecs `river-voyage-flow` (Faim) sont à ELLE.
