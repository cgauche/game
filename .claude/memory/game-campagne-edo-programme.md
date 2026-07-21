---
name: game-campagne-edo-programme
description: "CHANTIER campagne L'Ennemi dans l'Ombre (EDO+EDOC) bout-en-bout — mission 2026-07-21 ; arbitrage : legacy tome1-* PURGÉ (jamais migré), reconstruction sur le pipeline canonique ; skill creer-une-campagne suspect à re-vérifier."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9d7ddf6b-cafa-4785-917f-933e8db12f37
  modified: 2026-07-21T18:19:23.236Z
---

**Mission (user, 2026-07-21, verbatim)** : « je te donne pour mission d'intégrer la campagne Ennemi dans l'ombre de bout en bout, compagnon compris, pour une expérience en jeu vidéo RPG inoubliable. […] Tu n'es pas la pour réaliser le travail mais de préparer le terrain et formaliser cela sous une documentation/tickets complets. » — livrables = label GitHub dédié + tickets complets + doc programme ; latitude totale pour ajouter/modifier/refactorer, créer agents/skills.

**Arbitrage PURGE (user, 2026-07-21, verbatim)** : « Le premier jalon est a supprimé completement, l'existant est tres vieux et l'application a énormement evolué » — le contenu Tome 1 existant (Jalon 4 du ROADMAP : `tome1-route.ts` ch.2 « Du Sang Sur la Route », démo `tome1-intro`, `tome1-auberge-interieur`, extraction `src/scenes/tome1-dossiers.json`) se SUPPRIME intégralement. Aucune migration : reconstruction from scratch sur le pipeline canonique (`scripts/campagne/lib.mjs`, projet `{schema:2, scenes, worldMap}`, cf. [[game-mapspec-unified-authoring]]).

**Avertissement skill (user, 2026-07-21, verbatim)** : « Pas certains que "creer-une-campagne" soit a jour, fais y tres attention » — le skill `creer-une-campagne` et `docs/campagne-authoring.md` se traitent en sources SUSPECTES : audit de péremption claim par claim contre le code (agent dédié), remise à niveau = livrable du chantier.

**Sources** : EDO = `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` (9 chapitres + 2 appendices + annexe 3), EDOC = `…l'Ombre Compagnon/` (12 chapitres). Label existant `livre:EDO-EDOC`. Tickets ouverts à articuler (pas dupliquer) : #530 vocabulaire campagne, #343 hubs, #442 récompenses de scénario, #459 mutations EDOC, #517 Dhar, #211 attendu-vs-réalité, #589 bannière d'événement, #381 incarnation, #335/#334 création codex.

**ROADMAP.md est PÉRIMÉ** (~1 mois, en-tête 2026-06-10, dernier fait 2026-06-20) — sa remise à niveau (Jalon 4 réécrit autour de ce programme) fait partie des livrables (→ #666).

**FORMALISÉ le 2026-07-21** : épique **#665** + 34 tickets **#666-#699** (label `campagne:EDO`, violet #8250df) + doc `docs/plans/2026-07-21-programme-campagne-edo.md` (vision, état MESURÉ, architecture d'adaptation, correspondance codes→tickets). Rétro-liens posés sur #530/#442/#517/#459/#589/#565/#353/#343. Grounding clé (contre-vérifié) : (1) l'extraction EDO/EDOC est DÉJÀ à **199 entrées/21 fichiers, CÂBLÉES** au moteur (`weather`→exposure/activities, `rencontres-edoc`→travelTables, `incidents-monture`→mountTravel, `problemes-vehicule`→drivingMishap, mutations→ops) — la Phase B est un SOLDE par confrontation, pas une extraction ; (2) la purge `tome1-*` était DÉJÀ effective dans l'arbre (résidus : QC orphelins + ROADMAP menteur + `ambush-test.ts` vivant, → #666) ; (3) le skill `creer-une-campagne` est exact mais incomplet (`givePossession`, `firstBlood`, `barge-du-sel`, réfs mortes bridge `combatSlice.ts:2476`/`combatFlow.ts:4629`, → #667) ; (4) trous systèmes réels : échéancier à date absolue (#668), dialogues multi-portraits (#669), carnet d'enquête (#670), presets PNJ (#671 — supersède « aventure→CustomStatblock » pour les récurrents), giveFate (#442), enquête/identité (#433 lié). Défauts d'extraction Source : `09 - _GoBack.md` EDOC porte la FIN du ch.5 ; ch.8 EDOC tronqué ; → #678.
