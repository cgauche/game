---
name: feedback-recette-navigateur-arbre-gele
description: "Ne JAMAIS dispatcher une recette navigateur pendant qu'un codeur écrit dans l'arbre — Vite full-reload silencieux = setup perdu, recette morte sans erreur console"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-08-03T08:47:45.112Z
---

Une recette navigateur exige un arbre GELÉ : Vite sert le working tree, et toute écriture d'un
codeur parallèle déclenche un full-reload qui renvoie au menu principal en perdant TOUT le setup —
silencieusement, zéro erreur console (le symptôme est documenté dans `docs/recette-navigateur.md`
§ « Retour-menu SILENCIEUX », mais la PRÉVENTION est une règle d'ORCHESTRATION, pas de doc).

**Why :** vécu 2026-08-03 (recette coop #1017) : j'ai lancé la recette coop 2 sièges pendant que le
codeur du lot A corrigeait le séquencement pré-roll (store.ts/combatFlow.ts). Deux setups coop
complets (~35 appels chacun : salon, jonction, attribution de siège, 4 recrutements) perdus par
bounces successifs. Le recetteur a bien diagnostiqué (`git status` mouvant) et s'est arrêté — le
coût était déjà payé. Les recettes SÉQUENTIELLES aux codeurs, jamais parallèles.

**How to apply :**
1. Avant tout dispatch de recetteur : AUCUN codeur actif sur l'arbre (mes agents à moi compris —
   c'était le mien). Les juges/lecteurs (lecture seule) sont compatibles.
2. Un codeur relancé pour un fix pendant qu'une recette tourne = la recette est MORTE : la
   prévenir/l'arrêter, pas la laisser griller son budget.
3. Dans le brief du recetteur : « vérifie que `git status` est STABLE avant tout setup coûteux ;
   s'il bouge, STOP et rapporte » (le recetteur de #1017 l'a fait de lui-même — le brief doit le
   demander).
4. Idéal : recetter APRÈS le commit du lot ([[feedback-migration-donnees-ui-exige-recette-au-commit]]
   reste compatible : la recette conditionne le commit → geler l'arbre pendant la recette, committer
   juste après).

## Récidive 2026-08-29 (orchestrateur) — MA faute de dispatch
J'ai lancé recetteur ET codeur (index.ts/registry.ts) EN PARALLÈLE sur le même arbre : 4 reloads HMR silencieux, un combat perdu, ~25 appels gâchés — en écrivant « arbre au repos » dans le brief de recette. Règle opérationnelle : une recette est un CRÉNEAU EXCLUSIF — aucun codeur dispatché tant qu'elle court, et le recetteur vérifie git diff --stat -- src/ VIDE avant de commencer (STOP sinon).

**Vécu 2026-09-06 (#1599)** : j’ai dispatché un codeur de solde ET un recetteur EN PARALLÈLE sur le même worktree — le recetteur a mesuré une cible mouvante (diff `src/` 65 → 66 fichiers en 10 min, HMR → retour au menu) et s’est arrêté à l’étape 2 : recette perdue. Règle : la recette est SÉQUENTIELLE, après le dernier codeur ; le brief du recetteur exige `git diff --stat -- src/` STABLE (pas seulement non vide) à intervalles ; jamais deux agents écrivant/lisant l’écran sur un arbre en cours d’édition.

Vécu 2026-09-07 (#1508 T3a) : j'ai lancé le recetteur EN PARALLÈLE d'une micro-passe du codeur sur le même worktree ; le serveur de dev a rechargé à chaud pendant la passe (`dev.log` : `page reload src/state/combat/hitModifiers.ts`, `hmr update GameOpEditor.tsx ×4`), les 9 premières captures portaient sur l'arbre d'AVANT et le recetteur a dû tout rejouer (~10 appels perdus) après avoir bracketé par `empreinteArbre`/`verdictArbreGele`. Règle d'ordonnancement : recette et codeur ne tournent JAMAIS en même temps sur un arbre ; le juge de diff (lecture seule) peut tourner en parallèle du recetteur, pas le codeur. Outillage à porter : `openApp`/`shot` du kit doivent prendre l'empreinte et REFUSER (ou taguer) une capture sur arbre mouvant.
