# Maquettes RATIFIÉES — créateur de personnage, charte « Atelier du scribe » (2026-07-14)

Artefact DATÉ (politique `docs/plans/`) : à SUPPRIMER une fois la transposition #393
exécutée (git porte l'historique). Ratification utilisateur 2026-07-14 (verbatim : « Donc
je vais valider ca ») — l'étalon de STYLE des lots de transposition, pas de texte
(délégation : « Je ne demande pas de la fidélité sur le texte, mais au moins sur le style »).

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

En cas de conflit entre un BRIEF et la maquette ratifiée : **LA MAQUETTE PRIME**, sauf
pour les écarts listés ci-dessous (seuls arbitrages qui la surclassent). Un brief qui
contredit la maquette hors de cette liste est présumé fautif — le signaler, suivre la
maquette (précédent : « tuiles nominatives » d'un brief P2 vs tuiles-portraits de la
maquette, 2026-07-14 — la maquette avait raison).

## Écarts CONNUS où les arbitrages priment sur la maquette

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
