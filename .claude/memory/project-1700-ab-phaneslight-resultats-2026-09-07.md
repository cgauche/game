---
name: project-1700-ab-phaneslight-resultats-2026-09-07
description: "A/B/C #1700 joué le 2026-09-06/07 sur #1650 : B (régime actuel) > C (PhanesLight + skill d'entrée) > A (PhanesLight seul) au juge aveugle ; aucune branche cherry-pickable (table de Talents dupliquée par l'extraction Marker, vérifiée au PDF) ; 5 défauts d'outil PhanesLight ; coûts 14,87 / 29,12 / 18,97 $ ; branches et worktrees à nettoyer sur décision utilisateur"
metadata: 
  node_type: memory
  type: project
  originSessionId: b92c8bcd-85a9-40b8-88ea-216704604df3
  modified: 2026-09-07T05:27:08.578Z
---

**Résultat (2026-09-07, session game-53)** — pilotage complet sur #1700 (commentaires du 2026-09-06 et 07, révélation incluse).

- Bras : A = PhanesLight seul (`ab/phanes` @ `c831422ca`, worktree `.wt-ab-phanes`), B = régime actuel (`ab/notre` @ `46ed0835f`, `.wt-ab-notre`), C = PhanesLight + skill `travailler-par-palier` (`ab/phanes-c` @ `fbbfc7604`, même worktree que A). Base `1cac27bb6`, même premier message.
- Juge aveugle (X=C, Y=A, Z=B) : **Z > X > Y**. B seule complète et gardée ; A laisse 6 rangs nus, aucun plan ; C = B à l'ordre près mais graphie hors lexique et un faux technique au commit. Portes/coût/temps : A > C > B.
- **Défaut partagé** : `Source/…/56 - Clan Skryre.md` l.77-83 duplique la table de Talents du Niveau 3 dans la section Niveau 2 (PDF p.360 : aucune table ; p.361 : 3 talents ; p.364 : les 6) → la prémisse 1 de #1650 est FAUSSE, les trois branches ont ajouté au technomage des Talents qu'il n'a pas. Ticket Source à ouvrir. Double comptage +5 CT des Talents « déjà inclus au profil » → #1701 (créé par B).
- Défauts d'outil PhanesLight : 4 de préparation (returns, registry, cli.js CJS, workflows .js supprimés lus par test:ops) + 1 de conception (`qui: orchestrator` ambigu, rôle de la session principale indéfini ; procédure sans forme invocable — corrigée pour C par un skill, verbatim user « Regarde, B a immédiatement su quoi faire » / « Sans changer notre prompt »).
- Arbitrages user du run : modèle = partie du régime (« Light utilise un orchestrator en Opus, et l'ancien utilise Fable en orchestrator ») ; « aucun commentaire sur le cobaye pendant un run » (B en a posté 2, retirés puis repostés) ; scripts de l'ancien régime hors de A (« Ces fichiers n'ont rien a y faire surtout »).
- **Reste dû** : décision d'adoption (utilisateur) ; cherry-pick de B après correction du technomage, de l'ordre du grand-maître et des `source.note` ; ticket Source (table dupliquée) ; ticket tronc « gates --serie : docs courtes avant la suite » ; suppression des worktrees `.wt-ab-*` et branches `ab/*` + `Game-phaneslight*` sur décision ; commentaires de B sur #1650 repostés (ids 5565223444, 5565223614).

Lié : [[project-passation-phaneslight-2026-09-06]], [[feedback-gates-docs-build-avant-lancement-sinon-25-min-perdues]], [[feedback-citation-prouve-ce-quelle-repond]].
