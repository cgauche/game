---
name: index-systemes-livres
description: "Sous-index des fiches des systèmes de jeu LIVRÉS (jets, combat, hors-combat) et du détail rendu iso/rig — consulter quand on touche un de ces systèmes"
metadata: 
  node_type: memory
  type: project
  originSessionId: 3c1689ae-eeaa-4da2-a83f-c35ecef5c557
  modified: 2026-08-19T12:43:47.802Z
---

## Chantiers historiques (2026-07)
[Chasse contenu-en-dur](game-chasse-contenu-en-dur-2026-07-12.md) · [#276 fini](project-pause-structurelle-2026-07-10.md) · [Programme #211](game-programme-attendu-vs-realite.md) · [pérennité 10 ans](game-perennite-portes-chantier.md) · [tickets RAW #101-112](game-101-amputation-weapon-context-design.md) · [tireur 5 coutures](game-hors-tour-targeting-seams.md) · [défense manœuvre ZONE](game-zone-maneuver-defender-silent-jet.md) · [surfaçage jets](game-gm-seat-controller-axis-vision.md) · [activités unifiées](game-activites-unification-chantier.md) · [UX interlude](game-interlude-ux-refonte-a-faire.md) · [Peur : 2 portes RAW](game-peur-deux-portes-trait-strict-taille-agressive.md) · [Refonte UI « jeu vidéo »](game-refonte-ui-jeu-video-2026-07.md) · [builders+N backends](game-refonte-rendu-builders-backends.md) · [MapSpec SEUL chemin](game-mapspec-unified-authoring.md) · [combat naval](game-naval-tactical-chantier.md) · [TopoScene](game-topo-minimap-stations.md) · [masse ≠ voyage](game-massbattle-activities-distinct.md).

## Jets
[UN HÔTE](user-doctrine-un-hote-jamais-duplique.md) / [SYSTÈME UNIFIÉ](game-rollflow-canonical-system.md) / [modale différée](game-roll-modal-pattern.md) / [un jet = une modale](game-jet-modale-exhaustif.md) / [Rechargement](game-rechargement-test-etendu.md) / [multi = primitive](game-multi-roll-modal-primitive.md) · [un jet = une Action](feedback-jet-equals-action.md) · [zéro jet silencieux](game-trigger-cadence-aware-no-silent.md).

## Combat
[attaque unifiée](game-unified-attack-click-model.md) / [engagement](game-engagement-trio.md) / [footprint N×N](game-footprint-multicases.md) / [difficultés](game-difficultes-combat-table.md) / [monté](game-mounted-combat-geometry-nerveux.md) / [IA tireur](game-ai-shooter-attack-prime.md) / [clavier+manette](game-combat-keyboard-gamepad.md) / [mouvement décomposé](game-split-movement-decision.md) / [journal structuré](game-combat-events-structures.md) / [réalisateur](game-combat-director-readability.md) / [arme d'équipe](game-arme-equipe-skill-based-crew.md) / [combat-optionnel](game-combat-optional-not-duplicate.md) / [psychologie](game-psychology-subsystem.md) / [Guérison](game-guerison-action.md) / [modal arbiter](game-modal-arbiter-dead-state.md).

## Hors combat
[marchand](game-marchand-v1.md) / [loot+ident](game-loot-window-identification.md) / [journal → modale](game-journal-non-lu-remonter-en-modale.md) / [roster](game-roster-personnages.md) / [reset partie](game-newgame-reset-pattern.md) / [audio](game-audio-systeme.md) / [coop relay](game-coop-en-ligne.md) / [PortraitTile](game-charframe-unifie.md) / [ItemIcon+MediaSelect](game-itemicon-mediaselect-primitives.md) / [Codex éditable](game-codex-editable-json-free.md) + [onglets](game-codex-tabbed-entry-harmonisation.md) + [Compendium](game-codex-compendium.md) · [éditeur produit final](game-editeur-produit-final.md) · [Opéra NADJ](game-opera-nadj-multiniveau-program.md).

## Rendu iso/POV — détail
[Matériaux ISO⇄POV](game-iso-pov-material-harmonization.md) · [peintre z-2](game-iso-depth-z-secondary.md) · [escalier caché](game-iso-depth-perface-hard.md) · [remparts z-aware](game-siege-rampart-z-aware-interaction.md) · [bloc plein](game-rampart-solid-block-height-unified.md) · [murs arêtes](game-murs-aretes-systeme.md) · [POV](game-pov-first-person-view.md) · [perf IsoStage](game-isostage-walk-rerender-perf.md) · [vision/brouillard](game-vision-fog-of-war.md) · [toise](game-toise-echelles.md).

## Rig — détail
[SP1 bipèdes](game-rig-gabarits-races-sp1.md) / [paper-doll](game-rig-2d-paper-doll.md) / [Dir8](game-orientation-monde-facing.md) / [monture](game-monture-composite-profondeur.md) / [nuées](game-swarm-data-driven-grounding.md) / [3 vues](game-rig-static-3-views-direction.md) / [name-matcher mort](game-namematch-deleted.md) / [tenues defs UNIQUE](game-tenues-defs-source-unique.md) / [sweep data-driven](game-rig-datadriven-sweep.md) / [apparence mutation](game-mutation-appearance-data-driven.md) / [appendages](game-appendages-registry-unified.md) / [QC anti-blob](game-qc-reconnaissabilite.md).

## Migrations id/label (LIVRÉES)
[GROUPES+SPECS](game-groups-specs-i18n-complete.md) / [label→id](game-label-id-migration-complete.md) / [FK-par-libellé](game-test-spine-fk-by-label-migration.md) / [mutations+créatures](game-mutation-creature-id-migration.md) / [livres](game-book-relation-id-migration.md) / [On ne MANIPULE que des IDs](game-ids-internes-libelles-display-multilangue.md).

## Armes (registre LIVRÉ)
[registre defs/](game-weapon-registry.md) / [buildWeapon](game-weapon-model-buildWeapon.md) / [handlingClass](game-weapon-handling-axis.md) / [art par id](game-weapon-art-id-routing.md) / [qualités FAMILLE](game-qualites-famille-arme.md) (⚠ `noFamilyQualities`).

## Sources / pipeline livres (LIVRÉ)
[Réfs RAW = préfixe de FICHIER](game-refs-raw-convention-prefixe-fichier.md) · [Atlas RAW](game-atlas-raw-doc.md) · [ajouter un livre](game-mdg-new-book-pipeline.md) · [ré-ancrage post-Marker](game-atlas-reanchor-epreuve.md) · [PDF faillibles](game-sources-pdf-errors-verify-case-by-case.md) · [EDO/EDOC](game-edo-edoc-sourcing-fix.md) · [frenchy.bzh](game-frenchy-bzh-creatures.md) + [pont VO](game-frenchy-vo-bridge.md) · [VDM = 16e livre](game-vents-de-magie-integration.md) · [diag Marker](env-marker-extraction-kills-et-timeout-outil.md) · [collision gate raw](game-pre-commit-raw-gate-collision-arbre-partage.md).

## Collisions de livres (doctrine + cas jugés)
[UNE entité, N livres](game-doctrine-une-entite-n-livres-n-variantes.md) · [collision = bug d'AXE](game-collision-livres-identique-vs-divergent.md) · [EDOC↔LDB Belliqueux](game-collision-edoc-ldb-belliqueux-tranchee.md) · [collisions différé](game-collisions-variantes-livres-deferred.md) · [flag `named`](game-named-flag-effective-psychtraits.md) · [audit 2026-06](project-audit-conformite-2026-06.md) · [monnaie LDB 57](game-notation-monetaire-canon-ldb57.md).
