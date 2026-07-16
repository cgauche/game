---
name: feedback-effet-existant-general-parametrable
description: "Pour CHAQUE effet/condition : 1) regarder l'existant, 2) si absent, identifier le besoin, 3) le rendre le plus GÉNÉRAL et PARAMÉTRABLE possible (max d'options), 4) faire"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac3fb303-33fb-4bd5-999a-5b57154f44c2
---

L'utilisateur (2026-06-16) a énoncé la MÉTHODE à appliquer SYSTÉMATIQUEMENT pour tout effet / condition /
op à ajouter (RPG WFRP4) :

1. **Regarder ce qui EXISTE en priorité** (réutiliser, ne pas réinventer).
2. Si ça n'existe pas, **identifier précisément le besoin**.
3. **Le rendre le plus GÉNÉRAL et PARAMÉTRABLE possible** — proposer le MAX d'options, pas le strict
   minimum du cas courant.
4. Puis le faire.

**Exemple donné** : besoin = « la cible est-elle hostile ? » → ne PAS coder un booléen `hostile`. Demander
« qu'est-ce qui serait plus général ? » → une condition de RELATION/camp paramétrable : hostile / allié /
neutre / membre du groupe (il a précisé que c'était un exemple, sans savoir si on distingue les membres du
groupe des PNJ non-hostiles — c'est à moi d'investiguer l'existant et de proposer).

**Le faire EN AMONT du design** : présenter l'existant + la forme générale proposée AVANT de bâtir
(comme une mini-brainstorm), surtout quand l'utilisateur pose lui-même la question ouverte.

**Existant camp/relation trouvé** : `Combatant.kind: 'hero' | 'enemy' | 'npc'` (3 camps) ; relation dérivée
de l'égalité de `kind` (psychology.ts:213 `wantAlly ? v.kind===self.kind : v.kind!==self.kind` ; combatFlow
allié = même kind). Donc OUI on distingue membre-du-groupe (hero) / neutre (npc) / hostile (enemy).

Prolonge [[feedback-reutiliser-avant-reinventer]] et [[feedback-adversaire-creatif]] : c'est la version
« design d'op » de la règle « ops les plus globales/paramétrables, pas de vocab dupliqué ».
