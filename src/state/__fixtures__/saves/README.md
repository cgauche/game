# Fixtures golden — saves (#301)

Captures RÉELLES d'une `SaveGame` (`src/state/saves.ts`), écrites par le VRAI chemin de
sérialisation (`saveGame` → `readSlot`), jamais composées à la main. Chargées par
`src/state/saves-flow.test.ts` (« Golden saves ») : le filet qui empêchera un futur renommage/
restructuration (ex. #311, CharKey→slugs) de casser silencieusement le chargement d'une save
existante — l'échec de ce test exige un nouveau `MIGRATIONS[N]` dans `saves.ts`.

## Convention de nommage

`v<SAVE_VERSION au moment de la capture>-<nom>.json` — le préfixe `v<N>-` est lu par le CLIQUET
de `saves-flow.test.ts` (`MIGRATIONS[v]` + fixture `v<v>-*.json` exigées pour chaque version
`1..SAVE_VERSION-1`).

## Fixtures actuelles

- `v1-partie-reelle.json` — save pré-carte-de-campagne (worldMap vide), motive `MIGRATIONS[1]`
  (v1→v2, cf. commentaire dans `saves.ts`).
- `v2-voyage-maritime.json` — navire de campagne + équipage (le groupe) + plan de traversée maritime
  actif (`vessel`/`travelPlan` cohérents, MDG ch.13-15).
- `v2-post-combat-roster.json` — groupe complet (4) tout juste sorti d'un affrontement (Blessures/PX,
  `battle: null`).
- `v3-voyage-maritime-en-vol.json` — traversée maritime EN VOL sous l'ancien FSM (`sea.step`), motive
  `MIGRATIONS[3]` (v3→v4, drop de l'état en vol).
- `v4-convoi-terrestre.json` — convoi terrestre avec `caravanCargo` peuplé + bête de bât possédée,
  motive `MIGRATIONS[4]` (v4→v5, matérialisation du convoi sur `ItemInstance.cargo`, #327). Fixture de
  version PASSÉE, MINIMALE et écrite à la main (comme `v3-en-vol` : on ne peut pas générer une version
  antérieure depuis le code courant) — le seul cas où le « jamais à la main » cède à la nécessité.
- `v6-codex-focus-label.json` — focus Codex `compendiumFocus` en forme label-only `{category,label}`,
  motive `MIGRATIONS[6]` (v6→v7, focus keyé par `id` ; un label-only non résoluble par `state` est
  ramené à `null`, #371 lot B). Fixture de version PASSÉE, MINIMALE et écrite à la main (idem `v4-convoi`).
- `v13-objectif-sans-echeance.json` — objectif courant (`objectives`) au format v13, SANS `deadline`
  (#668, échéance de `setObjective` ajoutée en v14), motive `MIGRATIONS[13]` (v13→v14, champ ADDITIF
  optionnel — aucune transformation, `deadline` reste `undefined`). Générée par le VRAI chemin
  (`_generate.test.ts`) à v14 puis `version` ramené à 13 à la main (seule édition manuelle possible
  pour capturer une version PASSÉE depuis le code courant, idem `v4-convoi`/`v6-codex-focus-label`).
- `v14-legacy-sans-campaigndoc.json` — save legacy SANS `campaignDoc` (#766, snapshot du paquet ajouté
  en v15), motive `MIGRATIONS[14]` (v14→v15, champ ADDITIF injecté à `null`). Générée par le VRAI chemin
  (`_generate.test.ts`) à v15 puis `version` ramené à 14 + clé `data.campaignDoc` SUPPRIMÉE à la main
  (patron `v13-objectif-sans-echeance`, capture d'une version PASSÉE).
- `v15-campagne-snapshot.json` — save d'une campagne MULTI-scènes chargée par `loadProject`, `campaignDoc`
  PEUPLÉ (scènes `scene-a`/`scene-b` + carte + narratif embarqué). Golden de la version COURANTE : prouve
  le round-trip du snapshot (re-registration des scènes + re-dérivation du narratif au chargement, #766).

- `v16-cascade-psy-mono.json` — cascade de Psychologie EN VOL à la forme MONO (déclaration `encounterPsych`
  + jet sur l'ÉTAPE, aucun `participants`), motive `MIGRATIONS[16]` (v16→v17, bandification #1117 L1/L2 :
  les appliers exigent des RANGÉES, une étape mono serait abandonnée en silence). Fixture de version
  PASSÉE, MINIMALE et écrite à la main (idem `v4-convoi`/`v6-codex-focus-label`), forme legacy relevée
  dans l'historique (`af7774e2^:src/state/encounterPsychFlow.ts`).
- `v17-nuit-mono.json` — jets de NUIT EN ATTENTE à la forme MONO dans les TROIS porteurs d'étapes
  (cascade ACTIVE avec une étape déjà validée avant le curseur, pile SUSPENDUE, file
  `deferredUpkeepQueue`), dont deux Dessoûlages du MÊME héros (aucun `meta.day` : ce champ NAÎT avec
  #1117 L3 — la séparation se fait par le repli de dédoublement de la fabrique), motive
  `MIGRATIONS[17]` (v17→v18, bandification #1117 L3 : les appliers de nuit exigent des RANGÉES, une
  étape mono serait abandonnée en silence). Fixture de version
  PASSÉE, MINIMALE et écrite à la main (idem `v4-convoi`/`v16-cascade-psy-mono`).
- `v18-poursuite-mono.json` — MANCHE de poursuite terrestre EN VOL à la forme MONO (une étape PAR
  coureur, la première déjà validée avec son DR, `pursuit` en cours), motive `MIGRATIONS[18]`
  (v18→v19, bandification #1246 : l'applier de manche exige des RANGÉES, et la clôture compare TOUS
  les DR — LDB 15 l.93 — donc l'avant-curseur entre AUSSI dans la bande, à la différence des bandes
  de nuit). Fixture de version PASSÉE, MINIMALE et écrite à la main (idem `v17-nuit-mono`).
- `v19-fin-de-combat-mono.json` — cascade de BILAN DE COMBAT EN VOL à la forme MONO (une étape par
  personnage et par Test : Contraction de maladie, Exposition à la Corruption), motive
  `MIGRATIONS[19]` (v19→v20, bandification #1117 L4 : les deux appliers exigent des RANGÉES). Elle
  porte le cas legacy CRITIQUE : `h1` a DEUX étapes de MÊME id `combatEndDisease-h1-infection-mineure`
  — l'Infection post-critique (LDB 20 l.72) et la Contagion (LDB 20 l.32-49) visaient la même maladie
  et l'id d'étape v19 ne portait aucun discriminant d'entrée. Les fondre en une bande donnerait deux
  rangées de même id, injoignables : le filet d'id de la fabrique doit les rendre en DEUX bandes.
  Fixture de version PASSÉE, MINIMALE et écrite à la main (idem `v18-poursuite-mono`).
- `v20-etape-interactive.json` — save v20 dont les ÉTAPES portent encore `interactive` au niveau ÉTAPE,
  dans les TROIS porteurs (cascade ACTIVE, pile SUSPENDUE, file `deferredUpkeepQueue`), motive
  `MIGRATIONS[20]` (v20→v21, #1262 V2 L4 : le champ write-only quitte `CascadeStepBase`). Les RANGÉES
  gardent le leur (`interactive: true`/`false` sur `participants[]`) — c'est un AUTRE champ, et la
  fixture porte les deux valeurs pour le prouver. Fixture de version PASSÉE, MINIMALE et écrite à la
  main (idem `v19-fin-de-combat-mono`).
- `v22-bras-de-fer-legacy.json` — partie de BRAS DE FER EN VOL par le chemin LEGACY (étape
  `tavern-game` du mode `extended`, dont le `meta` porte `round`/`cumPlayer`/`cumOpponent`), motive
  `MIGRATIONS[22]` (v22→v23, #1279 S1 : le mode étendu passe au socle de séquence et l'applier de ce
  `kind` disparaît). Contrat livré = INVALIDATION EXPLICITE : l'étape est retirée et la partie
  abandonnée — ses cumuls ont été calculés en planchant CHAQUE manche, là où le Test étendu additionne
  les DR avec leur signe (LDB 12 l.174), donc ils ne se reportent pas. Générée par le VRAI chemin
  (`_generate.test.ts`) AVANT la bascule du code.
- `v23-charge-sur-combattant.json` — héros dont l'ÉTAT DE CHARGE (`loaded`/`reloadProgress`/`ammoUid`/
  `loadedAmmoUid`/`chambered`) vit au niveau du COMBATTANT, forme v23. Motive `MIGRATIONS[23]` (v23→v24) :
  l'état passe sur l'INSTANCE D'ARME (arbitrage utilisateur 2026-08-16 — deux armes à distance gèrent
  chacune leur rechargement et leur munition), sinon une arbalète rechargée avant la sauvegarde se
  rechargerait au vide et les champs orphelins seraient re-sérialisés indéfiniment. Dérivée de la fixture
  v22 (capture d'une version PASSÉE, non générable depuis le code courant — patron `v13`/`v14`) : état
  legacy du bras de fer neutralisé, arme à distance + état de charge v23 posés à la main.

## Ajouter/régénérer une fixture

Ne JAMAIS écrire un fichier de save à la main. Utiliser `_generate.test.ts` (suite `describe.skip`
— jamais exécutée en CI) :

1. Ajouter/adapter un cas dans `_generate.test.ts` : construire un état réaliste via
   `useGame.setState` (mêmes helpers que les autres suites `src/state/*.test.ts`), appeler
   `useGame.getState().saveGame(slot)`, puis `write('<nom>', slot)`.
2. Retirer temporairement `.skip` sur le `describe`, lancer
   `npx vitest run src/state/__fixtures__/saves/_generate.test.ts`, puis remettre `.skip`.
3. Vérifier le fichier écrit (`git diff`) avant de le committer.
4. Si la capture se fait à une NOUVELLE `SAVE_VERSION` : ajouter aussi `MIGRATIONS[N-1]` dans
   `saves.ts` — le CLIQUET refuse un bump de version sans fixture ET sans migrateur.
