# Revue adversariale de PALIER — 11 commits de substance, 0 fermeture, 3 sessions, 2026-09-03

verdict: PARTIEL

Revue rendue par un juge en lecture seule (mandat : réfuter) sur la fenêtre `0139bd89c..7692b631c` — arbre ÉPINGLÉ à `7692b631c0840f09362edbc11917af5f13f2f1d1` (= `origin/main` au moment du jugement), lu par `git show <sha>:<chemin>`, jamais par le working tree (WIP de sessions voisines). Contrôle positif : `git show HEAD:scripts/guards/lib/stocksNominatifs.mjs` existe (porte T3 de L1b dans l'arbre jugé), `.claude/soldes/revue-palier-64c09deba.md` archivée, compteur `.git/wfrp-palier.compteur` = 11, `git log --oneline 0139bd89c..HEAD -- src scripts` = 11. Compteur PARTAGÉ mesuré à 11 : 14 commits dans la fenêtre, 11 touchent `src/**`/`scripts/**` (les 3 autres — `ba046ca83`, `61d815dc7`, `7692b631c` — sont des régénérations `docs/`). Le CONTENU tient : les 4 commits vérifiés au hasard sont exacts à l'octet. Ce qui fuit est encore la PORTE, et cette fois elle a cédé DEUX fois dans le même palier : **`main` est laissé CI-ROUGE à HEAD**, et le cliquet de stock posé par L1b T3 a été enjambé par le train suivant de la MÊME session, six heures après sa pose.

## Fermetures

- **Par commit : ZÉRO.** `git log 0139bd89c..HEAD` × `FERMETURE_RE` (`/(fixes|closes|corrige|ferme)\s+#(\d+)/gi`, `scripts/hooks/fermetures-sans-solde.test.mjs:18`) = 0 occurrence. Aucun solde à juger, aucun reste routé, aucune dette commentée : le régime de solde n'est pas mis en défaut dans cette fenêtre — il n'est pas exercé.
- **Hors commit : ZÉRO dans la fenêtre.** `gh api 'search/issues?q=repo:cgauche/game+is:issue+closed:>=2026-09-02'` = 3 items (#1682 10:47Z, #1673 05:17Z, #1659 04:50Z), tous ANTÉRIEURS à la base `0139bd89c` (2026-09-02 12:26Z) — ils appartiennent au palier précédent. `closed:>=2026-09-02T12:00:00Z` = **0** (contrôle positif : `updated:>=2026-09-02T12:00:00Z` = 13, le filtre horaire mord).
- **11 commits de substance, 0 ticket fermé** — un palier entier sans solde. Corollaire : le pilotage de l'épique n'a pas été tenu (voir Dérive).

## Commits vérifiés (4 au hasard, 2 sessions voisines)

| sha | session | annonce vérifiée | preuve à HEAD |
|---|---|---|---|
| `1e14c9922` | audit-workflow #1657 B2b | `noeudTest(flowSchema,{difficulteRequise:true})` sur maladies/symptômes, `NoeudTestField` composé par les DEUX porteurs, `onFail` 0 en donnée | `src/data/schemas/defs/maladies.ts:45`, `defs/symptoms.ts:31`, `defs/criticals.ts:34`, `src/ui/editor/FlowEditor.tsx:74` + `compendium/CodexEdit.tsx:618` + `compendium/StructFields.tsx:115,142` ; `git show HEAD:src/data/symptoms.json \| grep -c onFail` = **0** |
| `30dd38716` | game-c5 #1680 #1507 | recettes en MÈTRES (`xM/yM/hM`, `radiusM`), `SAVE_VERSION` 41, migration datée, plus aucune recopie `?? 2` | `src/data/schemas/defs/props.ts:19,20,33,75` ; `src/state/saves.ts:78 = 41` ; `scripts/migrations/2026-09-02-1507-recettes-en-metres.mjs` présent ; `metresPerTile ?? 2` : 1 seul site de code (`src/state/scene.ts:419`), les autres hits sont le test nominatif `src/state/echelle-de-scene.test.ts:12,51,111` |
| `9967d06b4` | game-c5 #1680 lot 3 | `PropPrimitive.emet` au schéma (`true` seul), cliquet `MASQUES_GELES 'props.json': 41`, foyer mesuré | `src/data/schemas/defs/props.ts:26 z.literal(true).optional()`, `:31` ; `src/data/maison-sans-source.test.ts:74 { 'actions.json': 29, 'props.json': 41 }` ; `src/gameIso/stage/foyer-de-lampe.test.ts:78` |
| `17926d5de` | game-c5 #1509 L1 (« SOCLE empreinte DÉRIVÉE des props volumiques (design jugé 2 passes) : le corps tourné  ») | ligne de vue par INDEX mémoïsé `memoByRef` | `src/state/lineOfSight.ts:12,115,117` |

Gates annoncées au message (14 commits relus intégralement) : **4 sans aucune gate** — `ba046ca83`, `17926d5de`, `7692b631c` (docs/cherry-pick) et, plus grave, `429b9a1a2` annonce `hooks 491/491, test:docs 30/30, test:raw 311/311, tsc 0, eslint 0` **sans suite complète ni `deps:unused`** — précisément la gate qu'il a cassée. `1e14c9922` est le seul à chiffrer la suite (`node 1430 fichiers / 20327 verts, jsdom 159 / 1478`).

## CI

9 runs sur la fenêtre (`gh run list --workflow=ci.yml --branch main`), **7 verts / 2 rouges = 78 %**. 5 commits de la fenêtre n'ont AUCUN run propre (`572e60b8b`, `bbb6d11b9`, `91c928d16`, `ba046ca83`, `429b9a1a2`) : poussés en lot, seule la tête est jugée.

1. `17926d5de` — run **33685389563**, step `npm run docs:check`, cause : cherry-pick d'un commit du 24/08 qui décale `lineOfSight.ts` sans régénérer les champs `Implémente` des fiches RAW. Message : aucune gate. Corrigé 16 min plus tard par `61d815dc7` (run 33686877301 vert), qui le DIT au message — reconnaissance honnête, mais le rouge a été poussé.
2. **`7692b631c` = HEAD jugé = `origin/main` au jugement, ROUGE** — run **33691303703**, step 11 `npm run deps:unused` : `Unused devDependencies (1) / tsx  package.json:103:6`, `exit code 1`. Attribution par élimination : le parent `61d815dc7` est VERT (33686877301) et `7692b631c` est docs-only (`git show --stat` : 33 fichiers, tous `docs/`) → **l'introducteur est `429b9a1a2` (L1b T2)**, qui a supprimé les trois dernières invocations littérales du binaire (`git diff 61d815dc7..429b9a1a2` : `-execFileSync('npx', ['tsx', 'scripts/docs/lib/dump-exposition.mts']` ×2, `dump-epigraphes` ×1, et `tsxDe` → `tsxEsmDe` qui joint `node_modules/tsx/dist/esm/index.mjs` par `path.join`). Mécanisme instruit après le jugement : knip suit `import.meta.resolve('<littéral>')`, pas un `createRequire(…).resolve` ni un `path.join` — corrigé par `94ab32898`.
3. **Conséquence non dite : à HEAD, 20 steps sur 31 sont `skipped`** — `typecheck`, `lint`, `npm test`, `test:map`, `build`, `docs:check`, `build-all.mjs --empreinte`, les 7 gates RAW, `server typecheck`. `main` n'a donc AUCUNE preuve CI de typecheck, de suite, ni de `docs:check` sur son état courant. Pire : le step `node scripts/docs/build-all.mjs --empreinte` AJOUTÉ par `429b9a1a2` (`.github/workflows/ci.yml`, hunk `+45,2`) **n'a jamais tourné une seule fois sur `main`** au moment du jugement — la porte posée par L1b T2 est, en CI, non vérifiée.
4. Point POSITIF : les 2 rouges du palier précédent étaient `npm run lint` ; aucun rouge de lint ici. Le lint du diff stagé est bien posé (`scripts/git-hooks/pre-commit.mjs:38,359-364`, `scripts/guards/lib/lintStage.mjs`).

## Stocks nominatifs

Sonde (rejeu de `croissancesNonCouvertes` de `scripts/guards/lib/stocksNominatifs.mjs` sur chacun des 14 commits, code en fin de revue) — 3 croissances nettes, **0 ligne `CLIQUET:` dans les 14 messages** :

| sha | fichier | net | statut |
|---|---|---|---|
| `1e14c9922` (16:03, AVANT la porte) | `src/engine/disease-noeud-test.test.ts` | +2 | rapporté, non jugé |
| `1e14c9922` (16:03, AVANT la porte) | `src/state/flowtest-derived-stake.test.ts` | +1 (`'maladies.json': 'disease',`) | rapporté — c'est le registre `AUTO_RESOLUS`, le cas FONDATEUR qui a motivé la porte T3, et il a grandi une fois de plus le jour même |
| `572e60b8b` (19:40, AVANT la porte) | `scripts/guards/lib/lintStage.test.mjs` | +8 | rapporté (fixtures de test neuf = faux positif nommé par `91c928d16`) |
| **`429b9a1a2` (00:22, APRÈS la porte de `91c928d16` 20:48)** | `scripts/docs/lib/enregistreur-lectures.test.mjs` | **+3, NON COUVERTE** | **la porte n'a pas mordu** |

Le trou est structurel, pas accidentel : le garde au commit vit dans le hook PreToolUse, et la porte a posteriori `scripts/hooks/stocks-nominatifs.test.mjs` ne lit que `git show HEAD` (`dernierCommit()`) — sur un push en lot, tout commit qui n'est pas la TÊTE est invisible. Ici HEAD est `7692b631c` (docs-only) : la croissance de `429b9a1a2` a traversé les DEUX portes, six heures après leur pose, par leur propre session.

## Actions routées par la revue précédente (`revue-palier-64c09deba.md:18`)

| action | lot | état mesuré |
|---|---|---|
| (a) `npm run lint` sur le diff stagé au pre-commit | L1b | **TENUE** — `pre-commit.mjs:38,359-364` + `scripts/guards/lib/lintStage.mjs` (`572e60b8b`) ; 0 rouge de lint dans la fenêtre |
| (b) canari mesurant les issues CLOSED par l'API | L2 | non faite (L2 à venir) — `fermetures-sans-solde.test.mjs:18,55` lit toujours `git log --since` + `FERMETURE_RE` seuls |
| (c) solde a posteriori de #1659 et #1673 | L2 | non faite — `git ls-tree -r HEAD .claude/soldes` : ni `1659.md` ni `1673.md` |
| (d) justificatif daté du sha au pre-push | L2 | non faite — aucun `pre-push` dans `git ls-tree HEAD scripts/git-hooks/` ni dans `.git/hooks/` (seul `pre-push.sample`) |

## Dérive

- **Fan-out : 0 créé / 0 fermé** depuis 2026-09-02T12:00Z. Régime « fan-out ≤ 1 » tenu ; mais 11 commits de substance sans une seule fermeture = le palier consomme du budget de revue sans solder de dette.
- **Pilotage d'épique périmé** : le dernier commentaire de #1679 est « PILOTAGE v4 » (2026-09-02T13:39Z) et y écrit `| L1b | **PROCHAIN** |` — or L1b a été POSÉ (T1 `572e60b8b`, fix `bbb6d11b9`, T3 `91c928d16`, T2 `429b9a1a2`) et le v4 prévoyait lui-même « pilotage v5 » en clôture de L1b. La doctrine `feedback-pilotage-epic-commentaire-github.md` n'est pas tenue ; #1679 est le SEUL porteur du programme, son état affiché est faux.
- **Régime « pas de push sur CI rouge » : cassé deux fois** — `17926d5de` poussé rouge, puis `main` LAISSÉ rouge à HEAD depuis 22:37Z sans commit de rattrapage (rattrapé par `94ab32898` le 2026-09-03 05:00Z, ≈ 6 h 30 plus tard).

## Écarts (fichier:ligne + sha)

1. `429b9a1a2` — `.github/workflows/ci.yml` step `deps:unused` rouge à HEAD (run 33691303703) : `tsx` devDependency non vue depuis le retrait des invocations littérales (`scripts/docs/build-all.mjs`, hunks `-execFileSync('npx', ['tsx', …])` ×3 ; `scripts/lancer-local.mjs:70-82 sortieOutilLocal`). Effet : 20 steps CI skippés à HEAD, dont `npm test`, `npm run typecheck`, `npm run docs:check` et `node scripts/docs/build-all.mjs --empreinte`.
2. `429b9a1a2` — `scripts/docs/lib/enregistreur-lectures.test.mjs` : +3 entrées nettes de stock nominatif sans `CLIQUET:` au message, la porte `91c928d16` étant en vigueur depuis 3 h 34 (mesure : sonde ci-dessous).
3. `scripts/hooks/stocks-nominatifs.test.mjs` (`dernierCommit()`, `git show HEAD -U0`) — la porte a posteriori ne juge que la TÊTE d'un push : angle mort non nommé dans sa docstring (elle nomme le canal PreToolUse et les merges, pas le lot).
4. `17926d5de` — commit de production (`src/state/lineOfSight.ts`) poussé sur `main` sans aucune gate au message, rouge `docs:check` (run 33685389563).
5. `scripts/hooks/fermetures-sans-solde.test.mjs:18,55` — détecteur toujours aveugle aux fermetures hors commit ; #1659 et #1673 restent sans solde versionné (2ᵉ palier consécutif).
6. #1679 (commentaire du 2026-09-02T13:39Z) — état `L1b PROCHAIN` faux depuis 4 trains ; pilotage v5 annoncé, non posé.

**Actions routées** : (α) `npm run deps:unused` réparé et `main` reverdi AVANT tout nouveau travail — puis `deps:unused` ajouté aux gates chiffrées obligatoires du message (#1679, L1b clôture) ; (β) la porte a posteriori de stock mesure la PLAGE poussée (`git log <before>..<after>`), pas `HEAD` seul — sinon un push en lot la contourne par construction (#1679, L2, avec le pre-push de l'action (d) qui connaît déjà `before..after`) ; (γ) `CLIQUET:` rétroactif ou retrait des 3 entrées de `enregistreur-lectures.test.mjs` (#1679, L1b) ; (δ) actions (b)(c)(d) du palier précédent restent dues en L2 ; (ε) pilotage v5 de #1679 posé avec l'état RÉEL de L1b. Rien à rouvrir sur le fond : aucune fermeture dans la fenêtre, et les 4 commits vérifiés tiennent leurs annonces.

## Sondes (à promouvoir en test committé — L2)

**Sonde 1 — croissance de stock non couverte, par commit de la fenêtre** (lecture seule) :

```js
// SONDE (lecture seule) — rejoue la porte T3 (91c928d16) sur chaque commit de la fenêtre.
import { execFileSync } from 'node:child_process'
import { croissancesNonCouvertes, croissanceDesStocks } from 'file:///C:/Users/gauch/PhpstormProjects/Foundry/Game/scripts/guards/lib/stocksNominatifs.mjs'
const ROOT = 'C:/Users/gauch/PhpstormProjects/Foundry/Game'
const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })
const shas = git('log', '--format=%H', '0139bd89c..HEAD').trim().split('\n').reverse()
for (const sha of shas) {
  const msg = git('show', '-s', '--format=%B', sha)
  const diff = git('show', '--format=', '-U0', sha)
  const tout = croissanceDesStocks(diff)
  const nc = croissancesNonCouvertes({ diff, message: msg })
  if (!tout.length) continue
  console.log(`\n=== ${sha.slice(0, 9)} ${msg.split('\n')[0].slice(0, 70)}`)
  for (const c of tout) console.log(`  ${c.fichier} : +${c.net} net (${c.ajoutees}a/${c.retirees}r) ex. ${c.exemples.join(' | ').slice(0, 160)}`)
  console.log(`  NON COUVERTES par CLIQUET: ${nc.length ? nc.map((c) => c.fichier + ' +' + c.net).join(', ') : '(aucune)'}`)
}
```

Sortie :
```
=== 1e14c9922 refactor(data/engine/ui)!: refs #1463 #1657 train B2b
  src/engine/disease-noeud-test.test.ts : +2 net (2a/0r)
  src/state/flowtest-derived-stake.test.ts : +1 net (1a/0r) ex. 'maladies.json': 'disease',
  NON COUVERTES par CLIQUET: src/engine/disease-noeud-test.test.ts +2, src/state/flowtest-derived-stake.test.ts +1
=== 572e60b8b feat(gardes)!: refs #1679 L1b T1
  scripts/guards/lib/lintStage.test.mjs : +8 net (8a/0r)
  NON COUVERTES par CLIQUET: scripts/guards/lib/lintStage.test.mjs +8
=== 429b9a1a2 feat(docs)!: refs #1679 L1b T2
  scripts/docs/lib/enregistreur-lectures.test.mjs : +3 net (3a/0r) ex. 'scripts/docs/build-reprise.mjs': { cibles: [...] }
  NON COUVERTES par CLIQUET: scripts/docs/lib/enregistreur-lectures.test.mjs +3
```

**Sonde 2 — steps CI skippés à HEAD** (à promouvoir en garde de pre-push : « aucun step de gate skippé sur le sha poussé ») :

```
gh run view 33691303703 --json jobs --jq '.jobs[]|select(.name=="build")|.steps[]|[.number,.name,.conclusion]|@tsv'
→ 11 Run npm run deps:unused failure
→ 15 Run npm run typecheck skipped · 16 Run npm run lint skipped · 17 Run npm test skipped
→ 20 Run npm run docs:check skipped · 21 Run node scripts/docs/build-all.mjs --empreinte skipped
```

Fichiers chargés : `scripts/guards/lib/stocksNominatifs.mjs`, `scripts/hooks/stocks-nominatifs.test.mjs`, `scripts/hooks/fermetures-sans-solde.test.mjs`, `scripts/git-hooks/pre-commit.mjs`, `.github/workflows/ci.yml`.
