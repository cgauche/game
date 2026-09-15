# Revue de palier — fenêtre abedb5fd4..61ad56a64 — 2026-09-15

verdict: PARTIEL

41 commits, 24 de substance (`-- src scripts`), 3 fermetures — #1751, #1759, #1754 — toutes CLOSED (`gh issue view` : 2026-09-14 23:07:14Z / 21:59:17Z / 19:08:52Z) et toutes emportant leur solde dans le commit qui ferme, plus la revue du palier précédent archivée par `57ace0760`. Les claims structurels du lot de tête `61ad56a64` (non encore sur `origin/main`) tiennent tous à la mesure : `HORS_SAVE` = 4 clés nommées avec leur raison, `loadSaved` rend bien un `RefusOuverture | null` consommé par `editeur.ouvrir`, `src/state/entreeEnScene.ts` n'a AUCUN import (frontière `state ↛ gameIso` respectée par construction), `opera-plan.ts` ne double-compte dans aucune garde de population (les deux gardes importent `scenarioEntities` directement, `CORPUS_SCENES` ne lit que le `.json`), et le débrayage `debugRoofCut` couvre bien les deux seuls sites de résolution du dégagement à allies non vides — les trois autres appelants de `buildRoofs` passent sans vue, donc `clearedSpace(scene, [])`. Les gros claims des trains publiés tiennent aussi : `PLAFOND_HORS_STRATE` mort (0 hit) contre 1176 entrées nominatives, `legacyCounts`/`slackRatchets` morts sans reste, `empty-folios-baseline.json` disparu au profit de deux stocks nominatifs, `test:hooks` passé de 2254 caractères de liste à un lanceur qui découvre par `git ls-files -- scripts`. Ce qui ne tient pas : le message de tête compte 17 docs « dérivés » alors que `docs/recette-navigateur.md` est un doc MANUSCRIT du stock (16 dérivés) ; `03a254eaa` déclare « CAS B fermé par la forme » que le projet lui-même a dû rouvrir (#1763) ; l'instrument `fermetures-non-citees` reste borné par date pour le TROISIÈME palier ; et le corpus VO 5e entré dans la fenêtre (19 fichiers) s'ajoute au binaire Endpaper sans le moindre porteur dans `docs/sources-vf.md`. La fenêtre a mis `main` ROUGE une fois (`26e715843`, CI `failure`), rouge corrigé dans la fenêtre (`9886aa3e3`) et push journalisé en dérogation « tentative/rouge » avec sa raison, tête `94547f4f4` verte. Juge unique (Opus, lecture seule, 2026-09-15), arbre de lecture = worktree `.wt-1478-1644-recette-opera` (HEAD `61ad56a64`, propre) ; toute mesure de contenu par `git show|ls-tree|grep|diff <sha>`.

## Trouvailles confirmées

1. **`61ad56a64` compte un doc MANUSCRIT parmi ses « 17 docs dérivés »** (lentille rejeu-des-affirmations) — le message dit « `docs/recette-navigateur.md` : trois rangées d'outillage … ; 17 docs dérivés régénérés par `docs:build` ». Mesuré : `git show --format="" --name-only 61ad56a64 | Select-String "^docs/"` → **17** chemins, et `docs/recette-navigateur.md` (21 lignes changées, écrites à la main dans ce même commit) est inscrit au stock des docs MANUSCRITS — `scripts/guards/lib/manualDocsStock.mjs` : `'docs/recette-navigateur.md', // recette de validation navigateur (Playwright MCP)`. Les docs dérivés du commit sont donc **16**, pas 17. → attendu : un compte de message se prend sur les objets du commit et ne mélange pas manuscrit et généré (`MANUAL_DOCS_MAX = 8` existe précisément pour distinguer les deux). · NON bloquante, mais c'est la RÉCIDIVE de la classe « chiffre du message non pris sur les objets » (trouvaille 5 du palier du 2026-09-14).

2. **`03a254eaa` (T2) sur-déclare « CAS B fermé par la forme » — le projet a dû rouvrir le cas dans la même journée** (lentilles rejeu-des-affirmations / stocks-et-cliquets) — ligne `CLIQUET:` du commit : « deux fichiers et non un, pour qu'un reclassement `perdues → benignes` soit une croissance NETTE du receveur vue par cette porte (CAS B fermé par la forme) ». Mesuré au ticket porteur : `gh issue view 1727 --comments` → « CAS B COMPENSÉ (un retrait finance une clé neuve, net 0 — **le message de T2 sur-déclarait « fermé par la forme » : il ne l'est que NON compensé**) → #1763 » ; `gh issue view 1763` → **OPEN**, titre « Porte de plage des stocks nominatifs : un RETRAIT finance une entrée NEUVE du même fichier (net 0) — le CAS B compensé reste muet sans CLIQUET ». Le message publié sur `main` affirme donc une fermeture que le dépôt ne tient pas. → attendu : un message de commit ne déclare « fermé par la forme » qu'après la sonde compensée ; le libellé reste faux à demeure sur le tronc (git ne se réécrit pas), seul le ticket le corrige. · NON bloquante (routée, #1763 OPEN).

3. **`fermetures-non-citees` reste borné par une DATE — troisième palier consécutif** (lentille derogations-et-ci / restes-de-la-revue-precedente) — mesuré à la tête : `scripts/ops/fermetures-non-citees.mjs` porte toujours `const iDepuis = args.indexOf('--depuis')`, `…closed:>=${depuis}…` et `git log --since=…` ; aucune option de PLAGE de shas. `scripts/ops/fermetures-non-citees.json` : `"mesureLe": "2026-09-04"`, `"fenetre": "2026-08-20"` — `git log abedb5fd4..61ad56a64 -- scripts/ops/fermetures-non-citees.*` → **aucun commit**. C'était l'attendu n°1 des deux revues précédentes : **N'A PAS BOUGÉ**. (La mesure de la fenêtre reste indirectement couverte : `fermeturesHorsCommit` rend « aucune fermeture non citée dans la fenêtre », mais bornée par `--depuis 2026-09-14`, pas par la plage de shas.) → attendu : inchangé — `--plage <base>..<tête>`. · NON bloquante.

4. **Le corpus VO 5e s'ÉLARGIT sans porteur : 19 fichiers entrent sous `Source/`, zéro ligne dans `docs/sources-vf.md`** (lentilles poison-des-diffs / restes-de-la-revue-precedente) — `bc902feea` pose `Source/Warhammer Fantasy Roleplay 5e Core Rulebook/` (`git ls-tree -r --name-only 61ad56a64` sur ce dossier → **19** entrées) en annonçant « aucune entrée `books.json`, aucun folio, jamais cité ». Mesuré : `git grep -c "5e" 61ad56a64 -- docs/sources-vf.md` → **aucun hit** (exit 1) ; seule mention dans tout `docs/` : `docs/ajouter-un-livre-source.md:137`, qui n'en dit pas le PÉRIMÈTRE mais s'en sert comme exemple de mesure (« Mesuré sur le *WFRP 5e Core Rulebook* : pages PDF 17, 19 et 126 »). Le précédent invoqué, `Source/Winds of Magic`, est LUI documenté (`docs/sources-vf.md:91`, `docs/raw/sources.md:35` — mais comme la VF **VDM**, qui est citable : ce n'est pas le même cas). Et le binaire `Source/WHFRP 5e - […] - Endpaper Map […].jpg` est toujours sans porteur (`git grep -i endpaper 61ad56a64 -- docs scripts src` → aucun hit). La classe nommée au palier précédent **N'A PAS BOUGÉ et s'aggrave d'un facteur 20 en fichiers**. → attendu : une entrée de `docs/sources-vf.md` disant ce que ces pièces SONT et ce qu'elles n'autorisent pas (jamais citées, hors périmètre de règle), ou retrait. · NON bloquante.

5. **Le lot de tête AFFIRME des captures que rien ne versionne — à prouver au commit de solde** (lentille restes-de-la-revue-precedente) — `61ad56a64` porte `JUGE-VISION: première main navigateur sur le port 5179 (**captures foyer et étage de `opera-plan`**, voile tombé, volumes … touchés au rayon `pickTileAt`)` puis « les captures de la recette en joueur … arrivent avec le commit de solde de #1644/#1478 ». Mesuré : `git ls-tree -r --name-only 61ad56a64 -- public/qc` → 11 entrées, **aucune** ne nomme 1478/1644/opera (seules `baseline-affine/*.png` et 4 `.json`) ; aucun `capture:` dans les trois soldes de la fenêtre (`git grep -i capture 61ad56a64 -- .claude/soldes/175*.md` → aucun hit — la classe n'est donc PAS reproduite par un solde de cette fenêtre). Je ne pré-juge pas le solde à venir : je NOMME l'attendu. → attendu : le commit qui ferme #1644/#1478 versionne ses captures sous `public/qc/` (prouvable par `git ls-tree <sha> -- public/qc`) ou son champ de preuve cesse de nommer un artefact inouvrable. · NON bloquante, EN SURSIS.

## Écartées par re-mesure

- ~~`roofCut(false)` ne débraye pas tout : `builders/roofs.ts:1401` résout `clearedSpace` hors de toute garde `debugRoofCut`~~ — écartée : les trois appelants de PRODUCTION de `buildRoofs` (`backends/webgl/sceneMeshes.ts:97` et `:432`, `stage/MondeDeCampagne.tsx:435`, `ui/editor/EditorCanvas.tsx:836`) l'appellent **sans vue**, donc `clearedSpace(scene, view?.allies ?? [], …)` sur un tableau d'alliés VIDE : rien n'y est dégagé. Les deux seuls sites à alliés réels sont bien `MondeDeCampagne.tsx:368` (`cutawayAllies`) et `:461` (`cleared`), tous deux gardés par `debugRoofCut`.
- ~~`src/state/entreeEnScene.ts` traverse la frontière `state ↛ gameIso` (il parle du voile du stage)~~ — écartée : le module ne porte **aucun import** (fichier lu en entier) ; c'est `GameStage3D.tsx` qui importe `signalerEntreeEnScene` — direction autorisée par `src/state/frontiere-state-gameiso.test.ts` (« le rendu se sert du store ; le store ne se sert JAMAIS du rendu »). Le rendez-vous ne peut pas non plus être un `Bridge` : `editeurBridge.ts:7` grave « aucune DONNÉE d'état ne traverse le pont … seules des INTENTIONS », or ici c'est un ÉTAT + des attentes. Architecture à rebours : forme justifiée, en-tête qui dit la raison, démontage borné à son propre `sceneId`.
- ~~`opera-plan` double-compte le mobilier dans les gardes de population~~ — écartée : `git grep "scenarioEntities" 61ad56a64` → les deux gardes (`src/gameIso/catalog/props-volumiques.test.ts:79`, `src/data/prop-foot-migration.test.ts:11`) IMPORTENT le tableau directement, et `CORPUS_SCENES` (`props-volumiques.test.ts:60`) lit `{ exts: ['.json'] }` — un scénario `.ts` lui est invisible. Le clone (`structuredClone`) empêche en plus toute mutation croisée.
- ~~`HORS_SAVE` n'est pas l'ensemble fermé annoncé (4 clés)~~ — écartée : `src/state/saves.ts` porte exactement **4** clés, chacune avec sa raison (`campaignNarratif`, `reveler`, `debugLabels`, `debugRoofCut`) et l'unique boucle de snapshot fait `if (k in HORS_SAVE) continue`. Le défaut préexistant annoncé (`debugLabels` partait en save ET en `netSnapshot`) est bien corrigé dans le même geste.
- ~~Les dix plafonds de dette survivants ne sont toujours routés nulle part (trouvaille 2 du palier précédent)~~ — écartée, **LEVÉ** : `gh issue view 1727 --comments` porte désormais le tri nominatif : « dix plafonds numériques mesurés par un lecteur : six REDONDANTS (`FOLIO_RATCHET_MAX`, `FOLIO_TITLE_RATCHET_MAX`, `MANUAL_DOCS_MAX`, `DETTE_ADOPTION_MAX`, `TUS_MAX`, `PLAFOND_ANCRES_OEIL_ABSENTES`), trois COMPTES NUS (`UNRESOLVED_MAX` 776, `SANS_CITATION_MAX` 3294, `UNDOCUMENTED_ENGINE_EXPORTS_MAX` 301), `PENDING_MAX` … Trains T3a et T3b puis fermeture ». #1727 est OPEN ; les valeurs à la tête sont inchangées (109 / 0 / 776 / 3294 / 1 / 301 / 8 / 346 / 4).
- ~~Un plafond de dette NEUF naît dans la fenêtre~~ — écartée : `git diff abedb5fd4..61ad56a64 -- src scripts | Select-String "^\+.*toBeLessThanOrEqual"` → **aucune ligne**.
- ~~Poison introduit par la fenêtre~~ — écartée : sur **9 285** lignes `+` sous `src`/`scripts`, le motif (excuse, tombale, attente, TODO/FIXME/legacy) rend **5** hits, tous qualifiés : 1 valeur de donnée d'un stock (`ref: 'temporaire | difficultyMax…'`), 1 nom de fichier (`legacyVocabStock.mjs`), 1 commentaire de fixture `// TEMPORAIRE sous os.tmpdir(), supprimé en after.`, 2 corpus du détecteur lui-même. Tests neutralisés (`it.skip`/`describe.skip`/`it.todo`/`xit`) : **0**. Déterminisme : 8 hits `new Date(` dont 6 sont des dates FIXES injectées en test et 2 des défauts de paramètre injectables (`rotationnerLog(chemin, date = new Date())`) ; 0 `Math.random`, 0 `localeCompare`, 0 chemin absolu de machine.

## Tenus

- fermetures-soldes-DoD : les 3 fermetures sont CLOSED et chacune emporte SON solde — `git show --stat 5e191fc2e -- .claude/soldes` → `1759.md` +11 ; `57ace0760` → `1754.md` +11 **et** la revue du palier précédent (+154) ; `c600d03de` → `1751.md` 3+/3− (le fichier avait été posé par `16fcd4be5`, qui ANNONCE dans son sujet « fermeture par le commit de solde qui suit » : le commit de fermeture le RECALE sur le train réellement publié, `d0a0c2693`). Aucune fermeture posée hors commit dans la fenêtre (`fermeturesHorsCommit` : « aucune fermeture non citée », aucun écart à la baseline de 12).
- fermetures-soldes-DoD : les 3 soldes portent `## Restes` ET `## Réfutation` avec verdict (`CONFIRMÉ` ×3), chaque reste étant routé vers un ticket OUVERT (#1750 Lot 3 — OPEN, pour `estArbrePrincipal` défini deux fois et pour l'angle mort `ctx_patch` des hooks `Write|Edit`) ou motivé `-> RAS` avec sa mesure (verrou exercé 13 sondes, `postinstall`/`docs:check:brut` hors périmètre, log rotationné sous `node_modules/.cache/`).
- fermetures-soldes-DoD : les DoD contredites sont DITES — #1751 nomme que `.wt-1751` n'est `propre+fusionné` qu'APRÈS sa publication et que le `--purger` réel reste à la session propriétaire ; #1759 dit que deux lignes > 200 caractères survivent dans `package.json` ; #1754 dit que le canal `ctx_patch` n'est gaté par AUCUN hook.
- rejeu-des-affirmations, trains #1727 : `f1abc97d2` « `PLAFOND_HORS_STRATE` meurt → 1176 entrées nominatives » — `git grep -c PLAFOND_HORS_STRATE 61ad56a64 -- src scripts` → **aucun hit** ; `horsStrateStock.mjs` → **1176** lignes `fichier:`. `c385be32b` « le mécanisme `legacy: N` meurt, sans dette » — `git grep -c legacyCounts` et `slackRatchets` → **aucun hit**. `03a254eaa` (T2) : `empty-folios-baseline.json` **absent** de l'arbre (`git ls-tree` ne rend que `empty-folios-benignes-stock.json`), le stock `perdues` ouvre sur un contrat en clair qui dit la porte et le mode de solde.
- rejeu-des-affirmations, `5e191fc2e` « les tests `scripts/**` se découvrent par répertoire, jamais par liste » : `package.json` à la tête → `"test:hooks": "node scripts/test/node-tests.mjs test:hooks"` contre **2254** caractères de liste à `abedb5fd4` ; la découverte passe par `lireGit(['ls-files', '-z', '--', 'scripts'])` (`scripts/gates/testsParGate.mjs`) — donc l'arbre SUIVI, pas un glob disque.
- rejeu-des-affirmations, `b1a769705` « la lecture d'une extraction Marker devient UNE lib » : `scripts/raw/lib/marker-pages.mjs`, son banc `marker-pages.test.mjs` (**28** occurrences de `test(` pour « 26 tests » annoncés — deux de plus, jamais de moins) et le découpeur `split-wfrp5.mjs` existent tous trois à la tête ; le cliquet correspondant est déclaré (`ecrivainsAtteints +1`, écrivain JETABLE sous `os.tmpdir()`).
- rejeu-des-affirmations, lot de tête : `editeur.ouvrir` passe par la MÊME voie que la modale (`loadSaved`/`loadBuiltin`/`loadScenario`, `Editor.tsx`), `loadSaved` change bien de signature (`function loadSaved(p: SavedProject): RefusOuverture | null`, `return refus` sur la porte de schéma, `return { message: 'document sans aucune scène' }`, `return null` sinon) et `ouvrir` ne rend `✓` que sur `!refus` ; `debugRoofCut: true` par défaut au store, JSDoc qui dit la portée et le perçage local resté actif.
- stocks-et-cliquets : chaque `CLIQUET:` de la fenêtre porte sa mesure et son motif — naissances déclarées (`horsStrateStock +1176`, `empty-folios-perdues +23`, `empty-folios-benignes +28`), entrées d'écrivains toutes motivées par une écriture bornée à `os.tmpdir()` (`ecrivainsAtteints +1/+1/+3/+2/+1`), resserrements mesurés (`set-scan-guard` 751→748 et 302→300, `rollSeamWhitelist −1`), un `±0` explicite (`combatFlow` stock 58 inchangé), et un stock qui DÉCROÎT sans ligne `CLIQUET:` (`legacyVocabStock` 36→35, décroissance = pas de déclaration due).
- derogations-et-ci : le rouge de la fenêtre est TRAITÉ — `26e715843` (chore(docs) du train #1759) porte une course CI `failure`, cause nommée au journal de dérogation (`shaCause` `26e715843`, motif « rouge », « test spawnResilient non portable ») ; le correctif `9886aa3e3` lui est POSTÉRIEUR dans la fenêtre (ordre `git log` : `94547f4f4` > `9886aa3e3` > `26e715843`) et la tête poussée `94547f4f4` porte une course CI **success**. Toutes les autres courses de la fenêtre sont `success` (`3113daad1`, `997aefba8`, `101316e2d`, `4dc8a6870`, `94547f4f4`, `3a5d84d2c`, `d0a0c2693`, `45eafa995`, `9700eafbe`) ; l'unique autre `failure` est le workflow « Export des issues » sur `3113daad1`, hors chaîne de gate. Les shas sans course sont les commits rebasés jamais poussés isolément.
- commits-triviaux et régime : les `chore(docs)` ne portent QUE des chemins `docs/` (vérifié sur `3113daad1` 10 fichiers, `94547f4f4` 1, `26e715843` 1) ; un seul auteur git (`a`) sur les 41 commits ; `chainage: vérifié` ; **18** des 24 commits de substance portent `REFUTATION:` dans leur corps.
- auditStock : 5 entrées JAUNE, toutes datées du 2026-09-04 et toutes portées par #1726 (montée MAJEURE de la chaîne d'outillage), « aucun écart au stock daté » ; aucune advisory neuve sans porteur.
- restes-de-la-revue-precedente, bilan : (1) bornage `fermetures-non-citees` → **N'A PAS BOUGÉ** (trouvaille 3) ; (2) captures citées absentes de git → **classe NON reproduite par les soldes de la fenêtre**, mais **EN SURSIS** sur le lot de tête (trouvaille 5) ; (3) dix plafonds non triés → **LEVÉ** (routés nominativement sur #1727 OPEN, avec trains T3a/T3b) ; (4) binaire VO 5e sans porteur → **N'A PAS BOUGÉ et s'aggrave** (trouvaille 4) ; (5) chiffre de message non pris sur les objets → **RÉCIDIVE** (trouvaille 1).
- NON MESURÉ — le rejeu des suites revendiquées par les messages (`typecheck` full, vitest du périmètre, `test:hooks` 945/945, `npm run gen` idempotent, `docs:check`) : tout runner est interdit par la consigne (recette navigateur en cours sur la machine) ; la CI verte des shas poussés en tient lieu, et le lot de tête n'a par construction aucune course (non publié).
- NON MESURÉ — la re-mesure VIVANTE des advisories (`npm audit`) : arbre installé + réseau requis ; jugée par l'immobilité du stock daté.
- NON MESURÉ — la recette navigateur du lot de tête (voile tombé à 5743 ms, `pickTileAt` sur trois volumes, console 0 erreur) : rien dans git ne la prouve — c'est exactement la classe de la trouvaille 5.
- MUTATIONS SUR DISQUE : aucune. Aucune commande git écrivante (0 `add/commit/checkout/restore/reset/stash/clean/fetch/pull`), aucun runner de suite, `gh` en lecture seule (`issue view`) ; les fichiers intermédiaires vivent hors de l'arbre, sous le scratchpad de session.

Suite donnée par l'orchestratrice (2026-09-15, même train) : la trouvaille 5 est LEVÉE par le commit de solde qui archive cette revue — les captures des soldes #1478/#1644 entrent VERSIONNÉES sous `public/qc/soldes/` (exception `.gitignore` neuve), et la porte `verifierCapture` refuse désormais toute capture ignorée par git (test `solde-ticket-guard.test.mjs`) : la classe « capture citée, capture absente de git » des deux paliers précédents se ferme par une GARDE, pas par une purge. Les trouvailles 1 (compte 17 → 16, message déjà commité : consigné ici, git ne se réécrit pas), 2 (#1763 OPEN), 3 et 4 restent aux porteurs nommés.

---

```
SONDES

# S0 — épinglage de l'arbre
git rev-parse --show-toplevel        -> C:/Users/gauch/PhpstormProjects/Foundry/Game/.wt-1478-1644-recette-opera
git rev-parse HEAD                   -> 61ad56a64ced4deabd8cb9fa72845118df00e653
git status --porcelain               -> (vide)
git rev-list --count abedb5fd4..61ad56a64                  -> 41
git rev-list --count abedb5fd4..61ad56a64 -- src scripts    -> 24

# S1 — fermetures, soldes emportés, états
git diff --name-status abedb5fd4..61ad56a64 -- .claude/soldes
-> A .claude/soldes/1751.md  A .claude/soldes/1754.md  A .claude/soldes/1759.md
-> A .claude/soldes/revue-palier-2026-09-14-9e15cba42-abedb5fd4.md
git show --stat c600d03de -- .claude/soldes   -> 1751.md | 6 +++--- (3 ins / 3 del)
git show --stat 5e191fc2e -- .claude/soldes   -> 1759.md | 11 ++++++++++
git show --stat 57ace0760 -- .claude/soldes   -> 1754.md | 11 ++ ; revue-palier-2026-09-14-…md | 154 ++++
git log --oneline --diff-filter=A abedb5fd4..61ad56a64 -- .claude/soldes/1751.md
-> 16fcd4be5 feat(ops)!: refs #1751 — (fermeture par le commit de solde qui suit, …)
gh issue view 1751|1759|1754 --json state,closedAt
-> CLOSED 2026-09-14T23:07:14Z / CLOSED 21:59:17Z / CLOSED 19:08:52Z
gh issue view 1750|1727|1763|1762|1384|1644|1478 --json state -> OPEN ×7

# S2 (trouvaille 1) — « 17 docs dérivés »
git show --format="" --name-only 61ad56a64 | Select-String "^docs/" | Measure-Object -Line -> 17
git show 61ad56a64:scripts/guards/lib/manualDocsStock.mjs | Select-String "recette-navigateur"
->   'docs/recette-navigateur.md', // recette de validation navigateur (Playwright MCP)
(stat du commit : docs/recette-navigateur.md | 21 ++++++- — édité à la main dans le même commit)

# S3 (trouvaille 2) — « CAS B fermé par la forme »
git log --format="%b" abedb5fd4..61ad56a64 | Select-String "CLIQUET:"  (extrait 03a254eaa)
-> « … (CAS B fermé par la forme) »
gh issue view 1727 --comments | Select-String "CAS B"
-> « CAS B COMPENSÉ (…) — le message de T2 sur-déclarait « fermé par la forme » : il ne l'est que NON compensé → #1763 »
gh issue view 1763 --json state,title -> OPEN, « … le CAS B compensé reste muet sans CLIQUET »

# S4 (trouvaille 3) — bornage de fermetures-non-citees
git show 61ad56a64:scripts/ops/fermetures-non-citees.mjs | Select-String "--depuis|since=|closed:>="
-> `search/issues?q=…closed:>=${depuis}&per_page=100` · git(['log', `--since=${reculeDe(depuis, …)}`]) · args.indexOf('--depuis')
git show 61ad56a64:scripts/ops/fermetures-non-citees.json -> "mesureLe": "2026-09-04", "fenetre": "2026-08-20"
git log --oneline abedb5fd4..61ad56a64 -- scripts/ops/fermetures-non-citees.mjs …json -> (aucune sortie)

# S5 (trouvaille 4) — corpus VO 5e sans porteur
git ls-tree -r --name-only 61ad56a64 -- "Source/Warhammer Fantasy Roleplay 5e Core Rulebook" | Measure-Object -Line -> 19
git grep -c "5e" 61ad56a64 -- docs/sources-vf.md            -> (aucun hit, exit 1)
git grep -n -i "Roleplay 5e" 61ad56a64 -- docs               -> docs/ajouter-un-livre-source.md:137 (exemple de mesure)
git grep -n -i "endpaper" 61ad56a64 -- docs scripts src      -> (aucune sortie)
git ls-tree -r --name-only 61ad56a64 -- "Source/" | Select-String "\.jpg|\.png"
-> Source/WHFRP 5e - […] - Endpaper Map [OEF][2026-09-01].jpg · Source/salzenmund-4-zones-off.png

# S6 (trouvaille 5) — captures
git ls-tree -r --name-only 61ad56a64 -- public/qc
-> baseline-affine/README.md, diligence-degagement.png, diligence.png, env-arene-hub.png,
   env-siege-explore.png, env-test-opera-theatre.png, env-test-piege-caveau.png,
   defects.json, hairstyles-raw.json, head-colormap.json, tenue-colormap.json   (aucune 1478/1644/opera-plan)
git grep -i "capture" 61ad56a64 -- .claude/soldes/1751.md .claude/soldes/1754.md .claude/soldes/1759.md -> (aucune sortie)

# S7 (écartées) — claims du lot de tête
git show 61ad56a64:src/state/saves.ts | Select-String "HORS_SAVE" -Context 2,14
-> const HORS_SAVE: Record<string,string> = { campaignNarratif, reveler, debugLabels, debugRoofCut }  (4)
-> if (k in HORS_SAVE) continue; // exclusions NOMMÉES, avec leur raison
git grep -n "clearedSpace|cutawayAllies|debugRoofCut" 61ad56a64 -- src  (hors tests)
-> MondeDeCampagne.tsx:128 useGame((s)=>s.debugRoofCut) · :368 cutawayAllies = debugRoofCut ? … : undefined
-> :461 cleared = (scene && !pov && debugRoofCut ? clearedSpace(…) : NO_CLEARED_SPACE)
-> builders/roofs.ts:1401 context: (scene, view) => clearedSpace(scene, view?.allies ?? [], view?.sight)
git grep -n "buildRoofs(" 61ad56a64 -- src   (hors tests)
-> sceneMeshes.ts:97 buildRoofs(scene) · sceneMeshes.ts:432 buildRoofs(scene) · MondeDeCampagne.tsx:435 buildRoofs(scene)
   · EditorCanvas.tsx:836 buildRoofs(scene)      => aucun n'a de `view` : allies = []
git show 61ad56a64:src/state/entreeEnScene.ts   -> 0 import (fichier lu en entier)
git grep -n "scenarioEntities" 61ad56a64 -- src scripts
-> qc/opera-furniture-check.mts:8 · data/prop-foot-migration.test.ts:11 · catalog/props-volumiques.test.ts:3
   · scenes/test-scenarios/opera-plan.ts:3 (structuredClone)
git grep -n "CORPUS_SCENES" 61ad56a64 -> props-volumiques.test.ts:60  readCorpus(['src/scenes'], { exts: ['.json'] })

# S8 (écartées) — stocks et plafonds
git grep -c "PLAFOND_HORS_STRATE" 61ad56a64 -- src scripts   -> (aucun hit, exit 1)
git grep -c "legacyCounts" 61ad56a64 -- src scripts           -> (aucun hit, exit 1)
git show 61ad56a64:scripts/guards/lib/horsStrateStock.mjs | Select-String "fichier:" | Measure-Object -Line -> 1176
git ls-tree 61ad56a64 -- scripts/raw/empty-folios-baseline.json scripts/raw/empty-folios-benignes-stock.json
-> seul empty-folios-benignes-stock.json existe (baseline supprimée)
git grep -nE "^const (FOLIO_RATCHET_MAX|…|TUS_MAX) ?=" 61ad56a64 -- src
-> 109 / 0 / 776 / 3294 / 1 / 301 / 8 / 346 / 4   (inchangés)
git diff abedb5fd4..61ad56a64 -- src scripts | Select-String "^\+.*toBeLessThanOrEqual" -> (aucune ligne)

# S9 — poison, déterminisme
git diff abedb5fd4..61ad56a64 -- src scripts | Select-String "^\+" | Count -> 9285
… motif (en attendant|pour l'instant|provisoire|temporaire|à terme|déplacé vers|autrefois|
   jusqu'à ce que|TODO|FIXME|legacy) -> 5 (donnée de stock, nom de fichier, fixture tmpdir, 2 corpus du détecteur)
… motif (\bit\.skip\(|describe\.skip\(|it\.todo\(|\bxit\() -> 0
… motif (Math\.random|new Date\(|localeCompare|C:\\|/Users/) -> 8 : 6 dates FIXES de test,
   2 défauts injectables `date = new Date()` ; 0 Math.random, 0 localeCompare, 0 chemin de machine

# S10 — régime, CI, dérogation
git log --format="%an" abedb5fd4..61ad56a64 | Sort-Object -Unique -> a
git show --format="" --name-only 3113daad1|94547f4f4|26e715843 -> uniquement des chemins docs/
git rev-list --count abedb5fd4..61ad56a64 --grep="REFUTATION:" -- src scripts -> 18 (sur 24)
faits-palier.json › coursesCi
-> 26e715843 : CI failure ; 94547f4f4 : CI success ; 3113daad1 : CI success (+ « Export des issues » failure)
-> 997aefba8, 101316e2d, 4dc8a6870, 3a5d84d2c, d0a0c2693, 45eafa995, 9700eafbe : CI success
faits-palier.json › derogations.dansLaFenetre
-> { etat: "tentative", motif: "rouge", sha: 94547f4f4, shaCause: 26e715843,
     raison: "main rouge par 26e715843 (#1759, test spawnResilient non portable) : ce train porte le
              correctif 9886aa3e3, gates vertes avant push" }
git log --format="%h" abedb5fd4..61ad56a64 (ordre) -> … 94547f4f4 > 9886aa3e3 > 26e715843 > 355ef4bdd > 5e191fc2e
faits-palier.json › stocks -> refus: [], notes: []   · fermeturesHorsCommit -> « aucune fermeture non citée »
faits-palier.json › auditStock -> 5 JAUNE datées 2026-09-04, « aucun écart au stock daté »

# S11 — découverte par répertoire (#1759)
git show abedb5fd4:package.json | Select-String "test:hooks" -> longueur de ligne 2254
git show 61ad56a64:package.json | Select-String "test:hooks" -> "test:hooks": "node scripts/test/node-tests.mjs test:hooks",
git show 61ad56a64:scripts/gates/testsParGate.mjs | Select-String "ls-files"
-> const vu = lireGit(['ls-files', '-z', '--', 'scripts'], { cwd: racine })
```
