---
name: game-socle-possessions-programme
description: "Programme SOCLE POSSESSIONS lancé le 2026-07-19 — spec committée, doctrine du modèle (porteur unique, identité bestiaire, union discriminée, overlay figé), chaîne de tickets #610-#627."
metadata: 
  node_type: memory
  type: project
  originSessionId: 28c73772-f9e8-48df-97c3-237da1659a39
  modified: 2026-07-19T20:48:43.557Z
---

**Programme lancé le 2026-07-19** — spec normative : `docs/plans/2026-07-19-socle-possessions.md`
(committée ; sera supprimée une fois le programme exécuté). Ticket-programme : #268.

**EXÉCUTION DÉMARRÉE le 2026-07-19** — session locale désignée par l'user pour MENER le programme
de bout en bout (mandat verbatim : « ce travail est capital »). Ordre : T0 assainissement d'abord
(vague A parallèle {#611, #612, #613} — disjoints ; puis vague B #610 seul, car #610 partage
trappings.json avec #611 et items.ts avec #612). Grounding + vérif RAW adversariale lancés AVANT
toute écriture (la spec §2 est un état mesuré EN DESIGN, re-vérifié au code + Source avant de
spécifier). Orchestration : agents codent, l'orchestrateur vérifie (gates complètes + réfutation).

**Doctrine du modèle (arbitrages user 2026-07-19, verbatims dans la spec §1)** :
- **Porteur unique** : « un héros, un mercenaire, ou une mule, c'est la même chose » — toute
  possession PORTE des `ItemInstance[]` avec les sémantiques du héros (equipped/inside/contenants,
  même Enc) ; JAMAIS un 2e système de poches. La mule ne va pas DANS un sac ([[game-doctrine-une-entite-n-livres-n-variantes]] reste vrai par ailleurs).
- **Identité du vivant = le BESTIAIRE** : les bêtes quittent trappings.json ; prix = facette
  `purchase` sur la créature ; réf vivante = `{creatureId}` | `{custom: CustomStatblock}` (dualité
  du spawn). Un PNJ custom de l'éditeur se donne par l'effet `givePossession` (dialogue à choix
  payant = patron canonique).
- **Pas de God-object** : tronc commun + union discriminée par nature (bete/serviteur/vehicule/
  navire/immeuble) — zéro champ étranger à sa nature.
- **Overlay FIGÉ à l'acquisition** : stats aléatoires LDB 77 tirées UNE fois, seedées par l'UID
  d'instance (« relancées à chaque combat ? Pas fou »), jamais un Combatant persisté pour une réf
  catalogue (édition Codex vivante).
- **Location de première classe** (avec-le-groupe | au-lieu | embarquée) + contenance récursive
  (code neuf — le tronc CargoCarrier ne somme pas les embarquées) + CASCADES d'écriture
  (naufrage corps-et-biens, succession au choix du joueur, abandon = perdu confirmé — décisions
  №1-6 entérinées 2026-07-19, spec §13).

**Chaîne** : T0 #610 (véhicules unifiés) #611 (vivant au bestiaire) #612 (bugs inventaire) #613
(poison libellé) → #531 T-bourse (migration **v10**) → T1 #614→#615 (**v11**)→#616→#617→#618 →
#619/#620/#621/#622/#623. Tranches : T2 #267+#250, T3 serviteurs (prérequis #453), T4 #356.
Parallèles : #624 (344 dotations équipement texte), #625 (écurie), #626 (capture), #627 (coop).
Dressage : #571 (bloqué par #618) → #437.

**Pièges consignés** : versions de save ASSIGNÉES (v10 bourse AVANT v11 socle) ; fourrage TARIFÉ
au RAW (PDT 03 l.251 : 1/– par cheval/jour fourrage compris ; LDB 66 écurie 10 sc/nuit) — un
« muet » s'affirme APRÈS grep du Source ; traits Dressé = 9 au RAW et liste OUVERTE (LDB 85).
Voir [[game-coop-dissociation-bg3]].
