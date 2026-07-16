---
name: game-difficultes-combat-table
description: Table « Difficultés de Combat » (LdV/Couvert/Combiner/Météo/Taille T0-T1) livrée — où vivent les modules et ce qui reste
metadata: 
  node_type: memory
  type: project
  originSessionId: e5a266bc-492a-4aac-b27d-9bdea4ea9d63
---

Lot **« Table Difficultés de Combat »** (clôt le reliquat Jalon 1 « distance fine ») livré 2026-06-07, moteur pur+testé, ~12 commits, tsc 0 / lint 0 / 681 tests. Spec `docs/superpowers/specs/2026-06-07-difficultes-combat-table-design.md`, plan `docs/superpowers/plans/2026-06-07-difficultes-combat-table.md`.

**Livré (vivant en jeu, auto-dérivé des données de scène) :** Ligne de Vue (gate dur, héros+IA), Couvert 3 niveaux canon (−10/−20/−30 ; terrain `mur`/`bois`, bâtiments, décors par id, **empreinte multi-cases** `SceneEntity.foot {w,h}`, créatures intercalées), Combiner les Difficultés (plafonds −30/+60, Avantage `uncapped`), Taille (champ `Combatant.size` ordinal, dérivé au spawn via `sizeFromTraits`), size-to-hit au tir + **+10 au plus petit** (mêlée ET tir), obscurité/brouillard −20, tempête/neige −20 (neige aussi en **esquive** via `dodgeMod`), tir-dans-la-mêlée −20 + **redirection vers un allié** intercalé (`resolveStrayRangedHit`/`strayShotVictim`), tir-en-bougeant −10 (réutilise `battle.moved`), empreinte décor bloque la walkability.

**Architecture (important) :** `engine/size.ts` + `combineMods` (purs, engine) ; mais `state/lineOfSight.ts` et `state/sceneRules.ts` vivent en **state** (lisent `Scene` ; l'engine ne dépend jamais de state). Les mods dérivés de la scène (couvert/obscurité/météo/tir-mêlée/mouvement) sont calculés côté state (`combatFlow.resolveAttack(get,…)`) et **injectés** dans `attackModifiers` via `opts.env: ModLine[]` ; l'esquive-neige via `opts.dodgeMod`. Le size-to-hit (types engine) est calculé dans l'engine.

**RAW (ne jamais réinventer) :** valeurs verbatim de `14 - _GoBack.md` (Difficultés de Combat l.77-136, Combiner l.126-131) + `13 - Combat.md` l.123 (LdV) + `85 - Traits de créature.md` l.301-303 (+10 plus petit). Table NON exhaustive → l.75 autorise l'extrapolation (décor/créature-couvert documentés `[DESIGN]`). Cf. [[game-no-mj-model-everything]] + [[game-francais-jamais-anglais]].

**Task 11 (exposition éditeur) FAIT** : sélecteur **Météo** + champs **empreinte** (foot L×H) sur les décors ajoutés dans `Editor.tsx` (panneau Scène + inspecteur Décor) — commités dans HEAD (la session rig a commité `Editor.tsx` en bloc, embarquant mes hunks ; OK selon l'utilisateur, cf. [[git-commits-propres-wip-parallele]]). **Feedback de ciblage exact FAIT** (« Pas de ligne de vue (cible masquée) » au tir bloqué). **Reste (Task 12, recette + `IsoStage.tsx` rig-hot) :** griser visuellement les cibles hors-LdV. Les règles + l'exposition marchent déjà sans ça.

**Taille = sous-système à part (futur jalon), analyse complète : `docs/superpowers/specs/2026-06-07-taille-analyse-reference.md`.** Seuls T0 (champ+enum+parser) et T1 (size-to-hit) sont faits. Restent T2 (Dégâts ×N + Dévastatrice/Percutante + Frappe Mortelle), T3 (défense −2 DR parade + désengagement gratuit + Force opposée + Piétinement), T4 (Blessures par catégorie — piège : char.B des monstres déjà précalculé en data), T5 (Peur/Terreur — sous-système Psychologie neuf), T6 (footprint des créatures MOBILES = pathing multi-cases, partiellement bloqué rig). Voir [[game-gabarits-corporels]].

Cf. [[git-commits-propres-wip-parallele]] : la session rig possède `scene.ts`/`Editor.tsx`/`gameIso/*` en working tree ; j'ai committé mes hunks dans `scene.ts` via `git add -p` (stage sélectif → `git commit` sans pathspec), jamais `git commit -- scene.ts`. La branche est rouge en CI à cause du WIP rig non committé (career sur `EntityAppearance`, `equipment.ts`/`weapons/`), pas de mon code.
