---
name: project-1467-l1b-livre
description: "État de l'epic #1463 après L1b + CARNET DE DÉPILAGE : pour chaque lot restant, où vit la prescription jugée, les arbitrages verbatim, les pièges — à relire AVANT de dispatcher"
metadata: 
  node_type: memory
  type: project
  originSessionId: 581b89eb-a389-4f97-87c2-713104a0fbca
  modified: 2026-08-29T06:37:31.363Z
---

**#1467 (L1b) FERMÉ** le 2026-08-29 (723ac39c6) : 121/121 defs par `document()`, enveloppe verrouillée par construction, scènes en `label` (schema 6, SAVE_VERSION 29), statblocks structurels, Codex à défaut d'enveloppe, stock ENVELOPPE 112→56 dont 0 L1b. Pilotage humain : commentaire sur l'epic #1463 ([[feedback-pilotage-epic-commentaire-github]]).

## Carnet de DÉPILAGE — lire la ligne du ticket AVANT de le dispatcher

**#1472 + T3 : FERMÉ le 2026-08-29** (vague ① de la reprise : T3 6e5d30a47 + DÉRIVATIONS A d84ca749c / B 548e11a89 / C 960994b25 + solde 3987d064e). L'exposition DÉCLARÉE (`document()` 5ᵉ arg) est la SEULE vérité : 4 tables à la main mortes (parité 107/10/0 ×3), `deriveExposition` pure fail-closed, atelier ancré par ID, `FILTRES_DE_BUILD` cliquet, dette #747 restaurée au cliquet dette. Classe H TRANCHÉE par recadrage user (verbatim au ticket #1564 : « N'oublie jamais l'objectif de l'epic. Regarde le avant de me poser une question » — la décision se DÉRIVAIT de la forme canonique : clés ≡ ids). ⚠ Leçon : jamais d'option « statu quo » face à un objectif d'epic qui répond déjà — question viciée. Restes routés : #1562 #1563 #1564 #1565 #1560(GO météo) #1559(retitré) #1561, #747/#1530/#1539.

**Lot rig (#1536 + #1537 + #1524, une famille)** — 11/13 engins de siège rendus HUMANOÏDES en silence (`defById(siegeRig)` échoue → repli) ; vocabulaire RigSpeciesId émis ≠ garde ; libellés passés en `appearance`. Réflexe : chercher le repli menteur et le tuer FAIL-FAST (doctrine [[feedback-no-legacy-propping-fallbacks]]) ; l'ART se délègue à une session artiste si du tracé est requis ([[user-art-delegue-autre-session]]).

**Lot CodexEdit (#1530 + #1526 + #1525)** — Enregistrer TOUJOURS en échec ×20 datasets (cause racine dans le ticket), groupes repliables morts au clic, clé d'espèce saisie libre. Doctrine : éditabilité non négociable ; l'ancrage par label de #1539 est du ressort de L2, pas de ce lot.

**L2 #1548 (le gros)** — le corps du ticket porte les mesures : 5 formes de ref Compétence (citées au corps de #1463), `key→characteristic` de progression-schemas (générateur PYTHON d'abord — `gen-progression-schemas.py`, la régénération-preuve est hors gates : prouver par deep-equal de l'artefact), specEntrySchema talents. Absorbe #1528 (ids config non FK-ables), #1532 (3 familles déclarées≠mesurées), #1539. Patron : design jugé AVANT code, migrations rejouables, un schéma partagé dans la grammaire (`valeurs/reference.ts` — `talentRefSchema`/`sizeCategorySchema` y sont déjà remontés à V-P7).

**Solde epic** : #1552 (type des 27 scènes — poser `type:'scene'` = schema 7 + BUMP SAVE, peser contre « 0 consommateur ne discrimine » ; JSDoc d'écart déjà à scene.ts) · #1553 (92 orphelines, curation au long cours) · #1457 · garde AST DoD(3) · DoD(4).

**Épique suivante : #1388 « Un texte, trois fenêtres »** (directive utilisateur 2026-08-29 verbatim : « le chantier suivant apres cet épique est 1388 ») — y router le groupe prose de la session : #1544 (labels oups condensés), #1534 (miscast 0 desc), #1531, #1538 (names 50 % copie), #1551 (`**` Sigmar), #1529, #1533, #1527. Un TODO-vague-1388.md (WIP d'une AUTRE session) vit à la racine — ne pas y toucher.

**Petits pour les creux** : #1554 (disabled→GatedAction), #1550 (sentinelles bornes), #1545 (regex misfire), #1542, #1540, #1549 (`name:` ×32), #1543 (spriteScreenPos), #1546 (plans datés), #1547, #1535 (minuteries — 2 porteurs PROUVÉS : DiceRoll.tsx:44-53 auto-réarmé sans garde + GameStage3D course de teardown ; nakedTimerScan aveugle à src/ui — SCAN_DIR='src/state').

**Arbitrages du 2026-08-29 (verbatim aux tickets)** : T3 GO complet (#1472) · icône Arène = arena (livré 51d447456) · creatures.title null = état voulu (#1541 fermé) · triage validé « tickets d'abord », séquence proposée en attente de validation.

**Pièges de session à ne PAS redécouvrir** (fiches dédiées) : canal de mesure amputé → script .mjs dans le dépôt via Bash natif ; recette = créneau EXCLUSIF (jamais de codeur en parallèle) ; octets de contrôle littéraux dans les migrations (3 récidives) ; migration jouée retouchée = cas au test gelé ; backticks des corps gh = `--body-file` ; solde de ticket = dispositions NUES `-> #N` et verdict CONFIRMÉ/PARTIEL/RÉFUTÉ ; le hook de palier exige une revue par juge dédié tous les 10 fermetures.
