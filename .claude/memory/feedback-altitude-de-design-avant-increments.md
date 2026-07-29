---
name: feedback-altitude-de-design-avant-increments
description: "« Modifications trop basiques » — des incréments vérifiés ne remplacent pas une décision d'architecture prise AVANT de dépêcher ; le juge attaque le DESIGN d'abord sur toute vague transversale"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 032f0876-8eb3-421a-bddc-50a550c9bc09
  modified: 2026-07-29T10:29:59.980Z
---

Citation utilisateur (2026-07-29, verbatim) : « Tu as beau etre FABLE 5, j'ai l'impression que tu fais des modifications trop basique, plutot que de répondre aux attentes de facon intelligente. »

Contexte : la vague #939 (dés fixés). Chaque lot était petit, testé, mutation-prouvé, jugé — et pourtant trois passes de juge ont attrapé les symptômes un à un (22 flux en réussite gratuite, garde vacueuse, fausse justification « pas de cible ») pendant que l'utilisateur voyait la cause deux fois avant moi (« une raison pour que ces 6 modales sortent du lot ? », « je pensais que modifier le socle profitait à tout le monde »). La lecture intelligente de « reprends l'existant » était : l'existant a une ligne de faille (les specs possèdent de la logique de résolution) — la réparer D'ABORD rend la feature triviale.

**Why:** l'incrémental-vérifié optimise la sûreté de chaque pas, pas la justesse de la direction. Les juges trouvent des défauts dans ce qui est écrit ; ils ne trouvent pas ce qui aurait dû être conçu autrement. Quand la direction est trop basse, la vague converge par corrections successives coûteuses — et c'est l'utilisateur qui paie la revue d'architecture.

**How to apply:**
- Toute vague TRANSVERSALE (N flux, N écrans, N datasets) commence par un paragraphe de DESIGN dans mon fil : l'invariant, qui possède quoi (socle résout / feuilles déclarent), le critère « l'élément N+1 coûte une ligne ». Ce paragraphe est attaqué par un juge AVANT le premier codeur — passe de réfutation sur le design, pas seulement sur le diff.
- Signal d'alarme rétrospectif : si deux passes de juge successives corrigent la MÊME classe au même endroit, la classe est un défaut de design — arrêter les rustines, remonter d'un niveau.
- La lecture d'une demande utilisateur cherche l'INTENTION structurelle (« forcer la migration », « que tout le monde en profite »), pas la feature de surface.
- Jumelle de [[feedback-socle-resout-specs-adressent]] (l'instance) et de [[feedback-reflechir-avant-de-reagir]].
