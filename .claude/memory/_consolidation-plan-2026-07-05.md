# Plan de consolidation mémoire — 2026-07-05 (fichier de travail, NON indexé)

Carte produite par agent Explore (211 fichiers lus), spot-vérifiée (claim fallbackSpec/spellspecs confirmée au code).
Décompte : GARDER 140 · REDONDANT-CREDO 14 · FUSIONNER 16 · CLOS-OBSOLÈTE 35 · PROMOUVOIR-REPO 6.

## PHASE A — mécanique (exécutée 2026-07-05) : déplacés vers `_archive/`

### CLOS-OBSOLÈTE (35) — chantiers soldés, aucun gotcha vivant
game-arene-editor-data-project, game-bestiaire-refonte, game-cascade-fold-complete, game-ciblage-homogene,
game-combat-depth-session-2026-06-05, game-combat-hud-refonte, game-combat-legibility-roadmap,
game-combat-legibility-tail, game-combat-victory-start-screens, game-consequences-combat-persistantes,
game-death-critical-model, game-flow-choice-frappe-reactive, game-goal-sprites-anims-complets,
game-grapple-ai-integration, game-hud-bg3-handoff, game-hud-mobile-actionbar, game-jalon-2-5-regles-manquantes,
game-jalon-creation-perso-magie2-integres, game-loadouts-deux-armes-chantier, game-magic-layer,
game-maneuver-capability-unification-parallel, game-monolithic-sprites-vestigial, game-passifs-unifies-p0-p3,
game-playtest-feedback-2026-06-10, game-playtest-feedback-lots, game-poc-cleanup-inventory-tome1,
game-repos-infirmerie-modales, game-resilience-prejet, game-rig-species-sameness, game-taille-combat-lot,
game-talent-test-recode, game-temps-voyage-pivot, game-tome1-skavens-pnj, game-vue-du-dessus,
project-playtest-jinashi-solde

### REDONDANT-CREDO sans exemple calibrant (4) — intégralement couverts par .claude/credo.md + CLAUDE.md règle 6
feedback-comment-noise-ratio, feedback-ne-pas-faire-confiance-commentaires,
feedback-pas-de-commentaire-rappel-ancien, feedback-regles-generales-jamais-specifiques

### Doublons purs (2) — la cible reste en place
game-psychologie-subsysteme (→ game-psychology-subsystem), feedback-use-powershell-not-bash (→ env-use-powershell-not-bash)

## PHASE B — éditoriale (À FAIRE, après le rapport d'audit)

### B1. REDONDANT-CREDO avec exemple calibrant (10) → fusionner les EXEMPLES dans UN fichier `credo-exemples-calibrants.md`, puis archiver
feedback-contenu-donnee-editeur-pas-code, feedback-no-hors-scope-no-debt, feedback-orchestrator-verify-delete-redo,
feedback-reutiliser-avant-reinventer, feedback-single-source-of-truth-vs-guard, feedback-source-user-claims,
feedback-zero-retrocompat-briques-solides, game-supprimer-legacy, game-raw-comments-suspect-read-source,
game-arene-data-driven

### B2. FUSIONNER→cible (14 restants) — extraire la pépite non dupliquée, l'ajouter à la cible, archiver la source
feedback-lean-process-over-ceremony→feedback-workflows-calibres-taille
feedback-no-commit-perfectionism→git-commits-propres-wip-parallele
feedback-no-commit-surgery-shared-tree→git-commits-propres-wip-parallele
feedback-une-situation-une-modale→game-jet-modale-exhaustif
game-curated-commit-interleaved-tree→git-commits-propres-wip-parallele
game-modales-unification→game-rollflow-canonical-system
game-panneau-de-jet-unique→game-rollflow-canonical-system
game-gabarits-corporels→game-rig-gabarits-races-sp1
game-mutations-visuelles-rig→game-mutation-appearance-data-driven
game-refs-ids-migration→game-label-id-migration-complete
game-test-spine-id-migration→game-test-spine-fk-by-label-migration
game-appearance-json-renderer-pure→game-refonte-rendu-builders-backends
game-jalon9-ui-ux-charte→game-refonte-ui-jeu-video-2026-07
game-bestiary-sprite-bar→game-qc-reconnaissabilite

### B3. PROMOUVOIR-REPO (6) — les agents ne voient pas la mémoire ; écrire dans le repo puis archiver
feedback-appearance-svg-in-defs→docs/architecture.md
feedback-css-architecture + feedback-pas-de-texte-tuto-ui + feedback-ui-densite-controles-stylises→docs/charte-ui.md (à créer)
game-no-mj-model-everything→CLAUDE.md règles strictes (1 ligne)
game-visual-direction→docs/architecture.md (direction visuelle ; purger le lien mort game-rules-engine-reuse)

### B4. ÉLAGAGE des gros journaux GARDER (~15) — garder invariant + piège, couper le récit de commits
game-data-driven-architecture, game-opera-nadj-multiniveau-program, game-marchand-v1, game-source-fr-campagne-custom,
game-trigger-cadence-aware-no-silent, game-murs-aretes-systeme (+ isostage-perf & vision-fog : partiellement
supersédés par le culling viewport de la refonte rendu — vérifier avant de couper)

### B5. Mémoires PÉRIMÉES signalées à re-vérifier au code avant correction/archivage
game-qualities-registry (keyé par id désormais), game-traits-trigger-aura-mechanisms (dette talent.test SOLDÉE),
notes « CLAUDE.md dit encore X » devenues fausses dans game-source-fr-campagne-custom & game-data-driven-architecture

## Après chaque phase : régénérer MEMORY.md (liens cassés sinon).
