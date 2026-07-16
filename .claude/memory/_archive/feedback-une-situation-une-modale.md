---
name: feedback-une-situation-une-modale
description: "Une situation = UNE modale ; réutiliser le moteur de séquence + la coquille unique, ne RIEN créer de parallèle"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 51a3d70e-8940-4706-88c1-14273fb078cb
---

« Une situation = une modale. » Une attaque (jet + défense + critique + maladresse + assommante + abattre + destin + déviation/piège + colère/imparfaite) doit se dérouler dans **une seule fenêtre**, comme la nuit/repos/voyage.

**Why:** les 4 modales (`RollModal` attaque, `DefenseModal`, `CastModal` magie, `CascadeModal` nuit) **retournent toutes `<RollFlowShell>`** — c'est la coquille UNIQUE. Le moteur de séquence `cascade.ts` est le séquenceur unique. Donc « on n'est pas censé créer quoi que ce soit, mais réutiliser le système qu'on a créé » (mot de l'utilisateur). J'avais dérivé en routant les conséquences vers un pending séparé (`pendingCascade` purpose `combat`, titre « Conséquences ») rendu par un composant séparé → React démonte/remonte la coquille = 2ᵉ fenêtre. La modale « Conséquences » est une aberration qui n'aurait jamais dû exister.

**How to apply:** une situation de combat = UN `pendingCascade`, **jet = étape 0** (props attaque/défense/magie actuelles, réutilisées), conséquences = étapes suivantes, rendu par la même coquille restée montée. NE PAS inventer de composant/pending/mécanisme parallèle ; brancher le flot sur l'existant. Quand on framework-ise « il faut extraire le corps riche d'une modale » → red flag : il n'y a pas de « riche », juste des props/slots de `RollFlowShell`. Nettoyer toute dérive (code mort) avant de laisser quelqu'un tomber dedans. Prolonge [[game-panneau-de-jet-unique]], [[game-modales-unification]], [[feedback-contenu-donnee-editeur-pas-code]] (réutiliser/généraliser, pas dupliquer), [[feedback-garder-objectif-macro]].
