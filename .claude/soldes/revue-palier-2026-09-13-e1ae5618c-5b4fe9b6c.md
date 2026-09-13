# Revue de palier — fenêtre e1ae5618c..5b4fe9b6c — 2026-09-13

verdict: PARTIEL

8 lentilles jugées le 2026-09-12 par UN juge unique (lecture seule, arbre épinglé à la tête de fenêtre ; archivée le 2026-09-13 par le commit qui ferme #1711) sur 15 commits (11 de substance, 4 non) et 8 fermetures (#1724, #1725, #1720, #1723, #1721, #1708, #1709, #1717) : aucune fermeture ne se réfute — les huit tickets sont CLOSED, chacun emporte son solde dans le commit qui le ferme, chaque solde porte `## Restes` et `## Réfutation`, et les trois conversions de cliquet de la fenêtre sont vérifiées à dette IDENTIQUE par mesure indépendante (22 = 22, 52 = 52, 21 = 21, zéro fichier en écart). 4 trouvailles confirmées, toutes NON bloquantes : trois sont des restes de la revue précédente qui n'ont pas bougé — dont un qui s'est AGGRAVÉ (les six dernières captures de recette récupérables ont disparu du disque) — et une est neuve (l'état du chantier #1711 ne vit nulle part ailleurs que dans des messages de commit locaux, la tête de fenêtre n'étant pas poussée). 6 points écartés par re-mesure, 17 tenus.

## Trouvailles confirmées

1. **Le reste (1) de la revue précédente traverse un DEUXIÈME palier à l'octet, toujours sans porteur** (lentille restes-de-la-revue-precedente) — `src/gameIso/stage/AreteOverlay.tsx:16` porte encore « et le nom lisible en attendant l'infobulle partagée (lot 3) », alors que le lot 3 est clos depuis le 2026-09-11 et que l'infobulle partagée est en production. Blob identique de part et d'autre de la fenêtre (`b7e9d6928…` des deux côtés), `git log` sur le chemin VIDE, `scripts/guards/lib/commentPoison.mjs` sans commit, et la recherche d'issue ouverte ne rend que deux épics génériques (#1680, #1679) dont aucun ne porte le site. → attendu : le commentaire se reformule au présent, ou le site adopte l'infobulle ; et « en attendant » entre dans la famille (b) du détecteur ou à son angle mort mesuré. Un reste qu'aucune porte ne voit et qu'aucun ticket ne porte est un reste qui ne sera jamais soldé.

2. **La classe « capture citée par un solde, introuvable » s'est AGGRAVÉE dans la fenêtre : 46 → 48 citations, toujours 0 dans git, et les 6 pièces encore lisibles sur disque ont DISPARU (6 → 0)** (lentille fermetures-soldes-DoD) — mesure identique à celle de la revue précédente, rejouée à `5b4fe9b6c` : `{ total: 48, dansGit: 0, surDisque: 0 }`. Le `+2` ne vient d'aucun solde neuf (les huit soldes de la fenêtre citent ZÉRO capture, ce qui est cohérent : aucun ticket d'écran ici) mais du FICHIER DE LA REVUE PRÉCÉDENTE lui-même, qui recopie deux chemins de capture dans le texte de sa propre trouvaille — le stock de citations mortes croît désormais par les revues qui le dénoncent. `.gitignore:29` `public/qc/*` (seule négation : `!public/qc/baseline-affine/`) reste la cause. → attendu : soit la capture qui SOLDE un ticket est versionnée (négation par dossier de ticket), soit le champ `capture:` cesse d'affirmer une preuve que personne ne peut ouvrir. · NON bloquante pour cette fenêtre (aucun solde de la fenêtre n'en dépend), mais la classe est maintenant irrécupérable pour les 48.

3. **Le reste (4) de la revue précédente — deux restes de `1687.md` « nommés ici, sans ticket » — n'a toujours aucun porteur** (lentille restes-de-la-revue-precedente) — `.claude/soldes/1687.md` contient encore la chaîne `sans ticket` à `5b4fe9b6c` ; il s'agit de l'OUTILLAGE de recette (`__wfrp.screen('editor')` qui charge la scène-fixture et non la scène active, asymétrie des helpers `realKey*`, silence de `scenario`). → attendu : rejoindre un ticket OUVERT ou mourir dans un geste ; « nommé dans un solde » n'est pas un porteur.

4. **NEUF — l'état du chantier #1711 (3 trains sur 4 atterris) ne vit que dans des messages de commit LOCAUX : le ticket n'en porte rien, et la tête de la fenêtre n'est pas poussée** (lentilles regime et derogations-et-ci) — `origin/main` = `7688b7b2e`, `git branch -r --contains 5b4fe9b6c` → VIDE : `5b4fe9b6c` (T3) n'est publié nulle part, et `coursesCi` le confirme (0 course). Côté ticket, `gh issue view 1711 --json comments` rend UN seul commentaire (le design jugé du 2026-09-12 16:41), qui ne dit ni T1/T2 livrés, ni T3 livré, ni T4 restant — alors que trois trains sont atterris et que T4 est stagé non committé dans l'arbre. Le seul endroit qui porte la séquence est le corps des messages `6ae10e3bb` et `5b4fe9b6c`, non publiés pour le second. → attendu : un commentaire d'état sur #1711 (trains livrés / reste T4 / sha) dès l'atterrissage d'un train, comme l'exige la règle « l'état d'un ticket vit SUR LE TICKET » ; et la tête de palier se pousse (ou le palier se coupe au dernier sha publié). · NON bloquante : aucune fermeture ne dépend de #1711, qui est légitimement OPEN.

## Écartées par re-mesure

- ~~Les trois `CLIQUET:` de la fenêtre relèvent une dette en la déguisant en conversion~~ — écartée par mesure INDÉPENDANTE des baselines d'AVANT contre les stocks d'APRÈS (jamais par relecture du message) : `empty-line-code-refs` somme 22 → 22 entrées, `graphy` 52 → 52, `reanchor-low` 21 → 21, **zéro fichier en écart** dans les deux premiers cas ; les trois baselines de compte sont SUPPRIMÉES au même commit (aucune double comptabilité) et `dead-refs-stock.json` est ABSENT à la tête (tolérance zéro annoncée, tenue). Les faits confirment : `stocks.refus: []`, `notes: []` sur toute la plage.
- ~~La prémisse du rectificatif #1708 (« ni la porte ni le job ne lisent un numéro nu en 2ᵉ position ») est une commodité~~ — écartée, mesurée sur les DEUX grammaires AVANT le geste : `scripts/ops/fermer-depuis-main.mjs:20` `FERMETURE_RE = /(fixes|closes|corrige|ferme)\s+#(\d+)/gi` et `scripts/hooks/solde-ticket-guard.mjs:630` `CLOSE_KEYWORD_RE = /(corrige|fixe?s?|closes?|ferme)\s+#(\d+)/gi` — le verbe est COLLÉ au `#N`, `corrige #1709 #1708` ne rend que 1709. Le faux positif annoncé de la porte est vrai à l'octet : `df1507439` contient « de fixe #939 » (ligne 22 de son corps), que `fixe?s?\s+#(\d+)` capture.
- ~~Les « cinq recopies divergentes » ne sont pas réduites~~ — écartée : `git grep` d'un motif verbe+`#N` écrit à la main sous `scripts` à `5b4fe9b6c` → **zéro**, et six sites importent la primitive (`solde-ticket-guard.mjs`, `fermer-depuis-main.mjs`, `fermetures-non-citees.mjs`, `faits-de-palier.mjs`, `fermetures-sans-solde.test.mjs`, `fermer-depuis-main.test.mjs`). La seule copie restante est la recopie datée d'archive, NOMMÉE au message (`scripts/ops/sondes/audit-2026-09-01/…`).
- ~~#1717 annonçait « 32 résolveurs dérivés », il y en a 48 : un chiffre faux dans un contrat~~ — écartée comme trouvaille : 48 mesuré à la tête (`resolveursDentree().size`), mais `git grep -E "(32|48) résolveurs"` sur `scripts src docs` → **aucun site** : le nombre ne vit dans AUCUN doc ni code vivant, il n'existe que dans un message de commit (histoire, non contrat). La dérivation refuse d'ailleurs le vide (`bindingsVifs.mjs:451`), ce qui est le vrai verrou.
- ~~Poison (excuse sans tag, pierre tombale) introduit sous `scripts/` par la fenêtre~~ — écartée : `git diff e1ae5618c 5b4fe9b6c -- scripts` sur `ancien|autrefois|avant ce|en attendant|pour l'instant|legacy|déplacé vers|provisoire|temporaire|à terme|jusqu'à ce que` → les seuls hits du mot « ancien » sont des NOMS DE FIXTURE de tests de renommage (`const ancien = 'scripts/ancien.test.mjs'`, `src/ui/Ancien.tsx → Nouveau.tsx`) et une variable de `croissanceDesStocks` — aucun ne raconte un ancien état du dépôt ; **0** hit pour toutes les autres familles.
- ~~Les décroissances annoncées sont des affirmations~~ — écartée, les deux sont vraies : `domResiduStock.mjs` 13 → 8 lignes de test, `MAX_DOM_RESIDU` 12 → 7, et les cinq fichiers nommés (`SeatAssignmentsField`, `Inspector`, `editor-enregistre-repasse-parseProject`, `CharacterSheet`, `RollLine-second-read`) rendent **0 occurrence** à la tête ; `audit-stock.json` 7 → 5 paquets, `sharp` et `wrangler` retirés, avec la raison de l'override écrite à l'`_entete`.

## Tenus

- fermetures-soldes-DoD : les 8 tickets de la fenêtre sont CLOSED (`gh issue view`), chacun fermé par son commit ; les 8 soldes sont EMPORTÉS par le commit fermant (`git show --stat … -- .claude/soldes/<N>.md` : 13, 12, 12, 11, 13, 1↔1 (rectificatif), 16, 11 lignes) — aucune fermeture posée hors commit.
- fermetures-soldes-DoD : chaque solde porte `## Restes` ET `## Réfutation` ; les restes sont ROUTÉS ou motivés `-> RAS` avec leur mesure. Routages réels vérifiés : #1725 → **#1726 OPEN** (dont le corps porte bien les trois frontières majeures ET l'extension de la garde #528 au lock server), #1717 → **#1724** (fermé dans cette même fenêtre), #1708 geste 2 → `f4a9fa5da scripts/gates/toutes.mjs:845`.
- fermetures-soldes-DoD : #1725 tenu au contrôle positif dans l'arbre — `server/package.json` porte `"overrides": { "sharp": "0.35.4" }`, le lock rend `node_modules/sharp` en `0.35.4` depuis le registre, **0** `"link": true` et **0** `"resolved": ".."` (le faux départ « dépôt parent lié » est bien annulé), et le diff du lock ne touche que sharp et deux `@img/sharp-*`.
- stocks-et-cliquets : `stocks.refus: []` et `notes: []` sur la plage complète, par l'instrument canonique ; les trois croissances sont déclarées par `CLIQUET:` dans le corps du commit qui les porte, et chacune est une conversion à somme égale (ci-dessus).
- poison-des-diffs : aucun test de la fenêtre ne verrouille un comportement faux — les bancs ajoutés sont des CONTRATS POSITIFS sur dépôts jetables réels (`git mv`, `rmSync`) et les mutations décrites sont des mutations de code, pas d'attente.
- derogations-et-ci : **0 dérogation** dans la fenêtre (journal du pre-push : 7 hors fenêtre, 0 illisible) ; **0 rouge de CI** sur un sha de la fenêtre — les 7 têtes de push qui ont une course sont toutes `success` (`7688b7b2e`, `2945e9a60`, `10fff1c3b`, `a21b968a7`, `d4d1db8d2`, `f4a9fa5da`, `32a078c21`). Le seul rouge des 20 dernières courses (`cdb57b518`, 2026-09-11) est HORS fenêtre : c'est la trouvaille 3 de la revue précédente, qui reste sans porteur mais ne se re-mesure pas ici.
- derogations-et-ci : `fermeturesHorsCommit` → « aucune fermeture non citée dans la fenêtre », baseline 12, aucun écart — le régime « jamais `gh issue close` » tient.
- auditStock : mesurable pour la première fois depuis deux paliers (c'était le « NON MESURÉ » de la revue précédente, levé par #1725) — 5 entrées, 5 paquets ≥ high observés, **aucun écart au stock daté**, les 5 JAUNE portent chacune leur échéance NUMÉROTÉE (#1726) là où elles citaient un ticket sans numéro depuis le 2026-09-04.
- regime : chaînage de la plage `vérifié`, 15 commits, aucun trou ; 11 commits de substance, tous citant `refs`/`corrige #N`.
- regime : un lot 1 à trois tickets (#1721, #1723, #1720) et un lot 2 à deux (#1725, #1724) — trains courts, un codeur par train, chaque commit portant sa trace de juge (`TIENT SOUS CORRECTIONS` + bloquants portés) ; cinq des huit fermetures citent une PRÉMISSE DE TICKET corrigée par la mesure (#1720 « refusait +6 » → aveugle ; #1717 « la garde ne scanne pas les tests » → elle scanne ; #1725 « aucune montée de sharp possible » → réfutée par le juge), ce qui est le régime voulu.
- commits-triviaux : les 5 commits de ma main relus un par un. `d4d1db8d2` = 2 lignes de fiche mémoire, rien d'autre. `a21b968a7` et `7688b7b2e` = docs dérivés seuls (pieds d'empreinte + `docs/.sources-lues.json`), aucun corps de doc réécrit. `2945e9a60` = 33 pieds d'empreinte + **un fichier non-doc** (`scripts/docs/lib/enregistreur-lectures.test.mjs`, 4↔4 : la fixture quitte le motif `docs/…md` pour ne plus être lue comme une citation de doc absent) — c'est déclaré au sujet du commit, pas passé en fraude.
- commits-triviaux : `10fff1c3b`, étiqueté `chore(memoire)`, touche pourtant **CLAUDE.md et AGENTS.md** — vérifié : la seule ligne changée dans chacun est l'entrée DÉRIVÉE de l'index des doctrines (`7 verbatims` → `11`), régénérée par `scripts/docs/build-doctrines.mjs` dans le même commit que la fiche. Aucune règle stricte n'a été modifiée sous couvert de mémoire. Même contrôle sur `b7d5853a1` (`11` → `13`) : la fiche gagne une ligne et l'index suit au même commit — aucun dérivé en dérive.
- cross-os-et-determinisme : sur 3 255 lignes ajoutées (`src` + `scripts` + `.claude`), les hits `<chemin absolu de machine>` / `new Date()` / `Date.now()` / `Math.random(` / `toLocaleString` / `localeCompare` sont TOUS la citation, dans le fichier de la revue précédente, de sa propre trouvaille écartée — sauf un : `scripts/hooks/solde-ticket-guard-driver.test.mjs:75,205`, `const aujourdhui = new Date()`, qui fabrique la date du jour dans un solde-fixture **parce que la porte jugée lit la vraie horloge** : les deux lisent la même, le banc reste déterministe. Aucun chemin absolu de machine dans les 8 soldes neufs (0/0/0/0/0/0/0/0) — la correction demandée il y a deux paliers tient toujours.
- rejeu-des-affirmations : « rejoué par l'orchestratrice » re-mesuré, pas cru. `node --test scripts/hooks/fermetures-sans-solde.test.mjs scripts/ops/fermer-depuis-main.test.mjs scripts/docs/lib/enregistreur-lectures.test.mjs scripts/docs/lib/chemin-mesure.test.mjs` → **exit 0, 29/29** (#1708 et #1721). `npx vitest run src/racine-montee-barriere.test.tsx src/data/seam-ecriture-guard.test.ts src/ui/CharacterSheet.test.tsx` → **exit 0, 3 fichiers / 33 tests**, et la barrière de `test-setup.ts` n'a nommé AUCUNE racine restée montée sur `CharacterSheet.test.tsx`, l'un des cinq coupables corrigés (#1724 et #1717).
- LIMITE DITE — deux rejeux N'ONT PAS été faits, à dessein : `scripts/guards/lib/plageStock.test.mjs` (#1720) et `src/stock-primitive.test.ts` (#1723) dépendent de `scripts/guards/lib/stocksNominatifs.mjs` et `stock.mjs`, tous deux MODIFIÉS par le diff stagé hors fenêtre (#1711 T4) — les jouer depuis cet arbre aurait mesuré T4, pas la fenêtre. Leur verdict repose donc sur la lecture du diff et sur le fait `stocks` (0 refus), pas sur une exécution.
- NON MESURÉ — la tête `5b4fe9b6c` n'ayant aucune course, la CI n'a jugé la fenêtre que jusqu'à `7688b7b2e` ; T3 n'a que ses gates locales, non vérifiables en lecture seule ici (trouvaille 4).
- NON MESURÉ — fan-out d'agents et « un codeur par train » : aucune trace mesurable dans git, seuls les messages l'affirment.

## Restes de la revue précédente

- Reste (1) `AreteOverlay.tsx:16` « en attendant » → **N'A PAS BOUGÉ** (trouvaille 1) : ni livré, ni ticketé, ni couvert par le détecteur. Deuxième palier consécutif.
- Reste (2) captures citées par les soldes → **N'A PAS BOUGÉ ET S'EST AGGRAVÉ** (trouvaille 2) : 46 → 48 citations, `surDisque` 6 → 0.
- Reste (3) rouge de CI `cdb57b518` non nommé → **hors fenêtre, toujours sans porteur** : aucun ticket ouvert ne le nomme, aucune dérogation ne le trace ; la fenêtre courante, elle, est intégralement verte (0 rouge sur 7 courses).
- Reste (4) les deux restes « sans ticket » de `1687.md` → **N'A PAS BOUGÉ** (trouvaille 3).
- Reste NON MESURÉ `auditStock` (deux advisories neuves sans porteur) → **LEVÉ dans la fenêtre** : #1725 les a instruites (sharp corrigé par override, vitest déclaré au stock daté), le fait est disponible, et le ticket de classe #1726 est ouvert et cité par les cinq échéances restantes. C'est le meilleur geste du palier : un « NON MESURÉ » de revue est devenu un ticket fermé et un instrument vert en moins de 24 h.

---

```
SONDES
```

**Sonde 1 — les trois `CLIQUET:` sont-ils des conversions à dette IDENTIQUE ?** (à promouvoir en test : « la naissance d'un stock nominatif par conversion conserve la somme par fichier »)

```js
// scratchpad/juge-palier/cliquets.mjs — lecture seule
import { spawnSync } from 'node:child_process';
const R = process.env.WFRP_ROOT ?? process.cwd(); // arbre épinglé à 5b4fe9b6c
const g = (...a) => spawnSync('git', a, { cwd: R, encoding: 'utf8', maxBuffer: 1e9 });
const show = (r) => { const o = g('show', r); return o.status === 0 ? o.stdout : null; };
function somProfond(o) { let s = 0; for (const [k, v] of Object.entries(o)) { if (k.startsWith('_')) continue; if (typeof v === 'number') s += v; else if (v && typeof v === 'object') s += somProfond(v); } return s; }
for (const [base, stock] of [
  ['scripts/raw/empty-line-code-refs-baseline.json', 'scripts/raw/empty-line-code-refs-stock.json'],
  ['scripts/raw/graphy-baseline.json', 'scripts/raw/graphy-stock.json'],
]) {
  const avJ = JSON.parse(show(`6ae10e3bb^:${base}`)), apJ = JSON.parse(show(`6ae10e3bb:${stock}`));
  const parAv = {}; const plat = (o) => { for (const [k, v] of Object.entries(o)) { if (k.startsWith('_')) continue; if (typeof v === 'number') parAv[k] = (parAv[k] || 0) + v; else if (v && typeof v === 'object') plat(v); } }; plat(avJ);
  const parAp = {}; for (const e of apJ.entrees) parAp[e.fichier] = (parAp[e.fichier] || 0) + 1;
  const ecarts = [...new Set([...Object.keys(parAv), ...Object.keys(parAp)])].filter((c) => (parAv[c] || 0) !== (parAp[c] || 0));
  console.log(base, '| somme AVANT', somProfond(avJ), '| entrées APRÈS', apJ.entrees.length, '| écarts', ecarts.length, '| baseline survit ?', show(`6ae10e3bb:${base}`) ? 'OUI' : 'non');
}
console.log('reanchor-low | AVANT', somProfond(JSON.parse(show('5b4fe9b6c^:scripts/raw/reanchor-low-baseline.json'))),
            '| APRÈS', JSON.parse(show('5b4fe9b6c:scripts/raw/reanchor-low-stock.json')).entrees.length,
            '| dead-refs-stock présent ?', show('5b4fe9b6c:scripts/raw/dead-refs-stock.json') ? 'OUI' : 'absent');
```

```
scripts/raw/empty-line-code-refs-baseline.json | somme AVANT 22 | entrées APRÈS 22 | écarts 0 | baseline survit ? non
scripts/raw/graphy-baseline.json               | somme AVANT 52 | entrées APRÈS 52 | écarts 0 | baseline survit ? non
reanchor-low | AVANT 21 | APRÈS 21 | dead-refs-stock présent ? absent
```

**Sonde 2 — la prémisse du rectificatif #1708, mesurée sur les deux grammaires AVANT le geste**

```
$ git show c5b42b3f0^:scripts/ops/fermer-depuis-main.mjs   | grep -n 'FERMETURE_RE'
20:export const FERMETURE_RE = /(fixes|closes|corrige|ferme)\s+#(\d+)/gi
$ git show c5b42b3f0^:scripts/hooks/solde-ticket-guard.mjs | grep -n 'CLOSE_KEYWORD_RE'
630:const CLOSE_KEYWORD_RE = /(corrige|fixe?s?|closes?|ferme)\s+#(\d+)/gi
$ git show -s --format=%B df1507439 | grep -o '.\{0,20\}fixe #939.\{0,20\}'
de fixe #939, la classe #1014
$ git grep -n -E '\((corrige|fixe|fixes|closes?|ferme)[^)]*\)\\s\*#' 5b4fe9b6c -- scripts   # recopies restantes
(aucune)
$ git grep -ln "guards/lib/fermetures.mjs" 5b4fe9b6c -- scripts
scripts/hooks/fermetures-sans-solde.test.mjs · scripts/hooks/solde-ticket-guard.mjs · scripts/ops/faits-de-palier.mjs
scripts/ops/fermer-depuis-main.mjs · scripts/ops/fermer-depuis-main.test.mjs · scripts/ops/fermetures-non-citees.mjs
```

**Sonde 3 — les restes de la revue précédente ont-ils bougé ?** (à promouvoir : « toute capture citée par un solde existe dans l'arbre »)

```js
// scratchpad/juge-palier/restes.mjs + r2r3.mjs — lecture seule (extrait)
const compte = (rev) => { const m = {}; for (const s of g('ls-tree','--name-only',rev,'.claude/soldes/').split('\n').filter(Boolean)) { const n = [...g('show',rev+':'+s).matchAll(/capture:\s*(\S+)/g)].length; if (n) m[s]=n; } return m; };
// + existsSync(R+'/'+chemin) et git cat-file -e <rev>:<chemin> par capture
```

```
R1 blob avant/après : b7e9d6928950f6a31e7cf5b3054deca855ba3b7a  b7e9d6928950f6a31e7cf5b3054deca855ba3b7a
R1 commits sur le site : (aucun)   R1 détecteur élargi ? (aucun)
R2 captures : { total: 48, dansGit: 0, surDisque: 0 }   (revue précédente : 46 / 0 / 6)
R2 delta : .claude/soldes/revue-palier-2026-09-11-3310f2cae-e1ae5618c.md  0 -> 2
R2 soldes NEUFS de la fenêtre porteurs de capture : []
R3 runs sur la fenêtre : 7688b7b2e CI success · 2945e9a60 · 10fff1c3b · a21b968a7 · d4d1db8d2 · f4a9fa5da · 32a078c21 (tous success)
R3 rouges des 20 dernières courses : cdb57b518 CI failure 2026-09-11T13:22:49Z  (HORS fenêtre)
origin/main = 7688b7b2e26fcd6073ba0c65459e663796504301 | tête de fenêtre poussée ? NON
R4 « sans ticket » encore dans 1687.md ? true
```

**Sonde 4 — les décroissances annoncées et le rejeu des tests nommés**

```
$ git show 77b8792a9^:scripts/guards/lib/domResiduStock.mjs | grep -c '\.test\.'   → 13
$ git show 5b4fe9b6c:scripts/guards/lib/domResiduStock.mjs  | grep -c '\.test\.'   → 8
$ git grep -hn 'MAX_DOM_RESIDU =' 77b8792a9^ 5b4fe9b6c      → 12  puis  7
  (SeatAssignmentsField|Inspector|editor-enregistre-repasse-parseProject|CharacterSheet|RollLine-second-read : 0 occurrence à la tête)
$ git show ae8ae88e0^:scripts/ops/audit-stock.json | grep -c '"paquet"' → 7 ;  à 5b4fe9b6c → 5

$ node --test scripts/hooks/fermetures-sans-solde.test.mjs scripts/ops/fermer-depuis-main.test.mjs \
              scripts/docs/lib/enregistreur-lectures.test.mjs scripts/docs/lib/chemin-mesure.test.mjs
exit=0   # tests 29 · # pass 29 · # fail 0
$ npx vitest run src/racine-montee-barriere.test.tsx src/data/seam-ecriture-guard.test.ts src/ui/CharacterSheet.test.tsx
exit=0   Test Files 3 passed (3) · Tests 33 passed (33)   (aucune racine nommée par la barrière)
```

**Sonde 5 — poison, cross-OS, déterminisme sur les lignes AJOUTÉES par la fenêtre**

```
lignes ajoutées (src+scripts+.claude) : 3255
chemin absolu de machine : 2   new Date() : 2   Date.now() : 1   Math.random( : 1   toLocaleString : 1   localeCompare : 1
→ tous sauf UN sont la citation, dans le fichier de la revue précédente, de sa propre trouvaille écartée
→ le seul réel : scripts/hooks/solde-ticket-guard-driver.test.mjs:75,205  `const aujourdhui = new Date()` (fixture de solde daté, la porte jugée lit la même horloge)
tombales/excuses sous scripts (ancien|autrefois|avant ce|en attendant|pour l'instant|legacy|déplacé vers|provisoire|à terme|jusqu'à ce que) : 0 réel
```

**MUTATIONS SUR DISQUE : aucune** — aucune commande git écrivante jouée (`add/commit/checkout/restore/reset/stash/clean` : zéro) ; les deux runners (`node --test`, `npx vitest run`) sont des lecteurs, leurs sorties sont allées sous `…\scratchpad\juge-palier\` ; les cinq sondes `.mjs` vivent dans le scratchpad ; `git status --porcelain` rend le même diff stagé (#1711 T4, 23 chemins) avant et après la revue.
