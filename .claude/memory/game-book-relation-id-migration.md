---
name: game-book-relation-id-migration
description: "source.book référence un id NEUTRE de livre (slug), plus l'abr — relation-livre id-pure ; bookAbr résout id→abr à l'affichage ; garde book-source-integrity"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8eeaebe7-e73c-4d41-8f69-3ac4d806d48c
---

Migration 2026-07-06 (`21aa4881`) : `books.json` était le DERNIER catalogue non keyé par id. Désormais
chaque livre a un `id` neutre (slug : `livre-de-base`, `mer-des-griffes`, `archives-de-l-empire-2`…) ;
`abr`/`label` = AFFICHAGE seul. **`source.book` porte l'`id` du livre, plus l'abréviation** (~2292 valeurs
migrées sur 39 fichiers data). Ne JAMAIS remettre un abr (`'LDB'`) dans `source.book`, ni comparer
`source.book === 'LDB'` — utiliser l'id (`=== 'livre-de-base'`).

- Résolution d'AFFICHAGE : `bookAbr(id)` (`src/data/index.ts`) → abr, câblé au choke-point UNIQUE `src()`
  de `src/ui/compendium/registry.ts` (toute ligne source + la facette « Livre » en dérivent).
- `bookContents(bookId)` matche par id ; le match par **label** (translation-fragile) a été SUPPRIMÉ —
  c'était LA violation du credo « relations id-based, jamais par libellé » relevée par l'utilisateur.
- Contenu fan communautaire = livre `frenchy-bzh` (ex-sentinel `frenchy.bzh`, cf. `curation-lot8`).
- Garde `src/data/book-source-integrity.test.ts` : tout `source.book` ∈ ids de `books.json` (source de
  vérité ENFORCED). Carte + conventions → `docs/donnees.md` §B, cf. [[game-json-data-add-guardrail]].
- Réconciliations Source-vérifiées (ma 1re supposition T3→PDTC était FAUSSE) : `ADE II`→ADE2 ;
  `T2C`→Mort sur le Reik Compagnon ; `T3` (Hypnotisme)→Pouvoir derrière le Trône (base, dossier confirmé).
- Suivi ouvert : l'éditeur de source du Codex (`CodexEdit`) est en texte libre → devrait devenir un
  picker de livre par id. Recette navigateur live restée PENDANTE (navigateur détenu par une session //).
