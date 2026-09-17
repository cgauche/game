# Revue de palier — fenêtre 0dc3cba27..cd9bb3299 — 2026-09-18

verdict: PARTIEL

Fenêtre `0dc3cba27..cd9bb3299` (17 commits, 9 de substance, 7 fermetures) jugée en lecture seule par un juge unique (Opus, 2026-09-18) depuis l'arbre épinglé `C:/Users/gauch/PhpstormProjects/Foundry/Game/.wt-1788` — `git rev-parse HEAD` → `c34e39b546eb83dc27811b7bd236c8ae551775f3`, UN commit local au-dessus de la tête jugée (`c34e39b54`, #1788, HORS fenêtre) : la fenêtre a donc été lue par `git show <sha>:<chemin>` et `git log 0dc3cba27..cd9bb3299`, jamais par le disque, et CHAQUE sonde jouée sur le disque a été précédée d'un contrôle d'identité `git diff --stat cd9bb3299 c34e39b54 -- <chemins>` rendu VIDE. Tête PUBLIÉE contrôlée : `git branch -r --contains cd9bb3299` → `origin/HEAD -> origin/main`, `origin/chantier/1695`, `origin/chantier/1716`, `origin/chantier/1778`, `origin/main`. **Les sept fermetures TIENNENT** : solde dans le commit qui ferme pour les sept (`--stat` collé), au plus UN reste `-> #N` par solde, les quatre cibles de routage OPEN et ouvertes AVANT la fermeture qu'elles absorbent (#1786, #1783, #1782, #1781), `verdict:` nommé dans les sept soldes (CONFIRMÉ ×2, PARTIEL ×5) avec attaques écartées PAR MESURE, et les sept fermetures POSÉES par `github-actions[bot]` (timelines collées), jamais à la main. **Le grief 1 des quatre paliers précédents — « chiffre non pris sur les objets » — est RÉSORBÉ dans cette fenêtre, et c'est le fait dominant** : les onze annonces chiffrées rejouables ont toutes été rejouées et TOUTES rendent le chiffre annoncé, à l'unité, y compris les deux que le rebase rendait non mesurables telles quelles et qui se bouclent par arithmétique sur les objets (`test:ops` 250 = 258 − 8 cas ajoutés depuis par `4cd5d4052` ; `test:hooks` 994 = 997 − 3 cas de `codeSeul.test.mjs`, hors fenêtre). Le `CLIQUET:` unique du palier nomme le VRAI porteur de stock avec le bon delta (grief 4 précédent résorbé). Ce qui NE tient pas : l'instrument de palier est ROUGE à la tête et personne ne l'a vu — `fermetures-non-citees` refuse #1785, fermée par le bot le 2026-09-17, sans solde et sans commit fermant, parce que le lot qui a GÉNÉRALISÉ le signaleur à tout workflow (`966e1a451`) a laissé son exemption CLOUÉE au titre `'Canari rouge'` (`scripts/ops/fermetures-non-citees.mjs:45`) ; la fermeture de #1778 repose sur un `build` vert obtenu à la SECONDE tentative du run 35267858126, la première ayant échoué sur un test non déterministe, et la relance (20:15:24Z) PRÉCÈDE de 58 secondes l'ouverture du ticket qui l'instruit (#1788, 20:16:22Z) ; le commit de substance le plus lourd du palier (`966e1a451`, registre des workflows + signaleur unique) ne porte NI `JUGE:` NI `REFUTATION:` (couverture 6/9 contre 10/10 au palier précédent) ; deux revues de palier de MÊME base et de fenêtres emboîtées sont archivées dans cette seule fenêtre, `0b3631840..0dc3cba27` étant jugé deux fois ; et trois griefs du palier précédent persistent au blob sans le moindre geste (`ECRIT_LU['test'].lit` sans `scripts/`, exemption au FICHIER avec cardinal, dérive de branches).

## Sortie brute de l'instrument

`npm run ops:faits-de-palier -- --base 0dc3cba27 --tete cd9bb3299` — digest sans valeur réécrite :

```
KEYS base | tete | depuis | chainage | faitsChemin | commits | fermetures | stocks
     | fermeturesHorsCommit | auditStock | coursesCi | revuePrecedente | provenance
== base :: "0dc3cba27"   == tete :: "cd9bb3299"   == depuis :: "2026-09-16"   == chainage :: "vérifié"
== commits substance = 9 / total 17
== fermetures :: [#1778 → 3b2f8dbc8 (solde:true) · #1752 → d503a954f (solde:true)
                  · #1784 → 4cd5d4052 (solde:true) · #1779 → c9ee03453 (solde:true)
                  · #1780 → ed845b7b1 (solde:true) · #1702 → 5d99a8042 (solde:true)
                  · #1738 → ba8aaaae6 (solde:true)]
== stocks :: {"refus":[],"notes":[],"commits":17,"plage":"0dc3cba27..cd9bb3299","indisponible":null}
== fermeturesHorsCommit :: { "disponible": false, "raison":
     "Command failed: … fermetures-non-citees.mjs --depuis 2026-09-16
      ROUGE FERMETURE NEUVE hors baseline, citée par AUCUN commit et sans .claude/soldes/1785.md
      suivi : #1785 (fermée le 2026-09-17T18:33:12Z par github-actions[bot], state_reason completed)
      Rapport de dépendances rouge — une fermeture porte son solde : la rouvrir, la solder, ou
      l'inscrire a la baseline avec sa date.  … baseline 12 entrée(s) … **1 écart(s) à la baseline**" }
== auditStock :: "stock 5 entrée(s), observé 5 paquet(s) >= high … aucun écart au stock daté"
== coursesCi :: 8 shas → [CI success] (cd9bb3299, 6a1e0ebcf, bb7c241ff, c9ee03453, b05623f34,
                          de6e7de21, 5d99a8042, ba8aaaae6) ; 9 shas → "courses":[]
== revuePrecedente :: {".claude/soldes/revue-palier-2026-09-16-02b38d88b-0dc3cba27.md", disponible:true}
== provenance :: commits/fermetures/stocks/chainage = script · fermeturesHorsCommit/coursesCi = gh
                 · auditStock = npm audit · revuePrecedente = git
```

**`fermeturesHorsCommit.disponible = false` n'est pas une panne d'outil : c'est un ROUGE de contenu** que l'instrument transporte en `raison` faute de canal d'erreur — voir grief 1. C'est la première fois sur cinq paliers que cette clé n'est pas verte.

**La prémisse du brief est partiellement FAUSSE et corrigée sur pièces** : le brief annonce « les fermetures (#1780, #1778) ». La fenêtre en porte **SEPT** — #1738, #1702, #1780, #1779, #1784, #1752, #1778 — chacune avec son solde dans le commit qui ferme. Le brief annonce aussi « deux commits locaux au-dessus de `cd9bb3299` » : l'arbre n'en porte qu'UN (`c34e39b54`), plus un solde NON SUIVI (`?? .claude/soldes/1788.md`).

Sessions, mesurées : `git log 0dc3cba27..cd9bb3299 --format='%h|%(trailers:key=Claude-Session,valueonly)'` → **UN SEUL** trailer distinct (`session_01ADFgEr5qfb1F8KAt6BVRmV`), posé sur 8 commits, dont **6 des 9 de substance**. Absent sur `8c80f7c0f`, `2e6084a0e`, `1a3b88dfd` — les trois commits de CARTES, et sur les deux commits de solde `3b2f8dbc8` et `ed845b7b1`. Palier précédent : 5/10 absents ; ici 3/9. **Amélioré, non résorbé** — voir grief 6.

## Fermetures

| # | commit qui ferme | solde dans le MÊME commit (`git show --stat`) | restes | routage | réfutation | fermeture posée |
|---|---|---|---|---|---|---|
| #1738 | `ba8aaaae6` | `.claude/soldes/1738.md \| 12 +` (2 fichiers, l'autre étant la revue de palier précédente) | 1 routé + 2 RAS motivés | `-> #1781` — **OPEN**, ouvert le 2026-09-16T15:09:31Z, soit **30 min AVANT** la fermeture : pertinent au titre (`tsconfig.tsbuildinfo` suivi par git) | `verdict: PARTIEL` — juge de design (12 corrections, 2 réfutations) + juge de diff (9 lentilles) ; L1 **RÉFUTÉ** (`test:agents` lit quatre chemins documentaires avec `lit=['scripts/agents/']`) corrigé et la CLASSE gardée ; DoD mesuré sur DEUX runs GitHub réels (35111946613 produit 625 s / 35113266971 documentaire 130 s, rouge sur le lien mort) | `github-actions[bot]` 2026-09-16T15:39:20Z |
| #1702 | `5d99a8042` | `.claude/soldes/1702.md \| 12 +` (22 fichiers) | 1 routé | `-> #1782` — **OPEN**, ouvert 18:35:17Z, fermeture 19:00:38Z : ouvert AVANT, et pertinent (3 fixtures `spec: 'Feu'`) | `verdict: PARTIEL` — sonde de MUTATION hors arbre : l'implémentation de `ba8aaaae6` rejouée apprend `cauteriser` à un soldat sans Talent, l'arbre refuse ; la prémisse du ticket (« déjà connu restait silencieux ») **RÉFUTÉE** — le journal MENTAIT | `github-actions[bot]` 2026-09-16T19:00:38Z |
| #1780 | `ed845b7b1` | `.claude/soldes/1780.md \| 21 +` + la revue de palier `\| 169 +` + 5 captures | 1 routé + **2 `inventaire #1680`** + 1 correction ici + 2 RAS | `-> #1783` — **OPEN**, ouvert 19:44:54Z, fermeture 20:39:27Z : pertinent (façade courbe, folios 38-39) | `verdict: CONFIRMÉ` — 6 attaques (a)-(f) écartées par mesure ; (b) « les 80 garde-corps enclavent une loge » réfutée par flood 4-connexe 1509→1429, sonde promue en test | `github-actions[bot]` 2026-09-16T20:39:27Z |
| #1779 | `c9ee03453` | `.claude/soldes/1779.md \| 14 +` (1 fichier) | 0 routé | — | `verdict: PARTIEL` — L1 **RÉFUTÉ** (mesure syntaxique : `!failure()`, `success() && !cancelled()`, chemin en commentaire = faux-vert) → `corpsRun`/`joueSurRouge` ; DoD 3 mesuré sur GitHub à TROIS temps (rouge → #1785 créée, rouge → commentée, vert → fermée) | `github-actions[bot]` 2026-09-17T18:43:46Z |
| #1784 | `4cd5d4052` | `.claude/soldes/1784.md \| 14 +` (3 fichiers) | 0 routé | — | `verdict: PARTIEL` — L4 **RÉFUTÉE par sonde** (argument à espace éclaté, chemin espacé = faux vert avec pid annoncé) → `citerArgv` ; L3 FRAGILE → filet de journal ; L6 commentaire « seul site du dépôt » faux → corrigé | `github-actions[bot]` 2026-09-17T19:31:08Z |
| #1752 | `d503a954f` | `.claude/soldes/1752.md \| 24 +` (21 fichiers) + 4 captures | 1 routé | `-> #1786` — **OPEN**, ouvert 18:42:29Z, fermeture 19:47:38Z : pertinent (Échap en mode atelier du Codex) | `verdict: PARTIEL` — deux juges ; L5 `isolation: isolate` **RÉFUTÉ comme porteur de l'invariant** (no-op mesuré) → retiré, garde d'invariant ; L8 claim CDP non prouvée → reformulée en observation datée | `github-actions[bot]` 2026-09-17T19:47:38Z |
| #1778 | `3b2f8dbc8` | `.claude/soldes/1778.md \| 15 +` (4 fichiers) + 3 captures | 0 routé + **1 `inventaire #1680`** + 1 RAS | — | `verdict: CONFIRMÉ` — 7 attaques (a)-(g) ; (b) le repli `-`/`|` du round-trip réfuté par une grille SANS arête nue + collision de glyphe (17 segments identiques) ; (d) trois refends nus trouvés par le juge et **corrigés dans le commit** (54 → 57 arêtes) | `github-actions[bot]` 2026-09-17T20:25:50Z — **après un `build` vert de SECONDE tentative**, voir grief 2 |

Mesure des timelines, collée (`gh api repos/cgauche/game/issues/<N>/timeline --jq '.[]|select(.event=="closed")|[.actor.login,.created_at]|@tsv'`) :

```
#1778 github-actions[bot] 2026-09-17T20:25:50Z     #1752 github-actions[bot] 2026-09-17T19:47:38Z
#1784 github-actions[bot] 2026-09-17T19:31:08Z     #1779 github-actions[bot] 2026-09-17T18:43:46Z
#1780 github-actions[bot] 2026-09-16T20:39:27Z     #1702 github-actions[bot] 2026-09-16T19:00:38Z
#1738 github-actions[bot] 2026-09-16T15:39:20Z
```

**Sept fermetures, sept par la machine, zéro à la main.** Le credo « une issue se ferme CORRIGÉE, et la fermeture suit la PUBLICATION » est tenu mécaniquement sur les sept — avec la réserve de forme du grief 2 sur #1778.

## Commits de substance — annonces rejouées

`JUGE:`/`REFUTATION:` par commit de substance (`git show -s --format=%B <sha> | grep -c '^JUGE\|^REFUTATION:'`) :

```
8c80f7c0f JUGE=2 REFUTATION=1     d503a954f JUGE=1 REFUTATION=1     bb7c241ff JUGE=0 REFUTATION=0
4cd5d4052 JUGE=1 REFUTATION=1     d1524e669 JUGE=0 REFUTATION=0     966e1a451 JUGE=0 REFUTATION=0
2e6084a0e JUGE=1 REFUTATION=1     1a3b88dfd JUGE=1 REFUTATION=1     5d99a8042 JUGE=1 REFUTATION=1
```

**6 de 9** portent les deux lignes (10/10 au palier précédent). `bb7c241ff` et `d1524e669` sont deux correctifs d'un rouge de CI de BRANCHE, à trois lignes de diff de fixture : l'absence y est vénielle. `966e1a451` ne l'est pas — voir grief 3.

Onze annonces rejouées, sur l'arbre après contrôle d'identité de CHAQUE fichier sondé avec `cd9bb3299` :

| sha | annonce | rejeu |
|---|---|---|
| `4cd5d4052` / `bb7c241ff` | « `publier.test.mjs` 77/77 » | **VRAIE.** `node --test scripts/ops/publier.test.mjs` → `1..68 / # tests 77 / # suites 3 / # pass 77 / # fail 0` |
| `966e1a451` | « `test:ops` 250/250 » | **VRAIE, par arithmétique sur les objets.** `npm run test:ops` à la tête → `# tests 258 / # pass 258 / # fail 0`. `git diff --stat 966e1a451 cd9bb3299 -- scripts/ops` ne montre que `publier.mjs` et `publier.test.mjs` (le lot #1784, POSTÉRIEUR) ; comptage des cas du seul fichier modifié : `git show 966e1a451:scripts/ops/publier.test.mjs \| grep -c …` → **69**, `git show cd9bb3299:… ` → **77**. 258 − 8 = **250** |
| `966e1a451` | « `test:hooks` 994/994 » | **VRAIE, par arithmétique sur les objets.** `npm run test:hooks` à la tête → `# tests 997 / # pass 997 / # fail 0`. Hors fenêtre, `c34e39b54` ajoute `scripts/guards/lib/codeSeul.test.mjs` = **3** cas (`grep -c` collé). 997 − 3 = **994**. Dans la fenêtre, `966e1a451..cd9bb3299` ne touche qu'un fichier de `test:hooks` (`workflowsDuDepot.test.mjs`, 2 lignes : le renommage `x` → `banc` de `d1524e669`), sans variation de cardinal |
| `d503a954f` | « dismissStack 4, echap-pile-lifo 7, echap-couches-fantomes 7, GameMenu 11 » | **VRAIE aux QUATRE.** `npx vitest run` sur les 4 fichiers (identiques à `cd9bb3299`, contrôlé) → `echap-pile-lifo 7 tests · echap-couches-fantomes 7 tests · dismissStack 4 tests · GameMenu 11 tests · 4 passed (4) · Tests 29 passed (29)` |
| `d503a954f` | « onze consommateurs relus » | **VRAIE.** `git grep -c useModalA11y cd9bb3299 -- src` → 16 fichiers, dont `Modal.tsx` (le porteur) et 4 bancs ; restent exactement **11** consommateurs : `CharacterSheet`, `GameMenu`, `InspectPanel`, `OptionsScreen`, `PanneauParametre`, `ScreenShell`, `ShipSheet`, `Tabs`, `VictoryScreen`, `compendium/CompendiumScreen`, `rovingFocus` |
| `d503a954f` | « cinq copies migrées » (`layoutJsdom.testkit.ts`) | **VRAIE.** `git grep -l layoutJsdom cd9bb3299 -- src` → exactement 5 consommateurs : `CombatConsole`, `echap-couches-fantomes`, `forcedDieRow.pre-roll`, `modal-entree-champ-de-saisie`, `roll-focus-rescue` |
| `5d99a8042` | « buy-spell/devtools/i18n 69/69 » | **VRAIE.** `npx vitest run src/state/buy-spell.test.ts src/state/devtools.test.ts src/i18n/i18n.test.ts` → `i18n 5 · buy-spell 13 · devtools 51 · Tests 69 passed (69)` |
| `8c80f7c0f` | JUGE-VISION « 57 arêtes `mur-en-bois` toutes en z1 » | **VRAIE, à l'unité et sur l'axe.** Sonde `tsx` sur `buildOperaFloorplan()` → `WALLS_TOTAL 1095 / MUR_EN_BOIS 57 / z distincts: 1` |
| `2e6084a0e` | « 25 pièces » à l'étage | **VRAIE.** même sonde → `PIECES_ETAGE_DECLAREES 25`, `PIECES_REZ 26` — et 26 + 25 = 51, exactement les « 51 zones » que la recette du solde `1780.md` annonce |
| `8c80f7c0f` | « purge vérifiée par grep brut (`wallStructures`, `WALL_STRUCTURES`, `edgeWalls` : zéro ligne sur `src/ scripts/ docs/`) » | **VRAIE.** `git grep -nE "wallStructures\|WALL_STRUCTURES\|edgeWalls" cd9bb3299 -- src scripts docs` → **aucune ligne**. Contre-contrôle POSITIF que le remplaçant est bien là : `wallLegend` sur 14 fichiers, dont `asciiMap.ts` 12, `sceneToAscii.ts` 17, `mapSpec.ts` 7 |
| `966e1a451` | `CLIQUET: scripts/gates/ecrivainsAtteints.test.mjs +2` | **VRAIE, et le porteur est le BON.** `git diff 966e1a451^ 966e1a451 -- scripts/gates/ecrivainsAtteints.test.mjs` ajoute EXACTEMENT deux entrées — `'scripts/gates/workflowsDuDepot.test.mjs'`, `'scripts/ops/signaler-rouge.test.mjs'` — chacune avec sa raison DATÉE et son mécanisme (`mkdtempSync` + `rmSync` en `finally`) |

Sonde du 250 et du 994, lecture seule, promouvable en garde (c'est le CONTRÔLE que le grief récurrent des quatre paliers précédents appelait, et il rend VERT pour la première fois) :

```bash
npm run test:ops     # → # tests 258 / # pass 258 / # fail 0
npm run test:hooks   # → # tests 997 / # pass 997 / # fail 0
git show 966e1a451:scripts/ops/publier.test.mjs | grep -cE "^\s*(await )?t?e?s?t?\.?test\(|^\s*test\("   # → 69
git show cd9bb3299:scripts/ops/publier.test.mjs | grep -cE "^\s*(await )?t?e?s?t?\.?test\(|^\s*test\("   # → 77
grep -cE "^\s*(await )?test\(" scripts/guards/lib/codeSeul.test.mjs                                      # → 3
# 258 - (77-69) = 250   ·   997 - 3 = 994
```

## Stocks nominatifs

`refus: []`, `notes: []` sur 17 commits. **UNE seule ligne `CLIQUET:` dans toute la fenêtre**, mesurée à la pièce ci-dessus : porteur réel, delta exact, raison datée par entrée. Contre-contrôle qu'aucune croissance n'est passée SANS ligne : `git diff --name-only 0dc3cba27 cd9bb3299 | grep -iE "ratchet|baseline|cliquet|stock|budget"` → **VIDE**. Aucun fichier de stock n'a bougé hors du `CLIQUET:` déclaré. `auditStock` : 5 entrées, 5 paquets `>= high`, « aucun écart au stock daté ». **Grief 4 du palier précédent (un `CLIQUET:` nommant un porteur qui n'en est pas un) : RÉSORBÉ.**

## Doctrine « exemption au SITE, jamais au fichier »

Contre-grep des AJOUTS de la fenêtre : `git diff 0dc3cba27 cd9bb3299 --unified=0 -- src scripts | grep '^+' | grep -iE "exempt|allowlist|derogat"` rend **deux lignes, toutes deux des COMMENTAIRES qui refusent l'exemption** (« un défaut de pose […], jamais une exemption tacite » ; « Deux populations, aucune exemption au fichier »). **Aucune exemption neuve dans la fenêtre.** Mais l'instance du palier précédent est intacte : `git grep -n "scripts/gates/classerPush.mjs" cd9bb3299 -- src/ui/registry-id-branch-guard.test.ts` → `:161:  'scripts/gates/classerPush.mjs': 1,` — exemption au FICHIER portant un CARDINAL. Voir grief 7.

## CSS et écran

Un seul écran touché dans la fenêtre (#1752). `git diff 0dc3cba27 cd9bb3299 -- src/ui/styles/hud.css` : **aucune classe neuve**, deux sélecteurs existants amendés (`.hud-topbar` reçoit son commentaire d'invariant d'empilement, `.gm-btn` reçoit `position: relative; z-index: 131`), chaque amendement portant sa raison et son ticket. Rien à reprocher à la grille du diff : pas de primitive contournée, pas de classe d'écran.

## CI

`gh run list --repo cgauche/game --branch main --limit 20 --json headSha,conclusion,status,workflowName,createdAt,databaseId` :

```
cd9bb3299 CI success 17/09 19:56:46 (35267858126)   6a1e0ebcf CI success 17/09 19:39:54 (35266216419)
bb7c241ff CI success 17/09 19:23:10 (35264567481)   c9ee03453 CI success 17/09 18:41:18 (35260338707)
b05623f34 CI success 17/09 18:25:46 (35258760483)   de6e7de21 CI success 16/09 20:28:21 (35146742811)
5d99a8042 CI success 16/09 18:50:13 (35136871994)   ba8aaaae6 CI success 16/09 15:36:56 (35116532212)
0dc3cba27 CI success 16/09 15:07:03 (35113146496)   [base de la fenêtre]
```

Huit têtes de train, huit verts **en conclusion** ; 9 des 17 shas sans run propre (régime de publication en TRAIN). Mais la conclusion du run de TÊTE est une conclusion de SECONDE tentative :

```
$ gh api repos/cgauche/game/actions/runs/35267858126 --jq '[.run_attempt,.conclusion,.created_at,.updated_at,.event]|@tsv'
2  success  2026-09-17T19:56:46Z  2026-09-17T20:25:53Z  push
$ gh api repos/cgauche/game/actions/runs/35267858126/attempts/1 --jq '[.run_attempt,.conclusion,.created_at,.updated_at]|@tsv'
1  failure  2026-09-17T19:56:46Z  2026-09-17T20:06:41Z
$ gh api repos/cgauche/game/actions/runs/35267858126/attempts/1/jobs --jq '.jobs[]|select(.conclusion=="failure")|[.name,.conclusion]|@tsv'
build  failure
$ gh api repos/cgauche/game/actions/runs/35267858126/attempts/2 --jq '[.run_attempt,.conclusion,.run_started_at]|@tsv'
2  success  2026-09-17T20:15:24Z
```

Voir grief 2. Aucun autre rouge sur `main` dans la fenêtre.

## Fermetures hors commit — l'instrument est ROUGE

`fermetures-non-citees --depuis 2026-09-16` refuse **#1785**, « Rapport de dépendances rouge », fermée le 2026-09-17T18:33:12Z par `github-actions[bot]`, `state_reason completed`, sans commit fermant et sans `.claude/soldes/1785.md`. Le cycle de vie de #1785 est PARFAITEMENT documenté (message de `c9ee03453` : créée à 18:27:20Z par le signaleur sur le run rouge 35258885513, commentée sur un second rouge, fermée sur le dispatch vert 35259478157), mais la prose d'un message n'est pas une citation fermante et la garde ne lit que `numerosFermes(journal)`. Voir grief 1.

## Griefs de la revue précédente (8 routés)

| grief du 2026-09-16 (`0dc3cba27`) | état dans CETTE fenêtre | mesure |
|---|---|---|
| 1 — « chiffre non pris sur les objets », 4e récidive, écart INTERNE au message | **RÉSORBÉ** | ONZE annonces rejouées, ONZE exactes (§ Commits de substance). Zéro écart interne détecté sur les 9 commits de substance. Nuance dite : `8c80f7c0f` porte bien 54 ET 57 arêtes, mais chronologiquement étiquetées (« train 2 » puis « corrigée dans ce commit (57 arêtes) ») — ce n'est pas la classe |
| 2 — `ECRIT_LU['test'].lit` omet `scripts/`, garde à un seul axe | **PERSISTANT, inchangé au caractère près** | `git show cd9bb3299:scripts/gates/toutes.mjs` l.219 → `lit: ['src/', 'server/src/', 'scripts/map/', 'docs/', 'Source/', '.gitattributes', 'vite.config.ts']`. Aucun commit de la fenêtre ne touche cette entrée |
| 3 — exemption au FICHIER + cardinal dans `registry-id-branch-guard.test.ts` | **PERSISTANT** | `cd9bb3299:src/ui/registry-id-branch-guard.test.ts:161: 'scripts/gates/classerPush.mjs': 1,` — voir grief 7 |
| 4 — `CLIQUET:` nommant un porteur qui n'en est pas un | **RÉSORBÉ** | la ligne unique du palier nomme `ecrivainsAtteints.test.mjs`, le vrai magasin, avec `+2` exact (diff collé) |
| 5 — SIX restes vers les épiques d'inventaire en une fenêtre | **ATTÉNUÉ (6 → 3), non résorbé** | `1778.md` : 1 `inventaire #1680` ; `1780.md` : 2 `inventaire #1680` ; les cinq autres soldes : **0**. La grammaire du reste ne les compte toujours pas — voir grief 8 |
| 6 — trailer `Claude-Session` absent sur 5/10 des commits de substance | **ATTÉNUÉ (5/10 → 3/9), non résorbé** | absent sur `8c80f7c0f`, `2e6084a0e`, `1a3b88dfd` (les trois commits de CARTES) et sur les deux commits de solde. Toujours UNE seule session tracée : la lentille « ≥ 2 canaux » reste inapplicable, 3e palier d'affilée |
| 7 — dérive de branches 11 / 249 | **POPULATION HISTORIQUE STRICTEMENT IDENTIQUE, population totale en HAUSSE** | sonde ci-dessous : les 11 branches du tableau précédent totalisent **exactement 249** commits, inchangé (aucune purge) ; la population dédupliquée d'aujourd'hui est de **17 branches / 262 commits** — 6 branches et 13 commits de plus, dont 3 sont les chantiers VIVANTS du 2026-09-18 (`chantier/1695`, `chantier/1716`, `chantier/1788`, hors fenêtre) et 3 sont dormants (`chantier/1727-cliquets` 15/09, `chantier/1739-crb5e` 14/09, `claude/source-content-deduplication-yo7jyh` 18/08). **Aucune branche de chantier de CETTE fenêtre n'y contribue** : #1778, #1779, #1780, #1752, #1784, #1702 sont toutes à +0 |
| 8 — la garde réclamée par #1777 (revue supprimée) n'existe pas | **PERSISTANT** | `gh issue view 1777` → **OPEN**. `git show cd9bb3299:scripts/guards/lib/revuePalier.mjs \| grep -n "diff-filter"` → **UNE seule ligne, `:118`, `--diff-filter=A`**. Rien ne regarde `D` : une archive de revue reste supprimable sans porte |

Sonde de la dérive (lecture seule, `backup/*` et `sauvegarde/*` exclus comme au palier précédent) :

```
ab/notre +1 · ab/phanes +6 · ab/phanes-c +7 · chantier/1456-choix +1 · chantier/1501-jets-mer +68
chantier/mobilier-diligence +70 · codex/1388 +68 · essai/phaneslight-rejeu +9 · fix/garde-rm-worktree +5
worktree-agent-a8c251af80eb67c75 +13 (2026-08-05, 44 j) · worktree-agent-ecran +1      → 11 br. / 249
+ chantier/1695 +2 · chantier/1716 +2 · chantier/1727-cliquets +1 · chantier/1739-crb5e +2
+ chantier/1788 +1 · claude/source-content-deduplication-yo7jyh +5                       → 17 br. / 262
```

## Griefs

**Grief 1 — l'instrument de palier est ROUGE à la tête et personne ne l'a vu : le lot qui a GÉNÉRALISÉ le signaleur (`966e1a451`) a laissé son exemption clouée au titre `'Canari rouge'`.** `fermetures-non-citees.mjs` connaît deux exemptions : le label `duplicate`, et l'issue du signaleur, reconnue par `const fermeeParLeCanari = (f) => f.closedBy === FERMEUR_CANARI && String(f.titre ?? '').startsWith(TITRE_CANARI)` avec `TITRE_CANARI = 'Canari rouge'` (`scripts/ops/fermetures-non-citees.mjs:44-47`). Le JSDoc qui la précède (`:32-43`) motive le choix du TITRE contre le label en disant : « L'issue se reconnaît à son TITRE, comme dans le workflow — `SURVIVANTE` la cherche par `Canari rouge in:title`, et un seul terme désigne donc un seul objet. » Cette justification était vraie tant qu'il n'y avait qu'UN signaleur. `966e1a451` la périme dans le même geste qui crée `scripts/ops/signaler-rouge.mjs` avec un `--titre` PARAMÉTRABLE, et câble `deps-report.yml` sur `--titre "Rapport de dépendances rouge"` (`.github/workflows/deps-report.yml:41`). Résultat mesuré dès le lendemain, par le DoD-3 du lot lui-même : #1785 est ouverte ET fermée par le bot en six minutes, et l'instrument de palier la refuse, `disponible: false`, « 1 écart(s) à la baseline ». Ce n'est pas une nuisance cosmétique : cette clé est le seul canal qui détecte une fermeture faite HORS de tout commit, et elle restera rouge pour tout palier dont la fenêtre couvre le 2026-09-17 — un détecteur qui rougit toujours ne détecte plus rien. C'est la classe « règles GÉNÉRALES, jamais spécifiques » du credo, et c'est aussi une source de vérité DOUBLE : le préfixe de titre vit au YAML et au module de garde, sans lien.

→ attendu : l'exemption se dérive de la MÊME source que le signaleur — la liste des `--titre` déclarés au registre `scripts/gates/workflowsDuDepot.mjs` (ou le couple `closedBy === 'github-actions[bot]' && labels ∋ canari && le workflow autosignalé qui la pose`) — et le registre devient l'unique porteur du préfixe ; à défaut immédiat, #1785 entre à la baseline avec sa date. `fichier:ligne` : `scripts/ops/fermetures-non-citees.mjs:45` (`TITRE_CANARI`), `.github/workflows/deps-report.yml:41` (`--titre`), `scripts/ops/signaler-rouge.mjs` (`--titre` paramétrable, introduit par `966e1a451`). **BLOQUANT pour l'instrument** — c'est le seul grief du palier qui empêche une mesure de tourner.

**Grief 2 — la fermeture de #1778 repose sur un `build` vert de SECONDE tentative, et la relance a précédé de 58 secondes l'ouverture du ticket qui l'instruit.** Chronologie mesurée à l'API, collée au § CI : le run `35267858126` sur `cd9bb3299` échoue en `build` à 20:06:41Z (tentative 1) ; la tentative 2 démarre à **20:15:24Z** ; #1788 (« `sceneTint.test.ts` « BUDGET » mesure une horloge — rouge non déterministe sur `main`, vert sur la branche du même sha ») est ouverte à **20:16:22Z** ; le run finit vert à 20:25:53Z ; `github-actions[bot]` ferme #1778 à **20:25:50Z**. Deux choses en découlent. (a) L'ordre est « relancer d'abord, instruire ensuite » : le geste qui efface la preuve précède le geste qui la consigne — à 58 secondes près, le ticket existe, donc rien n'est perdu ici, mais la SÉQUENCE est celle d'un rouge toléré, pas d'un rouge instruit. (b) La fermeture d'un ticket de contenu (#1778, `wallLegend`) est portée par un vert obtenu en rejouant un test non déterministe dont la cause est restée OUVERTE jusqu'au commit HORS fenêtre `c34e39b54` — le « `build` vert sur `main` » que le credo exige est ici un vert de deuxième tirage. Rien ne dit que #1778 soit en cause (le rouge est sur `sceneTint`, sans rapport), et c'est précisément le problème : personne ne peut le dire à partir du seul `conclusion: success` que `gh run list` affiche, et que l'instrument de palier recopie sans lire `run_attempt`.

→ attendu : (i) `faits-de-palier` lit `run_attempt` et distingue « vert » de « vert à la Nᵉ tentative » — un palier qui se juge sur `coursesCi` doit voir la différence ; (ii) une relance de rouge sur `main` ne se joue qu'APRÈS le ticket qui la motive, le numéro cité dans le commentaire de relance. `fichier:ligne` : `gh api repos/cgauche/game/actions/runs/35267858126/attempts/1` (`failure`), `.../attempts/2` (`run_started_at 2026-09-17T20:15:24Z`), `gh issue view 1788 --json createdAt` (`2026-09-17T20:16:22Z`). **Non bloquant** — le ticket existe, la cause est corrigée hors fenêtre.

**Grief 3 — `966e1a451`, le commit de substance le plus lourd du palier, ne porte NI `JUGE:` NI `REFUTATION:`.** Mesure collée au § Commits de substance : `JUGE=0 REFUTATION=0`. Ce commit pose le registre des workflows, la mesure d'état `mesurerEtat`/`corpsRun`/`joueSurRouge`, le signaleur unique `signaler-rouge.mjs`, réécrit `canari.yml` et `deps-report.yml`, migre quatre cas de test et porte l'unique `CLIQUET:` du palier. Le jugement EXISTE — il est intégralement recopié dans `c9ee03453`, le commit de solde posté le lendemain (« REFUTATION: juge de diff (2026-09-16, neuf lentilles) — L1 RÉFUTÉ (mesure `autosignale` syntaxique […] → faux-vert) ») — donc la preuve n'est pas perdue ; elle est DÉSOLIDARISÉE de l'objet qu'elle juge. Un lecteur qui fait `git log --grep=REFUTATION -- scripts/gates/workflowsDuDepot.mjs` ne trouve rien. Le palier précédent mesurait 10 commits de substance sur 10 porteurs de `JUGE:` : la couverture passe à 6/9.

→ attendu : la ligne `JUGE:`/`REFUTATION:` vit sur le commit qui porte le CODE jugé ; le solde la résume, il ne la remplace pas. `fichier:ligne` : `git show -s --format=%B 966e1a451` (aucune des deux lignes) vs `git show -s --format=%B c9ee03453` (les deux). **Non bloquant.**

**Grief 4 — deux revues de palier de MÊME base et de fenêtres EMBOÎTÉES sont archivées dans cette seule fenêtre : `0b3631840..0dc3cba27` est jugé deux fois, et la porte ne peut pas le voir.** `git log --diff-filter=A` sur les deux fichiers : `ba8aaaae6` (premier commit de la fenêtre) ajoute `revue-palier-2026-09-16-02b38d88b-0dc3cba27.md` ; `ed845b7b1` (six commits plus tard, #1780) ajoute `revue-palier-2026-09-16-02b38d88b-0b3631840.md`, dont l'en-tête dit « fenêtre `02b38d88b..0b3631840` » — un intervalle STRICTEMENT INCLUS dans le précédent, archivé APRÈS lui. L'invariant que la porte proclame (`solde-ticket-guard.mjs:1135-1141` : « Les fenêtres s'ENCHAÎNENT : une revue part où la précédente s'est arrêtée ») n'a pas mordu, parce qu'il se mesure au COMMIT, sur la branche de chantier où l'archive précédente n'était pas encore là — et le rebase a ensuite inversé l'ordre. Effet mesuré : `derniereRevueArchivee` choisit par ASCENDANCE, pas par ordre d'archivage, donc la chaîne se répare toute seule pour la revue SUIVANTE (sonde : `mesureDuPalier` → `{"compte":10,"tete":"0dc3cba27","chemin":".claude/soldes/revue-palier-2026-09-16-02b38d88b-0dc3cba27.md"}`) — le palier d'aujourd'hui part donc du bon endroit. Le coût est ailleurs : deux juges ont jugé les mêmes commits le même jour, et l'archive porte deux verdicts PARTIEL concurrents sur `0b3631840..0dc3cba27` sans que rien ne dise lequel fait foi.

→ attendu : la porte au commit compare la fenêtre stagée non pas à « la dernière archive de HEAD » mais à l'UNION des fenêtres déjà archivées ascendantes — un intervalle déjà couvert est refusé, quelle que soit la branche d'origine ; c'est le même `--diff-filter` qui manque au grief 8 du palier précédent (#1777), et les deux se posent dans `revuePalier.mjs`. `fichier:ligne` : `.claude/soldes/revue-palier-2026-09-16-02b38d88b-0b3631840.md` (ajouté par `ed845b7b1`) vs `.claude/soldes/revue-palier-2026-09-16-02b38d88b-0dc3cba27.md` (ajouté par `ba8aaaae6`, ancêtre) ; `scripts/guards/lib/revuePalier.mjs:118` (`--diff-filter=A` seul). **Non bloquant.**

**Grief 5 — la garde de la classe « `lit` sous-déclaré » n'a toujours qu'un axe, et l'axe non mesuré est faux au caractère près depuis deux paliers.** `git show cd9bb3299:scripts/gates/toutes.mjs`, l.219 : `lit: ['src/', 'server/src/', 'scripts/map/', 'docs/', 'Source/', '.gitattributes', 'vite.config.ts']` — `scripts/` hors `scripts/map/` reste absent, alors que trois fichiers vitest le balaient (`plan-species-vocabulaire.test.ts:154` `readCorpus(['src','scripts'])`, `planche-qc-cuisson.test.ts:180` `readCorpus(['scripts/qc'])`, `generateurs-byte-stables.test.ts:37` `listerDossier(SCRIPTS_DIR)`). Aucun commit de la fenêtre n'y touche. Le défaut reste LATENT (aucune gate n'écrit sous `scripts/`, donc `conflitsEntreLanes()` rend `[]`), mais il est désormais RÉCIDIVANT : deux paliers, même entrée, même mesure, aucun geste.

→ attendu : inchangé depuis le 2026-09-16 — le banc qui confronte le corpus d'une gate aux jetons DOCUMENTAIRES le confronte aussi à son `lit` tout court ; tout dossier de premier niveau atteint par le corpus doit être couvert par un préfixe de `lit`, ou la gate rougit. `fichier:ligne` : `scripts/gates/toutes.mjs:219`, `scripts/gates/classerPush.test.mjs` (axe unique). **Non bloquant.**

**Grief 6 — le trailer `Claude-Session` manque sur les TROIS commits de cartes, et la fenêtre ne trace toujours qu'UNE session.** Mesure collée : 8 commits portent `session_01ADFgEr5qfb1F8KAt6BVRmV`, 9 n'en portent aucun ; parmi les 9 de substance, **6 avec, 3 sans** — `8c80f7c0f`, `2e6084a0e`, `1a3b88dfd`, tous `Co-Authored-By: Claude Fable 5.1`, tous du domaine CARTES, plus les deux commits de solde `3b2f8dbc8` et `ed845b7b1`. La tendance est bonne (8/10 → 5/10 → 3/9) mais la cause est intacte et le motif est désormais NOMMABLE : c'est le canal qui publie les lots de cartes qui ne pose pas le trailer, pas un oubli aléatoire. Troisième palier consécutif où la lentille « deux canaux se contredisent-ils ? » est inapplicable faute d'un second canal tracé.

→ attendu : le trailer se pose par le même geste que `Co-Authored-By` — c'est un geste d'OUTIL (`ops:publier`), pas de rédacteur. `fichier:ligne` : `git log 0dc3cba27..cd9bb3299 --format='%h %(trailers:key=Claude-Session,valueonly)'`. **Non bloquant.**

**Grief 7 — l'exemption au FICHIER portant un CARDINAL survit à un deuxième palier sans être re-triée.** `cd9bb3299:src/ui/registry-id-branch-guard.test.ts:161` → `'scripts/gates/classerPush.mjs': 1,`. Le palier précédent l'a instruite (grief 3) avec le canonique disponible à deux fichiers de là (`DOC_REF_SITES_EXEMPTS`, clé `fichier|jeton`, sans compte) ; aucun commit de la fenêtre n'y touche, et la fenêtre a pourtant vu passer un lot entier sur `scripts/gates/` (#1779). Le point positif, mesuré et dit : la fenêtre n'ajoute AUCUNE exemption neuve, et les deux seules lignes d'ajout portant le mot sont des commentaires qui la REFUSENT.

→ attendu : inchangé — exemption par clé de SITE, sans cardinal, ou reconnaissance du motif sain par la garde elle-même. `fichier:ligne` : `src/ui/registry-id-branch-guard.test.ts:161`. **Non bloquant.**

**Grief 8 — la grammaire du reste ne compte toujours pas `-> inventaire #N`, et trois restes partent encore à #1680 dans cette fenêtre.** `1778.md` : 1 ; `1780.md` : 2 ; total **3** (contre 6 au palier précédent, 4 pour toute l'histoire avant lui). `gh issue view 1680` → **OPEN** depuis le 2026-09-01, « SOCLE VOLUMIQUE — 18 régimes coexistants […] audit d'architecture 2026-09-01 — vague de #1343 ». Les trois restes sont bien motivés et mesurés (diagonale `/`/`\` sans char de légende ; `exteriorVoidCells`/`enclosedHolesOf` aveugles aux murs ; le garde-corps modélisé en occupant de CASE là où c'est une propriété d'ARÊTE — ce dernier étant une réserve de PRÉMISSE que le juge a explicitement portée au solde plutôt que de l'enjoliver). Le grief est inchangé : le plafond « au plus UN reste routé » se tient à 1 pendant que la porte de service reste ouverte, et l'épique n'a toujours pas de DoD de vidage datée.

→ attendu : inchangé — ou `-> inventaire #N` compte dans le plafond, ou #1680 porte une DoD de vidage et le solde qui y verse cite le commentaire qu'il y a posé. `fichier:ligne` : `.claude/soldes/1778.md` (1 `inventaire #1680`), `.claude/soldes/1780.md` (2). **Non bloquant.**

## Non couvert par ce jugement

(a) **`npm test` n'est pas rejoué** (machine chargée, consigne du brief) : l'annonce « suite complète verte (jsdom 183 fichiers, node 1505 fichiers) » du solde `1780.md` est prise pour vraie. Deux gates complètes l'ont été (`test:hooks` 997/997, `test:ops` 258/258) et sept fichiers vitest ciblés (29 + 69 cas), tous verts, tous conformes à l'annonce. (b) **`typecheck`, `lint`, `build`, `docs:check`, `map:check opera`** ne sont pas rejoués. (c) **Aucun contrôle visuel** : les douze captures citées par les soldes `1752`/`1778`/`1780` sont vérifiées NOMMÉES et présentes au diff, non OUVERTES ; les claims « planches brunes vs mur nu beige », « le ☰ reste cliquable menu ouvert » reposent sur les recettes CDP des 16 et 17/09 et ne sont pas re-jugés à l'écran. (d) **Les mutations rouge→vert annoncées** (deps `[boxRef]`, `z-index: 60` retiré, garde débranchée ×5, `citerArgv` ×4…) ne sont pas rejouées. (e) **Le contenu GitHub des tickets** n'est recroisé que sur `number/state/title/createdAt/closedAt/actor`. (f) **La géométrie de l'opéra n'est jugée que sur deux cardinaux** (57 arêtes bois en z1, 25+26 pièces) : les folios 38-39 ne sont pas rouverts, la fidélité au plan repose sur le juge du lot. (g) **`corpusParGate` n'est pas exécuté** : le grief 5 recopie la mesure du palier précédent et ne vérifie que la persistance de l'entrée `lit`.

## Verdict

verdict: PARTIEL

Le socle de fermeture ne cède sur aucun point, et ce palier est le premier des cinq à rendre son grief RÉCURRENT à zéro : **sept fermetures, sept soldes DANS le commit qui ferme, au plus UN reste `-> #N` par solde, quatre cibles de routage OPEN et toutes ouvertes AVANT la fermeture qu'elles absorbent (#1786, #1783, #1782, #1781), sept `verdict:` nommés dont deux CONFIRMÉ et cinq PARTIEL qui déclarent une clause RÉFUTÉE plutôt que de l'enjoliver, sept fermetures POSÉES par `github-actions[bot]` (timelines collées), `refus: []` et `notes: []` sur 17 commits, zéro écart au stock d'audit, aucun fichier de stock touché hors du `CLIQUET:` unique — dont le porteur, le delta et les raisons datées sont exacts au diff —, aucune classe CSS neuve, aucune exemption neuve, et ONZE annonces chiffrées rejouées, ONZE exactes** : `publier.test.mjs` 77/77 mesuré, `test:ops` 250 et `test:hooks` 994 rétablis par arithmétique sur les objets (258 − 8, 997 − 3), dismissStack 4 / echap-pile-lifo 7 / echap-couches-fantomes 7 / GameMenu 11 à l'unité, buy-spell+devtools+i18n 69/69, onze consommateurs de `useModalA11y` et cinq copies migrées comptés au grep, 57 arêtes `mur-en-bois` toutes en z1 et 25 pièces à l'étage mesurées par sonde `tsx` sur la scène construite, purge de `wallStructures`/`WALL_STRUCTURES`/`edgeWalls` à zéro ligne avec contrôle POSITIF du remplaçant. La classe « chiffre non pris sur les objets », quatre paliers d'affilée, est RÉSORBÉE ; le `CLIQUET:` fautif du palier précédent aussi. Ce qui ne tient pas se lit en quatre griefs neufs et quatre récidives : (1) **l'instrument de palier est ROUGE** — `fermetures-non-citees` refuse #1785 parce que le lot qui a généralisé le signaleur à tout workflow a laissé son exemption clouée au titre `'Canari rouge'` (`fermetures-non-citees.mjs:45`), et un détecteur qui rougit toujours ne détecte plus rien ; (2) la fermeture de #1778 repose sur un `build` vert de SECONDE tentative (tentative 1 `failure` à 20:06:41Z, tentative 2 démarrée à 20:15:24Z), la relance précédant de 58 secondes le ticket qui l'instruit (#1788, 20:16:22Z), et `coursesCi` ne lit pas `run_attempt` ; (3) `966e1a451`, le commit le plus lourd du palier, ne porte ni `JUGE:` ni `REFUTATION:` — ils vivent sur le solde du lendemain, désolidarisés du code jugé, et la couverture tombe de 10/10 à 6/9 ; (4) deux revues de palier de même base et de fenêtres emboîtées sont archivées dans cette seule fenêtre, `0b3631840..0dc3cba27` jugé deux fois, la porte étant aveugle après rebase ; (5) `ECRIT_LU['test'].lit` omet toujours `scripts/` ; (6) trois commits de substance, tous du domaine cartes, restent sans trailer de session, une seule session tracée pour le troisième palier ; (7) l'exemption au FICHIER portant un cardinal survit intacte ; (8) trois restes partent encore aux épiques d'inventaire sans que la grammaire du reste les compte — moitié moins qu'au palier précédent. La dérive de branches, enfin, est à double lecture et dite comme telle : la population historique est figée au commit près (11 branches / 249, aucune purge, la plus vieille à 44 jours), mais aucune des six branches de chantier de cette fenêtre n'y contribue — elles sont toutes à +0 sur `origin/main`.
