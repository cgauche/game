---
name: user-art-delegue-autre-session
description: "Tout ce qui est lié à l'ART appartient à une session dédiée : l'orchestration ne dépêche pas d'artiste et ne touche pas aux rigs"
metadata:
  type: user
---

**Verbatim (2026-08-04)** : « Je demanderais a un autre agent de faire tout ce qui est lié a l'art, donc ne les touches pas »

**Why :** l'utilisateur sépare les fils — moteur, UI et données d'un côté, art de l'autre.
**How to apply :** ne jamais dépêcher d'agent artiste ni éditer `src/gameIso/rig/**` depuis une session d'orchestration ; les décisions d'art arbitrées (gabarits, périmètres) se consignent sur leur ticket pour que la session d'art les trouve ; sur arbre partagé, les commits restent path-scopés hors rig.
