---
name: game-contrat-art-verdict-harnais-refute-jamais-certifie
description: "#635 : le contrat scalaire (P90−P10≥30) se gamait PAR LE BAS ; désormais conjonction en VERDICT (écart≥30 ET clair%≥10, ancrage P90=base=ECHEC) — le harnais RÉFUTE, il ne certifie jamais"
metadata: 
  node_type: memory
  type: project
  originSessionId: 4a06634e-991a-4803-9853-2db4dc5bb092
  modified: 2026-07-20T12:35:31.186Z
---

**Chantier #635 (2026-07-20, commit du contrat-conjonction).** Le contrat d'art « P90−P10 ≥ 30 » se
franchissait PAR LE BAS : que des ombres, zéro surface éclairée (`serviteur/back` livré ainsi, jugé
BON en aveugle sur le scalaire). Trois maillons de l'échec, tous réparés :

1. **Un scalaire-cible se game par son degré de liberté impayé.** La palette donne ~12 pts au-dessus
   de la base et ~40 en dessous : un agent qui itère jusqu'au vert descend mécaniquement. Le contrat
   est désormais la CONJONCTION `écart ≥ 30 ET part claire ≥ 10 %` (plancher posé sur le trou
   empirique [8,4 ; 12,0] du sweep des 109 tenues), drapeau P90=base = ECHEC — c'est la STRUCTURE de
   l'intention (3 familles de valeur ancrées sur la palette), pas une statistique qui corrèle.
2. **Le contrat faux était écrit dans le décor** : `Serviteur.ts` portait verbatim « tomber ≥ 30 pts
   SOUS la base ». L'énoncé vit désormais en UN endroit (en-tête de `scripts/qc/mesure-volume.mts`,
   section CONTRAT) ; les defs n'ont que la réf nue.
3. **Producteur et vérificateur effondrés sur le MÊME proxy = zéro redondance.** Doctrine gravée dans
   `artiste.md`/`juge.md`/`creer-une-creature.md` : **le harnais RÉFUTE, il ne certifie jamais** —
   sa sortie est `NON-REFUTE`/`ECHEC`/`NON MESURABLE`, jamais « BON » ; le BON vient d'un juge qui a
   REGARDÉ le rendu. Tout cas « métrique verte / œil rouge » = bug du CONTRAT → ticket + extension du
   harnais + re-sweep `--all` (compte de la synthèse à faire décroître : 113/184/30 au 2026-07-20).

**Ne PAS re-mesurer à la main** : `npx tsx scripts/qc/mesure-volume.mts --all` rejoue le stock entier.
Suites ouvertes : [[game-socle-possessions-programme]] sans rapport ; tickets #638 (palettes à lumière
inexprimable — 6 inversées + marges quasi nulles, l'ÉTALON chevalier-du-loup-blanc échoue sur ses 3
vues) et #639 (30 vues NON MESURABLES — matières au gradient, l'échappatoire suivante si non couverte).
Voir [[feedback-preuve-mesuree-sur-le-chemin-reel]] (le masque définit la mesure — même famille).
