# Matrice primitives x systemes (#298, volet 2) — 2026-07-11

> Artefact DATE (docs/plans/). Synthese du workflow 12 systemes + juge. La graine du manifeste (section finale) alimente la Phase 3 (#298 : le canon devient une DONNEE).

Verified: coop redundancy (ownsLocally:32 already returns true for local → 6-site `net.mode==='local'||` prefix is dead), bargainPct duplication (portFlow.ts:126 ≡ landMarketFlow.ts:157), gameIso `.combatants.find` = 35 sites/13 files. All three CONFIRMÉ. Consolidating.

# MATRICE primitives × systèmes — #298

Colonnes: CMB combat · MAG magie · MER voyage-mer · TER terre/fleuve · PER périls · REP repos/interlude · COM commerce · MND campagne/monde · MAS masse/siège · NET coop · EDI éditeur · REN rendu.
Cellules: **U** utilise · **C** contourne (réimplémente) · **M** manque-à-elle (besoin non branché) · **–** N-A.

| Primitive (fichier) | CMB|MAG|MER|TER|PER|REP|COM|MND|MAS|NET|EDI|REN |
|---|---|
| `makeRollFlow`/`FLOWS` `rollFlowSpecs.ts:352` | U|U|C|C|U|U|U|–|U|–|–|– |
| `openRoll`/`resolveSurface` `rollSeam.ts` | M|–|C|M|–|–|–|–|–|U|–|– |
| `RollShell`+`RollRow` `RollShell.tsx` | U|U|U|U|U|U|U|–|U|U*|–|– |
| `OptionChooser`/`ChoiceButtons` `OptionChooser.tsx` | U|U|U|–|U|U|U|U|M|–|U|– |
| `InfluenceRow` `InfluenceRow.tsx` | U|U|–|–|–|U|–|–|–|–|–|– |
| `VsHeader` `VsHeader.tsx` | U|U|–|–|–|–|–|–|C|–|–|– |
| `cascade` `registerCascadeApplier` `cascade.ts` | U|U*|U|U|U|U|–|U|–|–|–|– |
| `applyOps`/`GameOp` `ops.ts` | U|U|U|U|U|U|–|U|U|–|N|N |
| `fireTriggers` `triggeredEffects.ts` | U|U*|–|–|–|–|–|C*|–|–|N|N |
| `passiveMods` `trauma.ts` | U|N|C|–|–|–|–|–|–|–|N|N |
| `rule`/`policy` `policy.ts` | U|U|U|U|U|U|U|–|–|–|–|– |
| `findTableEntry` `tables.ts` | U|?|U|U|U|N|U|N|U|–|?|– |
| `netOwnership` (owns/piloted) `netOwnership.ts` | U|U|U|U|U|U|–|–|–|U|–|U |
| `actorIn`/`inBattleId` `combatOrParty.ts` | U|U|–|–|U|N|–|U|–|U|–|**C35** |
| `GameOpEditor` `GameOpEditor.tsx` | –|U|?|?|N|U*|–|U|U/M|–|U|– |
| `RefField` `RefField.tsx` | –|?|–|–|–|–|N|M|–|–|U|– |
| `SearchFilterField` `SearchFilterField.tsx` | –|–|–|–|–|–|M|–|–|–|C|– |
| `ScreenShell` `ScreenShell.tsx` | –|N|U|–|N|N|U|U|C|–|U|– |
| `Prose` `Prose.tsx` | –|–|N|–|–|U|U|U|–|–|U|N |
| `resolveRender`/`pickBackend` `bodyPlan.ts`,`pickBackend.tsx` | –|–|–|–|–|–|–|–|–|–|U|U/DEF |
| `_registry.generated` (mécanisme) | U|U|?|–|U|U|U|U|U|–|U|**U×24** |

`*`=partiel/indirect · `?`=non vérifié · `N`=type importé mais non exécuté (authoring).

# VERDICTS par primitive

- **Bien utilisées (garder tel quel)**: `RollShell`/`RollRow`, `OptionChooser`, `applyOps/GameOp`, `cascade`, `rule/policy`, `Prose`, `ScreenShell`, `resolveRender`/`refOf`/`sortByZ` (REN, 11 composeurs `composite.ts:25`).
- **À ÉTENDRE (M à couvrir)**:
  - `openRoll`: câbler CMB (tout `FLOWS.*`), TER (7 sites `humanControlled?cascade:rollTest` dont fourche `forcedPaceDay` dupliquée ~150 l. `travelFlow.ts:368-381`), MER (scorbut/épuisement forcés inline `seaVoyageFlow.ts:900-905,968-973`, **poison excuse sans `[entériné]`**).
  - `OptionChooser`: motif « jet-1d10 OU pick manuel » `MassBattleView.tsx:128-140`.
  - `RefField`: réfs projet-locales dynamiques (scene/place/dialogue/encounter) → `EffectList.tsx:175,478,695`, `WorldMapEditor.tsx:254` (mode `{id,label}[]` au lieu de `DatasetKey`).
  - `SearchFilterField`: stock/troc `MerchantPanel.tsx:146-151,509-526`; façade Codex `CompendiumScreen.tsx:161`.
  - `GameOpEditor`: complément cible « armée/Étape » non exprimable (`activities.ts:68`, éditeur dédié `BattleOutcomeListField` `CodexEdit.tsx:1106`) — extension du vocab, pas migration.
  - `cascade`: `registerCascadeApplier('miscast',…)` absent alors que `combatEndCorruption/Disease` l'ont (`combatFlow.ts:4316-4328` vs push nu `:3020`) — soit brancher soit documenter (réf nue).
- **Sous-adoptées (C → lots de migration)**:
  - `actorIn/inBattleId`: **REN = 35 sites/13 fichiers** recopient `.combatants.find(c=>c.id===)` (drop-in documenté `combatOrParty.ts:33`) — plus gros lot.
  - `makeRollFlow`/`RollShell`: COM `portFlow`/`landMarketFlow` résolvent le Marchandage en synchrone hors modale (`portFlow.ts:12-14`).
  - `ownsLocally`: NET 6 sites préfixent `net.mode==='local'||` redondant (déjà géré `netOwnership.ts:32`).
  - `bargainDeltaPct` (`cargo.ts:37`): 2 forks identiques `bargainPct` (`portFlow.ts:126`≡`landMarketFlow.ts:157`) faute de branche Succès Stupéfiant/`netSL`.
  - `VsHeader`: MAS `ArmyBars` réimplémente A-vs-B (`MassBattleView.tsx:49-72`) — à trancher (besoin distinct probable).
  - `ScreenShell`: famille `.menu-card` (MAS/interlude/menu/lobby) parallèle non résorbée.
- **Candidate au retrait/dette**: `resolveGroundPursuitRound` `engine/pursuit.ts:59` = code mort (seul son test l'appelle; `pursuitFlow.ts:118-153` réimplémente) → brancher ou supprimer.

# Primitives MANQUANTES (M orphelins) — foyer proposé

1. **`ownsLocallyOrSolo(state,id)`** → foyer `netOwnership.ts` (à côté de `ownsLocally`). Absorbe les 6 copies.
2. **`DayContext<T>`** (contexte de jour posé/patché/effacé) → foyer `voyageCadence.ts`. Unifie `RiverDayContext`/`LandDayContext`/`StageContext` (3 réinventions).
3. **`MultiRollList`/`NightEntry`/`ledgerRerollable`** (PV multi-jets en lecture + relance différée) → déjà `MultiRollList.tsx` + `restFlow.ts:76`; **promouvoir en table** (partagé repos/terre/fleuve/mer).
4. **`ctx.onCorruption` / patron `OpsCtx.onXxx`** (GameOp pur → flux store) → `ops.ts:1208`; documenter comme LE patron d'effet différé (8 câblages manuels).
5. **Patron « perception influençable → embuscade `noSurprise` »** → dupliqué `travelFlow.ts:689` / `seaVoyageFlow.ts:1313`; foyer commun `perils`/`combatEffects`.
6. **`Station`+`AssignRow`** (top-down slot + affectation héros) → `stations.ts`, `AssignRow.tsx`; déjà 2-3 systèmes.

# GRAINE DU MANIFESTE (`src/primitives.manifest`)

```jsonc
[
 {nom:"makeRollFlow/FLOWS", fichier:"src/state/rollFlowSpecs.ts:352", concept:"fabrique de flux de jet", perimetre:"tout Test interactif joueur", verrou:"rollflow guard (existant)"},
 {nom:"openRoll/resolveSurface", fichier:"src/state/rollSeam.ts", concept:"policy klass×contrôleur×cadence→M/V/I", perimetre:"porte UNIQUE de jet influençable", verrou:"PROPOSÉ: whitelist importeurs (adoption=chantier)"},
 {nom:"RollShell", fichier:"src/ui/RollShell.tsx", concept:"coquille de jet mono/multi", perimetre:"toute modale de jet", verrou:"aucune modale bespoke (existant)"},
 {nom:"OptionChooser", fichier:"src/ui/OptionChooser.tsx", concept:"choix seg/grid/actions", perimetre:"tout choix d'options+boutons décision", verrou:"—"},
 {nom:"cascade", fichier:"src/state/cascade.ts", concept:"étapes-jets subis influençables + appliers", perimetre:"toute conséquence différée en série", verrou:"registerCascadeApplier par kind"},
 {nom:"applyOps/GameOp", fichier:"src/engine/ops.ts:292", concept:"tout effet mécanique", perimetre:"soin/état/dégâts/corruption", verrou:"applyOps unique"},
 {nom:"fireTriggers", fichier:"src/state/triggeredEffects.ts", concept:"dispatcher effets déclenchés (DONNÉE)", perimetre:"Trait/Talent/Atout/État", verrou:"dispatcher unique (doc CLAUDE.md)"},
 {nom:"registerCombatHook", fichier:"src/state/combatHooks.ts:57", concept:"cycle de vie combat (MACHINERIE)", perimetre:"règles d'arène sans nommer d'entité", verrou:"PROPOSÉ: paire doc avec fireTriggers"},
 {nom:"passiveMods", fichier:"src/engine/trauma.ts", concept:"collecteur modif passif", perimetre:"trait/mutation/état/faim", verrou:"collecteur unique"},
 {nom:"navalPassiveOps", fichier:"src/engine/navalTraits.ts:42", concept:"passiveMods pour porteur coque", perimetre:"réf navale", verrou:"PROPOSÉ: entrée propre (fork documenté)"},
 {nom:"rule/policy", fichier:"src/engine/policy.ts", concept:"règles optionnelles RAW + house-rule taguée", perimetre:"tout arbitrage editable", verrou:"—"},
 {nom:"findTableEntry", fichier:"src/engine/tables.ts:8", concept:"lookup d100 par [min,max]", perimetre:"toute table à fourchettes", verrou:"—"},
 {nom:"netOwnership", fichier:"src/state/netOwnership.ts:17", concept:"axe contrôleur owns/piloted/aiDriven", perimetre:"gating siège/coop", verrou:"PROPOSÉ: entrer en table + ownsLocallyOrSolo"},
 {nom:"actorIn/inBattleId", fichier:"src/state/combatOrParty.ts:25", concept:"combattant par id combat-ou-groupe", perimetre:"toute résolution d'acteur", verrou:"PROPOSÉ: garde anti-.combatants.find"},
 {nom:"GameOpEditor", fichier:"src/ui/editor/GameOpEditor.tsx", concept:"édition GameOp[]", perimetre:"sorts/passifs/consommables/activités", verrou:"no-json-fields.test"},
 {nom:"RefField/REF_FIELD", fichier:"src/ui/compendium/RefField.tsx:29", concept:"picker de ref multilangue-safe", perimetre:"toute ref id (statique+PROPOSÉ dynamique projet)", verrou:"refFieldCfg centralisé"},
 {nom:"SearchFilterField", fichier:"src/ui/SearchFilterField.tsx", concept:"champ de filtre par label", perimetre:"toute liste filtrable joueur", verrou:"—"},
 {nom:"ScreenShell", fichier:"src/ui/ScreenShell.tsx", concept:"coquille écran plein-champ", perimetre:"carte/port/marché/négoce (+PROPOSÉ .menu-card)", verrou:"—"},
 {nom:"Prose", fichier:"src/ui/Prose.tsx", concept:"prose Markdown verbatim", perimetre:"tout champ de prose RAW", verrou:"no-html-in-prose.test"},
 {nom:"resolveRender/pickBackend", fichier:"src/gameIso/rig/bodyPlan.ts:90 + pickBackend.tsx:106", concept:"résolution rendu + dispatch backend", perimetre:"tout rendu iso/POV/portrait", verrou:"2 gardes DEV ref-véhicule"},
 {nom:"_registry.generated", fichier:"scripts (gen-registry)", concept:"registre-par-defs auto-chargé", perimetre:"tout dataset extensible", verrou:"PROPOSÉ: entrée mécanisme (24 registres gameIso)"},
 {nom:"MultiRollList/NightEntry", fichier:"src/ui/MultiRollList.tsx + src/state/restFlow.ts:76", concept:"PV multi-jets + relance différée", perimetre:"bilan nuit/traversée/journée", verrou:"PROPOSÉ: entrer en table"}
]
```

# LOTS d'exécution (ordonnés)

1. **[MIGRATION-XL] REN → `inBattleId`** — 35 sites/13 fichiers `gameIso` (`IsoStage.tsx:103`…`useStageCamera.ts`). Mécanique, 0 changement de garde. **Agent Sonnet effort moyen** (répétitif, verrou par garde ensuite).
2. **[MIGRATION-S] NET → `ownsLocallyOrSolo`** — créer helper `netOwnership.ts` + 6 remplacements. **Sonnet petit effort.**
3. **[EXTENSION-S] COM dé-fork bargain** — `bargainDeltaPct(negotiator,netSL)` dans `cargo.ts`, supprimer 2 `bargainPct`, brancher portFlow/landMarketFlow. **Sonnet petit.**
4. **[CRÉATION-M] `DayContext<T>`** dans `voyageCadence.ts` + 3 sites (river/land/stage). **Sonnet moyen.**
5. **[MIGRATION-M] openRoll** — CMB+TER+MER; gros, à découper (d'abord fermer le poison-excuse MER `seaVoyageFlow.ts:900-905,968-973`). **Opus/effort élevé, séquencé après décret canonique openRoll.**
6. **[EXTENSION-S] RefField dynamique** (mode `{id,label}[]`) + migration `EffectList`/`WorldMapEditor` selects. **Sonnet moyen.**
7. **[DETTE-S] pursuit** — brancher ou retirer `resolveGroundPursuitRound`. **Sonnet petit.**
8. **[DATA] Générer manifeste + régénérer table CLAUDE.md + matrice d'adoption** depuis `src/primitives.manifest` (l'acté #298). **Opus, petit.**

Décisions à trancher AVANT exécution (hors code): `openRoll` = porte canonique décrétée? · `.menu-card`⊂`ScreenShell`? · `VsHeader` couvre-t-il `ArmyBars`? · asymétrie naufrage fluvial sans `checkPartyWiped` (`riverVoyageFlow.ts:649-651`) = RAW ou lacune?

Non re-vérifié sur pièce (hérité des rapports, `?` en matrice): usage `findTableEntry` en MAG(`miscast.ts`)/EDI(tables authorées), `GameOpEditor`⇄`activities.json` (preuve indirecte via schéma).
