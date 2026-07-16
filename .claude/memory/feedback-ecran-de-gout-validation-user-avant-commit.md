---
name: feedback-ecran-de-gout-validation-user-avant-commit
description: "Écran à forte charge de goût (sélection perso, menus, hubs) = UNE itération, capture au user, ATTENDRE son verdict avant de committer/enchaîner — jamais 4 refontes en chaîne"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

2026-07-13, écran de sélection des héros : 4 refontes commitées dans la journée, chacune
recalée à chaud sur une nouvelle critique user découvrant l'état précédent. Verdict user :
« 15ieme refonte de l'écran de selection de personnage ... qui a validé ca ? » — réponse
honnête : moi, sur captures, sans jamais attendre son regard entre deux itérations.

**Why:** sur un écran de GOÛT (composition, hiérarchie visuelle), mes vérifications
mécaniques (portes vertes, mesures de scroll, auto-contrôles d'interdits) valident la
CONFORMITÉ aux directives, pas le RESSENTI — et le user est le juge final déclaré du
mandat. Committer puis découvrir la critique = churn, historique pollué, confiance érodée.

**How to apply:** pour tout écran dont la valeur est esthétique/UX (pas un fix mécanique) :
une itération → capture présentée au user → STOP, attendre son verdict explicite → alors
seulement committer et/ou enchaîner. Si le user est absent, l'itération reste en WIP non
commité (ou commit unique tagué « en attente de verdict » si l'arbre doit rester propre) —
on passe à un AUTRE chantier au lieu d'itérer en aveugle sur le même écran. Cf.
[[user-mandat-chef-de-produit]] (« juge final = l'utilisateur sur planches/écrans ») et
[[feedback-questions-stop-loop]].

**DÉLÉGATION explicite 2026-07-14** (verbatim : « Une fois que tu valideras l'écran,
passe a l'écran suivant ») : pour les lots d'écrans du programme créateur #393 (P1→P5)
— la maquette étant RATIFIÉE et l'étalon au dépôt — la validation d'écran passe à
l'ORCHESTRATEUR : gate = juge vision vs maquette + revue orchestrateur sur captures,
puis commit et enchaînement du lot suivant SANS solliciter le user par écran. Le user
garde le veto a posteriori (chaque écran validé lui est montré en une capture au fil de
l'eau). Cette délégation ne s'étend PAS d'elle-même aux écrans hors #393.
