---
name: feedback-audit-nest-pas-ordre-de-travail
description: "Une liste d'audit (surtout par petit modèle / preuve mono-fichier) sur-rapporte — ce sont des pistes à VÉRIFIER contre la réalité, jamais un ordre de travail ; ne JAMAIS créer de contenu redondant."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cc3c50b6-6b95-4bfa-87ec-88d29228f1d4
---

Un audit adversarial « quels systèmes n'ont pas de scénario / ne sont pas éditables » produit des **faux
positifs** quand ses auditeurs sont de petits modèles à preuve limitée (mono-fichier). Exemple : l'audit a
classé Imparfaites / Contre-sort / Surincantation / Colère des dieux / magie des mers comme
« SCÉNARIO-MANQUANT » alors que `src/scenes/test-scenarios/magie.ts` les couvre DÉJÀ toutes (Aelindra Haute
Sorcière + 10 Prêtres un par dieu + IA caster des 2 camps avec dissipation + Grand Prêtre à 3 Péchés). J'ai
failli créer 6 scénarios redondants avant que l'utilisateur me coupe (« tu abuses un peu là, on a déjà un
scénario de sorcier ultra puissant avec un prêtre par dieu »).

**Why** : suivre une liste d'audit littéralement = produire du doublon et du bruit, l'inverse du but
(nettoyer/mutualiser). Le coût d'un faux positif suivi est élevé (contenu redondant à maintenir).

**How to apply** :
- Traiter tout rapport d'audit/agent comme des **pistes à vérifier**, pas un work-order. Avant d'agir sur
  « X manque », GREP l'existant (scénarios, Effets, données) et confirmer que ça manque VRAIMENT.
- Se méfier des verdicts adossés à un seul fichier de preuve, et des auditeurs en modèle rapide.
- Ne créer un scénario/Effet/contenu QUE si un existant ne le couvre pas déjà — jamais en parallèle d'un
  équivalent. Cf. [[feedback-reutiliser-avant-reinventer]], [[feedback-garder-objectif-macro]].
- Quand l'utilisateur dit « tu abuses », dial back : c'est un signal de sur-ingénierie, pas d'accélérer.
