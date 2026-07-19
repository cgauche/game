# Atlas RAW — Registre de couverture

> Contrat « l'Atlas remplace la source » : chaque chapitre des 15 livres doit être **couvert** (cité
> par une fiche `docs/raw/`) ou explicitement **hors-règle** (narratif). Un chapitre `⬜` = trou.
> Recourir à la source pour un point = un défaut de l'Atlas à corriger ici. Régénéré par
> `node scripts/raw/coverage.mjs`. Détail **section-granulaire** (H2) sous la table d'un chapitre
> qui enfouit une section : `⬜` = section sans aucune réf dans sa plage, `🔻 enfoui` = titre orné
> (`•`) rétrogradé par l'extraction — un défaut d'extraction, pas une section ordinaire (#454).

**Couverture (profondeur) : ✅ 151 couverts · 🟡 3 effleurés · ⬜ 0 trous** sur 154 chapitres-règles (hors artefacts OCR). ✅ = une fiche propriétaire le traite (≥3 refs) ; 🟡 = seulement cité en renvoi ; ⬜ = absent. Section-granulaire (H2, PARTIEL) : 77 section(s) trouée(s) — dont **57 bruit de scénario** (livres `SCENARIO_PUR` EDO/MSR/PDT/AU1 : prose de campagne, aucune règle) et **20 candidat(s) trou de règle** (reste : livres de règles + compagnons mixtes ACE/NADJ/ADE/MCLB/EDOC/MSRC/MDG, où une section vide peut cacher une vraie règle non couverte) — et 5 titre(s) de chapitre enfoui(s) détecté(s) (titre orné rétrogradé en H2 par l'extraction) — chiffre NON exhaustif : un chapitre crédité par CATALOGUE (transcription verbatim, pas de traitement) ne détaille jamais ses sections ici, et la granularité H2 sous-mesure structurellement les livres qui structurent leurs chapitres en H3 (LDB : 16 sections H2 pour 86 chapitres, MCLB : 0). Mesure indépendante sur l'ensemble des 997 sections H2 des 15 livres : 157 couvertes par une FICHE, 381 par un CATALOGUE, 459 (46 %) par NI L'UN NI L'AUTRE. Refonte de la mesure (granularité H3, distinction fiche/catalogue, zéro masquage silencieux) : **#604**. Par livre : LDB ✅71·🟡2·⬜0 · ADE I ✅2·🟡0·⬜0 · ADE II ✅6·🟡0·⬜0 · AA ✅13·🟡0·⬜0 · ZI ✅14·🟡0·⬜0 · MCLB ✅5·🟡0·⬜0 · EDO ✅3·🟡0·⬜0 · EDOC ✅4·🟡1·⬜0 · MSR ✅1·🟡0·⬜0 · MSRC ✅8·🟡0·⬜0 · PDT ✅4·🟡0·⬜0 · ACE ✅3·🟡0·⬜0 · AU1 ✅1·🟡0·⬜0 · NADJ ✅5·🟡0·⬜0 · MDG ✅11·🟡0·⬜0.

## LDB — ✅ 71 · 🟡 2 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | *(artefact OCR)* | ➖ | |
| 02 | Introduction | ➖ hors-règle | |
| 03 | *(artefact OCR)* | ➖ | |
| 04 | *(artefact OCR)* | ✅ | 7 (creation.md ×7) |
| 05 | *(artefact OCR)* | ✅ | 92 (creation.md ×52) |
| 06 | Classes | ✅ | 6 (carrieres.md ×3) |
| 07 | Carrières | ✅ | 69 (avancement.md ×45) |
| 08 | Statut | ✅ | 42 (carrieres.md ×22) |
| 09 | Compétences | ✅ | 144 (competences.md ×137) |
| 10 | Talents | ✅ | 68 (tests.md ×36) |
| 11 | *(artefact OCR)* | 🟡 | 2 (equipement.md ×1) |
| 12 | Tests | ✅ | 45 (tests.md ×41) |
| 13 | Combat | ✅ | 131 (combat.md ×122) |
| 14 | *(artefact OCR)* | ✅ | 125 (combat.md ×118) |
| 15 | Déplacement | ✅ | 85 (combat.md ×75) |
| 16 | États | ✅ | 52 (etats.md ×30) |
| 17 | Destin et Résistance | ✅ | 51 (destin.md ×27) |
| 18 | Traumatisme | ✅ | 109 (traumatisme.md ×67) |
| 19 | Corruption | ✅ | 36 (corruption.md ×29) |
| 20 | Maladies et infections | ✅ | 30 (maladies.md ×30) |
| 21 | Psychologie | ✅ | 52 (psychologie.md ×30) |
| 22 | Événements | ✅ | 6 (activites.md ×5) |
| 23 | Activités | ✅ | 36 (activites.md ×36) |
| 24 | Les dieux | ✅ |  |
| 25 | Les cultes | ✅ | 3 (religion.md ×3) |
| 26 | Le culte de Manaan, dieu de la mer | ✅ |  |
| 27 | Le culte de Morr, Dieu de la Mort | ✅ |  |
| 28 | Le culte de Myrmidia, déesse de la Stratégie | ✅ |  |
| 29 | Le culte de Ranald, Dieu de la ruse | ✅ |  |
| 30 | Le culte de Rhya, déesse de la Fertilité | ✅ |  |
| 31 | Le culte de Shallya, déesse de la Miséricorde | ✅ |  |
| 32 | Le culte de Sigmar, dieu de l’Empire | ✅ |  |
| 33 | Le culte de Taal, dieu de la Nature | ✅ |  |
| 34 | Le culte d’Ulric, dieu de la Guerre | ✅ |  |
| 35 | Le culte de Verena, déesse de la sagesse | ✅ |  |
| 36 | Les dieux ancêtres nains | ✅ |  |
| 37 | Les dieux elfes | ✅ |  |
| 38 | Les dieux halflings | ✅ |  |
| 39 | Les dieux du Chaos | ✅ |  |
| 40 | Les prières | ✅ | 45 (etats.md ×22) |
| 41 | Bénédictions | ✅ | 14 (religion.md ×9) |
| 42 | Miracles | ✅ | 4 (magie.md ×2) |
| 43 | Miracles de Rhya | ✅ |  |
| 44 | L’Aethyr | 🟡 | 2 (magie.md ×2) |
| 45 | *(artefact OCR)* | ➖ | |
| 46 | Les règles magiques | ✅ | 101 (magie.md ×56) |
| 47 | Listes des sorts | ✅ | 8 (magie.md ×7) |
| 48 | Magie des Couleurs | ✅ | 16 (magie.md ×16) |
| 49 | Sorcellerie | ✅ | 5 (magie.md ×5) |
| 50 | Magie noire | ✅ |  |
| 51 | Magie du Chaos | ✅ | 14 (deplacement.md ×14) |
| 52 | configuration du terrain | ➖ hors-règle | |
| 53 | *(artefact OCR)* | ➖ | |
| 54 | La politique | ➖ hors-règle | |
| 55 | Colonies | ➖ hors-règle | |
| 56 | Sites anciens et ruines terrifiantes | ➖ hors-règle | |
| 57 | La monnaie | ✅ | 1 (economie.md ×1) |
| 58 | *(artefact OCR)* | ➖ | |
| 59 | Faire son marché | ✅ | 18 (economie.md ×18) |
| 60 | Fabrication | ✅ | 16 (economie.md ×13) |
| 61 | Encombrement | ✅ | 40 (equipement.md ×18) |
| 62 | Les armes | ✅ | 110 (combat.md ×103) |
| 63 | Armures | ✅ | 40 (combat.md ×35) |
| 64 | Sacs et contenants | ✅ |  |
| 65 | Vêtements et accessoires | ✅ |  |
| 66 | Nourriture, boisson et hébergement | ✅ |  |
| 67 | Outils et nécessaires | ✅ | 5 (equipement.md ×5) |
| 68 | Livres et documents | ✅ |  |
| 69 | Outils professionnels et Ateliers | ✅ |  |
| 70 | Animaux et véhicules | ✅ |  |
| 71 | Drogues et poisons | ✅ | 2 (equipement.md ×2) |
| 72 | Herbes et potions | ✅ | 8 (equipement.md ×8) |
| 73 | Prothèses | ✅ | 5 (equipement.md ×5) |
| 74 | Possessions diverses | ✅ | 12 (equipement.md ×12) |
| 75 | Mercenaires | ✅ |  |
| 76 | Point d’Impact des Créatures | ✅ | 53 (combat.md ×29) |
| 77 | Les populations du Reikland | ✅ | 9 (combat.md ×5) |
| 78 | Les Bêtes du Reikland | ✅ |  |
| 79 | Les bêtes monstrueuses du Reikland | ✅ |  |
| 80 | Les hordes de peaux-vertes | ✅ |  |
| 81 | *(artefact OCR)* | ➖ | |
| 82 | Les morts sans repos | ✅ |  |
| 83 | Esclaves des Ténèbres | ✅ |  |
| 84 | *(artefact OCR)* | ➖ | |
| 85 | Traits de créature | ✅ | 298 (combat.md ×203) |

## ADE I — ✅ 2 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | LES GRANDES PROVINCES | ➖ hors-règle | |
| 02 | CLANS HALFLING DU REIKLAND | ➖ hors-règle | |
| 03 | GUIDE DU GRAND COMTÉ DU MOOTLAND | ➖ hors-règle | |
| 04 | Les nains impériaux | ➖ hors-règle | |
| 05 | Guide de Karak Azgaraz | ➖ hors-règle | |
| 06 | Guide de la Laurelorn | ➖ hors-règle | |
| 07 | Annexe I | ✅ | 2 (competences.md ×2) |
| 08 | Annexe II | ✅ | 1 (etats.md ×1) |

## ADE II — ✅ 6 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | Mercenaires ogres dans le Vieux Monde | ✅ |  |
| 02 | Les ogres | ✅ | 50 (combat.md ×43) |
| 03 | Des signes dans le ciel | ✅ |  |
| 04 | Un peu de magie | ✅ | 35 (combat.md ×24) |
| 05 | L’hospice | ➖ hors-règle | |
| 06 | Le personnel | ➖ hors-règle | |
| 07 | Les patients | ➖ hors-règle | |
| 08 | Le théâtre de la guerre | ✅ | 70 (combat.md ×69) |
| 09 | Annexe I | ✅ | 1 (activites.md ×1) |

**Sections enfouies/trouées** (granularité H2, invisibles au niveau chapitre — les ⬜ sont des candidats trou de règle) :

- **ADE II 01** (Mercenaires ogres dans le Vieux Monde) :
  - 🔻 enfoui l.248-249 « VOUS REPRENDREZ BIEN UN MORCEAU ? PERSONNAGES JOUEURS OGRES » — titre orné rétrogradé par l'extraction, 0 réf
- **ADE II 04** (Un peu de magie) :
  - ⬜ l.3-16 « UN PEU DE MAGIE OBJETS MAGIQUES ET ENCHANTEMENTS • • » — candidat trou de règle, 0 réf
  - ⬜ l.102-117 « LE PRODUIT FINI » — candidat trou de règle, 0 réf
  - ⬜ l.118-134 « TABLEAU DE CRÉATURE ALÉATOIRE » — candidat trou de règle, 0 réf
  - ⬜ l.185-192 « Armes magiques » — candidat trou de règle, 0 réf
  - ⬜ l.289-355 « ENCHANTEMENTS TEMPORAIRES » — candidat trou de règle, 0 réf
  - ⬜ l.356-373 « ATOUTS D'ARMURE MAGIQUE » — candidat trou de règle, 0 réf
  - ⬜ l.374-397 « Boucliers magiques » — candidat trou de règle, 0 réf
  - ⬜ l.398-425 « Parchemins » — candidat trou de règle, 0 réf
  - ⬜ l.426-439 « Bâtons » — candidat trou de règle, 0 réf
  - ⬜ l.440-509 « Baguettes » — candidat trou de règle, 0 réf
  - ⬜ l.510-521 « DES HAVRES DE REPOS » — candidat trou de règle, 0 réf

## AA — ✅ 13 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | CRÉDITS | ✅ | 9 (combat.md ×5) |
| 02 | INTRODUCTION | ✅ | 2 (competences.md ×2) |
| 03 | LES CHEVALIERS DE L'EMPIRE | ✅ | 3 (competences.md ×3) |
| 04 | LES CHIENS DE GUERRE | ✅ |  |
| 05 | LA TILÉE ET LES PERSONNAGES TILÉENS | ✅ | 1 (competences.md ×1) |
| 06 | LE CULTE DE MYRMIDIA | ✅ | 25 (combat.md ×24) |
| 07 | MISES À JOUR DE L'ÉTAT HÉMORRAGIQUE | ✅ | 46 (combat.md ×41) |
| 08 | LA RÉSERVE DE L'INTENDANT | ✅ | 100 (combat.md ×99) |
| 09 | LE COMBAT MONTÉ | ✅ | 24 (combat.md ×23) |
| 10 | L'ARTILLERIE ET LES DÉGÂTS INFLIGÉS AUX STRUCTURES | ✅ | 96 (combat.md ×90) |
| 11 | ANNEXE I AVANTAGES DE GROUPE | ✅ | 12 (combat.md ×12) |
| 12 | ANNEXE II ACTIVITÉS DE GUERRIER | ✅ | 17 (combat.md ×16) |
| 13 | ANNEXE III NOUVEAUX TALENTS ET TALENTS MIS À JOUR | ✅ | 18 (combat.md ×17) |

**Sections enfouies/trouées** (granularité H2, invisibles au niveau chapitre — les ⬜ sont des candidats trou de règle) :

- **AA 02** (INTRODUCTION) :
  - 🔻 enfoui l.26-666 « DES SOLDATS EN TOUT GENRE » — titre orné rétrogradé par l'extraction, 2 réf
- **AA 06** (LE CULTE DE MYRMIDIA) :
  - 🔻 enfoui l.554-559 « UNE APPROCHE ALTERNATIVE DES BLESSURES » — titre orné rétrogradé par l'extraction, 2 réf
- **AA 09** (LE COMBAT MONTÉ) :
  - 🔻 enfoui l.191-502 « LES INTÉRIMAIRES DE L'AVENTURE » — titre orné rétrogradé par l'extraction, 1 réf
- **AA 10** (L'ARTILLERIE ET LES DÉGÂTS INFLIGÉS AUX STRUCTURES) :
  - 🔻 enfoui l.280-435 « LA POURSUITE DE L'EXCELLENCE » — titre orné rétrogradé par l'extraction, 21 réf

## ZI — ✅ 14 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | TROIS EXPÉDITIONS | ✅ | 7 (combat.md ×5) |
| 02 | Griffon | ✅ | 6 (combat.md ×3) |
| 03 | Dragon | ✅ |  |
| 04 | « L'abominable » Halagrundsor | ✅ | 1 (etats.md ×1) |
| 05 | Amibe | ✅ | 1 (etats.md ×1) |
| 06 | Cockatrice | ✅ |  |
| 07 | Chimère | ✅ |  |
| 08 | Grand taurus | ✅ |  |
| 09 | Trégara | ✅ |  |
| 10 | Macareux à bec tranchant | ✅ |  |
| 11 | Chat sauvage | ✅ |  |
| 12 | Il Potente Granchio | ✅ |  |
| 13 | Sirène | ✅ | 6 (etats.md ×3) |
| 14 | Expéditions prévues | ✅ | 26 (combat.md ×22) |

## MCLB — ✅ 5 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | MIDDENHEIM | ➖ hors-règle | |
| 02 | Guide du visiteur | ➖ hors-règle | |
| 03 | Au-delà des murs | ➖ hors-règle | |
| 04 | Bestiaire | ✅ |  |
| 05 | Le Grand-Duché | ➖ hors-règle | |
| 06 | Les Petits Rois | ➖ hors-règle | |
| 07 | Cultes du Chaos de Middenheim | ✅ |  |
| 08 | ANNEXE I | ✅ |  |
| 09 | ANNEXE II | ✅ |  |
| 10 | ANNEXE III | ✅ |  |

## EDO — ✅ 3 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | Chapitre 1 - On recherche - aventuriers courageux | ➖ hors-règle | |
| 02 | Chapitre 2 - Erreur sur la personne | ➖ hors-règle | |
| 03 | Chapitre 3 - Le cœur de l’Empire | ➖ hors-règle | |
| 04 | Chapitre 4 - Sur la route de Bögenhafen… | ➖ hors-règle | |
| 05 | Chapitre 5 - Le faux héritage | ➖ hors-règle | |
| 06 | Chapitre 6 - La Schaffenfest | ➖ hors-règle | |
| 07 | Chapitre 7 - Dans les ténèbres | ✅ | 3 (combat.md ×3) |
| 08 | Chapitre 8 - Chasser les ombres | ➖ hors-règle | |
| 09 | Chapitre 9 - L’heure fatidique | ✅ | 3 (combat.md ×3) |
| 10 | APPENDICE 1 - Un guide de Bögenhafen | ➖ hors-règle | |
| 11 | APPENDICE 2 - Nouvelles règles | ✅ | 19 (combat.md ×19) |
| 12 | Annexe 3 - Documents et aides de jeux | ➖ hors-règle | |

**Sections enfouies/trouées** (granularité H2 — livre de `SCENARIO_PUR`, les ⬜ sont du bruit de scénario, PAS des trous de règle) :

- **EDO 07** (Chapitre 7 - Dans les ténèbres) :
  - ⬜ l.9-14 « ENTRER DANS LES ÉGOUTS » — bruit de scénario, 0 réf
  - ⬜ l.15-20 « PENDANT CE TEMPS-LÀ, AILLEURS… » — bruit de scénario, 0 réf
  - ⬜ l.21-30 « S'AVENTURER DANS LES ÉGOUTS » — bruit de scénario, 0 réf
  - ⬜ l.31-39 « Se déplacer dans les égouts » — bruit de scénario, 0 réf
  - ⬜ l.40-59 « Les égouts et les couleurs » — bruit de scénario, 0 réf
  - ⬜ l.60-68 « Vue, ouïe et odorat » — bruit de scénario, 0 réf
  - ⬜ l.69-84 « RENCONTRES FACULTATIVES » — bruit de scénario, 0 réf
  - ⬜ l.85-155 « TABLE DES ÉVÉNEMENTS ALÉATOIRES » — bruit de scénario, 0 réf
  - ⬜ l.156-159 « EMPLACEMENTS PRINCIPAUX » — bruit de scénario, 0 réf
  - ⬜ l.160-173 « Lieu d'entrée du gobelin » — bruit de scénario, 0 réf
  - ⬜ l.174-209 « Porte des Piques Croisées » — bruit de scénario, 0 réf
  - ⬜ l.210-225 « Cadavre de Gottri » — bruit de scénario, 0 réf
  - ⬜ l.226-229 « Tuyaux d'évacuation » — bruit de scénario, 0 réf
  - ⬜ l.230-233 « Canal <sup>à</sup> ciel ouvert » — bruit de scénario, 0 réf
  - ⬜ l.234-244 « Temple secret » — bruit de scénario, 0 réf
  - ⬜ l.245-265 « OPTIONS : LIBÉREZ LE DÉMON ! » — bruit de scénario, 0 réf
  - ⬜ l.266-271 « AU SORTIR DES ÉGOUTS » — bruit de scénario, 0 réf
  - ⬜ l.272-277 « Aller se coucher » — bruit de scénario, 0 réf
  - ⬜ l.278-291 « La Fin du Voyage » — bruit de scénario, 0 réf
  - ⬜ l.292-293 « CONCLUSION » — bruit de scénario, 0 réf
  - ⬜ l.294-306 « Récompenses » — bruit de scénario, 0 réf
  - ⬜ l.307-308 « PNJ » — bruit de scénario, 0 réf
- **EDO 09** (Chapitre 9 - L’heure fatidique) :
  - ⬜ l.7-12 « DÉCLENCHER LE RITUEL » — bruit de scénario, 0 réf
  - ⬜ l.13-28 « Une visite inattendue » — bruit de scénario, 0 réf
  - ⬜ l.29-59 « LE MESSAGE » — bruit de scénario, 0 réf
  - ⬜ l.60-73 « UN HORRIBLE MEURTRE » — bruit de scénario, 0 réf
  - ⬜ l.74-102 « OPTION : LES NERFS QUI LÂCHENT » — bruit de scénario, 0 réf
  - ⬜ l.103-108 « Pris au piège ! » — bruit de scénario, 0 réf
  - ⬜ l.109-119 « S'enfuir de la maison » — bruit de scénario, 0 réf
  - ⬜ l.120-133 « UNE CHOSE APRÈS L'AUTRE » — bruit de scénario, 0 réf
  - ⬜ l.134-141 « UN INCIDENT FLAMBOYANT » — bruit de scénario, 0 réf
  - ⬜ l.142-145 « L'OSTENDAMM » — bruit de scénario, 0 réf
  - ⬜ l.146-156 « OPTION : DES MUTANTS… LUNATIQUES » — bruit de scénario, 0 réf
  - ⬜ l.157-164 « L'Entrepôt 17 » — bruit de scénario, 0 réf
  - ⬜ l.165-176 « L'Entrepôt 13 » — bruit de scénario, 0 réf
  - ⬜ l.177-180 « L'INSTANT CRITIQUE » — bruit de scénario, 0 réf
  - ⬜ l.181-189 « Derniers préparatifs » — bruit de scénario, 0 réf
  - ⬜ l.190-201 « La consécration » — bruit de scénario, 0 réf
  - ⬜ l.202-214 « Le rituel » — bruit de scénario, 0 réf
  - ⬜ l.215-230 « Faire échouer le rituel » — bruit de scénario, 0 réf
  - ⬜ l.231-252 « Voler ou détruire des éléments indispensables » — bruit de scénario, 0 réf
  - ⬜ l.253-271 « Le rituel est interrompu » — bruit de scénario, 0 réf
  - ⬜ l.272-317 « Le rituel est achevé » — bruit de scénario, 0 réf
  - ⬜ l.318-325 « OPTION : TRAUMA » — bruit de scénario, 0 réf
  - ⬜ l.326-327 « CONCLUSION » — bruit de scénario, 0 réf
  - ⬜ l.328-334 « Récompenses » — bruit de scénario, 0 réf
  - ⬜ l.335-340 « Répercussions » — bruit de scénario, 0 réf
  - ⬜ l.341-350 « Convaincre les autorités » — bruit de scénario, 0 réf
  - ⬜ l.351-357 « OPTION : QUEL DEGRÉ DE CORRUPTION ? » — bruit de scénario, 0 réf
  - ⬜ l.358-375 « Quitter la ville » — bruit de scénario, 0 réf
  - ⬜ l.376-379 « Éviter le Guet » — bruit de scénario, 0 réf
  - ⬜ l.380-383 « Excursions sur le Reik » — bruit de scénario, 0 réf
  - ⬜ l.384-414 « OPTION : UNE REFONTE DE GIDEON » — bruit de scénario, 0 réf
  - ⬜ l.415-416 « PNJ » — bruit de scénario, 0 réf
  - ⬜ l.417-467 « L'Entrepôt 17 » — bruit de scénario, 0 réf
  - ⬜ l.574-750 « CHRONOLOGIE DE BÖGENHAFEN » — bruit de scénario, 0 réf

## EDOC — ✅ 4 · 🟡 1 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | INTRODUCTION | ➖ hors-règle | |
| 02 | Commentaires des invités | ➖ hors-règle | |
| 03 | CHAPITRE 1 - « Easter eggs » | ➖ hors-règle | |
| 04 | *(artefact OCR)* | ➖ | |
| 05 | CHAPITRE 2 - L’Empire | ➖ hors-règle | |
| 06 | Chapitre 3 - Les routes et grandes routes | 🟡 | 1 (deplacement.md ×1) |
| 07 | Chapitre 4 - Montures et véhicules | ✅ | 19 (deplacement.md ×19) |
| 08 | CHAPITRE 5 - Voyager | ✅ | 10 (deplacement.md ×7) |
| 09 | *(artefact OCR)* | ➖ | |
| 10 | CHAPITRE 6 - Patrouilleurs routiers | ➖ hors-règle | |
| 11 | CHAPITRE 7 - Toutes les routes mènent à Bögenhafen | ➖ hors-règle | |
| 12 | CHAPITRE 8 - Les mutants dans l’Empire | ✅ |  |
| 13 | CHAPITRE 9 - La Main pourpre - Guide du Meneur | ✅ | 9 (talents.md ×5) |
| 14 | CHAPITRE 10 - Sur la route | ➖ hors-règle | |
| 15 | CHAPITRE 11 - L’Affaire du joyau caché - Un mélodrame à l’intrigue complexe | ➖ hors-règle | |
| 16 | CHAPITRE 12 - LE CARNAVAL DU PANDÉMONIUM | ➖ hors-règle | |

**Sections enfouies/trouées** (granularité H2, invisibles au niveau chapitre — les ⬜ sont des candidats trou de règle) :

- **EDOC 06** (Chapitre 3 - Les routes et grandes routes) :
  - ⬜ l.39-74 « Les Diligences des Quatre Saisons » — candidat trou de règle, 0 réf

## MSR — ✅ 1 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | PRÉFACE - Un peu d’histoire | ➖ hors-règle | |
| 02 | INTRODUCTION | ➖ hors-règle | |
| 03 | CHAPITRE 1 - De Bögenhafen à Altdorf | ➖ hors-règle | |
| 04 | CHAPITRE 2 - D’Altdorf à Kemperbad | ➖ hors-règle | |
| 05 | CHAPITRE 3 - De Kemperbad aux Crêtes noires | ➖ hors-règle | |
| 06 | CHAPITRE 4 - De Grissenwald aux Collines stériles | ➖ hors-règle | |
| 07 | CHAPITRE 5 - D’Unterbaum à Wittgendorf | ➖ hors-règle | |
| 08 | CHAPITRE 6 - Wittgendorf | ➖ hors-règle | |
| 09 | CHAPITRE 7 - Château von Wittgenstein | ➖ hors-règle | |
| 10 | CHAPITRE 8 - Une halte en chemin | ➖ hors-règle | |
| 11 | APPENDICE I - L’entraînement et les mentors | ✅ |  |

## MSRC — ✅ 8 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | PRÉFACE - UN PEU D’HISTOIRE | ➖ hors-règle | |
| 02 | Commentaires des Auteurs | ➖ hors-règle | |
| 03 | CHAPITRE 1 - « EASTER EGGS » | ➖ hors-règle | |
| 04 | CHAPITRE 2 - Les herbes et leurs usages | ✅ | 4 (maladies.md ×4) |
| 05 | CHAPITRE 3 - Scènes coupées | ➖ hors-règle | |
| 06 | CHAPITRE 4 - Les fleuves de l’Empire | ➖ hors-règle | |
| 07 | CHAPITRE 5 - Navigation fluviale | ✅ |  |
| 08 | CHAPITRE 6 - La Patrouille fluviale impériale | ➖ hors-règle | |
| 09 | CHAPITRE 7 - Compagnons de voyage | ✅ |  |
| 10 | CHAPITRE 8 - LES RIVERAINS | ➖ hors-règle | |
| 11 | CHAPITRE 9 - Le service des tours impériales à signaux | ➖ hors-règle | |
| 12 | CHAPITRE 10 - Personnalisation | ✅ | 9 (reconciliation.md ×7) |
| 13 | CHAPITRE 11 - Règles du commerce | ✅ |  |
| 14 | CHAPITRE 12 - Naufrageurs, contrebandiers et pirates | ✅ |  |
| 15 | CHAPITRE 13 - Bestiaire fluvial | ✅ | 14 (combat.md ×14) |
| 16 | CHAPITRE 14 - Maladies transmises par l’eau | ✅ | 16 (maladies.md ×16) |
| 17 | CHAPITRE 15 - La Couronne Rouge Guide du Meneur de Jeu | ➖ hors-règle | |
| 18 | CHAPITRE 16 - L’Empereur Luitpold | ➖ hors-règle | |
| 19 | CHAPITRE 17 - La vengeance du Roi des tombes | ➖ hors-règle | |

**Sections enfouies/trouées** (granularité H2, invisibles au niveau chapitre — les ⬜ sont des candidats trou de règle) :

- **MSRC 15** (CHAPITRE 13 - Bestiaire fluvial) :
  - ⬜ l.3-4 « CHAPITRE 13 BESTIAIRE FLUVIAL » — candidat trou de règle, 0 réf
  - ⬜ l.5-28 « RIVIÈRES PÉRILLEUSES » — candidat trou de règle, 0 réf
  - ⬜ l.29-65 « SANGSUES GÉANTES » — candidat trou de règle, 0 réf
  - ⬜ l.66-104 « XIII » — candidat trou de règle, 0 réf

## PDT — ✅ 4 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | Avant-propos | ➖ hors-règle | |
| 02 | Introduction | ➖ hors-règle | |
| 03 | En route vers Middenheim | ➖ hors-règle | |
| 04 | Middenheim | ➖ hors-règle | |
| 05 | LE PLAN MACHIAVÉLIQUE | ➖ hors-règle | |
| 06 | Enquêtes préliminaires | ➖ hors-règle | |
| 07 | LE CARNAVAL | ➖ hors-règle | |
| 08 | Les pouvoirs en place | ➖ hors-règle | |
| 09 | LE TRAÎTRE DÉMASQUÉ | ➖ hors-règle | |
| 10 | Fiches de PNJ | ✅ |  |
| 11 | dopplegänger | ✅ |  |
| 12 | HYPNOTISME | ✅ | 6 (competences.md ×6) |
| 13 | POINTS D’EXPÉRIENCE | ✅ | 6 (avancement.md ×6) |
| 14 | CALENDRIER DES ATTRACTIONS PRINCIPALES | ➖ hors-règle | |

**Sections enfouies/trouées** (granularité H2 — livre de `SCENARIO_PUR`, les ⬜ sont du bruit de scénario, PAS des trous de règle) :

- **PDT 13** (POINTS D’EXPÉRIENCE) :
  - ⬜ l.81-82 « ANNEXE V » — bruit de scénario, 0 réf

## ACE — ✅ 3 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | La Couronne de l’Empire | ➖ hors-règle | |
| 02 | Le gouvernement d’Altdorf | ➖ hors-règle | |
| 03 | Les gangs d’Altdorf | ➖ hors-règle | |
| 04 | La Grande Puanteur | ➖ hors-règle | |
| 05 | La rive sud | ➖ hors-règle | |
| 06 | Le Quartier est | ➖ hors-règle | |
| 07 | La Ville Nord | ➖ hors-règle | |
| 08 | La Cité souterraine | ➖ hors-règle | |
| 09 | Au-delà des murs | ➖ hors-règle | |
| 10 | L’Espionnage à Altdorf | ✅ |  |
| 11 | Cultes interdits et groupes extrémistes | ✅ |  |
| 12 | Activités | ✅ | 17 (activites.md ×17) |

## AU1 — ✅ 1 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | introduction | ➖ hors-règle | |
| 02 | Si un regard pouvait tuer | ➖ hors-règle | |
| 03 | pour étoffer un peu | ➖ hors-règle | |
| 04 | Ça fait beaucoup de Traits ! | ✅ | 7 (combat.md ×7) |
| 05 | *(artefact OCR)* | ➖ | |
| 06 | LES FOUS DE GOTHEIM | ➖ hors-règle | |
| 07 | *(artefact OCR)* | ➖ | |
| 08 | Pour étoffer un peu | ➖ hors-règle | |
| 09 | Démarrer l’aventure | ➖ hors-règle | |
| 10 | CŒUR DE VERRE | ➖ hors-règle | |
| 11 | Pour étoffer un peu | ➖ hors-règle | |
| 12 | Démarrer l’Aventure | ➖ hors-règle | |
| 13 | *(artefact OCR)* | ➖ | |
| 14 | MASSACRE À SPITTLEFELD | ➖ hors-règle | |
| 15 | Pour étoffer un peu | ➖ hors-règle | |
| 16 | Comment commencer l’aventure | ➖ hors-règle | |
| 17 | *(artefact OCR)* | ➖ | |
| 18 | D’Appâts et de Sorciers | ➖ hors-règle | |
| 19 | Pour étoffer un peu | ➖ hors-règle | |
| 20 | Débuter l’Aventure | ➖ hors-règle | |
| 21 | *(artefact OCR)* | ➖ | |
| 22 | Les coupables | ➖ hors-règle | |
| 23 | Pour étoffer un peu | ➖ hors-règle | |
| 24 | Comment commencer l’Aventure | ➖ hors-règle | |
| 25 | Index des PNJ | ➖ hors-règle | |
| 26 | *(artefact OCR)* | ➖ | |

## NADJ — ✅ 5 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | Avant-propos | ➖ hors-règle | |
| 02 | Introduction | ➖ hors-règle | |
| 03 | Une nuit agitée aux Trois Plumes | ➖ hors-règle | |
| 04 | *(artefact OCR)* | ➖ | |
| 05 | *(artefact OCR)* | ✅ | 7 (combat.md ×4) |
| 06 | Une journée au tribunal | ✅ | 13 (combat.md ×13) |
| 07 | *(artefact OCR)* | ➖ | |
| 08 | Une nuit à l’Opéra | ✅ | 3 (combat.md ×3) |
| 09 | *(artefact OCR)* | ➖ | |
| 10 | le mariage de nastassia | ➖ hors-règle | |
| 11 | *(artefact OCR)* | ✅ | 6 (combat.md ×6) |
| 12 | *(artefact OCR)* | ➖ | |
| 13 | SEIGNEUR D’UBERSREIK - | ➖ hors-règle | |
| 14 | appendice I - Gnomes | ➖ hors-règle | |
| 15 | _GoBack | ➖ hors-règle | |
| 16 | JEUX DE TAVERNE | ✅ | 17 (tests.md ×14) |
| 17 | *(artefact OCR)* | ➖ | |

**Sections enfouies/trouées** (granularité H2, invisibles au niveau chapitre — les ⬜ sont des candidats trou de règle) :

- **NADJ 06** (Une journée au tribunal) :
  - ⬜ l.314-427 « PERSONNAGES NON JOUEURS » — candidat trou de règle, 0 réf
- **NADJ 16** (JEUX DE TAVERNE) :
  - ⬜ l.107-120 « LE TORCHON TREMPÉ » — candidat trou de règle, 0 réf

## MDG — ✅ 11 · 🟡 0 · ⬜ 0

| Ch. | Titre | État | refs (propriétaire) |
|---|---|---|---|
| 00 | Index | ➖ hors-règle | |
| 01 | La Mer des Griffes | ➖ hors-règle | |
| 02 | La Bretonnie et le Wasteland | ✅ | 4 (magie.md ×4) |
| 03 | La côte du Nordland | ✅ | 4 (reconciliation.md ×4) |
| 04 | La côte de l'Ostland | ➖ hors-règle | |
| 05 | Le Pays des Trolls | ➖ hors-règle | |
| 06 | Kraka Ravnsvake | ➖ hors-règle | |
| 07 | La côte des Skaelings | ✅ | 24 (carrieres.md ×24) |
| 08 | La côte des Bjornlings | ➖ hors-règle | |
| 09 | La classe Côtier | ✅ | 32 (carrieres.md ×32) |
| 10 | Le culte de Manann | ✅ | 2 (religion.md ×2) |
| 11 | Le culte de Stromfels | ✅ | 1 (religion.md ×1) |
| 12 | Navires et construction navale | ✅ | 132 (equipement.md ×60) |
| 13 | Navigation maritime | ✅ | 139 (combat.md ×83) |
| 14 | Navigation à bord de grands vaisseaux | ✅ | 47 (maladies.md ×19) |
| 15 | Longs voyages | ✅ | 49 (deplacement.md ×23) |
| 16 | Bestiaire | ✅ | 10 (bestiaire.md ×10) |

**Sections enfouies/trouées** (granularité H2, invisibles au niveau chapitre — les ⬜ sont des candidats trou de règle) :

- **MDG 03** (La côte du Nordland) :
  - ⬜ l.213-239 « APAISER LES MORTS » — candidat trou de règle, 0 réf
  - ⬜ l.240-299 « SOUS LES ALGUES » — candidat trou de règle, 0 réf
