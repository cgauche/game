---
name: feedback-no-hors-scope-no-debt
description: Interdit de parker du nettoyage en « hors scope » ; un type menteur EST de la dette → la solder dans le même lot
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5b6e3f22-7155-4d2e-bf85-94656ba3d0fa
---

L'utilisateur : « Pas de dette technique, je n'aime pas les "hors scope" ». Quand j'avais livré #76 (bugs `[object Object]` de stats d'arme) en **différant** la normalisation data (`TrappingData.reach: string|null` qui stocke en réalité des NOMBRES pour la Portée des armes à distance — un **type menteur**), au motif « hors scope / éviter un conflit avec la session parallèle », il a refusé : la dette se solde **dans le même lot**, pas plus tard.

**Why:** un « hors scope » qui laisse un type menteur / une demi-correction = de la dette qui ne sera jamais reprise et qui re-piège le code suivant. Le risque de conflit avec une autre session ne justifie pas de parker la dette (au pire on isole/coordonne, on ne diffère pas).

**How to apply:** quand un fix expose une dette adjacente (type qui ment, champ conflaté, demi-migration), **finir la migration complète** dans le lot : migrer la donnée, retyper, corriger **TOUS** les consommateurs (grep exhaustif — pas seulement ceux du premier passage : ex. `Number(t.reach)` dans `MerchantPanel` que j'avais loupé), et poser un **garde-fou** (test data) qui verrouille l'invariant pour que le type menteur ne revienne pas. Ne jamais annoncer « différé / hors scope » comme une issue de sortie. Prolonge [[feedback-zero-retrocompat-briques-solides]], [[game-supprimer-legacy]], [[feedback-orchestrator-verify-delete-redo]].
