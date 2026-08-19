# Reprise après pause

Référence vivante : que faire pour repartir de zéro (nouvelle machine, clone frais) après une
longue pause. Chaque chemin/symbole cité existe dans le repo — vérifié via `npm run docs:check`.

## 1. Redémarrage code (clone nu → jeu qui tourne)

```bash
git clone <url> && cd Game
npm install     # pose core.hooksPath via le script "postinstall" (package.json)
npm test        # vitest run — suite du moteur
npm run dev     # http://localhost:5173
```

`npm install` déclenche `"postinstall": "git config core.hooksPath scripts/git-hooks"`
(`package.json`). **Sans ce postinstall, deux mécanismes sont MORTS** : le hook
`scripts/git-hooks/pre-commit` (gardes anti-poison/anti-dérive avant chaque commit) et
`scripts/git-hooks/post-commit` (ferme automatiquement les issues GitHub citées dans le
message de commit via `fixes/closes/corrige/ferme #N`, cf. commentaire de tête du script).

`src/data/*.json` est la **SOURCE app-owned** : rien à régénérer après le clone.

Le canari hebdomadaire (`.github/workflows/canari.yml`, cron lundi 06:00 UTC) exécute
exactement ce chemin en CI — `npm ci` puis `npm run gen`, `typecheck`, `lint`, `test`, `build`,
`docs:check`, `raw:coverage`, `raw:reconcile`, et le typecheck du serveur relay (`server/`).
S'il casse, il ouvre automatiquement une issue GitHub taguée `canari` (bloc `gh issue create`
en fin de workflow) — c'est le signal qu'un geste manuel a dévié de ce que `npm install` pose seul.

## 2. Ce que le clone CONTIENT

- `Source/*.md` — texte des livres, **citable** (réfs `LDB <chap> l.<ligne>`).
- `src/data/` — données app-owned (JSON commité, éditable au Compendium).
- Les gardes : `scripts/guards/` (`validate-data.mts` + `scripts/guards/lib/` : `commentPoison`,
  `emojiAffordance`, `hardcode`, `labelLogic`) et les hooks Claude Code de session
  (`scripts/hooks/*.mjs`, déclarés dans `.claude/settings.json` : garde anti-réinvention Write,
  grounding donnée, garde `[entériné]`, garde git destructif, garde anti-poison post-écriture).
- Les schémas de données : `src/data/schemas/` (`types.ts`, `common.ts`, `_registry.generated.ts`,
  `defs/*.ts` — un fichier par catalogue : `traits.ts`, `qualities.ts`, `spells.ts`, `creatures.ts`…).
- `scripts/art-ref/` — le PIPELINE d'extraction d'images (`extract.py`, `probe.py`,
  `ldb_extract.py`, `ldb_map.py`) : le code est tracké, ses SORTIES (images) ne le sont pas
  (§3).
- `docs/decisions/` (`issues.json`, `issues.md`) — les issues GitHub EXPORTÉES chaque mardi
  06:00 UTC par `.github/workflows/export-issues.yml` (`npm run issues:export` →
  `scripts/ops/export-issues.mjs`, commit auto si diff).

## 3. Ce que le clone NE contient PAS — et où ça vit

| Non-versionné | Pourquoi (`.gitignore`) | Régénération / accès |
|---|---|---|
| PDFs de `Source/*.pdf` | droits Cubicle 7, taille (limite GitHub 100 Mo/fichier) | conservés LOCALEMENT ; ré-extraction via `bash scripts/raw/reextract-all.sh` (Marker, staging `Source/_marker/split/`, **ne promeut pas** — revue manuelle avant d'écraser `Source/`) |
| `/art-ref/` (images extraites des PDF) | droits Cubicle 7, ce sont des sorties | régénérables via `scripts/art-ref/` + les PDFs locaux |
| Compte Cloudflare du relay coop | secret/infra externe | URL prod dans `src/net/relay.ts` (`RELAY_URL_PROD`) ; redéployable via `npm run relay:deploy` (`npm --prefix server run deploy`) |
| Publication du jeu en prod | workflow GitHub Actions | cf. `CLAUDE.md` § Déploiement — `.github/workflows/deploy.yml` (déclenchement manuel, build du commit de `main`) ; secret Actions `PROD_DEPLOY_KEY` (deploy key SSH) requis côté dépôt. Aucun clone local du dépôt prod nécessaire |
| Auth `gh` (CLI GitHub) | credentials locales | nécessaire pour : fermeture auto d'issues (`post-commit`), export hebdo (`export-issues.yml` tourne en CI avec son propre token), et toute commande `gh` manuelle |

## 4. Archivage des non-versionnés

Cadence recommandée : **à chaque nouveau livre importé** (PDF + art-ref associé), archiver vers
un stockage externe (l'utilisateur y consolide déjà les PDFs sources).

```powershell
Compress-Archive -Path "Source\*.pdf","art-ref" -DestinationPath "<stockage-externe>\game-sources-$(Get-Date -Format yyyy-MM-dd).zip"
```

Adapter `<stockage-externe>` (disque externe, cloud perso) — cette commande ne fait QUE lire
les non-versionnés locaux, elle ne touche pas au repo.

## 5. Portes de qualité — où elles vivent, comment vérifier qu'elles tournent

- **Hook Git local** (pre-commit / post-commit) : posé par `npm install` via `core.hooksPath`.
  Vérifier : `git config core.hooksPath` doit répondre `scripts/git-hooks`. Si vide → hooks
  MORTS, refaire `npm install`.
- **Hooks Claude Code** (gardes anti-dérive à l'écriture) : déclarés dans `.claude/settings.json`
  (versionné, cf. `.gitignore` : `.claude/*` est ignoré SAUF `settings.json`/`credo.md`/`skills/`
  /`workflows/`). Vérifier : `cat .claude/settings.json` doit lister les hooks `PreToolUse`
  (`new-src-file-guard.mjs`, `data-edit-guard.mjs`, `enterine-guard.mjs`,
  `git-destructive-guard.mjs`), `PostToolUse` (`poison-postcheck.mjs`) et `SessionStart`
  (injection de `.claude/credo.md`).
- **CI** : `.github/workflows/ci.yml` (à chaque push), `canari.yml` (hebdo, rejoue l'installation
  à froid), `export-issues.yml` (hebdo, exporte les issues). Vérifier qu'elles tournent : onglet
  Actions du repo GitHub, ou `gh run list --workflow=canari.yml`.
