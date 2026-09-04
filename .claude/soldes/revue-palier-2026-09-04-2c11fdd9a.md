# Revue adversariale de PALIER — 17 commits de substance, 2 fermeture(s), 3 sessions, 2026-09-04

verdict: PARTIEL — la porte progresse réellement et se laisse mesurer (ζ corrigé et prouvé par sonde, porte de stock sur la plage POSÉE et MORDANTE, HEAD vert 40/40 sur les deux OS, les deux soldes tiennent mot à mot), mais la classe qui coûte les hotfixes depuis trois paliers — un dérivé/verdict qui diverge entre Windows et Linux — a MORDU une fois de plus sur le commit propre de la session (`a9b7edf17`), θ et μ se sont MATÉRIALISÉS (l'archive de la revue n°3 et la fermeture de #1613 nomment un sha orphelin), et 13 des 17 commits de substance n'ont jamais été jugés par la CI.

Fenêtre : 2c11fdd9a..f0f9436f5

**Arbre ÉPINGLÉ** : worktree `.wt-1679-L1b`, `git rev-parse HEAD` = `f0f9436f567d77f83f8afb51961d592df1e3c2ff`, `git status --porcelain` VIDE. Contrôles POSITIFS du travail jugé : `scripts/guards/lib/plageStock.mjs` existe et exporte `croissancesDeLaPlage` ; `scripts/git-hooks/pre-push.mjs:49,210-212` l'IMPORTE et l'appelle ; `ecrireJustificatif` porte son volet anti-dégradation (`justificatif.mjs:180-186`) ; `.claude/soldes/1613.md` et `1685.md` sont suivis par git. 17 commits de substance (`git log --oneline 2c11fdd9a..f0f9436f5 -- src scripts` = 17), 27 au total.

## Ce qui a TENU sous attaque (réfutations tentées, échouées — à ne pas rouvrir)

**A. ζ est CORRIGÉ, mesuré.** La sonde 4 de la revue n°3 rejouée sur dépôt jetable : arbre propre → `sale=false` ; rejeu de la MÊME gate sur arbre sale → verdict retenu `sale=false`, le salissement JOURNALISÉ en `observations[0].salis = ["?? b.txt"]`, et la relecture disque rend `sale=false`. La preuve d'un push régulier n'est plus destructible.

**B. β/ι POSÉE et MORDANTE.** `croissancesDeLaPlage({avant:'2c11fdd9a', apres:'f0f9436f5'})` rend exactement 1 refus — et c'est le vrai (trouvaille 4). Câblage réel : `scripts/git-hooks/pre-push.mjs:210-212`.

**C. λ soldé.** Plus aucun `.json` monolithique à la racine de `.git/wfrp-justificatifs/` (`ls *.json` → « No such file »). Le résidu `4ef089f5…` est aujourd'hui un DOSSIER au format vivant (4 gates).

**D. Le retrait de la gate `test:map` (23→22) est LÉGITIME et VERROUILLÉ.** J'ai cherché la dérive silencieuse : elle est fermée. `vite.config.ts:69` inclut `'scripts/map/**/*.test.ts'`, `scripts/map/check.test.ts` est le seul fichier concerné, et `src/vi-mock-isolate-guard.test.ts:75-79` verrouille le miroir DANS LES DEUX SENS (containment + cardinalité). `scripts/gates/toutes.mjs:152` a suivi (`lit: [… 'scripts/map/', 'vite.config.ts']`). Rien à corriger.

**E. Le hotfix `0acda4517` tient comme du code.** L'invariant qui compte n'est pas « feuilles d'abord » mais « enfant tué avant son parent » : sonde sur arbre `100→200→300→400` + feuille peu profonde `500` → ordre `400,300,200,500`, aucune violation, pid hors-arbre `900` non touché, cycles (auto-parent, mutuel) terminent. Seams injectés, 4 tests.

**F. Les deux soldes tiennent MOT À MOT.** #1613 : DoD 3/3 re-vérifié à l'arbre `f0f9436f5` — `pre-push.mjs` P1.4 présent, `package.json:15` exact, `.claude/skills/orchestrer-des-agents/SKILL.md:150-153` au présent, et les 4 `fichier:ligne` des Restes (`replay.mjs:167`, `replay-head.mjs:103`/`:121`, `empreinteRejeu.mjs:54`) pointent tous juste. 0 reste routé. #1685 : sa claim centrale « `critResistValue`, `resolveAmputation`, `restResistVal`, `calmeVal` = 0 occurrence dans `src/` » résiste — l'unique occurrence est une CHAÎNE de fixture plantée dans un garde (`src/engine/flow-test-engine-roll-guard.test.ts:118`), donc un contrôle positif, pas un survivant ; le reste déclaré existe bien (`src/engine/psychology.ts:391 calmeValue`), routé #1437. 1 reste routé. Les deux portent `## Réfutation` + verdict.

**G. Fan-out tenu, aucune fermeture hors commit.** `created:>=2026-09-03` = **0**. `closed:>=2026-09-03` = **2** (#1685, #1613), toutes deux fermées PAR commit et pourvues d'un solde versionné. La fuite `gh issue close` du palier n°2 ne s'est pas reproduite.

**H. Aucun push sur rouge sans dérogation.** 3 pushes sur `main` rouge, 3 dérogations, chacune vérifiée EXACTE contre le run qu'elle invoque : `c3692d0f9` (rouge = `npm test` sur run 33849367672, banc météo d'une autre session), `0acda4517` (rouge = `test:hooks` + `npm test` sur run 33866600011 — les deux nommés), `f3d23dfed` (corrige le banc météo). Les pushes sur vert (`49654eb3f`, `da3acf95c`, `a9b7edf17`, `91415d6fb…f0f9436f5`) n'en portent pas, à raison.

## Trouvailles

**1. η a MORDU une seconde fois, sur le commit propre de la session — `a9b7edf17`, run CI 33866600011.** Le T1d a été poussé sur un `main` VERT, avec ses gates vertes en local, sans dérogation (donc régulier) — et il rougit sur ubuntu : `not ok 26 - un enfant qui dépasse son plafond est EXPIRÉ, et son ARBRE tombe avec lui`, `ERR_ASSERTION`, `expected: 7 / actual: 13`, `# pass 601 / # fail 1`. Cause (dite par le hotfix suivant) : `process.kill(-pid)` ne frappe que le groupe du fils, or `detached:true` donne au descendant son propre groupe ; sous Windows `taskkill /T` suit la FILIATION, d'où le vert local. Ce n'est plus un dérivé de doc comme à `2c11fdd9a` : c'est un **verdict de gate** qui dépend de l'OS. La règle est écrite dans les messages de commit et dans `scripts/gates/toutes.mjs:390+`, **nulle part dans le dispositif** : `scripts/git-hooks/pre-push.mjs` ne porte toujours aucun refus de cette classe, et un justificatif vert reste par construction le verdict d'UNE plateforme. **Attendu** : (η) reste PRIORITAIRE et se durcit — le pre-push exige que le dernier run CI vert porte sur un ancêtre du contenu poussé pour les gates sensibles à l'OS, ou un job CI amont ; le mandat L3 D1 ne suffit plus à le porter, il a coûté 2 hotfixes en 2 paliers.

**2. θ et μ se sont MATÉRIALISÉS : l'archive de la revue n°3 et la fermeture de #1613 nomment un sha ORPHELIN.** `.claude/soldes/revue-palier-82e95be10.md` — or `git merge-base --is-ancestor 82e95be10 f0f9436f5` = **PAS ANCÊTRE**. `82e95be10` est la version PRÉ-REBASE de `112c814b6` (même message, « corrige #1613 »). Conséquences mesurées : (a) l'archive de revue porte le nom d'un commit introuvable sur `main` ; (b) **#1613 a été fermé à 07:09:26Z par ce sha orphelin**, alors que le commit qui vit sur `main` est `112c814b6` — le ticket est donc fermé par un commit que l'histoire publiée ne contient pas. C'est exactement la paire θ (nom d'archive instable au rebase) + μ (fermer au COMMIT et non à la PUBLICATION) que la revue n°3 avait routées. `scripts/git-hooks/post-commit:100` porte toujours `mv -f "$REVUE_PALIER_FILE" ".claude/soldes/revue-palier-$HASH.md"`. **État dit tel quel** : θ et μ sont **CODÉS et sous juge de diff en L2 T2, NON POUSSÉS** (pilotage v7, ligne 19). **Attendu** : T2 pousse, et l'archive du présent palier est nommée par date + base de fenêtre, pas par le sha du consommateur. Note : `c24147d64` documente honnêtement le défaut dans son propre message — le renommage n'est pas dissimulé.

**3. 13 des 17 commits de substance (76 %) n'ont AUCUN check-run — 3ᵉ palier consécutif, et le pire en absolu.** Mesuré par `gh api repos/cgauche/game/commits/<sha>/check-runs --jq .total_count` sur les 17 : `check-runs=0` pour `c8d3105ae`, `571f54287`, `02cc09c04`, `483172f13`, `44f16fd39`, `8b52f3a55`, `eb1b00ee3`, `112c814b6`, `57a9a2096`, `0ec6cbe40`, `0ce333203`, `7a3595755`, `91415d6fb`. Seuls `da3acf95c`, `a9b7edf17`, `0acda4517`, `f3d23dfed` en ont 2. Parmi les non jugés : **`91415d6fb`**, le plus gros train de la fenêtre (breaking change `crewTarget` en union requise, mort de `'deck'`, catalogue `ship-stations.json`, 6 rangées MDG 13), poussé en lot et jamais soumis seul à la CI. **Attendu** : soit le push par lot cesse pour les trains cassants, soit le verdict de palier renonce explicitement à juger par commit — mais le dispositif ne peut pas prétendre que « chaque commit passe les gates » alors que 76 % ne sont jugés que collectivement par leur tête.

**4. Une croissance de stock nominatif NON DÉCLARÉE dans la fenêtre — `c8d3105ae`, `src/state/flowtest-derived-stake.test.ts` +2 net.** Entrées ajoutées : `'river-criticals.json':`, `'ship-criticals.json':` — dans le registre **`AUTO_RESOLUS`**, celui que la doctrine nomme « registre interdit » (fiche `feedback-purete-moteur-ne-justifie-jamais-un-jet-hors-canal`). `declare: null` : **aucun `CLIQUET:` au message** (`git log -1 --format=%B c8d3105ae | grep -ci CLIQUET` = 0). Circonstance atténuante MESURÉE, et elle est réelle : `AUTO_RESOLUS` a été **SUPPRIMÉ deux commits plus loin dans la même fenêtre** (`44f16fd39`, `git log -S'AUTO_RESOLUS'`), les deux clés survivant sous forme saine (`flowtest-derived-stake.test.ts:84-85`, enjeu au producteur). La croissance était donc transitoire. Elle a échappé au garde parce que `c8d3105ae` précède la pose de T1c ; la porte de plage l'attrape désormais (preuve B). Les 2 autres croissances de la fenêtre sont DÉCLARÉES et exactes : `a9b7edf17` +53 et `f3d23dfed` +1 sur `scripts/gates/ecrivainsAtteints.test.mjs`, toutes deux couvertes (`NON-COUVERTES=[]`). **Attendu** : rien à corriger sur l'arbre (le registre est mort) ; à retenir comme le cas fondateur qui justifie la porte de plage — et à ne pas relire comme « 0 croissance ».

**5. Piège de mesure à consigner : `croissanceDesStocks` a une signature POSITIONNELLE, et l'appeler en objet rend un « 0 » silencieux.** `croissanceDesStocks(diffU0, {lirePostImage, lirePreImage})` (`scripts/guards/lib/stocksNominatifs.mjs:157`) — mon premier passage l'a appelée `croissanceDesStocks({diff})`, ce qui stringifie l'objet en `[object Object]` et rend `[]` sur **les 27 commits**, y compris sur des croissances réelles. Un juge pressé aurait publié « 0 croissance de stock dans la fenêtre », faux. Ce n'est pas un défaut du dépôt mais un **piège d'instrument** : la lib ne peut pas distinguer un diff vide d'un appel mal formé. **Attendu** : un `if (typeof diffU0 !== 'string') throw` en tête de `croissanceDesStocks` — fail-loud, deux lignes, et la classe entière de faux zéros meurt. (Sonde promue ci-dessous : elle contient le témoin positif qui l'a révélée.)

**6. Le détecteur de fermetures sans solde reste AVEUGLE aux fermetures hors commit — 4ᵉ palier, et `#1659`/`#1673` toujours sans solde.** `scripts/hooks/fermetures-sans-solde.test.mjs` : `grep -c 'gh api\|search/issues'` = **0** ; il ne lit que `git log`. Son stock nominatif est **INCHANGÉ** dans la fenêtre (`git diff --stat 2c11fdd9a f0f9436f5 --` sur ce fichier = vide) : un stock qui « ne peut que DÉCROÎTRE » n'a pas décru en 17 commits. `git ls-tree -r f0f9436f5 .claude/soldes | grep -E '16(59|73)'` = **ABSENTS**. Atténuation mesurée : le trou n'a pas mordu cette fenêtre (les 2 fermetures sont passées par un commit, trouvaille G). **Attendu** : le canari par l'API (`.github/workflows/canari.yml` existe et tourne, mais ne joue que `test:hooks`, donc le même détecteur aveugle) ; soldes #1659/#1673 ou réouverture. Absorbé en L2 T2, non poussé.

**7. L'arbre PRINCIPAL est à l'abandon : 38 commits de retard, 21 fichiers modifiés non commités, et des débris d'agent.** `C:\Users\gauch\PhpstormProjects\Foundry\Game` est sur `7692b631c` — soit la BASE de la fenêtre de la revue n°3 — alors que `main` est à `f0f9436f5` : `git rev-list --count 7692b631c..f0f9436f5` = **38**. Le régime dit « arbre principal = `git pull --ff-only` » (pilotage v7 § Régime) ; il n'a pas été pullé depuis deux paliers. Il porte 21 modifications non commitées dont **15 docs dérivés** (`docs/index-moteur.md`, `docs/structures-donnees.md`, `docs/vocabulaire-mecanique.md`…) régénérés par un hook sur un arbre périmé — donc du dérivé calculé contre un tronc vieux de 38 commits, qui écraserait le bon s'il était commité. Débris non suivis : `.tmp-tsc-truth.mjs`, `TODO-vague-1388.md`, `TODO-vague-1624.md`, et un fichier littéralement nommé **`nul`** (189 o) dont le contenu est une erreur de shell d'agent : `/usr/bin/bash: line 1: type: …\npm-ci-L1c.log: not found` — une redirection `> nul` (graphie cmd.exe) jouée sous bash, qui crée un FICHIER au lieu d'écrire dans le vide. **Attendu** : `git pull --ff-only` sur l'arbre principal et purge des dérivés périmés AVANT tout commit depuis lui ; `nul` supprimé. Je n'y ai rien touché (lecture seule, et l'arbre porte peut-être le WIP d'une session vivante).

**8. Le compteur de palier est toujours faux, même cause, aggravée — 32 contre 9.** `.git/wfrp-palier.compteur` = **32**, alors que `git log --oneline c24147d64..f0f9436f5 -- src scripts` = **9** commits de substance depuis que la revue n°3 a été consommée. Le compteur vit dans le répertoire git COMMUN et est incrémenté par le `post-commit` des **20 worktrees** (`git worktree list | wc -l` = 20), dont ceux qui ne rejoignent jamais `main`. Il était à 16 au palier n°3, il a doublé. **Attendu** : le déclencheur de palier se MESURE sur `main` (`git log <base>..main -- src scripts`) ou le compteur devient par-worktree ; en l'état le seuil « 10 commits de substance » se déclenche sur du bruit — le présent palier a été convoqué à 32 pour 9 réels.

**9. Une dérogation est journalisée DEUX FOIS pour le même push — `c3692d0f9`, 07:49:58.117Z puis 07:54:50.560Z.** Texte identique à l'octet. Le run CI de ce sha est unique (33850916713, 07:54:54Z), donc il n'y a eu qu'un push abouti : le log enregistre des **TENTATIVES**, pas des pushes. Conséquence pour un juge : le cardinal des dérogations (6 entrées) ne compte pas les dérogations réellement consommées (5 pushes, 3 dans la fenêtre). **Attendu** : le log dit ce qu'il enregistre (une tentative), ou n'écrit qu'après un push abouti — sans quoi tout comptage de dérogations est faux d'un facteur inconnu.

**10. `κ` fait, mais le pilotage v7 est déjà périmé de 7 commits — dont un qui le référence.** Progrès réel à créditer : v7 (issuecomment-5539586217, `updated_at` 2026-09-04T11:55:57Z) nomme HONNÊTEMENT ses rouges (« CI de `a9b7edf17` = 33866600011 ROUGE sur `test:hooks` »), ce que v5 ne faisait pas. Mais son arbre de référence est `0acda4517`, et 7 commits ont suivi — dont **`f3d23dfed`, qui porte `refs #1680 #1679`** (`grep -c f3d23dfed` sur le corps du commentaire = **0**). Troisième palier consécutif où le pilotage retarde sur l'arbre. **Attendu** : v8 avant L3, référence = `f0f9436f5`.

**11. Poison : RIEN dans `src`/`scripts` sur les 17 commits.** Scan des lignes de commentaire AJOUTÉES (`git diff 2c11fdd9a f0f9436f5 -- src scripts | grep '^+'` filtré sur les familles b/c) → 13 correspondances, **13 faux positifs** relus un par un (usages techniques légitimes de « plus tard », « temporaire » : `index temporaire GIT_INDEX_FILE`, « la promesse se résoudra plus tard », « un verdict de course sept minutes plus tard »). Aucune excuse sans `[entériné]`, aucune pierre tombale, aucune paraphrase RAW. Le seul cas discutable est **hors périmètre du garde** (`.github/workflows/ci.yml:57-60`) : le commentaire qui remplace la gate `test:map` retirée porte, après sa justification vivante, un rappel de l'ancien état (« Le step les rejouait à l'identique — 37,4 s de CI et de gates pour un second verdict sur les mêmes 18 tests »). Je le signale sans le compter comme défaut : sa première phrase est une justification d'ABSENCE (utile, elle empêche la ré-addition), et le verrou réel est ailleurs et il tient (preuve D). Reformulable au présent en un geste.

## Sorties brutes

| # | commande | exit | résultat retenu |
|---|---|---|---|
| 1 | `git rev-parse HEAD` ; `git status --porcelain` | 0 | `f0f9436f567d77f83f8afb51961d592df1e3c2ff` ; **vide** (arbre épinglé propre) |
| 2 | `git log --oneline 2c11fdd9a..f0f9436f5 -- src scripts \| wc -l` | 0 | `17` (27 au total) |
| 3 | `git log --format='%H%n%B' 2c11fdd9a..f0f9436f5 \| grep -oE '(fixes\|closes\|corrige\|ferme)\s+#[0-9]+'` | 0 | `corrige #1613` ×1, `corrige #1685` ×2 |
| 4 | `git diff --name-status 2c11fdd9a f0f9436f5 -- .claude/soldes` | 0 | `A 1613.md`, `A 1685.md`, `A revue-palier-82e95be10.md` |
| 5 | `git merge-base --is-ancestor 82e95be10 f0f9436f5` | 1 | **PAS ANCÊTRE** (sha orphelin pré-rebase de `112c814b6`) |
| 6 | `node sonde-zeta.mjs` | 0 | `1) PROPRE sale=false` → `2) rejeu SALE sale retenu=false, observations=1, salis=["?? b.txt"]` → `3) RELU sale=false` — **ζ corrigé** |
| 7 | `node sonde-stocks2.mjs` | 0 | témoins positifs mordent ; fenêtre : `c8d3105ae +2 NON-COUVERTE`, `a9b7edf17 +53 couverte`, `f3d23dfed +1 couverte` → **1 non couverte** |
| 8 | `node sonde-plage.mjs` | 1 (TypeError sur mon appel à `refusDeLaPlage`, après impression) | `croissancesDeLaPlage(2c11fdd9a..f0f9436f5)` → `refus:[{sha:c8d3105ae…, net:2, declare:null}]`, `commits:27` — **la porte de plage MORD** |
| 9 | `node sonde-couverture.mjs` | 0 | 287 fichiers touchés, **108 reconnus porteurs de stock** ; `MOTIF_MIN=20` |
| 10 | `node sonde-kill.mjs` | 0 | ordre `400,300,200,500` ; `900` non touché ; cycles terminent — **invariant enfant-avant-parent TENU** |
| 11 | `gh api 'search/issues?q=…closed:>=2026-09-03'` / `created:>=2026-09-03` | 0 | **2 fermés** (#1685 19:29:24Z, #1613 07:09:26Z) / **0 créés** |
| 12 | `gh api repos/cgauche/game/actions/runs?branch=main` | 0 | fenêtre : 8 runs, **5 verts / 3 rouges** ; HEAD `f0f9436f5` = **success** |
| 13 | `gh api …/runs/33873216900/jobs --jq '.jobs[].steps[]'` | 0 | **40/40 steps success**, dont `docs:check`, `docs:empreinte`, `npm test`, `test:hooks`, `deps:unused` |
| 14 | `gh run view 33866600011 --log-failed` | 0 | `not ok 26 …ARBRE tombe avec lui`, `ERR_ASSERTION expected:7 actual:13`, `# pass 601 # fail 1` |
| 15 | steps des 3 runs rouges (33849367672 / 33866600011 / 33868991013) | 0 | **0 step skippé** hors `Post Run setup-node` — normalisation (α) toujours TENUE |
| 16 | `gh api repos/cgauche/game/commits/<sha>/check-runs` ×17 | 0 | **13 à `check-runs=0`**, 4 à 2 |
| 17 | `cat .git/wfrp-justificatifs/derogations.log` | 0 | 6 entrées, 3 dans la fenêtre, `c3692d0f9` **dupliquée** (07:49:58 / 07:54:50) |
| 18 | `ls .git/wfrp-justificatifs/*.json` | 2 | « No such file » — **λ soldé** |
| 19 | `git -C <arbre principal> rev-list --count 7692b631c..f0f9436f5` ; `status --porcelain` | 0 | **38** de retard ; 21 modifiés (15 `docs/`) ; débris `nul`, `.tmp-tsc-truth.mjs`, 2 `TODO-vague-*.md` |
| 20 | `cat .git/wfrp-palier.compteur` ; `git log --oneline c24147d64..f0f9436f5 -- src scripts \| wc -l` | 0 | **32** contre **9** réels ; `git worktree list \| wc -l` = 20 |
| 21 | `git grep -n -w -E 'critResistValue\|resolveAmputation\|restResistVal\|calmeVal\|AUTO_RESOLUS' f0f9436f5 -- src` | 0 | 1 seule occurrence, **chaîne de fixture** `flow-test-engine-roll-guard.test.ts:118` |
| 22 | `git grep -c 'gh api\|search/issues' f0f9436f5:scripts/hooks/fermetures-sans-solde.test.mjs` | 0 | **0** — détecteur aveugle aux fermetures hors commit |
| 23 | poison : `git diff 2c11fdd9a f0f9436f5 -- src scripts \| grep '^+' \| grep -iE '<familles b/c>'` | 0 | 13 lignes, **13 faux positifs** relus |

### Sondes à promouvoir en test committé

**`sonde-zeta.mjs`** (verdict jamais dégradé — verrouille ζ, aujourd'hui non gardé par un test de bout en bout) :

```js
const { ecrireJustificatif, lireJustificatif, cleTree } = await import(ARBRE + '/scripts/guards/lib/justificatif.mjs')
// dépôt jetable, 1 commit
const r1 = ecrireJustificatif({ cwd: d, gate: 'test', sha, statut: 'vert' })   // sale = false
writeFileSync(join(d, 'b.txt'), 'b\n')                                        // arbre SALE
const r2 = ecrireJustificatif({ cwd: d, gate: 'test', sha, statut: 'vert' })
assert.equal(r2.retenu.sale, false)                                           // verdict NON dégradé
assert.deepEqual(r2.retenu.observations[0].salis, ['?? b.txt'])               // salissement JOURNALISÉ
assert.equal(lireJustificatif({ cwd: d, cleTree: cleTree(sha, { cwd: d }), gate: 'test' }).sale, false)
```

**`sonde-stocks2.mjs`** (signature positionnelle + témoins positifs — verrouille la trouvaille 5) :

```js
// APPEL CORRECT : diff POSITIONNEL, images réelles. En objet -> String({}) = '[object Object]' -> [] muet.
const images = { lirePostImage: image(sha), lirePreImage: image(`${sha}^`) }
const cr = croissanceDesStocks(diff, images)
// TÉMOINS POSITIFS obligatoires : sans eux, un « 0 » ne prouve rien.
assert.ok(croissanceDesStocks(diffDe('429b9a1a2'), imagesDe('429b9a1a2')).length > 0)
assert.throws(() => croissanceDesStocks({ diff }, images))   // <- fail-loud RÉCLAMÉ, échoue aujourd'hui
```

**`sonde-kill.mjs`** (invariant enfant-avant-parent de `descendantsDe`, plus fort que « feuilles d'abord ») :

```js
const ps = ['  200   100', '  300   200', '  400   300', '  500   100', '  900   999'].join('\n')
const ordre = descendantsDe(100, ps)
for (const [enfant, parent] of Object.entries({ 200: 100, 300: 200, 400: 300, 500: 100 }))
  assert.ok(ordre.indexOf(+enfant) < ordre.indexOf(+parent) || ordre.indexOf(+parent) === -1)
assert.ok(!ordre.includes(900))                                     // aucun pid hors arbre
assert.deepEqual(descendantsDe(1, '  2   1\n  1   2'), [2])         // cycle mutuel termine
```

Fichiers chargés : `scripts/guards/lib/justificatif.mjs`, `scripts/guards/lib/stocksNominatifs.mjs`, `scripts/guards/lib/plageStock.mjs`, `scripts/gates/toutes.mjs`, `scripts/git-hooks/pre-push.mjs`, `scripts/git-hooks/post-commit`, `scripts/hooks/fermetures-sans-solde.test.mjs`, `src/vi-mock-isolate-guard.test.ts`, `vite.config.ts`, `.github/workflows/ci.yml`, `.github/workflows/canari.yml`, `.claude/soldes/1613.md`, `.claude/soldes/1685.md`, `.claude/soldes/revue-palier-82e95be10.md`.
