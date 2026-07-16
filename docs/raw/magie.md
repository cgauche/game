# Atlas RAW — Magie (règles)

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/engine/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](sources.md). Carte code→règle : [`code-map.md`](code-map.md).
>
> ⚠️ **Brouillon agent-généré** — fidélité contrôlée par une passe de vérification adversariale (voir
> § *Bilan de fidélité* en bas). Les entrées marquées y restent à corriger.
>
> **Catalogue de sorts** (sorts mineurs, arcanes, de domaine, du chaos, magie noire) : à transcrire
> séparément depuis `LDB 47 - Listes des sorts.md`, `LDB 48 - Magie des Couleurs.md`,
> `LDB 49 - Sorcellerie.md`, `LDB 50 - Magie noire.md`, `LDB 51 - Magie du Chaos.md`
> et `Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/` (sorts de Tzeentch).
> Ce fichier couvre les **règles** et les **tables mécaniques** uniquement.

## Sommaire

- [L'Aethyr et les Vents de Magie](#laethyr-et-les-vents-de-magie)
- [Seconde Vue](#seconde-vue)
- [Types de sorts](#types-de-sorts)
- [Mémoriser des sorts](#memoriser-des-sorts)
- [Test d'incantation](#test-dincantation)
- [Incantation Critique](#incantation-critique)
- [Maladresse d'incantation → Incantation Imparfaite](#maladresse-dincantation--incantation-imparfaite)
- [Influences Malfaisantes (le « 8 »)](#influences-malfaisantes-le-8)
- [Tableau des Incantations Imparfaites Mineures (d100 verbatim)](#tableau-des-incantations-imparfaites-mineures-d100-verbatim)
- [Tableau des Incantations Imparfaites Majeures (d100 verbatim)](#tableau-des-incantations-imparfaites-majeures-d100-verbatim)
- [Focalisation (Test étendu)](#focalisation-test-etendu)
- [Focalisation Critique](#focalisation-critique)
- [Maladresse de Focalisation](#maladresse-de-focalisation)
- [Interruptions de Focalisation](#interruptions-de-focalisation)
- [Repousser les Vents (armure et tenue)](#repousser-les-vents-armure-et-tenue)
- [Dissipation / Contre-sort](#dissipation--contre-sort)
- [Dissiper des sorts permanents](#dissiper-des-sorts-permanents)
- [Durée des sorts](#duree-des-sorts)
- [Grimoires (lancer depuis le livre)](#grimoires-lancer-depuis-le-livre)
- [Projectiles Magiques](#projectiles-magiques)
- [Composants / Ingrédients](#composants--ingredients)
- [Restrictions d'incantation (parole, unicité, ligne de vue)](#restrictions-dincantation-parole-unicite-ligne-de-vue)
- [Sorts de Contact en Combat](#sorts-de-contact-en-combat)
- [Avantages et Magie](#avantages-et-magie)
- [Attributs des domaines de la Magie des Couleurs (LDB 48)](#attributs-des-domaines-de-la-magie-des-couleurs-ldb-48)
- [Zone d'Effet (ZdE)](#zone-deffet-zde)
- [Magie Elfique (Qhaysh)](#magie-elfique-qhaysh)
- [Magie Noire (Dhar)](#magie-noire-dhar)
- [Malepierre](#malepierre)
- [Magie Naturelle](#magie-naturelle)
- [Sorcellerie (domaine hors-Collège)](#sorcellerie-domaine-hors-college)
- [Bilan de fidélité](#bilan-de-fidelite)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- Magie des mers — modificateurs des Vents en mer (Bête/Feu/Cieux/Vie) — `MDG 02 l.178-186`
- Sorts de magie des mers (collège du baron Henryk) — 6 sorts Vie/Cieux — `MDG 02 l.189-262`

---

## L'Aethyr et les Vents de Magie

**Sources RAW :** `LDB 44 l.3-39`

L'Aethyr est une dimension infinie, lieu de reproduction des démons et des esprits, existant au-delà du monde physique. Une grande déchirure vers l'Aethyr existe dans le Nord de l'Empire ; la magie en suinte à l'état brut. Ces énergies tournoyantes — les **Vents de Magie** — soufflent à travers le monde.

Les Collèges de Magie (comme les elfes) enseignent que la magie se divise en **huit Vents distincts**, chacun identifié par une couleur. Chaque Collège humain se spécialise dans un unique Vent ; les humains ne doivent utiliser qu'un seul Vent (décret des elfes : utiliser plusieurs Vents est trop dangereux pour l'esprit humain, trop facilement corruptible).

- Les **elfes** perçoivent les Vents naturellement (Seconde vue) et peuvent étudier la Haute Magie (*Qhaysh*).
- Les **nains** méprisent la magie et y sont partiellement insensibles ; aucun sorcier nain n'est connu.
- Les **halflings** n'en ont cure sauf pour les spectacles.

**Voir aussi :** [Magie Elfique](#magie-elfique-qhaysh), [Magie Noire](#magie-noire-dhar), [Sorcellerie](#sorcellerie-domaine-hors-college)

---

## Seconde Vue

**Sources RAW :** `LDB 46 l.7-10`

Le Talent **Seconde vue** (LDB ch.10) permet de percevoir les Vents de Magie et leur influence sur le monde. Elle affecte tous les sens (manifestation dépend de l'expérience du lanceur). Avec la Seconde vue, on peut utiliser les compétences **Intuition**, **Perception** et **Pistage** avec les sens aethyriques. La Seconde vue ne se désactive pas : le MJ peut demander des Tests spontanés pour percevoir des détails magiques.

**Implémente :** non-implémenté (lore / narration MJ) ; le Talent est dans `src/data/talents.json`.

---

## Types de sorts

**Sources RAW :** `LDB 46 l.13-15`

Quatre types de sorts :
- **Sorts Mineurs** : tours utilisant des quantités négligeables de Magie.
- **Sorts d'Arcane** : sorts génériques accessibles à tout étudiant de n'importe quel Domaine de Magie ou de Magie du Chaos.
- **Sorts de Domaine** : nécessitent le Talent `Magie des Arcanes (X)` correspondant.
- **Sorts du Chaos** : pratiqués par ceux qui ont vendu leur âme au Chaos.

**Voir aussi :** [Magie Noire](#magie-noire-dhar), [Magie du Chaos — LDB 51](#magie-elfique-qhaysh)

**Implémente :** `SpellLike.family` (`src/engine/magic.ts` l.48), `castInfo()` l.68.

---

## Mémoriser des sorts

**Sources RAW :** `LDB 46 l.17-21`

Transcrire un sort dans un grimoire ne suffit pas à l'apprendre. Pour **mémoriser** un sort (pouvoir le lancer sans grimoire), il faut dépenser le montant de PX indiqué dans le Talent de lanceur de sorts. Un sort mémorisé est connu de façon permanente, sauf circonstances particulières.

> **Verbatim** (l.47-48) : « Une fois qu'un Sort a été mémorisé, un lanceur de Sorts le connaît de façon permanente, sauf circonstances particulières. »

**Implémente :** `src/engine/grimoire.ts`.

---

## Test d'incantation

**Sources RAW :** `LDB 46 l.23-25`

Pour lancer un sort : effectuer un **Test de Langue (Magick)** (compétence avancée, Caractéristique = Intelligence).

- **Succès ET DR ≥ NI du sort** → sort lancé.
- **Succès mais DR < NI** → tentative échoue (sort pas assez puissant), rien ne se produit.
- **Échec** → tentative échoue, rien ne se produit.

La compétence **Prière**, **Langue (Magick)** et **Focalisation** sont des **compétences avancées** : sans au moins 1 Augmentation, le Test est impossible (pas de repli sur la Caractéristique seule). Exception : le Trait de créature **Lanceur de Sorts** (LDB 85 l.206-207) autorise l'incantation sans la compétence — Test sur la Caractéristique seule.

> **Verbatim NI** (l.50) : « Si votre DR est égal ou supérieur au Niveau d'Incantation (NI) du Sort (indiqué dans sa description), il est lancé comme dans la description du Sort. »

**Implémente :** `resolveCasting()` (`src/engine/magic.ts` l.382), `evaluateCasting()` l.421, `knowsCastingSkill()` l.184.

---

## Incantation Critique

**Sources RAW :** `LDB 46 l.27-32`

Un **Critique** au Test d'incantation (double réussi) signifie que les Vents ont développé une force dangereuse. À moins de posséder le Talent **Diction instinctive**, effectuer un jet sur le Tableau des Incantations Imparfaites Mineures. On peut choisir l'un des effets suivants à la place :

- **Incantation Critique** : si le sort inflige des Dégâts, il inflige également une Blessure Critique (voir traumatisme).
- **Puissance totale** : le sort est lancé quel que soient son NI et le DR obtenu — mais il peut être Dissipé.
- **Force inéluctable** : si le DR est suffisant pour lancer le sort, il ne peut pas être Dissipé.

> **Verbatim** (l.53-54) : « À moins que vous n'ayez le Talent Diction instinctive, effectuez un lancer sur le Tableau des Incantations Imparfaites Mineures lorsque la puissance dépasse votre contrôle. »

**Implémente :** `CastResult.isCritical` (`src/engine/magic.ts` l.374), géré dans `src/state/rollFlows.ts`.

---

## Maladresse d'incantation → Incantation Imparfaite

**Sources RAW :** `LDB 46 l.84-86`

Un **double raté** au Test d'incantation entraîne une **Incantation Imparfaite**. Lancer 1d100 et consulter le Tableau des Incantations Imparfaites Mineures.

> **Verbatim** (l.143-145) : « Si vous perdez le contrôle de l'énergie magique que vous focalisez, les choses se passent toujours mal. Si vous obtenez une Maladresse à votre Test d'Incantation, vous subissez une Incantation Imparfaite. Lancez 1d100 et consultez le Tableau des Incantations Imparfaites Mineures. »

**Implémente :** `CastResult.isFumble` (`src/engine/magic.ts` l.375), `rollMiscast('mineure', …)` (`src/engine/miscast.ts` l.237).

---

## Surincantation

**Sources RAW :** `LDB 47 l.13-17` (Sorts) · `LDB 41 l.21-27` (Bénédictions) · `LDB 42 l.7-13` (Miracles)

Dépenser le surplus de Degrés de Réussite pour amplifier un sort réussi. Budget = **un pas par +2 DR de
surplus** — surplus = `DR − NI` pour un Sort (DR entier si Focalisé, NI déjà payé) ; **DR entier** pour une
Prière (Bénédiction/Miracle : pas de NI). Le surplus se répartit librement entre les axes (même axe
répétable). L'EFFET d'un pas **dépend de la source** :

| Source (`spell.family`) | Axes | Effet d'UN pas |
| --- | --- | --- |
| **Sort** (`arcane`/`mineure`/`chaos`/domaines) | Portée · **ZdE** · Durée · Cible | **+valeur initiale** (×initial) |
| **Miracle** (`invocation`) | Portée · Durée · Cible (**pas de ZdE**) | **+valeur initiale** (×initial) |
| **Bénédiction** (`beni`) | Portée · Durée · Cible (**pas de ZdE**) | **+6 m** Portée / **+1** Cible / **+6 Rounds** Durée (FIXE) |

Restrictions (RAW) : Portée/Cible « **Vous** » → seul le lanceur, non augmentables ; Portée « **Contact** »
non extensible **pour un Sort/Miracle** (une **Bénédiction** étend même le Contact : `LDB 41 l.27`, Guérison
touchée → 6 m / 12 m) ; sans Durée (Instantané) → pas de prolongation ; Cible « **Spécial** » → pas de
cibles supplémentaires (`LDB 47 l.28`).

> **Verbatim Sort** (`LDB 47 l.15`) : « Pour chaque +2 DR que vous obtenez à un Test d'Incantation, vous
> pouvez ajouter une valeur de Portée, de Zone d'Effet, de Durée ou de Cible égale à la valeur initiale
> indiquée dans la description du Sort. »
> **Verbatim Bénédiction** (`LDB 41 l.23-25`) : « • Portée : +6 mètres • Cibles : +1 • Durée : +6 Rounds »

**Implémente :** `src/engine/overcast.ts` (math source-aware PURE : `overcastSourceOf`/`overcastAxes`/
`extraTargetCapacity`/`effectiveDurationRounds`/`effectiveRangeMetres`/`overcastDurationParts`), alloué par
`castAllocOvercast(axis, delta)` (stepper +/−), résolu par `applyCast` (durée) + `effectiveSpellRangeTiles`
(`magic.ts`, cibles supplémentaires atteignables) ; cibles désignées via `castToggleExtraTarget`. UI :
steppers par axe dans `CastModal`. IA : `aiOvercastPlan`.

---

## Influences Malfaisantes (le « 8 »)

**Sources RAW :** `LDB 46 l.88-90`

Incanter à proximité d'une **source de Corruption** (voir LDB ch.19) rend le contrôle des Vents plus difficile. Lors d'un Test de Langue (Magick) ou de Focalisation à proximité d'une Influence corruptrice :

- tout lancer dont le **dé des unités est 8** (symbole à huit pointes du Chaos) → **Incantation Imparfaite Mineure**.
- Si une Incantation Imparfaite Mineure avait déjà été obtenue pour une autre raison lors de ce Test → elle devient **Majeure**.

> **Verbatim** (l.147-148) : « tout lancer obtenant un 8 (représentant le symbole du Chaos à huit pointes) sur le dé des unités entraîne une Incantation Imparfaite Mineure, car la Magie s'emballe. »

**Implémente :** non-implémenté explicitement (à brancher sur `resolveCasting` / `resolveFocus`) ; `src/engine/miscast.ts` fournit `rollMiscast`.

---

## Tableau des Incantations Imparfaites Mineures (d100 verbatim)

**Sources RAW :** `LDB 46 l.33-53`

| d100 | Nom | Effet |
|------|-----|-------|
| 01–05 | Signe de Sorcière | La prochaine créature vivante à naître dans un rayon de 1 km mute. |
| 06–10 | Lait caillé | Tout le lait dans un rayon de 1d100 mètres tourne instantanément. |
| 11–15 | Mildiou | Un nombre de champs égal au Bonus de Force Mentale dans un rayon de (BFM) km subissent une calamité ; toutes les cultures pourrissent pendant la nuit. |
| 16–20 | Cérumen | Les oreilles se bouchent instantanément de cire épaisse. Gagnez 1 État **Assourdi**, qui ne peut être retiré que par un Test réussi de Guérison. |
| 21–25 | Lueur occulte | Lueur sinistre liée au Domaine, émettant autant de lumière qu'un grand bûcher, durée au moins 1d10 Rounds. |
| 26–30 | Murmures mortels | Réussir un Test de **Force Mentale Accessible (+20)** ou gagner 1 Point de Corruption. |
| 31–35 | Rupture | Le nez, les yeux et les oreilles saignent. Gagnez 1d10 États **Hémorragique**. |
| 36–40 | Secousse spirituelle | Gagnez l'État **À Terre**. |
| 41–45 | Délié | Sur la personne, toutes les boucles se détachent et tous les lacets se délacent (chute de ceintures, sacs, ouverture de poches, glissement d'armure). |
| 46–50 | Tenue indisciplinée | Les vêtements semblent se tordre par leur propre volonté. Recevez 1 État **Enchevêtré** avec une Force de 1d10 × 5 pour résister. |
| 51–55 | Malédiction de la sobriété | Tout l'alcool dans un rayon de 1d100 mètres s'évente, goût infect et amer. |
| 56–60 | Drain de l'âme | Gagnez 1 État **Exténué**, qui dure 1d10 heures. |
| 61–65 | Distraction | Si Engagé en combat : gagnez l'État **Surpris**. Sinon : complètement décontenancé, incapable de se concentrer quelques instants. |
| 66–70 | Visions impies | Des visions éphémères d'actes profanes vous harcèlent. Recevez l'État **Aveuglé** ; réussir un Test de **Calme Intermédiaire (+0)** ou en gagner un autre. |
| 71–75 | Langue maladroite | Tous les Tests de Langue (y compris d'Incantation) subissent −10 pendant 1d10 Rounds. |
| 76–80 | L'horreur ! | Réussir un Test de **Calme Difficile (−20)** ou gagner 1 État **Brisé**. |
| 81–85 | Malédiction de corruption | Gagnez 1 Point de Corruption. |
| 86–90 | Double problème | L'effet du sort se produit ailleurs dans un rayon de 1d10 km. À la discrétion du MJ, cela devrait avoir des conséquences. |
| 91–95 | Multiplication d'infortune | Effectuer deux lancers sur cette table, en relançant tout résultat entre 91–00. |
| 96–00 | Chaos en cascade | Effectuer un nouveau lancer sur le Tableau des Incantations Imparfaites **Majeures**. |

**Implémente :** `MINOR` (`src/engine/miscast.ts` l.101-128), `rollMiscast('mineure', …)` l.237.

---

## Tableau des Incantations Imparfaites Majeures (d100 verbatim)

**Sources RAW :** `LDB 46 l.55-80`

| d100 | Nom | Effet |
|------|-----|-------|
| 01–05 | Voix fantomatiques | Toutes les personnes dans un rayon de (Force Mentale) mètres entendent de sombres murmures du Chaos. Toutes les créatures douées de conscience : Test de **Calme Accessible (+20)** ou gagner 1 Point de Corruption. |
| 06–10 | Regard maudit | Les yeux prennent une couleur anormale liée au Domaine pendant 1d10 heures. Tant que les yeux ont cette couleur : 1 État **Aveuglé** qui ne peut être retiré d'aucune façon. |
| 11–15 | Choc aethyrique | Subir 1d10 Blessures ignorant le Bonus d'Endurance et les PA. Test de **Résistance Accessible (+20)** ou gagner également 1 État **Sonné**. |
| 16–20 | Marche de la mort | Pendant 1d10 heures, toutes les plantes vivantes proches fanent et meurent. |
| 21–25 | Rébellion intestinale | Les intestins deviennent incontrôlables. Gagnez 1 État **Exténué** qui ne peut être retiré tant qu'on ne peut pas changer de vêtement et se nettoyer. |
| 26–30 | Feu de l'âme | Gagnez 1 État **Enflammé** : enveloppé de flammes impies de la couleur du Domaine. |
| 31–35 | Propos ésotériques | Jacassements inintelligibles pendant 1d10 Rounds. Impossible de communiquer verbalement ni d'effectuer de Test d'Incantation ; actions normales sinon. |
| 36–40 | Essaim | Engagé par une nuée de rats, araignées géantes, serpents aethyriques (au choix du MJ) avec le Trait Nuée. Après 1d10 Rounds (si non détruite), la nuée bat en retraite. |
| 41–45 | Poupée de chiffon | Projeté à 1d10 mètres dans les airs dans une direction aléatoire. 1d10 Points de Blessure à l'atterrissage ignorant les PA + État **À Terre**. |
| 46–50 | Membre gelé | Un membre (déterminé au hasard) gèle sur place pendant 1d10 heures, inutile comme s'il avait été **Amputé**. |
| 51–55 | Vue assombrie | Perte du bénéfice du Talent Seconde vue pendant 1d10 heures. Les Tests de Focalisation subissent également −20 pour la durée. |
| 56–60 | Clairvoyance chaotique | Gagner une réserve bonus de 1d10 Points de Chance (peut dépasser la limite naturelle). Chaque dépense = +1 Point de Corruption. Points restants perdus en fin de session. |
| 61–65 | Lévitation | Soulevé par les Vents, flottant 1d10 mètres au-dessus du sol pendant 1d10 minutes. Retour continuel à la position de lévitation quand laissé tranquille. Voir règles de Chute à la fin. |
| 66–70 | Régurgitation | Vomissements incontrôlables. Gagnez l'État **Sonné**, qui dure 1d10 Rounds. |
| 71–75 | Secousse du Chaos | Toutes les créatures dans un rayon de 1d100 mètres : Test d'**Athlétisme Accessible (+20)** ou gagner l'État **À Terre**. |
| 76–80 | Cœur de traître | Les Dieux Sombres incitent à commettre une horrible perfidie. Attaquer ou trahir un allié dans toute la mesure de ses capacités → regagner tous les Points de Chance. Faire perdre un Point de Destin à un autre Personnage → gagner +1 Point de Destin. |
| 81–85 | Terrible affaiblissement | Gagner 1 Point de Corruption + 1 État **À Terre** + 1 État **Exténué**. |
| 86–90 | Puanteur infernale | Gagner le Trait de Créature Perturbant (voir LDB 85) ; inimitié de quiconque a de l'odorat. Dure 1d10 heures. |
| 91–95 | Drain de puissance | Incapable d'utiliser le Talent permettant de lancer des Sorts (Magie des Arcanes / Magie du Chaos ou similaire) pendant 1d10 minutes. |
| 96–00 | Contre-réaction aethyrique | Quiconque dans un rayon en mètres = BFM (allié ou ennemi) subit 1d10 Blessures ignorant BE et PA + État **À Terre**. Si aucune cible à portée : la tête du lanceur **explose**, mort instantanée. |

**Implémente :** `MAJOR` (`src/engine/miscast.ts` l.131-159), `rollMiscast('majeure', …)` l.237.

> **Note :** La table de la **Colère des dieux** (prières, LDB 40 l.52-101) est implémentée dans `WRATH` (`src/engine/miscast.ts` l.164-206) mais appartient au domaine **Religion** → voir `religion.md` (à construire).

---

## Focalisation (Test étendu)

**Sources RAW :** `LDB 46 l.129-151`

Certains sorts nécessitent plus de magie que disponible normalement. La **Focalisation** permet d'attirer les Vents et de les concentrer via la Compétence **Focalisation** (avancée, Caractéristique = Force Mentale, spécialisée par Domaine/Vent).

**Procédure :**
1. Effectuer un **Test étendu de Focalisation** (chaque Round = 1 jet).
2. Quand le **DR cumulé atteint le NI du sort** choisi : la Focalisation est réussie.
3. Au **Round suivant**, lancer le sort avec les règles d'incantation normales, mais en considérant le NI du sort comme **0**.
4. Si le Test d'incantation échoue après une Focalisation réussie : l'énergie focalisée est perdue + Incantation Imparfaite Mineure (l'énergie se libère de l'emprise aethyrique).

> **Verbatim** (l.181-184) : « Quand votre DR atteint le NI du Sort choisi, vous avez réussi à focaliser suffisamment de magie pour le lancer. Pendant le prochain Round, vous pouvez lancer votre Sort en utilisant les règles d'Incantation normales, mais considérez le Niveau d'Incantation du Sort choisi comme étant de 0. »

Les Avantages **ne s'appliquent pas** aux Tests de Focalisation (contrairement aux Tests d'Incantation).

> **Verbatim** (l.176) : « Les Avantages en combat s'appliquent aux Tests d'Incantation, pas aux Tests de Focalisation. »

**Implémente :** `resolveFocus()` (`src/engine/magic.ts` l.607), `focusSkillFor()` l.166, `castingValue()` l.110 (Avantage = 0 si Focalisation).

---

## Focalisation Critique

**Sources RAW :** `LDB 46 l.135-137`

Un **Critique** (double réussi) lors de la Focalisation signifie qu'un flux puissant a été concentré : le sort peut être lancé au Round suivant **quel que soit le DR cumulé atteint jusqu'alors**. Cependant, tant de magie concentrée si rapidement entraîne un contrecoup : lancer 1d100 sur le Tableau des Incantations Imparfaites Mineures, **sauf** si le Talent **Harmonisation aethyrique** est possédé.

> **Verbatim** (l.186-187) : « tant de magie concentrée si rapidement en un endroit entraîne un contrecoup magique : lancez 1d100 et consultez le Tableau des Incantations Imparfaites Mineures (voir p.234), sauf si vous possédez le Talent Harmonisation aethyrique (voir p.138). »

**Implémente :** `FocusResult.isCritical` (`src/engine/magic.ts` l.597), géré dans `src/state/rollFlows.ts`.

---

## Maladresse de Focalisation

**Sources RAW :** `LDB 46 l.139-141`

La définition de **Maladresse est élargie** lors d'un Test de Focalisation : considérer comme Maladresse tout double **ou** tout résultat se terminant par un 0 au-delà de la Compétence : donc 00, 99, 90, 88, etc. Une Maladresse de Focalisation → Incantation Imparfaite **Majeure** (pas Mineure).

> **Verbatim** (l.190-192) : « Concentrer les Vents de la Magie en un flux important est dangereux. Considérez comme Maladresse tout double ou tout résultat terminant par un 0 au-delà de votre Compétence, donc 00, 99, 90, 88, etc. Si vous obtenez une Maladresse à un Test de Focalisation, vous subissez une Incantation Imparfaite. Lancez 1d100 et consultez le Tableau des Incantations Imparfaites Majeures. »

**Implémente :** `FocusResult.isFumble` (`src/engine/magic.ts` l.629-630) :
```ts
const isFumble = !t.success && (t.isDouble || t.roll % 10 === 0);
```

---

## Interruptions de Focalisation

**Sources RAW :** `LDB 46 l.143-145`

La concentration est vitale pour focaliser. Si perturbé par quelque chose (bruits forts, Dégâts subis, lumières aveuglantes ou autres) : réussir un Test de **Calme Difficile (−20)** ou subir une **Incantation Imparfaite Mineure** et perdre **tous les DR accumulés** jusqu'alors au Test étendu de Focalisation.

> **Verbatim** (l.193-195) : « Si vous êtes perturbé par quelque chose – bruits forts, Dégâts subis, lumières aveuglantes ou autres –, vous devrez réussir un Test de Calme Difficile (−20) ou subir une Incantation Imparfaite Mineure et perdre tous les DR accumulés jusque-là au Test étendu de Focalisation. »

**Implémente :** `src/state/combatFlow.ts` / `rollFlows.ts` (cadence-aware via `resolveCadenceTest`).

---

## Repousser les Vents (armure et tenue)

**Sources RAW :** `LDB 46 l.148-151`, `l.188`

Porter les couleurs appropriées au Vent manipulé aide à l'attirer. C'est pourquoi la majorité des Magisters portent la tenue de leur Ordre.

**Pénalités :**
- **Tenue inappropriée** : −1 DR à tous les Tests d'Incantation et de Focalisation.
- **Armure en métal** (chargée de *Chamon*, le vent doré) : −1 DR par PA de la localisation **la mieux protégée** du corps, pour chaque PA d'armure portée.
- **Armure en cuir** (conserve des traces de *Ghur*, l'ambré) : même pénalité.

**Exemptions par Talent :**
- `Magie des Arcanes (Métal)` → peut porter des armures métalliques sans pénalité.
- `Magie des Arcanes (Bêtes)` → peut ignorer les pénalités des armures de cuir.

> **Verbatim** (l.199) : « tout Lanceur de Sorts portant une armure subit une pénalité de −1 DR à tous ses Tests d'Incantation et de Focalisation, pour chaque PA sur la Localisation la mieux protégée du corps. »

**Implémente :** `armourCastDRPenalty()` (`src/engine/magic.ts` l.139-155), appliqué dans `resolveCasting()` l.409 et `resolveFocus()` l.626.

---

## Dissipation / Contre-sort

**Sources RAW :** `LDB 46 l.154-156`

Si un sort **vous cible** ou vise un point **visible** à une distance en mètres ≤ votre Force Mentale, vous pouvez opposer le Test d'Incantation avec Langue (Magick), en chantant un **Contre-sort**.

**Procédure :**
1. Effectuer un **Test opposé de Langue (Magick)**.
2. **Succès** : le sort est **dissipé**.
3. **Échec** : le sort se résout normalement, mais utilise le **DR du Test opposé** (le DR net : DR lanceur − DR contre-lanceur) pour déterminer si l'incantation a réussi.

**Limites :**
- On ne peut tenter de dissiper qu'un **seul sort chaque Round**.
- Les Prières (Bénédictions/Miracles) ne peuvent pas être dissipées (seuls les sorts arcanes, de Domaine, mineurs ou du Chaos sont dissipables).
- Une **Force inéluctable** (Incantation Critique) rend le sort immun à la dissipation.

> **Verbatim** (l.201-202) : « Si un Sort vous cible, ou vise un point que vous pouvez voir à une distance en mètres égale à votre Force Mentale, vous pouvez opposer le Test d'Incantation avec Langue (Magick), car vous chantez un Contre-sort. Effectuez un Test opposé de Langue (Magick). Sur un succès, vous dissipez le Sort ; sur un échec, le Sort utilise le DR du Test opposé pour déterminer si l'incantation a réussi normalement. Vous ne pouvez tenter de dissiper qu'un seul Sort chaque Round. »

**Implémente :** `resolveCounterspell()` (`src/engine/magic.ts` l.499), `counterspellOutcomeFrom()` l.485, `isDispellableSpell()` l.461.

---

## Dissiper des sorts permanents

**Sources RAW :** `LDB 46 l.159-162`

Pour dissiper un sort à **effet durable** déjà en place :
- Action entière du dissipateur.
- **Test étendu de Langue (Magick)** : quand le DR cumulé atteint le NI du sort, il est dissipé.
- Plusieurs lanceurs sur le même sort : chacun lance séparément. S'ils utilisent le même Domaine, ils peuvent choisir d'effectuer un **Test Soutenu** à la place.

> **Verbatim** (l.204-206) : « Il faut pour cela effectuez un Test étendu de Langue (Magick). Quand votre DR atteint la NI du Sort, vous le dissipez avec succès. »

**Implémente :** non-implémenté (cas hors combat, arbitrage MJ).

---

## Durée des sorts

**Sources RAW :** `LDB 46 l.92-94`

Un sort lancé avec succès reste actif pour sa **Durée** (indiquée dans la description du sort) à moins d'être dissipé. On **ne peut pas simplement mettre fin à ses sorts** déjà en jeu — il faut Dissiper.

Les durées se lisent :
- **Instantanée** : effet immédiat, pas de persistance.
- **N Rounds** (littéral ou formule `(Bonus de X) Rounds`).
- **N minutes / heures / jours** (horloge de campagne).
- **Jusqu'au lever du soleil** : durée jusqu'à la prochaine aube.

> **Verbatim** (l.149-151) : « Si un Sort est lancé avec succès, il reste actif pour sa Durée à moins d'être dissipé. Vous ne pouvez pas simplement mettre fin à vos Sorts déjà en jeu, mais vous pouvez tenter de les Dissiper. »

**Implémente :** `durationRoundsFormula()` (`src/engine/magic.ts` l.314), `durationClockMinutes()` l.339, `buffDurationRounds()` l.327.

---

## Grimoires (lancer depuis le livre)

**Sources RAW :** `LDB 46 l.96-99`

Un lanceur peut activer un sort depuis un **grimoire** si le sort appartient au Domaine qu'il possède, mais cela **double le Niveau d'Incantation** (NI × 2).

> **Verbatim** (l.152-154) : « Un lanceur de Sorts peut en activer un depuis un grimoire si le Sort appartient au Domaine qu'il possède, mais cela double le Niveau d'Incantation. »

**Implémente :** `src/engine/grimoire.ts`.

---

## Projectiles Magiques

**Sources RAW :** `LDB 46 l.101-105`

Les sorts indiqués *Projectile magique* suivent des règles de résolution spécifiques :

1. **Localisation atteinte** : déterminée en **inversant les dés** du Test de Langue (Magick), puis en consultant le Tableau des Localisations (LDB 13 l.133). Il n'y a **pas de « coup ciblé » libre** (RAW).
2. **Dégâts totaux** = Dégâts du sort + DR du Test de Langue (Magick) + Bonus de Force Mentale du lanceur.
3. Ces Dégâts sont **réduits normalement** par le Bonus d'Endurance et les PA de la cible.

> **Verbatim** (l.155-157) : « Quand un Projectile magique est lancé avec succès et qu'il cible un autre Personnage, la Localisation atteinte est déterminée en inversant les dés lancés pour le Test de Langue (Magick). […] Le DR du Test de Langue (Magick) est ajouté aux Dégâts du Sort et à votre Bonus de Force Mentale pour déterminer le total de Dégâts infligés. Ces Dégâts sont réduits normalement par l'Endurance et les PA de la cible. »

**Implémente :** `isMagicMissile()` (`src/engine/magic.ts` l.211), `resolveMagicMissile()` l.515, `evaluateMissile()` l.529 ; `reverseRoll()` + `hitLocationByShape()` (`src/engine/combat.ts`).

---

## Composants / Ingrédients

**Sources RAW :** `LDB 46 l.107-114`

Les lanceurs peuvent focaliser leur magie au moyen d'un **composant approprié** avant le déclenchement, protégeant contre les Incantations Imparfaites.

**Effets :**
- Toute **Incantation Imparfaite Majeure** devient une **Mineure**.
- Aucune **Incantation Imparfaite Mineure** n'a d'effet.
- Le composant est **consumé** (même sans Imparfaite).

**Coût :** pour les Sorts d'Arcane et de Domaine = NI du sort en **pistoles d'argent**. Les composants sont spécifiques à un sort (indiqués dans la liste de sorts du Domaine).

**Exceptions par Domaine :**
- **Magie Naturelle** : composants obligatoires pour tout lancement ; trouvables avec Savoir (Herboristerie) ou achetables 5 sous de cuivre chacun. (DR + 1 composants sur un jet réussi.)
- **Sorcellerie** : coût en **sous de cuivre** (NI du sort en sc, pas en pa) ; trouvables par Survie en extérieur (1 + DR composants). Sans composant = jet obligatoire sur Imparfaites Mineures.

> **Verbatim** (l.160-162) : « Si vous utilisez un composant quand vous incantez, toute Incantation Imparfaite Majeure devient une Incantation Imparfaite Mineure, et aucune Incantation Imparfaite Mineure n'a d'effet. Utilisé ainsi, le composant est consumé ou détruit par le processus, même si aucune Incantation Imparfaite n'a été obtenue. »

**Implémente :** `componentDowngrade()` (`src/engine/miscast.ts` l.218).

---

## Restrictions d'incantation (parole, unicité, ligne de vue)

**Sources RAW :** `LDB 46 l.116-121`

- **Parole** : il faut être capable de parler (ni bâillonné, ni asphyxié, ni immergé) pour incanter. Voix inhibée → difficulté augmentée par le MJ. La Langue Magick doit être parlée (ou chantée pour le Domaine de la Lumière) clairement et **souvent à voix haute** — la magie est tout sauf subtile. Plus le NI est élevé, plus le sort est chanté fort.
- **Unicité** : chaque sort ne peut être **actif qu'une seule fois** simultanément. Il faut attendre la fin du sort ou sa Dissipation avant de le relancer.
- **Non-cumul des bonus** : les sorts fournissant des bonus ou pénalités **ne se cumulent pas**. Le **meilleur bonus** et la **pire pénalité** sont appliqués.
- **Ligne de vue** : sauf indication contraire, le lanceur doit **voir** sa cible.

> **Verbatim** (l.168) : « les Sorts fournissant des bonus ou des pénalités ne se cumulent pas. Au lieu de cela, le meilleur bonus et la pire pénalité sont appliqués à chaque Sort lancé sur vous. »

---

## Sorts de Contact en Combat

**Sources RAW :** `LDB 46 l.123-124`

Pour les sorts nécessitant de **toucher la cible** en combat (ou si la cible ne veut pas être touchée) :
1. Effectuer le Test d'Incantation.
2. Puis effectuer un **Test opposé de Corps à corps (Bagarre)** (vs Corps à corps ou Esquive de la cible).
3. Si le sort est un *Projectile magique*, le Test de Corps à corps (Bagarre) est utilisé pour déterminer la **Localisation** (à la place du Test de Langue Magick inversé).

**Implémente :** `SpellSpec.opposed.kind = 'contact'` (`src/engine/spellspec.ts` l.56-64).

---

## Avantages et Magie

**Sources RAW :** `LDB 46 l.122-126`

- Les Avantages en combat s'appliquent aux Tests d'**Incantation** (pas de Focalisation).
- Gain d'Avantage spécifique pendant l'incantation : si la cible a déjà été visée par un sort **du même Domaine** durant ce Round → +1 Avantage (le renforcement du Vent aide à focaliser la magie).

**Implémente :** `castingValue()` (`src/engine/magic.ts` l.128) — `advantage = skillName === 'focalisation' ? 0 : 10 * (c.advantage ?? 0)`.

---

## Attributs des domaines de la Magie des Couleurs (LDB 48)

> Ces Attributs s'appliquent **automatiquement** (ou de façon optionnelle selon le libellé « vous pouvez ») chaque fois qu'un sort **du Domaine concerné** est lancé avec succès. Ils complètent les règles d'incantation générales décrites ci-dessus (Test d'incantation, Focalisation, etc.). Les sorts d'Arcane communs (LDB 47) ou les Prières n'ont **pas** de Domaine assigné et ne bénéficient donc d'aucun Attribut.

**Sources RAW :** `LDB 48 l.7 / l.87 / l.157 / l.240 / l.302 / l.400 / l.482 / l.574`

**Implémente :** `src/engine/domainAttributes.ts` (fonction `domainAfterCast`, `domainOnHitEffects`, `domainMissileMods`) — données dans `DomainData.afterCast` / `.effects` / `.missile`.

---

### Domaine de la Bête (Ghur — Vent Ambre)

**Sources RAW :** `LDB 48 l.7`

> « Chaque fois que vous lancez avec succès un Sort du Domaine de la Bête, vous pouvez aussi gagner le Trait de créature Peur 1 (voir page 341) pour les 1d10 prochains Rounds. »

Effet post-incantation appliqué **au lanceur** : acquisition optionnelle de `Peur 1` pour `1d10` Rounds.

**Implémente :** `domainAfterCast()` — `DomainData.afterCast.grantTrait = "Peur 1"`, `durationDice = 10`. Confirmé `domainAttributes.ts` l.7-8.

---

### Domaine des Cieux (Azyr — Vent Céruléen)

**Sources RAW :** `LDB 48 l.105`

> « Les Sorts infligeant des Dégâts ignorent les PA des armures en métal, et se dirigent vers toutes les autres cibles dans les 2 mètres, à l'exception de ceux possédant le Talent Magie des Arcanes (Cieux), infligeant un nombre de Dégâts égal à votre Bonus de Force Mentale, traités comme un Projectile magique. »

Double effet : (1) bypass PA métal sur la cible principale ; (2) propagation électrique dans 2 m aux autres cibles (BFM dégâts, Projectile magique), sauf porteurs du Talent `Magie des Arcanes (Cieux)`.

**Implémente :** `domainMissileMods()` — `DomainData.missile.bypass = 'metal'` (bypass PA métal). La propagation latérale (AoE 2 m) est déclarée dans `DomainData.effects` (`TriggeredEffect[]`). Confirmé `domainAttributes.ts` l.9-11.

---

### Domaine du Feu (Aqshy — Vent Rouge)

**Sources RAW :** `LDB 48 l.201`

> « Vous pouvez infliger +1 État Enflammé à quiconque ciblé par des Sorts du Domaine du Feu, à moins qu'il ne possède également le Talent Magie des Arcanes (Feu). Chaque État Enflammé situé à une distance en mètres égale à votre Bonus de Force Mentale ajoute +10 aux tentatives de Focalisation ou d'Incantation avec Aqshy. »

Double effet : (1) rider optionnel `+1 État Enflammé` sur chaque cible (sauf porteurs du Talent) ; (2) chaque état `Enflammé` actif à portée (≤ BFM mètres) octroie `+10` aux Tests de Focalisation/Incantation du lanceur.

**Implémente :** `domainOnHitEffects()` — `DomainData.effects` (condition `relation: hostile` + `not has Magie des Arcanes (Feu)` pour le rider `+1 Enflammé`). Le bonus `+10` par état voisin est **non implémenté** (nécessiterait un scan de la scène à chaque incantation). Confirmé `domainAttributes.ts` l.12-14.

---

### Domaine de la Lumière (Hysh — Vent Blanc)

**Sources RAW :** `LDB 48 l.302-304`

> « Vous pouvez infliger un État Aveuglé aux cibles des Sorts du Domaine de la Lumière, à moins qu'ils ne possèdent le Talent Magie des Arcanes (Lumière).
> Si une cible possède les Traits de créature Démoniaque ou Mort-vivant, les Sorts infligent une frappe supplémentaire avec un nombre de Dégâts égal à votre Bonus d'Intelligence qui ignore le Bonus d'Endurance et les PA. »

Double effet : (1) rider optionnel `+1 État Aveuglé` sur chaque cible (sauf porteurs du Talent) ; (2) frappe supplémentaire `BInt` dégâts ignorant BE+PA contre les cibles `Démoniaque` ou `Mort-vivant`.

**Implémente :** `domainOnHitEffects()` — `DomainData.effects` (deux `TriggeredEffect` : rider Aveuglé conditionné `not has Talent` ; frappe Démon/Mort-vivant conditionée `has Démoniaque OR Mort-vivant`). Confirmé `domainAttributes.ts` l.15-17.

---

### Domaine du Métal (Chamon — Vent Doré)

**Sources RAW :** `LDB 48 l.398`

> « Les Sorts infligeant des Dégâts ignorent les PA des armures métalliques, et infligent un bonus de Dégâts égal au nombre de PA de l'armure métallique portée à n'importe quelle Localisation frappée. Donc, si votre Sort frappe un Bras protégé par 2 PA d'une armure métallique, il inflige +2 Dégâts supplémentaires et ignore les PA. »

Bypass des PA en métal **et** bonus de dégâts égal aux PA bypassés (Métal = arme qui inflige les PA qu'elle pénètre).

**Implémente :** `domainMissileMods()` — `DomainData.missile.bypass = 'metal'`, `bonusFromBypass = true`. Confirmé `domainAttributes.ts` l.18-20.

---

### Domaine de la Mort (Shyish — Vent Améthyste)

**Sources RAW :** `LDB 48 l.497`

> « Vous pouvez assigner +1 État Exténué à chaque cible vivante affectée par un Sort de ce Domaine. Une cible peut n'avoir qu'un seul État Exténué gagné de cette façon à la fois. »

Rider optionnel `+1 État Exténué` sur chaque cible vivante (sans limite par sort, mais une cible ne peut accumuler qu'un seul état `Exténué` issu de cet Attribut à la fois).

**Implémente :** `domainOnHitEffects()` — `DomainData.effects` (condition `isLiving` + rider `Exténué`, cap à 1 par instance de l'Attribut). Confirmé `domainAttributes.ts` l.21-22.

---

### Domaine des Ombres (Ulgu — Vent Gris)

**Sources RAW :** `LDB 48 l.582-585`

> « les Sorts lancés depuis le Domaine des Ombres ignorent tous les PA non magiques. »

Bypass systématique de **tous les PA non magiques** (cuir, métal ordinaire — seuls les PA magiques résistent).

**Implémente :** `domainMissileMods()` — `DomainData.missile.bypass = 'nonmagic'`. Confirmé `domainAttributes.ts` l.23-24.

---

### Domaine de la Vie (Ghyran — Vent de Jade)

**Sources RAW :** `LDB 48 l.679-689`

> « Recevez un bonus de +10 aux lancers pour Incanter ou Focaliser dans un environnement rural ou sauvage. Les créatures vivantes – par exemple, les créatures ne possédant pas les Traits Démoniaque ou Mort-vivant – ciblées par des Sorts d'Arcane issus du Domaine de la Vie se voient retirer tous les États Exténué et Hémorragique, après que tous les autres effets ont été appliqués, alors que des flots magiques de vie les traversent. Les créatures avec le Trait de créature Mort-vivant, à l'inverse, subissent un nombre de Dégâts supplémentaires égal à votre Bonus de Force Mentale, ignorant le Bonus d'Endurance et les PA, si elles sont affectées par un Sort issu du Domaine de la Vie. »

Triple effet : (1) `+10` à Incanter/Focaliser en environnement rural/sauvage (bonus du lanceur) ; (2) toutes les cibles **vivantes** voient retirer leurs états `Exténué` et `Hémorragique` après application des effets ; (3) toutes les cibles `Mort-vivant` subissent `+BFM` dégâts ignorant BE+PA.

**Implémente :** `domainOnHitEffects()` — `DomainData.effects` (deux `TriggeredEffect` : purge états sur cibles vivantes ; frappe supplémentaire sur Mort-vivants). Le bonus `+10` en environnement rural est **non implémenté** (pas de classification de scène rurale/urbaine). Confirmé `domainAttributes.ts` l.25-27.

---

**Voir aussi :** [Test d'incantation](#test-dincantation), [Focalisation](#focalisation-test-etendu), [Projectiles Magiques](#projectiles-magiques)

---

## Zone d'Effet (ZdE)

**Sources RAW :** `LDB 47 l.28`

Les sorts marqués **ZdE** affectent tous les individus à l'intérieur de ce **diamètre** (pas d'un rayon). Diamètre typique : `(Bonus de Force Mentale) mètres`, valeur littérale, ou `Spécial`.

> **Verbatim** (LDB 47 l.28) : « les Sorts marqués ZdE affectent tous les individus à l'intérieur de ce DIAMÈTRE ».

**Implémente :** `zdeDiameterMeters()` (`src/engine/magic.ts` l.240), `zdeRadiusTiles()` l.258.

---

## Magie Elfique (Qhaysh)

**Sources RAW :** `LDB 46 l.2-2`

*Qhaysh* est le mélange de plusieurs Vents de Magie réunis en une énergie étincelante — la **Haute Magie** des elfes. Les hauts elfes expérimentent plusieurs Vents dans leur apprentissage avant que les plus prometteurs n'étudient Qhaysh. Les elfes sylvains se concentrent sur les Vents jade (Ghyran) et ambre (Ghur) ; les plus puissants étudient soit la Haute Magie, soit la Magie noire.

> **Verbatim** (l.7) : « C'est le mélange de plusieurs Vents de Magie réunis en une énergie étincelante et aveuglante. Cette magie est impressionnante et difficile, et les elfes affirment qu'elle dépasse les capacités du genre humain. »

**Implémente :** non-implémenté (PNJ / hors périmètre joueur actuel).

---

## Magie Noire (Dhar)

**Sources RAW :** `LDB 46 l.2-3`

*Dhar* (Magie noire) est la méthode **plus dangereuse** de lancer des sorts en utilisant plusieurs Vents simultanément (contrairement à Qhaysh). Pratiquée principalement par les enchanteurs maléfiques, nécromanciens et sorcières puissantes. Source de puissance brute mais souillée d'effets secondaires terribles — corruption, déformation physique et mentale surnaturelle.

*Dhar* se perçoit comme un bourbier stagnant pour ceux ayant la Seconde vue. Il se rassemble dans les endroits saturés de mal ou de corruption. Si dense, il peut se cristalliser en **malepierre**.

**Voir aussi :** [Malepierre](#malepierre), [Magie Noire — LDB 50 (sorts)](#listes-de-sorts-a-transcrire-separement)

**Implémente :** `Focalisation (Dhar)` dans le Test opposé (démonologie, LDB 50 — `src/engine/magic.ts` ; compétence reconnue via `focusSkillFor`).

---

## Malepierre

**Sources RAW :** `LDB 46 l.3-4`

La **malepierre** est un éclat de magie pure dans le plan matériel — manifestation de l'essence du Chaos, très corruptrice. Facettes dures comme du silex, lueur verte désagréable. Propriétés :
- Contact direct : risque de maladie, folie, mutation.
- Ingestion même en petite quantité : transformation abominable garantie.
- Source d'énergie pour sorts et rituels (utilisée par cultistes du Chaos et skavens malgré les dangers).
- Utilisation **officiellement interdite** par les pouvoirs en place.

**Implémente :** `src/data/trappings.json` (`malepierre-brute` mineure, `malepierre-raffinee` majeure) — Exposition à la Corruption au contact/usage (`LDB 19 l.40`/`l.63`), op `corruptionExposure` (`src/engine/ops.ts` l.409). Contact/usage prolongés (modérée, `LDB 19 l.51-53`), consommation en composant de rituel/sort (source RAW mécanique non retrouvée) : hors périmètre #462.

---

## Magie Naturelle

**Sources RAW :** `LDB 46 l.5-6`, `LDB 49 l.2-2`

Pratiquée en marge de l'Empire, en dehors des Collèges. Concerne l'espace entre le monde matériel et le royaume des esprits, le folklore et les esprits. Jadis répandue, pratiquement éradiquée par deux siècles de persécution.

**Règles spécifiques :**
- Les composants sont **obligatoires** pour tout lancement (partie intégrante du processus).
- Composants trouvables avec **Savoir (Herboristerie)** : DR + 1 composants sur un jet réussi de recherche de nourriture.
- Achat : **5 sous de cuivre** chacun.

**Voir aussi :** [Composants / Ingrédients](#composants--ingredients)

---

## Sorcellerie (domaine hors-Collège)

**Sources RAW :** `LDB 46 l.6-6`, `LDB 49 l.5-7`

La Sorcellerie n'est pas réellement malveillante mais a une réputation méritée de lien avec le mal. Les sorciers sont souvent autodidactes, utilisent plusieurs Vents, manquent de discipline et courent un risque considérable de corruption.

**Règles spécifiques du Domaine de Sorcellerie :**
- **Corruption obligatoire** : chaque fois qu'un jet est effectué sur le Tableau des Incantations Imparfaites (quelle que soit la cause), gagner **1 Point de Corruption**.
- **État Hémorragique infligeable** : on peut infliger 1 État Hémorragique à toute cible d'un sort du Domaine de Sorcellerie.
- **Imparfaite systématique** : focaliser ou lancer des Sorts de ce Domaine **nécessite systématiquement** un jet sur le Tableau des Incantations Imparfaites Mineures, à moins d'utiliser un composant (qui annule le jet ou réduit la sévérité normalement).
- **Composants bon marché** : NI du sort en **sous de cuivre** (au lieu des pistoles d'argent habituelles). Trouvables avec Survie en extérieur : 1 + DR composants.

> **Verbatim** (LDB 49 l.5-5) : « À chaque fois qu'un pratiquant de la Sorcellerie fait un jet sur le Tableau des Incantations Imparfaites, il gagne 1 Point de Corruption. »

**Implémente :** porté dans les données (`src/data/spells.json`, famille `sorcellerie`) ; la pénalité de Corruption est à appliquer lors de chaque `rollMiscast` pour un lanceur de ce Domaine.

---

## Listes de sorts — à transcrire séparément

Les catalogues de sorts (NI, portée, cible, durée, description mécanique) sont dans les fichiers source suivants. Ils ne sont **pas** dans ce fichier (volume trop important) :

| Fichier source | Contenu |
|---|---|
| `LDB 47 - Listes des sorts.md` | Sorts Mineurs, Sorts d'Arcane, Sorts de Domaine de chaque Collège (Feu, Lumière, Jade, Céleste, Ambre, Or, Métal, Ombres) |
| `LDB 48 - Magie des Couleurs.md` | Attributs de Domaine par Vent (règles spécifiques de Cieux, Métal, Ombres…) + sorts complémentaires |
| `LDB 49 - Sorcellerie.md` | Sorts de Magie Naturelle + Sorcellerie |
| `LDB 50 - Magie noire.md` | Sorts de Nécromancie + Démonologie |
| `LDB 51 - Magie du Chaos.md` | Sorts de Nurgle, Slaanesh, Tzeentch (LDB) |
| `EDO - Sorts de Tzeentch` | Sorts additionnels Tzeentch (`Source/Warhammer v4 - 1.0 L'ennemi dans l'Ombre/`) |

Les specs curées de tous ces sorts sont dans `src/data/spellspecs/` (une entrée par sort, couvrant les 243 sorts) — voir `src/engine/spellspec.ts`.

---


---

<!-- MDG-INTEGRATION -->

## Magie des mers — modificateurs des Vents en mer

**Sources RAW :** `MDG 02 l.178-186`

Le « Département des arts magiques maritimes » du collège du baron Henryk (Marienburg) prévient les apprentis que les Vents de Magie se rassemblent et soufflent de manière étrange sur les mers. Certains Vents sont plus difficiles à contrôler, d'autres déferlent en rafales écrasantes. Les modificateurs suivants s'appliquent aux Tests de **Focalisation** et d'**Incantation** en mer, par Domaine :

- **Domaine de la Bête (*Ghur*)** : la définition de Maladresse — et de Critique — est élargie pour les Sorts de ce Domaine. Les Incantations/Focalisations critiques **et** les Maladresses se produisent à la fois sur les **doubles** et sur les **résultats se terminant par un 0** (Ghur repose parmi les bêtes de l'abysse et peut réagir au lanceur).
- **Domaine du Feu (*Aqshy*)** : les Tests de **Focalisation** subissent **−1 DR** en mer (*Aqshy* est difficile à invoquer). **Exception** : si un bateau est actuellement rongé par les flammes, Focaliser *Aqshy* sur ce vaisseau donne **+1 DR** (en plus des bénéfices normaux des États *En flammes* appliqués au Domaine du Feu — cf. Attribut Feu LDB 48).
- **Domaine des Cieux (*Azyr*)** : météo-dépendant. Les Sorts du Domaine des Cieux lancés pendant une **Violente tempête** bénéficient de **+1 DR** aux Tests d'**Incantation** ; ceux lancés en période de **Calme plat** subissent **−1 DR** aux Tests d'**Incantation**.
- **Domaine de la Vie (*Ghyran*)** : *Ghyran* sature les mers (puissance facile pour un sorcier de Jade) mais fluctue. Les **DR des Tests de Focalisation sont doublés** sur les mers, mais une **Focalisation Critique** y donne une **Incantation Imparfaite Majeure** (au lieu de Mineure). Avec le Talent **Harmonisation aethyrique**, on lance sur le tableau des Incantations Imparfaites **Mineures** à la place.

> **Verbatim** (l.180) : « Pour les Sorts de ce Domaine, les Incantations et Focalisations critiques ainsi que les Maladresses se produisent à la fois sur les doubles et les résultats se terminant par un 0. »

> **Verbatim** (l.182) : « Les Tests de Focalisation pour ce Domaine subissent -1 DR. Cependant, si un bateau est en feu, *Aqshy* se précipite vers lui. Focaliser *Aqshy* sur un vaisseau actuellement rongé par les flammes donne +1 DR »

> **Verbatim** (l.184) : « Les Sorts du Domaine des Cieux lancés pendant une Violente tempête bénéficient de +1 DR sur les Tests d'Incantation. Les Sorts lancés en période de Calme plat subissent -1 DR sur les Tests d'Incantation. »

> **Verbatim** (l.186) : « Les DR des Tests de Focalisation sont doublés sur les mers, mais une Focalisation Critique donne une Incantation Imparfaite Majeure au lieu de Mineure. Si vous possédez le Talent *Harmonisation aethyrique*, faites un lancer sur le tableau des Incantations Imparfaites Mineures à la place. »

**Voir aussi :** [Focalisation (Test étendu)](#focalisation-test-etendu), [Focalisation Critique](#focalisation-critique), [Maladresse de Focalisation](#maladresse-de-focalisation), [Domaine du Feu (Aqshy — Vent Rouge)](#domaine-du-feu-aqshy--vent-rouge)

**Implémente :** `resolveFocus()`/`resolveCasting()`/`evaluateCasting()` (`src/engine/magic.ts`) lisent `DomainData.seaModifier` via `domainSea*` (`src/engine/domainAttributes.ts`), gated par un contexte `{ atSea, wind }` fourni par l'appelant (`seaMagicContext()`, `src/state/combatOrParty.ts` — voyage maritime `travelPlan.mode === 'mer'` ou combat d'abordage sur le navire de campagne, vent = météo du jour). Les 4 Domaines (Bête/Feu/Cieux/Vie) sont câblés, y compris l'exception Harmonisation aethyrique de Vie. ⚠ Non modélisé : le bonus Feu « +1 DR si le vaisseau ciblé est en flammes » (l.182) — `resolveFocus()` n'a pas de cible physique à tester (#337).

---

## Sorts de magie des mers (collège du baron Henryk)

**Sources RAW :** `MDG 02 l.189-262`

Le collège du baron Henryk enseigne des Sorts particulièrement adaptés à la vie en mer, peu connus hors de Marienburg, rattachés aux Domaines de la **Vie** (*Ghyran*) et des **Cieux** (*Azyr*). Six sorts sont décrits (NI, portée, cible, durée, effet mécanique → transcrits dans [`catalogue-sorts.md`](catalogue-sorts.md)) :

- **Domaine de la Vie** — *Bourbier vivant* (NI 8 : enlise un navire, −2 Mouvement et −3 DR de Manœuvre, dégagement par Test étendu de Navigation) ; *Que d'eau, que d'eau* (NI 6 : purifie et remplit les tonneaux d'eau du navire) ; *Tourbillon* (NI 6 : crée un tourbillon dans la ZdE, agrandissable par Surincantation — Tourbillon / Puissant vortex / Maelstrom / Maelstrom primordial selon le DR).
- **Domaine des Cieux** — *Bienfait de Bel Shanaar* (NI 2 : +2 DR aux Tests d'Orientation du sorcier vers une destination connue) ; *Mer d'huile* (NI 10 : impose l'effet *Calme plat* du tableau Effet du vent sur la ZdE) ; *Solution de tir optimal de Niezlib* (NI 6 : +1 DR aux Tests pour tirer au canon depuis le navire).

Ces sorts manipulent des objets de jeu « navals » (navire, Manœuvre, tourbillon, Effet du vent, canon) propres aux règles maritimes de MDG ; seul *Bienfait de Bel Shanaar* (bonus d'Orientation) relève d'une mécanique générique RAW déjà supportée.

> **Verbatim** (l.205, *Bourbier vivant*) : « Tant qu'il est pris dans le bourbier, le bateau subit -2 à sa Caractéristique de Mouvement et ajuste sa Caractéristique de Manœuvre de -3 DR. »

> **Verbatim** (l.262, *Solution de tir optimal de Niezlib*) : « Pendant toute la durée du Sort, les Tests effectués pour tirer avec un canon bénéficient de +1 DR. »

**Voir aussi :** [Magie des mers — modificateurs des Vents en mer](#magie-des-mers--modificateurs-des-vents-en-mer), [Surincantation](#surincantation), [Zone d'Effet (ZdE)](#zone-deffet-zde)

**Implémente :** non-implémenté (sorts navals MDG ; à ajouter en données `src/data/spellspecs/` si les règles maritimes de MDG entrent dans le moteur).

## Bilan de fidélité

### Règles couvertes

| Règle | Source | Statut |
|---|---|---|
| Vents de Magie (8 couleurs, restriction 1 Vent) | LDB 44 l.3-39 | OK |
| Types de sorts (Mineurs/Arcane/Domaine/Chaos) | LDB 46 l.13-15 | OK |
| Mémoriser un sort (PX) | LDB 46 l.17-21 | OK |
| Test d'incantation (Langue Magick, DR ≥ NI) | LDB 46 l.23-25 | OK |
| Compétence avancée (0 avance = pas de test) | LDB 09 | OK |
| Incantation Critique (double réussi) | LDB 46 l.27-32 | OK |
| Maladresse → Imparfaite Mineure | LDB 46 l.84-86 | OK |
| Influence corruptrice → le 8 | LDB 46 l.88-90 | OK |
| Tableau Imparfaites Mineures (20 entrées) | LDB 46 l.33-53 | OK — verbatim |
| Tableau Imparfaites Majeures (20 entrées) | LDB 46 l.55-80 | OK — verbatim |
| Focalisation (Test étendu, NI → 0) | LDB 46 l.129-133 | OK |
| Focalisation Critique (Harmonisation aethyrique) | LDB 46 l.135-137 | OK |
| Maladresse Focalisation élargie (0 terminal) | LDB 46 l.139-141 | OK |
| Interruptions de Focalisation (Calme −20) | LDB 46 l.143-145 | OK |
| Repousser les Vents (armure −1 DR/PA) | LDB 46 l.148-151 | OK |
| Avantages → incantation (pas focalisation) | LDB 46 l.125 | OK |
| Dissipation / Contre-sort (Test opposé) | LDB 46 l.154-156 | OK |
| Dissiper sorts permanents (Test étendu) | LDB 46 l.159-162 | OK |
| Durée (pas de fin volontaire) | LDB 46 l.92-94 | OK |
| Grimoire (NI × 2) | LDB 46 l.96-99 | OK |
| Projectile magique (localisation inversée, dégâts) | LDB 46 l.101-105 | OK |
| Composants (Majeure→Mineure, Mineure→annulée) | LDB 46 l.107-114 | OK |
| Restrictions (parole, unicité, non-cumul, LoS) | LDB 46 l.116-121 | OK |
| Sort de Contact en combat (Corps à corps Bagarre) | LDB 46 l.123-124 | OK |
| Attributs de Domaine — Bête (Peur 1 post-incantation) | LDB 48 l.7 | OK — `domainAfterCast` |
| Attributs de Domaine — Cieux (bypass PA métal + AoE 2 m) | LDB 48 l.105 | OK — `domainMissileMods` / `domainOnHitEffects` |
| Attributs de Domaine — Feu (Enflammé + bonus si états proches) | LDB 48 l.201 | Partiel — rider OK ; bonus +10 par état voisin non implémenté |
| Attributs de Domaine — Lumière (Aveuglé + frappe BInt vs Démons/Mort-vivants) | LDB 48 l.302 | OK — `domainOnHitEffects` |
| Attributs de Domaine — Métal (bypass PA métal + bonus = PA ignorés) | LDB 48 l.398 | OK — `domainMissileMods` (bonusFromBypass) |
| Attributs de Domaine — Mort (Exténué sur vivants, cap 1) | LDB 48 l.497 | OK — `domainOnHitEffects` |
| Attributs de Domaine — Ombres (bypass tous PA non magiques) | LDB 48 l.582 | OK — `domainMissileMods` |
| Attributs de Domaine — Vie (purge états + frappe Mort-vivants + +10 rural) | LDB 48 l.679 | Partiel — purge+frappe OK ; +10 rural non implémenté |
| ZdE = diamètre | LDB 47 l.28 | OK |
| Surincantation — Sort (×initial Portée/ZdE/Durée/Cible, +2 DR/pas) | LDB 47 l.13-17 | OK — `engine/overcast.ts` |
| Surincantation — Bénédiction (+6 m / +1 Cible / +6 Rounds FIXE, pas de ZdE) | LDB 41 l.21-27 | OK — `engine/overcast.ts` |
| Surincantation — Miracle (×initial Portée/Durée/Cible, pas de ZdE, « Vous » non augmentable) | LDB 42 l.7-13 | OK — `engine/overcast.ts` |
| Magie Noire / Dhar | LDB 46 l.2-3 | OK |
| Malepierre | LDB 46 l.3-4 | OK |
| Sorcellerie (corruption + Hémorragique + Imparfaite systématique) | LDB 49 l.5-7 | OK |
| Magie Naturelle (composants obligatoires) | LDB 49 l.2-2 | OK |

### Tables d100 transcrites

- Tableau des Incantations Imparfaites Mineures (20 entrées, 01–00) — verbatim LDB 46 l.33-53.
- Tableau des Incantations Imparfaites Majeures (20 entrées, 01–00) — verbatim LDB 46 l.55-80.
- Tableau de la Colère des dieux (LDB 40 l.52-101) → **non transcrit ici** — appartient à `religion.md` (à construire). Implémenté dans `WRATH` (`src/engine/miscast.ts` l.164-206).

### Refs-code couvertes

Toutes les refs `LDB 46 l.XXX` présentes dans `src/engine/magic.ts` et `src/engine/miscast.ts` sont couvertes par une entrée de ce document. La Surincantation (LDB 47/41/42) est implémentée dans `src/engine/overcast.ts` (math source-aware pure) + `effectiveSpellRangeTiles`/`spellTargetCount` (`magic.ts`), alloué/résolu par `castAllocOvercast`/`applyCast`/`overcastTargetCandidates`.

### Écarts / points à vérifier

1. **Influences Malfaisantes (le « 8 »)** : non implémenté en runtime — la détection du chiffre 8 au dé des unités n'est pas branchée dans `resolveCasting` / `resolveFocus`. À brancher si cette règle doit s'appliquer dans des zones corrompues.
2. **Dissiper les sorts permanents** : le Test étendu de Langue (Magick) hors combat n'est pas implémenté (laissé au MJ).
3. **Magie Elfique (Qhaysh)** : hors périmètre joueur actuellement.
4. **Sorts du Chaos (LDB 51) et Magie noire (LDB 50)** : les règles de Domaine (Démonologie, Nécromancie, Nurgle/Slaanesh/Tzeentch) et leurs sorts ne sont pas couverts par ce fichier — voir catalogue séparé.
5. **EDO sorts Tzeentch** : intégrés dans `src/data/` mais leur règle de Domaine spécifique (EDO) n'est pas encore documentée ici.
6. **Attribut Feu — bonus +10 par état Enflammé voisin** (LDB 48 l.201) : non implémenté — nécessiterait un scan de la scène à chaque incantation pour compter les états actifs à ≤ BFM mètres.
7. **Attribut Vie — +10 en environnement rural/sauvage** (LDB 48 l.679) : non implémenté — pas de classification rurale/urbaine des scènes dans le moteur.
8. **Propagation latérale Cieux (AoE 2 m)** (LDB 48 l.105) : déclarée en données (`DomainData.effects`) mais sa mécanique précise (BFM dégâts Projectile magique vers toutes cibles à 2 m sauf porteurs du Talent) mérite vérification dans `triggeredEffects`.
