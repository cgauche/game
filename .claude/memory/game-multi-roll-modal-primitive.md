---
name: game-multi-roll-modal-primitive
description: "La modale de jet MULTI (N contributeurs, influence par participant) EXISTE — makeRollFlow spec.multi + RollParticipant + buildParticipantRows/RollRow + ForceDoorModal ; réutiliser, ne pas dupliquer"
metadata: 
  node_type: memory
  type: reference
  originSessionId: fc8fbd88-39a7-45b7-a964-32b9d4050814
---

**Une modale de jet à PLUSIEURS jets (chacun avec sa propre cascade Chance/relance/+1 DR/Pacte/Résilience) est une
PRIMITIVE EXISTANTE — ne JAMAIS la redupliquer :**
- `makeRollFlow` (`src/state/rollFlowFactory.ts:346`) a un **mode `spec.multi` = { slots, idOf, replace }** (`RollFlowSpec.multi`, l.122) : les handlers
  (`roll/reroll/bonusSL/forceSuccess/setForcedRoll/darkPact`) prennent un `pid` (id du jet ciblé). « Le mono est le cas
  dégénéré N=1 » — une seule fabrique.
- `RollParticipant`/`MultiPending` (`rollFlowFactory.ts:520`/`:533`) : un jet du groupe ; `interactive?: boolean` → `true` = influençable,
  `false` = **témoin** (lecture seule, auto-roulé, façon `MultiRollList` ; chaque handler sort tôt sur `passive(loc.slot)`).
- **Une rangée de participant = `RollRow`** (`src/ui/RollRow.tsx`) : la rangée canonique mono ET multi, témoin
  compris. Les rangées se DÉRIVENT par `buildParticipantRows` (`src/ui/buildParticipantRows.tsx` : `ParticipantRow`
  = la FORME de donnée, éligibilités rerollable/darkPactable/forceShow en UN endroit) → `RollRowData[]`, jamais
  à la main dans une modale.
- **`ForceDoorModal`** (`src/ui/ForceDoorModal.tsx`) = le PATRON exact : une rangée `RollRow` par participant,
  `interactive={owns(part.id)}` (coop : seul le propriétaire influence SON jet), somme + confirm. Contre-sort aussi.

**Why:** sur le naval (Test d'équipage = N marins, DR sommés, MDG ch.14), j'allais **dupliquer une « nouvelle modale
multi-jets »** — le GM m'a rattrapé (« on modifie l'existant, on ne re-duplique pas »). La machinerie y répond
EXACTEMENT (PJ = `interactive`, marins PNJ = témoin). **How to apply:** tout jet à plusieurs contributeurs (Test
d'équipage, opposé multi, frappe groupée) = un flux `spec.multi` + des rangées `RollRow` dérivées par `buildParticipantRows`, patron `ForceDoorModal`.

**Arbitrage user 2026-07-10 (programme #276)** : le jet d'ÉQUIPE n'a « rien de particulier » — porte (simple multi), contresort (opposé multi) et Test d'équipage (DR sommé) sont la MÊME famille ; la seule variation est l'AGRÉGATION, qui est un paramètre de spec, jamais une forme nouvelle. Corollaire séquence : le trou est dans `CascadeStep` (mono-acteur) → extension sanctionnée = `CascadeStep.participants?` optionnel (ouvre la même modale multi) ; la FSM maison de `seaVoyageFlow` se REMPLACE — aucun « cas spécial mer » ne justifie une machinerie locale.

**Leçon doc (le GM l'a pointée) :** cette primitive N'ÉTAIT PAS dans la table « Primitives partagées » de
`Foundry/Game/CLAUDE.md` (qui ne listait que `RollFlowShell` mono) → introuvable depuis le point d'entrée → quasi-dup.
**Toute primitive partagée DOIT vivre dans cette table** (c'est elle qu'on lit « avant d'écrire »). Voir
[[credo-exemples-calibrants]], [[game-jet-modale-exhaustif]], [[game-rollflow-canonical-system]].
