---
name: game-qc-reconnaissabilite
description: "Méthode QC « reconnaître chaque sprite sans son nom » — runbook + workflows dans le repo ; + critères durables de barre de qualité (silhouette d'abord, anti-blob)"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 5b5e1576-6e66-4371-b038-61f34984d882
---

**Audit de reconnaissabilité des sprites** (barème fixé par l'utilisateur : *chaque arme/
monstre doit se reconnaître au 1er coup d'œil sans connaître son nom* ; reconnaître ≠
parfait, le vernis vient après). Méthode **headless**, documentée dans le repo :

- **Runbook** : `docs/qc-reconnaissabilite-sprites.md` (pipeline 5 étapes).
- Rendu PNG : `npx tsx scripts/_qc-render.mts` (+ `_qc-montage*.mts`) via `@resvg/resvg-js`
  (rastérise SVG→PNG sans navigateur ; un agent peut `Read` l'image et juger).
- Audit aveugle : `Workflow({scriptPath:"scripts/qc/qc-recognizability.workflow.js"})` —
  2 juges/élément devinent sans le nom, notent 1–5.
- Corriger : armes à la main dans `parts/equipment.ts` (manche relié à la tête, vers −y) ;
  créatures via `scripts/qc/creatures-redo.workflow.js` (best-of-2 + juge aveugle) →
  `_ingest-creatures-redo.mjs` (front + dos/profil).
- **Écarter les faux ratés** : créatures rig-handled = sprite mort (F1), bonnes lectures
  ratées par le matcher (synonymes), PNJ nommés.

Passe 2026-06-05 : armes 13/13 reconnaissables + 14 monstres redessinés (Troll/Pégase/
Pieuvre/Zombie/Goule/Skavens…). À affiner plus tard : Troll trop trapu, Géant≈ogre, obscurs.
Voir [[game-rig-2d-paper-doll]], [[game-goal-sprites-anims-complets]].

**Critères de barre de qualité (durables, ⊥ du support SVG/rig)** — style « toon » cel-shadé visé :
silhouette trapue/lisible, palette juste, visage net, un accessoire de caractère. Travers récurrents à
éviter : pattes en échasses, corps en ballon (pattes ≈ 1/3 hauteur, corps qui domine). **Anti-BLOB, pas
anti-couleur** : le travers à proscrire est la forme informe collée par défaut sur une créature qui ne
devrait pas la porter (ex. un blob vert sur un pigeon = bug) ; une couleur EST légitime quand elle sert
une vraie silhouette (orcs/gobelins/mutants/Chaos ont le droit d'être verts) — la règle est silhouette
d'abord, jamais la couleur en soi. Silhouette reconnaissable = « l'idée qu'on s'en fait » (pigeon = oiseau
dodu, loup = canidé svelte et bas, dragon = ailé cornu allongé), jamais un blob.
