---
name: feedback-relance-agent-verifier-le-contenu-pas-le-status
description: "Relancer un agent mort : un git status PROPRE ne veut pas dire « rien n'a été fait » — le travail peut être DÉJÀ COMMITTÉ. Vérifier le CONTENU (le livrable existe-t-il ?), pas la saleté de l'arbre. Incident 2026-07-17 : 2 lots relancés « de zéro » sur un travail déjà au tronc."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: cb384a41-d20a-494b-aa60-728b2ed7534f
---

**Incident (2026-07-17)** : trois agents morts sur limite de session. Avant de relancer, j'ai vérifié `git status` sur leurs périmètres → **propre** → j'ai briefé les relances avec « ton prédécesseur n'a rien écrit, tu pars de zéro ». **Faux** : les bras des 12 tenues étaient DÉJÀ dessinés et **committés** (`b259db8c`, « pause de la vague, état committé tel quel sans revue », demandé par l'user à une session parallèle). Le status était propre parce que l'arbre était AU NIVEAU du tronc, pas parce que le travail n'existait pas.

Les deux agents relancés ont rattrapé ma faute : ils ont détecté le commit, pivoté d'eux-mêmes de « produire » vers « faire la revue QC jamais faite », et rendu des rapports impeccables. Mais c'est eux qui m'ont corrigé, pas l'inverse.

**Why :** `git status` mesure la SALETÉ de l'arbre, pas l'EXISTENCE du livrable. Trois états distincts se confondent dans un status propre : (a) rien n'a été fait ; (b) le travail est committé ; (c) le travail est dans un autre arbre (worktree/session). Briefer sur (a) sans avoir exclu (b) et (c) fabrique une prémisse fausse — et un agent obéissant l'aurait exécutée en REPEIGNANT par-dessus du travail validé, churn de goldens compris.

**How to apply :**
- **Avant toute relance d'agent mort : vérifier le CONTENU du livrable, pas le status.** Pour de l'art : le slot est-il encore front-only (`typeof p === 'string'`) ? Pour du code : le symbole/la garde existe-t-il ? Une commande de 10 secondes (`git log --oneline -2 -- <fichier>`, un grep du symbole) évite un lot entier de travail en double.
- **Un brief de relance porte l'état VÉRIFIÉ, daté** (« au commit X, le slot bras de Garde est une string front-only ») — jamais une déduction du status.
- **Le pivot des agents est le bon patron à prescrire** : tout brief de production devrait dire « si tu découvres que le livrable existe déjà, PIVOTE en revue et rapporte » — c'est ce que les deux lots ont fait spontanément et ça a produit la revue qu'un commit « sans revue » attendait.
- L'arbre est PARTAGÉ : d'autres sessions committent PENDANT que mes agents meurent et relancent. La fenêtre morte (limite de quota) est précisément le moment où l'état bouge le plus.

Lié : [[feedback-background-agent-not-done-until-notified]] (le symétrique : pas fini avant notif ; ici, fini AVANT le brief), [[game-parallel-codeurs-shared-tree-and-rebase]], [[feedback-avancer-en-autonomie-jamais-serialiser]], [[env-session-background-pieges-outils]].
