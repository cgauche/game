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
