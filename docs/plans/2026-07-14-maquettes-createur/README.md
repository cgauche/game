# Maquettes RATIFIÉES — créateur de personnage, charte « Atelier du scribe » (2026-07-14)

Artefact DATÉ (politique `docs/plans/`) : à SUPPRIMER une fois la transposition #393
exécutée (git porte l'historique). Ratification utilisateur 2026-07-14 (verbatim : « Donc
je vais valider ca ») — l'étalon de STYLE des lots de transposition, pas de texte
(délégation : « Je ne demande pas de la fidélité sur le texte, mais au moins sur le style »).

> **L'étalon se juge à 1600.** Chaque mock est dessiné dans une boîte `1600×830`
> (`.mock{width:1600px;height:830px}`) : c'est la LARGEUR DE RÉFÉRENCE de la planche, et la seule
> à laquelle une capture de l'app se compare à elle. Une preuve prise à 1280 montre un écran
> LÉGITIMEMENT plus dense — pas un défaut de transposition : ne jamais conclure « c'est étriqué »
> d'une capture hors étalon (le kit de recette a shooté à 1280 pendant deux jours, d'où deux jours
> de faux verdicts — lot « matières & proportions » #393). `scripts/recette/lib.mjs` shoote
> désormais à 1600 par défaut (cf. `docs/recette-navigateur.md` § Preuve headless) ; le responsive
> se juge à part, à sa propre passe (900/700/560/360).

## Contenu

- `planche-creator-FINALE.html` — les 10 écrans du créateur (autonome, fonts à lier ou
  ouvrir depuis le dossier Discord `Desktop/planches-warhammer/` pour la version inlinée).
- `design-system-atelier.html` — le kit UI (tokens, organismes, interdits, notes datées).
- `finale-mock0-race.png` … `finale-mock9-presentation.png` — captures 1600px de référence
  pour les juges vision des lots P1-P5 (cf. #393).
- `planche-compagnie.html` + `compagnie-mock0/1.png` — l'écran de SÉLECTION DE LA
  COMPAGNIE (hors créateur), conforme au kit v2. Décisions propres (2026-07-13) : la
  compagnie en COLONNE RICHE (jamais annulée — miniaturisée : le bouton groupe porte les
  portraits + « (X/4) ») ; candidats en tuiles-portraits ; présentation du candidat élu
  PAR LE PERSONNAGE (⚠ le bouton « Qui est-ce ? » est MORT — arbitrage v5, verrouillé par
  PartyScreen.test:219 qui interdit la CHAÎNE ; la rubrique de la planche qui porte encore
  ce titre est un FOSSILE à ne pas copier — titrer la bio autrement ou sans titre)
  du candidat élu ; même colonne de droite universelle que le créateur. Le code socle
  (sélection v4/v5, commits 3c486ded/7cfceda8) précède la peau Atelier — sa transposition
  est un lot de #371/#414, pas de #393.

## OSSATURE CANONIQUE du créateur (croquis user 2026-07-15 — `ossature-croquis-user.png`)

Toutes les étapes (sauf peut-être le Récapitulatif) suivent LE MÊME format de page :
- **Bande BOUTONS** au-dessus de la zone de choix : les actions de l'étape (« Choisir » /
  « Lancer les dés »...) TOUJOURS présentes, jamais reléguées au rail.
- **CHOIX** (zone principale) : la grille/les contrôles de l'étape.
- **DESC** (panneau droit, pleine hauteur) : la fiche de l'ÉLUE (Race/Carrière) sur les
  premières étapes, puis la FICHE VIVANTE — et cette fiche vivante est IDENTIQUE à celle
  du choix des personnages (le détail candidat du lobby : `HeroSheet` COMPLET, bande
  figurine+identité+rose comprise — user 2026-07-15 : « elle est sensé etre identique a
  celle utilisé pour le choix des personnages dans la creation »). Pas de variante
  d'alcôve propre au créateur.
- **Machine à états** : (1) choix de l'action → (2) si « lancer » : jet de dés, sélection
  AUTO dans la grille, infos importantes MISES EN VALEUR dans la fiche de droite, boutons
  toujours présents → (3) si validé : choix SCELLÉ (sceau sur la tuile élue) et Suivant.

## Gate de validation (tous lots d'écrans — juge vision ET codeur)

Le juge vision compare le STYLE **et la COMPOSITION**. Non-conformité AUTOMATIQUE,
quel que soit le rendu visuel : (a) une caractéristique affichée hors `CharStatsGrid` ;
(b) une compétence/talent/objet/axe référencé en TEXTE NU au lieu d'une chip codex-liée
(EntityChip/SkillChip/TalentChip/CodexRef) ; (c) toute liste d'entités sans affordance.
Précédent : le détail candidat de #417 livré en texte nu avec le bon cadre — « on a
réinventé un truc moins complet et n'utilisant aucune primitive » (user, 2026-07-14).
Le cadre ne suffit pas : le CORPS compose les primitives.

## Règle de préséance (pour tout agent d'exécution)

**La maquette fait foi du STYLE, jamais des DONNÉES** (user, 2026-07-14 : « la maquette
n'est pas exempte de défaut non plus sur les données affichées ») : valeurs, libellés et
exemples des planches ont été composés à la main pour le rendu — l'app compose depuis les
datasets réels, et une divergence de DONNÉE avec la maquette n'est jamais un défaut de
l'app. Un juge vision compare la composition/typo/matières, pas les chiffres.

**Le gabarit partagé n'autorise JAMAIS à déplacer dans le rail ce que la maquette compose
au CENTRE** (user, 2026-07-15, étape 3 : « ni de près, ni de loin, la maquette » — méthode/
allocations/Destin&Résilience relégués au rail et centre en parchemin crème, là où mock2
compose bande méthode + rangées 2 colonnes sombres + bandes d'allocation DANS le panneau
central). Un juge qui « recadre » un écart de composition au nom du gabarit se trompe :
le gabarit fournit les zones, la maquette dicte ce qui va dans chacune.

En cas de conflit entre un BRIEF et la maquette ratifiée : **LA MAQUETTE PRIME**, sauf
pour les écarts listés ci-dessous (seuls arbitrages qui la surclassent). Un brief qui
contredit la maquette hors de cette liste est présumé fautif — le signaler, suivre la
maquette (précédent : « tuiles nominatives » d'un brief P2 vs tuiles-portraits de la
maquette, 2026-07-14 — la maquette avait raison).

## Écarts CONNUS où les arbitrages priment sur la maquette

0quater. **Compteurs : la JAUGE CRANTÉE prime sur le compteur texte de la planche**
   (arbitrage user 2026-07-15, verbatim : « Perso le style utilisé pour les carac me vont,
   le truc cranté, mais je ne veux pas 10 facon de faire la même chose »). La planche
   compte partout en texte `.cu-sechead .cnt` (laiton 12,5px + chiffre `#ffe6a8` 14px) ;
   l'app garde la MATIÈRE crantée (`NotchGauge`) avec la TYPO `.cnt` de la planche pour son
   libellé. UN SEUL idiome partout (tirage, augmentations, Destin&Résilience, quotas,
   budget, talents) — le badge vert « n/m » est MORT (le vert n'est pas une couleur de
   comptage). Grandes plages : le COMPOSANT bascule sur la barre de piste de la planche
   (`.cu-minibar .fill`) au-delà de ~12 — décision prise dans la primitive depuis la
   donnée, jamais par l'appelant.

0bis. **Carte de contrat : les AXES dominants remplacent les « 3 compétences clés »**
   de la maquette (arbitrage user 2026-07-14 : « Ca ne me dérange pas de mettre les
   axes ») — cohérence avec la rose et le rail des porteurs ; la typo reprend le style
   small-caps de la ligne maquette.
0. **« Acte d'engagement » → « CONTRAT d'engagement »** (planche compagnie) : le mot
   « acte » lit comme un acte de théâtre/d'histoire — testé sur l'utilisateur lui-même,
   perplexe (2026-07-14). Toute la cérémonie (alcôve, sceau, gabarits) est conservée,
   seul le mot change : « Les contrats d'engagement », « CONTRAT I-IV », « Un contrat
   vierge attend son aventurier ».

0ter. **Étape CARACTÉRISTIQUES : la maquette a PERDU la répartition des 5 avances de
   carrière** (user, 2026-07-15 : « la maquette sur carac a un défaut, on ne peut plus
   répartir les 5 points de carrière ») — la MÉCANIQUE (allouer 5 avances aux
   caractéristiques de la carrière, compteur restant) doit exister dans le nouvel écran,
   mais TRANSPOSÉE dans la composition Atelier : affordance repensée pour le nouveau
   design (arbitrage user 2026-07-15 : « évite de garder l'existant sur le sujet, mais
   bien de transposer cette mécanique sur le nouveau ») — on ne recopie PAS le widget du
   créateur actuel (existant = POC), on ne supprime pas non plus la mécanique. Candidat
   naturel — CONFIRMÉ sur la maquette elle-même (user : « suffit de voir la maquette
   pour vite comprendre ou mettre les boutons manquant ») : le bloc « Destin &
   Résilience — +3 à répartir » de `finale-mock2` EST le patron — reprendre sa bande
   titrée + steppers `[−] n [+]` (`QtyStepper`) en « Avances de carrière — +5 à
   répartir », steppers actifs sur les seules caractéristiques de la carrière. Réf
   mécanique : Atlas `docs/raw/creation.md` — le lot P3 vérifie la réf exacte au
   moment du brief.
   Un juge vision qui compare P3 à la maquette ne compte PAS cette affordance comme un
   écart.

1. **Talents/compétences « ou »** : la maquette rend du pointillé gris-sur-noir et des
   chaînes fusionnées — erreur répétée, arbitrage 2026-07-14 : chips SÉPARÉES codex-liées
   (comportement du créateur actuel, EntityChip/CodexRef) avec la peau Atelier.
2. Le bouton « Choisir cette carrière » n'existe pas (« Suivant fait deja ca »).
3. Les figurines de tuiles de la maquette sont des silhouettes génériques — le code
   utilise CharacterPreview (vrais rigs).
