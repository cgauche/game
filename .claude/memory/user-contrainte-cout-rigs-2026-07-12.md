---
name: user-contrainte-cout-rigs-2026-07-12
description: "Contrainte BUDGET user (2026-07-12, verbatim : « je ne pourrais plus lancer de rigs, ca coute maintenant trop chere ») — plus JAMAIS de vague d'art massive (20-30 artistes Fable + juges vision) ; le front rigs passe en mode ciblé-unitaire ou gelé."
metadata: 
  node_type: memory
  type: user
  originSessionId: adfd4529-35c1-4ae9-85da-f959f7971274
---

**Verbatim user (2026-07-12)** : « Malheureusement je ne pourrais plus lancer de rigs, ca coute maintenant trop chere. »

Contexte de coût constaté : ronde 2 A5a ≈ 6,3M tokens de sous-agents (140 agents), ronde 3 ≈ 3,4M (55 agents) — les vagues d'art (artistes Fable en parallèle + juges vision par créature) sont la charge dominante de la session.

**Why :** les workflows d'art multiplient des agents Fable (le seul modèle validé pour le SVG, cf. [[feedback-svg-art-fable-pas-opus]]) sur des dizaines de créatures, chacun avec lecture d'images — coût structurellement élevé, désormais au-dessus du budget user.

**How to apply :**
1. **Plus AUCUNE vague d'art massive** (workflow multi-artistes + re-jugement) sans demande EXPLICITE de l'user — même sous ultracode, même si des restes de fidélité sont connus.
2. Le front rigs passe en mode **ciblé-unitaire** : une créature à la fois, sur demande user, un seul artiste Fable, jugement par l'user lui-même sur planche (pas de panel de juges vision payant).
3. L'état du front à la coupure (2026-07-12, commit 234093cb) : score ronde 3 = 4 fidèles / 22 approx / 1 sans-rapport sur 27, MAIS re-juges suspectés d'ANCRAGE (griefs répétés verbatim alors que les artistes les avaient réfutés preuve à l'appui — pixel sampling cornu, manticore en cadre). Une éventuelle reprise devra juger EN AVEUGLE (sans le grief précédent dans le prompt). Restes détaillés consignés sur le ticket d'art (#342).
4. Chantiers rigs restants NON lancés (gelés par cette contrainte) : A5b curation des clones (~80 entrées/6 rigs), vague desc-based des créatures sans artwork (9 + squig/trégara/basilic).

Lié : [[feedback-workflows-calibres-taille]], [[game-chasse-contenu-en-dur-2026-07-12]].
