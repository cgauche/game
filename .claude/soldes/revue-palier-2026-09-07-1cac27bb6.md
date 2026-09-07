# Revue adversariale de PALIER — 10 commits de substance, 1 fermeture, 4 sessions, 2026-09-07

verdict: PARTIEL — le palier a soldé UNE des onze trouvailles du n°6 (les 5 `seg` d'écrans joueur sont vraiment migrés, `REFUS_MUET_EXEMPT_SITES` 13 → 7) et amélioré la couverture CI (6/10 → 3/10 commits de substance sans check-run, 9 runs verts, 0 dérogation, fermeture unique par `github-actions[bot]` après publication, `validateSolde` vert sur le solde neuf, typecheck FULL exit 0, `docs:check` exit 0, `gen` idempotent, 109 + 16 + 71 tests verts sur les bancs ciblés, et les six claims de train re-mesurés TIENNENT) — mais les quatre CAUSES du n°6 sont intactes à l'octet, et l'une d'elles est passée de DORMANTE à EXERCÉE : l'unique solde de la fenêtre route trois restes vers #1689 en écrivant « -> inventaire #1689 », que `ROUTANT_RE` ne voit pas (0 routant compté, 1 dès qu'on retire le mot) ; s'y ajoutent un angle mort NEUF du cliquet (xix) — un refus muet réel survit sur le menu système par COMPOSITION (`GameMenu.tsx:73,76`) — la revue n°6 elle-même archivée sous l'ancien nom à deux segments (la collision que `f1b48ef7b` prétendait fermer reste atteignable), et l'arbre principal qui décroche de 73 à 84 commits avec un premier débris hors mémoire.

Fenêtre : 1cac27bb6..6382c792d

**Arbre ÉPINGLÉ** : worktree `.wt-1624`, `git rev-parse HEAD` = `6382c792d26772984a6670592d7d4e46f33c45e6` = `origin/main`. `git status --porcelain` = **66 chemins**, dont `A .claude/soldes/1691.md` — c'est le **lot 2 de #1691, STAGÉ et non committé** : **hors fenêtre, non jugé**, mais présent sous toutes les mesures d'outillage (arbre SALE à chaque ligne).
Contrôles POSITIFS du travail jugé : `scripts/guards/lib/sourceCorpus.mjs`, `sourceCorpus.test.mjs`, `sourceCorpus.d.mts`, `depotGabarit.mjs`, `depotGabarit.test.mjs` **existent** ; 22 fichiers de `src/**` importent `readCorpus` (10 gagnés dans `6382c792d`) ; `registry.ts:236` porte `if (d.maison !== undefined) base.maison = d.maison` ; `registry.ts:2051` porte la catégorie `terrains` ; `structures.json` a perdu les deux recopies de livre ; `ui-ratchets.test.ts:1461-1469` ne porte plus que **7** exemptions.
Cardinaux : **12 commits** au total, **10 de substance** (`git rev-list --count 1cac27bb6..HEAD -- src scripts` → `10`). Le « 11 » du garde est correct et se dérive : `commitsDeSubstanceDepuis` (`scripts/guards/lib/revuePalier.mjs:166-172`) ajoute **+1 pour l'index stagé** — 10 publiés + le lot 2 en attente. **4 sessions** distinctes (`Claude-Session:` uniques).

## Ce qui a TENU sous attaque (à ne pas rouvrir)

**A. Trouvaille 5 du n°6 : SOLDÉE.** `2998720aa` (#1388 C4) a migré les cinq `seg` d'écrans joueur. `REFUS_MUET_EXEMPT_SITES` = **7** entrées, toutes des primitives (`GatedAction:151`, `OptionChooser:104`, `RollShell:299`, `MenuCard:130`, `MediaSelect:59`, `QtyStepper:36,40`). `git grep disabled` sur `CastModal.tsx`/`ShantyModal.tsx`/`useDefenseJetProps.tsx` ne rend plus qu'un `disabled: true` de flux (`CastModal.tsx:223`), aucun `title` muet. Réserve : trouvaille 5 ci-dessous (le canal de COMPOSITION).

**B. Fermeture et solde.** Unique fermeture : **#1690**, `closed_at 2026-09-07T12:24:19Z`, événement `closed` par **`github-actions[bot]`**, `commit_id = null` — donc par publication. Son solde `1690.md` (emporté par `a82e1f6c2`) passe `validateSolde` : `ok = true, problems = []`.

**C. CI.** `gh run list --branch main --limit 30` : **9 runs `push` dans la fenêtre, 9 `success`, 0 `failure`** (l'unique rouge, `33993232711`, est du 2026-09-05, hors fenêtre). `.git/wfrp-justificatifs/derogations.log` : dernière entrée `2026-09-06T05:56:41Z` — **aucune dérogation dans la fenêtre**.

**D. Porte de stock de plage : verte.** `croissancesDeLaPlage({avant:'1cac27bb6', apres:'6382c792d'})` → `{ refus: [], notes: [], commits: 12 }`. **28** lignes `CLIQUET:` déclarées, chacune motivée.

**E. Les six claims re-mesurés TIENNENT.**
- `4c07daf16` (#1709 A) — « la fraîcheur des deux docs est tenue par docs:check » : `scripts/docs/build-all.mjs:58` et `:75` déclarent bien `docs/orphelines-donnees.md` et `docs/consommateurs-de-champs.md`, et `package.json:34` fait jouer `build-all.mjs --check` dans `docs:check` (gate `ci.yml:64`, empreinte `:67`). Doublon RÉEL, transfert et non perte.
- `429d96cc3` (#1709 B1) — « un seul `git init` reste dans `scripts/**/*.test.mjs` » : `git grep -n "'init'" -- 'scripts/**/*.test.mjs'` rend **exactement une ligne**, `scripts/hooks/solde-ticket-guard-driver.test.mjs:39`, comme annoncé.
- `41ed2c93a` (#1709 C1) — mémo par clé : mesuré `readCorpus(['src'])` **436 ms → 0 ms**, `a === b` **true**, `a[0] === b[0]` **true**, `Object.isFrozen` **true/true**, clé distincte → tableau distinct, `'src/'` ≡ `'src'`.
- `6382c792d` (#1709 C2) — « DIX gardes de `src/**` » : le commit touche **exactement 10** fichiers `src/**/*.test.ts`. Sa prémisse « aucun test n'écrit sous `src/` » tient : les 17 écritures suspectes visent toutes une racine `mkdtemp` (`dir`/`copie`/`dossier`), aucune l'arbre réel.
- `a82e1f6c2` (#1690 lot 3) — « `maison` projeté par `depuisEnveloppe` » CONFIRMÉ (`registry.ts:228-237`) et rendu une fois (`CodexEntry.tsx:185-190`) ; « 0 site de `DEFS` » CONFIRMÉ (plus aucun import de `DEFS` depuis `src/gameIso/sprites` ; `defsGlobaux()` partout, `sceneMeshes.ts:819,1298`, 56 scripts `_qc-*.mts` migrés) ; « terrains éditables » CONFIRMÉ au câblage (`overrides.ts:171`, `registry.ts:2051`).
- `6785acbb0` (#1680) — les deux `maison` de `structures.json` ne portent **plus aucune prose de livre** : décision + réfs nues `AA 10 l.65` / `AA 10 l.70` seulement. 179 `maison` au total dans `src/data/*.json`.

**F. Outillage (arbre SALE, 66 chemins).** `spawnSync('npm', ['run','typecheck'])` → **EXIT = 0** (« [gate] typecheck VERTE sur 6382c79, arbre SALE : 43 chemin(s) au périmètre »). `spawnSync('npm', ['run','docs:check'])` → **EXIT = 0**. `npm run gen` ×2 → **EXIT 0 / 0**, `4132 ids / 81 datasets [inchangé]`, `git status --porcelain` **strictement identique aux trois relevés** (66/66/66). Bancs : vitest sur 7 fichiers (`scene-mutation-guard`, `pregen-by-label-guard`, `rule-refs`, `name-field-guard`, `registry-id-branch-guard`, `ui-ratchets`, `prose-resolution`) → **109/109 verts, exit 0** ; `node --test sourceCorpus.test.mjs depotGabarit.test.mjs` → **16/16, exit 0** ; `src/comment-poison-guard.test.ts` → **71/71, exit 0**.

**G. Poison NEUF : aucun.** 6 188 lignes de commentaire ajoutées sur `src`/`scripts` dans la fenêtre, filtrées sur ~20 locutions des familles (b) et (c) : **1 candidat**, relu et écarté — `src/data/prose-resolution.test.ts:174` « aucun fichier temporaire, aucun `Source/` touché » énonce le DESIGN de la fixture. Faux positif. Le garde du dépôt confirme (71/71).

## Trouvailles

**1. BLOQUANT — trouvaille 2 du n°6 n'est plus dormante : elle est EXERCÉE par l'unique solde de la fenêtre.** `ROUTANT_RE` est inchangé à l'octet (`scripts/hooks/solde-ticket-guard.mjs:676`, lu en `:762`/`:855`). Le solde `#1690` route **trois** restes vers l'épique #1689 (`1690.md:9`, `:10`, `:11`) en écrivant `-> inventaire #1689 : …` — la flèche n'est pas suivie d'un `#`, donc `restesRoutants('1690.md')` rend **0**, sur 8 items. Contre-épreuve décisive : retirer le seul mot « inventaire » d'UNE ligne fait passer le compte à **1**. Le plafond de fan-out ne mesure donc pas ce qu'il prétend ; le solde reste conforme (`ok=true`) alors qu'il route trois charges. La conduite (router vers un épique préexistant) est légitime ; la MÉTRIQUE est réfutée.

**2. BLOQUANT — la porte de solde n'est toujours pas un hook git, et le taux de refus du corpus ne bouge pas : 35 des 65 soldes committés (54 %) sont REFUSÉS par le garde qui prétend les garder.** `git grep solde-ticket-guard -- scripts/git-hooks/ .github/` → **exit 1, 0 résultat**. `validateSolde` rejoué sur les 65 soldes de `6382c792d` : **30 ok / 35 refusés** (29/35 au palier n°6 — le seul mouvement est le solde neuf, conforme). La CAUSE nommée aux paliers n°5 et n°6 (juger la PLAGE POUSSÉE, jamais le corpus) n'a pas été exécutée.

**3. BLOQUANT — le faux +1 de la porte de stock est intact, et il a été PAYÉ une SECONDE fois dans la fenêtre.** `croissanceDesStocks` sur une entrée SIMPLIFIÉE (1 ligne retirée / 1 ajoutée, cardinal inchangé) rend toujours `[{"fichier":"src/data/field-consumers.test.ts","ajoutees":1,"retirees":0,"net":1}]`. Et `6382c792d` porte `CLIQUET: src/ui/codex-inline-refs-guard.test.ts +1 — aucun stock ne grandit : le détecteur de plage classe par FORME la ligne … (divergence des deux détecteurs, lot D)`. Deuxième cliquet consécutif payé pour un défaut connu du détecteur : la taxe est récurrente, pas ponctuelle.

**4. BLOQUANT — la tombale de `src/ui/CascadeTableMode.test.tsx:150` est toujours là, et le motif est aveugle à TROIS sites, pas un.** `tombstonesIn` rend `[]` sur la ligne réelle, alors que le témoin positif rend `["n'est / ne vit plus ici (site quitté)"]`. Même cécité mesurée sur `src/state/roomPortals.test.ts:392` (« son coût ne vit plus dans le pas ») et `src/ui/VoyageScreen.tsx:315` (« le bilan ne vit plus dans le … ») — hors fenêtre, mais même cause : `NO_MORE_HERE_RX` (`scripts/guards/lib/commentPoison.mjs:296-299`) exige le mot littéral `ici` et laisse passer « ne vit plus **dans** X ». Famille (c), tolérance ZÉRO.

**5. NEUF — le cliquet (xix) affirme « aucun écran joueur ne porte de refus muet » alors qu'un refus muet réel atteint le menu système par COMPOSITION.** `src/ui/GameMenu.tsx:73` et `:76` écrivent `<MenuButton disabled={!onSaveLoad} … title={onSaveLoad ? undefined : 'Indisponible en combat'}>` ; `MenuCard.tsx:130` rend `<button type="button" … title={title} disabled={disabled}>`. Le DOM reçoit donc un vrai `disabled` (hors ordre de tabulation, aucun événement de pointeur) portant sa raison dans un `title` natif — exactement ce que l'arbitrage utilisateur du 2026-08-24 et la table des primitives du CLAUDE.md interdisent (« jamais `disabled` : il doit rester atteignable clavier/manette/tap »). Le test reste vert pour deux raisons cumulées : (a) `scanRefusMuet` ne scanne que des balises `<button>` LITTÉRALES, jamais la composition ; (b) `MenuCard.tsx:130`, `QtyStepper.tsx:36,40` et `MediaSelect.tsx:59` sont exemptés au motif « modèle de props » — or ce sont des **sites de RENDU JSX**, pas des déclarations de type ; la raison écrite dans l'exemption est fausse pour ces quatre lignes. Sonde : **2** sites joueur passent `disabled` ET `title` à un composant, tous deux dans `GameMenu.tsx`. Le message de `2998720aa` nomme un autre angle mort (`disabled` SANS `title`, `TavernGameModal`, renvoyé à #1698) — celui-ci, non.

**6. NEUF — le nom d'archive à trois segments n'est pas appliqué, et la collision qu'il devait fermer reste atteignable.** La revue n°6, committée DANS la fenêtre, porte `.claude/soldes/revue-palier-2026-09-07-714df53da.md`, alors que `nomDArchiveDeRevue` exige `revue-palier-2026-09-07-714df53da-1cac27bb6.md` ; `nomsDArchiveAcceptes` tolère l'ancienne forme, donc le garde ne mord pas. La cause est la trouvaille 9 du n°6, intacte : le message que l'agent LIT dit `revue-palier-<date>-<base>.md` (`solde-ticket-guard.mjs:1103`) et construit `revue-palier-${today}-${palier.tete}.md` (`:1133`) — deux segments — tandis que `revuePalier.mjs:57,71` en produit trois. Conséquence mesurée : deux sessions jugeant le même jour la même base produiraient à nouveau le MÊME chemin, le conflit AA au rebase que `f1b48ef7b` prétendait fermer. (Cette revue n°7 est archivée sous le nom à DEUX segments que le garde de commit EXIGE — `solde-ticket-guard.mjs:1103,1133` refuse le nom à trois segments de `revuePalier.mjs:57`, preuve vivante de la divergence des deux textes.)

**7. 3 des 10 commits de substance (30 %) n'ont AUCUN check-run — progrès réel, mais le commit qui FERME le ticket en fait partie.** `gh api repos/cgauche/game/commits/<sha>/check-runs` sur les 12 : **0** pour `6785acbb0`, `6c526c220` et `a82e1f6c2` ; 3 (ou 4) pour les neuf autres. `a82e1f6c2` est le commit `corrige #1690` qui emporte le solde : le seul commit fermeur de la fenêtre est aussi l'un des trois qu'aucune course n'a jugés individuellement (la fermeture, elle, a bien attendu un `build` vert sur `main`). Progression 79 % → 60 % → 30 % sur trois paliers.

**8. Le détecteur de fermetures sans solde reste aveugle (6ᵉ palier) et son stock n'a pas bougé.** Appels à l'API GitHub dans `scripts/hooks/fermetures-sans-solde.test.mjs` : **0** — il ne voit que les fermetures passées par un commit, jamais celles du bot. Cardinal de `STOCK` : **118 à 1cac27bb6, 118 à 6382c792d** (fichier inchangé à l'octet dans la fenêtre). Atténuation honnête : l'unique fermeture de la fenêtre était conforme, la cécité n'a rien laissé filer cette fois.

**9. `test:hooks` porte toujours le test FLAKY du n°5/n°6.** `scripts/gates/toutes.test.mjs` a été touché dans la fenêtre — mais seulement pour composer `instanceDeDepot` (diff de 8 lignes, `depotDeGates`). Le `readFileSync(temoin, 'utf8')` sans attente préalable de l'existence du fichier est **inchangé à l'octet** (`:134`, plafond 1500 ms, témoin écrit toutes les 200 ms). Non rejoué (brief) : identité du code de la prémisse constatée.

**10. L'arbre PRINCIPAL décroche encore plus vite — 84 commits — et il porte désormais un débris hors mémoire.** `git rev-parse --short HEAD` = `599979762`, `git rev-list --count HEAD..origin/main` = **84** (73 au n°6, 51 au n°5, 38 au n°4). `git worktree list` = **25** (23 au n°6). `git status --porcelain` = 37 chemins, dont **un seul hors `.claude/memory/` : `?? .recette-q5/`** — un dossier de captures de recette laissé dans l'arbre partagé (`codex-form-360.png`, 75 507 octets, 2026-09-07 02:06), ni gitignoré ni nettoyé par la session #1388 C4. Le n°6 créditait « zéro débris » ; ce n'est plus vrai.

**11. Le cardinal « 73 → 72 walkers » de `6382c792d` n'est pas reproductible tel qu'écrit** — sa définition n'est pas publiée. Sous « fichier de test de `src/**` contenant `readdirSync`/`globSync` » la mesure donne **129** ; sous « argument littéral `src`/`scripts` » **7 à `1cac27bb6` → 6 à HEAD**. Le SENS du message tient (la liste décroît d'exactement 1 malgré 10 sites migrés, ce que le commit dit lui-même honnêtement), mais le chiffre est invérifiable sans la sonde qui l'a produit — motif « joins ta sonde » du régime.

## Sorties brutes

| # | commande | exit | résultat retenu |
|---|---|---|---|
| 1 | `git rev-parse HEAD` ; `git status --porcelain` | 0 | `6382c792d…` = `origin/main` ; **66** chemins (lot 2 de #1691, stagé, hors fenêtre) |
| 2 | `git rev-list --count 1cac27bb6..HEAD [-- src scripts]` | 0 | **12** total, **10** de substance (le « 11 » du garde = +1 index stagé) |
| 3 | `node valide.mjs` (`validateSolde` × 65 soldes de HEAD) | 0 | **30 ok / 35 refusés** ; `1690.md` **ok** |
| 4 | `node fanout2.mjs` (`restesRoutants` sur `1690.md`) | 0 | **0** routant sur 8 items ; **1** après retrait du mot « inventaire » |
| 5 | `git grep solde-ticket-guard -- scripts/git-hooks/ .github/` | 1 | **0** — toujours pas de hook git |
| 6 | `node reste.mjs` (`croissanceDesStocks` simplification) | 0 | **net:+1** — faux positif intact |
| 7 | `node tomb2.mjs` (`tombstonesIn`) | 0 | 3 lignes réelles → `[]` ; témoin → `["…ne vit plus ici…"]` |
| 8 | `node compo.mjs` (disabled+title passés à un COMPOSANT, hors atelier) | 0 | **2** : `GameMenu.tsx:73`, `:76` |
| 9 | `node nom.mjs` (`nomDArchiveDeRevue` sur la revue n°6) | 0 | exigé `…-714df53da-1cac27bb6.md` ; porté `…-714df53da.md` (toléré) |
| 10 | `gh run list --branch main --limit 30` | 0 | **9 runs dans la fenêtre, 9 success, 0 failure** |
| 11 | `gh api …/commits/<sha>/check-runs` × 12 | 0 | substance : **3 à 0**, 7 à ≥3 |
| 12 | `gh api search/issues closed:>=2026-09-06T18:00Z` + timeline | 0 | **1** fermeture : #1690, `github-actions[bot]`, `commit_id=null` |
| 13 | `cat .git/wfrp-justificatifs/derogations.log` | 0 | **0** entrée dans la fenêtre |
| 14 | `node plage.mjs` (`croissancesDeLaPlage`) | 0 | `refus: []`, `notes: []`, 12 commits |
| 15 | `spawnSync npm run typecheck` (arbre SALE) | **0** | « VERTE sur 6382c79, arbre SALE : 43 chemins » |
| 16 | `spawnSync npm run docs:check` (arbre SALE) | **0** | vert |
| 17 | `npm run gen` ×2 + `git status` ×3 | 0/0 | `4132 ids / 81 datasets [inchangé]` ; status **identique** aux 3 relevés |
| 18 | `npx vitest run` (7 gardes) ; `node --test` (2 libs) ; poison | 0/0/0 | **109** / **16** / **71** tests verts |
| 19 | `node c1c2.mjs` (`readCorpus`) | 0 | 436 ms → **0 ms**, identité + gel + normalisation vrais |
| 20 | `git grep "'init'" -- 'scripts/**/*.test.mjs'` | 0 | **1** seul, `solde-ticket-guard-driver.test.mjs:39` |
| 21 | arbre principal : `rev-list --count HEAD..origin/main` ; `status` ; `worktree list` | 0 | **84** de retard ; 37 sales dont **`?? .recette-q5/`** hors mémoire ; **25** worktrees |

### Sondes à promouvoir en test committé

**fanout2.mjs** — le plafond compte les tickets NEUFS, pas les jetons `-> #` (trouvaille 1 ; ÉCHOUE aujourd'hui) :

```js
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const m = await import(pathToFileURL('scripts/hooks/solde-ticket-guard.mjs').href)
const txt = readFileSync('.claude/soldes/1690.md', 'utf8')
assert.equal(m.restesItems(txt).length, 8)
assert.ok(m.restesRoutants(txt).length >= 3,
  'trois restes routes vers #1689 doivent compter comme routants')
// obtenu 2026-09-07 : restesRoutants = 0 ; apres remplacement de "-> inventaire #1689" par "-> #1689" : 1
```

**compo.mjs** — aucun écran JOUEUR ne passe `disabled` ET `title` à un composant (trouvaille 5 ; ÉCHOUE aujourd'hui) :

```js
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
const files = []
;(function w(d){for(const e of readdirSync(d,{withFileTypes:true})){const p=join(d,e.name)
  if(e.isDirectory())w(p); else if(e.name.endsWith('.tsx')&&!e.name.endsWith('.test.tsx'))files.push(p)}})('src/ui')
const out = []
for (const f of files) {
  const rel = relative('src/ui', f).split(sep).join('/')
  if (/^(editor|compendium|gallery)\//.test(rel)) continue
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/<([A-Z][A-Za-z0-9]*)\b[^>]*?>/gs))
    if (/\bdisabled[=\s}]/.test(m[0]) && /\btitle\s*=/.test(m[0]))
      out.push(`${rel}:${src.slice(0, m.index).split('\n').length} <${m[1]}>`)
}
assert.deepEqual(out, [], 'refus MUET par COMPOSITION sur un ecran joueur')
// obtenu 2026-09-07 : ['GameMenu.tsx:73 <MenuButton>', 'GameMenu.tsx:76 <MenuButton>']
```

**tomb2.mjs** — la famille (c) couvre « ne vit plus DANS tel artefact » (trouvaille 4 ; 3 sites réels rendent `[]`, témoin positif vert) · **asymetrie.mjs** et **valide.mjs** du palier n°6 restent valables **à l'identique** (trouvailles 3 et 2 ci-dessus) : `stocksNominatifs.mjs` et `solde-ticket-guard.mjs` sont inchangés à l'octet sur la fenêtre.
