# 3ᵉ chasse aux dettes — synthèse (#321, programme #276)

> Artefact DATÉ (`docs/plans/`) — 2026-07-11. Supprimé une fois les lots exécutés. Origine :
> § NON COUVERT de `docs/plans/2026-07-11-chasse-2-synthese.md` (supprimé), 4 lentilles à OUTILLER
> (scripts rejouables, pas du grep ponctuel) : obtenabilité réelle, exhaustivité id-par-id de
> registres, `set()` bruts des flows, re-vérif des trous de couverture frères `isBestial`/
> `hasPerturbingAura`.

## LE COMPTE (credo : doit décroître)

1ᵉʳ tour : ~390 sites / 31 familles. 2ᵉ tour : ~150 sites / ~10 familles. **Ce tour : 17 dettes
actionnables** (6 Talents + 11 Sorts jamais-obtenables, un seul root cause commun pour 10 des
11 Sorts) **+ 1 nettoyage trivial** (terme mort retiré d'une regex de garde). Les 2 autres
lentilles outillées (exhaustivité id-par-id, `isBestial`) reviennent **PROPRES** après mesure —
aucune dette, garde déjà suffisante ou étendue par précaution. Le gisement structurel reste
ÉTEINT ; cette passe referme le dernier NON-COUVERT de la 2ᵉ chasse plutôt que d'en ouvrir un
nouveau.

## Lentille 1 — Obtenabilité réelle (LE gisement)

Script `scripts/data/obtainability-graph.mts` (mécanique dans `scripts/data/lib/obtainabilityGraph.ts`,
réutilisée par la garde) : graphe DONNÉE→DONNÉE sur talents.json (179)/spells.json (416) — sources
recensées : `ref`/`wildcard`/`choice`/`random` de espèce/carrière (`species.json`/`careerLevels.json`),
`creatures.json` (statblocks), Table des Talents aléatoires (LDB, partagée), GameOp `grantTalent`
(mutations/étoiles/possessions/sorts/scènes), Effet de scène `learnSpell`, et pour les Sorts : les
5 Talents de lanceur (`magie-mineure`/`magie-des-arcanes`/`invocation`/`beni`/`magie-du-chaos`) +
leurs Domaines/Cultes atteignables (réutilise `specIdsOf`, SOURCE UNIQUE de résolution de spéc,
`src/data/index.ts` — mêmes pools que la création de personnage).

**6 Talents JAMAIS-obtenables** (sur 179) :
- `talent-aleatoire` (LDB p.132) — **FAUX POSITIF STRUCTUREL** : entrée MÉTA de la Table des
  Talents aléatoires elle-même (matchée par `RANDOM_ENTRY_RE`, `engine/character.ts`), pas un
  Talent réellement possédable. Pas une dette — à documenter (`codex-seulement`, marqueur de table).
- `sang-neuf` (Archives de l'Empire 1 p.78) — lignage Eonir (Laurelorn) : aucune espèce/carrière/
  mutation ne le confère. **À VÉRIFIER AU RAW** (ADE1) avant ticket : soit un chemin espèce/culture
  manque au câblage, soit c'est un talent de PNJ/référence (ticket de vérification, pas de fix direct).
- `benediction-de-tzeentch`, `disciple-du-changement`, `empreint-de-la-magie` (Ennemi dans l'ombre
  Compagnon p.75/75/79) — 3 Talents dont la desc ("Lorsque vous achetez ce Talent…") suggère un
  achat PX légitime, sans carrière/mutation qui les accorde dans la donnée actuelle. **À VÉRIFIER
  AU RAW** (chapitre EDOC p.75-79 — probablement une carrière du Chaos/culte non encore câblée,
  ou une Mutation/table de Corruption qui devrait les octroyer via `grantTalent`).
- `double-vie` (Ennemi dans l'ombre Compagnon p.75) — idem, à vérifier.

**11 Sorts JAMAIS-obtenables** (sur 416) — **UN SEUL ROOT CAUSE** : les 11 sont TOUS `family:
'chaos'` (`allure-demoniaque`, `aspect-sublime`, `decharge-de-corruption`, `dechirer-l-aethyr`,
`esclave-des-tenebres`, `explosion-de-corruption`, `obsession`, `odieux-messager`,
`pouvoir-du-chaos`, `flot-de-corruption`, `consentement`). Le Talent `magie-du-chaos` (racine de
la famille `chaos`) n'a **AUCUN chemin joueur** : ni carrière, ni espèce, ni mutation/étoile/scène
ne l'accorde — sa SEULE occurrence hors `talents.json` est **1 statbloc de créature**
(`eusapia-balacanon`) avec une spéc UNIQUE (1 dieu sombre) → seuls 15/26 Sorts du Chaos de ce dieu
sont "obtenables" (via ce monstre — pas un héros), les 11 autres (autres dieux) restent hors
d'atteinte pour QUICONQUE. `buySpell` gère la mécanique complète (100 PX + 1 Corruption,
`state/buy-spell.test.ts`) mais le TEST l'exerce en injectant `talents.push({talentId:
'magie-du-chaos', spec: 'nurgle'})` DIRECTEMENT sur le fixture — jamais via un chemin de jeu réel.
**Violation de la règle stricte 7** (« Pas de MJ — tout se modélise ») : l'acquisition de la Magie
du Chaos (typiquement narrative en RAW — corruption/pacte) n'a AUCUN arbitrage explicite modélisé
(mutation `grantTalent`, table de Corruption majeure, ou scène). **P1 candidat** : ticket dédié,
grounding RAW requis (LDB 19 Corruption/Mutation, EDOC) avant d'écrire le chemin d'octroi.

**Garde posée** (cliquet baseline, `scripts/guards/lib/` + `src/data/obtainability-guard.test.ts`) :
fige `talentNever.length ≤ 6` / `spellNever.length ≤ 11` — toute régression (nouveau contenu Codex
sans chemin d'obtention) fait échouer la garde ; toute baisse (contenu câblé) DOIT abaisser la
baseline dans le test.

## Lentille 2 — Exhaustivité id-par-id des registres

Mesure AVANT extension (consigne : « ce qui a déjà une garde s'ÉTEND, jamais un 2ᵉ scan
parallèle ») :
- **`no-phantom-icon` (127+ refs) — couverture VÉRIFIÉE COMPLÈTE**, pas d'extension nécessaire :
  `src/gameIso` porte 6 réfs `icon:` mais elles sont typées `IconId` (import compilé de
  `src/ui/icons`), donc DÉJÀ verrouillées par `tsc` — même statut que `src/ui/**` (exclu par
  construction de la garde runtime). `src/state`/`src/scenes`/`src/data/*.json` (le seul
  périmètre non-compilé) restent la couverture EXACTE du garde existant.
- **Réfs `shape` de `trappings.json` → `WEAPON_DEFS`/`SHIELD_DEFS`** (routage `weaponFamily`,
  `gameIso/rig/parts/equipment.ts`) : 100 trappings portent un `shape`, **0 phantom** (tous
  résolvent). Classe VIDE — pas de garde posée (mandat : verrou seulement si non-vide).
- **Réfs `appearance.tenue` de `species.json`/`creatures.json` → `TENUE_BY_ID`/`CLASS_TENUE_BY_ID`**
  (`gameIso/rig/parts/tenues/index.ts`, résolution par `slugId(d.name)` + repli classe) : 60 réfs
  distinctes, **0 phantom**. Classe VIDE.
- **`SOUND_DEFS` (`playSfx('...')`)** : surface MINUSCULE et centralisée (8 sites, `src/audio/wiring.ts`
  + `AudioControls.tsx`, contre ~700 pour les icônes) — **0 phantom** mesuré, mais AUCUNE garde
  n'existait (contrairement aux icônes). Garde posée par précaution (surface petite mais réelle,
  même risque structurel qu'une icône fantôme — absorption silencieuse) :
  `scripts/guards/lib/soundRefs.mjs` + `src/audio/no-phantom-sound.test.ts` (mécanique JUMELLE de
  `iconRefs.mjs`/`no-phantom-icon.test.ts`).
- `WEAPON_DEFS`/`ARMOUR_DEFS`/`TENUE_DEFS` en tant que REGISTRES (côté « chaque def est
  référencée ») : générés par `scripts/gen-registry.mjs` en scannant leurs dossiers `defs/` —
  EXHAUSTIFS PAR CONSTRUCTION (aucune def orpheline possible, le générateur énumère le dossier).
  Seul le sens INVERSE (chaque réf résout une def) avait un risque réel — mesuré ci-dessus, clean.

**Lentille CLAIRE (0 dette)** — 3 gardes existantes/étendues confirment leur couverture, 1 nouvelle
garde posée par précaution sur une surface saine.

## Lentille 3 — `set()` bruts des ~55 flows métier (MESURE seule, aucune correction)

Script `scripts/data/set-scan.mjs` (mécanique `scripts/guards/lib/setScan.mjs`) : scan par
parenthésage (pas un parseur AST — suffisant pour un COMPTE) de `set({...})`/`set((s) => ({...}))`
sur **111 fichiers** `src/state/*.ts` (hors `store.ts`/`stateFields.ts`) — 35 fichiers en portent
au moins un.

- **689 `set()` littéraux** au total.
- **280** touchent DIRECTEMENT un champ `STATE_FIELDS` (`pending*`) hors `...resetFields(...)`.
- Concentration attendue sur les gros orchestrateurs : `combatSlice.ts` (216 / 146),
  `combatFlow.ts` (101 / 37), `seaVoyageFlow.ts` (53 / 6) — la MAJORITÉ des 280 sont des fermetures
  LÉGITIMES de la propre modale du flow (`set({ pendingAttack: null, journal: [...] })` à la
  résolution d'une attaque), pas des resets ad hoc erronés : confirme le verdict de la 2ᵉ chasse
  (« cœur des `set()` sains », `netFlow.ts` : 13/0, `partyFlow.ts` : 21/0, `travelFlow.ts` : 35/0).
  Aucune classification fine « légitime vs accidentel » par site n'a été faite ICI (hors mandat —
  MESURE seule) ; un curateur qui veut migrer vers un helper `clearPending(key)` partagé dispose du
  rapport complet (`scripts/data/.out/set-scan-report.json`, régénérable, gitignoré) pour trier.
- **Garde posée (agrégat, PAS par-fichier)** : `src/state/set-scan-guard.test.ts` fige
  `totalCalls ≤ 689` / `totalAdHocResets ≤ 280` — borne la CROISSANCE non revue sans exiger de
  correction immédiate (cf. patron `combat-hardcode-guard.test.ts`, baselines par-famille).

## Lentille 4 — Trous de couverture frères (`isBestial`/`hasPerturbingAura`)

- `hasPerturbingAura` : **0 occurrence confirmée** dans tout `src/**` (déjà signalé mort à la
  2ᵉ chasse) → terme retiré de `TRAIT_TALENT_RX` (`scripts/guards/lib/hardcode.mjs:29`), nettoyage
  TRIVIAL comme demandé. `combat-hardcode-guard.test.ts` reste vert (0 site concerné, baselines
  inchangées).
- `isBestial` : **SAIN** — `engine/traits/dispatch.ts:303` route par `traitCapability(traits,
  'bestial')` (id STABLE, pas de label), tous les appelants (`state/ai.ts`, `state/combatManeuvers.ts`)
  l'utilisent via la fonction canonique. Sa présence dans `TRAIT_TALENT_RX` est le patron VOULU
  (cliquet de croissance des sites d'appel, comme `hasTalent(`/`hasTraitKey(` — pas un signe de
  hardcode par-nom) ; `combat-hardcode-guard.test.ts` couvre déjà ses baselines par-fichier. Aucun
  nouveau trou trouvé — le fix `hasTalent\(` de la 2ᵉ chasse (P1) reste la seule extension récente.

## Fichiers livrés

- `scripts/data/lib/obtainabilityGraph.ts` (mécanique) + `scripts/data/obtainability-graph.mts` (CLI)
  + `src/data/obtainability-guard.test.ts` (garde, baseline 6/11).
- `scripts/guards/lib/soundRefs.mjs`/`.d.mts` + `src/audio/no-phantom-sound.test.ts` (garde, 0 phantom).
- `scripts/guards/lib/setScan.mjs`/`.d.mts` (mécanique) + `scripts/data/set-scan.mjs` (CLI)
  + `src/state/set-scan-guard.test.ts` (garde agrégat, baseline 689/280).
- `scripts/guards/lib/hardcode.mjs` (terme mort `hasPerturbingAura` retiré de `TRAIT_TALENT_RX`).
- `.gitignore` : `scripts/data/.out/` (rapports JSON régénérables, non trackés).

## Tickets à ouvrir (triage utilisateur)

1. **P1 — Magie du Chaos sans chemin joueur** (règle stricte 7, « pas de MJ ») : aucune
   carrière/espèce/mutation/étoile/scène n'accorde le Talent `magie-du-chaos` — 11 Sorts du Chaos
   (sur 26) hors d'atteinte pour QUICONQUE (même un monstre). Grounding RAW requis (LDB 19, EDOC)
   avant d'écrire le chemin d'octroi (mutation `grantTalent` la plus probable).
2. **P2 — 5 Talents EDOC/ADE1 à vérifier au RAW** : `sang-neuf`, `benediction-de-tzeentch`,
   `disciple-du-changement`, `empreint-de-la-magie`, `double-vie` — soit un chemin
   carrière/espèce/mutation manque, soit ce sont des Talents de référence (PNJ/campagne scriptée)
   à documenter `codex-seulement` plutôt qu'à câbler. Un agent dépêché au Source `Ennemi dans
   l'ombre Compagnon` p.75-79 et `Archives de l'Empire 1` p.78 tranche.
3. **P3 — `talent-aleatoire` comme entrée méta** : documenter (commentaire de schéma ou champ
   dédié) que cette entrée de `talents.json` n'est PAS un Talent possédable — pour que la garde
   `obtainability-guard.test.ts` puisse un jour l'exclure explicitement plutôt que de la compter
   dans la baseline (actuellement : 1 des 6 « jamais-obtenables » est ce faux positif structurel).
