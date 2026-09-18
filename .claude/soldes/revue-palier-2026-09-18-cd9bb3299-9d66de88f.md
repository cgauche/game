# Revue de palier — fenêtre cd9bb3299..9d66de88f — 2026-09-18

verdict: PARTIEL

Fenêtre `cd9bb3299..9d66de88f` (15 commits, 11 de substance, 1 fermeture par le bot + 2 fermetures À VENIR portées par des soldes non suivis) jugée en lecture seule par un juge unique depuis l'arbre épinglé `C:/Users/gauch/PhpstormProjects/Foundry/Game/.wt-1716` — `git rev-parse HEAD` → `9d66de88fbb1ccc45a46b290297d8679bd9c3abd`, `git log --oneline origin/main..HEAD` = **5 commits, tous `refs #1789 refs #1716`**, aucun commit étranger : le rebase est propre et l'arbre PORTE le travail jugé (contrôle POSITIF : `src/data/defauts-de-compilation.json`, `src/state/terrain/index.ts`, `src/ui/editor/GameOpEditor.offTerrainMod.test.tsx` présents et exécutables — garde rejouée **11/11 verts**). **Le socle de ce palier est nettement plus dur que celui du précédent sur trois axes mesurés** : la CI de la tête publiée `82f487a64` est verte **à la PREMIÈRE tentative** (`run_attempt = 1`, run 35299573807) — le grief 2 du palier précédent (« vert de seconde tentative ») ne se reproduit pas ; la couverture `JUGE:`/`REFUTATION:` remonte de **6/9 à 10/11** (seul `cae545c73`, un correctif d'UNE ligne de dénominateur, en est dépourvu) ; et la garde du lot refuse explicitement la liste de sites tolérés — elle porte un **contrat de vie par NEUTRALISEUR** qui rougit sur toute exemption morte, les seuls noms de fichiers du fichier étant quatre assertions POSITIVES de couverture. Ce qui ne tient pas est concentré sur les CLIQUETS et sur les CHIFFRES : une ligne `CLIQUET:` cite une référence (`296965162`) qui n'existe NULLE PART dans l'arbre (`git grep -c` → `rc=1` — c'était le SHA d'avant rebase du train 1, périmé par la réécriture), le solde #1789 annonçait « 22 options électives » là où l'objet en rend **23** (corrigé au solde avant clôture), le cliquet `STRUCTURES_DEFAUT` est relevé 27 → 28 alors que le réel passe de 26 à 27 et que le plafond 27 suffisait (hausse sans contrepartie, mou de 1 reconduit — redescendu à 27 dans le commit qui suit cette revue), et **trois cliquets ont bougé sans la moindre ligne `CLIQUET:`** (`slots-contrat.test.ts` 346 → 348, `migrations-type-enveloppe.test.ts` 120 → 121, `structures-contrat.test.ts` 468 → 471 et 27 → 28). La classe « chiffre non pris sur les objets », déclarée RÉSORBÉE au palier précédent après quatre récidives, RÉCIDIVE ici sur deux pièces. Le trailer `Claude-Session` régresse de 6/9 à **2/11**. Quatre griefs du palier précédent persistent au caractère près, dont l'instrument ROUGE sur #1785.

## Sortie brute de l'instrument

`npm run ops:faits-de-palier -- --base cd9bb3299 --tete 9d66de88f` — digest sans valeur réécrite :

```
KEYS base | tete | depuis | chainage | faitsChemin | commits | fermetures | stocks
     | fermeturesHorsCommit | auditStock | coursesCi | revuePrecedente | provenance
== base :: "cd9bb3299"   == tete :: "HEAD"   == depuis :: "2026-09-17"   == chainage :: "vérifié"
== commits substance = 11 / total 15
== fermetures :: [#1788 → e8726848c (solde:true)]
== stocks :: {"refus":[],"notes":[],"commits":15,"plage":"cd9bb3299..HEAD","indisponible":null}
== fermeturesHorsCommit :: { "disponible": false, "raison":
     "Command failed: … fermetures-non-citees.mjs --depuis 2026-09-17
      ROUGE FERMETURE NEUVE hors baseline, citée par AUCUN commit et sans .claude/soldes/1785.md
      suivi : #1785 (fermée le 2026-09-17T18:33:12Z par github-actions[bot], state_reason completed)
      Rapport de dépendances rouge … baseline 12 entrée(s) … **1 écart(s) à la baseline**" }
== auditStock :: "stock 5 entrée(s), observé 5 paquet(s) >= high … aucun écart au stock daté"
== coursesCi :: 1 sha → [CI success] (82f487a64) ; 14 shas → "courses":[]
== provenance :: commits/fermetures/stocks/chainage = script · fermeturesHorsCommit/coursesCi = gh
                 · auditStock = npm audit · revuePrecedente = git
```

`fermeturesHorsCommit.disponible = false` porte **exactement le même rouge de contenu qu'au palier précédent**, sur la même issue #1785 : le grief 1 du 2026-09-18 n'a reçu aucun geste (voir § Griefs de la revue précédente).

Sessions, mesurées (`git show -s --format=%B` par sha, compte de `^Claude-Session:`) : **2 des 11 commits de substance** portent le trailer (`cae545c73`, `5d70c4225`) ; les **5 commits du lot #1716/#1789 en sont TOUS dépourvus**, ainsi que les deux commits de #1788 (`cd3718589`, `0b1e19108`). Palier précédent : 6/9. **RÉGRESSION** — voir grief 5.

## Fermetures

| # | commit qui ferme | solde dans le MÊME commit | restes | routage | verdict | fermeture posée |
|---|---|---|---|---|---|---|
| #1788 | `e8726848c` | `.claude/soldes/1788.md \| 11 +` (2 fichiers, l'autre étant la revue de palier précédente, `211 +`) | 1 routé + 2 RAS motivés | `-> #1790` — **OPEN**, ouvert 2026-09-17T22:48:13Z, soit **3 h 52 AVANT** la fermeture ; pertinent au titre (copies locales de strip-commentaires, la classe que `codeSeul` absorbe) | `verdict: CONFIRMÉ` — cinq attaques (a)-(e) écartées PAR MESURE (1688 fichiers / 0 site, `wallIndex` en compteur de touches et non en banc, timers joués 3× chacun, 208 fichiers rejoués sous graine fixe) | `github-actions[bot]` **2026-09-18T02:40:32Z** |
| #1716 | *(à venir — `?? .claude/soldes/1716.md`)* | pièce non suivie, jugée comme telle | 3 restes : 1 routé + 1 `inventaire #1680` + 1 RAS | `-> #1794` — **OPEN**, ouvert 2026-09-18T02:45:28Z | `verdict: CONFIRMÉ` | *(non posée)* |
| #1789 | *(à venir — `?? .claude/soldes/1789.md`)* | pièce non suivie, jugée comme telle | 5 restes : 1 routé + 3 RAS + 1 `inventaire #1680` | `-> #1795` — **OPEN**, ouvert 2026-09-18T03:38:04Z | `verdict: CONFIRMÉ` | *(non posée)* |

Sondes collées :

```
$ gh api repos/cgauche/game/issues/1788/timeline --jq '.[]|select(.event=="closed")|[.actor.login,.created_at]|@tsv'
github-actions[bot]	2026-09-18T02:40:32Z

$ gh api repos/cgauche/game/actions/runs/35299573807 --jq '[.run_attempt,.conclusion,.created_at,.updated_at]|@tsv'
1	success	2026-09-18T02:30:09Z	2026-09-18T02:40:36Z

$ for n in 1716 1789 1794 1795 1790 1792 1680 1788 ; gh issue view $n --json number,state,createdAt,closedAt,title
1716 OPEN  created=09/09/2026 09:21:57  closed=
1789 OPEN  created=09/17/2026 21:38:22  closed=
1794 OPEN  created=09/18/2026 02:45:28  closed=
1795 OPEN  created=09/18/2026 03:38:04  closed=
1790 OPEN  created=09/17/2026 22:48:13  closed=
1792 OPEN  created=09/17/2026 23:22:10  closed=
1680 OPEN  created=09/01/2026 20:00:21  closed=
1788 CLOSED created=09/17/2026 20:16:22 closed=09/18/2026 02:40:32

$ git show --stat --format=%s e8726848c
chore(solde): corrige #1788 — tests sans horloge : garde à zéro, bancs hors CI, 23 sites réécrits
 .claude/soldes/1788.md                             |  11 ++
 .../revue-palier-2026-09-18-0dc3cba27-cd9bb3299.md | 211 +++++++++++++++++++++

$ grep -o "\-> #[0-9]*" .claude/soldes/1716.md .claude/soldes/1789.md
.claude/soldes/1716.md:-> #1794
.claude/soldes/1789.md:-> #1795
```

**La fermeture tient sur les trois pièces** : ≤ 1 reste `-> #N` par solde (1, 1, 1), cibles de routage **OPEN** et — pour la seule fermeture posée — **ouverte AVANT** la fermeture qu'elle absorbe, `verdict:` nommé dans les trois soldes (CONFIRMÉ ×3), fermeture par `github-actions[bot]` après un `build` vert de PREMIÈRE tentative, jamais à la main. Réserve : les trois soldes rendent `verdict: CONFIRMÉ`, contre 2 CONFIRMÉ / 5 PARTIEL au palier précédent — la passe adverse de #1716 et #1789 concède deux points de DISPOSITION seulement (rédaction de #1794, item de dette météo sur #1680), aucune clause de DoD.

## Commits de substance — annonces rejouées

`JUGE:` / `REFUTATION:` / `JUGE-VISION:` / `CLIQUET:` par commit de substance, mesurés :

```
9d66de88f JUGE=1 REFUT=1 VISION=1 CLIQUET=0 SESSION=0
6334e651a JUGE=1 REFUT=1 VISION=1 CLIQUET=5 SESSION=0
608b43965 JUGE=1 REFUT=1 VISION=0 CLIQUET=0 SESSION=0
bc2bdb749 JUGE=1 REFUT=1 VISION=1 CLIQUET=0 SESSION=0
5b9937852 JUGE=1 REFUT=1 VISION=0 CLIQUET=0 SESSION=0
0b1e19108 JUGE=1 REFUT=1 VISION=1 CLIQUET=2 SESSION=0
cd3718589 JUGE=1 REFUT=1 VISION=1 CLIQUET=0 SESSION=0
cae545c73 JUGE=0 REFUT=0 VISION=0 CLIQUET=0 SESSION=1
5d70c4225 JUGE=1 REFUT=1 VISION=1 CLIQUET=0 SESSION=1
26628b417 JUGE=1 REFUT=1 VISION=1 CLIQUET=2 SESSION=0
d286914ff JUGE=1 REFUT=1 VISION=1 CLIQUET=0 SESSION=0
```

**10 de 11** portent les deux lignes (6/9 au palier précédent). `cae545c73` en est dépourvu ; l'absence y est **vénielle** et mesurée telle : `git show --numstat --format= cae545c73` → `1 1 scripts/guards/lib/structuresStock.mjs`, une seule ligne de dénominateur recalée sur une migration du lot #1695. Même classe que `bb7c241ff`/`d1524e669` du palier précédent.

Annonces rejouées sur les objets :

| sha / pièce | annonce | rejeu |
|---|---|---|
| `9d66de88f` / solde #1789 | « `resizeGrid(siege-enceinte, 31, 47)` : 77 → 0 « Étage sans appui » » | **MOITIÉ VRAIE, moitié non rejouée.** Le **0** est mesuré à l'unité sur la scène construite, à l'aller ET au retour (sonde ci-dessous : `avant = 0`, `31x47 → 0`, `retour 30x46 → 0`). Le **77** est le comportement MUTANT (ancien `resize`) : non rejoué ici, faute de pouvoir muter l'arbre en lecture seule — NOMMÉ non rejouable, la mutation est annoncée collée au ticket |
| `9d66de88f` | « mesure brute : **5 lignes**, toutes `ui/editor/WorldMapEditor.tsx` sous `kind:` » | **VRAIE.** `grep -n "'route'" src/ui/editor/WorldMapEditor.tsx` → **6 lignes** (`:36 :82 :104 :171 :177 :178`), dont `:36` est la DÉCLARATION d'union `kind: 'place' \| 'route'`, blanchie par le neutraliseur « vocabulaire d'union déclaré » : **6 − 1 = 5** lignes sous `kind:`, toutes dans ce fichier |
| solde #1789 | « **22 options** électives sans « Vide (étage) » ni « Mur » » | **FAUSSE — mesuré 23.** Sonde vitest : `terrainsElectifs() = 23`, `tousLesTerrains() = 25` ; 25 − `vide` (absence) − `mur` (bordDuMonde) = **23**. Ids rendus dans l'ordre du registre : `bois,boue,cendre,dalle,eau,fosse,herbe,lave,marbre,neige,ossuaire,pave,pierre,plancher,planches,porte,roche,route,sable,sang,sol,terre,tourbe`. Voir grief 2 |
| solde #1789 | « `terrains.json` : 25 entrées, **un** `absence` = `vide`, **un** `bordDuMonde` = `mur`, **cinq** `ascii` uniques » | **VRAIE aux QUATRE.** Sonde node : `terrains entries 25` · `absence ['vide']` · `bordDuMonde ['mur']` · `ascii [["eau","~"],["fosse","_"],["mur","#"],["planches","="],["porte","D"]] uniques 5` |
| `6334e651a` | « enveloppe gelée **130 → 131** » | **VRAIE.** `grep -cE "^  \"[A-Za-z]+\": '" src/ui/compendium/registry-enveloppe.test.ts` → **258** à `cd9bb3299`, **262** à HEAD ; deux entrées par catégorie (empreinte + forme) → 129 → 130 (`d286914ff`, `semencesDeScene`) → **131** (`6334e651a`, `defautsDeCompilation`) |
| `26628b417` / `6334e651a` | plafond `STRUCTURES_FORMES` **468 → 471** | **VRAIE, et mou consommé à zéro.** Réel mesuré : **465** à `cd9bb3299` → **468** après `26628b417` (+3) → **471** à HEAD (+3). Plafond : `468` (`cd9bb3299:src/data/structures-contrat.test.ts:589`) → `471` (`:596`). Mou 3 → **0** |
| `26628b417` | cliquet `STRUCTURES_DEFAUT` **27 → 28** | **EXACTE comme DELTA, INJUSTIFIÉE comme HAUSSE.** Réel : **26** → **27** (+1, `semences-de-scene.json › ambientLight`). Plafond : **27** → **28**. Le réel 27 tenait sous l'ancien plafond 27 : la hausse ne consomme rien et reconduit un mou de 1. Voir grief 3 |
| `6334e651a` | `CLIQUET: registry-enveloppe.test.ts +2 … jumelle de semencesDeScene (`296965162`)` | **RÉFUTÉE.** `git grep -c "296965162" 9d66de88f` → **rc=1, aucune ligne**. Les deux empreintes réelles sont `semencesDeScene: 'b0f469f176864315'` et `defautsDeCompilation: '2cf25f78c6cd4dbd'`. Voir grief 1 |
| `9d66de88f` / solde #1716 | « garde rejouée **11/11** » | **VRAIE.** `npx vitest run src/gameIso/builders/matieres-en-donnee.test.ts` → `Test Files 1 passed (1) · Tests 11 passed (11)` |
| `0b1e19108` / solde #1788 | garde `fichierVitest` en `node --test` | **VRAIE.** `node --test scripts/guards/lib/fichierVitest.test.mjs` → `# tests 6 / # pass 6 / # fail 0` |
| `26628b417` | « slots 346 → 348, plafond CONSOMMÉ, zéro mou » | **VRAIE au diff.** `src/data/slots-contrat.test.ts` : `-const DETTE_ADOPTION_MAX = 346;` → `+const DETTE_ADOPTION_MAX = 348;`, avec un commentaire « Cliquet REMONTÉ 346 → 348 » motivé et daté. Réserve : ce cliquet n'est nommé par AUCUNE ligne `CLIQUET:` — voir grief 4 |
| `26628b417` | « plancher d'enveloppe 120 → **121** » | **VRAIE.** `src/data/migrations-type-enveloppe.test.ts` : `-const PLANCHER = 120;` → `+const PLANCHER = 121;`, en-tête recalé (« 121 `.json` = 79 tableaux + 42 racines objet »). Même réserve de déclaration |
| `#1794` (reste routé) | « **418 diagnostics / 372 sites** » | **NON REJOUABLE ici** (substitution de type en mémoire), mais le ticket porte sa sonde NOMMÉE et sa ventilation : `sonde-brand-d.mjs` / `sonde-alias.mjs`, arbre `5378d07d5` + train C, `418 diagnostics, 372 sites distincts — 315 fixtures (75 fichiers), 50 authoring, 7 production`, coût typecheck `Δ < 2 s sur ~76 s`. Le credo « blocage externe prouvé par une sonde positive » est tenu au ticket |
| solde #1716 | « périmètre vitest vert (arbre combiné : **755 fichiers** node / 41 jsdom) » | **NON REJOUÉ** — `npm test` complet interdit par le brief. NOMMÉ non couvert |

Sondes collées, lecture seule, promouvables :

```ts
// probe vitest (fichier temporaire, supprimé après exécution)
import { buildScene } from './state/mapSpec';
import { spec as siegeSpec } from './scenes/test-scenarios/siege-enceinte';
import { validateScene } from './state/validateScene';
import { resizeGrid } from './state/sceneEdit';
import { terrainsElectifs, tousLesTerrains } from './state/terrain';
it('sonde', () => {
  const siege = buildScene(siegeSpec) as any;
  const nb = (s: any) => validateScene([s]).filter((w: any) => w.message.includes('Étage sans appui')).length;
  console.log('SONDE etage-sans-appui avant =', nb(siege));
  const agrandi = resizeGrid(siege, 31, 47);
  console.log('SONDE resizeGrid 31x47 ->', nb(agrandi));
  console.log('SONDE retour 30x46 ->', nb(resizeGrid(agrandi, 30, 46)));
  const el = terrainsElectifs() as any[];
  console.log('SONDE terrainsElectifs =', el.length, '| ids =', el.map((t) => t.id).join(','));
  console.log('SONDE tousLesTerrains =', tousLesTerrains().length);
});
```
```
SONDE etage-sans-appui avant = 0
SONDE resizeGrid 31x47 -> 0
SONDE retour 30x46 -> 0
SONDE terrainsElectifs = 23 | ids = bois,boue,cendre,dalle,eau,fosse,herbe,lave,marbre,neige,ossuaire,
  pave,pierre,plancher,planches,porte,roche,route,sable,sang,sol,terre,tourbe
SONDE tousLesTerrains = 25
 Test Files  1 passed (1)       Tests  1 passed (1)
```

```bash
$ git grep -c "296965162" 9d66de88f ; echo "rc=$?"
rc=1                                          # la référence citée au CLIQUET n'existe nulle part

$ awk '/^export const STRUCTURES_FORMES = \[/{f=1;next} f&&/^\];/{exit} f&&/^  \{/{c++} END{print c}' \
      <(git show cd9bb3299:scripts/guards/lib/structuresStock.mjs)   # → 465
$ awk '… même filtre …' scripts/guards/lib/structuresStock.mjs        # → 471
$ awk '/^export const STRUCTURES_DEFAUT = \[/{…}' <(git show cd9bb3299:…)  # → 26
$ awk '/^export const STRUCTURES_DEFAUT = \[/{…}' scripts/guards/lib/…      # → 27
$ grep -nE "STRUCTURES_(DEFAUT|FORMES).length," <(git show cd9bb3299:src/data/structures-contrat.test.ts)
589:      ['STRUCTURES_FORMES', STRUCTURES_FORMES.length, 468],
610:      ['STRUCTURES_DEFAUT', STRUCTURES_DEFAUT.length, 27],
$ grep -nE "STRUCTURES_(DEFAUT|FORMES).length," src/data/structures-contrat.test.ts
596:      ['STRUCTURES_FORMES', STRUCTURES_FORMES.length, 471],
623:      ['STRUCTURES_DEFAUT', STRUCTURES_DEFAUT.length, 28],
# forme de l'assertion (src/data/structures-contrat.test.ts, ~l.788) :
#   const gonfles = mesure.filter(([, n, plafond]) => n > plafond) …   → 27 ≤ 28 : un cran de mou
```

## Stocks nominatifs

`refus: []`, `notes: []` sur 15 commits. `auditStock` : 5 entrées, 5 paquets `>= high`, « aucun écart au stock daté » — les 5 sont les mêmes qu'au palier précédent, toutes JAUNES datées du 2026-09-04 et routées à #1726.

Contre-contrôle des fichiers de stock/cliquet touchés dans la fenêtre :

```bash
$ git diff --name-only cd9bb3299 9d66de88f | grep -iE "ratchet|baseline|cliquet|stock|budget|contrat|enveloppe"
scripts/guards/lib/domResiduStock.test.mjs      ← 0b1e19108 (#1788) : 1+/1−, prédicat SEUL
scripts/guards/lib/plageStock.test.mjs          ← 0b1e19108           : 1+/1−, prédicat SEUL
scripts/guards/lib/slotsStock.mjs               ← 26628b417  CLIQUET déclaré +2
scripts/guards/lib/stocksNominatifs.mjs         ← 0b1e19108           : 9+/5−, prédicat SEUL
scripts/guards/lib/structuresStock.mjs          ← 26628b417 +4 · 6334e651a +3 · cae545c73 (1+/1−)
src/data/migrations-type-enveloppe.test.ts      ← 26628b417  PLANCHER 120 → 121, AUCUN CLIQUET:
src/data/slots-contrat.test.ts                  ← 26628b417  DETTE_ADOPTION_MAX 346 → 348, AUCUN CLIQUET:
src/data/structures-contrat.test.ts             ← 26628b417 + 6334e651a : 468→471 et 27→28, AUCUN CLIQUET:
src/dom-residu-stock.test.ts                    ← 0b1e19108           : 2+/1−, prédicat SEUL
src/state/player-text-ratchet.test.ts           ← 0b1e19108           : 2+/2−, prédicat SEUL
src/ui/compendium/registry-enveloppe.test.ts    ← 6334e651a CLIQUET +2 · d286914ff +2 SANS CLIQUET:
src/ui/ui-ratchets.test.ts                      ← 0b1e19108           : 6+/5−, prédicat SEUL
```

Les six fichiers de #1788 sont vérifiés un par un au diff : **aucun nombre de baseline ne bouge**, seule la substitution `/\.test\./` → `estFichierVitest(…)` (diff `ui-ratchets.test.ts` collé au contrôle : cinq hunks, tous des filtres de périmètre). La substance des stocks y est INCHANGÉE — la migration de prédicat n'est pas un cran.

Les sept lignes `CLIQUET:` déclarées nomment toutes un porteur RÉEL avec le BON delta, vérifié au `--numstat` puis au contenu du diff :

- `26628b417` — `slotsStock.mjs +2` (deux entrées `semences-de-scene reliefDefaults/roofDefaults`) ✓ ; `structuresStock.mjs +4` = **3** `STRUCTURES_FORMES` + **1** `STRUCTURES_DEFAUT` ✓ (diff collé)
- `6334e651a` — `structuresStock.mjs +3` ✓ (trois `reference | defauts-de-compilation.json | id-nu | historique`, chacune datée) ; `slots.test.ts +3` ✓ ; `maison-sans-source.test.ts +1` ✓ ; `codex-edit-charge-discriminee.test.tsx +2` ✓ ; `registry-enveloppe.test.ts +2` ✓ **mais la raison cite une référence inexistante** (grief 1)
- `0b1e19108` — `scene-prose-graphie-guard.test.ts +4` et `tests-sans-horloge-guard.test.ts +1`, tous deux déclarés comme **substance inchangée** (regex → chaînes ; table de six NOMS TÉMOINS) ✓

**Ce qui manque n'est pas la justesse des lignes posées, c'est leur COUVERTURE** : trois cliquets — dont un que le code lui-même appelle « Cliquet REMONTÉ » — ont bougé sans ligne `CLIQUET:`, et un quatrième (`registry-enveloppe.test.ts` par `d286914ff`) a été déclaré par le commit JUMEAU mais pas par le sien. Voir grief 4.

## Doctrine « exemption au SITE, jamais au fichier »

Doctrine utilisateur 2026-09-17 (« Encore une guard qui valide des defauts ? ») — sonde sur les deux gardes nommées au brief :

`src/gameIso/builders/matieres-en-donnee.test.ts` (515 lignes) : **aucune liste de sites tolérés, aucune exemption au fichier.** Le fichier porte deux tests de VIE, un par bras, au grain du CHAMP :

```
:338  it('chaque NEUTRALISEUR est exercé par un site du périmètre (aucune exemption morte)')
:347  expect(exerce, `neutraliseur mort : « ${n.nom} » ne blanchit plus aucun site du périmètre —
       re-trier l’exemption.`).toBe(true);
:423  it('chaque neutraliseur du bras TERRAIN est exercé par un site du périmètre …')
:392  « AUCUN site toléré, aucune liste d’exemption, aucun nom de fichier : … »
```

Contre-grep des littéraux de chemin dans le fichier, une par une — **les quatre seules occurrences sont des assertions POSITIVES de couverture**, pas des exemptions :

```
:304  expect(fichiers.some((f) => f.rel === 'sceneEdit.ts'), 'la dérivation des masses n’est plus scannée')
:305  expect(fichiers.some((f) => f.rel === 'scene.ts'), 'le SCHÉMA de scène n’est plus scanné')
:307  expect(fichiers.some((f) => f.rel === 'ui/editor/Palette.tsx'), 'la PALETTE … n’est plus scannée')
:308  expect(fichiers.some((f) => f.rel === 'ui/editor/Editor.tsx'), 'le redimensionnement … n’est plus scanné')
```

Le geste le plus fort du palier sur cet axe est **la mutation au grain du champ qui a fait tomber un MORT** : le message de `9d66de88f` déclare que la mesure par champ a révélé que `kind` n'a aucun homonyme de matière dans le périmètre et l'a **retiré** du bras matières — un stock qui DÉCROÎT par la garde elle-même, exactement ce que le credo demande d'un audit.

`scripts/guards/lib/fichierVitest.mjs` (#1788) : **aucune exemption**, et le refus est écrit en tête :

```
:9  // l'exempter par son NOM : une garde qui valide des défauts. Le prédicat vit donc en UN exemplaire,
```

`grep -nEi "exempt|toler|allowlist"` sur `fichierVitest.mjs` + `fichierVitest.test.mjs` → **cette seule ligne, qui REFUSE l'exemption**. Aucune liste de bancs, aucun nom de fichier. Les six cas passent en `node --test`.

**Sur les deux gardes nommées au brief, la doctrine est tenue.** C'est le point le plus solide du palier.

## CSS et écran

```bash
$ git diff --numstat cd9bb3299 9d66de88f -- '*.css'
(vide)
$ git diff cd9bb3299 9d66de88f -- '*.css' | grep -E "^\+\."
(vide)
```

**Aucun fichier CSS touché, aucune classe neuve** sur toute la fenêtre. La grille du diff n'a rien à reprocher : l'éditeur d'ops gagne son bloc `offTerrainMod` sur le patron du fichier (`<select>`, `NumberField variant="nu"`, case), sans style. Le seul défaut d'écran nommé (`editor.css:709`, `.dr input { width: 44px }` écrasant les cases) est **hors lot, ticketé et OPEN (#1792)**, son cardinal recalé par commentaire (14 → 16 au HEAD) : signalé, pas béni. Deux `JUGE-VISION:` du lot annoncent une recette navigateur en joueur avec captures nommées (`public/qc/soldes/1789-*.png`, 12 fichiers présents en non-suivis) — **présentes et nommées, non ouvertes par ce juge** (§ Non couvert).

## CI

```bash
$ gh run list --repo cgauche/game --branch main --limit 10 --json headSha,status,conclusion,name,createdAt,databaseId
success  18/09 02:30:09  35299573807  82f487a64…  CI  completed   [tête publiée]
success  17/09 23:54:14  35288876581  2af3e1647…  CI  completed
success  17/09 23:30:13  35287119600  26628b417…  CI  completed
success  17/09 19:56:46  35267858126  cd9bb3299…  CI  completed   [base de la fenêtre]
…
$ gh api …/runs/35299573807 --jq '[.run_attempt,.conclusion,.created_at,.updated_at]|@tsv'
1	success	2026-09-18T02:30:09Z	2026-09-18T02:40:36Z
$ gh api …/runs/35287119600 --jq '[.run_attempt,.conclusion]|@tsv'   → 1  success
$ gh api …/runs/35288876581 --jq '[.run_attempt,.conclusion]|@tsv'   → 1  success
```

**La tête publiée `82f487a64` est VERTE à la PREMIÈRE tentative**, comme les deux autres têtes de train de la fenêtre. **Aucune relance n'a été nécessaire.** Le grief 2 du palier précédent ne se reproduit pas — et il ne se reproduit pas *par construction* : le lot #1788 de cette même fenêtre a supprimé la classe de rouge non déterministe qui l'avait causé. La fermeture de #1788 (02:40:32Z) tombe pendant le run vert qu'elle suit (02:30:09Z → 02:40:36Z) : la fermeture SUIT bien la publication. Les 5 commits du lot #1716/#1789 n'ont pas de run propre (régime de publication en TRAIN, `coursesCi` → `"courses":[]` sur 14 des 15 shas).

Réserve d'outillage, inchangée : `grep -n "run_attempt\|attempt" scripts/ops/faits-de-palier.mjs` → **aucune ligne**. L'instrument recopie toujours `conclusion` sans lire `run_attempt` ; ici cela ne masque rien (vérifié à l'API), mais la lentille reste aveugle.

## Griefs de la revue précédente (8 routés)

| grief du 2026-09-18 (`cd9bb3299`) | état dans CETTE fenêtre | mesure |
|---|---|---|
| 1 — instrument ROUGE : `fermetures-non-citees` refuse #1785, exemption clouée au titre `'Canari rouge'` | **PERSISTANT, identique au caractère près** | `fermeturesHorsCommit.disponible = false`, même `raison`, même issue #1785, « 1 écart(s) à la baseline ». Aucun commit de la fenêtre ne touche `scripts/ops/fermetures-non-citees.mjs`. **Deuxième palier consécutif où le seul canal de détection d'une fermeture hors commit est inutilisable.** BLOQUANT pour l'instrument — ticket #1793 ouvert par le lot (exemption dérivée du registre des workflows) |
| 2 — fermeture sur un `build` vert de SECONDE tentative ; `coursesCi` ne lit pas `run_attempt` | **RÉSORBÉ sur le FAIT, PERSISTANT sur l'OUTIL** | fait : `run_attempt = 1` sur les trois runs de la fenêtre, dont la tête `82f487a64` (API collée) — zéro relance, et la CAUSE du rouge non déterministe est corrigée DANS la fenêtre par #1788. Outil : `grep run_attempt scripts/ops/faits-de-palier.mjs` → **aucune ligne** ; la lentille reste aveugle, elle n'a simplement rien à voir ici |
| 3 — `966e1a451` sans `JUGE:` ni `REFUTATION:` (couverture 6/9) | **RÉSORBÉ** | **10/11** commits de substance portent les deux lignes (table ci-dessus). Le seul manquant, `cae545c73`, est un diff d'**une ligne** (`--numstat` collé) — vénielle par la mesure, pas par l'indulgence |
| 4 — deux revues de palier de fenêtres EMBOÎTÉES archivées dans une même fenêtre | **RÉSORBÉ dans cette fenêtre** | `git log --oneline --diff-filter=A cd9bb3299..9d66de88f -- .claude/soldes/` → **un seul commit**, `e8726848c`, qui ajoute `1788.md` ET l'archive `revue-palier-2026-09-18-0dc3cba27-cd9bb3299.md` — une archive, une fenêtre, qui enchaîne exactement sur la base d'aujourd'hui. Aucun doublon |
| 5 — `ECRIT_LU['test'].lit` omet `scripts/` | **PERSISTANT, inchangé au caractère près, 3ᵉ palier** | `scripts/gates/toutes.mjs:219` → `lit: ['src/', 'server/src/', 'scripts/map/', 'docs/', 'Source/', '.gitattributes', 'vite.config.ts']`. Aucun commit de la fenêtre n'y touche, alors que la fenêtre a vu passer DEUX lots entiers sur `scripts/guards/` |
| 6 — trailer `Claude-Session` absent sur 3/9 des commits de substance | **AGGRAVÉ : 9/11 absents** | présent sur `cae545c73` et `5d70c4225` SEULEMENT (les deux commits du lot #1695, hérités du palier précédent). **Les 5 commits du lot #1716/#1789 et les 2 de #1788 n'en portent AUCUN.** Trajectoire 8/10 → 5/10 → 3/9 → **9/11**. Voir grief 5 |
| 7 — exemption au FICHIER portant un CARDINAL (`registry-id-branch-guard.test.ts`) | **PERSISTANT, 3ᵉ palier** | `grep -n "classerPush.mjs" src/ui/registry-id-branch-guard.test.ts` → `161:  'scripts/gates/classerPush.mjs': 1,`. Intacte. Point positif mesuré : la fenêtre n'ajoute AUCUNE exemption neuve — les deux gardes neuves du palier REFUSENT explicitement l'exemption par nom (§ Doctrine) |
| 8 — la grammaire du reste ne compte pas `-> inventaire #N` ; #1777 / `--diff-filter=D` absent | **PERSISTANT, atténué (3 → 2)** | `grep -o "inventaire #[0-9]*"` sur les trois soldes → `1716.md` ×1 reste, `1789.md` ×1 reste, `1788.md` ×0 : **2 restes** partent encore à #1680 (**OPEN** depuis le 2026-09-01) hors du plafond « au plus UN reste routé ». Et `grep -n "diff-filter" scripts/guards/lib/revuePalier.mjs` → **une seule ligne, `:118`, `--diff-filter=A`** : rien ne regarde `D`, une archive de revue reste supprimable sans porte (#1777 **OPEN**) |

## Griefs

**Grief 1 — une ligne `CLIQUET:` cite une référence qui n'existe NULLE PART dans l'arbre : la classe « chiffre non pris sur les objets », déclarée RÉSORBÉE au palier précédent, RÉCIDIVE.** `git show -s --format=%B 6334e651a`, ligne 26 :

> `CLIQUET: src/ui/compendium/registry-enveloppe.test.ts +2 — enveloppe Codex gelée : catégorie « Défauts de compilation » (clés et forme `id label sections`), empreinte mesurée à son entrée, jumelle de `semencesDeScene` (`296965162`)`

Mesure : `git grep -c "296965162" 9d66de88f` → **`rc=1`, aucune ligne** ; idem sur `6334e651a`. Les deux empreintes réelles, lues au diff des deux commits, sont `"semencesDeScene": 'b0f469f176864315'` (`d286914ff`) et `"defautsDeCompilation": '2cf25f78c6cd4dbd'` (`6334e651a`). Le nombre cité n'est ni l'une, ni l'autre, ni un préfixe de l'une ou l'autre, ni présent ailleurs dans le dépôt — c'était le SHA du train 1 AVANT le rebase de publication (`296965162` → `d286914ff`), une référence que la réécriture de l'histoire a rendue morte. Le delta `+2` est JUSTE et la ligne nomme le BON porteur : le défaut porte sur la RAISON, qui adosse le cran à une jumelle identifiée par une valeur périmée. C'est exactement la classe que le palier précédent a mise quatre fois en grief puis déclarée résorbée — un identifiant écrit dans un message sans être relu sur l'objet au moment de l'écriture — et elle revient dans la pièce même dont le rôle est de rendre un cran AUDITABLE.

→ attendu : la ligne `CLIQUET:` ne cite un identifiant (empreinte, SHA) que s'il est **relu sur le dépôt** au moment de l'écriture et STABLE sous rebase (une empreinte de fichier, jamais un SHA de branche non publiée). `fichier:ligne` : `git show -s --format=%B 6334e651a` (l.26) vs `src/ui/compendium/registry-enveloppe.test.ts` (les deux empreintes réelles). **Non bloquant, mais c'est la RÉCIDIVE d'une classe déclarée éteinte.**

**Grief 2 — le solde #1789 annonçait « 22 options électives » là où l'objet en rend 23.** `.claude/soldes/1789.md:3`, § recette : « éditeur dédié `offTerrainMod` : **22 options** électives sans « Vide (étage) » ni « Mur », défaut « Sous-bois » ». Mesure par sonde vitest sur le seam lui-même : `terrainsElectifs() = 23`, `tousLesTerrains() = 25`, et l'arithmétique du seam est vérifiée à l'unité — 25 terrains moins le porteur d'`absence` (`vide`) moins le porteur de `bordDuMonde` (`mur`) = **23**, ids rendus dans l'ordre du registre (`bois,boue,cendre,…,tourbe`, 23 items comptés). Le `<select>` est lié au seam par un test RELATIONNEL exemplaire (`GameOpEditor.offTerrainMod.test.tsx:46` : `expect(select.querySelectorAll('option')).toHaveLength(terrainsElectifs().length)` — **aucun cardinal gelé**, doctrine tenue), donc l'écran rend bien 23 options : c'est le CHIFFRE DU SOLDE qui était faux, pas le code. Corrigé au solde avant la clôture (écrit en RELATION : « 25 terrains moins les deux porteurs de rôle, soit 23 »). Même classe que le grief 1, sur la pièce de fermeture.

→ attendu : tout cardinal d'écran consigné dans un solde se relit sur le seam qui l'alimente avant la fermeture (ici `terrainsElectifs().length`), ou s'écrit en RELATION plutôt qu'en nombre nu. `fichier:ligne` : `.claude/soldes/1789.md:3` ; `src/state/terrain/index.ts:114` (`terrainsElectifs`) ; `src/ui/editor/GameOpEditor.offTerrainMod.test.tsx:46`. **Non bloquant — le code et son test sont justes.**

**Grief 3 — le cliquet `STRUCTURES_DEFAUT` est RELEVÉ 27 → 28 alors que le réel tenait sous l'ancien plafond : hausse sans contrepartie, et le mou de 1 est reconduit.** Mesures collées au § Commits : réel **26 → 27** (une entrée, `semences-de-scene.json › ambientLight`) ; plafond **27 → 28** (`cd9bb3299:src/data/structures-contrat.test.ts:610` → `:623`). L'assertion est `n > plafond` : avec le réel à 27 et le plafond inchangé à 27, le test serait resté VERT. La hausse ne consomme donc AUCUN mou — elle en recrée un, identique à celui qui existait avant. Le fichier qui la porte écrit pourtant sa propre règle deux fois : « le terrain gagné se VERROUILLE : abaisser le plafond au réel mesuré » et « #1654 : plafond ≤ réel puis décroissant » (`structures-contrat.test.ts`, commentaires de `STRUCTURES_REDECLARATIONS`). Le contraste dans le MÊME lot est net et à l'honneur du codeur sur l'autre stock : `STRUCTURES_FORMES` consomme son mou à zéro (réel 465 → 468 sous plafond 468 au train 4, puis 471 sous plafond 471) — le geste juste existe donc, il n'a pas été appliqué au second stock. Redescendu à **27** dans le commit qui suit cette revue.

→ attendu : un plafond ne se relève que lorsque le réel le DÉPASSE ; le relever « pour accompagner » une ligne qui tient sous l'existant est une baseline relevée en silence. `fichier:ligne` : `src/data/structures-contrat.test.ts:623`. **Non bloquant.**

**Grief 4 — trois cliquets ont bougé sans la moindre ligne `CLIQUET:`, dont un que le code appelle lui-même « Cliquet REMONTÉ ».** Mesure au § Stocks : `26628b417` déplace `src/data/slots-contrat.test.ts` (`-const DETTE_ADOPTION_MAX = 346;` → `+const DETTE_ADOPTION_MAX = 348;`, précédé de huit lignes de commentaire ouvertes par « **Cliquet REMONTÉ 346 → 348 (#1716, 2026-09-18)** ») et `src/data/migrations-type-enveloppe.test.ts` (`-const PLANCHER = 120;` → `+const PLANCHER = 121;`) ; `26628b417` et `6334e651a` déplacent `src/data/structures-contrat.test.ts` (plafonds 468 → 471 et 27 → 28) ; et `d286914ff` ajoute **deux entrées** à l'enveloppe gelée `registry-enveloppe.test.ts` sans aucune ligne `CLIQUET:` (mesuré `CLIQUET=0` sur ce commit) là où son jumeau `6334e651a` déclare le même geste. Les lignes `CLIQUET:` posées nomment **le magasin** (`structuresStock.mjs`, `slotsStock.mjs`) ; **le plafond, lui, vit ailleurs** — dans les `.test.ts` de contrat — et c'est le plafond qui est la porte. Conséquence mesurable : `git log --grep=CLIQUET -- src/data/slots-contrat.test.ts` ne rend rien pour un cran que le fichier lui-même documente comme remonté. C'est la classe du grief 4 du palier `0dc3cba27` (« un `CLIQUET:` qui ne nomme pas le vrai porteur »), retournée : ici le porteur nommé est juste, mais **la moitié des porteurs n'est pas nommée**. Les raisons existent et sont bonnes — elles vivent dans la prose `JUGE:` et dans les commentaires du code —, mais elles ne sont pas dans le canal que la revue de palier lit.

→ attendu : une ligne `CLIQUET:` par FICHIER dont un cran bouge, plafond compris — ou une garde de pré-commit qui, pour tout fichier du corpus « cliquet/stock/baseline » modifié par un commit, exige une ligne `CLIQUET:` nommant ce chemin (le corpus est déjà énumérable : `stocksNominatifs.mjs` le connaît). `fichier:ligne` : `src/data/slots-contrat.test.ts` (`DETTE_ADOPTION_MAX` 346 → 348, `26628b417`) ; `src/data/migrations-type-enveloppe.test.ts` (`PLANCHER` 120 → 121, `26628b417`) ; `src/data/structures-contrat.test.ts:596,623` (`26628b417`, `6334e651a`) ; `src/ui/compendium/registry-enveloppe.test.ts` (`d286914ff`, `CLIQUET=0`). **Non bloquant.**

**Grief 5 — le trailer `Claude-Session` RÉGRESSE : 9 des 11 commits de substance n'en portent aucun, dont les CINQ du lot principal et les DEUX de #1788.** Mesure collée au § Commits (`SESSION=` par sha). Les deux seuls porteurs (`cae545c73`, `5d70c4225`) sont les commits du lot #1695, hérités de la session du palier précédent. Trajectoire sur quatre paliers : 8/10 absents → 5/10 → 3/9 → **9/11**. Le motif identifié au palier précédent (« c'est le CANAL de publication qui ne pose pas le trailer ») est ici confirmé par l'extension : deux lots publiés par deux chantiers distincts (`chantier/1716`, `chantier/1788`), zéro trailer sur l'un comme sur l'autre, alors que `Co-Authored-By: Claude Fable 5.1` est posé sur les onze.

→ attendu : inchangé — le trailer se pose par le même geste que `Co-Authored-By`, c'est-à-dire par l'OUTIL (`ops:publier`), pas par le rédacteur ; à défaut, la porte de commit refuse un commit de substance sans trailer de session. `fichier:ligne` : `git log cd9bb3299..9d66de88f --format='%h %(trailers:key=Claude-Session,valueonly)'`. **Non bloquant.**

**Grief 6 — l'instrument de palier reste ROUGE sur #1785, deuxième palier consécutif, sans le moindre geste.** Repris du grief 1 du 2026-09-18, re-mesuré ici à l'identique : `fermeturesHorsCommit.disponible = false`, même issue, même `raison`, même « 1 écart(s) à la baseline » ; aucun commit de la fenêtre ne touche `scripts/ops/fermetures-non-citees.mjs`. Le détecteur qui rougit toujours ne détecte plus rien : **pendant deux paliers, aucune fermeture hors commit n'a été mesurable**, et ce palier en a précisément deux À VENIR (#1716, #1789) dont les soldes ne sont pas encore suivis. Le « geste d'une ligne » (#1785 à la baseline) est REFUSÉ par construction : `fermetures-non-citees.test.mjs:12` tient le plafond de la baseline (12) hors du JSON, précisément pour qu'ajouter une ligne ne soit pas le chemin le plus court — une garde qui valide des défauts. La seule sortie est #1793 (exemption dérivée du registre des workflows, ouvert par le lot le 2026-09-18).

→ attendu : #1793 au prochain lot d'outillage. `fichier:ligne` : `scripts/ops/fermetures-non-citees.mjs:45` (`TITRE_CANARI`). **BLOQUANT pour l'instrument.**

## Non couvert par ce jugement

(a) **`npm test` complet n'est pas rejoué** (consigne du brief) : les annonces « 755 fichiers node / 41 jsdom » (solde #1716), « 13 fichiers / 316 tests » et « 2761 tests » (solde #1788) sont prises pour vraies. Trois exécutions ciblées ont été jouées et sont toutes vertes : `matieres-en-donnee.test.ts` 11/11, `fichierVitest.test.mjs` 6/6 en `node --test`, et la sonde de palier 1/1. (b) **`typecheck`, `lint`, `build`, `docs:check`, `map:check opera`, `npm run gates` ne sont pas rejoués** (consigne). (c) **Aucun contrôle visuel** : les douze captures `public/qc/soldes/1789-*.png` sont vérifiées PRÉSENTES au `git status` et NOMMÉES au solde, jamais ouvertes ; les claims de recette reposent sur les recettes du 2026-09-18 et ne sont pas re-jugés à l'écran. (d) **Le « 77 » de `77 → 0` n'est pas rejoué** : c'est un comportement MUTANT, hors d'atteinte d'une sonde en lecture seule ; seul le `0` est mesuré, à l'aller et au retour. (e) **Les autres mutations annoncées** (`cheminDeRonde → 'pierre'` rouge sur `mapSpec.ts:728`, site `kind` retiré du corpus, `'mur'` planté dans `Inspector.tsx`, « hors `DEDICATED` » → 4 rouges) ne sont pas rejouées. (f) **Les « 418 diagnostics / 372 sites »** de #1794 ne sont pas rejoués : la sonde est nommée et ventilée AU TICKET, avec son arbre, ce qui satisfait le credo, mais sa sortie n'est pas collée verbatim. (g) **Le contenu GitHub des tickets** n'est recroisé que sur `number/state/title/createdAt/closedAt/actor` et, pour #1794, sur le paragraphe de constat. (h) **La dérive de branches n'est pas re-mesurée** ce palier — la seule mesure faite est `git log --oneline origin/main..HEAD` = 5, tous du lot.

## Verdict

verdict: PARTIEL

**Le socle de ce palier est le plus dur des cinq sur ses axes structurels, et trois griefs du palier précédent tombent par la mesure** : la tête publiée `82f487a64` est verte à la **première** tentative (`run_attempt = 1`, API collée) comme les deux autres têtes de train, et la CAUSE du rouge non déterministe qui avait forcé la relance précédente est **éteinte dans cette fenêtre même** par #1788 — un grief de palier résorbé par un lot, pas par la chance ; la couverture `JUGE:`/`REFUTATION:` remonte de 6/9 à **10/11**, le seul manquant étant un diff d'UNE ligne mesuré au `--numstat` ; une seule archive de revue est posée, qui enchaîne exactement sur la base d'aujourd'hui ; la fermeture de #1788 porte son solde DANS le commit qui ferme, **un** reste routé vers une cible **OPEN ouverte 3 h 52 avant**, `verdict: CONFIRMÉ` nommé avec cinq attaques écartées par mesure, fermeture posée par `github-actions[bot]` pendant le run vert ; `refus: []`, `notes: []` sur 15 commits, zéro écart au stock d'audit ; **aucun fichier CSS touché, aucune classe neuve** sur toute la fenêtre ; les cinq commits locaux sont tous du lot, rebase propre, aucun commit étranger. Surtout, **la doctrine « exemption au SITE, jamais au fichier » est tenue sur les deux gardes nommées au brief, et vérifiée site par site** : `matieres-en-donnee.test.ts` porte un contrat de vie **au grain du CHAMP** qui rougit sur toute exemption morte, ses quatre seuls littéraux de chemin sont des assertions POSITIVES de couverture, et la mesure par champ a fait TOMBER un neutraliseur mort (`kind` du bras matières) — un stock qui décroît par la garde elle-même ; `fichierVitest.mjs` refuse l'exemption par nom dans son en-tête et rend 6/6 en `node --test`. Onze annonces ont été reprises sur les objets, **huit exactes à l'unité** (5 lignes `WorldMapEditor` = 6 − 1 union déclarée ; 25 terrains / 1 `absence` / 1 `bordDuMonde` / 5 `ascii` uniques ; enveloppe 130 → 131 par comptage des empreintes ; `STRUCTURES_FORMES` réel 465 → 468 → 471 sous plafond 468 → 471, mou à **zéro** ; `resizeGrid` à 0 avertissement à l'aller et au retour ; deux cliquets au diff ; deux gardes vertes). Ce qui ne tient pas est concentré et nommé : **(1)** une ligne `CLIQUET:` adosse son cran à une référence `296965162` qui n'existe NULLE PART (`git grep -c` → `rc=1`) — un SHA d'avant rebase, mort à la réécriture ; la classe « chiffre non pris sur les objets », déclarée RÉSORBÉE au palier précédent après quatre récidives, **revient** ; **(2)** le solde qui ferme #1789 annonçait « 22 options électives » là où le seam en rend **23** (25 − 2 porteurs de rôle, sonde collée) — le code et son test relationnel sont justes, la pièce de fermeture est corrigée avant clôture ; **(3)** le cliquet `STRUCTURES_DEFAUT` est relevé 27 → 28 alors que le réel passe de 26 à 27 et tenait sous l'ancien plafond : hausse sans contrepartie, mou de 1 reconduit, contre le régime que le même fichier écrit deux fois — et contre le geste EXEMPLAIRE que le même lot applique à `STRUCTURES_FORMES` ; redescendu à 27 après cette revue ; **(4)** trois cliquets ont bougé sans ligne `CLIQUET:`, dont `slots-contrat.test.ts` que le code appelle lui-même « Cliquet REMONTÉ 346 → 348 », plus l'enveloppe de `d286914ff` que son commit jumeau déclare et pas lui ; **(5)** le trailer `Claude-Session` régresse de 3/9 à **9/11 absents**, les cinq commits du lot principal et les deux de #1788 n'en portant aucun ; **(6)** l'instrument reste ROUGE sur #1785 pour le deuxième palier, la mitigation d'une ligne étant refusée par construction du test de baseline — #1793 est la seule sortie. Persistent enfin au caractère près, troisième palier consécutif : `ECRIT_LU['test'].lit` sans `scripts/` (`toutes.mjs:219`), l'exemption au FICHIER portant un cardinal (`registry-id-branch-guard.test.ts:161`), le `--diff-filter=A` seul de `revuePalier.mjs:118` (#1777 OPEN), et deux restes versés à l'épique d'inventaire #1680 hors du plafond de reste — moitié moins qu'au palier précédent, mais par la même porte de service.
