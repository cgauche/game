# Atlas RAW — Compétences

> Référentiel autosuffisant des règles WFRP4 (RAW) sur les Compétences. Chaque règle cite
> `LDB 09 l.X-Y` (ou supplément) en source de dernier recours. Voir [`sources.md`](sources.md),
> [`00-index.md`](00-index.md). Rouvrir le livre = défaut à corriger ici.
> ⚠️ Les champs **Implémente** sont GÉNÉRÉS (`npm run raw:implemente` — source éditoriale : `src/data/raw.manifest.json`) — ne pas les éditer à la main.

## Sommaire

- [Mécanique fondamentale — niveau de Compétence](#mécanique-fondamentale--niveau-de-compétence)
- [Compétences de Base vs Avancées](#compétences-de-base-vs-avancées)
- [Compétences Groupées et Spécialisations](#compétences-groupées-et-spécialisations)
- [Compétences de Base — liste complète](#compétences-de-base--liste-complète)
- [Compétences Avancées — liste complète](#compétences-avancées--liste-complète)
- [Table des Compétences — Caractéristique et type](#table-des-compétences--caractéristique-et-type)
- [Spécialisations — inventaire complet par Compétence](#spécialisations--inventaire-complet-par-compétence)
- [Règle optionnelle — Caractéristique alternative](#règle-optionnelle--caractéristique-alternative)
- [Extension ogre — Langue (Magick) sur Endurance](#extension-ogre--langue-magick-sur-endurance)
- [Règle optionnelle — Filature (Discrétion + Perception)](#règle-optionnelle--filature-discrétion--perception)
- [Applications en combat — résumé par Compétence](#applications-en-combat--résumé-par-compétence)
- [Bilan de fidélité](#bilan-de-fidélité)

---

## Mécanique fondamentale — niveau de Compétence

Le niveau de Compétence d'un personnage est la **somme de la Caractéristique associée + les
Augmentations** dans cette Compétence inscrites sur la Feuille de Personnage.

> « Un Niveau de Compétence est déterminé en prenant la Caractéristique associée et en ajoutant
> le nombre d'Augmentations prises dans la Compétence. »
> — LDB 09 l.17

**Sources RAW :** LDB 09 l.12-18

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.12-18) → `possesses` — `src/engine/axes.ts`, `src/engine/skillCombatApps.ts`

**Voir aussi :** [Tests & Degrés de Réussite](tests.md) pour l'utilisation de ce niveau en test.

---

## Compétences de Base vs Avancées

### Compétences de Base

Représentent des aptitudes communes ou innées. **Peuvent faire l'objet d'un Test même sans
Augmentation** : on utilise simplement la Caractéristique associée.

> « Les Compétences de Base peuvent faire l'objet d'un Test même si vous n'y avez pas mis
> d'Augmentation. Pour cela, tentez simplement un Test utilisant la Caractéristique associée. »
> — LDB 09 l.25

### Compétences Avancées

Nécessitent un entraînement. **Impossible de tenter le Test sans au moins une Augmentation.**

> « Vous ne pouvez effectuer de Test de Compétence Avancée que si vous y avez ajouté au moins une
> Augmentation. Si ce n'est pas le cas, vous ne pouvez pas tenter le Test de Compétence. »
> — LDB 09 l.30

**Sources RAW :** LDB 09 l.22-32

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.22-32) → `hasHealSkill`, `possesses`, `buySkillAdvance`, `buildAdvancementView`, `createHero`, `GameState`, `AdvancementPanel`, `Combatant` — `src/engine/advancement.ts`, `src/engine/axes.ts`, `src/engine/careerSlots.ts`, `src/engine/character.ts`, `src/engine/healing.ts`, `src/engine/skillCombatApps.ts`, +5 fichiers

---

## Compétences Groupées et Spécialisations

Une Compétence Groupée regroupe plusieurs **Spécialisations** sous une même rubrique. Chaque
Spécialisation est traitée comme une **Compétence distincte** (Augmentations indépendantes, Tests
séparés). Lors d'un gain d'Augmentation dans une Compétence Groupée, on alloue l'Augmentation à
une Spécialisation précise.

> « Quand vous gagnez une Augmentation dans une Compétence Groupée, vous devez allouer
> l'Augmentation à une Spécialisation appropriée. »
> — LDB 09 l.40

Quand la Spécialisation est « Au choix », le joueur la sélectionne librement parmi les exemples de
la description, ou en crée une avec l'accord du MJ.

> « Chaque Compétence est alors appelée une Spécialisation. Quand une Spécialisation est mentionnée
> dans les règles, elle est indiquée entre parenthèses. »
> — LDB 09 l.36-37

**Sources RAW :** LDB 09 l.34-46

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.34-46) → `hasHealSkill`, `possesses`, `buySkillAdvance`, `buildAdvancementView`, `combatValue`, `weaponUnmastered`, `createHero`, `GameState`, `AdvancementPanel`, `Combatant` — `src/engine/advancement.ts`, `src/engine/axes.ts`, `src/engine/careerSlots.ts`, `src/engine/character.ts`, `src/engine/combat.ts`, `src/engine/healing.ts`, +6 fichiers

---

## Compétences de Base — liste complète

Liste source LDB 09 l.52 :

**Art, Athlétisme, Calme, Charme, Chevaucher, Commandement, Conduite d'attelage, Corps à corps,
Discrétion, Divertissement, Emprise sur les animaux, Escalade, Esquive, Intimidation, Intuition,
Marchandage, Orientation, Pari, Perception, Ragot, Ramer, Résistance, Résistance à l'alcool,
Subornation, Survie en extérieur**

(25 Compétences de Base)

---

## Compétences Avancées — liste complète

Liste source LDB 09 l.55-56 :

**Crochetage, Dressage, Escamotage, Évaluation, Focalisation, Guérison, Langue, Métier, Musicien,
Natation, Piégeage, Pistage, Prière, Projectiles, Recherche, Représentation, Savoir, Signes secrets,
Soin aux animaux, Voile**

(20 Compétences Avancées)

---

## Table des Compétences — Caractéristique et type

| Compétence | Carac. | Type | Groupée |
|---|---|---|---|
| Art | Dex | Base | Oui |
| Athlétisme | Ag | Base | Non |
| Calme | Fm | Base | Non |
| Charme | Soc | Base | Non |
| Chevaucher | Ag | Base | Oui |
| Commandement | Soc | Base | Non |
| Conduite d'attelage | Ag | Base | Non |
| Corps à corps | CC | Base | Oui |
| Crochetage | Dex | Avancée | Non |
| Discrétion | Ag | Base | Oui |
| Divertissement | Soc | Base | Oui |
| Dressage | Int | Avancée | Oui |
| Emprise sur les animaux | Fm | Base | Non |
| Escalade | F | Base | Non |
| Escamotage | Dex | Avancée | Non |
| Esquive | Ag | Base | Non |
| Évaluation | Int | Avancée | Non |
| Focalisation | Fm | Avancée | Oui* |
| Guérison | Int | Avancée | Non |
| Intimidation | F | Base | Non |
| Intuition | I | Base | Non |
| Langue | Int | Avancée | Oui |
| Marchandage | Soc | Base | Non |
| Métier | Dex | Avancée | Oui |
| Musicien | Dex | Avancée | Oui |
| Natation | F | Avancée | Non |
| Orientation | I | Base | Non |
| Pari | Int | Base | Non |
| Perception | I | Base | Non |
| Piégeage | Dex | Avancée | Non |
| Pistage | I | Avancée | Non |
| Prière | Soc | Avancée | Non |
| Projectiles | Ct | Avancée | Oui |
| Ragot | Soc | Base | Non |
| Ramer | F | Base | Non |
| Recherche | Int | Avancée | Non |
| Représentation | Ag | Avancée | Oui |
| Résistance | E | Base | Non |
| Résistance à l'alcool | E | Base | Non |
| Savoir | Int | Avancée | Oui |
| Signes secrets | Int | Avancée | Oui |
| Soin aux animaux | Int | Avancée | Non |
| Subornation | Soc | Base | Non |
| Survie en extérieur | Int | Base | Non |
| Voile | Ag | Avancée | Oui |

*Focalisation est « à la fois Groupée (Spécialisations par Vent) et non Groupée pour les non-formés »
(LDB 09 l.250-252).

**Sources RAW :** LDB 09 l.65-574 (descriptions individuelles).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.65-574) → `GearAssignList`, `altCharKey`, `rollDrivingMishap` ⚠sans-appelant, `actBlockReason`, `drivingAccidentDamage` ⚠sans-appelant, `DRUNK_CARACS`, `skillAdvantageCap`, `carryOverState`, `useDefenseJetProps`, `healDifficulty`, +29 — `src/data/driving-mishap.json` ⚠hors-app, `src/data/drunkenness.json`, `src/data/index.ts`, `src/data/night-stakes.json`, `src/data/schemas/defs/driving-mishap.ts`, `src/data/schemas/defs/drunkenness.ts`, +24 fichiers

---

## Spécialisations — inventaire complet par Compétence

### Art (Dex) — Base, Groupée
**LDB :** Cartographie, Gravure, Mosaïque, Peinture, Sculpture, Tatouage, Tissage
(LDB 09 l.72)
**AA :** Art (Écriture) (AA l.3574)

### Chevaucher (Ag) — Base, Groupée
**LDB :** Cheval, Grand Loup, Griffon, Demigriffon, Pégase
(LDB 09 l.118)
**ADE I :** Chevaucher (Blaireau) (ADE I l.44)

### Corps à corps (CC) — Base, Groupée
**LDB :** Arme d'hast, Arme à deux mains, Bagarre, Base, Cavalerie, Escrime, Fléau, Parade
(LDB 09 l.160)
**AA :** aucune nouvelle Spécialisation (les mêmes s'appliquent aux Cavaliers, Hallebardiers,
Duellistess des nouvelles Carrières).

### Discrétion (Ag) — Base, Groupée
**LDB :** Rurale, Souterrains, Urbaine
(LDB 09 l.185)

### Divertissement (Soc) — Base, Groupée
**LDB :** Chant, Comédie, Interprétation, Narration
(LDB 09 l.198)
**AA :** Divertissement (Discours) (AA l.2366)

### Dressage (Int) — Avancée, Groupée
**LDB :** Cheval, Chien, Demigriffon, Pégase, Pigeon
(LDB 09 l.211)

### Focalisation (Fm) — Avancée, Groupée*
**LDB :** Aqshy, Azyr, Chamon, Dhar, Ghur, Ghyran, Hysh, Shyish, Ulgu
(LDB 09 l.252)

### Langue (Int) — Avancée, Groupée
**LDB :** bataille, bretonnien, classique, guilde, khazalid, Magick, voleur, tiléen
(LDB 09 l.302)
**Langues du Vieux Monde listées par LDB 09 l.319-346 :** Albionais, Bataille, Bretonnien,
Classique, Elthárin, Estalien, Gospodarin, Grumbarth, Khazalid, Magick, Halfling, Norse, Reikspiel,
Queekique, Tiléen, Langage des voleurs, Wastelander.
**AA :** Langue (Arabéen) (AA l.1747)
**Note :** Langue (Magick) sert à lancer des Sorts (LDB 09 l.300-301) — voir [Magie](magie.md).

### Métier (Dex) — Avancée, Groupée
**LDB :** Apothicaire, Calligraphe, Cirier, Charpentier, Cuisinier, Embaumeur, Forgeron, Tanneur
(LDB 09 l.364)
**AA (exemples extraits des Carrières) :** Armurier, Barbier, Cartographe, Explosifs, Fabricant de
flèches, Forgeron, Maçon, Maréchale-ferrant, Mineur, Scribe
**AA l.3817 :** Métier (Charpentier) ou Métier (Maçon) pour réparer des Structures.
**AA l.3559 :** Métier (Cartographe) pour utiliser un théodolite.

### Musicien (Dex) — Avancée, Groupée
**LDB :** Clavecin, Cor, Cornemuse, Luth, Violon
(LDB 09 l.370)
**AA :** Musicien (Flûte), Musicien (Tambour) (AA l.444, l.607)

### Projectiles (Ct) — Avancée, Groupée
**LDB :** Arbalète, Arc, Entraves, Explosifs, Fronde, Ingénierie, Lancer, Poudre noire
(LDB 09 l.428)
**AA :** Catapulte (AA l.496, l.3828 — armes de siège distinctes de Poudre noire et Arbalète).
Note : Baliste = groupe Arbalète (AA l.3832) ; Canon / Canon feu d'enfer = groupe Ingénierie ;
Catapulte = groupe Catapulte exclusif.

### Représentation (Ag) — Avancée, Groupée
**LDB :** Acrobaties, Cracheur de feu, Danser, Funambule, Jonglage, Mime, Pitreries
(LDB 09 l.465)
**AA :** Représentation (Parade) — défilé militaire (AA l.607)

### Savoir (Int) — Avancée, Groupée
**LDB :** Géologie, Héraldique, Histoire, Ingénierie, Loi, Magick, Métallurgie, Science, Théologie
(LDB 09 l.495)
**AA (exemples extraits des Carrières) :** Anatomie, Art de la guerre, Artillerie, Bêtes, Empire,
Géographie, Guerre, Herbes (cité LDB 09 l.565), Ingénierie, Loi, Magie, Nécromancie, Région,
Remèdes, Théologie
**ADE II :** Savoir (Magie) pour fabriquer des objets magiques (ADE II l.93, l.99, l.104)

### Signes secrets (Int) — Avancée, Groupée
**LDB :** Ordre Gris, Guildes (au choix), Ruraux, Éclaireurs, Voleurs, Vagabonds
(LDB 09 l.504)
**AA :** Signes secrets (Ranger) (ADE I l.131) ; Signes secrets (Ulric) (AA l.1077) ;
Signes secrets (Soleil flamboyant) (AA l.1137) ; Signes secrets (Chevaliers Panthères) (AA l.1198)

### Voile (Ag) — Avancée, Groupée
**LDB :** Caravelle, Chaland, Cogue, Drakkar, Frégate
(LDB 09 l.573)
**Note LDB :** posséder une Spécialisation Voile rend les autres Spécialisations de Base pour ce
personnage (LDB 09 l.571).

---

## Descriptions individuelles des Compétences

### Art (Dex) — Base, Groupée
LDB 09 l.65-72

Créer des œuvres d'art dans la Spécialisation choisie. Sans outils appropriés : pénalité. Le DR
obtenu détermine la qualité. Un Test étendu peut être nécessaire pour une œuvre complexe.

**Sources RAW :** LDB 09 l.65-72

---

### Athlétisme (Ag) — Base
LDB 09 l.75-76

Courir, sauter, se déplacer avec rapidité et grâce, toute activité physique générale. Voir aussi
[Déplacement](deplacement.md) pour l'usage en mouvement de combat.

**Sources RAW :** LDB 09 l.75-76

---

### Calme (Fm) — Base
LDB 09 l.80-83

Rester serein sous pression, résister à la peur face à l'horreur, tenir ses convictions. Utilisé pour
résister aux autres Compétences (Charme, Intimidation) et aux effets de Psychologie (voir
[Psychologie](psychologie.md)). Test opposé principal : Calme/Charme, Calme/Intimidation.

**Sources RAW :** LDB 09 l.80-83

---

### Charme (Soc) — Base
LDB 09 l.86-109

Inciter les gens à avoir une bonne opinion de soi, de ses points de vue, des actions proposées.
Usages spécifiques :

- **Mendier :** succès = Bonus de Sociabilité × DR sous de cuivre par heure.
- **Parler en public (discours) :** influencer jusqu'à Bonus de Sociabilité + DR cibles (plus faible
  Force Mentale en premier) ; si foule déchaînée : Test opposé à Fm moyenne de la foule (35 en
  général). Échec Stupéfiant = foule en colère.
- **Test opposé Charme/Calme :** influencer l'attitude d'une ou plusieurs cibles (max Bonus Soc + DR).
- **En combat :** Action ou Défense ; sur succès les cibles ne vous attaquent pas ce Round, +1
  Avantage. Talents Orateur/Grand orateur augmentent le nombre de cibles. Echec Stupéfiant en
  discours = foule hostile.

**Sources RAW :** LDB 09 l.86-109

---

### Chevaucher (Ag) — Base, Groupée
LDB 09 l.111-118

Maîtriser un groupe d'animaux de monte spécifique (chaque Spécialisation = un type). Aucun Test
nécessaire pour une conduite normale ; Test requis pour manœuvres inhabituelles (course, terrain
dangereux, charge en combat). En déplacement monté : Mouvement de la monture, Compétence Chevaucher
remplace Athlétisme pour courir/sauter/bondir. Test étendu pour long trajet.

**Sources RAW :** LDB 09 l.111-118

---

### Commandement (Soc) — Base
LDB 09 l.121-134

Diriger les autres, se faire respecter. Test réussi = ordres à Bonus Soc + DR cibles. Si la cible
est un subordonné direct : pas d'opposition. Sinon (hiérarchie absente ou ordre exigeant) : opposé
au Calme des cibles.

- **En combat :** +10 à tous les Tests de Psychologie des subalternes jusqu'à la fin du prochain
  Round. Transfert d'Avantage : Test réussi = transférer 1 Avantage + 1 par DR à des alliés à portée.

**Sources RAW :** LDB 09 l.121-134

---

### Conduite d'attelage (Ag) — Base
LDB 09 l.137-154

Conduire des véhicules (chariots, diligences, créations expérimentales). Si conditions normales et
Compétence possédée : aucun Test. Sinon : Test requis. Sans Compétence : Test même pour manœuvres
basiques. Échec Stupéfiant → table d'accidents (Harnais cassé / Cahots / Roue brisée / Essieu cassé).

Réparation d'un véhicule accidenté : Métier (Charpentier) ou Métier (Charron).

**Sources RAW :** LDB 09 l.137-154

---

### Corps à corps (CC) — Base, Groupée
LDB 09 l.157-160

Entraînement spécifique à une classe d'armes de combat rapproché. Sans la Spécialisation appropriée :
pénalités définies au Chapitre 11 (Équipement). Voir [Combat](combat.md).

**Sources RAW :** LDB 09 l.157-160

---

### Crochetage (Dex) — Avancée
LDB 09 l.163-176

Ouvrir des serrures sans clef. Souvent Test étendu, DR requis selon la complexité de la serrure.
Sans outils de crochetage : pénalité de −10 (improvisation). Chaque Test = 1 Round. Table de
difficultés standard :

| Type de serrure | Difficulté | DR |
|---|---|---|
| Loquet | Accessible (+20) | — |
| Porte classique | Intermédiaire (+0) | 2 |
| Porte sécurisée | Complexe (−10) | 2 |
| Coffre au trésor | Difficile (−20) | 5 |
| Porte blindée | Très difficile (−30) | 10 |

Sans Compétence : Test de Dextérité Très difficile (−30) pour les serrures simples (MJ).

**Sources RAW :** LDB 09 l.163-176

---

### Discrétion (Ag) — Base, Groupée
LDB 09 l.179-190

Se glisser sournoisement, se dissimuler dans l'ombre. Généralement opposé à la Perception de
l'adversaire. Modificateurs : obscurité, itinéraire dissimulé, tenue appropriée. Échec Impressionnant
ou Stupéfiant = attention immédiate des ennemis.

**Option Filature** (Test Combiné Perception + Discrétion, LDB 09 l.188-190) : voir section dédiée.

**Sources RAW :** LDB 09 l.179-190

---

### Divertissement (Soc) — Base, Groupée
LDB 09 l.193-198

Ravir les foules par la parole, le chant, la comédie, les histoires. Succès = auditoire conquis,
DR = qualité. En combat : peu d'utilité, sauf Divertissement (Interprétation) pour troubler/leurrer
(MJ).

**Distinctions avec Musicien et Représentation (LDB 09 l.275-285) :**
- Divertissement (Soc, Base) = aptitudes communes, même sans entraînement (chant, récit).
- Musicien (Dex, Avancée) = instruments, formation nécessaire.
- Représentation (Ag, Avancée) = arts physiquement exigeants, coordination.

**Sources RAW :** LDB 09 l.193-198, 248-258

---

### Dressage (Int) — Avancée, Groupée
LDB 09 l.201-211

Comprendre et entraîner un type particulier d'animal. Succès = identifier les capacités Dressé de
l'animal (Spécialisation). Permet l'Activité Dressage entre aventures.

**En combat :** Test opposé Dressage/Force Mentale pour instiller la Peur chez un animal (jusqu'à
la fin du prochain tour). En cas de succès, on peut utiliser Dressage à la place de Corps à corps
pour la défense ou l'attaque contre cette cible (avec accord MJ).

**Sources RAW :** LDB 09 l.201-211

---

### Emprise sur les animaux (Fm) — Base
LDB 09 l.214-219

Se lier d'amitié, calmer ou asservir les animaux. Test réussi = influencer Bonus de Fm + DR animaux
(les plus faibles Force Mentale en premier). Naturellement dociles : incontesté. Sinon : opposé à
Force Mentale de la cible.

**En combat :** sur succès, aucune cible affectée ne vous attaque ce Round, +1 Avantage. Peut se
renouveler jusqu'à échec ou arrêt. Après échec : instinct animal reprend le dessus, plus d'influence.

**Sources RAW :** LDB 09 l.214-219

---

### Escalade (F) — Base
LDB 09 l.222-225

Grimper sur des surfaces lisses ou verticales. Si temps non contraint et escalade facile : automatique
pour qui possède la Compétence. Sinon : Test (voir aussi [Déplacement](deplacement.md) et combat). En
combat : possible même sur de grands adversaires.

**Sources RAW :** LDB 09 l.222-225

---

### Escamotage (Dex) — Avancée
LDB 09 l.228-233

Faire les poches, escamoter des objets, tours de prestidigitation, tricher aux jeux de hasard.
Généralement opposé à Perception de la cible. Succès = objet escamoté / poches faites / cartes
échangées. Succès Minime possible = méfiance sans preuve.

**Combinaison avec Pari :** Test d'Escamotage avant chaque Round d'un jeu (opposé si soupçons) ;
succès = pouvoir inverser le Test de Pari si l'inversion donne un succès. Échec = adversaires peu
ravis.

**Sources RAW :** LDB 09 l.228-233

---

### Esquive (Ag) — Base
LDB 09 l.236-239

Éviter des objets, esquiver, plonger, se déplacer rapidement (chutes de pierre, coups, pièges). En
combat : résister aux attaques / éviter les Dégâts. Voir [Combat](combat.md).

**Sources RAW :** LDB 09 l.236-239

---

### Évaluation (Int) — Avancée
LDB 09 l.242-243

Déterminer la valeur d'artefacts rares, marchandises inhabituelles, œuvres d'art. Succès = valeur
connue. Permet aussi de détecter les contrefaçons (Test opposé au DR du Test d'Art ou Métier du
faussaire). Modificateurs : rareté, méconnaissance, background du personnage.

**Sources RAW :** LDB 09 l.242-243

---

### Focalisation (Fm) — Avancée, Groupée*
LDB 09 l.246-252

Appeler et contrôler les différents Vents de Magie. Uniquement avec les règles de magie (voir
[Magie](magie.md)). Particularité : Groupée (Spécialisations par Vent) pour les formés, mais traitée
comme non Groupée pour les non-formés.

**Sources RAW :** LDB 09 l.246-252 ; ADE II l.165, l.177, l.179 (Focalisation sur artefacts magiques).

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.65-72, l.86-109, l.121-134, l.137-154, l.157-160, l.163-176, l.193-198, l.201-211, l.214-219, l.222-225, l.228-233, l.236-239, l.242-243, l.246-252, l.275-285) → `GearAssignList`, `altCharKey`, `rollDrivingMishap` ⚠sans-appelant, `actBlockReason`, `drivingAccidentDamage` ⚠sans-appelant, `carryOverState`, `useDefenseJetProps`, `healDifficulty`, `defenseSubOf`, `healWoundsDelta`, +13 — `src/data/driving-mishap.json` ⚠hors-app, `src/data/index.ts`, `src/data/schemas/defs/driving-mishap.ts`, `src/engine/combat.ts`, `src/engine/drivingMishap.ts` ⚠hors-app, `src/engine/healing.ts`, +12 fichiers
- sans code : `LDB 9` (l.75-76, l.80-83, l.111-118, l.179-190)

---

### Guérison (Int) — Avancée
LDB 09 l.255-269

Formation à soigner blessures et maladies. Un Test réussi permet :

- Diagnostiquer une pathologie / maladie.
- Traiter une maladie (voir [Maladies](maladies.md)).
- Guérir Bonus d'Intelligence + DR Points de Blessure (un seul jet par rencontre par patient). Avec
  liquides stériles / pansements appropriés : pas d'Infection.
- Arrêter un État Hémorragique (chaque DR supplémentaire retire un État Hémorragique de plus).

Échec possible si Bonus d'Int + DR < 0 → Blessures au patient. Échec Stupéfiant → Infection mineure.

Soins d'une personne malade : Test réussi protège le soignant ce jour ; chaque DR protège un
Personnage de plus croisant le patient. Chaque journée complète de soins réduit la durée de la
maladie de 1 (min 1).

En combat : Tests de Guérison Intermédiaires (+0).

**Sources RAW :** LDB 09 l.255-269

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.255-269) → `altCharKey`, `carryOverState`, `healDifficulty`, `healWoundsDelta`, `stopBleedOutcome`, `HealWoundsOptions`, `OPTIONAL_RULES`, `applyHealWounds`, `Combatant`, `createCombatSlice` — `src/engine/healing.ts`, `src/engine/persistence.ts`, `src/engine/policy.ts`, `src/engine/skills.ts`, `src/engine/types.ts`, `src/state/combatSlice.ts`

---

### Intimidation (F) — Base
LDB 09 l.272-294

Contraindre ou effrayer des créatures conscientes. Toujours opposé au Calme de la cible ; succès =
Bonus de Force + DR cibles affectées. La cible réagit selon sa personnalité : recul / fuite / combat.

**En combat :** cibles Intimidées subissent la Peur. Peut remplacer Corps à corps en défense contre
les personnes qui vous craignent. Avec accord MJ, peut « attaquer » (donner un ordre précis). Échec
à un Test ultérieur = fin de l'Intimidation (nouvelle tentative possible avec malus).

**Option MJ : Caractéristique alternative (LDB 09 l.293-294) :** F par défaut ; le MJ peut
autoriser Fm (Répurgateur) ou Int (universitaire face à un étudiant). Voir [Règle optionnelle](#règle-optionnelle--caractéristique-alternative).

**Sources RAW :** LDB 09 l.272-294

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.272-294) → `altCharKey`, `healDifficulty`, `OPTIONAL_RULES`, `createCombatSlice` — `src/engine/healing.ts`, `src/engine/policy.ts`, `src/engine/skills.ts`, `src/state/combatSlice.ts`
- sans code : `LDB 9` (l.293-294)

---

### Intuition (I) — Base
LDB 09 l.305-308

Percevoir son environnement, remarquer quand quelque chose ne va pas, ressentir quand on vous cache
quelque chose. Succès = informations subtiles (déterminées par le MJ). Si quelqu'un dissimule
activement : opposé à son Calme ou Divertissement (Interprétation).

**En combat :** Test réussi = +1 Avantage par évaluation de l'environnement et des adversaires.
Maximum d'Avantages par Intuition = Bonus d'Intelligence. Doit observer les cibles sans être
interrompu.

**Sources RAW :** LDB 09 l.305-308

---

### Langue (Int) — Avancée, Groupée
LDB 09 l.311-346

Aisance avec les langues. Tous les personnages parlent le reikspiel (et leur langue maternelle si
différente) sans Test. Si Compétence possédée : compréhension normale sans Test ; Test requis pour
concepts difficiles, dialectes ou vocabulaire obscur.

**Langue (Magick) :** sert à lancer des sorts ; peut nécessiter un Test avec conséquences en cas
d'échec (voir [Magie](magie.md)).

**Langue (Bataille) :** ordres et gestes simples utilisables en combat sans pénalité pour celui qui
la possède ; coordination d'attaques et stratégie inaccessibles à ceux qui ne la possèdent pas.

**Sources RAW :** LDB 09 l.311-346 ; ADE II l.653 (ogres : Langue Magick sur Endurance).

---

### Marchandage (Soc) — Base
LDB 09 l.348-348

Obtenir de meilleures offres lors de négociations. Test opposé de Marchandage pour déterminer si
l'on fait une bonne affaire. Utilisé aussi pour parcourir les échoppes et trouver les meilleurs prix
(voir [Économie](economie.md)).

**Sources RAW :** LDB 09 l.348-348

---

### Métier (Dex) — Avancée, Groupée
LDB 09 l.349-364

Créer quelque chose ou fournir un service, connaissance essentielle de la profession. Si Compétence
possédée + ressources + outils adaptés : tâches courantes automatiques sans Test. Test requis pour :
production rapide, conditions défavorables, objet de grande qualité.

Tests souvent étendus ; DR et temps nécessaires selon l'ampleur du projet.

Peut aussi s'utiliser comme Savoir pour des informations sur la profession (MJ peut substituer Int
à Dex dans ce cas, LDB 09 l.358).

Activité Artisanat entre aventures utilise Métier (voir [Activités](activites.md)).

**Sources RAW :** LDB 09 l.349-364

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.305-308, l.311-346, l.348, l.349-364) → `altCharKey`, `skillAdvantageCap`, `OPTIONAL_RULES`, `PendingTest`, `ActionBar`, `GameState`, `useGame`, `createCombatSlice` — `src/engine/policy.ts`, `src/engine/skillCombatApps.ts`, `src/engine/skills.ts`, `src/state/combatSlice.ts`, `src/state/pendings.ts`, `src/state/shipwreck.ts`, +2 fichiers

---

### Musicien (Dex) — Avancée, Groupée
LDB 09 l.367-370

Jouer d'un instrument de musique. Test réussi = divertir les spectateurs à portée, DR = qualité du
morceau.

**Distinctions avec Divertissement / Représentation :** voir [Divertissement](#divertissement-soc--base-groupée).

**Sources RAW :** LDB 09 l.367-370

---

### Natation (F) — Avancée
LDB 09 l.373-377

Nager sans se noyer. Si Compétence possédée : nage librement sans Test. Test requis pour courants
difficiles, course-poursuite, créatures aquatiques. Modificateurs : état de l'eau, encombrement
vêtements/armure/équipement.

**En combat aquatique :** remplace Athlétisme pour déterminer le Mouvement. Vitesse = moitié de la
Caractéristique de Mouvement.

**Sources RAW :** LDB 09 l.373-377

---

### Orientation (I) — Base
LDB 09 l.380-383

Trouver son chemin dans la nature (repères, étoiles, cartes). Si Compétence possédée et repères
connus : automatique sans Test. Test requis si désorienté ou hors des sentiers battus. Pour un long
trajet : Test d'Orientation étendu (modificateurs météo, repères visibles, informations géographiques ;
DR selon distance, chaque Test = 1 h à 1 journée de voyage).

**Sources RAW :** LDB 09 l.380-383

---

### Pari (Int) — Base
LDB 09 l.386-395

Évaluer les probabilités d'un pari, participer avec succès aux jeux de hasard. Lors d'un pari :
tous les participants font un Test de Pari ; le DR le plus haut l'emporte. À égalité : les plus
bas se retirent, on recommence.

Mini-jeux de table : Test réussi = avantage dans le jeu (piocher une carte supplémentaire, relancer
un dé, etc.) ; chaque DR = une opportunité de plus.

Pour influencer par des procédés moins honnêtes : voir Escamotage.

**Sources RAW :** LDB 09 l.386-395

---

### Perception (I) — Base
LDB 09 l.398-401

Percevoir son environnement avec tous les sens (vue, odorat, ouïe, toucher, goût — et tout sens
non humain ou magique). MJ peut demander un Test pour détecter quelque chose, modifié par la
facilité à le remarquer. Utilisé pour résister aux tentatives de dissimulation (Escamotage,
Discrétion).

**En combat :** remarquer des détails importants (déterminés par le MJ).

**Sources RAW :** LDB 09 l.398-401

---

### Piégeage (Dex) — Avancée
LDB 09 l.404-407

Poser et désarmer des pièges de toutes sortes. Si Compétence possédée et temps suffisant :
activation/désarmement automatiques. Test requis si rapidité ou pression, ou piège complexe.

Poser/désarmer un piège standard : Test Accessible (+20%). Appareils complexes : Test étendu sur
plusieurs Rounds.

**Sources RAW :** LDB 09 l.404-407

---

### Pistage (I) — Avancée
LDB 09 l.410-413

Suivre des traces subtiles laissées par d'autres. Distincte de Perception (empreintes évidentes dans
la neige = simple Test de Perception ; Pistage implique une lecture profonde des signes de passage).
Peut aussi servir à dissimuler ses propres traces (opposé au Pistage du poursuivant).

Test étendu souvent requis ; Difficulté selon fraîcheur et terrain. MJ peut aussi appliquer les
règles de Poursuite.

**Sources RAW :** LDB 09 l.410-413

---

### Prière (Soc) — Avancée
LDB 09 l.415-421

Invoquer ou communier avec une divinité. Voir [Religion](religion.md) pour les détails d'intervention
divine.

**En combat :** si le MJ l'autorise (situation et foi appropriées) : chaque Round de prière (Test
de Prière réussi) = +1 Avantage. Maximum = Bonus de Sociabilité.

Si les ennemis comprennent votre langue et connaissent/craignent votre divinité : le MJ peut
autoriser Prière à la place de la Compétence Intimidation.

**Sources RAW :** LDB 09 l.415-421

---

### Projectiles (Ct) — Avancée, Groupée
LDB 09 l.424-428

Utiliser des armes à distance spécifiques (chaque Spécialisation = un groupe d'armes). Lancer une
simple pierre sans spécialisation = Capacité de Tir nue. Sans la Spécialisation : pénalités définies
au Chapitre 11. Voir [Combat](combat.md).

**AA (armes de siège, AA l.3826-3832) :** Arbalète → Baliste ; Catapulte → groupe propre ;
Ingénierie → Poudre noire lourde. Équipe réduite = double temps de recharge + Compétence la plus
faible de l'équipe.

**Sources RAW :** LDB 09 l.424-428 ; AA l.3826-3833

---

### Ragot (Soc) — Base
LDB 09 l.431-438

Dénicher des informations utiles et répandre des rumeurs. Test réussi = renseignement utile (donné
par le MJ). Chaque DR = renseignement supplémentaire ou répandre une rumeur à Bonus de Soc individus.
Temps requis selon discrétion du groupe et densité de population (MJ).

**Sources RAW :** LDB 09 l.431-438

---

### Ramer (F) — Base
LDB 09 l.440-443

Manier une pagaie et diriger un bateau sur l'eau. Si Compétence possédée et eau calme : automatique
sans Test. Courses-poursuites, rapides, prouesses dangereuses : Test requis. Sans Compétence : Test
même pour manœuvres basiques.

**Sources RAW :** LDB 09 l.440-443

---

### Recherche (Int) — Avancée
LDB 09 l.445-457

Dénicher des connaissances utiles dans des bibliothèques et mines d'informations. Nécessite le
Talent Lire/Écrire. Si Compétence possédée et bibliothèque bien indexée : infos simples automatiques.
Pour info spécifique ou sous pression : Test étendu (Difficulté selon taille de bibliothèque, DR cible
selon obscurité du sujet). Petite bibliothèque ~5 min par Test ; grande bibliothèque ~1 h par Test ou
plus.

**Sources RAW :** LDB 09 l.445-457

---

### Représentation (Ag) — Avancée, Groupée
LDB 09 l.460-465

Arts physiquement exigeants (saltimbanque, carnaval itinérant). Test réussi = divertir les
spectateurs à portée, DR = qualité.

**En combat :** Représentation (Acrobaties) peut remplacer Esquive (accord MJ). D'autres
Spécialisations peuvent servir d'arme si équipement approprié (ex. Représentation (Cracheur de feu)).

**Sources RAW :** LDB 09 l.460-465

---

### Résistance (E) — Base
LDB 09 l.468-469

Supporter des conditions difficiles, privation, attente prolongée, environnements hostiles. Résister
ou se remettre des États (voir [États](etats.md)). Aider à récupérer des Points de Blessure perdus.

**Sources RAW :** LDB 09 l.468-469

---

### Résistance à l'alcool (E) — Base
LDB 09 l.472-487

Consommer de l'alcool sans altérer le jugement. Après chaque boisson alcoolisée : Test de Résistance
à l'alcool (modificateur selon puissance). Chaque échec : −10 à CC, CT, Ag, Dex et Int (max −30 par
Caractéristique). Si échecs = Bonus d'Endurance : Ivre.

**Table d'Ivresse (d10) :**

| d10 | Effet |
|---|---|
| 1–2 | « Bravoure du Marienburgher ! » : +20 à Calme |
| 3–4 | « Vous êtes mon meilleur ami ! » : ignorer Préjugés et Animosités |
| 5–6 | « Pourquoi est-ce que la pièce tourne ? » : Mouvement OU Action au tour, pas les deux |
| 7–8 | « Je vais tous vous prendre un par un ! » : Animosité (Tout le monde !) |
| 9–10 | « Comment je suis arrivé là ? » : réveil le lendemain avec gueule de bois ; Test de Résistance à l'alcool ou État Empoisonné |

Après 1 h sans boire : Test Intermédiaire (+0) ; effets de l'ivresse se dissipent après 10−DR heures,
modifs de Carac disparaissent. Puis gueule de bois = État Exténué, 5−DR heures non retiré.

Dépenser 1 Point de Détermination : ignorer les malus d'ivresse jusqu'à la fin du prochain Round.

**Sources RAW :** LDB 09 l.472-487

---

### Savoir (Int) — Avancée, Groupée
LDB 09 l.490-495

Étude officielle d'une branche de connaissances avancées. Si Compétence possédée : informations
utiles courantes sans Test. Pour infos spécifiques moins connues : Test de Savoir (modificateur selon
obscurité), DR = niveau de détail.

**En combat :** Test réussi possible = +1 Avantage si la spécialisation est pertinente (Géologie en
caverne, Ingénierie face à un dispositif mécanique, etc.) ; accord MJ. Maximum = Bonus d'Int.

**Sources RAW :** LDB 09 l.490-495

---

### Signes secrets (Int) — Avancée, Groupée
LDB 09 l.498-520

Utiliser des marques clandestines lisibles uniquement des membres d'un groupe sélectionné (vagabonds,
voleurs, guildes, guetteurs, etc.). Généralement sans Test si les signes sont visibles. Test requis si
signes modifiés, effacés, ou si pression temporelle. Messages très simples (3 mots max en général).

**Sources RAW :** LDB 09 l.498-520

---

### Soin aux animaux (Int) — Avancée
LDB 09 l.521-535

S'occuper des animaux malades ou blessés. Une seule Augmentation = garder les animaux en bonne santé
sans Test. Test de Soin aux animaux pour :

- Déceler une maladie.
- Comprendre désobéissance ou inconfort.
- Déterminer spécificités de l'animal.
- Guérir Bonus d'Intelligence + DR blessures (un seul lancer par rencontre).
- Stopper un État Hémorragique.
- Préparer l'animal pour une démonstration.

**En combat :** Test réussi = évaluer un animal ennemi → vous et tous informés gagnez +10 pour
toucher cet animal (ou son cavalier) jusqu'à la fin du prochain tour. Maximum +10 par animal.

**Sources RAW :** LDB 09 l.521-535

---

### Subornation (Soc) — Base
LDB 09 l.538-548

Juger si une personne peut être soudoyée et présenter le pot-de-vin de façon optimale. Test réussi =
savoir si la cible peut être corrompue. Le MJ détermine secrètement le prix (basé sur le Revenu de la
cible, honnêteté, risque). Chaque DR = estimation supplémentaire du montant cible.

**En combat :** possible pour stopper le combat, mais Test Difficile (−20) dû au stress. Inefficace
si la cible n'est pas réceptive, ne parle pas la langue, ou si les ennemis ont l'avantage du nombre.

**Sources RAW :** LDB 09 l.538-548

---

### Survie en extérieur (Int) — Base
LDB 09 l.551-565

Survivre dans la nature : pêcher, chasser, fourrager, faire un feu, construire un abri. Repérer
signes de changement de météo et traces de bêtes dangereuses.

Lors d'un campement : Test modifié par la rudesse des conditions (Intermédiaire +0 sous la pluie,
Difficile −20 en tempête). Succès = nourriture et abri pour soi, chaque DR = 1 Personnage de plus.
Échec = Test de Résistance Intermédiaire (+0) ou État Exténué. Échec Stupéfiant = événement
fâcheux (MJ).

**En combat dans la nature :** Test = +1 Avantage (comme Intuition), max Bonus d'Int.

**Option Trouver nourriture et herbes (LDB 09 l.559-565) :**
- Recherche de nourriture : succès = 1 Personnage nourri, +1 par DR.
- Chasser/pêcher (avec équipement) : succès = 2 Personnages, +2 par DR.
- Piégeage : même résultat que chasse/pêche.
- Savoir (Herbes) : succès = 1 dose de l'herbe recherchée, +1 par DR ; Difficulté selon disponibilité
  (Commune 0 / Limitée −10 / Rare −20 / Exotique −30).

**Sources RAW :** LDB 09 l.551-565

---

### Voile (Ag) — Avancée, Groupée
LDB 09 l.568-573

Piloter et manœuvrer un voilier (nœuds, gouvernail, mesure du vent, etc.). Si équipage entraîné
suffisant et conditions normales : aucun Test pour une navigation ordinaire. Test requis pour
course-poursuite, hauts-fonds dangereux, mauvaises conditions météo, etc.

Peut aussi s'utiliser pour des activités de navigation : faire des nœuds, ligoter des personnes.

Particularité : posséder une Spécialisation Voile rend toutes les autres Spécialisations de Base
pour ce personnage.

**Sources RAW :** LDB 09 l.568-573

---

## Règle optionnelle — Caractéristique alternative

**LDB 09 l.293-294 :** Pour Intimidation, le MJ peut autoriser une Caractéristique différente de F :
- Fm (ex. Répurgateur intimidant par sa foi)
- Int (ex. universitaire impressionnant un étudiant par ses connaissances)

**LDB 09 l.358 :** Pour Métier utilisé comme Savoir, le MJ peut préférer Int à Dex (souvent ignoré
pour simplifier).

**ADE II l.653 :** Pour les lanceurs ogres, Langue (Magick) utilise l'Endurance au lieu de
l'Intelligence. (Voir section dédiée.)

**Sources RAW :** LDB 09 l.293-294 ; LDB 09 l.358 ; ADE II l.653

**Implémente :** _(généré — `npm run raw:implemente`)_
- `LDB 9` (l.358) → `altCharKey`, `OPTIONAL_RULES` — `src/engine/policy.ts`, `src/engine/skills.ts`
- sans code : `LDB 9` (l.293-294)

---

## Extension ogre — Langue (Magick) sur Endurance

Les lanceurs de sorts ogres peuvent apprendre Langue (Magick) si disponible dans leur Carrière.
Cependant, la magie ogre est instinctive. **Les lanceurs ogres utilisent l'Endurance (E) au lieu de
l'Intelligence (Int) pour leur Compétence Langue (Magick).**

> « Les lanceurs de sorts ogres utilisent l'Endurance au lieu de l'Intelligence pour leur Compétence
> Langue (Magick). »
> — ADE II l.653

**Sources RAW :** ADE II l.653

**Implémente :** (non implémenté)

---

## Règle optionnelle — Filature (Discrétion + Perception)

Suivre quelqu'un discrètement = **Test Combiné Perception + Discrétion** (LDB 09 l.188-190). Si la
cible cherche activement à brouiller les pistes : opposé à Discrétion de la cible.

- Perception réussie + Discrétion échouée : on suit la cible mais on est repéré.
- Perception échouée + Discrétion réussie : on perd la cible sans être vu.

**Sources RAW :** LDB 09 l.188-190

**Voir aussi :** [Tests](tests.md) → section Tests Combinés.

---

## Applications en combat — résumé par Compétence

| Compétence | Usage combat | Détail |
|---|---|---|
| Athlétisme | Déplacement | Courir, sauter, bondir (voir Déplacement) |
| Calme | Résistance | Résister à Charme, Intimidation, Peur |
| Charme | Action/Défense | Cibles charmées n'attaquent pas ce Round, +1 Avantage |
| Commandement | Action | +10 Tests de Psy alliés ; transférer Avantages |
| Conduite d'attelage | Action | Percuter ennemis, distancer (si véhicule) |
| Corps à corps | Attaque/Parade | Compétence principale de mêlée |
| Discrétion | Préparation | Embuscade, se glisser derrière un adversaire |
| Dressage | Attaque/Défense | Opposé Dressage/FM → Peur sur animal ; remplace Corps à corps |
| Emprise sur les animaux | Action | Aucune cible affectée n'attaque ce Round, +1 Avantage |
| Escalade | Déplacement | Grimper sur de grands adversaires (risqué) |
| Escamotage | Diversion | Gagner un Avantage en tirant une dague de nulle part |
| Esquive | Défense | Résister aux attaques / éviter Dégâts |
| Guérison | Action | Tests Intermédiaires (+0) en combat |
| Intimidation | Attaque/Défense | Peur sur cibles ; remplace Corps à corps en défense |
| Intuition | Accumulation | +1 Avantage par Round, max Bonus d'Int |
| Natation | Déplacement | Remplace Athlétisme dans l'eau |
| Prière | Accumulation | +1 Avantage par Round, max Bonus de Soc ; peut remplacer Intimidation |
| Projectiles | Attaque à distance | Compétence principale de tir |
| Représentation (Acrobaties) | Défense | Peut remplacer Esquive (accord MJ) |
| Représentation (Cracheur de feu) | Attaque | Utilisable comme arme avec équipement |
| Savoir | Accumulation | +1 Avantage selon spécialisation pertinente, max Bonus d'Int |
| Soin aux animaux | Action | +10 pour toucher l'animal évalué jusqu'à la fin du prochain tour |
| Subornation | Arrêt du combat | Test Difficile (−20) pour stopper le combat |
| Survie en extérieur (nature) | Accumulation | +1 Avantage, max Bonus d'Int |

---

## Extension (T3) — Hypnotisme (Int, Avancée)

**Hypnotisme (Int) — Avancée.** Compétence de supplément (*Le Pouvoir derrière le Trône*, Annexe III), utilisée par certains Saltimbanques et Mystiques (parfois à visée médicale). Permet de mettre un Personnage en **transe** : tant qu'elle dure, la cible n'a conscience que de la voix de l'hypnotiseur, répond honnêtement, peut retrouver des souvenirs réprimés (traumatisme) ou effacés (sort), et reçoit des **suggestions inconscientes** exécutées jusqu'à la fin de la séance.

**Mise en transe** : l'attention du sujet doit rester focalisée sur l'hypnotiseur **≥ 1 minute** (voix douce et monotone, pendule facultatif). Sujet **coopératif** → Test d'Hypnotisme **simple** ; sujet récalcitrant → il peut **résister par un Test de Force Mentale**. Sur réussite, le sujet entre en transe :
- **volontaire** : reste en transe jusqu'à la fin de la séance ;
- **contraint** : a droit à un **Test de Calme par Round, opposé à l'Hypnotisme** de l'hypnotiseur ; sur un succès seulement **Minime**, il sort de la transe mais subit 1 État *Sonné*.

**Interrogatoire** : le sujet doit répondre honnêtement. Après la 1ʳᵉ question, **chaque nouvelle question = un Test d'Hypnotisme à −5 cumulatif**. Réussite → réponse honnête. **Échec Minime** → pas de réponse, reste en transe. Échec plus grave → la séance s'arrête, le sujet se réveille (1 État *Sonné* sur Échec Impressionnant, 2 sur Échec Stupéfiant).

**Suggestions post-hypnotiques** : **Test opposé Hypnotisme vs Force Mentale** du sujet. Si le sujet connaît la suggestion et la désire (p. ex. oublier un souvenir source de cauchemars/folie) → **+30** à l'hypnotiseur, mais un Test reste requis. La suggestion est poursuivie jusqu'à accomplissement, ou retrait lors d'une autre séance.

**Carrières autorisées** (au gré du MJ) : Médecin, Prêtre (dieux de guérison/vérité), Érudit, Sorcier (Gris, Lumière, + cultes de Slaanesh et Tzeentch), Espion, Sorcier de village, Mystique, Saltimbanque, Charlatan.

**Sources RAW** :
- `T3 12 l.5` — Hypnotisme = Compétence Avancée (Int) ; avertissement au MJ sur son usage.
- `T3 12 l.13-18` — transe : conditions (≥ 1 min), Test simple (coopératif) / résistance en Force Mentale ; sortie d'un sujet contraint (Calme/Round opposé ; succès Minime → *Sonné*).
- `T3 12 l.22` / `l.51` — interrogatoire : −5 cumulatif par question ; échecs (Minime = pas de réponse ; Impressionnant/Stupéfiant = réveil + 1/2 *Sonné*).
- `T3 12 l.26-28` — suggestions post-hypnotiques (Test opposé Hypnotisme/FM ; +30 si consentant).
- `T3 12 l.33-44` — carrières pouvant acquérir la Compétence.

> « L'hypnotisme est une Compétence Avancée utilisée par certains Saltimbanques et autres Mystiques. » — `T3 12 l.5`

**Voir aussi** : Tests opposés (`tests.md`), État *Sonné* (`etats.md`), Force Mentale / Calme (`psychologie.md`).
**Implémente :** (non implémenté)

---

## Bilan de fidélité

**45 Compétences transcrites** (25 de Base + 20 Avancées), conformes à LDB 09 l.49-56.

**Refs code couvertes :**
- `LDB 09 l.358` (Métier comme Savoir → Int) : couvert § Métier + § Règle optionnelle + Implémente.
- `LDB 09 l.293` (Intimidation → carac réglable) : couvert § Intimidation + § Règle optionnelle + Implémente.
- `LDB 18 l.202` (traumatisme → pénalité Langue) : hors scope de ce fichier (domaine Traumatisme) ;
  mentionné dans `testValue` via `traumaSkillPenalty`. Voir `traumatisme.md`.
- `LDB 09 l.34-45` (Compétences groupées) : couvert § Compétences Groupées + Implémente.
- `ADE II l.653` (ogre Langue Magick / Endurance) : couvert § Extension ogre.

**Écarts code ↔ RAW identifiés :**
- Aucun écart de règle détecté. La Caractéristique alternative par entité (ogre) est correctement
  portée en donnée (`SkillInstance.characteristic`) et non en sniff d'espèce dans le moteur.
- `testValue` applique correctement les 5 couches (Carac effective, Augmentations, États, Encombrement,
  Traumatisme, Passifs) conformes à LDB 09 (niveau de Compétence = Carac + Augmentations) et aux
  règles d'États/Traumatisme des chapitres 16 et 18.

**Extensions non-LDB intégrées :**
- AA : Métier (Cartographe), Métier (Explosifs), Musicien (Flûte/Tambour), Projectiles (Catapulte),
  Représentation (Parade), Savoir (Artillerie/Empire/Géographie/Guerre/Anatomie/Remèdes),
  Signes secrets (Ulric/Soleil flamboyant/Chevaliers Panthères/Ranger), Langue (Arabéen),
  Art (Écriture), Divertissement (Discours).
- ADE I : Chevaucher (Blaireau), Signes secrets (Ranger).
- ADE II : Savoir (Magie) pour fabrication d'objets magiques.
- AA/ADE I ne définissent **aucune nouvelle Compétence de base** — uniquement de nouvelles
  Spécialisations de Compétences Groupées existantes.
