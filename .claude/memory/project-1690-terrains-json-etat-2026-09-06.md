---
name: project-1690-terrains-json-etat-2026-09-06
description: "État du chantier #1690 (les 25 terrains passent des modules TS src/state/terrain/defs/*.ts à src/data/terrains.json, règle + rendu dans une entrée, Codex « Terrains ») au 2026-09-06 — choisi par le user après #1686 ; lot 1 = grounding + invariant + juge de design ; porte la ligne de DoD qui fermera #1686"
metadata:
  type: project
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
---

Chantier #1690 démarré le 2026-09-06 dans la session `game-0f` (worktree `.wt-1624`), choix utilisateur « #1690 — terrains TS → terrains.json » parmi les restes de #1686/#1680. Fichiers de travail sous `.wt-1624/node_modules/.cache/` : `invariant-1690.md`, briefs `brief-1690-L*.md`, sondes `juge1690/`, sonde d'identité de rendu `sonde1686/identite.mts` (hash des `FaceSurface` des 65 scènes livrées — 55 033 faces `terrain` sur 94 817).

**Arbitrage user (2026-09-05, verbatim)** : « Hors matières, ticket TS → terrains.json » — un terrain est une ENTITÉ de jeu (marchable, opaque, priorité, cible de clés étrangères) qui A une matière ; règle + rendu dans UNE entrée, jamais scindés ; rappel « rien ne doit etre en dure, tout doit etre éditable — datadriven ».

**Mesuré (lecteur 2026-09-06)** : 25 defs (le ticket disait 24), toutes des LITTÉRAUX purs (`export const terrain: TerrainDef = {…}`, 0 fonction, 0 import runtime) → la migration est un DUMP ; `TerrainDef` = `TerrainMeta` (id, label, walkable, priority, opaque?, built?) + rendu (detail?, gradient, swatch, stops, overlayProp?, solidHeightM?) ; façade `state/terrain/index.ts` (`terrainWalkable/Priority/OverlayProp/SolidHeightM/Detail`, `TERRAINS`) lue par 58 fichiers ; `Terrain = string` NU dans `scene.ts:53`, aucun `terrain` dans `ref.ts` `TYPES` ; `gen-registry.mjs:304-312` émet `_registry.generated.ts` ; scripts one-shot morts `scripts/_terrain-migrate.mts`/`_terrain-golden.mts` ; exception de pureté `gameiso-purity.test.ts:27-32` (`terrain/types.ts` importe le TYPE `DetailRecipe`) qui meurt avec le déplacement du type en `src/data/terrains.types.ts` ; collisions `pierre`/`porte`/`terre` avec relief/structure MESURÉES et tolérées (cliquet `materials-identite`).

**Invariant (à juger)** : dataset `terrains.json` par `document('terrains','entite')`, une forme sans discriminant, `detail` par `detailRecipeSchema`, `maison` via `sans-livre` ; façade `state/terrain/index.ts` conservée mais VIVE (lit `terrains` de `src/data/index.ts` à l'appel, `ARRAYS`), `catalog/terrain.ts` dérive à l'appel, `worldBakeDeps` porte les terrains de la scène par identité ; référence typée `idDe('terrain')` sur les sites de donnée ; morts purgés ; migration datée tout-ou-rien avec banc de portes ; Codex « Terrains » sous « Monde » (lot 3, recette + juge vision) ; `corrige #1690` avec au plus UN reste routé, puis fermeture de #1686.

**Régime rappelé ce jour** : une seule charge lourde par machine, PRÉAVIS par message (#1679) avant toute suite ou gates ; sonder la CI de chaque push avant d'enchaîner ; au retour d'un agent, vérifier qu'il ne laisse aucun processus (`node_modules/.cache/processus-wt1624.mjs`).

**Why:** reprise sans relire le ticket ni les rendus. **How to apply:** lire cette fiche, `gh issue view 1690 --comments`, puis l'invariant et le dernier brief. Liens : [[project-1686-materiaux-etat-2026-09-05]], [[user-arbitrages-2026-09-05-materiaux-1686]], [[feedback-sonder-la-ci-de-chaque-push-avant-d-enchainer]].
