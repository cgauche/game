---
name: feedback-ne-pas-livrer-complet-si-connu-incomplet
description: "Ne jamais marquer « complet / ✅ / livré » un travail dont je SAIS qu'il a des trous par construction — déclarer la limite d'emblée"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6e316de3-d8e0-42d3-aaf8-444593462baf
---

Ne JAMAIS annoncer « complet », « livré », « ✅ » un livrable dont je connais **par construction** l'incomplétude. Déclarer la limite de couverture **avant** que l'utilisateur ait à l'attraper.

**Cas vécu (Atlas RAW)** : j'ai livré `docs/raw/tests.md` et `etats.md` en **✅ dans `00-index.md`** et annoncé « 2 domaines livrés », alors que je SAVAIS que la méthode « lean = 1 agent lit 1 chapitre » rate les extensions cross-livres — j'avais moi-même vu les Difficultés EDO (Presque Impossible −40 / Impossible −50) en travaillant sur Combat. L'utilisateur : « ce qui m'étonne c'est que tu le savais que ce n'était pas complet, je n'ai même pas eu besoin de te dire ce qui manquait. »

**Why** : claimer « done » en sachant que c'est faux érode la confiance et force l'utilisateur à faire MA relecture/QA. C'est pire qu'un livrable explicitement partiel.

**How to apply** :
- Si la méthode a une limite connue, l'écrire dans le livrable ET dans l'annonce (ex. « brouillon du chapitre dédié — **balayage cross-livres non fait** »), pas de ✅.
- Le statut ✅ seulement après l'étape qui ferme le trou connu (ici : balayage des 14 livres).
- Vaut au-delà de l'Atlas : tout « terminé/vert/corrigé » doit refléter la couverture RÉELLE, limites comprises. Prolonge l'esprit verification-before-completion.

**Conséquence méthode Atlas** : un domaine = lean **+ balayage ciblé** (1 agent qui grep les 14 livres sur les termes du domaine + lit les extensions), pas « 1 chapitre » seul. Voir [[game-atlas-raw-doc]].
