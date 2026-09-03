---
name: user-regime-une-session-par-chantier-2026-09-01
description: "Décision utilisateur 2026-09-01 soir — « Faut arreter les sessions en backgrounds, ca m'inquieye » puis option retenue « Finir le merge, puis une seule session par chantier » : UNE session par épic, arbre principal RÉSERVÉ à l'intégration, suite complète + tsc FULL avant push, pas de push sur CI rouge, fan-out ≤ 1 par commit, trouvailles en inventaire au ticket de la vague, aucune vague hors plan sans validation DIRECTE"
metadata:
  type: feedback
---

**Verbatims (2026-09-01)** : « Faut arreter les sessions en backgrounds, ca m'inquieye » (relayé par game-a3, ordre d'arrêt immédiat) ; décision via AskUserQuestion dans la session game-a3 : « Finir le merge, puis une seule session par chantier » ; confirmation DIRECTE dans cette session (AskUserQuestion) : « Oui, reprends » (tuples #1659 → B1 #1657 → #1620 (iii), un train à la fois).

**Périmètre étendu (2026-09-01 ~22:50, AskUserQuestion, verbatim)** : « Je pensais que tu récupérais son travail, qu'as tu abandonné d'autres ? » → option retenue « Oui, tout #1463 dans cet ordre » : la session unique porte l'ÉPIC ENTIER — tuples (#1659) → inventaire des fusions #1673 (juge lecture seule, il redistribue les familles) → #1657 B1 puis B/C (+ #1675/#1676) → famille `table` (#1669/#1670/#1667/#1665/#1666) → #1620 (iii) → L1a #1466 / L1c #1468 → restes #1654 (`spells|kind`, `raceAppearance`, `talents|max`, `water-exposure`, #1658) → portes #1615/#1621/#1646 → gardes/outillage (#1662, #1671/#1672, #1651, #1656, #1647/#1648/#1655/#1483, #1619/#1614, #1622/#1642/#1643). Hors #1463 (#1678, #1680, bestiaire #1636-#1639, recette #1478/#1589/#1587/#1645/#1668) : à attribuer par l'utilisateur.

**Fusions issues de #1673 (2026-09-02, AskUserQuestion, option retenue « Après #1657 B1/B2, avant la famille table »)** : #1681 (enjeux ×4) / #1682 (critiques LDB+AA) / #1684 (catalogue cargo) s'insèrent APRÈS #1657 B2 et AVANT la famille `table` ; #1683 (porte `tableParId`) vient après #1667/#1669 dont il dépend. Prémisse corrigée par l'inventaire : le discriminant est `kind`, jamais `type` (nom de document, littéral de fabrique).

**Train unique B2a + #1682 (2026-09-02, AskUserQuestion, option retenue « UN seul train B2a + #1682 »)** : sur mesure du juge de design (10 des 11 artefacts de B2a réécrits par #1682, double migration/tests/recette), les critiques LDB 18 + AA 07 se traitent en UN train (forme du jet + enveloppe + lecteur unique, discriminant `jeu`). Leçon : deux tickets qui touchent les MÊMES fichiers et les mêmes rangées se mesurent AVANT d'être séquencés — un ordre validé sur une prémisse fausse se ré-arbitre avec la mesure en main.

**#1437 ajouté au périmètre (2026-09-03, verbatim)** : « Ok, je compte sur toi pour finir sa mission aussi » — #1437 (2026-08-20 : extinction de `ROLL_SEAM_PHASE2_STOCK`, 35 sites, + re-tri des 27 délégués moteur — finir la migration du seam) est porté par cette session : après B3-3, recouper son stock avec ce que B3 a déjà tué (critiques, amputations, équipage, maladies) et éteindre le reste ; frères : #1508 (dés de monde), #1501 (Test étendu de l'ingénieur).

**Contexte** : deux sessions orchestratrices sur le même arbre pendant 48 h (#1463 × #1457/#1620/#1657) — ~55 trains, zéro conflit d'index, mais re-baselines croisées des plafonds, docs régénérés sur le WIP du voisin, trois rouges CI par trous de gate, worktrees verrouillés, et un diagnostic de DÉRIVE : la vague `grammaire` et le juge `tuples` ont été ouverts sur un arbitrage RELAYÉ par l'autre session, jamais validé directement par l'utilisateur ici.

**Why :** la parallélisation sur les mêmes fichiers coûte plus qu'elle ne rend, et une autorité relayée n'est pas une validation — [[feedback-brief-fait-autorite-grounding-seconde-main]], [[feedback-plan-approuve-sexecute-sans-relance]] (le plan approuvé, pas ses extensions).

**How to apply :**
1. UNE session par épic ; l'arbre principal est réservé à l'INTÉGRATION : rien n'y est stagé ni commité, seulement `git pull --ff-only` après un push ; tout train se code, se gate et se commit dans un WORKTREE à `npm ci` sur le sha posé.
2. Avant tout push : suite COMPLÈTE + `tsc` FULL + **`eslint . --max-warnings 0`** + **`npm run test:raw`** + **`npm run deps:unused`** (knip — step de `ci.yml` absent des listes de gate jusqu'au rouge de 7692b631c, 2026-09-03) + `npm run docs:check` (avec l'empreinte des sources : régénérer les docs APRÈS le stage de leurs sources) (CI rouge 68055fe99 : deux U+00A0 dans un gabarit de message, `no-irregular-whitespace` — ni la suite ni tsc ne le voient), sorties lues au fichier ; jamais de push si le dernier run CI de `main` est rouge (attendre ou corriger) ; `gh run watch`, « posé » seulement au vert ; un doc dérivé touché se régénère SUR L'INDEX dans le train qui le périme.
3. Fan-out ≤ 1 s'applique à TOUT commit ; les trouvailles hors lot vont dans UN commentaire d'inventaire du ticket de la vague — zéro ticket par trouvaille.
4. Aucune vague hors du périmètre validé sans validation DIRECTE de l'utilisateur dans la session (une option AskUserQuestion) ; un arbitrage relayé par une autre session n'autorise rien.
5. Pilotage de l'épic réécrit à chaque train posé ; un seul codeur lourd à la fois, recetteurs séquentiels.

Complément 2026-09-02 (incident 17926d5de, CI rouge sur docs:check) : un CHERRY-PICK est un commit comme un autre — les 5 portes CI (gen, tsc, lint, suite complète, docs:check) + migrations:replay se jouent AVANT son push, même si le commit d’origine était vert ailleurs : un décalage de lignes suffit à périmer les champs `Implémente` générés des fiches RAW. Le hook post-rewrite (docs:build) ne couvre que rebase/merge, pas cherry-pick.

Complément 2026-09-03 : les portes de push sont celles de `.github/workflows/ci.yml` et RIEN de moins — `npm run deps:unused` (knip) en fait partie et n’était joué par personne (CI rouge du voisin sur 7692b631c). Liste à jour : gen idempotent, typecheck, lint, suite complète, docs:check, migrations:replay, deps:unused. Vérifier ci.yml à chaque reprise : un step neuf = une porte neuve.
