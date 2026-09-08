---
name: feedback-table-hors-ordre-canonique-verifier-le-pdf
description: "Vécu #1700/#1650 (2026-09-07) : une table du Source/ (extraction Marker) placée HORS de l'ordre canonique de sa section (Talents avant le profil, identique à la table de la section suivante) était un artefact d'extraction — trois sessions et le ticket l'ont citée comme vérité ; seul le PDF a tranché. Règle : ordre anormal ou doublon entre sections = ouvrir le PDF à la page avant de citer"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b92c8bcd-85a9-40b8-88ea-216704604df3
  modified: 2026-09-07T05:27:20.582Z
---

**Fait** : `Source/Warhammer - Habitants & Créatures du Vieux-Monde (Discord) PDF/56 - Clan Skryre.md` l.77-83 porte, sous « Niveau 2 — Technomage », une table de six Talents AVANT le profil de caractéristiques, identique ligne pour ligne à celle du Niveau 3 (l.213-220) ; la table propre du Niveau 2 est à l.121-127 (trois Talents) et le PDF (pages 360/361/364, `pymupdf`) le confirme. Le ticket #1650 citait l.83, et les trois sessions A/B/C de #1700 ont posé des Talents faux. Un juge aveugle a vu l'anomalie parce qu'il a comparé l'ORDRE des sections (Compétences → Talents → Traits) aux autres niveaux, puis a demandé le PDF ; aucun des trois « Source/ en main » ne l'a fait.

**Why** : `Source/` est la vérité CITABLE, mais c'est une extraction ; elle ment de deux façons connues : coupure de ligne (« Sans peur » / « (Tout) », LDB 08 l.1472-1474) et maintenant DUPLICATION de table entre sections. Une citation vraie d'une ligne fausse passe tous les contrôles de forme.

**How to apply** :
1. Avant de citer une TABLE de statbloc : vérifier que sa position suit l'ordre canonique de la section et qu'elle n'est pas identique à celle de la section voisine ; si l'un des deux cloche, ouvrir le PDF à la page (`Read` pages, ou `pymupdf` via script — `python -c` est bloqué, un fichier .py passe) et citer PDF + ligne.
2. Une contradiction interne (Compétence « 50 + 2 DR » à côté d'un Talent « +3 DR ») est un signal, pas un détail.
3. Une anomalie d'extraction confirmée = ticket Source (corriger le .md ET garder la trace), même classe que #1595/#1653 pour les citations étirées.

Lié : [[feedback-citation-prouve-ce-quelle-repond]], [[project-1700-ab-phaneslight-resultats-2026-09-07]].
