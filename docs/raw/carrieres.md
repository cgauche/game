# Atlas RAW — Classes, Carrières & Statut

> Référentiel autosuffisant des règles WFRP4 (RAW). Chaque règle cite `LDB NN l.X` (source = dernier recours). Voir [`sources.md`](sources.md), [`00-index.md`](00-index.md).

Ce fichier couvre le **système de Classes et Carrières** (structure, avancement, changement) et le **Statut social** (Échelons, Standing, effets, revenus). L'index de carrières donne les 4 noms de niveau et le Statut de chaque niveau pour toutes les carrières LDB + suppléments.

**NE COUVRE PAS** : les coûts PX d'Augmentation (→ [`avancement.md`](avancement.md)), les compétences et talents disponibles par niveau (→ [`competences.md`](competences.md), [`talents.md`](talents.md)), les détails par niveau (compétences/talents/possessions de chaque niveau) = catalogue volumineux à transcrire séparément (présent dans `src/data/careerLevels.json`).

## Sommaire

- [Classes](#classes)
- [Structure d'une Carrière](#structure-dune-carrière)
- [Avancement au sein d'une Carrière](#avancement-au-sein-dune-carrière)
- [Compléter un Niveau de Carrière](#compléter-un-niveau-de-carrière)
- [Changer de Carrière](#changer-de-carrière)
- [Carrières hors classe et changements alternatifs](#carrières-hors-classe-et-changements-alternatifs)
- [Statut](#statut)
  - [Échelons et Standing](#échelons-et-standing)
  - [Effets du Statut](#effets-du-statut)
  - [Gagner de l'argent](#gagner-de-largent)
  - [Table de revenus (verbatim)](#table-de-revenus-verbatim)
- [Index des carrières](#index-des-carrières)
  - [LDB — 8 Classes (64 carrières)](#ldb--8-classes-64-carrières)
  - [Suppléments](#suppléments)

---

## Classes

> « WFJDR regroupe les Carrières similaires en Classes. »
> — LDB 06 l.14

Les 8 Classes du LDB (avec renvois source) :

| Classe | Source LDB (page) |
|---|---|
| **Citadins** | p. 53 |
| **Courtisans** | p. 61 |
| **Guerriers** | p. 69 |
| **Itinérants** | p. 77 |
| **Lettrés** | p. 85 |
| **Riverains** | p. 93 |
| **Roublards** | p. 101 |
| **Ruraux** | p. 109 |

Les Classes ont plusieurs rôles (LDB 06 l.18-19) :
- Regrouper les Carrières similaires.
- Influencer le changement de Carrière (même classe = 100 PX vs classe différente = +100 PX de surcoût).
- Certaines Classes donnent accès à des Activités spécifiques entre deux aventures.

**Sources RAW** : `LDB 06 l.14-24`

---

## Structure d'une Carrière

> « Chaque Carrière possède quatre Niveaux, chacun étant meilleur que le précédent. »
> — LDB 07 l.26

Chaque Carrière est structurée ainsi (LDB 07 l.151-171) :

- **Nom** : nom de la Carrière.
- **Restriction** : Races qui embrassent généralement la Carrière.
- **Résumé** : une phrase de présentation.
- **Description** : 1-2 paragraphes.
- **Schéma de Progression** : les 10 Caractéristiques avec marqueurs par niveau (h = Niveau 1, ◆ cuivré = N2, ◆ argenté = N3, ◆ or = N4).
- **Évolution de Carrière** : pour chacun des 4 niveaux — Nom de niveau, Statut, Compétences, Talents, Possessions.

### Les 4 niveaux

Un Personnage démarre **toujours au Niveau 1** de la Carrière choisie (LDB 07 l.35).

**Schéma de Progression** (LDB 07 l.41-44) :

- Niveau 1 : les 3 Caractéristiques marquées h.
- Niveau 2 : + la Caractéristique ◆ cuivré.
- Niveau 3 : + la Caractéristique ◆ argenté.
- Niveau 4 : + la Caractéristique ◆ or.

Les Augmentations de Caractéristique des niveaux précédents restent disponibles aux niveaux supérieurs (cumul).

### Emplacements « Au choix »

Quand une entrée de Compétence ou Talent porte « (Au choix) », le joueur choisit la spécialisation au moment où il alloue une Augmentation (LDB 09 l.40). Au sein d'une même Carrière, deux slots ne peuvent pas être désignés sur le même libellé concret.

**Jokers restreints** : « (Fléau ou À deux mains) » = uniquement les specs listées.

**Sources RAW** : `LDB 07 l.26-164` + `LDB 09 l.34-45` (compétences groupées) + `LDB 10 l.14-20` (talents à spécialisations).  
**Refs code** : `src/engine/careerSlots.ts l.1-21` (commentaires RAW sur l'accumulation des compétences par niveaux ≤ courant et les talents du niveau courant uniquement) ; `l.153-156` (`skillSlots` cumul LDB 07 l.76) ; `l.158-162` (`talentSlots` niveau courant uniquement LDB 07 l.103).

---

## Avancement au sein d'une Carrière

> « Chaque Carrière propose trois formes d'Augmentation : Augmentation de Caractéristique, Augmentation de Compétence et Augmentation de Talent. »
> — LDB 07 l.37

### Compétences disponibles

- Le joueur peut Augmenter les Compétences de son niveau **et de tous les niveaux précédents** (LDB 07 l.76).
- La Compétence en italique au Niveau 1 est celle utilisée pour « Gagner de l'argent » (LDB 07 l.84).

### Talents disponibles

- Les Talents ne sont disponibles **qu'au niveau de Carrière où ils sont indiqués** — pas ceux des niveaux précédents (LDB 07 l.103).
- Coût : 100 PX + 100 PX par fois où le Talent a déjà été pris (LDB 07 l.106).
- Certains Talents ne peuvent pas être pris plusieurs fois (voir description du Talent).

### Augmentations hors Carrière

- Coût doublé pour Caractéristiques et Compétences hors Carrière (LDB 07 l.90-91).
- Les Talents hors Carrière ne peuvent normalement pas être achetés avec des PX (sauf Activités Entraînement / Apprentissage particulier, LDB 07 l.93).

**Sources RAW** : `LDB 07 l.36-110`

---

## Compléter un Niveau de Carrière

Pour **compléter** un Niveau de Carrière et débloquer le changement à 100 PX (LDB 07 l.121-133) :

- Avoir acquis le nombre d'Augmentations ci-dessous dans toutes les Caractéristiques disponibles et **huit** des Compétences disponibles à ce niveau.
- Posséder **au moins un Talent** de ce niveau.

| Niveau | Augmentations requises |
|---|---|
| 1 | 5 |
| 2 | 10 |
| 3 | 15 |
| 4 | 20 |

> Remarque : achever un niveau n'oblige pas à en changer. On peut rester indéfiniment au Niveau 1.

**Sources RAW** : `LDB 07 l.121-133`

---

## Changer de Carrière

### Coûts

| Action | Carrière achevée | Carrière non achevée |
|---|---|---|
| Passer au niveau suivant (ou inférieur) de la même Carrière | 100 PX | — |
| Commencer le Niveau 1 d'une autre Carrière **même Classe** | 100 PX | 200 PX |
| Commencer le Niveau 1 d'une autre Carrière **Classe différente** | 200 PX | 300 PX |
| Accéder au **même Niveau** d'une autre Carrière même Classe (accord MJ requis) | 100 PX | — |

Source : LDB 07 l.136-137 (changement de niveau), l.9-16 (changement de Carrière).

> Remarque : il est possible de **sauter des niveaux** avec accord du MJ (justifié par les événements de jeu). Coût = 100 PX si achevé, 200 PX sinon (LDB 08 l.1-2).

**Sources RAW** : `LDB 07 l.112-139` + `LDB 08 l.1-30`

---

## Carrières hors classe et changements alternatifs

Le MJ peut proposer un **changement de Carrière inattendu** en cours de partie (Garde d'Honneur, Hors-la-loi forcé, etc.) — fortement recommandé pour lier les choix de Carrière aux événements (LDB 08 l.5-5).

Entre deux aventures, l'Activité **Changement de Carrière** (LDB p. 197) permet aussi de changer.

**Nouvelle règle (Middenheim ANN.II)** : certaines Carrières comme Frère Loup peuvent proposer plus de 8 Compétences au premier Niveau. Il suffit d'en augmenter 8 pour passer au niveau suivant, mais la Compétence en italique (Gagner de l'argent) **doit** être augmentée.

**Sources RAW** : `LDB 08 l.5-5` + `Middenheim ANN.II l.93-94`

---

## Statut

> « Le Vieux Monde est particulièrement hiérarchisé. »
> — LDB 08 l.5

### Échelons et Standing

Le Statut = **Échelon** (Bronze / Argent / Or) + **Standing** (chiffre, généralement 1-5) (LDB 08 l.9).

- Échelon supérieur → Statut supérieur (indépendamment du Standing).
- Même Échelon → Standing supérieur = Statut supérieur.

**Les trois Échelons** (LDB 08 l.15-23) :

| Échelon | Profil social |
|---|---|
| **Or** | Dirigeants, conseillers directs, protecteurs de l'ordre, riches. Tous riches et très respectés. |
| **Argent** | Professions qualifiées, commerçants, artisans, marchands, prestataires de service. Vie humble mais respectable. |
| **Bronze** | Paysans, professions sans compétence particulière, criminels, sans-abri. |

### Détermination du Statut

Le Statut est indiqué **à côté du nom de chaque Niveau de Carrière** (ex. « Bronze 3 », « Argent 1 ») et change automatiquement lors d'un changement de Carrière (LDB 08 l.25-26).

**Causes de changement de Statut** (LDB 08 l.30-34) :
1. Changement de Carrière.
2. Talent qui modifie le Statut.
3. Décision du MJ liée aux événements de jeu.

### Conserver son Statut

- Agir en adéquation avec son rôle social est requis pour bénéficier du Statut (LDB 08 l.86-91).
- Passer incognito = Statut Bronze 3 par défaut.
- Ne pas maintenir son train de vie → perte de 1 Standing par semaine (LDB 08 l.94-103).
- Si Standing atteint 0 : l'Échelon baisse de 1, Standing remonte à 5 (LDB 08 l.101).

### Effets du Statut

| Compétence sociale | Effet |
|---|---|
| **Charme** | Échelon supérieur → +10 ; Échelon inférieur → -10 (LDB 08 l.53-58). |
| **Intimidation** | Statut supérieur → +10 (LDB 08 l.73). |
| **Ragot** | Échelons différents → -10 (LDB 08 l.76-77). |
| **Commandement** | 1 Échelon au-dessus → +10 ; 2 Échelons au-dessus → +20 (LDB 08 l.81-83). |
| **Divertissement** | Le Statut n'influe pas directement (LDB 08 l.65-69). |

**Réaction aléatoire des PNJ au Statut** (LDB 08 l.24-29) :

| 1d10 | Réaction |
|---|---|
| 1-2 | Brave le Statut : ignore les effets du Statut. |
| 3-8 | Réactions classiques : suit les règles normales. |
| 9-10 | Opinions extrêmes : modifier les Tests liés au Statut de ±10. |

**Sources RAW** : `LDB 08 l.5-103`

---

### Gagner de l'argent

Pour Gagner de l'argent (LDB 08 l.107-122), le Personnage passe une semaine à travailler sa Carrière (accord MJ, lieu approprié) :

- Test **Spectaculaire Accessible (+20)** contre la Compétence de Carrière en italique.
- Succès → somme pleine ; Échec → moitié ; Échec Stupéfiant (-6 DR) → rien.

### Table de revenus (verbatim)

Source : LDB 08 l.115

| Échelon | Somme gagnée **par Standing** |
|---|---|
| Bronze | 2d10 sous de cuivre |
| Argent | 1d10 pistoles d'argent |
| Or | 1 couronne d'or |

> La même somme s'applique à l'Activité *Revenus* (LDB p. 199).

**Sources RAW** : `LDB 08 l.106-122`

---

## Index des carrières

Format des colonnes : **Carrière | Classe | Niveau 1 (Statut) | Niveau 2 (Statut) | Niveau 3 (Statut) | Niveau 4 (Statut) | Source**

> **Note** : Les détails par niveau des carrières (compétences/talents/possessions) = catalogue volumineux à transcrire séparément (présent dans `src/data/careerLevels.json`).

### LDB — 8 Classes (64 carrières)

#### Classe : Citadins

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Agitateur** | Pamphlétaire (Bronze 1) | Agitateur (Bronze 2) | Fauteur de Troubles (Bronze 3) | Démagogue (Bronze 5) |
| **Artisan** | Apprenti Artisan (Bronze 2) | Artisan (Argent 1) | Maître Artisan (Argent 3) | Maître de Guilde (Or 1) |
| **Bourgeois** | Employé (Argent 1) | Bourgeois (Argent 2) | Conseiller Municipal (Argent 5) | Bourgmestre (Or 1) |
| **Enquêteur** | Limier (Argent 1) | Enquêteur (Argent 2) | Maître Enquêteur (Argent 3) | Détective (Argent 5) |
| **Marchand** | Négociant (Argent 2) | Marchand (Argent 5) | Maître Marchand (Or 1) | Prince Marchand (Or 3) |
| **Mendiant** | Indigent (Bronze 0) | Mendiant (Bronze 2) | Maître Mendiant (Bronze 4) | Roi des Mendiants (Argent 2) |
| **Milicien** | Recrue de la Milice (Bronze 3) | Milicien (Argent 1) | Sergent de la Milice (Argent 3) | Capitaine de la Milice (Or 1) |
| **Ratier** | Chasseur de Rat (Bronze 3) | Ratier (Argent 1) | Égoutier (Argent 2) | Exterminateur (Argent 3) |

#### Classe : Courtisans

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Artiste** | Artiste Apprenti (Argent 1) | Artiste (Argent 3) | Artiste de Renom (Argent 5) | Maestro (Or 2) |
| **Conseiller** | Assistant (Argent 2) | Conseiller (Argent 4) | Consultant (Or 1) | Chancelier (Or 3) |
| **Duelliste** | Escrimeur (Argent 3) | Duelliste (Argent 5) | Maître Duelliste (Or 2) | Champion de Justice (Or 4) |
| **Émissaire** | Héraut (Argent 2) | Émissaire (Argent 4) | Diplomate (Or 1) | Ambassadeur (Or 2) |
| **Espion** | Informateur (Bronze 3) | Espion (Argent 3) | Agent Secret (Or 1) | Maître Espion (Or 4) |
| **Intendant** | Gardien (Argent 1) | Intendant (Argent 3) | Sénéchal (Or 1) | Gouverneur (Or 3) |
| **Noble** | Héritier (Or 1) | Noble (Or 3) | Magnat (Or 5) | Noble Seigneur (Or 7) |
| **Serviteur** | Domestique (Argent 1) | Serviteur (Argent 3) | Valet (Argent 5) | Régisseur (Or 1) |

#### Classe : Guerriers

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Cavalier** | Apprenti Cavalier (Argent 2) | Cavalier (Argent 4) | Sergent de Cavalerie légère (Or 1) | Officier de Cavalerie Légère (Or 2) |
| **Chevalier** | Écuyer (Argent 3) | Chevalier (Argent 5) | Chevalier Commandeur (Or 2) | Chevalier du Cercle Intérieur (Or 4) |
| **Garde** | Sentinelle (Argent 1) | Garde (Argent 2) | Garde d'Honneur (Argent 3) | Garde Officier (Argent 5) |
| **Gladiateur** | Pugiliste (Bronze 4) | Gladiateur (Argent 2) | Champion de Fosse (Argent 5) | Légende de la Fosse (Or 2) |
| **Prêtre Guerrier** | Novice (Argent 1) | Prêtre Guerrier (Argent 3) | Prêtre Sergent (Argent 5) | Prêtre Capitaine (Or 1) |
| **Soldat** | Recrue (Bronze 3) | Soldat (Argent 1) | Sergent (Argent 3) | Officier (Argent 5) |
| **Spadassin** | Matamore (Bronze 2) | Spadassin (Argent 1) | Tueur à Gages (Argent 4) | Assassin (Or 1) |
| **Tueur** *(Nain seul)* | Tueur de Trolls (Bronze 2) | Tueur de Géants (Bronze 2) | Tueur de Dragons (Bronze 2) | Tueur de Démons (Bronze 2) |

#### Classe : Itinérants

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Chasseur de Primes** | Chasseur de Voleurs (Bronze 1) | Chasseur de Primes (Bronze 4) | Maître Chasseur de Primes (Argent 2) | Chasseur de Primes Vétéran (Argent 5) |
| **Cocher** | Postillon (Bronze 2) | Cocher (Argent 1) | Maître Cocher (Or 1) | Maître des Routes (Or 2) |
| **Colporteur** | Vagabond (Bronze 1) | Colporteur (Bronze 4) | Maître Colporteur (Argent 2) | Négociant Itinérant (Argent 5) |
| **Flagellant** | Zélote (Bronze 0) | Flagellant (Bronze 0) | Pénitent (Bronze 0) | Prophète du Destin (Bronze 0) |
| **Messager** | Coureur (Bronze 3) | Messager (Argent 1) | Estafette (Argent 3) | Messager Vétéran (Argent 5) |
| **Patrouilleur Routier** | Péager (Bronze 0) | Patrouilleur Routier (Bronze 0) | Sergent Patrouilleur (Argent 1) | Capitaine Patrouilleur (Argent 3) |
| **Répurgateur** | Interrogateur (Argent 1) | Répurgateur (Argent 3) | Inquisiteur (Argent 5) | Répurgateur Vétéran (Or 1) |
| **Saltimbanque** | Musicien de Rues (Bronze 3) | Saltimbanque (Bronze 5) | Troubadour (Argent 3) | Chef de Troupe (Or 1) |

#### Classe : Lettrés

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Apothicaire** | Apprenti Apothicaire (Bronze 3) | Apothicaire (Argent 1) | Maître Apothicaire (Argent 3) | Apothicaire de Renom (Or 1) |
| **Érudit** | Étudiant (Bronze 3) | Érudit (Argent 2) | Chercheur (Argent 5) | Professeur (Or 1) |
| **Ingénieur** | Étudiant Ingénieur (Bronze 4) | Ingénieur (Argent 2) | Maître Ingénieur (Argent 4) | Ingénieur Agréé (Or 2) |
| **Juriste** | Étudiant en Droit (Bronze 4) | Juriste (Argent 3) | Maître du Barreau (Or 1) | Juge (Or 2) |
| **Médecin** | Étudiant en Médecine (Bronze 1) | Médecin (Bronze 4) | Docteur en Médecine (Argent 2) | Médecin de la Cour (Argent 5) |
| **Nonne** | Novice (Bronze 2) | Nonne (Argent 1) | Abbesse (Or 1) | Prieure Générale (Or 2) |
| **Prêtre** | Initié (Bronze 3) | Prêtre (Argent 3) | Grand Prêtre (Or 1) | Lecteur (Or 2) |
| **Sorcier** | Sorcier Novice (Argent 1) | Sorcier (Argent 2) | Maître Sorcier (Or 1) | Seigneur Sorcier (Or 3) |

#### Classe : Riverains

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Batelier** | Canotier (Bronze 2) | Batelier (Argent 1) | Chef de Bord (Or 1) | Capitaine (Or 2) |
| **Contrebandier** | Coureur de Rivières (Bronze 3) | Contrebandier (Argent 1) | Maître Contrebandier (Argent 3) | Roi des Contrebandiers (Argent 5) |
| **Débardeur** | Porteur (Bronze 2) | Débardeur (Bronze 3) | Contremaître (Bronze 5) | Maître des Docks (Argent 2) |
| **Femme du Fleuve** | Alevin (Bronze 3) | Femme du Fleuve (Argent 1) | Sage des Rives (Argent 3) | Ancienne du Fleuve (Argent 5) |
| **Marin** | Marin d'Eau Douce (Argent 1) | Marin (Argent 3) | Maître d'Équipage (Argent 5) | Capitaine de Navire (Or 2) |
| **Naufrageur** | Pilleur d'Épaves (Bronze 2) | Naufrageur (Bronze 3) | Pirate des Rivières (Bronze 5) | Capitaine Naufrageur (Argent 2) |
| **Nautonier** | Guide Fluvial (Bronze 4) | Nautonier (Agent 1*) | Pilote (Argent 3) | Maître Nocher (Argent 5) |
| **Patrouilleur Fluvial** | Recrue Fluviale (Argent 1) | Patrouilleur Fluvial (Argent 2) | Abordeur (Argent 3) | Maître Abordeur (Argent 1†) |

> *Typo dans `careerLevels.json` : « Agent 1 » pour Nautonier N2 (doit être Argent 1 — ne pas corriger en code sans vérification source). †Maître Abordeur N4 : `"status": "Argent 1"` dans les données — à confirmer.

#### Classe : Roublards

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Charlatan** | Filou (Bronze 3) | Charlatan (Bronze 5) | Arnaqueur (Argent 2) | Escroc (Argent 4) |
| **Entremetteur** | Prostitué (Bronze 2) | Entremetteur (Bronze 3) | Souteneur (Argent 1) | Meneur (Argent 5) |
| **Hors-la-loi** | Bandit (Bronze 1) | Hors-la-loi (Bronze 2) | Chef de Bande (Bronze 4) | Roi des Bandits (Argent 2) |
| **Pilleur de Tombes** | Trafiquant de Cadavres (Bronze 2) | Pilleur de Tombes (Bronze 3) | Pilleur de Tombeaux (Argent 1) | Chasseur de Trésors (Argent 5) |
| **Rançonneur** | Coupe-Jarret (Bronze 1) | Rançonneur (Bronze 2) | Chef de Gang (Bronze 3) | Baron du Crime (Bronze 5) |
| **Receleur** | Brocanteur (Argent 1) | Receleur (Argent 2) | Maître Receleur (Argent 3) | Professionnel du Marché Noir (Argent 1†) |
| **Sorcier Dissident** | Ensorceleur (Bronze 1) | Sorcier Dissident (Bronze 3) | Devin (Argent 1) | Démoniste (Argent 3) |
| **Voleur** | Rôdeur (Bronze 1) | Voleur (Bronze 3) | Maître Voleur (Bronze 5) | Cambrioleur (Argent 3) |

> †Receleur N4 : `"status": "Argent 1"` dans les données — le Roi des Mendiants est Argent 2, ce qui semble cohérent ; le Professionnel du Marché Noir à Argent 1 paraît bas, à confirmer sur la source.

#### Classe : Ruraux

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) |
|---|---|---|---|---|
| **Bailli** | Percepteur (Argent 1) | Bailli (Argent 5) | Préfet (Or 1) | Magistrat (Or 3) |
| **Chasseur** | Traqueur (Bronze 2) | Chasseur (Bronze 4) | Pisteur (Argent 1) | Maître de la Chasse (Argent 3) |
| **Éclaireur** | Coureur des Bois (Bronze 2) | Éclaireur (Bronze 4) | Guide (Bronze 5) | Explorateur (Argent 4) |
| **Herboriste** | Cueilleur (Bronze 1) | Herboriste (Bronze 2) | Maître Herboriste (Bronze 3) | Herboriste de Renom (Bronze 4) |
| **Mineur** | Prospecteur (Bronze 2) | Mineur (Bronze 3) | Maître Mineur (Bronze 4) | Contremaître de la Mine (Argent 2) |
| **Mystique** | Voyant (Bronze 3) | Mystique (Argent 2) | Sage (Argent 5) | Prophète (Or 1) |
| **Sorcier de Village** | Apprenti Sorcier de Village (Bronze 1) | Sorcier de Village (Bronze 2) | Maître Sorcier de Village (Bronze 3) | Sage de Village (Bronze 4) |
| **Villageois** | Paysan (Bronze 2) | Villageois (Bronze 3) | Échevin (Bronze 4) | Doyen (Argent 2) |

---

### Suppléments

#### ADE I — Archives de l'Empire Vol. 1 (source : `ADE1 p.88-92`)

Ces carrières suivent les règles habituelles. Elles peuvent être choisies à la création ou lors d'un changement de Carrière.

| Carrière | Races | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|---|
| **Chevaucheur de Blaireau** | Halfling (Moot) | Taquineur de Blaireau (Argent 1) | Chevaucheur de Blaireau (Argent 3) | Sergent Blaireau (Argent 5) | Maître Blaireau (Or 1) | Guerriers |
| **Gardechamps** | Halfling | Garde Novice (Bronze 4) | Gardechamps (Argent 1) | Sergent Gardechamps (Argent 3) | Capitaine Gardechamps (Argent 5) | Itinérants |
| **Patrouilleur des Karak** | Nain | Coureur des Forts (Bronze 3) | Patrouilleur des Karak (Argent 1) | Gardien des Routes des Karak (Argent 2) | Arpenteur des Karak (Argent 4) | Itinérants |
| **Rôdeur Fantôme** | Elfe Sylvain | Garde Forestier (Bronze 3) | Rôdeur Fantôme (Bronze 5) | Esprit du Vent (Argent 1) | Courroux de la Forêt (Argent 3) | Itinérants |

**Conditions d'accès** :
- **Chevaucheur de Blaireau** : Halfling du Mootland uniquement + doit imiter le cri de guerre du blaireau 😄. Sur tirage aléatoire Soldat → peut choisir Chevaucheur de Blaireau à la place.
- **Gardechamps** : Halfling. Sur tirage aléatoire Patrouilleur Routier → peut choisir Gardechamps.
- **Patrouilleur des Karak** : Nain. Sur tirage aléatoire Messager → peut choisir Patrouilleur des Karak.
- **Rôdeur Fantôme** : Elfe Sylvain. Sur tirage aléatoire Chasseur de Primes → peut choisir Rôdeur Fantôme.

#### ADE II — Archives de l'Empire Vol. 2 (source : `ADE2 p.35`)

| Carrière | Races | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|---|
| **Mangeur d'Hommes** | Ogre | Chair Fraîche (Bronze 3) | Mangeur d'Hommes (Argent 2) | Broyeur d'Hommes (Argent 5) | Capitaine Mangeur d'Hommes (Or 1) | Guerriers |
| **Boucher Ogre** | Ogre | Faiseur de Bouillie (Bronze 3) | Boucher Ogre (Argent 2) | Sage de la Gueule (Argent 5) | Maître Massacreur (Or 1) | Lettrés |

> Ces deux carrières sont ogres-exclusives. Les profils ogres viennent d'ADE II (chap. 2).

ADE II contient également les carrières militaires de la série **Aux Armes (AA)** intégrées dans `src/data/careerLevels.json` :

| Carrière | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|
| **Archer** | Tireur à l'Arc (Argent 1) | Archer (Argent 2) | Sergent Archer (Or 1) | Capitaine Archer (Or 2) | Guerriers |
| **Arquebusier** | Recrue Arquebusier (Bronze 2) | Arquebusier (Bronze 3) | Sergent Arquebusier (Argent 1) | Capitaine Arquebusier (Argent 5) | Guerriers |
| **Artilleur** | Apprenti Artilleur (Bronze 3) | Artilleur (Argent 2) | Capitaine Artilleur (Argent 4) | Maître Artilleur (Or 2) | Guerriers |
| **Cartographe** | Arpenteur (Bronze 4) | Cartographe (Argent 3) | Cartographe Reconnu (Or 1) | Maître Cartographe (Or 2) | Lettrés |
| **Cavalier Léger** | Cavalier (Bronze 3) | Cavalier Léger (Argent 2) | Cavalier Léger Lancier (Argent 5) | Capitaine Cavalier Léger (Or 1) | Guerriers |
| **Chevalier du Loup Blanc** | Novice (Argent 1) | Chevalier du Loup Blanc (Argent 2) | Sergent Templier (Or 1) | Commandant de Compagnie (Or 3) | Guerriers |
| **Chevalier du Soleil Flamboyant** | Novice (Argent 3) | Chevalier du Soleil Flamboyant (Argent 5) | Hochmeister (Or 2) | Chevalier du Cercle Intérieur (Or 4) | Guerriers |
| **Chevalier Errant** | Écuyer (Argent 1) | Chevalier Errant (Argent 2) | Capitaine Indépendant (Or 1) | Chevalier Commandant (Or 3) | Guerriers |
| **Chevalier Panthère** | Écuyer (Argent 3) | Chevalier Panthère (Argent 5) | Chevalier Commandeur (Or 2) | Commandant de Compagnie (Or 4) | Guerriers |
| **Gardien de Troupeaux de Rhinox** | Voleur de Rhinox (Argent 1) | Gardien de Troupeaux de Rhinox (Argent 3) | Dompteur de Rhinox (Argent 5) | Maître des Rhinox (Or 1) | Ruraux |
| **Hallebardier** | Recrue Hallebardier (Bronze 3) | Hallebardier (Argent 1) | Sergent Hallebardier (Argent 3) | Capitaine Hallebardier (Argent 5) | Guerriers |
| **Joueur d'Épée** | Cadet Joueur d'Épée (Argent 3) | Joueur d'Épée (Argent 5) | Sergent Joueur d'Épée (Or 2) | Capitaine Joueur d'Épée (Or 4) | Guerriers |
| **Piquier** | Recrue (Bronze 2) | Piquier (Bronze 3) | Chef de File (Bronze 4) | Capitaine d'Étendard (Argent 2) | Guerriers |
| **Prêtre de Myrmidia** | Premier Aigle (Argent 3) | Prêtre de Myrmidia (Argent 5) | Prêtre Sergent (Or 2) | Prêtre Capitaine (Or 4) | Lettrés |
| **Spécialiste de Siège** | Arbalétrier (Bronze 4) | Spécialiste de Siège (Argent 3) | Sapeur (Or 1) | Maître de Siège (Or 2) | Guerriers |
| **Suiveur de Camp** | Ribaud (Bronze 1) | Suiveur de Camp (Bronze 2) | Pillard Chevronné (Bronze 3) | Chef de Camp (Bronze 4) | Itinérants |

#### Middenheim — Cité du Loup Blanc (source : `Middenheim ANN.II l.275-311`)

| Carrière | Races | N1 (Statut) | N2 (Statut) | N3 (Statut) | N4 (Statut) | Classe |
|---|---|---|---|---|---|---|
| **Frère Loup** | Humain | Survivant (Bronze 0) | Frère Loup (Bronze 0) | Compagnon Loup (Bronze 0) | Grand Loup (Bronze 0) | Itinérants |

**Conditions d'accès** : Humain originaire du nord de l'Empire. Sur tirage aléatoire pour les Middenheimers (66-68), Middenlanders (59-60) et Nordlanders (57-58). Un Personnage qui tire Frère Loup peut à la place choisir Flagellant.

**Règle spéciale** : le Frère Loup propose plus de 8 Compétences au Niveau 1 (10 compétences). Il suffit d'en augmenter 8, mais la Compétence en italique (*Survie en extérieur*) **doit** être augmentée pour compléter le niveau.

**Note** : Un Personnage qui gagne Frère Loup + Noblesse peut renoncer au Talent Noblesse pour devenir Enfant d'Ulric (option très puissante — accord MJ requis).

Middenheim introduit aussi 3 origines humaines supplémentaires (Middenheimer, Middenlander, Nordlander) avec tables de tirage de Carrière et compétences/talents d'origine distincts des Reiklanders (voir `Middenheim ANN.II`).

---

## Bilan

- **Système** : couvert (Classes, structure des 4 niveaux, Schéma de Progression, emplacements Au choix, avancement, hors-carrière, complétion, changement de Carrière avec tous les coûts).
- **Statut** : couvert (Échelons Bronze/Argent/Or, Standing, effets sociaux par compétence, réactions PNJ, conserver les apparences, table de revenus verbatim).
- **Carrières indexées** :
  - LDB : 64 carrières (8 par classe × 8 classes), noms des 4 niveaux + Statut de chaque niveau.
  - ADE I : 4 carrières raciales (Chevaucheur de Blaireau, Gardechamps, Patrouilleur des Karak, Rôdeur Fantôme).
  - ADE II / AA : 18 carrières supplémentaires (Mangeur d'Hommes, Boucher Ogre, + 16 militaires/ordres).
  - Middenheim : 1 carrière (Frère Loup), 3 origines humaines.
- **Refs code couvertes** : `src/engine/careerSlots.ts` — accumulation de compétences (`skillSlots` l.153-156), talents du niveau courant uniquement (`talentSlots` l.158-162), emplacements Au choix (`parseEntry`, `wildcardSpecs`), maxi talent (`talentMaxById`).
- **Détails par niveau des carrières (compétences/talents/possessions) = catalogue volumineux à transcrire séparément (présent dans `src/data/careerLevels.json`).**
- **Anomalies données** : typo « Agent 1 » pour Nautonier N2 dans `careerLevels.json` (ligne 15499) ; Receleur N4 et Patrouilleur Fluvial N4 avec Argent 1 semblent inattendus — à vérifier contre la source LDB p. 101+.
