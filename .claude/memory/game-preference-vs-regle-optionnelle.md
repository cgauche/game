---
name: game-preference-vs-regle-optionnelle
description: "Arbitrages user 2026-07-26 : une règle optionnelle ne se change PAS en combat, et un réglage de confort (Cadence) n'est pas une règle optionnelle mais une option tout court."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 411c88e0-9fa2-4d10-a2f5-ee5cc57e7b0e
  modified: 2026-07-25T23:41:16.180Z
---

**Verbatim user (2026-07-26)** : « On ne devrait pas pouvoir changer les régles optionels en combat, et
le changement de rythme ne devrait pas etre consiédéré comme une régles optionnels mais une option tout
court. D'ailleurs l'écrans des options prends plus que la taille de l'écran, et devrais etre découpé en
plusieurs onglet »

## Deux catégories à ne plus confondre

| | **Règle optionnelle** (`OPTIONAL_RULES`, `src/engine/policy.ts`) | **Préférence** (confort de jeu) |
|---|---|---|
| Nature | une règle de WFRP qu'un livre propose ou laisse au MJ | un réglage d'ergonomie, hors fiction |
| Preuve | porte une `ref` vers un folio d'un livre autorisé | aucune source — c'est du produit, pas du RAW |
| Portée | change la SIMULATION (résultats de jets, dégâts, économie) | change le RYTHME ou le confort, jamais un résultat |
| En combat | **VERROUILLÉE** — changer la simulation en cours de partie corrompt l'état | **modifiable** — c'est même le moment où on veut accélérer |
| Persistance | `src/state/houseRules.ts` | patron `src/state/keybindingsPrefs.ts` (localStorage, sans store) |

**Test de tri** : *un livre pourrait-il imprimer ce réglage ?* Si non, c'est une préférence.

Cas fondateur : `combat-cadence` (manuel/rapide/auto) était la **seule des 77 entrées** à porter
`ref: 'maison'`, et le panneau générique la nommait EN DUR
(`if (id === 'combat-cadence') useGame.getState().resumeCadence()` dans `HouseRulesModal.tsx`) — un
panneau « qui ne connaît aucune règle en dur » qui en nomme une : le symptôme que la donnée était au
mauvais endroit. Ticket #839.

## Verrouillage en combat — général, pas ponctuel

Le déclencheur était un bug précis (activer les Avantages de groupe en pleine bataille détruisait
l'Avantage de tous les combattants, sans journal). **La correction n'est pas de réparer cette
transition, c'est d'interdire la classe** : AUCUNE règle optionnelle ne se change pendant un combat —
n'importe laquelle peut avoir le même effet de bord (cap d'Avantage, méthode d'Initiative, mode de
Blessures AA, durée de Round…). La porte se pose au point d'ÉCRITURE, pas seulement dans l'UI, et
l'indisponibilité porte sa RAISON en texte visible (primitive `GatedAction`).

**Why :** réparer la transition aurait demandé d'inventer une règle maison de reprise que le RAW ne
donne pas — pour un cas qui n'existe pas dans un livre (on ne change pas de ruleset au milieu d'un
combat sur une table). Interdire coûte moins cher, ne fabrique aucune house-rule, et couvre les 76
autres règles d'un coup.

**How to apply :**
- Toute nouvelle entrée de `OPTIONAL_RULES` doit porter une `ref` de livre. Pas de `ref` → c'est une
  préférence, elle va ailleurs.
- Un panneau générique qui nomme une entrée en dur signale une entrée mal classée — déplacer la
  donnée, jamais ajouter l'exception.
- Un écran qui dépasse ~2 sections passe en onglets (`Tabs`, jamais un `role="tablist"` recodé), les
  onglets DÉRIVÉS de la donnée, avec une garde prouvant qu'aucune entrée n'est perdue.

Lié : [[game-socle-variantes-avantages-groupe-non-valide]], [[game-vents-de-magie-integration]],
[[feedback-affordance-morte-signaler]], [[feedback-composer-primitives-jamais-markup-brut]].
