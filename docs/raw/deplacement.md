# Atlas RAW — Déplacement & Voyage (hors combat)

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/engine/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](sources.md). Carte code→règle : [`code-map.md`](code-map.md).
>
> **Périmètre de ce fichier** : Mouvement hors combat (règles générales), voyage entre lieux, montures
> et véhicules, Encombrement et fatigue de voyage, poursuites.
> Les règles de Charge, Désengagement, Fuite, Escalade, Saut et Chute *en combat* sont dans
> [`combat.md`](combat.md) §§ correspondants — ce fichier les renvoie sans les re-transcrire.

## Sommaire

- [Tableau des Mouvements (valeurs de base)](#tableau-des-mouvements)
- [Course hors combat (sprint)](#course-hors-combat)
- [Escalade, Saut, Chute — voir combat.md](#escalade-saut-chute)
- [Voyage à pied : vitesse, durée, marche forcée](#voyage-a-pied)
- [Transports payants : Diligence, Barge, Fiacre, Ferry](#transports-payants)
- [Montures : allures, endurance, incidents](#montures)
- [Véhicules tirés : conduite, incidents, tableau](#vehicules)
- [Encombrement et fatigue de voyage](#encombrement-et-fatigue-de-voyage)
- [Péripéties de voyage (LdB)](#peripeties-ldb)
- [Système par Étapes (EDOC — optionnel)](#systeme-etapes-edoc)
- [Poursuites](#poursuites)
- [Voir aussi](#voir-aussi)
- [Implémente](#implemente)

---

## Tableau des Mouvements

**Source :** LDB 15 l.19-32

Le Tableau des Mouvements donne la distance couverte *en mètres* pour un tour de combat selon la
caractéristique **M** (Mouvement). Pour le voyage, les valeurs de marche/course en mètres/tour
*ne sont pas directement utilisées* — seul **M exprimé en km/h** sert (voir § Voyage à pied).

| Mouvement | Marche (m/tour) | Course (m/tour) |
|:---------:|:---------:|:--------:|
| 0 | 0 | 0 |
| 1 | 2 | 4 |
| 2 | 4 | 8 |
| 3 | 6 | 12 |
| 4 | 8 | 16 |
| 5 | 10 | 20 |
| 6 | 12 | 24 |
| 7 | 14 | 28 |
| 8 | 16 | 32 |
| 9 | 18 | 36 |
| 10 | 20 | 40 |

**Grille (option)** : cases de 3 cm = 2 m en jeu. M 4 = 4 cases par tour. LDB 15 l.12.

> **Règle :** si M = 4, Marche = 4×2 = 8 m, Course = 4×4 = 16 m.
> Formule généralisée : Marche = M×2, Course = M×4.

**Voir aussi :** [`combat.md`](combat.md) § Déplacement en combat pour Charge, Mouvement du tour
et options d'Action.

---

## Course hors combat

**Source :** LDB 15 l.40-42 (section « Course »)

Utiliser son Action pour courir : Test **Athlétisme Accessible (+20)**.
- Distance couverte EN PLUS du Mouvement normal : **Mouvement de Course + DR** mètres.
- Exemple : M 4, DR +2 → 16 + 2 = 18 m supplémentaires.
- Exemple : M 4, DR −2 → 16 − 2 = 14 m supplémentaires.

---

## Escalade, Saut, Chute

Ces règles s'appliquent en et hors combat.
→ Voir [`combat.md`](combat.md) § Escalade, Saut et Chute (transcription complète là-bas).

---

## Voyage à pied

### Vitesse

**Source :** LDB 51 l.192-193

> « Utilisez le Déplacement pour déterminer la vitesse du voyage en kilomètre par heure. Ainsi,
> si le Déplacement le plus lent d'un groupe est de 3, il voyagerait approximativement à 3
> kilomètres par heure. »

- **Vitesse (km/h) = M du personnage le plus lent du groupe.**
- M est le **M effectif** (après pénalités d'Encombrement, voir § Encombrement).
- EDOC ch.5 l.479 (EDOC 08) confirme : « combien de kilomètres par heure vous pouvez aisément
  parcourir ».

### Heures de marche par jour sans Test

**Source :** LDB 51 l.195

> « En prenant en compte les temps de repos, les arrêts nécessaires et une topographie standard,
> un groupe peut voyager l'équivalent de **6 heures par jour** sans avoir besoin de Tests de
> Résistance. »

### Marche forcée (au-delà de 6 h/j)

**Source :** LDB 51 l.195

> « S'il voyage plus rapidement ou plus loin, donnez un État *Exténué* à ceux échouant à ce Test,
> et un État *Exténué* supplémentaire si le Personnage est Encombré (voir page 293). »

- Test : **Résistance Intermédiaire (+0)**.
- Échec → +1 Exténué.
- Échec + Surchargé → +2 Exténué (1 marche forcée + 1 Encombrement).
- Plafond journalier de marche forcée : **non défini par le canon** (paramétrable en jeu : 10 h/j
  par défaut).

### Barges et courant

**Source :** LDB 51 l.197

> « La vitesse d'une barge peut augmenter ou diminuer jusqu'à 30 % si elle est en aval ou en
> amont, si vous jugez que c'est approprié. »

---

## Transports payants

### Table des Coûts de Trajet

**Source :** LDB 51 l.177-190 (verbatim)

> « Tous les coûts listés ici sont par kilomètre parcouru, et sont seulement des indications
> approximatives. Les diligences et les barges les plus rapides coûtent généralement deux fois
> plus. Les modèles plus lents coûtent deux fois moins cher. Augmentez ou diminuez le Mouvement
> de +/-1 pour des modèles plus rapides ou plus lents. »

| Transport | Déplacement (km/h) | Coût |
|---|:---:|---|
| **Diligence** | 6 | |
| — Intérieur | | –/2 par km |
| — Extérieur | | –/1 par km |
| **Barge** | 8 | |
| — Cabine | | –/5 par km |
| — Pont | | –/2 par km |
| **Fiacre** | 6 | –/3 par quartier |
| **Ferry** | 4 | –/1 par 20 mètres |

Notes d'application :
- Les prix **n'incluent pas** les repas, l'hébergement ou le fourrage. LDB 51 l.170.
- Barge de passagers haut de gamme : peut coûter ×10 ou plus. LDB 51 l.174.
- Le coût d'une barge de cargo *peut être réduit* en échange de travail à bord. LDB 51 l.172.

### Contexte narratif

**Source :** LDB 51 l.157-166

- Route : option la plus **dangereuse** mais la moins chère.
- Rivière : souvent plus sûre et relaxante ; les barges n'acceptent pas toujours les escales hors
  des villes principales (pot-de-vin ou persuasion nécessaire). LDB 51 l.166.
- Auberges relais espacées d'environ 50 km (½ journée à cheval, 1 journée à pied). EDOC 06 (ch.3).

### Compagnies de diligences (couleur locale)

**Source :** EDOC 06 l. (ch.3 Les routes et grandes routes)

Les Quatre Saisons, Lignes Rochet, Lignes Cartak (Altdorf), Diligences Flèche rouge (Averheim),
Diligences de la Tour du Roc (Middenheim), Diligences du Loup coureur (Middenheim), Cannon Ball
Express, L'Express impérial (Nuln), Diligences du Tunnel (Talabheim).

---

## Montures

**Source :** EDOC 07 (ch.4 Montures et véhicules)

### Profils des montures courantes

| Animal | M | CC | F | E | I | Ag | B |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Chien | 4 | 25 | 20 | 20 | 35 | 30 | 7 |
| Poney/âne/mule | 4 | 25 | 30 | 45 | 20 | 30 | 12 |
| Cheval de trait | 5 | 25 | 45 | 45 | 17 | 25 | 26 |
| Cheval de trait lourd | 4 | 25 | 50 | 50 | 15 | 20 | 32 |
| Bœuf | 3 | 25 | 55 | 55 | 15 | 20 | 32 |
| Cheval de monte (Palefroi) | 7 | 25 | 30 | 45 | 20 | 30 | 24 |
| Cheval de guerre léger | 7 | 35 | 45 | 35 | 20 | 30 | 22 |
| Cheval de guerre lourd (Destrier) | 4 | 35 | 50 | 50 | 20 | 20 | 32 |

### Tableau des allures (Mouvement en mètres/tour)

**Source :** EDOC 07 l.118-130

| Animal | M | Pas (m) | Trot (m) | Petit galop (m) |
|---|:--:|:--:|:--:|:--:|
| Chien | 4 | 8 | — | 24 |
| Poney, âne ou mule | 4 | 8 | — | 16 |
| Cheval de trait | 5 | 10 | — | 20 |
| Cheval de trait lourd | 4 | 8 | — | 16 |
| Bœuf | 3 | 6 | — | 12 |
| Cheval de monte (Palefroi) | 7 | 14 | 21 | 42 |
| Cheval de guerre (Courant) | 7 | 14 | 21 | 42 |
| Cheval de guerre lourd (Destrier) | 4 | 8 | 12 | 24 |

### Vitesse de voyage des montures

**Source :** EDOC 07 l.139-140

> « Chaque point de Mouvement équivaut à **1,5 km par heure au pas**, **2,5 km par heure au trot**,
> et **3 km par heure au galop**. »

Formule : vitesse (km/h) = M × facteur d'allure.

| Allure | Facteur | Exemple M 7 |
|---|:--:|:--:|
| Pas | ×1,5 | 10,5 km/h |
| Trot | ×2,5 | 17,5 km/h |
| Petit galop (course) | ×3 | 21 km/h |

### Endurance des allures

**Source :** EDOC 07 l.142-148

- **Pas** : jusqu'à 12 heures sans repos ; ensuite 1 h de pause + eau → BE heures supplémentaires.
- **Trot** : pendant **BE heures**.
- **Petit galop** : pendant **½ BE heures**.

Au-delà de la limite :
- Par heure supplémentaire → +1 Exténué + Test **Résistance Intermédiaire (+0)**.
- Échec → +1 Exténué supplémentaire → jet sur Tableau des Incidents de Monte.
- Exténué > BE → s'effondre (*Sonné* + *À Terre*) + Test Résistance Intermédiaire (+0) ; échec =
  mort de la bête.

### Tableau des Incidents de Monte (1d100)

**Source :** EDOC 07 l.151-156

| 1d100 | Incident |
|:---:|---|
| 01–40 | Sangle cassée |
| 41–85 | Perte d'un fer |
| 86–98 | Boiteux |
| 99–00 | Patte (Jambe) brisée |

**Boiteux** : max ½ vitesse de marche ; impossible d'être monté, portée ou tirée. Prolonger le
trajet augmente la durée d'une Étape. EDOC 07 l.158-160.

**Patte brisée** : Fracture (Majeure) + immobilisation. M divisé par 2 si guérison. EDOC 07
l.145-147.

**Perte d'un fer** : Test **Chevaucher Complexe (-10)** ou chute (2 m). Déplacement au pas jusqu'au
maréchal-ferrant. EDOC 07 l.166-168.

**Sangle cassée** : Test **Chevaucher Complexe (-10)** ou chute (2 m). −20 à tous futurs Tests
Chevaucher jusqu'à réparation. EDOC 07 l.171-174.

### Coût et disponibilité des animaux

**Source :** EDOC 07 l.97-115

| Animal | Coût | Enc portée | Disponibilité |
|---|:--:|:--:|:--:|
| Chien | 2 CO | 8 | Rare |
| Poney | 10 CO | 14 | Commune |
| Âne ou mule | 5 CO | 14 | Commune |
| Cheval de trait | 4 CO | 20 | Commune |
| Cheval de trait lourd | 8 CO | 30 | Limitée |
| Bœuf | 15 CO | 30 | Commune |
| Cheval de monte (Palefroi) | 15 CO | 16 | Commune |
| Cheval de guerre léger | 70 CO* | 18 | Commune |
| Cheval de guerre lourd (Destrier) | 230 CO* | 20 | Limitée |

\* Prix peut doubler ou tripler en temps de guerre.

---

## Véhicules

**Source :** EDOC 07 (ch.4 « Véhicules routiers dans l'Empire »)

### Tableau des Véhicules de l'Empire

**Source :** EDOC 07 l.231-243

| Véhicule | Coût | Enc | Chargement | Dispo | Animaux/Porteurs | Endurance | Blessures |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Charrette | 20 CO | 10 | 25 | Commune | 1 A | 25 | p.10 |
| Chaise (Bordeleaux) | 25 CO | 5 | 10 | Rare | 2 P | 20 | p.8 |
| Diligence | 150 CO | 100 | 80 | Rare | 2-4 A | 45 | p.50 |
| Charrette à bras | 10 CO | 5 | 50 | Commune | 1-2 P | 20 | p.8 |
| Petite litière | 30 CO | 10 | 10 | Commune | 2 P | 30 | p.20 |
| Grande litière | 45 CO | 20 | 20 | Exotique | 2-4 P | 35 | p.35 |
| Chariot léger | 75 CO | 30 | 30 | Commune | 2-4 A | 50 | p.35 |
| Chariot moyen | 100 CO | 50 | 60 | Commune | 2-6 A | 50 | p.60 |
| Chariot lourd | 125 CO | 75 | 100 | Commune | 2-8 A | 50 | p.95 |

A = Animaux ; P = Porteurs. Tirer un véhicule à roues = 1/10 de son Enc total pour l'animal.

### Vitesse des Véhicules

**Source :** EDOC 07 l.227-229

> « Les animaux qui tirent un véhicule ne peuvent que **marcher ou trotter en toute sécurité.** »

Course forcée (galop en tirant) :
- Test **Conduite d'attelages Intermédiaire (+0)** par km, pénalité −10 par km déjà parcouru au
  galop.
- Échec → retour au pas + Test **Résistance Intermédiaire (+0)** de l'animal (échec = Exténué).
- Échec Stupéfiant (−6 DR ou pire) → jet sur Tableau des Problèmes de Véhicule.

### Tableau des Problèmes de Véhicule (1d100)

**Source :** EDOC 07 l.286-288

| 1d100 | Résultat |
|:---:|---|
| 01–50 | Incontrôlable |
| 51–79 | Endommagé |
| 80–95 | Cassé |
| 96–00 | Accident |

**Incontrôlable** : rênes cassées, pas de contrôle ; collision en 1d10 rounds si pas maîtrisé →
Endommagé (pas) ou Accident (plus vite). EDOC 07 l.283-286.

**Endommagé** : ne peut rouler qu'au pas jusqu'à réparation (Métier Charpentier/Charron). Si forcé
plus vite : Cassé après 1d10 rounds. EDOC 07 l.272-280.

**Cassé** : harnais/roue/essieu brisé. Véhicule immobilisé. Conducteur : Test **Athlétisme
Intermédiaire (+0)** pour ne pas être arraché ; échec = chute (+ éventuellement Traîné au sol).
EDOC 07 l.297-299.

**Accident** : collision violente. Occupants : 2d10 Blessures (−BE, −PA, min 1). Véhicule : 2d10
Blessures (−BE, min 1). Réparation obligatoire avant usage. EDOC 07 l.291-292.

---

## Encombrement et Fatigue de Voyage

**Source :** LDB 61 l.4-49

### Capacité de charge

- Limite sans pénalité = **Bonus de Force + Bonus d'Endurance**. LDB 61 l.4-5.
- Objets portés (armures, vêtements, bijoux) : Enc −1 (souvent = 0). LDB 61 l.21.
- Monnaie : 1 Enc pour 200 pièces. LDB 61 l.30.

### Seuils de surcharge et pénalités

**Source :** LDB 61 l.34-41 (verbatim)

| Enc | Pénalité |
|---|---|
| Jusqu'à la limite | Pas de pénalité |
| Jusqu'au double de la limite | −1 Mouvement (min 3), −10 en Agilité, +1 Fatigue du voyage |
| Jusqu'au triple de la limite | −2 Mouvement (min 2), −20 en Agilité, +2 Fatigue du voyage |
| Plus de ×3 | Impossible de se déplacer |

**Fatigue du Voyage** : États *Exténué* accumulés à la **fin d'une journée de voyage**, annulés
uniquement par un long repos. LDB 61 l.47-48.

**Cumul avec marche forcée** : LDB 61 l.33

> « chaque fois que vous gagnez un État *Exténué* en étant Surchargé, pour une raison autre que la
> Surcharge, gagnez +1 État supplémentaire. »

Donc marche forcée (Test Résistance raté) + surchargé = +1 (marche forcée) +1 (cumul) = +2 Exténué.
C'est ce que confirme LDB 51 l.195 (« État *Exténué* supplémentaire si Encombré »).

---

## Péripéties LdB

**Source :** LDB 51 l.200-225

Mécanisme : le MJ peut lancer **1d10 par jour** de voyage ; événement si résultat **= 8** (le
symbole à 8 pointes du Chaos). Certains MJ préfèrent 1 événement par voyage ≥ 1 jour. LDB 51 l.209.

| 1d10 | Péripétie |
|:---:|---|
| 1 | **Voyage reposant** : guérit toutes Blessures, retire tous les États *Exténué*. |
| 2 | **Quelque chose d'intéressant** : rencontre fortuite, auberge de qualité, ruines. |
| 3 | **À présent, c'est utile !** : ragot, message perdu, scène dont les PJ ne devaient pas être témoins. |
| 4 | **Voyage éreintant** : route bloquée (pont effondré, inondation…). Test **Survie en extérieur Accessible (+20)** pour un itinéraire de remplacement ; sinon +1 jour + *Exténué*. |
| 5 | **Poursuivis !** : un ennemi retrouve la trace des PJ ; confrontation ou détour de quelques jours. |
| 6 | **Voleurs !** : les PJ se font dévaliser. |
| 7 | **Pas encore !** : rival ou contrariété mineure, ennuyeuse mais pas violente. |
| 8 | **Mauvaise influence !** : compagnon de route aux intentions sinistres. |
| 9 | **Même la nature vous déteste !** : danger naturel (animaux, orages, maladies, insectes). |
| 10 | **Attaqués !** : attaque pendant le voyage. Test **Perception Accessible (+20)** raté → embuscade. |

---

## Système par Étapes (EDOC — optionnel)

**Source :** EDOC 08 (ch.5 Voyager) — règles optionnelles qui *enrichissent* LDB 51 sans le remplacer.

### Nombre d'Étapes

**Source :** EDOC 08 l.8-19

- Déterminé par le MJ ; courts voyages = 1 Étape, villes importantes = 2-4, très longs = davantage.
- **M ≤ 3** du plus lent → +1-2 Étapes.
- **M ≥ 6** pour toute la troupe → ÷2 Étapes (min 1).
- Test **Orientation Intermédiaire (+0)** ou Savoir (région) réussi → −1 Étape (min 1).
- Carte correcte de l'itinéraire → Test **Accessible (+20)**.

### Météo par Étape

**Source :** EDOC 08 l.53-62 (verbatim du tableau + effets l.55-94)

Jet au début de chaque Étape (d100) :

| Météo | Printemps | Été | Automne | Hiver |
|---|:---:|:---:|:---:|:---:|
| Temps sec | 01–10 | 01–40 | 01–30 | — |
| Beau temps | 11–30 | 41–70 | 31–60 | 01–10 |
| Pluie | 31–90 | 71–95 | 61–90 | 11–60 |
| Pluie diluvienne | 91–95 | 96–00 | 91–98 | 61–65 |
| Neige | 96–00 | — | 99–00 | 66–90 |
| Blizzard | — | — | — | 91–00 |

Ajustements : régions plus au nord → +10 à +30 ; plus au sud → −10 à −30. EDOC 08 l.64.

**Effets météo :**

| Météo | Effets |
|---|---|
| **Temps sec** | −10 à Approvisionnement (eau rare). |
| **Beau temps** | Aucun danger météo. |
| **Pluie** | Visibilité ≤ 25 m ; armes à distance −10. |
| **Pluie diluvienne** | −10 tous Tests physiques ; armes à distance −20 ; poudre inutilisable. |
| **Neige** | Visibilité ≤ 45 m ; max marche ; Test **Résistance Accessible (+20)** ou *Exténué*. |
| **Blizzard** | Visibilité ≈ 0 ; max marche ; armes à distance inutiles ; Test **Résistance Intermédiaire (+0)** ou *Exténué*. |

### Option « Attraper Froid »

**Source :** EDOC 08 l.88-92

Fin de chaque Étape : tout PJ exposé à pluie ou neige sans **manteau ET tente** → Test **Exposition**
(LDB p.181). Pluie diluvienne/blizzard : Test même avec les deux. Manteau *ou* tente manquant →
Complexe (−10) ; les deux manquants → Difficile (−20). Hiver ou printemps après échec → **Rhume
commun** (EDOC 08 l.110-122).

### Activités de Voyage (1 par Étape)

**Source :** EDOC 08 l.129-180

Échec à un Test pendant une Activité → +1 *Exténué*.

| Activité | Test | Effet réussite |
|---|---|---|
| **Plein Air** | Survie en extérieur Intermédiaire (+0) −10/degré depuis Beau temps | Dispense le groupe du Test d'Exposition. |
| **Approvisionnement** | Survie en extérieur (règle « Trouver nourriture ») | Chaque DR = +1 personne nourrie. |
| **Recueillir des informations** | Ragot Intermédiaire (+0) | Autant de questions au MJ que de DR. |
| **Rester aux Aguets** | Perception Intermédiaire (+0) | Groupe insurprisable cette Étape. |
| **Établir des Cartes** | Test étendu Métier (Cartographe) ou Art (Dessin), DR requis = 2 × nb Étapes | Carte → Tests Savoir/Orientation Accessibles (+20) lors de futurs voyages. |
| **Pratiquer une Compétence** | Test Intermédiaire (+0) d'une compétence praticable en voyage | Peut inverser un jet sur cette compétence lors de la prochaine aventure ou Étape. |
| **Récupérer** | (Aucun test) — condition : pas d'*Exténué* cette Étape | Compte comme repos (guérison de Blessures). |
| **Monter un Camp** | Survie en extérieur ou Guérison Intermédiaire (+0) | Chaque DR = retirer 1 *Exténué* d'un PJ OU guérir PB. |

### Provisions en voyage

**Source :** EDOC 08 l.45-46

> « Les Personnages et leurs montures consomment **1 Encombrement en nourriture par jour**, pour un
> coût de 2/–. »

---

## Poursuites

**Source :** LDB 15 l.87-109

### Procédure en 4 étapes

**Étape 1 — Déterminer la Distance initiale**
Le MJ choisit une valeur de **Distance** (1 à 8) :
- 1 = presque à portée
- 4 = avance confortable
- 8 = presque hors de portée

**Étape 2 — Test de Mouvement**
Chaque participant effectue un Test adapté aux circonstances :
- À pied → **Athlétisme**
- À cheval → **Chevaucher**
- En véhicule → **Conduite d'attelages**

**Étape 3 — Actualiser la Distance**
Comparer le **DR le plus bas** des poursuivis au **DR le plus haut** des poursuivants.
- Si les poursuivis l'emportent : Distance augmente de la différence.
- Si les poursuivants l'emportent : Distance diminue de la différence.

**Étape 4 — Déterminer l'issue**
- Distance ≤ 0 : rattrapés. Option : les poursuivis peuvent **sacrifier le plus lent** d'entre eux ;
  les poursuivants choisissent qui s'arrête pour l'affronter et qui continue.
- Distance ≥ 10 : fuite réussie, poursuite terminée.
- Distance 1–9 : retour à l'Étape 2.

### Modificateurs de Mouvement

**Source :** LDB 15 l.105-108

Si un participant a un **M supérieur** aux autres, il gagne autant de **DR bonus** que la différence.

> Exemple : Poursuivant M 5 vs poursuivi M 4 → +1 DR bonus au test de poursuite.
> Exemple : Perdita (cheval M 8) vs Bandit 1 (M 7) vs Bandit 2 (M 9) → Perdita +1 DR, Bandit 2 +2 DR.

---

## Voir aussi

- [`combat.md`](combat.md) — Charge, Désengagement, Fuite, Avantage, Escalade, Saut, Chute,
  Poursuite en combat, Combat Monté (règles de base).
- [`etats.md`](etats.md) — État *Exténué* (accumulation et récupération).
- [`traumatisme.md`](traumatisme.md) — Blessures Critiques (Fracture Majeure d'une patte).
- [`tests.md`](tests.md) — Difficulté des Tests (Accessible +20, Intermédiaire +0, etc.).

---

## Implémente

| Module | Ce qu'il couvre |
|---|---|
| `src/engine/travel.ts` | Vitesse de groupe (`partyWalkSpeed`), `travelSpeed`, `travelPlanCalc`, `transportCost`, `forcedMarchTest`/`applyForcedMarch`, `applyTravelFatigue`. Transports payants lus depuis `src/data/transports.json`. |
| `src/engine/travelStages.ts` | Système par Étapes EDOC : `stageCount`, météo (`WEATHER_TABLE`), `stageExposureDifficulty`, `forageYield`, `pleinAirModifier`, `forageWeatherModifier`, saisons (calendrier impérial). |
| `src/engine/provisions.ts` | Faim (LDB 18 l.337-343) : consommation/jour, Test Résistance, malus, Brouet. |
| `src/engine/encumbrance.ts` | `effectiveMovement(c)` (M après pénalités Enc), `encumbrancePenalties()` (tiers + travelFatigue). |
| `src/state/travelFlow.ts` | Voyage jour par jour, `TravelPlan` + reprise, `TravelRecap`, cascade influençable de marche forcée, sous-système Étapes optionnel. |
| `src/data/transports.json` | Table des transports payants RAW (Diligence/Barge/Fiacre/Ferry), éditable au Compendium. |
| `src/data/peripeties.ts` | Table des péripéties de voyage (1d10, verbatim LDB 51 l.212-222). |

### Écarts code ↔ RAW relevés

| Point | RAW | Code | Statut |
|---|---|---|---|
| Plafond marche forcée | Canon muet | 10 h/j par défaut (paramétrable) | Choix documenté dans `TRAVEL_DEFAULTS.forcedMaxHours`. |
| Barges + courant | ±30 % | Implémenté via `route.speed[mode]` | Conforme. |
| Péripétie seuil d10 | « événement sur un résultat de 8 » | `perilDie = 8` (0 = désactivé) | Conforme. |
| Vitesse monture en km/h | M × 1,5 / 2,5 / 3 (EDOC) | Non dans `travel.ts` (montures traitées comme transport dont M = Mouvement de la monture) | Simplification acceptable ; la vitesse EDOC reste disponible pour authoring si besoin. |
| Endurance monture (allures) | EDOC ch.4 : BE heures au trot, ½ BE au galop | Non implémenté (combat uniquement) | Hors périmètre actuel. |
| Tableau Incidents de Monte | EDOC ch.4 | Non implémenté | Hors périmètre actuel. |
| Véhicules (Problèmes de Véhicule) | EDOC ch.4 | Non implémenté | Hors périmètre actuel. |
