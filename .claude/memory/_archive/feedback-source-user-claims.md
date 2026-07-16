---
name: feedback-source-user-claims
description: "Ne JAMAIS croire l'utilisateur sur parole — vérifier toute affirmation (règles LDB ET modèle/archi/données) contre Source ET le code réel"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 024cd482-0bab-4295-9fab-7d5591050488
---

**Généralisé 2026-06-14 — « ne me crois jamais sur parole, tu as tout à fait le droit de vérifier ce que je te dis ».** Toute affirmation de l'utilisateur est une HYPOTHÈSE à vérifier — pas seulement les règles WFRP4 contre `Game/Source/` (LDB FR), mais AUSSI ses affirmations sur le **modèle/l'archi/la donnée** contre le **code réel**. Ex. vérifié 2026-06-14 : « le bestiaire LDB = des sous-types » / « les nommés ont un title » → confirmé en lisant `creatures.json` (58/62 LDB title=null+optionals ; nommés title+skills) ; et trouvé une divergence non dite (le critère est `title`/`optionals`, pas `source.book` ; l'apparence est partiellement du CODE) → signalée.

Règles WFRP4 (« Brisé = fuir/esquiver seulement », « Détermination ignore la psy… », « créature plus grande qui s'approche → Test de Calme »…) : idem, HYPOTHÈSE à sourcer contre le LDB FR.

**Why:** l'utilisateur l'a demandé explicitement — « je ne détiens pas forcément la vérité et elle peut être incomplète » + « vérifie ce que je te dis ». Il peut mal se souvenir, simplifier, ou oublier des cas.

**How to apply:**
- Citer le passage exact (livre + lignes) qui confirme/infirme/raffine chaque affirmation avant de coder.
- Le Source/ prime : s'il dit autre chose ou plus que l'utilisateur, **le signaler** (ne pas implémenter aveuglément la version de l'utilisateur).
- Surfacer aussi les **cas qu'il n'a PAS mentionnés** mais que le LDB définit (couverture exhaustive). C'est le rôle de l'audit de fidélité (workflow multi-agents code↔Source) — déjà éprouvé sur ce projet.
- **Cadrage (renforcé 2026-06-25) : le CRITÈRE est le RAW, PAS « ce que tu veux ».** Ne jamais justifier un choix par la préférence de l'utilisateur ; citer la règle. Et vérifier MÊME ses affirmations de règle (« je peux avoir tort aussi »). Ex. 2026-06-25 : il affirme « on peut être plusieurs par poste » → relu MDG ch.14, **confirmé et cité** (l.9 « Plusieurs Personnages peuvent contribuer à un même Test d'équipage » + l.15 Mousse fourre-tout) → implémenté parce que le RAW le dit, pas parce qu'il l'a dit.
- Prolonge [[game-no-mj-model-everything]] (« ne rien inventer ») + [[game-francais-jamais-anglais]] (Source **FR** uniquement, jamais la VO).
