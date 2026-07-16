---
name: game-tome1-skavens-pnj
description: "Jalon 8.6 (demandé 2026-06-11) : différencier les Skavens, modéliser les créatures du Chaos du Compagnon T1 (ménagerie du Carnaval, Happeur), donner tenue+tête aux PNJ nommés"
metadata: 
  node_type: memory
  type: project
  originSessionId: dbb7bc70-76e7-4534-b7a5-d556ce0815d1
---

**Chantier demandé par l'utilisateur (2026-06-11, après clôture du Jalon 8.5)** : « différencier
les différents skavens qui sont tous identiques ainsi que les créatures du chaos dont certains
n'ont juste pas de modèle alors qu'ils existent dans le scénario du tome 1 compagnon […].
Pareil pour les PNJ nommés qui sont dans le même livre et méritent leur propre tenue et tête. »
Tracé : **ROADMAP Jalon 8.6** (3 lots). Source : `Source/Warhammer v4 - 1.0 L'ennemi dans
l'Ombre Compagnon/` (stats custom → CustomStatblock, jamais inventées ; cf.
[[game-source-fr-campagne-custom]]).

**Inventaire fait (chapitres balayés)** :
- **Skavens en data LDB** : seulement Vermine de choc / Rat ogre / Rat géant. Le rendu = UNE
  race skaven (races/defs) → tous identiques. Lot A = variantes visuelles par NOM (tenue/
  équipement : choc en armure+hallebarde, clanrat, esclave haillons, coureur encapuchonné,
  prophète gris cornu en robe).
- **Compagnon ch.12 Carnaval du Pandémonium** : ménagerie captive = Urzo, Rassarak, les
  Jumeaux, la Bête Impériale (statblocks dans le chapitre), la « basse-cour » (l.154 :
  hommes-bêtes à tête de CHÈVRE/VACHE/POULET, crachat venimeux 3 m, CT, Résistance +0 ou
  Empoisonné) ; PNJ : Wolfgang Hollseher (Doktor en arts alchimiques, humain M 39 ans),
  Magnus Bugman (Maître du savoir NAIN trop bien habillé), Benbow (vieux loup de mer
  d'Albion, sévère), « Mamie » Haller (Arnaqueur Argent 2, cuisinière/bonne aventure),
  personnel : Grand Anders, Petit Anders, Bertoldo, Ivan, Magda, Mikhail. Citations VO
  fournies par PNJ.
- **Compagnon ch.11 Joyau caché** : Lauengram, Wolfgang Kellerman, Bruno (Roi des bandits,
  Argent 2), Amadeus, le Comte, Manchettes (domestique halfling Argent 1), Flèches Noires
  (hors-la-loi Bronze 2), **Happeur Carnivore** (créature, statblock).
- **Compagnon ch.9 Main pourpre** : Cultistes/Acolytes/Magus du Culte/Sorciers du Chaos de
  Tzeentch (+ carrière Acolyte→Élu, sorts du Chaos/Dhar). Ch.8 : tables de mutants (Tête
  Bestiale d100 — synergie avec les monster parts).

**Mécanismes prévus** : Lot B = defs créatures + NOUVELLES TÊTES monster parts (poulet/vache/
chèvre…) + CustomStatblock en scène. Lot C = registre de PRESETS de PNJ nommés (nom →
carrière/tenue, sexe, parts épinglés, couleurs, yeux) exposé comme PRÉRÉGLAGE dans l'éditeur,
tout surchargeable — arbitrage rendu nécessaire par [[feedback-contenu-donnee-editeur-pas-code]]
(presets = aide d'auteur, pas du contenu codé en dur). ⚠ Piège PowerShell : les guillemets
courbes (’) des noms de fichiers du Compagnon sont parsés comme QUOTES par pwsh — passer par
Get-ChildItem -Filter/wildcards, jamais le nom littéral.

**LOT A LIVRÉ (049e28b, poussé 2026-06-11)** — 5 defs créatures (priorité < Skaven 18) +
4 tenues career:true : Rat ogre (gabarit brute-bras-longs + OV_GRIFFES, career Nu), Vermine
de choc (fourrure noire, scale 1.1 « plus grands » LDB 84, lamelles+casque conique), Prophète
gris (fourrure grise, cornes caprines, robe+malepierre — canon : texte Rat ogre LDB 84 l.84),
Esclave skaven (gabarit decharne, haillon une-épaule ; 0 occurrence Source mais cité par
l'utilisateur), Coureur d'égout (Eshin, statbloc BI Ubersreik + Nuits agitées ch.13).
**3 fixes structurels au passage** : (1) la tête de RACE pousse SOUS la coiffe (layer 0 <
coiffe 2) au lieu d'écraser l'os tete → un skaven casqué garde sa tête de rat ; (2)
`CreaturePerso.features` (RaceFeature[]) ADDITIFS — race partagée + extra (cornes, griffes)
SANS basculer dans perso.monster qui remplace TOUTE la structure de race (piège : monster
non-vide = plus de tête/queue de rat) ; (3) entityRigProfile transmet perso.gabarit (le Rat
ogre entité gardait la carrure du Skaven). ⚠ Palette : pas de peauO/peauH dans
CreaturePerso.colors (nuances dérivées — tsc le refuse). ⚠ dominantCloth : un token @metal
vif dans une tenue front-only (fioles vertes) devient la couleur du torse en profil/dos →
couleurs littérales pour le verre/détails. Principe utilisateur confirmé : corps nu (gabarit/
fourrure) et tenue = AXES SÉPARÉS customisables (l'esclave décharné le reste en armure).

**CHAOS LDB LIVRÉ (82fd882, 2026-06-11, demande directe « leur rendu ressemble à rien »)** —
12 bipèdes : Gor/Ungor/Chamane-Brey différenciés par le STATUT DES CORNES (LDB 83) + yeux
caprins (goatEye pupille horizontale, emberEye braise démon) ; Sanguinaire et Démonette calés
sur les **ILLUSTRATIONS LDB p.337** (`art-ref/ldb/mapping.json` → chemin d'image par créature ;
l'utilisateur compare À L'ILLUSTRATION : lilas+indigo+corset doré, pagne gris du Sanguinaire) ;
Furie du Chaos (Compagnon ch.9 : homme-bête ailé, ailes de CUIR `ailes:'cuir'`) ; Horreurs
rose/bleue (T1 ch.9 : tête-gueule `horreur` + tentacules de flanc) ; tenue Cultiste (capuchon
FERMÉ + heptagramme, detectCareer remappé). **Leçons** : (1) ~~parure en features~~ OBSOLÈTE →
depuis f461ce1 : équipement d'un monstre = TENUE career:true + flag `bareFoot` (pied griffu
+ substitutions chair conservés) en composant `tenues/nuViews.ts` (la chair sous le gear, par
vue) ; MORPHO seule en features ; pagne/jupe sur l'os TORSE zone basse (bassin peint SOUS le
torse) ; exception : équipement sur membre monstrueux remplacé (brassards-pinces) = features.
**Tout est documenté : `docs/creer-une-creature.md`** (workflow complet, demandé utilisateur) ; (2) bras monstrueux (pince/tentacule) efface maintenant le poing
(monsterInjection mainG/D='') ; (3) anti-doublon traitVisuals étendu aux perso.features du
def + trait Vol sauté si monster.ailes ; (4) l'utilisateur traque les éléments DÉCOLLÉS
(oreilles/cheveux/cornes hors du crâne) ET les profils faux : cornes par-VUE obligatoires
(front/back = paire, profil = UNE corne balayée en arrière + lateralPair) — l'art de face
plaqué de profil donne des « anses » ; bouches/dents de face = naseaux + gueule AU BOUT du
museau + crocs aux commissures (le rictus à mi-museau lisait « dents de lapin »).

**LOT B LIVRÉ (5286255, 2026-06-11)** — ménagerie ch.12 complète (Urzo, Rassarak, HB de
Khorne, Jumeaux, Bête Impériale, basse-cour vache/poulet — 2 nouvelles têtes au registre),
Happeur Carnivore (ch.11) via **plan avian étendu en THÉROPODE** (BirdProps.theropod — corps
horizontal/queue/pattes-pilons/museau denté, réutilise les anims aviaires), magus/sorciers
du Chaos → robe Cultiste. **Mécanismes nouveaux** : `perso.head` (tête monstrueuse par def
SANS perdre queue/fourrure de race — ≠ monster.tete) ; yeux d'une TÊTE monstrueuse = dans
l'art (le remplacement d'yeux ne touche que les visages humains) → aveugle/spécial = feature
par-vue (Rassarak). Statblocks campagne = CustomStatblock à l'authoring des scènes T1
(PAS faits — les defs sont purement visuels). Reste : **lot C** (PNJ nommés en presets).

**PRÉREQUIS LIVRÉ (f27b14c) — tenues de carrière au REGISTRE** : `TenueDef.career: true`
(tenues/defs/<Nom>.ts, slots à 3 vues {front,back,profile}) → injecté dans
GENERATED_CAREER_TENUES (prioritaire sur MANUAL legacy/auto) + tenuePaletteFor (palette du
def). **Ajouter un humanoïde habillé = DÉPOSER 2 fichiers** (tenues/defs/<Tenue>.ts + race
ou PNJ def avec career:'<Tenue>'), zéro édition d'existant. Pilote : Guerrier du Chaos
(tenue dédiée plates/heaume cornu/camail — 8d26503+ef6539f) migré MANUAL→def, goldens
INCHANGÉS (preuve iso-rendu). Les PNJ nommés du lot C utiliseront cette voie.

Prolonge [[game-bestiaire-refonte]] (les outils : monster parts, races, tenues, yeux).
