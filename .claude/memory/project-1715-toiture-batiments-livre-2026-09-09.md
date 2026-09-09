---
name: project-1715-toiture-batiments-livre-2026-09-09
description: "#1715 LIVRÉ le 2026-09-09 (bâtiments TS → buildings.json, scene.roofDefaults EXIGÉ avec résolution corps > type > scène, plafond purgé) — leçons : une frontière de couches vivant en prose d'en-tête se réécrit sans bruit (garde structurelle posée), une allowlist d'un fichier n'est pas un périmètre, un hint décrit un câblage réel ou rien, un cardinal de migration se recale dans le train, fan-out #1716 (semences d'emptyScene en donnée)"
metadata:
  type: project
  originSessionId: 4407a64f-b0ad-4d3d-b30f-ffca252025d6
  modified: 2026-09-09T09:51:16.896Z
---

**#1715 livré (2026-09-09, wt-1624, trois commits : `plafond` 4c052ca9a, bâtiments 13450351a, toiture de scène = fermeture)** — dernier reste de #1686. Forme : `src/data/buildings.json` (7 types, `SANS_LIVRE` + `maison`, `roofMaterial: idDe('material','roof')`, `features: ref('prop',{anchor})` enum nommé, `defaultFoot` PURGÉ : 0 lecteur), façade VIVE en `src/state/buildings.ts` (domicile de `state/terrain`, #1690), `ArchitectureBody.style = idDe('building').optional()` (corps composites sans type), Codex « Bâtiments » ; `scene.roofDefaults` EXIGÉ `{material, pitchDeg référence 5–75, riseMaxStoreys}` sans `profile` (le socle choisit par portée), corps = surcharge partielle, `toitureEffective(scene, body)` corps > type > scène (matière), `DEFAULT_ROOF_DEFAULTS` = semence d'authoring de `scene.ts`, bump projet 8 → 9 (trois artefacts, `poseSurChaqueScene` partagé par [7]/[8]) ; `plafond` mort (faces `cliff`/`ramp`/`deck`/`pilier`), cardinaux de trois migrations recalés dans le train (régime `11a`).

**Leçons (mesurées)** :
- **Une frontière de couches qui ne vit qu'en PROSE d'en-tête se réécrit sans bruit** : le codeur a posé le premier import `src/state → src/gameIso` du dépôt et reformulé l'en-tête qui l'interdisait ; aucune garde n'existait. Garde structurelle posée (`src/state/frontiere-state-gameiso.test.ts`, mécanique `importGraph.mjs`). Restes nommés hors périmètre : `src/engine/types.ts` importe un TYPE de `gameIso/rig/appearance` ; `src/state` importe 3 types de `src/ui`.
- **Une allowlist d'UN fichier n'est pas un périmètre** : la garde des matières « sans exception nominative » filtrait `f === 'sceneEdit.ts'`. Périmètre entier + neutralisation par SIGNAUX structurels (`: Terrain`, `scope:`, `as const satisfies …Defaults`).
- **Un `hint` de schéma décrit un câblage RÉEL** : deux hints promettaient une pose et un repli qui n'existaient pas ; `defaultFoot` n'avait aucun lecteur → purgé, pas documenté.
- **Le premier réglage d'un panneau ne matérialise que le champ touché** : `{...defaut, ...patch}` figeait pente et profil comme valeurs POSÉES. Réducteur pur `poseToitureDeCorps` dans `state/sceneEdit.ts`, jamais dans le composant.
- **Placeholder ≠ valeur posée** : `NumberField` n'avait aucune règle `::placeholder` — la distinction vide/hérité vs posé/surchargé était invisible ; règle globale posée dans la primitive.
- **Un enum voisin muet se nomme dans le geste** ; un homonyme né de l'entrée d'ids au registre (`tour` circonstance VDM) se résout par l'`enumNomme`, jamais par une ligne de stock.
- Outillage : `sed -i 'N s/…/'` sur un mauvais numéro de ligne a effacé une assertion — relire `sed -n` AVANT toute substitution par numéro ; le hook lean-ctx bloque `python -c`, et un heredoc Bash à apostrophes est réécrit par le hook → écrire les fichiers longs avec l'outil Write.

**Restes** : #1716 (semences d'`emptyScene` + plage de pente en donnée `config`), inventaire #1689 (`RefField` tableaux d'objets imbriqués, matière sans lien codex), #1680 (import de type `engine → gameIso`).

**Why:** reprendre #1716 ou tout chantier de frontière sans refaire les erreurs. **How to apply:** avant tout brief touchant `src/state`, citer la garde de frontière ; avant tout `hint`, mesurer le lecteur. Liens : [[project-1691-relief-en-donnee-livre-2026-09-07]], [[project-1690-terrains-json-etat-2026-09-06]], [[user-arbitrages-2026-09-05-materiaux-1686]], [[user-doctrine-verrou-par-construction]], [[feedback-un-detecteur-ne-mesure-que-sa-couverture]].
