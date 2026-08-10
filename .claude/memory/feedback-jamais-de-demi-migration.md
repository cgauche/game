---
name: feedback-jamais-de-demi-migration
description: "Arbitrage user 2026-08-09 : pas de travail à moitié ni de demi-migration — une migration s'achève DANS son chantier, sinon chaque site non migré devient un bug à redécouvrir un mois plus tard"
metadata:
  type: feedback
---

Verbatim utilisateur (2026-08-09) : « En tout cas je n'aime pas le travail fait a moitié et les
demi-migrations, c'est a cause de cela qu'aujourd'hui on en est a revenir sur du travail fait il y
a un mois pour corriger un a un les éléments »

Contexte : chantier #1153 (départage sur la Compétence nue). La famille de bugs LDB 12 l.160
entière (#1149/#1150/#1151/#1153, 8+ copies) est née d'une migration antérieure du système de jet
arrêtée en chemin : les sites non migrés ont chacun re-codé leur dérivation artisanale, et un mois
plus tard on les corrige UN PAR UN.

**Why:** un site non migré n'est pas un « reste déclaré » neutre : c'est un bug en incubation
(mixte nu/fondu, divergence écran/verdict, chip anonyme…) plus un précédent que le code voisin
copie. Le coût de finir la migration dans le chantier est TOUJOURS inférieur au coût de
redécouvrir les sites un mois après, un incident à la fois. Durcit
[[feedback-migrer-l-existant-listes-doivent-decroitre]] et
[[feedback-ne-pas-livrer-complet-si-connu-incomplet]].

Second verbatim (2026-08-09, même chantier, adressé à L'ORCHESTRATEUR) : « Donc tu prefere
modifier 18 sites plusieurs fois, autant de fois que necessaire a chaque erreur, que régler le
problème a la racine ? » — j'avais fait repasser un codeur sur les MÊMES 18 sites au lieu de faire
déléguer les 4 monteurs locaux au monteur canonique du seam. La règle « 2 passes même classe =
remonter d'un niveau » s'applique au DÉCOUPAGE DES LOTS de l'orchestrateur, pas seulement au code :
quand N sites exigent la même retouche, le lot juste est le SOCLE (monteur/porte partagé) qui rend
les N sites déclaratifs — jamais N retouches.

**How to apply:**
1. Un chantier de migration liste ses sites EXHAUSTIVEMENT au démarrage (grounding mesuré, pas
   d'échantillon) et ne se FERME que la liste à zéro — les « restes déclarés » d'un lot sont un
   état INTERMÉDIAIRE entre deux lots du même chantier, jamais une sortie de chantier.
2. Un reste routé vers un ticket séparé n'est acceptable QUE si le geste y est d'une AUTRE nature
   (autre design, autre arbitrage à prendre) — jamais « la même migration, plus tard ».
3. Au moment de fermer un chantier : re-balayer (le balayage initial peut avoir des angles morts,
   cf. [[feedback-un-detecteur-ne-mesure-que-sa-couverture]]) et prouver que le motif ancien ne
   compile plus / échoue en garde (cliquet structurel), pas seulement « les sites connus sont
   migrés ».
