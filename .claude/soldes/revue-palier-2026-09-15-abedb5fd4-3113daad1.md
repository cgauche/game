# Revue de palier — fenêtre abedb5fd4..3113daad1 — 2026-09-15

verdict: PARTIEL

Fenêtre `abedb5fd4..3113daad1` (23 commits de substance sur 40, 3 fermetures, 6 sessions) jugée en lecture seule par un juge unique (Opus, 2026-09-15) depuis l'arbre épinglé `.wt-1768-board` (`git rev-parse HEAD` → `3113daad1c94d86e1397585a5e9217858886768c`, working tree porteur de 17 fichiers modifiés IGNORÉS : toute mesure de contenu par `git show 3113daad1:<chemin>` / `git grep <sha>`). Contrôle POSITIF joué avant toute mesure : `git grep -n "DES_HORS_PORTE_STOCK" 3113daad1` rend 16 sites et `git show 3113daad1:src/ui/liage.ts` rend le `SITES_PROSE` du lot E — le travail jugé est bien dans l'arbre épinglé. Mesure par l'INSTRUMENT (`npm run ops:faits-de-palier -- --base abedb5fd4 --tete 3113daad1 --cwd <worktree>`), chaînage `vérifié` à la revue précédente `.claude/soldes/revue-palier-2026-09-14-9e15cba42-abedb5fd4.md` (verdict PARTIEL, lue). Le cumul TIENT sur ses trois fermetures (#1751, #1759, #1754 : solde dans le commit qui ferme, restes routés à UN seul `-> #1750`, réfutation nommée), sur zéro fermeture hors commit, sur zéro croissance de stock nominatif sans `CLIQUET:` (`refus: []`), et sur quatre annonces chiffrées rejouées vraies à l'octet. Ce qui NE tient pas : une annonce chiffrée fausse d'une unité dans le plus gros lot produit de la fenêtre (`78a385393` dit « 30 portés, 11 nus », le code introduit 29/12) ; une session entière (#1739, 5 commits de substance dont un `feat(raw)!`) livre sans AUCUNE ligne JUGE/RÉFUTATION au message, seule des six ; le workflow `Export des issues` est ROUGE sur la tête même de la fenêtre et rouge pour la 2ᵉ semaine consécutive, sans porteur ; un commentaire de `src/ui/compendium/relations.ts:498` affirme un « repli des appelants non encore migrés » qui n'existe plus (0 appelant de production) ; et le régime « une branche fusionne le JOUR MÊME » est en dérive cumulée (7 branches dormantes à avance > 0, la plus vieille au 2026-08-05).

## Sortie brute de l'instrument

`npm run ops:faits-de-palier -- --base abedb5fd4 --tete 3113daad1 --cwd <worktree> --sortie faits.json` — digest sans valeur réécrite :

```
KEYS base | tete | depuis | chainage | faitsChemin | commits | fermetures | stocks | fermeturesHorsCommit | auditStock | derogations | coursesCi | revuePrecedente | provenance
== base :: "abedb5fd4"
== tete :: "3113daad1"
== depuis :: "2026-09-14"
== chainage :: "vérifié"
== fermetures :: [{"numero":"1751","sha":"c600d03defa8ce46d8bc176845002343818f6ff9","sujet":"chore(ops): corrige #1751, refs #1750 — solde du Lot 1, recalé sur le train réel publié","solde":true},
                  {"numero":"1759","sha":"5e191fc2e97ee199acb2a96bd7720d85d7393ca3","sujet":"feat(gates): corrige #1759 — les tests scripts/** se découvrent par répertoire, jamais par liste","solde":true},
                  {"numero":"1754","sha":"57ace07605008aff5eed36731c70ef6924cce3ff","sujet":"fix(hooks): corrige #1754, refs #1750 #1728 — `enterine-guard` … (vrai pour `Edit`, faux pour `Write`)","solde":true}]
== stocks :: {"disponible":true,"valeur":{"refus":[],"notes":[],"commits":40,"plage":"abedb5fd4..3113daad1","indisponible":null}}
== fermeturesHorsCommit :: "[fermetures] fenêtre depuis 2026-09-14 · baseline 12 entrée(s) … - aucune fermeture non citée dans la fenêtre … **Aucun écart à la baseline.**"
== auditStock :: "[audit-stock] stock 5 entrée(s), observé 5 paquet(s) >= high … [audit-stock] aucun écart au stock daté"
== derogations :: {"dansLaFenetre":[{"horodatage":"2026-09-14T21:48:46.738Z","etat":"tentative","motif":"rouge","sha":"94547f4f413d2ac08301f83a2974ef8361d599a4","shaCause":"26e715843d9016de3744787fd79bc0b8eb35ab5e","raison":"main rouge par 26e715843 (#1759, test spawnResilient non portable) : ce train porte le correctif 9886aa3e3, gates vertes avant push"}],"horsFenetre":8,"illisibles":0}
== coursesCi :: 3113daad1 → [Export des issues: failure, CI: success] · 997aefba8 → [CI: success] · 101316e2d → [CI: success] · 4dc8a6870 → [CI: success] · 94547f4f4 → [CI: success] · 26e715843 → [CI: failure] · 3a5d84d2c → [CI: success] · d0a0c2693 → [CI: success] · 45eafa995 → [CI: success] · 9700eafbe → [CI: success] · 57ace0760 → [CI: success] ; 28 des 40 shas → "courses":[]
== revuePrecedente :: {"chemin":".claude/soldes/revue-palier-2026-09-14-9e15cba42-abedb5fd4.md","disponible":true}
== provenance :: {"commits":"script","fermetures":"script","stocks":"script","chainage":"script","fermeturesHorsCommit":"gh","auditStock":"npm audit","derogations":"journal local du pre-push","coursesCi":"gh","revuePrecedente":"git"}
== commits substance = 23 / total 40
```

Sessions (`git log abedb5fd4..3113daad1 --format="%H%x09%(trailers:key=Claude-Session,valueonly)"`) : 6 distinctes — `01NfeC1hzy…` (#1392/#1388, 5 commits), `012B9QJa…` (#1751, 6), `01YXgZBG…` (#1739, 7), `01CLe8yA…` (#1727, 2), `01Nb8w9G…` (#1759/#1728, 4), `018kf8vB…` (#1508/#1463/#1754, 3) ; 9 commits de docs dérivés sans trailer.

## Fermetures

Trois fermetures par commit, toutes CONFORMES sur les trois clauses.

| # | commit qui ferme | solde dans le MÊME commit (`git show --stat`) | restes routés | réfutation |
|---|---|---|---|---|
| #1751 | `c600d03de` | `.claude/soldes/1751.md \| 6 +++---` (seul fichier du commit) | 6 restes : 5 `-> RAS` motivés + 1 `-> inventaire #1750 : Lot 3` (UN seul) | `verdict: CONFIRMÉ` — juge de design 8 lentilles, 22 corrections / 21 intégrées, 1 réfutée par contre-grep ; juge de diff 9 points, 8 corrigés, le 9ᵉ NON REPRODUIT avec sa mesure |
| #1759 | `5e191fc2e` | `.claude/soldes/1759.md \| 11 +++` (dans un commit de 9 fichiers, 389+/30−) | 3 restes : 2 `-> RAS` + 1 « corrigé dans ce commit (scripts/guards/lib/commentPoison.mjs:254) » | `verdict: CONFIRMÉ` — 7 lentilles, 6 défauts rendus, tous corrigés et prouvés par MUTATION, griefs tombés nommés |
| #1754 | `57ace0760` | `.claude/soldes/1754.md \| 11 ++` (+ la revue de palier précédente, 154 lignes) | 3 restes : 1 `-> inventaire #1750 : Lot 3` (UN seul) + 2 `-> RAS` | `verdict: CONFIRMÉ` — juge de diff, multiensemble mesuré sur 7 sous-cas, branche `Edit` inchangée, griefs hors lot routés |

Fermetures hors commit : AUCUNE. `fermetures-non-citees` (provenance `gh`) rend « aucune fermeture non citée dans la fenêtre », « Aucun écart à la baseline » (12 entrées de baseline).

Note sur `c600d03de` : le solde #1751 n'est pas CRÉÉ par le commit qui ferme, il y est MODIFIÉ (3+/3−) — la version portée par la tête est celle recalée sur le train réellement publié (`d0a0c2693`). L'invariant (« la preuve part avec le commit qui ferme ») est tenu ; c'est une précision, pas un grief.

## Commits vérifiés

Quatre annonces rejouées à `3113daad1`, sur trois sessions distinctes (deux exigées).

| sha | session | annonce vérifiée | preuve à HEAD |
|---|---|---|---|
| `5f31e973a` | `012B9QJa…` (#1751) | « `git grep -n -E "[A-Za-z]:[/\\]" scripts/` → 0 sur ces trois fichiers » | VRAIE. `git grep -n -c -E "[A-Za-z]:[/\\\\]" 3113daad1 -- scripts/guards/lib/gitPorte.test.mjs scripts/ops/publier.test.mjs scripts/ops/worktrees.test.mjs` → aucune sortie, `exit=1` (git grep : 1 = zéro correspondance) |
| `c385be32b` | `01CLe8yA…` (#1727) | « le mécanisme `legacy: N` de `gameOpRefFk` meurt, sans dette » | VRAIE. `git grep -n "legacy" 3113daad1 -- scripts/guards/lib/gameOpRefFk.mjs src/data/gameOpRefFk.ts` → 0 ligne ; `git ls-tree -r --name-only 3113daad1` filtré sur `gameOpRefFk` → seuls `scripts/guards/lib/gameOpRefFk.mjs` et son `.d.mts` |
| `92efc66be` | `018kf8vB…` (#1508 T3b-1) | « stock `DES_HORS_PORTE_STOCK` : `hitModifiers.ts` 1 → 0 (entrée supprimée, tolérance zéro par absence) » | VRAIE. `git grep -n "hitModifiers" 3113daad1 -- scripts/guards/lib/rollSeamWhitelist.mjs` → 1 seule ligne, `:197`, l'entrée `src/state/combatFlow.ts` qui MENTIONNE le registre dans son `why` — aucune clé `hitModifiers` au stock |
| `05e545af9` | `01NfeC1hzy…` (#1392) | « cardinaux recalés : regles.json 85→86, total 836→837 » | VRAIE. `scripts/migrations/2026-08-28-l1b-11b-entite-type.mjs:82` → `'regles.json': 86`, `:95` → `const TOTAL_ATTENDU = 837;`, `:93` porte l'historique `836→837` ; les deux portes fail-closed subsistent (`:114`, `:115`) |

**Trouvaille 1 — annonce chiffrée FAUSSE d'une unité dans `78a385393` (session `01NfeC1hzy…`, lot E T0).** Le message dit : « `SITES_PROSE` (41 sites : **30 portés, 11 nus** avec leur raison — 4 sites de scène sans identité de projet en jeu = reste T1 nommé) ». Mesuré à HEAD sur le bloc `SITES_PROSE` de `src/ui/liage.ts` (lignes 76→135) : **41 entrées, 29 avec `porteur:`, 12 nues**. Sonde :

```js
const t = execFileSync('git', ['show', '3113daad1:src/ui/liage.ts'], { cwd: '…/.wt-1768-board', encoding: 'utf8' })
const lignes = t.split('\n')
const i0 = lignes.findIndex(l => l.startsWith('export const SITES_PROSE'))
const i1 = lignes.findIndex((l, i) => i > i0 && l.startsWith(']'))
let n = 0
for (let i = i0; i <= i1; i++) { const l = lignes[i]; if (!/^\s*\{ cle: /.test(l)) continue; n++; if (!/porteur: /.test(l)) console.log('NU  l.' + (i+1) + ' ' + l.trim().slice(0,150)) }
console.log('total entrées', n, 'bornes lignes', i0 + 1, i1 + 1)
```
→ `total entrées 41 bornes lignes 76 135`, et 12 lignes `NU` : `CodexEntry.tsx#Prose.md#2` (l.79), `DescRefField.tsx#Prose.md#1` (l.82), `CityHubScreen.tsx#ActivityPane.desc#5` (l.105), `StakeNote.tsx#Prose.md#1` (l.120), `DialogueHistoryScreen.tsx#Prose.md#1` (l.121), `MerchantPanel.tsx#Prose.md#1` (l.122), `PartyScreen.tsx#DetailFrame.prose#1` (l.123), `CampaignOpeningScreen.tsx#Prose.md#1` (l.126), `CarnetScreen.tsx#Prose.md#1` (l.127), `CarnetScreen.tsx#Prose.md#2` (l.128), `MassBattleView.tsx#Prose.md#1` (l.129), `gallery/registry.tsx#ActivityPane.desc#1` (l.134). Ce n'est pas une dérive post-commit : `git log --oneline 78a385393..3113daad1 -- src/ui/liage.ts` → **vide**, le fichier n'a pas bougé depuis le commit qui l'annonce ; l'écart est dans l'annonce. Second écart de la même phrase : les 4 sites de scène nus sont tagués `RESTE T0` dans le code (l.126-129), le message les appelle « reste **T1** nommé ». → attendu : le compte d'un stock annoncé se lit du stock, et le tag de reste du code répond à celui du message. NON bloquant, mais c'est une annonce chiffrée non rejouée par son auteur dans le commit même qui crée la garde de point fixe.

**Trouvaille 2 — un commentaire de `src/ui/compendium/relations.ts:498` affirme un repli d'appelants qui n'existe plus.** `tokenizeLinks(text, selfLabel?, selfCategory?, selfId?)` (`relations.ts:502`), dont `:505` fait `const resolvedSelfId = selfId ?? (selfLabel ? idByLabelCached().get(selfLabel) : undefined)` et dont le JSDoc `:498` dit « résolu depuis `selfLabel` via `idByLabelCached`, **repli des appelants non encore migrés** ». Contre-grep : `git grep -n "tokenizeLinks(" 3113daad1 -- src` → un SEUL appelant de production, `src/ui/Prose.tsx:50` : `tokenizeLinks(child.value, undefined, selfCategory, selfId)` — il passe `undefined`. Les 23 autres occurrences sont dans `src/ui/compendium/relations.test.ts`. Aucun appelant non migré : le commentaire affirme un fait faux, et le paramètre survit comme repli label→id dans `src/ui` (logique keyée par label, tolérée au seul chargement des données par CLAUDE.md § « Toute LOGIQUE est keyée par id STABLE »). Atténuation : `78a385393` le DÉCLARE dans ses restes (« `selfLabel` mort de `tokenizeLinks` », routé T1 #1392) — le grief porte sur le commentaire qui continue d'affirmer un porteur inexistant. → attendu : le paramètre meurt avec ses tests, ou son commentaire cesse de nommer des appelants qui n'existent pas.

**Trouvaille 3 — une session sur six livre sa substance sans ligne JUGE ni RÉFUTATION au message.** Sur les 23 commits de substance, 18 portent `JUGE` et 17 portent `REFUTATION`. Les 5 manquants sur `JUGE` sont `1b1ac6960`, `ec8a1bb74`, `889084c4a`, `b1a769705` (tous session `01YXgZBG…`/#1739) et `9886aa3e3` (`01Nb8w9G…`, correctif d'un rouge de CI). Contrôle indépendant : `git log abedb5fd4..3113daad1 --grep="juge" -i --format="%h %s"` rend 22 commits et **aucun** des six commits de la session #1739 (`ec8a1bb74`, `889084c4a`, `b1a769705`, `1b1ac6960`, `b321593dd`, `bc902feea`) n'y figure. Or cette session porte un **changement de rupture** : `b1a769705 feat(raw)!: … la lecture d'une extraction Marker devient UNE lib` (26 tests `node:test`, 14 mutations rouges annoncées — chiffré, mais sans juge adverse nommé), et `ec8a1bb74` est le seul commit de substance de la fenêtre sans JUGE **ni** chiffre de suite. → attendu : un `!` de rupture ne se publie pas sans juge nommé au message ; c'est l'usage tenu par les cinq autres sessions de la même fenêtre, la divergence est de régime, pas de goût.

## CI

`gh run list --repo cgauche/game --branch main --limit 30 --json headSha,conclusion,createdAt,name` :

- **1 rouge de CI dans la fenêtre** : `26e715843` — `{"conclusion":"failure","createdAt":"2026-09-14T21:06:29Z","name":"CI"}`. Cause dite par le journal du pre-push : « main rouge par 26e715843 (#1759, test spawnResilient non portable) ». Corrigé DANS la fenêtre par `9886aa3e3 fix(guards): refs #1759 — le test du rejeu au chargement devient portable (main rouge en CI)`, et le push suivant est **vert** : `94547f4f4` → `{"conclusion":"success","createdAt":"2026-09-14T21:48:51Z"}`. La dérogation est JOURNALISÉE à 21:48:46.738Z, motif `rouge`, `shaCause` 26e715843, raison nommant le correctif emporté — le régime est tenu, avec sa trace.
- **1 rouge NON traité, sur la tête même de la fenêtre** : `3113daad1` → `{"conclusion":"failure","createdAt":"2026-09-15T10:37:54Z","name":"Export des issues"}`. `gh run list --workflow "Export des issues" --limit 5` → `failure 2026-09-15 (3113daad1, id 34958974341)`, `failure 2026-09-08 (fd660c8b8)`, puis `success` au 2026-09-01, 2026-08-25, 2026-08-18. **Deux semaines consécutives de rouge sur un workflow planifié de `main`, sans porteur ni ticket cité dans la fenêtre** (re-mesuré et commenté sur #1713 le 2026-09-15 par l'orchestrateur). Le job `CI` de la même tête est vert, donc la porte de contenu tient ; ce qui est rompu, c'est l'export des issues, l'instrument de pilotage. → attendu : un rouge de `main` se porte, même quand ce n'est pas la gate de contenu.
- **Commits sans run propre : 28 sur 40** (`"courses":[]`). C'est le régime de publication en TRAIN (un push de plusieurs commits est jugé par sa TÊTE) : les 11 shas porteurs de run sont exactement les têtes de train, chaque train vert sauf `26e715843` traité ci-dessus. Pas un grief — mais aucun des 23 commits de substance n'est individuellement couvert, la preuve est la tête de son train.
- `auditStock` : 5 entrées au stock, 5 paquets `>= high` observés, « aucun écart au stock daté » — les 5 montées MAJEURES datées du 2026-09-04 routées L3/L4 par #1726. Pas de croissance dans la fenêtre.

## Stocks nominatifs

L'instrument rend `{"refus":[],"notes":[],"commits":40,"plage":"abedb5fd4..3113daad1"}` : **aucune croissance nette d'un stock nominatif sans ligne `CLIQUET:`** sur les 40 commits. Confirmé sur deux cas, dans les deux sens :

1. **Décroissance déclarée et vraie** — `92efc66be` annonce `DES_HORS_PORTE_STOCK` : `hitModifiers.ts` 1 → 0 par SUPPRESSION d'entrée. Mesuré : `git grep -n "hitModifiers" 3113daad1 -- scripts/guards/lib/rollSeamWhitelist.mjs` → 1 ligne, `:197`, l'entrée `src/state/combatFlow.ts` dont le `why` dit `60 -> 59 … -> 58`. Aucune clé `hitModifiers` au stock : tolérance « zéro par absence », pas un plafond d'accueil. La garde côté test refuse dans les deux sens (`src/state/roll-seam-exclusivity-guard.test.ts:1000` « HORS compteur », `:1009` `kindDiff(…).toEqual([])`).
2. **Croissance déclarée avec son `CLIQUET:`** — `889084c4a` touche deux cliquets (`ecrivainsAtteints` +1 module écrivain, `stocks-nominatifs`) ; `CLIQUET=o` sur son message, qui CHIFFRE (`26 tests marker-pages`, `3 tests ecrivainsAtteints`, `eslint vert sur les trois fichiers`) et NOMME la sortie de gate (`node_modules/.cache/gates/test%3Ahooks-29792.txt`). Sur les 23 commits de substance, 9 portent `CLIQUET:` — tous ceux qui bougent un stock d'après l'instrument, et aucune croissance ne survit hors de cette liste.

## Gates annoncées

23 commits de substance, colonne CHIFFRE = présence d'un `N/M`, d'un « N tests », d'un `eslint 0` ou d'un « N échec » dans le message :

- **20/23 CHIFFRENT**. Exemples les plus durs : `16fcd4be5` « Tests `node --test` ops/guards/hooks/test **512/512**, eslint 0, docs:check vert ; **11 mutations** → rouges nommés, remises à l'octet (blake3) » ; `05e545af9` « **test:hooks 949/949** (avant : 947/949) » ; solde #1759 « hooks 935/935, docs 71, raw 379, ops 197, runner 52, agents 24, recette 44 ; toutes/ecrivainsAtteints/testsParGate 41/41 ; eslint 0 ; comment-poison 73/73 ».
- **3 n'annoncent AUCUN chiffre de gate** : `2ecf80608` (fiche mémoire seule, périmètre `.claude/`, acceptable), `57ace0760` (fermeture #1754 : pas de chiffre au message, mais son solde `.claude/soldes/1754.md` chiffre « `npm run test:hooks` rejoué … **898/898** » et la sonde `sonde-hooks-ask.mjs` « 4 `ask` avant → 0 après » — la preuve est au solde, conforme au fond) et **`ec8a1bb74`** (`fix(raw)`, session #1739) : ni JUGE, ni RÉFUTATION, ni chiffre de gate, alors qu'il change une règle de déballage `<sup>` tranchée au PDF et remplace un test par trois. Son message affirme « rougeur vérifiée par mutation » **sans compte ni sortie**. → attendu : une mutation vérifiée se chiffre comme les 20 autres commits de la fenêtre le font.

## Dérive

`node scripts/ops/board.mjs --liste --sans-fetch` (lecture seule) → `[board] 31 lignes · En cours=3 Dormant=7 Ouvert=1 Fusionné=18 Fermé=2 · anomalies 15`. Branches à avance > 0 sur `origin/main` (`rev-list --left-right --count origin/main...<b>`) :

| branche | avance | dernier commit | état du worktree |
|---|---|---|---|
| `chantier/1727-cliquets` | +1 / −17 | 2026-09-15 | propre+hors-main (#1727 En cours) |
| `chantier/1739-crb5e` | +2 / −56 | 2026-09-15 | propre+fusionné (#1739 En cours) |
| `chantier/1768-board` | +1 / −0 | 2026-09-15 | tenu (arbre de ce jugement, #1768 En cours) |
| `worktree-agent-a8c251af80eb67c75` | **+13 / −1092** | **2026-08-05** | propre+hors-main (#1082 Dormant) |
| `chantier/1456-choix` | +1 / −637 | 2026-08-23 | sale (#1456 Dormant) |
| `chantier/mobilier-diligence` | **+70 / −640** | 2026-08-24 | propre+hors-main (#1463 Dormant) |
| `chantier/1501-jets-mer` | **+68 / −640** | 2026-09-01 | propre+hors-main (#1501 Dormant) |
| `ab/notre` | +1 / −195 | 2026-09-07 | propre+hors-main (#1650 Dormant) |
| `ab/phanes` · `ab/phanes-c` | +6 / −195 · +7 / −195 | 2026-09-07 | propre+hors-main (#1700 Dormant) |
| `essai/phaneslight-rejeu` | +9 / −206 | — | propre+hors-main (sans ticket dérivable) |
| `fix/garde-rm-worktree` | +5 / −196 | — | propre+hors-main (sans ticket dérivable) |
| `worktree-agent-ecran` | +1 / −617 | — | propre+hors-main (sans ticket dérivable) |

Les trois branches EN COURS (avance 1 ou 2, du jour) sont dans le régime. La dérive est ailleurs et elle est CUMULÉE, pas imputable à cette fenêtre : **9 branches portent 210 commits jamais fusionnés**, dont `chantier/mobilier-diligence` (+70, dernier commit 2026-08-24, 22 jours) et `chantier/1501-jets-mer` (+68, 14 jours) — le régime « une branche ne se crée que pour du travail risqué et isolable, et fusionne le JOUR MÊME en fast-forward » (CLAUDE.md § Ce qu'est ce projet) est violé à l'échelle du dépôt, et trois de ces branches n'ont plus de ticket dérivable (`essai/phaneslight-rejeu`, `fix/garde-rm-worktree`, `worktree-agent-ecran`). `board.mjs` rend 15 anomalies dont 3 worktrees détachés et 8 branches `worktree-agent-*` sans ticket. → attendu : chaque avance > 0 de plus de 24 h se solde (fusion, abandon nommé, ou ticket porteur) ; l'instrument existe et les NOMME — c'est la reprise qui manque. `main` local remis sur `origin/main` ce jour (`reset --keep`, décision utilisateur) : l'arbre jugé est un worktree lié dont le HEAD est `3113daad1`.

## Non couvert par ce jugement

(a) aucune suite de tests rejouée (`npm test`/`vitest`) — les chiffres de gate des messages sont pris pour vrais SAUF les quatre claims de contenu rejoués par `git grep`/`git show` ; (b) la mesure §1c de `78a385393` (« 1 377 rangées `t:'text'`, 258 portées, 93 liens rendus ») n'est pas rejouée — elle exige de monter le Codex ; (c) les deux fermetures « Fermé » du board (#1751, #1759) n'ont pas été recroisées à l'état GitHub des issues (seul `fermetures-non-citees` les a vues, provenance `gh`) ; (d) aucun contrôle visuel : la recette UI du lot E T0 repose sur les captures citées par son `JUGE-VISION`, non ouvertes.

## Verdict

verdict: PARTIEL

Le socle de traçabilité tient sans réserve : 3 fermetures, 3 soldes dans le commit qui ferme, 0 fermeture hors commit, 0 croissance de stock sans cliquet, 1 seul rouge de CI de contenu dans la fenêtre — journalisé avec sa cause, corrigé dans la fenêtre, suivi d'un vert —, 20 commits de substance sur 23 qui chiffrent leurs gates, et quatre annonces mécaniques rejouées VRAIES à `3113daad1` sur trois sessions distinctes. Cinq griefs instruits, aucun bloquant, tous nommés avec leur sonde : (1) `78a385393` annonce « 30 portés, 11 nus » là où son propre `src/ui/liage.ts:76-135` rend 29/12 et tague `RESTE T0` ce que le message appelle T1 ; (2) `src/ui/compendium/relations.ts:498` affirme un « repli des appelants non encore migrés » alors que `Prose.tsx:50` est le seul appelant de production et qu'il passe `undefined` ; (3) la session #1739 publie 5 commits de substance dont un `feat(raw)!` sans aucune ligne JUGE/RÉFUTATION, seule des six sessions de la fenêtre ; (4) `ec8a1bb74` affirme une « rougeur vérifiée par mutation » sans chiffre ni sortie ; (5) le workflow `Export des issues` est rouge sur la tête de la fenêtre et rouge pour la deuxième semaine consécutive, sans porteur — et la dérive de branches (9 branches, 210 commits non fusionnés, la plus vieille au 2026-08-05) reste la vigilance cumulée à reprendre, l'instrument la nommant déjà à chaque appel. Routage par l'orchestrateur (2026-09-15) : griefs 1 et 2 → commentaire sur #1392 (lot E, propriétaire du stock `SITES_PROSE` et du reste `selfLabel`) ; griefs 3 et 4 → commentaire sur #1739 ; grief 5 → #1713 (déjà re-mesuré le jour même) ; dérive de branches → c'est l'objet du board #1768, stock de nettoyage `npm run ops:worktrees -- --purger` par chaque session porteuse.
