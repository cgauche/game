# Spec — Grounding du travail data dépêché

> Daté 2026-07-06. Design validé en brainstorming. Motivé par l'incident **#148 Bélier** (un sous-agent
> Sonnet a ajouté une entrée fausse et dupliquée dans `trappings.json`), reframé en « prendre de la
> hauteur » : le vrai trou n'est pas « il manque un skill », c'est que le travail data **dépêché à un
> agent** n'est ni outillé pour découvrir l'existant, ni contraint de le faire — et que **les skills ne
> se déclenchent jamais dans un sous-agent** (`<SUBAGENT-STOP>`), donc le skill que le rapport réclamait
> n'aurait rien changé pour l'agent fautif.

## 1. Problème (prouvé sur le code, pas sur le rapport)

Trois constats vérifiés qui recadrent le rapport `docs/plans/2026-07-06-rapport-skill-ajout-donnee.md` :

1. **Une garde de collision existe déjà et n'aurait PAS attrapé #148.** `src/data/id-collisions.test.ts`
   verrouille `cross === KNOWN_CROSS` ; `belier` y est **déjà** listé (qualité↔sort). Ajouter
   `trappings.belier` garde `belier` dans l'ensemble des collisions connues et n'introduit aucun id neuf
   → **le test serait resté vert**. Cette garde protège l'**hygiène des ids** (ambiguïté de lookup), pas
   la **duplication sémantique** (même chose du monde modélisée deux fois) — et elle *autorise*
   explicitement les homonymes. La duplication sémantique ne se rattrape pas par une garde : par la
   **découverte**.
2. **Un skill ne se déclenche pas pour un sous-agent dépêché.** `using-superpowers` porte
   `<SUBAGENT-STOP>`. Le levier réel pour le travail dépêché est le **brief** (l'orchestrateur injecte le
   check-first) + une contrainte **mécanique** qui atteint l'agent en amont (hook) et en aval (gardes).
3. **Il n'existe aucun atlas des DONNÉES.** Le côté RAW a `docs/raw/00-index.md` ; les ~90
   `src/data/*.json` n'ont rien (`codex-relations.md` décrit les liens *dérivés* au Codex, pas « où vit
   le concept X, quelles conventions, qu'est-ce qui existe déjà »). Sans carte, « check-first » est
   *impossible* : l'agent ne pouvait pas découvrir que le Bélier vit dans `mass-battle.json`. Il vit en
   fait dans **6 fichiers** (`mass-battle`, `qualities`, `naval-traits`, `spells`, `vehicles`,
   `creatures`), pas 4.

**Classe du problème** : *grounding du travail data dépêché*. Réponse en **3 couches complémentaires**
(découverte / procédure / contrainte), pas un choix — le skill du rapport n'est qu'une des trois.

## 2. Décisions arrêtées

- Atlas = **`docs/donnees.md`** (doc plat, comme `sources-vf.md`/`charte-ui.md` — un doc, pas un dossier
  de fiches comme `docs/raw/`).
- Hook = **advisory non bloquant** (injecte du contexte, n'interdit pas l'écriture). Le hard-gate reste
  `npm test`. Un hook bloquant sur chaque édition data serait hostile pour un gain nul.
- Le format canonique n'est **jamais** paraphrasé : l'autorité est la fonction **`serializeDataset`**
  (`src/data/serialize.ts`), verrouillée à l'octet près par `serialize.test.ts`. L'atlas et le skill
  pointent vers elle, jamais vers un `JSON.stringify(...,2)` maison.

## 3. Non-objectifs (YAGNI)

- **Re-scoper #148** — fil séparé (§7), décision *produit* (exposer les machines de guerre au Codex ou
  acter la non-exposition), pas de la plomberie de grounding.
- **Réécrire les 5 skills de domaine existants** (`ajouter-un-sort`, `creer-une-creature`,
  `ajouter-une-mecanique`, `ajouter-une-icone`, `ajouter-un-livre-source`) — le nouveau skill **route**
  vers eux, il ne les remplace pas.
- **Détecteur de duplication sémantique** — infaisable proprement : « Bélier » = 6 concepts LÉGITIMES
  distincts, un garde dur serait du bruit pur. La défense contre ce cas est découverte + discipline.
- **i18n de l'atlas** ; **hook bloquant**.

## 4. Architecture — 3 couches

### Couche 1 — Découverte : `docs/donnees.md` (atlas des données)

Nouvelle **référence vivante**, sœur de `architecture.md`/`sources-vf.md`. Structure :

- **§A — Carte domaine → fichier.** Table exhaustive : *chaque* `src/data/*.json` (dérivée d'un
  `Glob src/data/*.json`, aucune omission), avec son domaine et un « contient » d'une ligne. Marque les
  **pièges d'homonymes** (⚠ « Bélier » vit dans 6 fichiers, avec le rôle de chacun). **Règle d'or**
  reprise du rapport : une table du livre intitulée « Machines de guerre / véhicules / navires » ne va
  **jamais** dans `trappings.json` (équipement PORTÉ) mais dans le fichier du sous-système.
- **§B — Conventions de champs.** `book` = abréviation canonique (table dérivée de `books.json` :
  `LDB`, `ADE II`, `EDO`… — jamais `ADE II`) ; `source.page` = **vraie page** (jamais le n° de chapitre ;
  ⚠ ancres Marker `span id="page-N"` NON fiables — confirmé par l'utilisateur) ; `desc` = **verbatim
  Markdown** (garde `no-html-in-prose`) ; formes de champ copiées des voisins (`damage:{plusBF,flat}`,
  `qualities:[{id}]`) ; ids stables ; **canonicalisation via `serializeDataset`** (jamais un stringify
  maison).
- **§C — Déroulé check-first.** Avant tout ajout : `grep -rniE '<id>|<label>|<concept>' src/data/*.json`
  (l'élément existe peut-être dans un autre sous-système). Puis router via §A. Si un skill de domaine
  existe → l'utiliser.
- **§D — Bloc « À COLLER DANS UN BRIEF D'AGENT DATA ».** Checklist copiable = **source unique** de la
  couche 3b ; référencée par le skill et par le hook.

**Honnêteté du doc (deux gardes) :**
- `docs:check` (existant) attrape déjà tout chemin `src/data/…` mort cité par l'atlas. **Gratuit.**
- **Nouveau** `src/data/data-atlas-complete.test.ts` : tout `src/data/*.json` (via `readdirSync`, scan de
  `src/data` **seul** — jamais les worktrees) doit être mentionné dans `docs/donnees.md`. La carte ne
  peut plus pourrir quand un fichier data est ajouté sans être cartographié.

Câblage doc : entrée dans la **table de routage `CLAUDE.md`** (« Ajouter/curer une donnée sous
`src/data/` → `docs/donnees.md` ») + mention dans la politique « docs/ = réfs vivantes ».

### Couche 2 — Procédure : skill `ajouter-une-donnee` (routeur)

Pattern du repo (skill mince → doc). Deux fichiers :

- `.claude/skills/ajouter-une-donnee/SKILL.md` — frontmatter `name` + `description` (déclencheur :
  « quand on ajoute/cure une entrée dans un `src/data/*.json`, ou dès qu'on est tenté d'ajouter un
  id/label sans avoir vérifié qu'il existe déjà ailleurs ») ; corps = un paragraphe pointant vers
  `docs/ajouter-une-donnee.md` + la règle de routage.
- `docs/ajouter-une-donnee.md` — la procédure. **En tête, la table de routage** : sort→`ajouter-un-sort`,
  créature/PNJ→`creer-une-creature`, effet de trait/talent/qualité/mutation/maladie→`ajouter-une-mecanique`,
  icône→`ajouter-une-icone`, nouveau livre→`ajouter-un-livre-source`. « Si ton ajout tombe dans une de
  ces familles → STOP, utilise le skill dédié. » Le déroulé générique ne vaut que pour le RESTE
  (trappings, qualités, groupes d'armes, carrières, mass-battle, naval, activités, critiques…). Déroulé =
  le §4 du rapport **corrigé** : check-first → router (§A de l'atlas) → vérifier la source RAW **en
  lisant l'en-tête de table** (l'erreur « Équipe » lue « Encombrement ») → chaque champ = source ⊕
  convention voisine → **zéro inflexion RAW** (RAW non modélisable → issue gabarit #101+ ou valeur
  `maison` taguée, jamais « hors scope » silencieux) → canonicaliser via `serializeDataset` + `npm test`
  + `npm run typecheck` → recette navigateur si visible au Codex/éditeur.

### Couche 3 — Contrainte : atteindre les sous-agents

- **(a) Hook `scripts/hooks/data-edit-guard.mjs`** — sibling calqué sur `new-src-file-guard.mjs`.
  Matcher `Write|Edit`. Lit `tool_input.file_path` ; si le chemin normalisé matche `src/data/*.json`,
  émet un `additionalContext` **concis** : « donnée app-owned → check-first (grep id+label+concept, un
  concept peut vivre dans un autre sous-système — cf. #148 Bélier ×6 fichiers) ; `docs/donnees.md` =
  carte + conventions ; skill de domaine si sort/créature/effet/icône/livre ; canonicaliser via
  `serializeDataset` + `npm test` ». Non bloquant (`console.log` du contexte, exit 0). **Seul levier qui
  atteint un sous-agent en amont** (comme le credo atteint la session). Honnête : il injecte du
  *contexte* que l'agent peut ignorer — mais supprime l'excuse « je ne savais pas » et met la carte à un
  hop. Enregistré dans `.claude/settings.json` (PreToolUse, matcher `Write|Edit`).
  > Extend-vs-sibling : `new-src-file-guard.mjs` ne fire que sur *nouveau fichier* (`!existsSync`), sur
  > matcher `Write` seul, avec un message anti-réinvention distinct. Concern + trigger + matcher
  > différents → **sibling** (pas de branche fourre-tout dans un script). Si un 3e guard PreToolUse
  > apparaît, extraire alors le helper `readToolInput(stdin)` partagé.
- **(b) Checklist de brief** = `docs/donnees.md` §D (source unique). L'orchestrateur la colle dans chaque
  brief d'agent dépêché sur de la donnée. Aucun fichier séparé.
- **(c) Gardes musclées** (plancher, pas filet principal — la limite du §1.1 tient) :
  - **Atlas-completeness** : `data-atlas-complete.test.ts` (couche 1) — la garde la plus utile car elle
    tient tout le système honnête.
  - **id-collisions : PAS d'extension** (décision révisée après investigation). L'idée d'étendre à
    `vehicles`/`naval-traits` reposait sur un misread : `vehicles.belier` est une ref *nichée* (invisible
    à un guard top-level), `naval-traits` est un catalogue *mixte* (`kind`) dont le moteur est déjà
    proprement data-driven (`navalPassiveOps` + champs `ram`/`deckCover` lus par présence, aucun
    `switch(id)`). Étendre n'adresserait **pas** la classe #148 (dup sémantique d'un homonyme déjà listé).
    On garde `id-collisions.test.ts` tel quel comme hard-gate d'hygiène d'ids.

## 5. Réutilisation (ce sur quoi chaque pièce s'appuie)

| Pièce | Mécanisme existant réutilisé |
|---|---|
| `docs/donnees.md` honnêteté | `scripts/docs/check-doc-refs.mjs` (chemins morts) + convention réf vivante |
| skill `ajouter-une-donnee` | pattern skill mince → `docs/*.md` (comme `ajouter-une-mecanique`) ; **route** vers les 5 skills de domaine |
| hook `data-edit-guard.mjs` | patron `new-src-file-guard.mjs` (stdin → `additionalContext`) + enregistrement `.claude/settings.json` |
| checklist de brief | section unique dans `docs/donnees.md` §D |
| gardes | `serialize.test.ts`, `no-html-in-prose.test.ts`, `id-collisions.test.ts` (étendue) |
| canonicalisation | `serializeDataset` (`src/data/serialize.ts`) |

## 6. Vérification (vérifié = prouvé)

- `npm test` vert (nouveau `data-atlas-complete` + `id-collisions` étendu + `serialize` + `no-html`).
- `npm run docs:check` vert (aucun chemin `src/data/…` mort dans l'atlas).
- `npm run typecheck` sortie complète.
- **Hook manuel** : `echo '{"tool_input":{"file_path":"src/data/trappings.json"}}' | node scripts/hooks/data-edit-guard.mjs`
  → imprime le rappel ; un chemin hors `src/data` → silence.
- **Rejouer #148 mentalement** : le hook fire (rappel + pointeur atlas) et `docs/donnees.md` §A montre le
  Bélier dans `mass-battle.json` → l'agent découvre le doublon avant d'écrire. C'est le gain. (La garde
  ne hard-fail toujours pas — assumé et documenté.)

## 7. Fil séparé — re-scoper #148

Le Bélier n'est pas « dormant faute d'existence » : il vit dans `mass-battle.json`. La qualité `belier`
est « dormante » au sens où aucun trapping PORTÉ ne l'utilise — ce qui est **normal** (une machine de
guerre crewée n'est pas un objet d'inventaire ; mécanisme conditionnel `capabilities.ram` correct depuis
#102). Le vrai besoin de #148 (« voir les dégâts conditionnels du Bélier au Codex ») est une **décision
produit** : exposer les machines de guerre de `mass-battle.json` au Codex, ou acter la non-exposition.
→ À re-scoper hors de ce chantier (commentaire sur l'issue), sans le noyer dans le grounding.
