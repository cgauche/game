# Atlas RAW — Activités & Événements (Entre deux aventures)

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](sources.md).

---

## Sommaire

- [Cadre général « Entre deux aventures »](#cadre-général-entre-deux-aventures)
- [Tableau des Événements (d100)](#tableau-des-événements-d100)
- [Argent à gaspiller](#argent-à-gaspiller)
- [Devoirs et Responsabilités](#devoirs-et-responsabilités)
  - [Avec le pouvoir (Niveaux 3-4)](#avec-le-pouvoir-niveaux-3-4)
  - [Amélioration Elfique / Prestige Elfique](#amélioration-elfique--prestige-elfique)
- [Activités Répandues (LDB 23)](#activités-répandues-ldb-23)
  - [Apprentissage Particulier](#apprentissage-particulier)
  - [Artisanat](#artisanat)
  - [Changement de Carrière](#changement-de-carrière)
  - [Consulter Un Expert](#consulter-un-expert)
  - [Dressage](#dressage)
  - [Entraînement](#entraînement)
  - [Faites-moi une Faveur !](#faites-moi-une-faveur-)
  - [Invention !](#invention-)
  - [Opérations Bancaires](#opérations-bancaires)
  - [Passer Commande](#passer-commande)
  - [Revenus](#revenus)
- [Activités de Classe (LDB 23)](#activités-de-classe-ldb-23)
  - [Dernières Nouvelles (Itinérants, Riverains)](#dernières-nouvelles-itinérants-riverains)
  - [Entraînement au Combat (Guerriers, Itinérants)](#entraînement-au-combat-guerriers-itinérants)
  - [Observer Une Cible (Roublards)](#observer-une-cible-roublards)
  - [Recherche de Savoir (Lettrés)](#recherche-de-savoir-lettrés)
  - [Réputation (Citadins, Courtisans, Lettrés)](#réputation-citadins-courtisans-lettrés)
  - [Semer la Dissension (Citadins, Ruraux)](#semer-la-dissension-citadins-ruraux)
- [Activités de Guerrier — AA Annexe II](#activités-de-guerrier--aa-annexe-ii)
- [Activités de Bataille — ADE II ch.8](#activités-de-bataille--ade-ii-ch8)
- [Activités de Voyage — EDOC ch.5](#activités-de-voyage--edoc-ch5)
- [Nouvelle Activité : Convalescence — ADE II Annexe I](#nouvelle-activité--convalescence--ade-ii-annexe-i)
- [Règles optionnelles connexes](#règles-optionnelles-connexes)
- [Voir aussi](#voir-aussi)
- [Implémente](#implémente)

---

## Cadre général « Entre deux aventures »

**Source :** LDB 22 l.3-5, LDB 23 l.1-11.

> « Cela peut prendre plusieurs séances de jeu, mais finalement toutes les aventures s'achèvent. Vous
> pouvez alors passer plusieurs semaines durant lesquelles votre Personnage n'a plus rien à faire avant
> le début de la prochaine aventure. »

Séquence obligatoire :

1. **Lancer 1d100** sur le Tableau des Événements (un tirage par Personnage — LDB 22 l.5).
2. **Dépenser l'argent** de la dernière aventure (voir *Argent à gaspiller*).
3. **Choisir les Activités** (max 1/semaine, max 3 au total — LDB 23 l.5).
4. **Résoudre les conséquences** avant la prochaine aventure.

> « Chaque règle de ce chapitre est optionnelle. » — LDB 22 l.14.

**Règle maison recommandée :** la règle optionnelle peut être désactivée entièrement (flag `interlude-enabled`, `src/engine/policy.ts` l.333-339).

---

## Tableau des Événements (d100)

**Source :** LDB 22 l.11-135.

Lancer **1d100** par Personnage. Certains événements n'affectent que le Personnage tirant, d'autres le groupe entier.

| d100 | Événement | Mécanique clé |
|------|-----------|---------------|
| 01–03 | **Allié Inculpé** | Savoir (Loi) Accessible (+20) = 1 Activité ; ou 3 Activités groupe = disculpé. Succès → Faveur Majeure. Échec → allié pendu. |
| 04–06 | **Enchères Ésotériques** | Payer 10 CO → vieux livre ; Lettrés : +20 aux Tests *Recherche de Savoir*. |
| 07–10 | **Trahison !** | Un ami/parent/allié se retourne. Influence la prochaine aventure. |
| 11–14 | **Imprévu** | Monture enfuie → Dressage (Cheval) Accessible (+20). Échec = monture perdue. Sans monture : ampoule (cosmétique). |
| 15–18 | **Eh ! Tu as Renversé Ma Pinte !** | Conflit local, un PNJ cherche vengeance. |
| 19–21 | **Répression du Crime** | Voleurs : aucun Revenu liquide ; Opérations Bancaires → dépôt Haut Risque uniquement. |
| 22–25 | **Le Prévôt Arrive** | Tous perdent **30 %** de leur argent avant les Activités. |
| 26–29 | **Fausse Monnaie** | 1/5 des pièces concerné. Opérations Bancaires : −20 % de l'argent placé ; Revenus : −20 %. |
| 30–33 | **Profits Abondants** | Riverains : +50 % sur l'Activité *Revenus*. |
| 34–36 | **Un Homme Averti En Vaut Deux** | Présage cryptique : **+1 Point de Chance max** pour la prochaine aventure. |
| 37–40 | **Festivités** | Perd **1 Activité** (fête locale). |
| 41–44 | **Météo Défavorable** | Compétences sociales −10 prochaine aventure ; nourriture +20 %. |
| 45–48 | **Météo Radieuse** | Peut ajouter **1 nouvelle Ambition**. |
| 49–52 | **Mauvaise Récolte** | Ruraux : aucun Revenu. Nourriture ×2 dans la région pour la prochaine aventure. |
| 53–56 | **Maladie Pernicieuse** | Test d'**Endurance Facile (+40)**. Échec → contracte le **Flux Sanglant** (LDB 20). |
| 57–60 | **Complications Monstrueuses** | *Revenus* bloqués jusqu'à résolution. Chaque Personnage peut sacrifier 1 Activité pour régler la menace (joué en scène) ; succès → 1 *Revenus* gratuit. |
| 61–63 | **L'Étreinte de Morr** | Mort d'un parent/ami/allié. Causes naturelles ou sinistres. |
| 64–65 | **Nouvelle Lune** | Voleurs : +20 % sur l'Activité *Revenus*. |
| 66–67 | **Vieilles Dettes** | Une Faveur Importante/Majeure s'active. Perd 1 Activité en préparation. |
| 68–69 | **Opportunité de Passage** | Citadins & Ruraux : +50 % d'argent via *Revenus*. |
| 70–71 | **Paix et Sérénité** | Pleine forme au début de la prochaine aventure. |
| 72–73 | **Colporteur** | 3 sc → +10 à tous les Tests *Dernières nouvelles*. |
| 74–76 | **Animal Domestique Malade** | Test **Soin aux animaux Intermédiaire (+0)**. Échec → animal meurt. |
| 77–79 | **Mise À Sac** | Planque dévalisée avant toute *Opérations bancaires*. Si < 1 CO → équipement le plus précieux aussi volé. |
| 80–82 | **Émeutes** | Courtisans : aucun *Revenus*. Banques réputées → vérifier faillite immédiate. *Semer la dissension* : +10 à tous les Tests. |
| 83–85 | **Kleptomane** | Perd **50 %** de l'argent de la dernière aventure. |
| 86–88 | **Soupçonné d'Hérésie** | Test **Charme Très Difficile (−30)**. Échec → gagne un Répurgateur comme némésis. |
| 89–91 | **Suspect** | Tous renoncent à 1 Activité (profil bas). Voleurs : aucun *Revenus* jusqu'à la prochaine aventure. |
| 92–94 | **Rien À Signaler** | Début d'aventure avec un appétit pour le risque. |
| 95–97 | **Considération Inattendue** | Récompense d'un PNJ aidé par le passé. Peut être un objet ou une bourse (disponible à la prochaine aventure). |
| 98–00 | **Mercenaires Particuliers** | Entraînement/Apprentissage particulier : −20 % des coûts. *Entraînement au Combat* : +20 % à tout Test adapté. |

**Implémente :** `src/data/interludeEvents.json` (données verbatim) + `src/data/interludeEvents.ts` (`interludeEventFor(roll)`, `INTERLUDE_EVENTS`) + tests `src/data/interludeEvents.test.ts`.

---

## Argent à gaspiller

**Source :** LDB 23 l.14-19.

> « Après avoir effectué un lancer sur le Tableau des Événements, vous pouvez dépenser l'argent avec
> lequel vous avez terminé la dernière aventure. […] tout l'argent restant à votre Personnage est
> considéré dépensé. En totalité. »

L'argent non sécurisé (voir *Opérations Bancaires*) disparaît avant la prochaine aventure. Les Revenus sont crédités **après** le gaspillage (LDB 23 l.191 : « seulement une fois que vous avez disposé de l'argent de votre dernière aventure »).

**Implémente :** `src/state/interludeFlow.ts` (logique de clôture — argent gaspillé, revenus crédités à la fermeture).

---

## Devoirs et Responsabilités

**Source :** LDB 23 l.22-56.

Les Personnages peuvent **perdre des Activités** à cause de leur Carrière, Statut ou race.

### Avec le pouvoir (Niveaux 3-4)

**Source :** LDB 23 l.31-37.

Si un Personnage a atteint le **Niveau 3 ou 4** de son Évolution de Carrière et **n'entreprend pas l'Activité *Revenus*** :

> « vous baissez d'un Niveau dans votre Évolution de Carrière ; vous repassez du quatrième Niveau au
> troisième, ou du troisième au deuxième. Cela ne coûte aucun Point d'Expérience. »

Le Statut inférieur entraîne des Revenus moindres lors des futures Activités. Pour récupérer le Niveau perdu : payer à nouveau le coût en PX.

**Implémente :** `src/state/interludeFlow.ts` — garde `didRevenus` par héros, descend `careerLevel` si absent (testé `src/state/interlude-flow.test.ts` l.78).

### Amélioration Elfique / Prestige Elfique

**Source :** LDB 23 l.40-56.

Les Personnages **elfes** doivent entreprendre **1 Activité** supplémentaire pour maintenir le contact avec les leurs (rapports aux agents d'Ulthuan ou aux espions du roi asraï). Cette Activité n'offre aucun avantage mécanique.

**Restriction :** les elfes ne perdent cette Activité **que si la durée entre deux aventures est d'au moins trois semaines** (LDB 23 l.56). Un elfe dispose donc toujours d'au moins deux Activités.

> « Évidemment, si vous pensez que cela pénalise injustement un Personnage elfe, ou rend le jeu moins
> amusant, n'hésitez pas à ignorer une ou deux restrictions. » — LDB 23 l.54.

**Règle optionnelle :** flag `interlude-elf-duty` (`src/engine/policy.ts` l.342-348).

**Implémente :** `src/state/interludeFlow.ts` l.100-103.

---

## Activités Répandues (LDB 23)

**Source :** LDB 23 l.59-250.

> « Vous pouvez entreprendre un maximum d'une Activité par semaine, et vous pouvez tenter un **maximum
> de trois Activités** au total, et ce, quelle que soit la durée de la période entre deux aventures. »
> — LDB 23 l.5.

N'importe quel Personnage peut tenter n'importe quelle Activité de Classe, mais hors de sa Classe la Difficulté monte d'un Niveau (LDB 23 l.197).

---

### Apprentissage Particulier

**Source :** LDB 23 l.67-72.

Apprendre un Talent **en dehors de sa Carrière**, avec un tuteur. Nécessite un tuteur (chercher via *Consulter un expert* si le Talent est obscur ou hors grande ville).

**Coût tuteur :** `2D10 pistoles d'argent par tranche de 100 PX` que coûte l'achat du Talent.

**Test :** Difficile (−20) avec la Caractéristique ou Compétence la plus pertinente (selon MJ).

- Succès → Talent appris.
- Échec → peut réessayer à une future Activité ; gagne **+10 par tentative ratée**.

**Implémente :** `src/engine/activities.ts` — `apprenticeshipTutorCost(talentXpCost, rng)` (l.46-52), `tutorCostRange(talentXpCost)` (l.128-132), `learnableTalents(hero)` (l.144-163) ; flux `src/state/interludeFlow.ts` ; `learnFails?: Record<string, number>` stocke les bonus d'échec.

---

### Artisanat

**Source :** LDB 23 l.75-103.

Créer de l'équipement du Guide de l'équipement (LDB ch.11) si le Personnage possède la Compétence Métier appropriée, avec outils et atelier adéquats.

**Matériaux :** coûtent **un quart du prix** de l'équipement (à acheter avant l'Activité — LDB 23 l.76).

**Test étendu de Métier** — Difficulté selon Disponibilité :

| Disponibilité | Difficulté |
|---------------|------------|
| Commune | Accessible (+20) |
| Limitée | Intermédiaire (+0) |
| Rare | Complexe (−10) |
| Exotique | Très difficile (−30) |

**DR requis** selon prix courant :

| Prix courant | DR |
|--------------|----|
| Bronze | 5 |
| Argent | 10 |
| Or | 15+ |

**Modificateurs de DR :**
- Chaque **Défaut** diminue de moitié le nombre de DR requis.
- Chaque **Atout** ajoute +5 (ajouté **après** avoir appliqué les Défauts).

Chaque Activité *Artisanat* = un lancer de Test étendu. Le travail inachevé se conserve.

**Implémente :** `src/engine/activities.ts` — `craftTarget(tier, avail, atouts, defauts)` (l.38-44), `craftSpecOf(t)` (l.82-95), `craftCatalog()` (l.116-125) ; `craft?` dans `InterludeHeroState` (`src/state/interludeFlow.ts` l.46).

---

### Changement de Carrière

**Source :** LDB 23 l.105-108.

Avec accord du MJ :
- Carrière actuelle **achevée** → changement gratuit vers tout Niveau compatible.
- Carrière **non achevée** → coûte **100 PX**.

Le temps illustre présentations, pots-de-vin, licences, etc.

**Implémente :** `src/state/partyFlow.ts` (changement de carrière via l'avancement — distinct de l'Activité).

---

### Consulter Un Expert

**Source :** LDB 23 l.111-126.

En deux étapes :

1. **Localiser l'expert :** Test **Ragot Intermédiaire (+0)** (Difficulté selon taille de la ville). Succès = expert qualifié trouvé. Échec = charlatan local.
2. **Consulter :** le convvaincre peut demander un Test **Charme**, un don au Temple de Verena, ou une Faveur (Mineure à Importante selon la difficulté du sujet).

Sur succès d'une consultation de savoir : gagne une **Relance Experte** (utilisable uniquement pour un Test lié à ce savoir, avant la fin de la prochaine aventure).

Une relation établie avec un expert = consultable gratuitement (sans Activité) lors des futurs interludes.

**Implémente :** non implémenté comme Activité discrète dans le flux — la consultation experte est laissée au MJ (pas de Test automatique dans `src/state/interludeFlow.ts`).

---

### Dressage

**Source :** LDB 23 l.129-130.

Test **Dressage Accessible (+20)**. Succès → ajouter 1 Compétence à un animal, choisie parmi les Traits **Dressé** (LDB p.339).

**Implémente :** non implémenté.

---

### Entraînement

**Source :** LDB 23 l.133-153.

S'entraîner dans une Compétence ou Caractéristique **en dehors de la Carrière**, avec tuteur.

**Coûts :**
- Compétences de Base + Caractéristiques : PX + **1D10 sous de cuivre** (où PX = coût en PX de l'Augmentation).
- Compétences Avancées : **double** du montant ci-dessus.

**Implémente :** non implémenté comme Activité distincte de l'Avancement (les Tests de Caractéristiques hors carrière ne sont pas séparés dans le flux actuel).

---

### Faites-moi une Faveur !

**Source :** LDB 23 l.140-151.

Système transversal aux Activités : une **Faveur** est un engagement futur accepté en échange d'une aide immédiate. Briser une Faveur : réputation ternie, Niveau réduit de 1 (minimum 0) si la rumeur se répand.

**Niveaux de Faveur :**

| Niveau | Description | Résolution |
|--------|-------------|------------|
| **Mineure** | Mission simple, quelques heures | 1 Activité |
| **Majeure** | Entreprise longue et risquée, plusieurs semaines, peut impliquer un voyage | 2+ Activités consécutives |
| **Importante** | Risque mortel, mois de voyage, violence extrême probable | Joué comme aventure complète (pas via Activités) |

**Implémente :** non implémenté (système de PNJ/MJ — pas de données structurées dans le store actuel).

---

### Invention !

**Source :** LDB 23 l.154-162.

En deux étapes :

**1. Planifier :** décider quels équipements combiner. Test **Métier (Ingénieur)** — Difficulté selon l'extravagance (MJ). Succès → DR obtenus = bonus DR à la phase Construction.

**2. Construire :** via *Artisanat* ou *Passer commande*.
- *Artisanat* : Test Très difficile (−30) ; matériaux = 2× le prix courant des équipements à combiner ; Disponibilité = celle de l'équipement le plus limité.
- *Passer commande* : trouver d'abord un expert (*Consulter un expert*) ; coût = 6× le prix courant des équipements à combiner.

**Implémente :** non implémenté.

---

### Opérations Bancaires

**Source :** LDB 23 l.165-176.

Permettent de **sauver des fonds** pour la prochaine aventure (sinon perdus selon *Argent à gaspiller*). Deux options :

**Investir (Statuts Or et Argent uniquement) :**
- Choisir un *Indice* d'intérêts entre 1 et 10 (ou lancer 1d10). C'est à la fois le taux d'intérêts (%) et le risque de faillite.
- Retrait → autre Activité *Opérations bancaires* → lancer 1d100 : si résultat ≤ Indice → **faillite, argent perdu** ; sinon → fonds + intérêts.

**Planque (tous Personnages) :**
- Cacher sur soi, dans un matelas ou enterré.
- Pas d'intérêts.
- Retrait avant aventure : sans Activité.
- Lancer 1d100 : si résultat ≤ 10 → **planque découverte, argent perdu** ; sinon → somme intacte.

> *Exemple verbatim* — « Gerhard décide de placer son argent dans la prestigieuse banque privée Bent, Crooke & Scarper. Le MJ lance 1d10 avec un résultat de 6. Gerhard gagnera 6 % d'intérêts sur son placement (12 pistoles d'argent), et la banque fera faillite s'il fait 6 ou moins en lançant le d100 quand il tentera d'effectuer un retrait. »

**Implémente :** `src/engine/activities.ts` — `bankWithdrawOutcome(kind, rate, roll)` (l.54-58) + `bankPayout(kind, amountBrass, rate)` (l.60-65) ; `BankDeposit` dans `src/state/interludeFlow.ts` (l.57-65) ; flux dans `src/state/interludeFlow.ts` (gestion invest/stash, Émeutes → faillite immédiate). **Écart code↔RAW** : la restriction Statut Or/Argent pour « Investir » n'est pas vérifiée côté code (arbitrage jeu-sans-MJ acceptant tout Statut).

---

### Passer Commande

**Source :** LDB 23 l.179-184.

Acquérir des objets de rareté **Exotique** (ou très spécialisés, jamais en stock). Nécessite connaître un fournisseur — sinon, faire d'abord *Consulter un expert*.

**Coût :** prix de l'objet à la commande.

**Délai :** l'objet est livré **après la prochaine aventure** (= au début de l'interlude suivant, LDB 23 l.182).

Un seul objet Exotique par Activité *Passer commande*.

**Implémente :** `src/engine/activities.ts` — `orderCatalog()` (l.166-174, filtre Exotique/ND) ; `pendingOrders` dans `src/state/store.ts` (l.351) ; livraison à l'ouverture de l'interlude suivant `src/state/interludeFlow.ts` (l.79-88).

---

### Revenus

**Source :** LDB 23 l.187-193 + LDB 08 l.106-122 (table Gagner de l'argent grâce au Statut).

Gagner de l'argent entre aventures selon le Statut. Le Personnage décrit brièvement son activité (chasse les primes, patrouille, touche une rente…).

Les Revenus ne sont crédités **qu'après** le gaspillage (LDB 23 l.191). Certains événements du Tableau peuvent directement modifier les Revenus (+/−%).

**Revenus par Statut** (LDB 08 l.110-122) :

| Échelon social | Revenu par Standing |
|----------------|---------------------|
| Bronze | 2d10 sous de cuivre |
| Argent | 1d10 pistoles d'argent |
| Or | 1 couronne d'or |

Test de Compétence de Carrière :
- **Succès** → revenu plein.
- **Échec** → moitié de la somme.
- **Échec Stupéfiant (−6)** → rien.

Les Personnages aux Niveaux 3-4 qui entreprennent *Revenus* **maintiennent automatiquement leur Statut** (voir *Avec le pouvoir*).

**Implémente :** `src/engine/activities.ts` — `statusIncome(tier, standing, rng, outcome)` (l.176-192) ; flux dans `src/state/interludeFlow.ts` ; test compétence via `rollFlows.ts` (`activity` spec).

---

## Activités de Classe (LDB 23)

**Source :** LDB 23 l.196-250.

Hors Classe spécifiée : Difficulté +1 Niveau (Difficile au lieu de Complexe, etc. — LDB 23 l.197).

---

### Dernières Nouvelles (Itinérants, Riverains)

**Source :** LDB 23 l.200-203 + l.197-198 (le texte est split dans le source OCR).

Apprendre des rumeurs de loin. Test **Ragot Intermédiaire (+0)**.

- Succès → 1 rumeur (chaque DR = 1 rumeur supplémentaire, possiblement liée à la prochaine aventure).
- Échec Impressionnant → rumeur fausse crue vraie (MJ peut lancer en secret).

**Implémente :** non implémenté.

---

### Entraînement au Combat (Guerriers, Itinérants)

**Source :** LDB 23 l.206-209.

S'entraîner avec les armes connues. Test **Compétence (Corps à corps ou Projectiles) Intermédiaire (+0)**.

- Succès → peut **inverser** un Test de la Compétence associée **une fois** pendant la prochaine aventure.

Peut être entrepris plusieurs fois (une inversion par Activité réussie).

**Implémente :** non implémenté.

---

### Observer Une Cible (Roublards)

**Source :** LDB 23 l.211-221.

Surveiller une cible (marchand, temple, personnalité) pour bénéficier d'un avantage lors d'une future action criminelle ou d'escroquerie.

Test **Perception Intermédiaire (+0)** (Difficulté modifiée selon la cible).

- Succès → peut **inverser** un Test concernant la cible **une fois** pendant la prochaine aventure.
- DR supplémentaires → informations (ou désinformations !) sur la cible.

**Implémente :** non implémenté.

---

### Recherche de Savoir (Lettrés)

**Source :** LDB 23 l.222-227.

Étendre ses connaissances sur un sujet spécifique (bataille, événement, individu…). Requiert accès à une bibliothèque, des archives de forteresse naine, des registres de Guilde ou un Temple de Verena.

Test **Savoir Accessible (+20)** (spécialisation appropriée). Sans la bonne spécialisation (mais Lettré) : Test **Intelligence Complexe (−10)**.

- Succès → connaissance intéressante, utile ou cachée (chaque DR = une tranche supplémentaire).
- Échec Impressionnant → fausse information crue vraie (MJ peut lancer en secret).

**Implémente :** non implémenté.

---

### Réputation (Citadins, Courtisans, Lettrés)

**Source :** LDB 23 l.229-234.

Dépenser de l'argent pour augmenter son Standing de +1 pour la prochaine aventure (bonus temporaire).

**Coût :** maximum des revenus standards (= revenus max par Statut × Standing). Test **Compétence de Carrière Intermédiaire (+0)**.

- Succès → Standing +1.
- Succès Stupéfiant (+6) → Standing +2.
- Échec → argent perdu (aucun effet).
- Échec Stupéfiant (−6) → Standing −1 pour la prochaine aventure entière.

**Implémente :** non implémenté.

---

### Semer la Dissension (Citadins, Ruraux)

**Source :** LDB 23 l.237-249.

Créer des troubles sociaux contre un individu, groupe ou institution. Requiert **deux Activités** (compte aussi comme *Revenus* pour les Agitateurs).

**Étape 1 :** Test **Ragot Accessible (+20)** → identifier les personnes influentes.

**Étape 2 :** Test **Charme** — Difficulté selon la cible :
- Noble oppresseur : Facile (+40).
- Hospice de Shallya : Difficile (−20).

Échec à l'une des étapes → Activité échouée.

**Succès :** pendant la prochaine aventure, peut tenter un Test **Charme** pour ameuter une foule contre la même cible (Difficulté MJ).

- 1 succès → foule qui accoste, crie, lance des légumes.
- Succès Impressionnant/Stupéfiant → lynchage ou incendie possible.
- Échec → pas de révolte ; Échec de plusieurs DR → la cible apprend vos actions.

**Implémente :** non implémenté.

---

## Activités de Guerrier — AA Annexe II

**Source :** AA Annexe II (fichier `Source/WH - V4 - Aux Armes/01 - WH - V4 - Aux Armes.md` l.4347-4401).

> « N'importe quel Personnage peut tenter ces Activités, mais s'il n'a jamais appartenu à la Classe des
> Guerriers, la Difficulté de tous les Tests qu'il effectue monte d'un Niveau. »

| Activité | Test | Bénéfice (prochaine aventure) |
|----------|------|-------------------------------|
| **Tir Parfait de Fanmaris** | Projectiles (Arc) Complexe (−10) | 1×/aventure : après 1 Round de visée, déclarer Tir Parfait — effets cumulatifs par DR (choix localisation / Perforante / Critique auto / Dévastatrice) |
| **Défense de Leitdorf** | Corps à Corps Complexe (−10) | 1×/aventure : attaque opposée −10 où l'adversaire ne peut ni utiliser ses Talents ni ajouter ses Augmentations ; succès = attaquant subit 1d10 Dégâts ignorant armure ; échec adverse = Coup Critique sur l'attaquant |
| **Méthode Alcatani** *(requiert Coude-à-coude ×2)* | Commandement Complexe (−10) | +1 rang Coude-à-coude à jusqu'à DR Personnages pour la durée de l'aventure |
| **Fabuleuse Vente des Aventures du Comte de Punchausen** | Charme Complexe (−10) **ou** Divertissement (Narration) Intermédiaire (+0) | Reçoit 2d10 pistoles + 1× inversion Test Charme/Narration dans l'aventure |
| **Remaniement du Contremaître** | Ragot (+0) pour localiser, puis Corps à Corps **ou** Projectiles Complexe (−10) | Reçoit l'objet désiré + Critique sur localisation aléatoire (gravité variable selon résultat) |

**Implémente :** non implémenté.

---

## Activités de Bataille — ADE II ch.8

**Source :** ADE II `08 - Le théâtre de la guerre.md` l.89-131.

> « Cette section comprend des Activités supplémentaires auxquelles peuvent s'adonner les Personnages
> *Entre deux aventures*. Le MJ décide du temps que les Personnages ont à leur disposition et, comme à
> l'accoutumée, ils ne peuvent participer qu'à un maximum de trois Activités. »

Contexte : préparation d'une bataille (siège, campagne militaire). Les Activités ratées **ne peuvent être réessayées** sans une approche différente.

| Activité | Test | Effet |
|----------|------|-------|
| **Discours Inspirant** | Commandement — Difficulté selon écart de Puissance (arrondi dizaine) | Succès → armée +10 au Test de Puissance du 1er Round |
| **Infiltration** *(requiert Planification réussie)* | Discrétion + Perception combiné, **ou** Interprétation + Perception combiné | Succès → +20 à Planification. Échec → doit fuir le camp ennemi |
| **Planification** | Savoir (Guerre) — Difficulté selon écart de Puissance + champ de bataille + plan | Succès → armée +10 à tous les Tests de Puissance. Succès Stupéfiant (+6) → +20 |
| **Rassembler des Forces** | Variable selon la méthode (Commandement, Charme, Intimidation…) | Succès → Puissance +5. Succès Stupéfiant (+6) → +10. Échec Stupéfiant (−6) → −10 |
| **Repérage** | Chevaucher + Perception Intermédiaire (+0) combiné | Succès → effectifs/distance/troupes adverses + +10 à Planification. Échec → fausses infos ou retard |
| **Sabotage** *(requiert Repérage réussi)* | Discrétion **ou** Interprétation — peut s'intégrer à Infiltration | Succès → ennemi −5 Puissance. Succès Stupéfiant (+6) → −10. Échec → combat/fuite |
| **Autres Préparations** | À définir (Compétence + Difficulté + récompense + pénalité sur Échec Stupéfiant) | Variable |

**Option coût de la guerre** : entretien = Σ Statuts des soldats/jour (réduction 50 % → −10 à tous les Tests de Puissance ; aucun entretien → armée se disperse en 2 jours).

**Implémente :** non implémenté.

---

## Activités de Voyage — EDOC ch.5

**Source :** EDOC `08 - CHAPITRE 5 - Voyager.md` l.96-135.

> « En parcourant les routes de l'Empire, les Personnages se retrouveront avec une quantité surprenante
> de temps libre. […] chaque Personnage bénéficie d'une Activité par Étape de son voyage. »

Les Activités de voyage durent toute une Étape de voyage et restent **fatigantes** : un Test raté → État *Exténué*.

À la discrétion du MJ, les Activités LDB ch.6 peuvent s'effectuer en voyage (EDOC l.101).

| Activité | Test | Effet |
|----------|------|-------|
| **Plein Air** | Survie en extérieur Intermédiaire (+0), −10/degré de météo défavorable | Succès → le groupe n'a pas à tester l'Exposition due à la météo pendant cette Étape |
| **Approvisionnement** | Survie en extérieur (voir LDB p.131) | Se réapprovisionner en nourriture/eau |
| **Recueillir des Informations** | Ragot Intermédiaire (+0) | DR questions auxquelles le MJ répond sincèrement selon les habitants |
| **Rester aux Aguets** | Perception Intermédiaire (+0) | Succès → groupe non surpris pendant cette Étape |
| **Établir des Cartes** | Test étendu : Métier (Cartographe) **ou** Art (Dessin) — DR requis = 2 × nombre d'Étapes | Carte terminée → Savoir/Orientation lors d'un voyage futur Accessible (+20) au lieu de (+0) |
| **Pratiquer Une Compétence** | Compétence praticable en voyage — Intermédiaire (+0) | Succès → peut inverser 1 Test de cette Compétence pendant l'aventure suivante ou une étape ultérieure |
| **Récupérer** | — (automatique si aucun État *Exténué* pendant l'Étape) | Cette Étape compte comme « repos » pour la guérison des Blessures |
| **Monter Un Camp** | Survie en extérieur **ou** Guérison Intermédiaire (+0) | Chaque DR retire 1 État *Exténué* d'un Personnage ou le guérit |

Note sur les Revenus en voyage : l'Activité *Revenus* (LDB 23) n'est **pas adaptée** pour la plupart des Carrières en voyage — sauf juges/huissiers itinérants, chasseurs, éclaireurs, cochers (EDOC l.125-126).

**Implémente :** `src/state/travelFlow.ts` (voyage jour par jour) — les Activités de voyage spécifiques à l'EDOC ne sont pas implémentées individuellement.

---

## Nouvelle Activité : Convalescence — ADE II Annexe I

**Source :** ADE II `09 - Annexe I.md` l.32-33.

Requiert accès à un lieu de repos (hospice, monastère, temple). Contexte : surmonter un Trauma Psychologique.

**Test :** Calme Très Difficile (−30) (Difficulté réductible selon qualité des soins).

- Succès → éliminer **un Trait Psychologique** de son choix.
- Échec → se sent mieux quand même ; peut **inverser** un Test de **Calme** pour résister aux effets du Trait lors de la prochaine aventure.

**Implémente :** `src/state/restFlow.ts` (repos/infirmerie) — la suppression de Trait Psychologique via Convalescence n'est pas implémentée.

---

## Règles optionnelles connexes

| Règle | Source | Flag / Note |
|-------|--------|-------------|
| Tout le chapitre est optionnel | LDB 22 l.4 | flag `interlude-enabled` (`policy.ts`) |
| Prestige Elfique / Devoir elfique | LDB 23 l.54-56 | flag `interlude-elf-duty` (`policy.ts`) |
| Revenus : restriction Investir aux Statuts Or/Argent | LDB 23 l.168 | Non vérifiée côté code (arbitrage jeu-sans-MJ) |
| Activités LDB ch.6 pendant un voyage | EDOC ch.5 l.101 | À discrétion du MJ |

---

## Voir aussi

- [`economie.md`](economie.md) — monnaie, Statut, revenus standards (LDB 08).
- [`avancement.md`](avancement.md) — coûts PX, Évolution de Carrière, Niveaux.
- [`maladies.md`](maladies.md) — Flux Sanglant (événement 53-56).
- [`destin.md`](destin.md) — Points de Chance, Points de Destin.
- [`psychologie.md`](psychologie.md) — Traits Psychologiques, Trauma (lien Convalescence).
- [`deplacement.md`](deplacement.md) — Étapes de voyage (Activités EDOC).

---

## Implémente

| Mécanique | Module(s) | État |
|-----------|-----------|------|
| Tableau des Événements d100 | `src/data/interludeEvents.json` + `src/data/interludeEvents.ts` | Confirmé — 34 entrées couvrant 01-00 |
| Artisanat (DR, Difficulté, matériaux) | `src/engine/activities.ts` (`craftTarget`, `craftSpecOf`, `craftCatalog`) | Confirmé |
| Apprentissage particulier (coût tuteur, bonus échec) | `src/engine/activities.ts` (`apprenticeshipTutorCost`, `tutorCostRange`, `learnableTalents`) + `interludeFlow.ts` | Confirmé |
| Opérations bancaires (invest/planque, taux, payout) | `src/engine/activities.ts` (`bankWithdrawOutcome`, `bankPayout`) + `interludeFlow.ts` | Confirmé |
| Revenus (statusIncome par Statut) | `src/engine/activities.ts` (`statusIncome`) | Confirmé |
| Passer commande (catalogue, livraison) | `src/engine/activities.ts` (`orderCatalog`) + `interludeFlow.ts` | Confirmé |
| Argent à gaspiller | `src/state/interludeFlow.ts` (clôture) | Confirmé |
| Avec le pouvoir (Niveaux 3-4, `didRevenus`) | `src/state/interludeFlow.ts` | Confirmé |
| Prestige elfique (flag, ≥3 semaines) | `src/state/interludeFlow.ts` l.100-103 + `policy.ts` l.342 | Confirmé |
| Changement de Carrière | `src/state/partyFlow.ts` (avancement) | Confirmé (sans lien Activité explicite) |
| Consulter un Expert | — | Non implémenté |
| Dressage (Activité) | — | Non implémenté |
| Entraînement (hors-Carrière coûts) | — | Non implémenté séparément de l'avancement |
| Invention ! | — | Non implémenté |
| Réputation | — | Non implémenté |
| Semer la Dissension | — | Non implémenté |
| Dernières Nouvelles | — | Non implémenté |
| Entraînement au Combat | — | Non implémenté |
| Observer une Cible | — | Non implémenté |
| Recherche de Savoir | — | Non implémenté |
| Convalescence (ADE II) | — | Non implémenté (suppression Trait Psychologique) |
| Activités de Guerrier (AA) | — | Non implémenté |
| Activités de Bataille (ADE II) | — | Non implémenté |
| Activités de Voyage (EDOC) | `src/state/travelFlow.ts` (voyage général) | Partiellement — flux voyage sans Activités EDOC individuelles |
| Faveurs (Mineure/Majeure/Importante) | — | Non implémenté |
