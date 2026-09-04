# Revue adversariale de PALIER — 10 commits de substance, 0 fermeture, 3 sessions, 2026-09-04

verdict: PARTIEL

Juge en lecture seule (mandat : réfuter), fenêtre `7692b631c..2c11fdd9a`. **Arbre ÉPINGLÉ** : worktree `.wt-1679-L2`, `git rev-parse HEAD` = `2c11fdd9aa019f71cbc670f59c28b9c8e9cccfa2` = `git rev-parse origin/main` après `git fetch`. Tout est lu par `git show <sha>:<chemin>`, jamais par un working tree. **Contrôles POSITIFS** du travail jugé : `scripts/guards/lib/justificatif.mjs`, `scripts/git-hooks/pre-push`, `scripts/gates/toutes.mjs`, `scripts/guards/lib/portePush.mjs` existent à HEAD (`git ls-tree`), `gatesRequises` rend **23 gates** exécutées sur le `ci.yml` de HEAD, et `<git-common-dir>/wfrp-justificatifs/` porte 6 clés + `derogations.log`. Le **CONTENU tient** : les 6 commits vérifiés au hasard sont exacts à l'octet, y compris la correction de poison RAW re-vérifiée au `Source/`. Ce qui cède, une fois de plus, est la PORTE — mais autrement qu'au palier n°2 : la porte au push EXISTE désormais et ferme 2 des 4 classes de la salve de hotfixes ; en revanche **la preuve qu'elle produit est destructible** (un rejeu sur arbre sale écrase un justificatif propre, prouvé par sonde), et **la classe qui a coûté les 4 hotfixes — un dérivé qui diverge entre Windows et Linux — reste entièrement ouverte** (une gate verte sous Windows n'y dit rien).

## Fermetures

- **Par commit sur `main` : ZÉRO.** `git log 7692b631c..2c11fdd9a --format='%H%n%B' | grep -E '(fixes|closes|corrige|ferme)\s+#[0-9]+'` = 0 occurrence. Aucun solde à juger dans la fenêtre — le régime de solde n'est pas mis en défaut, il n'est pas exercé (3ᵉ palier consécutif à 0 fermeture sur main).
- **Sur GitHub, 1 fermeture dans la fenêtre temporelle** : `gh api 'search/issues?q=repo:cgauche/game+is:issue+closed:>=2026-09-03'` = 1 (**#1685**, `closed_at` 2026-09-03T19:29:24Z, soit entre `b7227f7b5` 18:45:10Z et `2c11fdd9a` 19:30:09Z). Timeline : un commentaire de solde publié 1 s avant la fermeture = signature du `post-commit`, pas d'un `gh issue close` manuel. Commit fermeur retrouvé : **`8b52f3a55`** (`feat(engine/state/data)!: refs #1463 #1657 train B3-3, corrige #1685`), présent en local, **absent de `origin/main`** — donc régulier quant au régime (fermeture PAR commit + solde), mais **le ticket est fermé alors que son code et son solde ne sont pas publiés** : `git ls-tree -r 2c11fdd9a .claude/soldes` ne porte pas `1685.md`. Fait à instruire, pas une fuite de `gh issue close` : le rituel ferme au COMMIT, pas à la PUBLICATION.
- **Créations : 0** (`created:>=2026-09-03` = 0). Fan-out tenu.

## Commits vérifiés (6 au hasard, 3 sessions voisines)

| sha | session | annonce vérifiée | preuve à HEAD |
|---|---|---|---|
| `73dc49eb6` | game-c5 #1680 #1509 train A | empreinte dérivée, `SAVE_VERSION` 42, migration datée, **poison RAW corrigé** (`LDB 14 l.103` VIDE → l.72/81/86) | `empreinteDeriveeDuProp` exporté et exercé (`src/data/props-integrity.test.ts:6,380-385`) ; `src/state/saves.ts:86 = 42` ; `scripts/migrations/2026-09-03-1509-foot-volumique-mort.mjs` présent ; `src/state/lineOfSight.ts` porte « LDB 14 l.72/81/86 + extrapolation l.75 ». **Vérifié au Source** (`Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md`) : l.72 = « La cible est sous couverture **imparfaite** (derrière une haie…) », l.81 = « couverture **moyenne** (une barrière en bois…) », l.86 = « couverture **totale** (derrière un mur de pierre…) », l.75 = brouillard/brume/obscurité ; l.103 est **vide** (`sed -n '103p' \| cat -A` → `$`), l.114/120 = prose hors sujet. La réf corrigée est exacte, l'ancienne était fausse. |
| `68b3a0cd2` | game-c5 train B | index unique, deux vues | `src/state/decorIndex.ts:61 decorEnCase`, `:65 decorEnCaseEtage`, `:27,44 propFootTiles` (couture unique) ; `src/state/seating.ts` lit `decorAncre` |
| `529d0405b` | game-c5 train C | murale ré-authorée 1×2 par migration datée, K = 3/1,92 | `scripts/migrations/2026-09-03-1509-murale-1x2.mjs` présent, en-tête portant le **verbatim utilisateur daté** ; `src/data/props.json:2583 "table-murale-2-tabourets"` |
| `d0b44a384` | game-c5 #1680 I-10 | UNE ligne au cleanup, bancs jumeaux, `ardoiseNeuve` extraite | `src/gameIso/stage/GameStage3D.tsx:857 entréeRef.current = false` **dans le `return ()=>` de l'effet** (lu en contexte, pas par regex) ; `src/gameIso/stage/banc-volumique.ts:151,174,198 ardoiseNeuve` ; `ardoise-amont.test.ts`, `ardoise-amont-battement.test.ts`, `entree-en-scene-demontage.test.tsx` existent |
| `f72992bfd` | game-c5 I-10 suite | fake timers sur la SEULE horloge, compte EXACT | `src/gameIso/stage/weather-boucle.test.tsx:56 vi.useFakeTimers({ toFake: ['performance'] })`, `:128 advanceTimersByTime`, `:163-166` prémisse `rafs.length === 1` à chaque battement + `expect(frames.length).toBe(IMAGES)` (3) |
| `2c11fdd9a` | L1b #1679 | enveloppes `fs` dans le thread des hooks, dérivé = 4 lignes | `scripts/docs/lib/enregistreur-hooks.mjs:44-51` (`initialize` enveloppe `readFileSync`/`openSync` mode lecture/`promises.readFile` + `syncBuiltinESMExports`) ; `git diff b7227f7b5 2c11fdd9a -- docs/.sources-lues.json` = **exactement 4 `+ "tsconfig.json"`** (8 ajouts / 4 retraits : les 4 autres ajouts sont les mêmes lignes re-virgulées, diff lu ligne à ligne) |

Aussi vérifié : `94ab32898` → `scripts/docs/build-all.mjs:110-116 tsxEsmDe` par `import.meta.resolve('tsx/esm')` ; `a808a0add` → le correctif porte sur `scripts/docs/lib/empreinte-sources.test.mjs` (8+/4−), **pas** sur `scripts/docs/empreinte-sources.test.mjs` que le message de `2c11fdd9a` nomme (chemin inexistant à HEAD — coquille de prose, sans effet).

## CI

Runs de la fenêtre (`gh run list --workflow=ci.yml --branch main --limit 25`) : **7 runs pour 10 commits de substance, 6 rouges, 1 encore EN COURS au jugement, 0 vert**.

| run | sha | verdict | step rouge | steps SKIPPÉS (hors post-steps) |
|---|---|---|---|---|
| 33712860413 | `529d0405b` | failure | 11 `deps:unused` | **19** (test:recette → server ci) |
| 33717131460 | `94ab32898` | failure | 20 `docs:check` | **11** |
| 33719038837 | `9de7d8400` | failure | 17 `npm test` | **14** |
| 33787269113 | `a808a0add` | failure | 17 `npm test` | **14** |
| 33788542747 | `d0b44a384` | failure | 17 `npm test` | **14** |
| 33791873905 | `f72992bfd` | failure | 20 `docs:check` | **12** |
| 33793989644 | **`b7227f7b5`** | failure | 19 `docs:check` | **0** (seul `Post Run setup-node` skippé) |
| 33845527402 | `2c11fdd9a` = HEAD | **in_progress** au jugement | — | — |

- **La normalisation de `b7227f7b5` MORD, mesurée** : sur son propre run, `docs:check` échoue au step 19 et **les 12 steps suivants jouent quand même** (0 skipped hors post-step) — contre 11 à 19 skippés sur chacun des six runs précédents. `git show 2c11fdd9a:.github/workflows/ci.yml` porte `if: ${{ !cancelled() && steps.install.outcome == 'success' }}` sur chaque gate. **Action (α)/normalisation : TENUE.**
- **Aucun verdict CI vert sur `main` de toute la fenêtre** au moment du jugement, et le run de HEAD a été lancé **11 h après le commit** `2c11fdd9a` (2026-09-03T19:30:09Z → push 2026-09-04T06:42:59Z) — le push a traîné, cf. Dérive.
- **3 commits sans aucun check-run propre** : `73dc49eb6`, `68b3a0cd2`, `ad47ffe74` (`gh api repos/cgauche/game/commits/<sha>/check-runs` → `total_count` 0). Poussés en lot ; seule la tête est jugée. Angle mort identique au palier n°2.

## Stocks nominatifs

Rejeu de `croissancesNonCouvertes` (`scripts/guards/lib/stocksNominatifs.mjs` à HEAD) sur **chacun des 11 commits** de la fenêtre (sonde 1) : **une seule croissance, couverte**.

| sha | fichier | net | statut |
|---|---|---|---|
| `b7227f7b5` | `scripts/guards/lib/justificatif.test.mjs` | +4 (4a/0r) | **COUVERTE** — `CLIQUET:` au message, `+4` = le net réel ; entrées = `'test.json'`, `'typecheck.json'`, `['--dir', 'src/engine']` → **fixtures dans des corps de test**, faux positif connu classé (γ) : nommé, **non compté comme dérive** |

Les 10 autres commits : 0 croissance. **Aucune dérive de stock dans la fenêtre.**

**Hypothèse du message de `b7227f7b5` RÉFUTÉE par la mesure.** Le message écrit : « le garde au commit ne l'a pas refusé : *expiration probable des 10 s sur 54 fichiers*, hypothèse du juge ». Trois faits la contredisent (sonde 2) : (1) `croissancesNonCouvertes({diff, message})` sur ce commit rend **`[]`** : le `CLIQUET:` du message le couvre exactement → **aucun refus n'était dû**, ni timeout ni autre ; (2) le commit fait **22 fichiers**, pas 54 ; (3) le coût est **2 ms** d'évaluation (+ 72 ms de `git show -U0`, 82 897 octets de diff) — trois ordres de grandeur sous les 10 s. L'hypothèse est fausse ; la **conclusion** qu'elle sert (le faux positif de fixtures, à régler par portée de module en T1c) reste fondée. Prose de commit à corriger au ticket, pas à propager.

## Actions routées par la revue n°2 (`.claude/soldes/revue-palier-d0b44a384.md`)

| action | état MESURÉ |
|---|---|
| **(α)** `deps:unused` dans les gates chiffrées | **TENUE, et dépassée** — la liste ne se récite plus : `gatesRequises({fichier: ci.yml@HEAD})` rend 23 gates, dont `deps:unused`. Le rouge de `deps:unused` a été réparé par `94ab32898` (`import.meta.resolve('tsx/esm')`, `build-all.mjs:116`) |
| **(β)** porte de stock sur la PLAGE poussée | **NON FAITE** (prévue T1c) — `scripts/git-hooks/pre-push.mjs` porte 4 refus (origin, justificatifs, non-fast-forward, CI rouge) ; aucun ne lit `croissancesNonCouvertes` |
| **(γ)** les 3 entrées de `enregistreur-lectures.test.mjs` | **NON FAITE** — prémisse réfutée par le juge de design (fixtures de test pur) ; correction au GARDE prévue T1c (portée de module) ; `grep -c 'cibles: \['` = 5 à `7692b631c` et 5 à HEAD |
| **(δ)** canari CLOSED / soldes #1659 #1673 / pre-push | **1/3** — pre-push **POSÉ** (`scripts/git-hooks/pre-push` + `.mjs`) ; canari **non** (`scripts/hooks/fermetures-sans-solde.test.mjs` : 0 appel à `gh api`/`search/issues`) ; soldes **`1659.md` et `1673.md` toujours absents** — **3ᵉ palier consécutif** |
| **(ε)** pilotage v5 de #1679 | **POSÉ** (issuecomment-5521002006, 2026-09-03T05:32Z) **mais déjà PÉRIMÉ** : son arbre de référence est `9de7d8400`, or 5 trains ont suivi (`a808a0add`, `d0b44a384`, `f72992bfd`, `b7227f7b5`, `2c11fdd9a`), dont **L2 T1a posé** — le v5 ne le dit pas. Même défaut qu'au palier n°2, une version plus tard |

## Les 4 hotfixes : la porte les aurait-elle refusés ?

Rejeu de `gatesRequises` + `motifDeRefus` (la logique EXACTE du pre-push) sur le contenu de chaque sha de la fenêtre (sonde 3) : `73dc49eb6 … f72992bfd` REFUS = 23/23 (aucun justificatif : la porte n'existait pas) ; `b7227f7b5` REFUS = 5/23 (`deps:unused`, `typecheck`, `lint`, `test`, `docs:check` en `[sale]` — voir Écart 1) ; `2c11fdd9a` REFUS = 0/23.

| hotfix | cause qu'il corrige | step qui l'aurait attrapée | la porte ferme-t-elle ? |
|---|---|---|---|
| `94ab32898` | `deps:unused` cassé par `429b9a1a2` (hors fenêtre) | `deps:unused` ∈ 23 gates | **OUI** — `429b9a1a2` aurait été refusé au push |
| `a808a0add` | `docs:check` cassé par `9de7d8400` (fixtures prises pour docs mortes) | `docs:check` ∈ 23 gates **et** gouverné par la clé de l'arbre PLEIN (`CLE_DE_GATE`, `justificatif.mjs:63`) | **OUI** |
| `9de7d8400` | rien : il INSTRUMENTE le rouge (le rend parlant) | — | sans objet (poussé sur rouge, dérogation dite) |
| `2c11fdd9a` | dérivé `docs/.sources-lues.json` divergeant **entre Windows et Linux** | aucun : `docs:check` était **VERT en local** sous Windows, rouge sur ubuntu | **NON — classe ENTIÈREMENT OUVERTE** |

Le commit lui-même en tire la règle (« un dérivé cross-OS se vérifie sur le sha AVANT “POSÉ” »), mais **rien dans le dispositif ne l'applique** : un justificatif vert de gate est, par construction, le verdict d'UNE plateforme.

## Dérive

- **Fan-out : 0 créé, 1 fermé** depuis 2026-09-03T00:00Z (#1685, cf. Fermetures). Régime « fan-out ≤ 1 » tenu.
- **Pilotage #1679 périmé de 5 trains** (v5 du 2026-09-03T05:32Z, référence `9de7d8400`).
- **Dérogations journalisées : 2**, lues dans `<git-common-dir>/wfrp-justificatifs/derogations.log` : (1) `2026-09-03T19:01:34Z b7227f7b5` — **raison LÉGITIME et vérifiée** : le rouge de `main` était bien `docs:check` seul (run 33791873905), et ce push est l'INSTRUMENT qui a rendu les 12 steps suivants observables (run 33793989644 : 0 skipped) ; (2) `2026-09-04T06:42:59Z 2c11fdd9a` — **raison LÉGITIME** : un push qui corrige la cause du rouge. **Mais l'horodatage est à 11 h du commit** (19:30:09Z → 06:42:59Z) : le correctif du rouge de `main` a dormi une nuit sur un `main` rouge (machine en veille — les gates ont été tuées par une tranche de 10 min puis rejouées au réveil). Le régime « pas de push sur CI rouge » a pour corollaire « on reverdit vite » ; ce n'est pas le pre-push qui peut le tenir.
- **Compteur de palier faux, cause mesurée** : `<git-common-dir>/wfrp-palier.compteur` = **16**, alors que `git log --oneline f72992bfd..2c11fdd9a -- src scripts` = **2** depuis la consommation de la revue n°2 par `f72992bfd`. Le compteur vit dans le répertoire git COMMUN et est incrémenté par le `post-commit` de **tous les worktrees** (`ls .git/worktrees` = 20 entrées) : il agrège des commits qui ne sont jamais sur `main`. La MESURE sur `main` fait foi.

## Écarts (fichier:ligne + sha)

1. **`scripts/guards/lib/justificatif.mjs:129-157` (`ecrireJustificatif`) — un justificatif VERT-PROPRE est écrasé par un rejeu de la MÊME gate sur un arbre SALE.** Prouvé par sonde 4 sur dépôt jetable. Effet mesuré dans le dépôt réel : sous la clé de `b7227f7b5`, cinq gates portent `"sale": true` avec des dates **postérieures au push** (`deps:unused` 19:15:01Z … `docs:check` 19:27:32Z, contre une dérogation de push à **19:01:34Z**). Conséquences : (a) la preuve qu'un push a été régulier est **destructible par le travail qui suit**, donc inauditable par un juge de palier ; (b) un push régulier et un push contourné deviennent **indistinguables a posteriori** ; (c) `npm run gates` rejouera ces 5 gates pour rien. Correction : ne jamais DÉGRADER un verdict (n'écraser un `sale:false` que par un `sale:false` de date ≥), journaliser les observations en append.
2. **`scripts/git-hooks/pre-push.mjs` (les 4 refus) — aucune classe ne couvre un dérivé qui diverge entre OS.** `2c11fdd9a` = 23/23 gates vertes propres pour un défaut qui n'existe que sous Linux. La règle est écrite dans son message de commit, nulle part dans le code.
3. **`b7227f7b5`, corps du message (`CLIQUET:` … « expiration probable des 10 s sur 54 fichiers »)** — hypothèse FAUSSE (22 fichiers, 2 ms, `CLIQUET` couvrant `+4`). Une prose de commit qui invente un mécanisme est du poison de diagnostic : elle fonde un geste (T1c « timeout 30 s ») sur une cause imaginaire alors que la vraie (fixtures de test comptées comme entrées de registre) est nommée dans le même paragraphe.
4. **`scripts/git-hooks/post-commit:100` (`mv -f "$REVUE_PALIER_FILE" ".claude/soldes/revue-palier-$HASH.md"`) — le nom d'archive est le sha du commit CONSOMMATEUR**, instable entre sessions et rebases : la **même** revue n°2 existe sous deux noms dans l'histoire (`revue-palier-9de7d8400.md`, ajoutée par `26917f2cb`, version pré-rebase aujourd'hui orpheline ; `revue-palier-d0b44a384.md`, gardée). Correction : nommer par la DATE et la BASE de fenêtre jugée (`revue-palier-2026-09-04-7692b631c.md`), toutes deux connues à l'écriture et stables au rebase.
5. **`73dc49eb6`, `68b3a0cd2`, `ad47ffe74` — 0 check-run** : trois commits de substance jamais jugés par la CI (poussés en lot).
6. **`.git/wfrp-justificatifs/4ef089f5d0f8e2b5b05a6ead0a1887144fed5256.json`** — fichier monolithique du format abandonné, **jamais relu** par `lireJustificatif`. Résidu mort dans un répertoire d'état partagé.
7. **`529d0405b`** — recette annoncée « captures avant/après `public/qc/1509-murale/` » : `.gitignore` ignore `public/qc/*`, le dossier n'existe ni dans le worktree ni sur l'arbre principal. L'annonce est **invérifiable a posteriori**.
8. **`2c11fdd9a`, corps du message** — cite `empreinte-sources.test.mjs` là où le fichier réel est `scripts/docs/lib/empreinte-sources.test.mjs`. Chemin inexistant à HEAD.
9. **`scripts/hooks/fermetures-sans-solde.test.mjs`** — toujours aveugle aux fermetures hors commit ; #1659 (« Plages en TUPLE [min,max] : 99 occurrences (72 avail saisonnières de  ») et #1673 (« Programme #1463 : FUSIONNER les .json de systèmes similaires en une c ») restent sans solde versionné, **3ᵉ palier**.
10. **Le rituel de fermeture ferme au COMMIT, pas à la PUBLICATION** (#1685 fermé par `8b52f3a55`, local, absent de `main`) : un commit jamais poussé, ou rebasé au loin, laisse un ticket fermé sans code sur `main`.

**Actions routées** : **(ζ)** `ecrireJustificatif` ne dégrade jamais un verdict propre (écart 1) — sonde 4 promue en test, PRIORITAIRE (L2 T1c) ; **(η)** une gate dont le dérivé dépend de l'OS ne se justifie pas sur une seule plateforme (écart 2) — le pre-push exige que le **dernier run CI vert** porte sur un ancêtre du contenu poussé pour les gates de `CLE_DE_GATE`, ou un job CI « dérivés » joué en amont (L3 D1) ; **(θ)** nom d'archive de revue = date + base de fenêtre (écart 4) (L2 T2, `post-commit`) ; **(ι)** T1c absorbe (β)+(γ) — la porte de stock lit la PLAGE au pre-push et les fixtures cessent d'être comptées (portée de module) ; **(κ)** pilotage #1679 v6 avec l'état RÉEL de L2, et retrait de l'hypothèse fausse du message de `b7227f7b5` du raisonnement de T1c ; **(λ)** résidu `4ef089f5….json` retiré, `derogations.log` conservé ; **(μ)** la fermeture d'un ticket suit la PUBLICATION du commit qui le solde (écart 10 — L2 T2 : fermeture jouée depuis `main`, jamais au post-commit local). Restent dues du palier n°2 : canari CLOSED par l'API, soldes #1659/#1673 (L2 T2).

## Sondes (code + sortie, à promouvoir en test committé)

**Sonde 1 — croissance de stock non couverte, par commit de la fenêtre** : rejeu de `croissanceDesStocks` + `croissancesNonCouvertes` sur `git show <sha> -U0` + message, pour chaque sha de `git log 7692b631c..2c11fdd9a` ; sortie : `b7227f7b5 scripts/guards/lib/justificatif.test.mjs : +4 net (4a/0r) — NON COUVERTES : (aucune) — CLIQUET au message : oui` ; 10 autres commits : 0 croissance.

**Sonde 2 — coût du garde de stock sur le plus gros commit** (`b7227f7b5`) : `fichiers : 22 | octets de diff -U0 : 82897 | git show ms : 72 | evaluate ms : 2 | CLIQUET lus : justificatif.test.mjs +4 | non couvertes : []`.

**Sonde 3 — gates exigées et justificatif par sha** : `gatesRequises` (23) + `motifDeRefus` sur chaque sha de la fenêtre : `73dc49eb6 … f72992bfd` REFUS 23/23 ; `b7227f7b5` REFUS 5/23 (`[sale]` ×5) ; `2c11fdd9a` REFUS 0/23.

**Sonde 4 — un justificatif propre écrasé par un rejeu sale** (dépôt jetable) : gate sur arbre propre → `sale = false` ; `b.txt` non suivi ajouté ; rejeu de la même gate → `sale = true, salis ["?? b.txt"]`. **VERDICT : la preuve du push régulier est perdue.**

Fichiers chargés : `scripts/guards/lib/justificatif.mjs`, `scripts/guards/lib/stocksNominatifs.mjs`, `scripts/git-hooks/pre-push.mjs`, `scripts/git-hooks/post-commit`, `scripts/hooks/solde-ticket-guard.mjs`, `.github/workflows/ci.yml`, `Source/Warhammer v4 - Livre de base version corrigée/14 - _GoBack.md`.
