---
name: game-doctrine-une-entite-n-livres-n-variantes
description: "DOCTRINE user 2026-07-17 : presque toute entité (talent/trait/compétence/objet…) peut être définie dans PLUSIEURS livres — mais JAMAIS ce ne sont deux entités différentes. UNE entrée, N sources, N variantes gatées par la règle optionnelle."
metadata: 
  node_type: memory
  type: project
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**DOCTRINE utilisateur (2026-07-17, verbatim)** :

> « Il faut bien savoir qu'un talent, un trait, une compétence, enfin presque tous les objets sauf potentiellement les creatures et une arme de siege tres particliere, peuvent se trouvé défini dans plusieurs livres. Souvent c'est pou exprimer un changement de comportement si une régle optionnelle s'active, ou pour apporter des précision car le talent de base est flou sur certains points, ou car il se trouve dans 2 livres de régle et qu'ils ne veulent pas forcer les MJs a tous les acheter, donc ils redonnent la description. **Mais jamais ca ne sera 2 talents différents.** Par contre il faut gérer l'ensemble des cas: bien référencer l'ensemble des livres et pages, gérer les régles alternatives en cas d'activation de régle optionnelle … »

## Ce que ça établit

1. **Le multi-livres est la NORME, pas l'exception** — pour presque toute entité. Exceptions possibles : les **créatures**, et « une arme de siège très particulière » (l'user lui-même hedge).
2. **TROIS raisons de la redéfinition, toutes légitimes** :
   - **variante conditionnée à une RÈGLE OPTIONNELLE** (« si vous utilisez les règles de X ») ;
   - **précision** parce que le texte de base est flou sur certains points ;
   - **republication pure** — le livre re-donne la description pour ne pas forcer les MJs à acheter tous les livres.
3. **JAMAIS deux entités différentes.** C'est la clause qui décide de tout.
4. **Il faut gérer TOUS les cas** : référencer **l'ensemble des livres et pages**, ET **les règles alternatives** activées par une règle optionnelle.

## Ce que ça INVALIDE — et que j'avais consigné à tort

⚠ **Ma règle « en trois cas » du même jour (`game-collision-livres-identique-vs-divergent`) est FAUSSE sur son cas (C)** : j'y écrivais « les livres DIVERGENT → entrées DISTINCTES ». **Non** : une divergence est une **VARIANTE de la même entité**, pas une seconde entité. Le patron `3b651133` (« Mur de pierre AA en entrée distincte par source », #450) ne peut donc pas servir de précédent pour des talents/traits/compétences. (⚠ à vérifier avant de le révoquer : `3b651133` porte sur `structures.json`, et il n'existe qu'une entrée `mur-de-pierre-aa` sans contrepartie LDB — la « coexistence » qu'il annonce n'est peut-être pas ce que son message dit.)

Et la mesure du corpus qui classait **20 familles en « (C) divergentes — coexistence justifiée »** doit être **relue à cette lumière** : ce sont 20 entités à variantes, pas 40 entrées.

## Le modèle qui en découle

**UNE entrée par entité**, portant :
- **N emplacements** `(livre, folio)` — l'ensemble des livres et pages, y compris multi-folio dans un même livre (l'index imprimé du LDB le fait : `Armure 299, 338` ; `Taille 40, 162, 342`) ;
- **N variantes**, chacune **gatée par sa règle optionnelle**, jamais par le livre d'origine de l'entité.

**L'axe est le MODULE DE RÈGLES, jamais la source.** Mesuré : 12 des 29 cas se discriminent par le module « Avantages de groupe » (AA Annexe I, folio 134) — l'Annexe III d'AA réécrit les talents du LDB **pour ce module**. Le gate existe déjà côté moteur : `groupAdvantage()` (`src/state/combat/advantagePool.ts`). Le bug fondateur (`redoutable`, corrigé en `e8069c1a`) venait précisément d'avoir indexé la variante sur `source.book` au lieu du module.

⚠ **La règle 5 reste** : chaque texte affiché est un verbatim recollable dans SON `Source/`. Une variante porte donc SON propre texte et SA propre réf — sinon la forme multi-source devient une **machine à blanchir la règle 5** (deux textes différents derrière une desc unique, CI verte).

## État du chantier (2026-07-17)

- **29 entrées multi-emplacement mesurées** (plancher : 40 % du corpus a une desc introuvable verbatim, donc non mesuré). Concentrées sur 3 coutures : AA met à jour le LDB (15), MDG réimprime AA et T2C (10), le ZI (4).
- Tickets OUVERTS : **#563** (capacité d'expression de `source`), **#560** (folios réellement faux), **#565** (un sort affiche la desc d'un autre), **#566** (index du LDB amputé du bloc D-I, et chapitre des Traits sans marqueurs → folios irréfutables par construction).
- Contraintes de forme établies : `page: number[]` est FAUX (un emplacement est une paire livre+folio) ; `refs[0]` doit ancrer la `desc` ; les emplacements ≥1 doivent être **auto-attestants** (label retrouvé dans le span, ou `quote` authoré prouvé verbatim) ; deux trous permissifs à réparer dans le même geste (`citationCoverage.mjs:16` et `folioIntegrity.mjs:268` excluent silencieusement la forme liste). Côté Codex, `CodexSource` (`src/ui/compendium/registry.ts`) est une PROJECTION d'affichage de `SourceRef` (`Pick<SourceRef, 'page'> & { book: string }`, `book` résolu en abréviation) : `SourceRef` (`src/data/schemas/common.ts`) reste la SEULE forme à importer.

Lié : [[game-collision-livres-identique-vs-divergent]] (⚠ son cas (C) est SUPERSÉDÉ par cette fiche), [[game-source-page-multi-folios-convention-raw]], [[game-collisions-variantes-livres-deferred]], [[game-collision-edoc-ldb-belliqueux-tranchee]], [[feedback-un-detecteur-ne-mesure-que-sa-couverture]], [[game-data-driven-architecture]].
