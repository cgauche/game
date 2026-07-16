---
name: game-panneau-de-jet-unique
description: "Refonte modales (bundle 2026-06-11) — RollPanel/VsHeader/TargetPrompt/InfluenceRow, Cleave+DualStrike supprimées (ciblage carte), pattern de regreffe à l'intégration de bundle UI"
metadata: 
  node_type: memory
  type: project
  originSessionId: df22e358-4438-4cca-b8e3-ad83ea327a2e
---

Le système de modales de jet POST-refonte (merge bundle `7bf1b5c`, 2026-06-11) :

- **RollPanel** = panneau unique avant/après le jet (avant-jet = résultat pré-rempli) ; ligne adverse = portrait+compétence+mods SEULEMENT (pas de % de toucher). **VsHeader** = en-tête A → B. **TableRollLine** = d100 sur table (Oups/Critiques/Imparfaites), fin des verdicts plein écran.
- **Ciblage champ de bataille** (`TargetPrompt` + anneaux IsoStage) : Frappe Mortelle, 2ᵉ frappe deux-armes, cibles de Surincantation — **CleaveModal/DualStrikeModal N'EXISTENT PLUS**. Le combat monté reste une modale (désambiguïsation d'une même case).
- **InfluenceRow** (`src/ui/InfluenceRow.tsx`, créé à l'intégration sur remarque utilisateur « copié/collé ») : rangée Chance/Relance gratuite/+1 DR/Pacte/Résilience partagée par Attaque/Défense/Incantation/Désengagement — l'acteur est passé UNE fois, `freeRerollOf` calculé dedans. Les 11 flux RollFlowShell passent leurs props explicites (pas InfluenceRow).

**Why:** le bundle avait forké AVANT L9/a11y — à l'intégration il a fallu REGREFFER : `freeReroll` (ChanceButtons + 9 call-sites) et `onClose`/Échap par modale. Pattern : sur un bundle UI, `git checkout --theirs` puis regreffer les apports locaux listés par `git show HEAD:fichier | grep <feature>`.

**How to apply:** toute nouvelle modale à jet = RollFlowShell (flux fabrique) OU Modal+RollPanel+InfluenceRow (flux dédié). Jamais de rangée d'influence manuscrite. Un nouveau ciblage multi-cibles = TargetPrompt (bandeau non bloquant + clic carte), pas des boutons-noms en modale. Prolonge [[game-roll-modal-pattern]] et [[game-jet-modale-exhaustif]].

## Fabrique MULTI-jets unique (2026-06-14, commits 1352b14/4f2287a)

`makeRollFlow` est devenu la **fabrique UNIQUE** mono ET multi (N participants), sur remarque utilisateur (« makeMultiRollFlow est un faux générique qui recopie le câblage »). Clé : une **lentille** `spec.multi = { slots, idOf, replace }` — ABSENTE en mono (le pending EST le slot, `pid` ignoré), PRÉSENTE en multi (`participants[pid]`). Le câblage des 7 verbes (roll/reroll/bonusSL/forceSuccess/setForcedRoll/cancel/darkPact) est écrit UNE fois ; `RollFlowSpec<P, Slot=P>`, handlers `(get,set,pid?)`. **`makeMultiRollFlow` SUPPRIMÉ — ne pas le réintroduire.** Les 15 specs mono sont inchangées (slot=p). Plomberie d'influence extraite en `opRoll/opReroll/…` partagés.

Deux **régimes** prouvés sur la MÊME fabrique : **PARALLÈLE** = jets indépendants (`FLOWS.counterspell` : Contre-sort à plusieurs, agrège « dissipé si un gagne » dans `counterspellConfirm`) ; **SÉQUENTIEL** = chaque jet dépend du précédent (`FLOWS.extendedTest` : Test Étendu LDB 12, DR cumulé vers une cible/porte DR 20, restart si total<0, progression dans `extendedTestNext`). Seule la **progression** (xConfirm/xNext) diffère ; le cycle d'influence est commun. Une rangée `interactive:false` = témoin (subsume `MultiRollList`). Reste : UI rangées-parallèles + progression-séquentielle, brancher le Contre-sort dans `castSpell`, + consommateurs nuit/voyage (séquentiel) & dialogue (choisir le lanceur). Spec : `docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md` (à rafraîchir : décrit encore makeMultiRollFlow).
