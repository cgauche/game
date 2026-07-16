---
name: game-supprimer-legacy
description: "Sur Foundry/Game, l'utilisateur veut qu'on SUPPRIME le legacy/POC obsolète, pas qu'on le contourne ou le laisse traîner."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

Sur `Foundry/Game`, quand un échafaudage / prototype / chemin legacy est remplacé par du
vrai code, l'utilisateur veut qu'on le **supprime franchement** — pas qu'on le neutralise
en le vidant (`= {}`) ou en le shadowant.

**Why :** « Pense a faire les choses bien mais surtout a netoyer/supprimer le legacy ».
Cohérent avec [[game-existant-poc-refactor-libre]] (le rendu/sprites est un POC, refactor
libre). Du code mort qui traîne masque des bugs et trompe sur l'état réel.

**Étendu (2026-06-13) :** « pas de rétro-compatibilité, pas de code dupliqué, pas de
legacy/deprecated ». Quand on remplace un mécanisme, on **supprime l'ancien chemin** — jamais
« ancien + nouveau côte à côte ». Ex. : en ajoutant le tooltip Codex partout, on RETIRE les
`title={entry.desc}` bruts (pas de doublon) ; en ajoutant le lore aux Dieux, on ÉTEND `CultDef`
(pas un `gods.json` concurrent du module `cults/`). Une seule primitive par motif.

**How to apply :**
- Supprimer le fichier/la branche legacy ET ses points d'appel (imports, conditions), pas
  juste vider la donnée. Relocaliser le peu de code encore vivant qui y vivait.
- Exemple vécu : `slice-soldat.ts` était un PROTOTYPE (« archétype pour valider le facing
  avant la génération d'art de masse »). Il court-circuitait l'art réel via `SLICE_TENUES`
  (career.ts) et `SLICE_HEADS` (cosmetic.ts). Supprimé en entier ; `WEAPON_EPEE` (art
  vivant) relocalisé dans equipment.ts.
- **Retirer un shadow expose l'art réel sous-jacent → l'auditer** : ici le visage généré
  `Humain:M` (heads.ts) avait un `</g>` en trop (XML invalide) masqué depuis toujours par
  le slice. Vérifier l'équilibre des balises (`scripts/_dbg-heads.mts`) après dé-shadowing.
- Galeries : `npm run galleries` régénère tout depuis l'existant ; le hub `galeries.html`
  ne référence QUE les galeries vivantes (pas de montages PNG ponctuels périmés).
