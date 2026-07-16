---
name: game-descriptions-markdown-prose
description: "Descriptions data en Markdown rendu par <Prose> (ex-HTML) — migration livrée, règle 5"
metadata: 
  node_type: memory
  type: project
  originSessionId: 79086e8f-2b86-464f-8a9e-6f2bc67f4515
---

Les champs de prose des `src/data/*.json` (`desc`, `text`…) sont désormais en **Markdown verbatim**
(plus de HTML), rendus par l'unique primitive **`src/ui/Prose.tsx`** (`react-markdown` + `remark-gfm`,
HTML brut NEUTRALISÉ — pas de `dangerouslySetInnerHTML`). C'est la **règle 5** du `Game/CLAUDE.md`.

**Pourquoi react-markdown et pas markdown-it** (que l'user avait d'abord choisi) : markdown-it sort une
*chaîne HTML* → impossible d'y embarquer le composant React interactif `CodexRef`. On perdrait l'**auto-liage**
(le vocabulaire de règles — carac/compétences/talents/états/manœuvres/traits/qualités/domaines — devient
des `CodexRef` cliquables). react-markdown rend du React → un petit **plugin rehype** dans Prose réutilise
`tokenizeLinks` (source unique, `relations.ts`) pour wrapper les mentions en `<coderef>` mappé sur `CodexRef`.
Auto-liage préservé ET étendu aux descriptions riches.

**Flag `html` SUPPRIMÉ** de `CodexItem`/`CodexRow` + tous les `html: true` de `registry.ts` ; `LinkedText`
(CodexEntry) absorbé par Prose. Popovers/`title=`/blurbs en texte brut via **`mdToText`** (CodexRef,
MerchantPanel, InterludeScreen, ActionBar, CharacterCreator.blurb).

**Migration** : `scripts/data/html-to-md.mjs` (turndown + turndown-plugin-gfm), idempotent (ne touche que
les strings contenant encore une balise). Pièges réglés : (1) italique/gras en `style=` inline (cruft blog,
≠ `<b>`/`<i>`) ignorés par turndown → règle `styledSpan` ; (2) `<br><br>` collapse → règle `br → "\n\n"` ;
(3) **tables sans `<th>`** gardées en HTML par gfm → `promoteTableHeaders` promeut la 1re ligne. 396 champs
convertis, 19 fichiers.

**Garde-fous** : `src/data/no-html-in-prose.test.ts` (aucune balise HTML, tags nommés), `Prose.test.tsx`
(gras/ital/paragraphe/neutralisation HTML/auto-liage/selfLabel), `serialize.test.ts` round-trip OK (écriture
`JSON.stringify(v,null,2)`). Recette navigateur OK (table markdown rendue, 0 erreur console). 5519 tests verts.

Prolonge [[game-codex-compendium]] et [[game-codex-editable-json-free]]. Voir aussi [[feedback-reutiliser-avant-reinventer]].
