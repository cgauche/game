---
name: game-symptoms-data-driven
description: Symptômes de maladie = entité de donnée (symptoms.json) en GameOp/3-canaux ; enum DiseaseSymptomKind supprimé.
metadata: 
  node_type: memory
  type: project
  originSessionId: 79086e8f-2b86-464f-8a9e-6f2bc67f4515
---

Les symptômes de maladie (LDB 20) sont une **entité de donnée** éditable au Codex (`src/data/symptoms.json`), plus un enum. Mécaniques en **3 canaux** comme un trait/qualité (cf. [[game-talents-editable-data]]) :
- `passive` / `severePassive` (charMod) : pénalités continues (fièvre/bubons −10 ; convulsions −10/−20 via severePassive quand l'instance porte `severity` ; démangeaisons/gangrène Soc) → collectées par `diseasePassiveOps(c)` → `passiveMods` (kind 'maladie', annulable par Détermination).
- `onTick { difficulty, onFail: GameOp[] }` : Test de cycle quotidien (Blessé → `contractDisease` 'blessure-purulente' ; Toxine) — DIFFÉRÉ en cascade de nuit influençable ; la conséquence `onFail` est appliquée par `applyOps` côté `restFlow` (applier `diseaseTick`). `disease.ts` reste **pur** (importe `ops` en TYPE seul → zéro cycle).
- `capabilities` irréductibles lues par la machinerie de cycle : `blocksHealing`, `amputation`, `stickyExtenue`, `contagious`, `nausea`, `endTest`.

`maladie.symptoms[]` = `{ symptomId, severity?, difficulty? }` (référence le catalogue). Op GameOp **`contractDisease`** ajouté (contraction immédiate, complète `exposeDisease`). Catégorie Codex « Symptômes » + éditeurs (`SymptomTickField`). Commit c4a0ab7d.

**Why :** demande user « Symptoms devrait aussi utiliser les GameOps de toute évidence » + tout doit être éditable au Codex en donnée, pas en code. Option « triggers génériques » écartée (réutilisation insuffisante — cf. cascade quotidienne = machinerie + `ScheduledEffect` existe déjà).

**How to apply :** ajouter un symptôme = UNE entrée `symptoms.json` (ou via Codex « Symptômes ») ; sa conséquence de test = GameOp dans `onTick.onFail`, jamais du code ; un comportement vraiment irréductible = un drapeau `capabilities` lu par `disease.ts`. Exemple worked (commit 83fb4d90) : « Crampes abdominales » (Colique, T2C) = `passive` charMod −20 à tous les Tests, référencé en symptôme primaire de la Colique ; sa cascade d'échec par-Test (Sonné/À Terre/Inconscient) n'a pas de trigger → laissée en `desc`.
