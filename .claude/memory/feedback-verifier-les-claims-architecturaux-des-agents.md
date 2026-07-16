---
name: feedback-verifier-les-claims-architecturaux-des-agents
description: "Post-mortem 2026-07-11 (#341 défense) : une affirmation ARCHITECTURALE d'agent (« le seul seam partagé est X ») doit être contre-grepée comme un fait — des portes vertes ne valident pas la FORME, et des tests verts sur un câblage partiel ne révèlent jamais la surface oubliée."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

**Le raté (2026-07-11, sprint)** : le codeur #341 a rendu « le seul seam situationnel réellement partagé est `attackEnv` » et a câblé la météo par-surface (attaque + activités). FAUX : le collecteur passif canonique (`passiveMods` — celui de faim/traumas/mutations) existait. La défense (Parade/Esquive) a été oubliée — trouvé par l'audit adversarial, nommé par le user (« on n'a pas un GameOp pour les tests physiques ? » ; puis « comment le système a permis cela ? »).

**Why (double cause)** :
1. MOI : je vérifie faits/portes/tests, mais l'affirmation d'architecture est passée sans contre-grep — or des tests verts sur un câblage PARTIEL ne peuvent pas révéler la surface manquante (ils ne testent que ce qui a été écrit). Sous tempo, j'ai vérifié « ça marche » au lieu de « c'est la bonne forme ».
2. LE SYSTÈME : aucune garde ne protégeait le canal des modificateurs de Test — discipline par convention, donc dérive exprimable (« si on peut le gréper, on peut l'écrire »).

**How to apply** :
- Toute affirmation d'agent du type « X est le seul/le bon seam », « il n'y a pas de mécanisme pour ça », « la primitive n'existe pas » = un FAIT À CONTRE-VÉRIFIER (un grep du concept, 2 min) avant d'accepter le rendu — même portes vertes. C'est le pendant orchestrateur de [[feedback-chercher-le-canonique-top-down-avant-custom]].
- Quand un agent câble une source de mods/effets dans une surface, demander : « quelles AUTRES surfaces consomment cette classe ? » — si la réponse n'est pas « toutes, via le canal », c'est par-surface.
- La classe reçoit sa garde structurelle (quarantaine d'import du reader vers le collecteur + test de conformance transversal attaque/défense/activité) — posée le jour même, cf. [[feedback-gardes-structurelles-pas-greps]].
