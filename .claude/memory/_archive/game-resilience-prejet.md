---
name: game-resilience-prejet
description: "Résilience « Je ne faillirai pas ! » = RAW LDB 17 l.73 : AVANT le jet (mode principal, manquait) ET après un échec ; migration des modales en cours"
metadata: 
  node_type: memory
  type: project
  originSessionId: e8da4937-e7c9-443e-bf71-432062e78922
---

RAW **LDB 17 l.73** (vérifié, cité) : « **Je ne faillirai pas !** : *au lieu de lancer les dés* pour un Test, vous choisissez le résultat […]. Si vous infligez un Coup Critique, vous pouvez choisir la Localisation. Test opposé → l'emportez avec DR +1. **Vous pouvez même faire ce choix après un Test qui a échoué.** » → **DEUX modes** : AVANT le jet (mode principal) ET après un échec (concession).

Le code n'avait QUE le mode **après-échec** (`…ForceSuccess` gardés par `result/roll != null`, bouton `ResilienceButton show={mauvaise issue}` en phase résultat). Le mode **pré-jet manquait**.

**Important (correction utilisateur)** : il a d'abord dit « avant seulement, pas après », je l'ai confronté au RAW (l.73 autorise après-échec), il a corrigé : « **seulement RAW, je peux me tromper… si on peut après un échec, on doit pouvoir le faire** ». Donc → **suivre le RAW, garder les DEUX**. (Illustre [[feedback-source-user-claims]] : confronter ses affirmations WFRP au Source, citer, signaler l'écart.)

**Livré (référence, commit 2af9509)** : `pendingTest` — `testForceSuccess` gère les deux (`roll ?? 1` : pré-jet choisit 01 / DR requis ; post-échec conserve le dé raté et flippe). `PendingTest.forced`. Bouton Résilience ajouté en phase de choix de `TestModal` (post-échec conservé). `resilience-prejet.test.ts` (5 cas TDD).

**LIVRÉ PARTOUT** (commit 5c74d86) : les 13 modales de jet ont le mode pré-jet (bouton Résilience en phase de choix), la voie post-échec conservée. Deux techniques selon le risque :
- **Synthèse de succès sans dé** (choisit 01) pour les tests à forme simple : Test, soin, focalisation, frénésie, course, psych, encounterPsych — leurs `…ForceSuccess` gèrent `result/roll == null` en plus du post-échec.
- **roll+force** (on lance puis on force la réussite, `onForce={() => { roll(); forceSuccess(); }}`) pour les modales de **combat** (attaque/défense/sort/piétinement/désengagement) où la synthèse d'`AttackResult`/`CastResult` serait risquée à l'aveugle — réutilise la résolution testée → forme correcte garantie (affiche le vrai dé marqué réussite forcée ; recette navigateur conseillée pour le ressenti).

Tests : `resilience-prejet.test.ts` (Test + soin + frénésie). **Affinage RAW LIVRÉ 2026-06-10 (commit fd17996)** : la Localisation du Critique forcé était DÉJÀ implémentée (attackSetCritLocation + grille RollModal) ; ajouté `attackSetForcedRoll(roll)` = « vous choisissez le résultat » (clamp 1..min(99,cible), plancher DR+1 opposé, pas de re-dépense) + UI RollModal (presets 01/plus-haut-double + saisie libre — un double choisi → Critique, exemple Salundra l.75). NB : le commentaire d'en-tête de resilience-prejet.test.ts disait à tort « choix maison : on retire la concession après-échec » — corrigé, les DEUX modes sont RAW et restent. Prolonge [[game-combat-events-structures]].
