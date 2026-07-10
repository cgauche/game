# Programme structurel #276 — Phase 0 (synthèse des 5 inventaires)

> **Artefact DATÉ** (`docs/plans/`) — snapshot d'audit, PAS une référence vivante. À **supprimer une fois exécuté**
> (git porte l'historique). Le code et les références vivantes (`docs/architecture.md`, table « Primitives partagées »
> de `CLAUDE.md`) font foi ; ce doc ne sert qu'à ORDONNER l'exécution des Phases 1-3.
>
> Date : 2026-07-10 · Juge de synthèse. Entrées : 5 dossiers d'inventaire (`state`, `ui`, `gameiso-scenes`,
> `engine-data`, `perimetre-sources`). Chantier naval **en pause** le temps de cette remise en ordre structurelle.

---

## 1. Résumé exécutif

### Thèse
Les agents codent **par mimétisme** : devant une tâche, un agent lit le voisin le plus proche et le recopie. Corollaire
opérationnel : **chaque voisin doit être canonique**, et **la dérive doit être inexprimable**. Un garde grep qui « signale »
ne suffit pas — « si on peut le greper, on peut l'écrire » (doctrine gardes structurelles, mémoire 2026-07-10). Le verrou
cible est, par ordre de préférence : quarantaine d'import → type scellé → registre exhaustif forcé par la compilation →
cliquet (ratchet) en pis-aller. Patron de référence déjà committé pour la famille JETS : #274 (garde quarantaine),
#275 (seam déclaratif).

### Démonstration empirique — « gardé structurellement = zéro dérive / sans verrou = dérive massive »
Les 5 inventaires prouvent la thèse trois fois, dans les deux sens :

- **Gardé, DANS le périmètre du garde → 0 dérive neuve.**
  - `component-conformance.test.ts` (i)(ii)(iii) sur les écrans plein-champ → dossier UI : *« Déviants nouveaux : aucun —
    garde structurelle efficace, LE modèle de la Phase 2 »* (`ui.md:8`).
  - `no-emoji-affordance.test.ts` (EXCEPTIONS **vide** depuis #139) → *0 émoji d'affordance* dans `src/ui/**` ; la mémoire
    « 362+ émojis restants » est PÉRIMÉE.
  - `labelLogic.mjs` (tolérance ZÉRO, bloquant) sur `src/engine|state/` → famille « logique par label » : **0 déviant** dans son périmètre.
- **MÊME famille, HORS du périmètre / hors du motif du garde → la dérive réapparaît, à l'identique.**
  - `labelLogic.mjs` ne scanne PAS `src/gameIso` → `bodyPlan.ts:109` compare un véhicule **par `label`** au runtime,
    et ce comportement est *verrouillé* par un test qui le NOMME (`ship.test.ts:43-52`). Le garde marche là où il regarde,
    échoue là où il ne regarde pas.
  - `no-emoji-affordance` ne scanne PAS `src/scenes/**/*.json` → `scripts/arene/hub.mjs` (~12 sites) compile des émojis
    dans `src/scenes/arene/arene-projet.json`, invisibles au garde.
  - `component-conformance` matche les classes **littérales** `modal-overlay|worldmap-overlay` (vérifié
    `component-conformance.test.ts:50`) → `WorldMapEditor.tsx:125` porte un `className="wme-overlay"` **bespoke** + aucun
    `role="dialog"`/`aria-modal` → il échappe aux TROIS sous-gardes (i)(ii)(iii) à la fois.
- **Aucun garde du tout → réplication massive.** `battle.combatants.find((c)=>c.id===X)` **>150 sites** (primitive absente) ;
  `.row-flex` réinventé sous **85 règles CSS / 14 modules** ; `{book,page}` recopié **26 fois** ; `difficultyFromModifier`
  cloné **2 fois** (le clone se déclare ironiquement « Source unique », `riverNavigation.ts:176`).

### Compte des trouvailles confirmées (baseline — le credo exige qu'il DÉCROISSE d'audit en audit)
Premier inventaire structurel du dépôt (le précédent, `docs/plans/2026-07-05-audit-poison.md`, ciblait le poison de
commentaire, pas la structure). **Baseline = 31 familles structurelles déviantes confirmées**, réparties :

| Domaine | Familles déviantes confirmées | Sites individuels (ordre de grandeur) |
|---|---|---|
| `src/state` | 4 (+2 mineures) | ~185 (dont ~150 combattant-find, 18 journalPatch, 15 pendings, 12 wounds) |
| `src/ui` + CSS | 9 (+3 déjà arbitrées en ratchet) | ~135 (dont 85 row-flex, ~30 inline-width, 6 boutons, 5 filtres, 4 datalist) |
| `src/gameIso` | 6 | ~18 (11 sortByZ, 3 refOf, +4 unitaires) |
| `src/engine` + `src/data` + `scripts` | 11 (+1 « à surveiller ») | ~50 (26 source-ref, 12 émoji-mjs, 5 `_source`, +jumeaux/unitaires) |
| **Total à purger/verrouiller** | **31** | **~390 sites** |

Hors compte structurel, **routés ailleurs** : 2 anomalies de sources (fichiers data sans citation ; verbatim/périmètre
naval) → tickets #277/#278 déjà en vol ; 3 familles UI déjà **arbitrées** en ratchet (hex hors tokens, prix sans `<Coins>`,
5 systèmes d'onglets) → #256 ; le poison de commentaire résiduel (6 sites : `ops.ts:509`, `corruption.ts:148-149`,
`conditions.ts:39-41`, `obsessions.ts:4-6`, `validate-data.mts:28`, `policy.ts:209/669`) → skill `audit-poison`.

---

## 2. Table consolidée par famille (tous domaines, dédoublonnée inter-dossiers)

Légende verrou : **Q**=quarantaine d'import · **S**=type scellé/exhaustif forcé compilation · **G**=garde grep bloquant ·
**R**=cliquet (baseline) · **P**=migration donnée. Nuances honnêtes conservées (conforme / légitime / à-trancher).

| # | Famille | Canonique (ou ABSENT) | Déviants confirmés (compte · sites clés) | Précédent-racine | Verrou cible |
|---|---|---|---|---|---|
| F1 | Combattant **en combat** par id | **ABSENT** (`actorIn`/`touchActors`/`combatantClickActs` = `combatOrParty.ts`, mais pas de find-en-combat) | **~150** · `combatFlow.ts:200,267,315,359,507,843,1089,1439,1507,1530,2521,2799-2815,2855,2931,3150-3290,3538-3568,4412-4646,4710…`, `combatEffects.ts:344,377`, `combat/hitModifiers.ts:41`, `combat/recover.ts:52` | `combatFlow.ts` (noyau le plus ancien, motif le plus copié) | créer `inBattleId(battle,id)` puis **R+G** |
| F2 | Pendings au registre coop/reset | `MODAL_DEFS` + `ActiveModal` + `STATE_FIELDS` | **15** · 12 hors registre (`pendingBargain/Appraise/SiegeAim/Loot/Victory/Campaign/Orders/Interact/RoundStart/SeaActivities/ManannPriest/ShoreLeave`) + 3 init à la main `create()` (`pendingCampaign` `store.ts:1288`, `pendingOrders` `store.ts:1468`, `pendingActivity` `store.ts:1474`; reset en dur `interludeFlow.ts:690,693,702`). Nuances : `pendingSiegeAim`/`pendingInteract`/`pendingCampaign`/`pendingOrders` **conformes** (placeur de zone partagé / trigger 1-tick / label persistant / regex `netOwnership.ts:128`) ; `pendingManannPriest`/`pendingShoreLeave` = jumeaux non-déclarés de `pendingCouncil` | registres récents, écrans hors-combat jamais rattachés à leur création | **S** (exhaustivité `STATE_FIELDS` forcée compilation, façon `AutoPolicy` de `MODAL_DEFS`) + liste `HORS_MODAL_HOST_ONLY` explicite |
| F3 | Effet mécanique hors `applyOps`/GameOp | `applyOps(target,ops,ctx)` `ops.ts:1013` (65 sites conformes) | **~14** · **coque/héros en mutation directe `wounds`** : `massBattleFlow.ts:749`, `riverVoyageFlow.ts:492,527`(**touche un HÉROS**)`,558,582,618,1003,1039`, `seaVoyageFlow.ts:476,1226,1320,1441` · **`attachMutation`** `corruption.ts:140-161` réimplémente grantTrait/PsychTrait/Talent (double-maintenance prouvée `ops.ts:1150-1156`) · **`switch(entry.effect)`** `drunkenness.ts:98-117` (3 conséquences d100 en dur) · **`attrMod{fate|resilience}`** no-op type-level `ops.ts:1522`. Écarté : `combatEffects.ts:1275` `adjustVessel` (canal Effects, distinct par construction) | cycle import `ops↔corruption` ; motif « table d100 → switch de conséquences » | `damageHull`/`healHull` (nouveau `shipDamage.ts`) → **P** ; casser le cycle par interface différée ; **G**/`data-wellformed` sur `attrMod.attr` |
| F4 | Séquenceur multi-jour | `cascade.ts` (`CascadeStep[]`, `cascadeAppliers`, `runCascadeImmediate`) | **1 confirmé** · `seaVoyageFlow.ts` = **0** occurrence de `CascadeStep`/`startCascade` : `SeaStep`+`sea.step`+`runSeaDays` `:543-729` (FSM 12 branches), `autoResolveVoyageCrewTest` `:345-372` (recalque `runCascadeImmediate`), `resolveVoyageCrewTest` `:898` (`switch(kind)` 10 branches jamais enregistré). CONFORMES : `riverVoyageFlow.ts:186`, `travelFlow.ts:452`. **ARBITRAGE USER 2026-07-10 : le jet d'équipage N'EST PAS une forme particulière** — « on a bien le jet d'opposition multi-participant (le contresort à plusieurs) et le jet simple multi-participant contre une porte » : même famille canonique (`makeRollFlow` mode `spec.multi`, coquille `RollShell`, une rangée par participant) ; la SEULE variation porte/contresort/équipage est l'**AGRÉGATION** des résultats (meilleur / opposé / DR sommé), et l'agrégation est un **paramètre de spec**, pas une forme nouvelle. Aucun 3e système de jet, aucun cas spécial mer. **NON tranchés** : `massBattleFlow.ts`, `interludeFlow.ts` (survolés) | module isolé, jamais rebranché quand river/terre l'ont été | le trou est UNIQUEMENT dans `CascadeStep` (mono-acteur) → `CascadeStep.participants?` optionnel + **remplacement intégral** de la FSM maison (**Lot 6**) |
| F5 | Écran plein-champ | `ScreenShell` ; garde `component-conformance.test.ts` (i)(ii)(iii) | **1** · `WorldMapEditor.tsx:125` `<div className="wme-overlay">` + `<header className="bar">` recopiés, `✓ Fermer`, sans `role="dialog"`/a11y. `CharacterCreator.tsx:264-325` = wizard 3 colonnes, **pas** un déviant (propos distinct). | `WorldMapEditor` antérieur à `ScreenShell` | migrer vers `ScreenShell` + **élargir le motif** du garde (voir F5b) |
| F5b | Détection d'overlay du garde | motif littéral `modal-overlay\|worldmap-overlay` (`component-conformance.test.ts:50,71`) | TROU structurel : toute classe `*-overlay` bespoke (`wme-overlay`) + absence de `role="dialog"`/`aria-modal` échappe aux 3 sous-gardes | motif fermé à 2 noms | **G** : matcher `/\b[\w-]*-overlay\b/` bespoke hors owners/whitelist |
| F6 | Boutons de décision | `OptionChooser`/`ChoiceButtons` | **6** · `DialogueBox.tsx:43-60` (`.dlg-choice`), `Palette.tsx:148-156,181-191,205-218,298-307` (pinceau/murs/hauteur/type-zone, mutuellement exclusifs = `layout="seg"` exact), `WorldMapEditor.tsx:129-142` (toolbar) | `Palette.tsx` (rail v2 antérieur à OptionChooser), copié par `WorldMapEditor` | adoption OptionChooser (pas de garde propre — hors overlay) |
| F7 | Picker de ref (datalist) | `RefField` (3 modes ; `ds="trappings"`/`"spells"`) | **4** · `ConditionEditor.tsx:181-189`, `EffectList.tsx:270`, `FlowEditor.tsx:76`, `OptionalTraitsPicker.tsx:131-136` — `<input list><datalist>` + `findXByLabel` **alors que `RefField` est importé dans les mêmes fichiers** | `ConditionEditor.tsx:183` assume le patron ; répliqué en réimportant RefField pour d'autres champs | adoption + **G** grep `<datalist` sous `src/ui/editor/**` |
| F8 | Filtre/recherche de liste | **ABSENT** | **5** implémentations indépendantes · `Palette.tsx:88,114-120` (`searchBox()` ×4), `Inspector.tsx:945-949,1064-1067`, `InterludeScreen.tsx:578-601` **et** `:689-732` (duplication INTRA-fichier), `compendium/search.ts` (seul extrait, jamais promu) | `Palette.tsx` (le plus ancien) copié par `Inspector` ; `InterludeScreen` auto-répliqué | créer `SearchFilterField`/`useFilteredList(items,getLabel)` |
| F9 | `.row-flex` (flex-wrap:wrap) | `.row-flex` `components.css:42-47` | **85 règles / 14 modules** redéclarent le patron sous noms bespoke (`world-meta.css` 20, `combat-modals.css` 11, `editor.css` 10, `creator.css` 10, `combat-ui.css` 8, `hud.css` 6, `base.css` 5…) | diffusion CSS sans source unique | **R** par-fichier `flex-wrap:wrap` hors `components.css` (patron `HEX_BASELINE`) |
| F10 | Largeur de champ num. inline | partiel `.tf-row .dr input`/`.row-flex .dr input` `editor.css:695-705` (trop scopé) | **~30** · `ConditionEditor.tsx` (11, dans `.cond-time`), `EffectList.tsx` (20+) `style={{width:'3.Xem'}}` | `ConditionEditor` pose, `EffectList` réplique en masse | régler `.dr input{width:44px}` sans scope → ~30 inline disparaissent |
| F11 | Prose Markdown → `<Prose>` | `<Prose>` `Prose.tsx` (règle stricte 5) | **1** · `WorldMapEditor.tsx:354` `` {def.desc ? ` — ${def.desc}` : ''} `` (desc de port app-owned en template-string brut) | site isolé | `<Prose md={def.desc}/>` |
| F12 | `pickBackend` direct pour entité de scène | `PortraitTile`/`CharFrame` (accepte `Combatant`, pas `SceneEntity`) | **2** · `editor/Inspector.tsx:568-569`, `DialogueBox.tsx:20-36` (mismatch de type — primitive ABSENTE pour ce cas) | aucune primitive n'accepte l'entité de scène | à-trancher : étendre `PortraitTile` au `SceneEntity` OU laisser (2 sites) |
| F13 | Dérivation de ref rig | se veut « unique » `enemyProfile.ts:244-247` | **3** · `ent.ref ?? ent.label ?? 'villageois'` verbatim `pickBackend.tsx:153`, `pov/billboards.tsx:133`, `enemyProfile.ts:250` | dérivation non extraite | créer `refOf(ent)` partagé |
| F14 | Véhicule par id (runtime) | `findVehicleById` (~90 sites) | **1** · `bodyPlan.ts:109` `.find(v=>v.hull && (v.id===x||v.label===x))` — comparaison **par label** hors `src/data/index.ts`, **sans** la garde DEV jumelle (`pickBackend.tsx:161-162` hurle ; ici silence). = **fuite de la famille F16 hors du périmètre `labelLogic`.** VERROUILLÉ par `ship.test.ts:43-52` (« résout par id ET par label ») | copie de `creatureId ?? name` sans sa garde | converger sur `findVehicleById(x)` id-seul + garde DEV + **réécrire** le test |
| F15 | Tri z intra-corps | **ABSENT** (`composite.ts` trie INTER-corps) | **11** · `.sort((a,b)=>a.z-b.z)` copié en fin de `composeBird:194`,`Crab:125`,`Spider:118`,`Octopus:109`,`Fish:92`,`Jabber:129`,`Quad:66`,`Squig:107`,`Spectre:137`,`Serpent:126`,`Hulk:99` | jamais extrait | créer `sortByZ()` (priorité faible) |
| F16 | Logique par label | ids stables ; couture unique `src/data/index.ts` ; garde `labelLogic.mjs` | **0 dans `src/engine|state`** (garde efficace) ; **fuites hors périmètre** : `bodyPlan.ts:109` (F14), et `labelLogic` ne scanne ni `src/ui`, ni `src/gameIso`, ni `src/data/index.ts`, ni `scripts/**` | scope du garde | **élargir** le scan `labelLogic.mjs` à `src/gameIso`+`src/ui`, `index.ts` = seule couture tolérée |
| F17 | Bloc de structure inerte | builders purs (floors/walls/roofs/props) ; garde `renderer-no-hardcoded-color` | **1** · `pickBackend.tsx:63-72` `STRUCT_BODY` = 6 `<rect>` SVG inline dans le classifieur | pas de builder « bloc de structure » | builder dédié si 2e cas |
| F18 | Repli de backend gardé | assertions DEV qui hurlent (`pickBackend.tsx:161-162`) | **1** · `pickBackend.tsx:176` repli `'sprite'` final ; `sprites.ts:31` AFFIRME l'inatteignabilité sans assertion | affirmation non vérifiée | assertion DEV qui hurle |
| F19 | Matériau d'armure | routage arme par id/shape (`equipment.ts:weaponFamily`, exemplaire) | **1** · `equipment.ts:107-116` `armourMaterial` = **regex FR sur `item.name`** (`/cuir\|jaque/`, `/maille…/`) 20 lignes sous un routage id exemplaire | pas de champ matériau structuré | champ `material` id-stable sur `ItemInstance`/def, OU border en dette taguée |
| F20 | Réf source `{book,page}` (couche TS) | `sourceRefSchema` `common.ts:23` (~30 defs zod) ; **`SourceRef` TS ABSENT** | **26** · 4 defs zod réécrivent inline (`crew-roles.ts:25`, `naval-traits.ts:36`, `vehicles.ts:42`, `montures.ts:14`) + 22 inline `{book;page}` dans `src/data/index.ts`. Divergence DOCUMENTÉE non-déviante : `structures.ts:27` `{book,chapter}` | la couche zod a promu le schéma sans remonter à la couche TS | **G** grep `z.strictObject({ book:.*page:` hors `common.ts` + exporter `SourceRef` TS |
| F21 | Réf source libre `_source` | **ABSENT** | **5** · `aa-criticals.ts:41`, `land-cargo.ts:17`, `sea-cargo.ts:42`, `river-navigation.ts:26`, `river-perils.ts:11` : `_source:z.string()` jamais promu | dette symétrique de F20 | promouvoir `freeSourceNoteSchema` dans `common.ts` (faible prio) |
| F22 | Difficulté depuis modificateur | **ABSENT** de `tests.ts` (pas de foyer) | **2** · `massBattle.ts:169` + `riverNavigation.ts:178` = jumeaux, même nom exporté, **algo identique** (plus-proche clé de `DIFFICULTY_MODIFIERS`, vérifié). Le clone se déclare « Source unique » (`riverNavigation.ts:176`) | copier-coller inter-modules | promouvoir 1 impl dans `tests.ts` + **G** grep `export function difficultyFromModifier` hors `tests.ts` |
| F23 | Lookup `[min,max]` d100 | `findTableEntry` `tables.ts:8` (~8 conformes) | **2** · `seaNavigation.ts:194` find min/max en dur à 17 l. d'un usage correct (doyen) · `landCargo.ts:120` `findIndex` (besoin d'INDEX distinct, non couvert par la primitive) | `seaNavigation:194` ; `landCargo` = frère à besoin distinct | **G** grep `\.find(Index)?\(.*\.min.*&&.*\.max\)` hors `tables.ts` + ajouter `findTableEntryIndex` |
| F24 | Émoji-affordance en donnée générée | registre `<Icon id>` ; garde `emojiAffordance.mjs` (`.ts/.tsx` + `src/data/*.json` à plat) | **~12** · `scripts/arene/hub.mjs:15,49-50,54,67,137,139,183,202,209,261,270,275` émoji dans `text:` → compilés dans `src/scenes/arene/arene-projet.json`. `zones*.mjs`/`expeditions.mjs` présumés | garde bâti avant les générateurs `.mjs` ; aveugle à `src/scenes/**/*.json` | **élargir** `scanFiles()` à `src/scenes/**/*.json` + brancher le hook |
| F25 | Carte livre→dossier `chapterFile` | `scripts/raw/_lib.mjs` (BOOKS 15 + `chapterFile`) | **1** · `scripts/raw/build-catalogs.mjs:9-22,41-48` réimplémente la carte BOOK (12) + `chapterFile` local | écrit à côté de `_lib.mjs` | **Q** : seul `_lib.mjs` exporte `chapterFile` |
| F26 | Constante multiplicateur en code | `rule()`/donnée JSON éditable | **2** · `crewMorale.ts:106-111` `PAY_CHOICES` (multiplicateurs maison, tagué #229, non éditable) — DETTE · `conditions.ts:41` `NARRATIVE_MARKER_SEVERITY={petrifie:95}` hors `etats.json`, « unique exception » sans tag `[entériné]` | isolés | migrer en JSON ; **G** taille d'objet sur `NARRATIVE_MARKER_SEVERITY` |
| — | (mineur) Patch `journal` batché | action `log:` `store.ts:2120` | **18** sites réécrivent `journal:[...slice(-40),...lines]` (batché avec d'autres champs) — pas un bug | idiome répandu | `journalPatch(get,lines)` (faible prio) |
| — | (mineur) Ready-check par siège | — | **2** · `readyBySeat`/`ownsLocally` recopié `ActionBar.tsx:124-157` ↔ `VictoryScreen.tsx:46-127` | copie entre 2 fichiers | extraire une primitive commune (faible prio) |
| — | (à surveiller) 2e collecteur passif | `passiveMods` `trauma.ts:756` | `navalPassiveOps` `navalTraits.ts:42` = 2e fork DOCUMENTÉ (porteur non-`Combatant`). **Pas déviant tant que 2 forks** — un 3e imposerait la généralisation à porteur paramétrable | — | néant (surveiller) |

**Routé hors du programme structurel** (pour mémoire, ne pas re-planifier ici) :
- **Sources — data sans citation** : `sea-events.json`, `sea-navigation.json`, `sea-perils.json`, `sea-weather.json`,
  `ship-construction.json`, `naval-progression.json`, `crew-morale.json`, `crew-test-types.json`, `mass-battle.json`
  portent des valeurs chiffrées **ni `book` ni `_source`** (leurs frères `river-*`/`land-cargo` en ont un) → **#278**.
- **Sources — périmètre/verbatim naval** : 8 traits MSLRC (`naval-traits.json:616-976`) — 7/8 prose VERBATIM, 1 REFORMULÉ
  (murs-blindés, omission du renvoi `(WFJDR, p.161)`, `:727`), **écart systémique coût/poids** (bande « barque » du RAW
  absente, décalage d'un cran sur 6 traits banded) → **#277**. La dichotomie livre-règles/contenu **tombe** (arbitrage user
  2026-07-10 : « tous les livres contiennent des règles » ; documenter par PASSAGE). L'extraction MSLRC EXISTE
  (`Source/Warhammer v4 - 2.0 Mort sur le Reik Compagnon/`, 19 ch.).

---

## 3. Table des gardes existants (couverture · mécanisme · TROU confirmé)

| Garde | Classe couverte | Mécanisme | TROU confirmé |
|---|---|---|---|
| `component-conformance.test.ts` (i/ii/iii/vi) | écran plein-champ + a11y dialogue + proéminence RollAction | grep classNames + import de primitive, Vitest | motif littéral `modal-overlay\|worldmap-overlay` — classe bespoke `wme-overlay` + absence `role="dialog"` échappe (F5b) ; whitelist EXEMPTE, ne scanne pas |
| ratchets UI (iv/v) `#256` | hex hors tokens ; prix sans `<Coins>` | cliquet par-fichier (baseline) | **contenu, pas résorbé** (14 modules ~104 hex ; 7 fichiers prix) ; ne couvre PAS `flex-wrap:wrap` (F9) ni onglets (compte) |
| `no-emoji-affordance.test.ts` | émoji UI hors `<Icon>` | grep plage Unicode + baseline, EXCEPTIONS **vide** + cliquet anti-péremption | scanne `.ts/.tsx`+`src/data/*.json` à plat — **JAMAIS `src/scenes/**/*.json`** (format des générateurs `.mjs`, F24) ; jamais branché hook |
| `renderer-no-hardcoded-color.test.ts` | couleur en dur hors builders | grep, >40 fichiers | `rig/**` et `fx/**` HORS périmètre documenté |
| `no-html-in-prose.test.ts` | HTML dans la prose data | garde la **SOURCE data** | ne garde pas le **RENDU ui** — un `innerHTML` de texte passerait |
| `labelLogic.mjs` | `_BY_LABEL`/`.label ===` | grep, tolérance ZÉRO, bloquant | **`src/engine|state` SEUL** — `src/ui`, `src/gameIso` (F14/F16 !), `src/data/index.ts` (la couture), `scripts/**` hors-scan |
| `hardcode.mjs` | réaction combat par-nom | grep + baseline-cliquet | **jamais branché** hook/pre-commit (Vitest seul) |
| `commentPoison.mjs` (tombstones/excuses/rawClaims/decisionClaims) | poison de commentaire | grep + fenêtres + whitelist, pre-commit | **`src/**/*.ts(x)` SEUL** — tout `scripts/**/*.mjs` hors-scan (`validate-data.mts:28` vivant non vu) ; participes/tournures hors liste échappent ; rawClaims **jamais bloquant** |
| `validate-data.mts` | JSON viole son schéma zod | zod safeParse, pre-commit | silence sur JSON sans schéma (PENDING) ; **jamais `src/scenes/**/*.json`** |
| `check-doc-refs.mjs` (`npm run docs:check`) | réf `src/`/`scripts/` morte dans `docs/*.md` | résolution fs + index `SRC_IDENTS` | **`docs/*.md` À PLAT seul** (`readdirSync` non récursif) — **ne scanne PAS `CLAUDE.md`** (racine) : c'est pourquoi le fantôme `inBattle` de la table « Primitives partagées » n'a jamais été pris ; `SRC_IDENTS` matche clés JSON/CSS homonymes (faux négatif) |
| `git-destructive-guard.mjs` | git écrase du WIP | grep-motif commande, `ask` | liste FIXE (alias/wrapper échappent) |
| `enterine-guard.mjs` | tag `[entériné]` sans user | grep Write/Edit, `ask` | `writeFileSync` par script lancé via Bash contourne |
| `new-src-file-guard.mjs` / `data-edit-guard.mjs` | réinvention fichier / rappel édit data | heuristique chemin, NON bloquant | non bloquants ; `data-edit` = `src/data/*.json` profondeur 1 (`scenes/**` muet) |
| `coverage.mjs` / `reconcile.mjs` / `reanchor.mjs` (Atlas) | couverture/désync/dérive de ligne | comptage/diff/citation | `coverage` seuil ≥3 sans diversité ; `reconcile` RAPPORT seul (pas d'`exit(1)`) ; `reanchor` MEDIUM/LOW jamais auto |

**Deux trous transversaux** confirmés (répétés à travers les dossiers) :
1. **Aucun garde de poison/label/emoji ne scanne `scripts/**` ni `src/scenes/**/*.json`** (F24, F25, poison `.mjs`).
2. **`hardcode.mjs` et `emojiAffordance.mjs` ne sont branchés à AUCUN hook** (Vitest seul → régression prise seulement à la suite complète).
3. **`docs:check` ne couvre pas `CLAUDE.md`** → la table des primitives peut mentir (fantôme `inBattle`), personne ne le voit.

---

## 4. Phase 1 — LOTS de purge des racines (ordonnés par DANGER DE COPIE)

Chaque lot : primitive cible **nommée**, sites (compte), tests-poison à réécrire, taille (S/M/L), calibrage agent. Doctrine
d'orchestration (mémoire) : les agents CODENT ; modèle/effort **explicites** ; jamais « Sonnet gros effort général ».

### LOT 1 — `inBattleId` + migration de la recherche de combattant en combat · **L** · codeur (Sonnet, effort élevé)
- **Familles** : F1 (+ correction du fantôme, § Phase 3).
- **Primitive cible (créer)** : `inBattleId(battle: Battle, id: string): Combatant | undefined` dans
  `src/state/combatOrParty.ts`, à côté d'`actorIn`. Sémantique : combattant EN COMBAT par id (distincte d'`actorIn` =
  acteur combat OU groupe).
- **Sites à migrer** : ~150 `battle.combatants.find((c)=>c.id===X)` → `inBattleId(battle,X)` (liste F1). Migration
  mécanique guidée par grep `battle\.combatants\.find\(\s*\(?c\)?\s*=>\s*c\.id\s*===`.
- **Tests-poison** : aucun test ne verrouille le motif ; corriger la table `CLAUDE.md` (fantôme `inBattle`→`inBattleId`).
- **DoD** : 0 occurrence du motif hors `combatOrParty.ts` ; `npm run typecheck` + `npm test` verts ; table CLAUDE.md corrigée.

### LOT 2 — Router tout effet mécanique vers `applyOps` · **L** · codeur (Sonnet, effort élevé) + passe `juge`
- **Familles** : F3.
- **Primitives cibles** : (a) `damageHull(hull,amount)`/`healHull(hull,amount)` dans un nouveau `src/state/shipDamage.ts`,
  routant vers `applyOps(hull,[{op:'wounds'|'heal',amount,ignoreTB:true,ignoreAP:true}])` ; (b) faire passer `attachMutation`
  DERRIÈRE `applyOps` via interface différée (casse le cycle `ops↔corruption`) ; (c) remplacer `switch(entry.effect)` de
  `drunkenness.ts` par des `GameOp[]` en donnée.
- **Sites** : ~12 mutations `wounds` (dont `riverVoyageFlow.ts:527` **héros**) → `damageHull`/`applyOps` ; `corruption.ts:140-161`
  ↔ `ops.ts:1150-1156` dédupliqués ; `drunkenness.ts:98-117` ; `ops.ts:1522` (rétrécir l'union `attrMod.attr` OU garde `data-wellformed`).
- **Tests-poison** : vérifier qu'aucun test ne fige la mutation directe (ré-écrire s'il y en a).
- **Risque** : moteur PUR (`src/engine`) — le cycle d'import et l'idempotence des soins doivent rester verts. Recette non requise (pas d'UI).
- **DoD** : 0 mutation `.wounds.current` hors `ops.ts`/`shipDamage.ts` ; `attachMutation` sans branche recopiée ; suite verte.

### LOT 3 — Schéma de référence de source (couche zod + TS + `_source`) · **M** · codeur (Sonnet, effort moyen)
- **Familles** : F20, F21.
- **Primitives cibles** : exporter le **type TS** `SourceRef` + helper `sourceRef({book,page})` (nouveau ou dans
  `src/data/schemas/defs/common.ts`) ; promouvoir `freeSourceNoteSchema` dans `common.ts` pour `_source`.
- **Sites** : 4 defs zod (`crew-roles.ts:25`, `naval-traits.ts:36`, `vehicles.ts:42`, `montures.ts:14`) → `import { sourceRefSchema }` ;
  22 inline `{book;page}` de `src/data/index.ts` → `SourceRef` ; 5 `_source:z.string()` → `freeSourceNoteSchema`. NE PAS toucher
  `structures.ts:27` (`{book,chapter}`, divergence documentée légitime).
- **Tests-poison** : aucun. **DoD** : 0 `z.strictObject({book,page})` hors `common.ts` ; `SourceRef` exporté et importé ; suite verte.

### LOT 4 — Éditeur unifié (coquille + boutons + pickers + filtre + prose + CSS) · **L** · codeur (Sonnet, effort élevé) + `recetteur`
- **Familles** : F5, F6 (volet éditeur), F7, F8, F10, F11, + inline-color.
- **Primitives cibles** : `ScreenShell` (migrer `WorldMapEditor`), `OptionChooser layout="seg"` (Palette + toolbar),
  `RefField ds=…` (4 datalists), **créer `SearchFilterField`/`useFilteredList(items,getLabel)`** (5 sites de filtre),
  `<Prose>` (`WorldMapEditor.tsx:354`), règle CSS `.dr input{width:44px}` non scopée (F10), `className="warn-text"`
  (`CharacterCreator.tsx:295,311,765`).
- **Sites** : `WorldMapEditor.tsx:125,129-142,354` ; `Palette.tsx:148-156,181-191,205-218,298-307,88,114-120,230,249,328,343` ;
  `ConditionEditor.tsx:181-189` + inline-width×11 ; `EffectList.tsx:270` + inline-width×20 ; `FlowEditor.tsx:76` ;
  `OptionalTraitsPicker.tsx:131-136` ; `Inspector.tsx:945-949,1064-1067` ; `InterludeScreen.tsx:578-601,689-732`.
- **Tests-poison** : aucun. **Recette** : dérouler l'éditeur au navigateur (Playwright) — la migration ScreenShell/OptionChooser doit rester cliquable.
- **DoD** : `WorldMapEditor` passe `component-conformance` ; 0 datalist sous `editor/**` ; `SearchFilterField` adopté aux 5 sites ; ~30 inline-width supprimés ; recette 0 erreur console.

### LOT 5 — Jumeaux & primitives absentes engine/rig · **M** · codeur (Sonnet, effort moyen)
- **Familles** : F22, F23, F13, F14, F15, F17, F18, F19, F25.
- **Primitives cibles** : promouvoir `difficultyFromModifier` dans `tests.ts` (supprimer le jumeau) ; `findTableEntryIndex`
  dans `tables.ts` (ferme `landCargo:120`) + migrer `seaNavigation.ts:194` sur `findTableEntry` ; créer `refOf(ent)`
  (`enemyProfile.ts`) ; `bodyPlan.ts:109` → `findVehicleById(x)` id-seul + garde DEV + **réécrire `ship.test.ts:43-52`** ;
  `sortByZ()` (11 composeurs) ; builder « bloc de structure » si retenu (`STRUCT_BODY`) ; assertion DEV `pickBackend.tsx:176` ;
  `armourMaterial` : champ `material` id-stable OU dette taguée ; `chapterFile` via `_lib.mjs` (`build-catalogs.mjs:9-48`).
- **Tests-poison** : **`ship.test.ts:43-52`** verrouille `resolveRender … par id ET par label` → réécrire pour n'attendre QUE l'id.
- **DoD** : 1 seul `difficultyFromModifier` exporté (hors `tests.ts`) ; 0 lookup min/max hors `tables.ts` ; `refOf`/`sortByZ` adoptés ; `bodyPlan` id-seul ; suite verte.

### LOT 6 — `seaVoyageFlow` sur `cascade.ts` (remplacement intégral de la FSM maison) · **L** · codeur (Sonnet, effort élevé) + passe `juge`
- **Famille** : F4. **Arbitrage user 2026-07-10 (cadre imposé)** : le jet d'équipage est de la MÊME famille canonique
  que la porte (`ForceDoorModal`) et le contresort à plusieurs — `makeRollFlow` mode `spec.multi`, coquille `RollShell`,
  une rangée par participant ; la seule variation est l'**agrégation** (meilleur / opposé / DR sommé) = paramètre de spec.
  **Interdit** : conclure « le multi mer est spécial donc ma machinerie locale est justifiée ». Aucun 3e système de jet.
- **Primitive cible (étendre)** : `CascadeStep.participants?: ShipManeuverParticipant[]` optionnel dans
  `src/state/cascade.ts` — une étape avec `participants` ouvre la même modale multi canonique (résolution routée par la
  spec crew EXISTANTE, agrégation portée par la spec), sans rien changer aux étapes mono-acteur.
- **À REMPLACER intégralement** (pas adapter) : la FSM `SeaStep`+`sea.step`+`runSeaDays` `seaVoyageFlow.ts:543-729`
  (while+switch 12 branches) → `CascadeStep[]` pilotés par `startCascade`/`advanceCascade` ; `autoResolveVoyageCrewTest`
  `:345-372` → `runCascadeImmediate` (`cascade.ts:194-209`) ; `resolveVoyageCrewTest` `:898` (switch monolithique
  10 branches) → appliers enregistrés par kind via `registerCascadeApplier` (le registre partagé, pas un
  `crewCascadeAppliers` parallèle).
- **Coordination OBLIGATOIRE** : seam #275 (la porte déclarative exprime déjà le multi via les specs — les kinds crew
  passent par elle) ; #271/#272 (jets mer, séquencés) — même périmètre de fichiers, se synchroniser pour ne pas se marcher dessus.
- **Tests-poison** : tout test qui verrouille `sea.step`/`SeaStep` ou le switch de `resolveVoyageCrewTest` se réécrit
  contre la forme cascade (jamais travesti).
- **DoD** : 0 occurrence de `SeaStep`/`sea.step`/`autoResolveVoyageCrewTest`/`resolveVoyageCrewTest` ; les 12 étapes du
  jour de mer sont des `CascadeStep` (mono ou `participants`) enregistrés dans `cascadeAppliers` ; parité fonctionnelle
  (routine vs modale, suspension/reprise) prouvée en recette navigateur ; suite verte.

> **Regroupement de F2 (pendings)** : traité en Phase 2 (verrou-avec-migration) car la valeur y est le VERROU exhaustif,
> la migration (déclarer 6 pendings + déplacer 3 init) étant sa queue. Idem F9/F5b/F16/F24 (ratchets/élargissements de garde).

---

## 5. Phase 2 — verrous par famille (structurel d'abord, cliquet en pis-aller ; patron #274/#275)

| Verrou | Famille | Mécanisme (préférence : Q > S > registre-compilé > R) |
|---|---|---|
| V1 `inBattleId` | F1 | **R+G** : après Lot 1, garde grep `battle\.combatants\.find\(.*c\.id ===` hors `combatOrParty.ts` + whitelist, branché pre-commit (pas Vitest seul — cf. trou transversal 2). Patron : baseline-cliquet de `hardcode.mjs`, mais BRANCHÉ. |
| V2 pendings | F2 | **S (exhaustif forcé compilation)** : `STATE_FIELDS satisfies Record<AllPendingKeys, …>` où `AllPendingKeys` est dérivé du type `GameState` (une clé `pending*` non déclarée casse `tsc`, façon `AutoPolicy` de `MODAL_DEFS`). + liste `HORS_MODAL_HOST_ONLY` explicite et commentée, testée : chaque `pending*` a soit une entrée `MODAL_DEFS`, soit une entrée dans cette liste. Migration : déplacer les 3 init `create()` dans le manifeste, déclarer les 6 pendings hôte-seul. |
| V3 `applyOps` | F3 | **Q** : quarantaine d'import — seuls `ops.ts` + `shipDamage.ts` peuvent écrire `.wounds.current [-+]=` ; garde grep bloquant sur le motif hors ces 2 fichiers (le type scellé est jugé trop cassant, cf. `state.md:18`). |
| V4 ScreenShell | F5, F5b | **G élargi** : dans `component-conformance.test.ts`, remplacer le motif `modal-overlay\|worldmap-overlay` par toute classe `/\b[\w-]*-overlay\b/` hors `OVERLAY_OWNERS`/whitelist, ET s'assurer que `FILES` couvre `src/ui/editor/**`. Ferme F5b structurellement. |
| V5 RefField | F7 | **G** : garde grep `<datalist` sous `src/ui/editor/**` (bloquant) — un picker de ref s'y écrit via `RefField`. |
| V6 `.row-flex` | F9 | **R** : cliquet par-fichier `flex-wrap:\s*wrap` hors `components.css` (patron `HEX_BASELINE` des ratchets #256), COMPTE gelé → décroissant. |
| V7 onglets | (arbitré) | **R de COMPTE** : cliquet sur le nombre de systèmes d'onglets (5 aujourd'hui) — un 6e casse. L'arbitrage « pas de `<Tabs>` unifié » n'interdit PAS un ratchet de compte. |
| V8 `labelLogic` scope | F16, F14 | **élargir le scan** de `labelLogic.mjs` à `src/gameIso`+`src/ui` ; `src/data/index.ts` = seule couture tolérée (whitelist d'1 fichier). Ferme F14 sans garde ad hoc. |
| V9 émoji-mjs | F24 | **élargir `scanFiles()`** de `emojiAffordance.mjs` à `src/scenes/**/*.json` + **brancher le hook** pre-commit (ferme le trou transversal 2 pour cet outil). |
| V10 source-ref | F20 | **G** : garde grep `z.strictObject({ book:.*page:` hors `common.ts` (bloquant). |
| V11 `difficultyFromModifier` | F22 | **G** : garde grep `export function difficultyFromModifier` hors `tests.ts` (bloquant, après promotion Lot 5). |
| V12 `findTableEntry` | F23 | **G** : garde grep `\.find(Index)?\(.*\.min.*&&.*\.max\)` hors `tables.ts` + whitelist. |
| V13 `chapterFile` | F25 | **Q** : seul `scripts/raw/_lib.mjs` exporte `chapterFile`/la carte BOOK ; garde d'import. |
| V14 `CLAUDE.md` primitives | trou transversal 3 | **G** : étendre `check-doc-refs.mjs` (ou une garde jumelle) pour scanner `CLAUDE.md` — chaque symbole backtiqué de la table « Primitives partagées » doit résoudre à un export réel. Ferme la cause-racine du fantôme `inBattle`. |
| V15 hooks manquants | trou transversal 2 | brancher `hardcode.mjs` **et** `emojiAffordance.mjs` au pre-commit (aujourd'hui Vitest seul). |
| V16 `attrMod` | F3 | **S partiel** : rétrécir l'union TS de `attrMod.attr` pour exclure `fate|resilience` OU garde `data-wellformed` qui rejette l'op no-op. |
| V17 `NARRATIVE_MARKER_SEVERITY` | F26 | **R** : après migration en `etats.json`, garde de taille d'objet (croissance interdite). `PAY_CHOICES` → migration JSON (#229 déjà tagué). |
| V18 séquenceur cascade | F4 | après Lot 6 : le seam #275 + la quarantaine #274 couvrent l'expression des jets (le multi passe par les specs) ; côté séquenceur, **registre-compilé** : les kinds d'étape vivent dans `cascadeAppliers` (`registerCascadeApplier`, fail-fast sur kind non enregistré) — plus aucun `switch(kind)` local ; **G** en appui : grep `switch\s*\(.*\.kind` sur les flux de voyage hors `cascade.ts`. |

> Verrous SANS garde propre (adoption/conception, pas de lint) : F6 (OptionChooser), F8 (`SearchFilterField`), F10/F11
> (CSS/Prose), F13/F15 (extraction), F19 (champ `material`). Leur non-régression s'appuie sur les gardes de famille voisins.

---

## 6. Phase 3 — chemin d'auteur (primitives + skills)

### 6.1 Table « Primitives partagées » de `CLAUDE.md` — corrections & ajouts constatés
- **CORRIGER le fantôme** : la ligne « Combattant par id … `actorIn` / `inBattle` » cite **`inBattle` qui n'existe pas**
  (`combatOrParty.ts` exporte `actorIn`/`touchActors`/`combatantClickActs`). Remplacer par **`actorIn` / `inBattleId`**
  après Lot 1.
- **AJOUTER** (constatés manquants, à créer aux Lots) :
  - `inBattleId(battle,id)` → `src/state/combatOrParty.ts` (F1).
  - `SearchFilterField` / `useFilteredList(items,getLabel)` → `src/ui/` (F8).
  - `refOf(ent)` → `src/gameIso/rig/enemyProfile.ts` (F13).
  - `findTableEntryIndex` → `src/engine/tables.ts` (F23).
  - `sortByZ()` → `src/gameIso/rig/composite.ts` (F15).
  - `SourceRef` (type TS) + `sourceRef()` → couche data ; `sourceRefSchema` zod déjà dans `common.ts:23` (F20/F21).
  - `difficultyFromModifier` promu dans `src/engine/tests.ts` (F22).
  - `damageHull`/`healHull` → `src/state/shipDamage.ts` (F3).
  - `journalPatch(get,lines)` → `src/state/store.ts` (mineur).
- **ABSENTS documentés** (primitive à concevoir avant réplication, pas juste un helper) : « bloc de structure inerte »
  builder (F17), champ `material` id-stable sur `ItemInstance` (F19), coquille acceptant un `SceneEntity` pour
  `PortraitTile` (F12), extension `CascadeStep.participants?` de `cascade.ts` (F4, Lot 6 — PAS une FSM nouvelle :
  arbitrage user, le multi est un paramètre de spec).

### 6.2 Skills d'opération à créer (chantier « skills d'opérations » de la mémoire, non fait)
Objectif : router l'agent-mimète vers le canonique AVANT qu'il copie un voisin. Le dépôt a déjà `ajouter-une-donnee`,
`ajouter-un-flux-de-jet`, `ajouter-une-mecanique`, `retoucher-un-ecran-ui`, `orchestrer-des-agents`. Manquent :
- **`chercher-un-combattant`** — route vers `actorIn` (acteur combat/groupe) vs `inBattleId` (en combat) ; interdit le `find` inline. (couvre F1)
- **`referencer-une-source`** — impose `sourceRefSchema`/`SourceRef`/`_source`→`freeSourceNoteSchema` ; interdit le `{book,page}` inline. (couvre F20/F21)
- **`filtrer-une-liste`** — route vers `SearchFilterField`/`useFilteredList`. (couvre F8)
- **`router-un-effet-de-degats`** — étend `ajouter-une-mecanique` au cas coque/`wounds` : `applyOps`/`damageHull`, jamais la mutation directe. (couvre F3)
- **`composer-un-tableau-d100`** — route vers `findTableEntry`/`findTableEntryIndex` ; interdit le `.find(min/max)` en dur. (couvre F23)

Familles déjà couvertes par un skill existant (routage à rappeler dans le skill, pas de nouveau skill) : écran plein-champ /
boutons / prose / CSS → `retoucher-un-ecran-ui` (F5/F6/F10/F11) ; picker de ref → `ajouter-une-donnee`/éditeur (F7) ; émoji →
`ajouter-une-icone` (F24).

---

## 7. Hors périmètre / déjà en vol (renvois — ne pas re-planifier)

- **Famille JETS** (déjà traitée, contexte du brief) : #269 (naufrage), #270 (sous-tests périls), #271/#272 (mer séquencés),
  #273 (activités), #274 (garde quarantaine — **patron de verrou**), #275 (seam déclaratif — **patron de verrou**). Le RNG
  est propre : 0 `Math.random()` dans `src/state/**` et hors moteur seulement (audio/UI cosmétique).
- **#277** (traits navals, fix en vol) : verbatim MSLRC + écart coût/poids (§2, ligne « Sources »).
- **#278** (citations manquantes) : les 9 fichiers data sans `book`/`_source` (§2, ligne « Sources »).
- **Doctrine sources par-passage** committée (`8049b057`) : la dichotomie livre-règles/contenu tombe ; documenter par passage.
- **#256** : ratchets hex/prix (déjà arbitrés, contenus, non résorbés).
- **#229** : `PAY_CHOICES` déjà tagué (migration JSON reste ouverte, V17).
- **#139** : garde émoji (clôturé ; EXCEPTIONS vide) — V9 n'en est que l'élargissement de scope.
- **#236** : `component-conformance` (base) — V4 n'en est que l'élargissement de motif/portée.
- **`massBattleFlow.ts`/`interludeFlow.ts`** comme séquenceurs de jour : **non tranchés** (survolés par signatures
  seulement) — à auditer AVANT de leur imposer le verrou V18 ; s'ils s'avèrent déviants, ils rejoignent le patron du
  Lot 6 (cascade + specs), jamais une FSM locale.

### Angles morts assumés de cet inventaire (à ne pas prendre pour « propre »)
- Aucune recette navigateur des 12 flux pendings ni des séquenceurs — analyse 100 % statique.
- WIP concurrent non jugé : `combatFlow.ts`/`combatSlice.ts`/`shipCrew.ts`/`shipBattery.ts`/`netOwnership.ts`/`combat.ts`
  (git `M`) audités à HEAD seulement ; `pendingCrewTest`/`pendingShipManeuver`/`pendingShipBattery` (naval, WIP) hors périmètre.
- `massBattleFlow.ts`/`interludeFlow.ts` (séquenceurs), `travelPostes.ts`, 33 scripts QC, ~centaines de defs rig, verbatim
  MSLRC (PDF >100 Mo) : non lus ligne à ligne.

## Addendum (2026-07-10, chasse aux dormantes) — séquenceurs innocentés
Verdict complémentaire à la famille F4 : `massBattleFlow.ts` et `interludeFlow.ts` ne sont PAS des FSM
maison à cascader — leur forme est « handler + catalogue data-driven », structurellement distincte du
`while+switch` de `seaVoyageFlow` (seul déviant confirmé, traité par le Lot 6/Ronde 2 du seam). Aucun
lot supplémentaire. Chasse du même jour : 4 morts confirmés purgés (registre rig `races`, `psychLabels`,
`ParamFields`, baril `engine/index`), `.panel` inerte requalifié #306, stock TODO/skip/ts-ignore PROPRE.
Résidus non couverts de la chasse : 26 registres générés non vérifiés un à un, code mort intra-fichier,
orphelins de src/data/*.json, sweep set() incomplet — 2e tour de chasse après la vague en cours.
