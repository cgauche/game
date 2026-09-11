# Revue de palier — fenêtre 3310f2cae..e1ae5618c — 2026-09-11

verdict: PARTIEL

8 lentilles jugées par UN agent juge unique (seconde revue du jour) sur 15 commits (12 de substance) et 3 fermetures (#1687, #1722, #925) : 4 trouvailles confirmées, 5 écartées par re-mesure, 19 points tenus, aucune trouvaille bloquante.

## Trouvailles confirmées

1. **Le reste (3) de la revue du matin traverse la fenêtre à l'OCTET, et le lot qu'il annonce a été LIVRÉ dans cette même fenêtre** (lentille restes-de-la-revue-precedente) — `src/gameIso/stage/AreteOverlay.tsx:16` porte toujours « et le nom lisible en attendant l'infobulle partagée (lot 3) » ; le blob du fichier est identique de part et d'autre de la fenêtre (`b7e9d6928` des deux côtés), `git log` sur ce chemin rend VIDE, `scripts/guards/lib/commentPoison.mjs` n'a reçu aucun commit, et « en attendant » n'est inscrit à aucun angle mort (`git grep 'en attendant' -- scripts/guards` → aucun). Or le lot 3 est CLOS (`gh issue view 1687` → `CLOSED 2026-09-11T13:38:53Z`) et l'infobulle partagée est EN PRODUCTION (`src/ui/EquipmentPanel.tsx:140`, `src/gameIso/stage/PastilleEntite.tsx:96` : `CodexRef … tooltipOnly`), pendant que l'arête garde son `<title>` natif (`AreteOverlay.tsx:222`). Aucun ticket ne porte le site. → attendu : le commentaire se reformule au présent (ce que le peintre FAIT) ou le site adopte l'infobulle partagée maintenant qu'elle existe ; et « en attendant / dans l'attente » entre dans la famille (b) du détecteur ou à son angle mort mesuré.

```js
// sonde (lecture seule) — le reste (3) a-t-il bougé, et le lot attendu est-il livré ?
import { spawnSync } from 'node:child_process';
const R = process.env.WFRP_ROOT ?? process.cwd();
const g = (...a) => spawnSync('git', a, { cwd: R, encoding: 'utf8', maxBuffer: 1e9 }).stdout || '';
console.log('blob avant/après :', g('rev-parse','3310f2cae:src/gameIso/stage/AreteOverlay.tsx').trim(),
                                  g('rev-parse','e1ae5618c:src/gameIso/stage/AreteOverlay.tsx').trim());
console.log('commits sur le site :', g('log','--oneline','3310f2cae..e1ae5618c','--','src/gameIso/stage/AreteOverlay.tsx') || '(aucun)');
console.log('détecteur élargi ?', g('log','--oneline','3310f2cae..e1ae5618c','--','scripts/guards/lib/commentPoison.mjs') || '(aucun)');
console.log('infobulle partagée en production :', g('grep','-rn','tooltipOnly','e1ae5618c','--','src').split('\n').length - 1, 'sites');
// sortie : b7e9d6928… / b7e9d6928… · (aucun) · (aucun) · 6 sites
```

2. **La preuve VISUELLE citée par le solde de la fermeture #1687 n'existe ni dans git ni sur le disque — et la classe est systémique : 46 captures citées par 9 soldes, ZÉRO présente dans l'arbre git** (lentille fermetures-soldes-DoD) — `.claude/soldes/1687.md` § « Recette visuelle » : `capture: public/qc/1687-raccourcis/l3II-03-alt.png` ; `git cat-file -e e1ae5618c:<capture>` → absent, `existsSync` → `false`, et `git check-ignore -v` rend `.gitignore:29:public/qc/*` (seule exception versionnée : `!public/qc/baseline-affine/`). Le champ pointe donc structurellement dans le vide. → attendu : soit la capture d'une recette qui SOLDE un ticket est versionnée (négation `.gitignore` par dossier de ticket, comme `baseline-affine/`), soit le champ cesse d'affirmer une preuve qu'aucun relecteur ne peut ouvrir. · NON bloquante : les clauses DoD de #1687 tiennent au contrôle positif dans l'arbre (cf. points tenus) ; c'est la PIÈCE de recette qui est irrécupérable, pas le travail.

```js
// sonde (lecture seule) — toute capture citée par un solde existe-t-elle dans l'arbre jugé ?
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
const R = process.env.WFRP_ROOT ?? process.cwd();
const g = (...a) => spawnSync('git', a, { cwd: R, encoding: 'utf8', maxBuffer: 1e9 }).stdout || '';
let total = 0, dansGit = 0, surDisque = 0;
for (const s of g('ls-files','.claude/soldes').split('\n').filter(Boolean))
  for (const m of g('show','e1ae5618c:' + s).matchAll(/capture:\s*(\S+)/g)) {
    total++;
    if (spawnSync('git',['cat-file','-e','e1ae5618c:'+m[1]],{cwd:R}).status === 0) dansGit++;
    if (existsSync(R + '/' + m[1])) surDisque++;
  }
console.log({ total, dansGit, surDisque });
// sortie : { total: 46, dansGit: 0, surDisque: 6 }
```

3. **Un ROUGE de CI sur une tête de push de `main` n'est nommé nulle part — ni par le commit qui le répare, ni par une dérogation, ni par un ticket** (lentille derogations-et-ci) — `cdb57b518` est la tête de son push (run `34603965302`, `conclusion: failure`, 13:22:49Z) : job `build` rouge sur `Run npm run docs:check` puis `Run npm run docs:empreinte` (« docs:empreinte — REFUS (5) », exit 1), job `fermetures` `skipped`. Le commit suivant `80e31639d` régénère précisément les cinq docs dérivés et repasse vert, mais son message ne nomme ni le rouge ni sa cause ; le journal des dérogations rend 0 entrée dans la fenêtre, et aucun ticket ne le porte. Le régime ε juge la tête d'un push : ici la tête EST rouge, et ce rouge a emporté le job de fermeture du push qui portait la clôture de #1687. → attendu : un rouge sur `main` se nomme dans le commit qui le répare (cause + gate) ou dans une dérogation tracée — un rouge réparé en silence est un rouge qui n'a pas de coût.

```js
// sonde (lecture seule) — la tête de chaque push est-elle verte, et le rouge est-il nommé ?
import { spawnSync } from 'node:child_process';
const R = process.env.WFRP_ROOT ?? process.cwd();
const sh = (c, a) => spawnSync(c, a, { cwd: R, encoding: 'utf8', shell: true, maxBuffer: 1e9 }).stdout || '';
const runs = JSON.parse(sh('gh', ['run','list','--limit','40','--json','databaseId,headSha,conclusion']));
for (const r of runs.filter((r) => r.conclusion !== 'success').slice(0, 5)) {
  console.log('ROUGE', r.headSha.slice(0, 9));
  for (const j of JSON.parse(sh('gh', ['run','view', String(r.databaseId), '--json','jobs'])).jobs)
    console.log('  ', j.conclusion, j.name, (j.steps || []).filter((s) => s.conclusion === 'failure').map((s) => s.name).join(' / '));
}
// sortie : ROUGE cdb57b518 · success migrations · failure build  Run npm run docs:check / Run npm run docs:empreinte · skipped fermetures
```

4. **Le solde de #1687 dépose deux restes MESURÉS « sans ticket », en le disant** (lentille fermetures-soldes-DoD) — `.claude/soldes/1687.md`, dernier reste, verbatim : « l'asymétrie des helpers et le silence de `scenario` restent nommés ici, sans ticket » (helpers `realKey`/`realKeyDown`/`realKeyUp` de signatures divergentes, `__wfrp.scenario` qui peut rendre une scène vide sans exception). Les quatre autres restes du même solde sont routés (« inventaire #1680 », « inventaire #1709 ») ou éteints dans le commit ; ces deux-là n'ont aucun porteur — or c'est l'OUTILLAGE de recette, celui qui fabrique la preuve de tous les tickets UI. → attendu : un reste mesuré rejoint un ticket OUVERT (ici l'inventaire d'outillage) ou meurt dans le geste ; « nommé dans un solde » n'est pas un porteur, un solde ne se relit jamais.

## Écartées par réfutation

- ~~Croissance de stock non déclarée à `81e015d55` (`scripts/guards/lib/slotsStock.mjs` +1, aucun `CLIQUET:`)~~ — écartée : ma première mesure OMETTAIT `lirePreImage`, et le repli de ligne est aveugle aux entrées-objet JSON, d'où un `+1` fantôme sur une ligne MODIFIÉE. Les deux appelants de production le fournissent (`scripts/guards/lib/plageStock.mjs:102-103` et `:108-109`) ; avec pré-image : `croissanceDesStocks` → `[]`. La ligne est d'ailleurs une BAISSE (`occurrences: 76` → `72`), motif écrit au commentaire.
- ~~Poison ajouté par la fenêtre (paraphrase, excuse sans tag, pierre tombale)~~ — écartée : 5 506 lignes ajoutées sous `src/`+`scripts/` passées aux détecteurs canoniques (`untaggedExcuseMatch`, `tombstonesIn` de `scripts/guards/lib/commentPoison.mjs`) → 0 et 0 ; balayage large des motifs de report → 1 candidat, réfuté par lecture (`scripts/migrations/lib/1687-usable-sieges-portes.test.mjs:117` décrit ce que le banc ÉVITE).
- ~~Un commit de substance sans ticket dans la fenêtre (régime α)~~ — écartée : 12 commits de substance sur 15, tous citant `refs`/`corrige #N` ; et la porte MORD, sondée en direct : `evaluatePorteDuTicket({ command: 'git commit -m "fix(x): un correctif"', fichiersEmportes: ['src/ui/A.tsx'] })` → refus nommé ; avec `refs #1709` → `null` ; `['docs/a.md']` → `null` ; `decisionCumulee` (`scripts/hooks/solde-ticket-guard.mjs:1990-1994`) en fait un `deny`.
- ~~La classe « sondes archivées à chemins absolus de cette machine » se reproduit dans la fenêtre~~ — écartée : les trois soldes ajoutés (`1687.md`, `1722.md`, `925.md`) en portent 0 ; l'unique occurrence de l'archive du matin est dans le TEXTE de sa trouvaille 5, comme exemple du chemin fautif — aucun bloc de sonde n'en porte.
- ~~Aléa / horloge / casse / chemin Windows introduits dans un dérivé~~ — écartée : sur les 5 506 lignes ajoutées, 0 `C:\Users`, 0 `new Date()`/`Date.now()`, 0 `Math.random(`, 0 `toLocaleString`, 0 `localeCompare`.

## Points tenus

- fermetures-soldes-DoD : arbre ÉPINGLÉ `git log --oneline -1` → `e1ae5618c` (`perf(tests)!: refs #1709 train B4`) ; contrôle POSITIF : `src/state/usable.ts`, `src/gameIso/stage/PlaquesDeNom.tsx` et `.claude/soldes/{1687,1722,925}.md` présents à HEAD.
- fermetures-soldes-DoD : les 3 commits fermants citent `corrige #N` et EMPORTENT leur solde dans le même commit ; les 3 issues sont CLOSED, aucune fermeture hors commit (baseline 12 entrées, « aucun écart »).
- fermetures-soldes-DoD : DoD de #1687 tenu au contrôle positif — `interact` = 0 occurrence sous `src/` hors migrations, `actionsDe`/`estUtilisable` uniques dans `src/state/usable.ts:98`/`:114`, binding `decor.reveler` à `src/state/keybindings.ts:260`, exclusion de la save NOMMÉE à `src/state/saves.ts:173-175`.
- fermetures-soldes-DoD : DoD de #925 tenu — le CLI est CHAÎNÉ dans une gate existante, `package.json:77`.
- stocks-et-cliquets : 3 croissances réelles sur la plage, mesurées par l'instrument canonique avec ses DEUX lecteurs d'image, toutes couvertes ou en baisse — `src/data/structures-contrat.test.ts +2` (déclaré), `scripts/gates/ecrivainsAtteints.test.mjs +1` (déclaré), `scripts/guards/lib/slotsStock.mjs` (baisse 76 → 72).
- stocks-et-cliquets : aucune liste d'exemptions nominative neuve ; le seul recalage d'ancre (`ba99c35ca`, `GatedAction.tsx:151` → `:155`) est le geste prévu par le cliquet (exemption AU SITE).
- stocks-et-cliquets : le train D3 (`b5c3da1ad`) SOLDE l'action (γ) qui traversait trois revues — `croissanceDesStocks` lève si `images.lirePostImage` n'est pas une fonction (`stocksNominatifs.mjs:347-353`), vérifié à l'appel.
- poison-des-diffs : aucun test de la fenêtre ne verrouille un comportement faux — `ff1321ae6` réécrit un banc qui FIGEAIT `schema === 10` en `≥ 10`, et `b84ea74ff` remplace des attentes chiffrées sur la Diligence par une fixture construite.
- derogations-et-ci : 0 dérogation dans la fenêtre (journal du pre-push : 7 entrées hors fenêtre, 0 illisible) ; la TÊTE `e1ae5618c` est verte, ainsi que 12 des 13 têtes avec run.
- regime : régime α en vigueur DANS les portes depuis `dc07d7d1c`, verbatim daté au code, critère de substance partagé (`estCheminDeSubstance` de `revuePalier.mjs`) — une seule définition.
- regime : le chaînage de la plage est vérifié (fait `chainage`), 15 commits, aucun trou.
- commits-triviaux : les 3 commits non-substance ne touchent que `docs/` ; 9 des 12 commits de substance portent une trace de juge, les 3 sans trace (`cdb57b518`, `ba99c35ca`, `ff1321ae6`) sont vérifiés — seul `cdb57b518` a laissé un coût (trouvaille 3).
- cross-os-et-determinisme : les 3 soldes ajoutés ne portent aucun chemin absolu de machine — la correction demandée par la revue du matin a pris.
- restes-de-la-revue-precedente : reste (4) ROUTÉ — #1721 OPEN porte `enregistreur-lectures.mjs:51` ; reste (1) (#1686 fermé avant #1715) est un ACTE passé sans état résiduel ; le train D3 a ticketisé son hors-périmètre (#1720 OPEN).
- NON MESURÉ — `auditStock` : le script sort en ROUGE avant son verdict sur deux advisories NEUVES de paquets au stock (`racine:vitest:GHSA-82fw-gwwq-j7x9`, `server:sharp:GHSA-rgj7-g3m4-5g8c`) ; l'état du stock de vulnérabilités n'est pas jugé ce palier, et ces deux advisories n'ont, à la lecture du juge, aucun porteur ouvert.
- NON MESURÉ — fan-out d'agents et « un codeur par train » : aucune trace mesurable dans git ; seul l'entrelacement de #1709 et #1687 le même jour, en worktrees distincts, est observable, ce que le régime autorise.
- NON MESURÉ — aucune suite de tests ni gate n'a été jouée (interdit du brief) : tous les verdicts reposent sur des lectures git, les détecteurs canoniques importés un à un, et `gh` en lecture.
