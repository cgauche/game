# Atlas RAW — Équipement, objets & encombrement

> Référentiel **autosuffisant** des règles WFRP4 (RAW), consolidé sur les livres autorisés, à usage
> d'agent (répondre + auditer le code sans rouvrir les livres). Chaque règle cite `LDB NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source).
> Abréviations : [`sources.md`](sources.md). Index : [`00-index.md`](00-index.md).
>
> **Périmètre de ce fichier** : Encombrement, qualités/défauts d'objet, Disponibilité/fabrication
> (→ renvoi `economie.md`), Drogues & Poisons (LDB 71), Herbes & Potions (LDB 72), Prothèses (LDB 73),
> Outils à effet mécanique (LDB 67), Possessions diverses à effet (LDB 74).
> Armes → [`combat.md`](combat.md). Armures → [`combat.md`](combat.md).
> Encombrement voyage + pénalités Mouvement → [`deplacement.md`](deplacement.md) (table complète là-bas).
> Prix / Disponibilité / Fabrication → [`economie.md`](economie.md).

## Sommaire

- [Encombrement — calcul et seuils](#encombrement-calcul-et-seuils)
- [Encombrement — pénalités (Surchargé)](#encombrement-penalites)
- [Encombrement — règles spéciales](#encombrement-regles-speciales)
- [Qualités d'objet — Atouts et Défauts → voir economie.md](#qualites-renvoi)
- [Drogues et poisons](#drogues-et-poisons)
- [Herbes et potions](#herbes-et-potions)
- [Prothèses](#protheses)
- [Outils et nécessaires à effet mécanique](#outils-et-necessaires)
- [Possessions diverses à effet](#possessions-diverses-a-effet)
- [Catalogue banal — à transcrire séparément](#catalogue-banal)
- [Voir aussi](#voir-aussi)
- [Implémente (refs code)](#implemente-refs-code)

---

## Encombrement — calcul et seuils

**Source : LDB 61 l.4–17**

> Verbatim LDB 61 l.4 : « Le nombre de Points d'Encombrement que vous pouvez gérer sans pénalité est
> déterminé par votre Bonus de Force + votre Bonus d'Endurance. »

**Capacité sans pénalité** = **Bonus de Force (BF) + Bonus d'Endurance (BE)**

*Exemple* : humain moyen (F 30, E 30) → BF 3 + BE 3 = **6 Points d'Enc**.

### Exemples d'Encombrement (LDB 61 l.8–16)

| Enc | Possessions types |
|---|---|
| 0 | Couteaux, pièces, bijoux |
| 1 | Épée, mandoline, besace |
| 2 | Épée longue, tente, sac à dos |
| 3 | Hallebarde, tonneau, grand sac |

---

## Encombrement — pénalités (Surchargé)

**Source : LDB 61 l.33–43**

> Verbatim LDB 61 l.33 : « Les Personnages qui dépassent leur capacité d'Encombrement peuvent être
> ralentis, et seront fatigués par le voyage. La réduction de Mouvement et la Fatigue du voyage
> résultant de l'Encombrement se cumulent avec toutes les pénalités d'Armure. »

| Enc porté | Pénalité |
|---|---|
| ≤ capacité | Pas de pénalité |
| ≤ 2 × capacité | −1 Mouvement (min 3), −10 Agilité, +1 Fatigue du voyage |
| ≤ 3 × capacité | −2 Mouvement (min 2), −20 Agilité, +2 Fatigue du voyage |
| > 3 × capacité | Immobilisé (« Vous ne pouvez pas vous déplacer ») |

**États Exténué bonus** : chaque fois qu'un personnage Surchargé gagne un État *Exténué*
pour une raison autre que la Surcharge elle-même, il gagne **+1 État supplémentaire**
(LDB 61 l.33).

**Pénalités de Mouvement** : appliquées **immédiatement** ; disparaissent seulement en se
débarrassant d'équipement (LDB 61 l.43).

**Fatigue du voyage** : États *Exténué* accumulés **en fin de journée de voyage** ;
ne s'annulent qu'avec un long repos (LDB 61 l.47).

> Voir [`deplacement.md`](deplacement.md) §§ « Encombrement et fatigue de voyage »
> pour l'intégration dans la cascade de voyage.

---

## Encombrement — règles spéciales

**Source : LDB 61 l.16–29**

### Bêtes de somme (LDB 61 l.16–19)

Les animaux de trait (mules, chevaux, charrettes, chariots) **ignorent** la formule
BF + BE ; leur capacité est listée dans leur description (champ `Contenu`).
Chaque passager de taille humaine compte pour **~10 Points d'Enc** (modulable par le MJ).

### Objets portés (LDB 61 l.21)

Les objets **portés** (armures, vêtements, bijoux) voient leur Encombrement **réduit de 1**,
comptant souvent à **0** quand ils sont portés.

> Exception LDB 60 l.62 (Défaut « Volumineux ») : une armure/vêtement Volumineux compte
> **Enc 1 même porté** ; ses pénalités de Fatigue sont **×2**. Voir [economie.md §Fabrication](economie.md).

### Objets surdimensionnés (LDB 61 l.24–25)

Certains objets valent **4 Enc ou plus** (barils, fontes de selles…).
- En principe, on ne peut transporter **qu'un seul** objet surdimensionné.
- Cela nécessite **les deux mains**.

### Petits objets — monnaie (LDB 61 l.28–29)

> Verbatim LDB 61 l.29 : « la monnaie vaut 1 Point d'Encombrement pour 200 pièces. »

Le bon sens dicte le nombre de petits objets transportables.

---

## Qualités d'objet — Atouts et Défauts (renvoi)

Les règles de **Fabrication** (Atouts Léger/Pratique/Raffiné/Solide, Défauts Bâclé/Laid/Peu Fiable/
Volumineux) sont dans **[`economie.md`](economie.md) § Fabrication (LDB 60 l.10–92)**.

L'effet Encombrement des Atouts/Défauts est intégré ci-dessus (§ Objets portés et § Objets surdimensionnés).

---

## Drogues et poisons

**Source : LDB 71 l.5–57**

> LDB 71 l.5 : « Les drogues récréatives, bien qu'elles ne soient pas illégales dans la majeure
> partie de l'Empire, sont fréquemment associées aux rituels douteux et au Culte de Sigmar. »
> « Le poison n'est pas illégal non plus, mais en posséder soulève inévitablement des questions sur
> l'utilisation prévue. »

Toutes ces substances ont **Enc 0**.

### Drogues récréatives

#### Bave (1 CO, Rare)
Hallucinogène extrait d'oursins caméléons des marais. Donne des visions d'un désir profond
(amour perdu, ami décédé, enfant disparu).

- Effet : Test d'**Endurance Très difficile (−30)** ou perdu dans un fantasme réaliste
  (géré par le MJ).
- **Durée** : 1d10 minutes.

#### Bonnet de fou (5 CO, Exotique)
Champignons hallucinogènes consommés par les gobelins fanatiques avant la bataille.

- Effet : +10 Force, +4 Blessures, Talent **Frénésie**.
- En fin d'effet : perd **1d10 Points de Blessure**.
- Non peaux-vertes : Test de **Résistance Intermédiaire (+0)** ou **Infection mineure**.
- **Durée** : actif tant que mâché + 2d10 minutes supplémentaires.

#### Délice de Ranald (18/–, Limitée)
Stimulant très addictif, composé synthétique (soufre, mercure…). Inhalé en poudre.

- Effet immédiat : +1 Mouvement, +10 en F / E / Ag / CC.
- Effet différé (après 3 heures) : −2 Mouvement, −20 en CC / E / F / Ag.
- **Durée** : 1 jour.

#### Fleur de lune (5 CO, Limitée)
Mousse séchée de la forêt Laurelorn. Utilisée comme tranquillisant et anesthésique.

- Effets sur les elfes : +30 aux Tests pour résister à la Peste noire.
- Effets sur les autres races (vapeurs inhalées) :
  - Test de **Force Mentale Très difficile (−30)** raté → État *Inconscient*.
  - Réussi : +20 aux Tests de Calme + 1 État *Exténué*.
- **Durée** : 1d10 + 5 heures.

#### Mystracine (4/–, Rare)
Drogue de rue courante. Mâchée pour euphorie et hallucinations.

- Effet : +10 aux Tests d'Endurance et de Force Mentale ; −10 aux Tests d'Agilité,
  d'Initiative et d'Intelligence.
- **Durée** : active tant que mâchée + 1d10 × 10 minutes supplémentaires.

#### Racine de mandragore (1 CO, Rare)
Substance hallucinogène extrêmement addictive. Pousse sous les potences.

- Effet : chaque Round, Test de **Force Mentale** pour effectuer une Action ou un Mouvement
  (un au choix). Mouvement réduit de moitié. +20 aux Tests de Calme.
- **Durée** : active tant que mâchée + 1d10 × 10 minutes supplémentaires.

### Poisons

#### Brise-cœur (40 CO, Exotique)
Combinaison du venin d'Amphisbaena et de Jabberslythe. Inodore et incolore.

- Effet : ingéré → **4 États *Empoisonné*** infligés.
- Antidote : Test de **Résistance Complexe (−10)**.

#### Lotus noir (20 CO, Exotique)
Sève d'une plante des jungles des Terres du Sud. Utilisée pour enduire les lames.

- Effet : toute victime subissant au moins **1 Point de Blessure** d'une lame
  enduite reçoit immédiatement **2 États *Empoisonné***.
- Antidote : Test de **Résistance Complexe (−10)**.

### État Empoisonné — mécanique (rappel, LDB 16)

> Voir [`etats.md`](etats.md) § Empoisonné pour la mécanique complète.

Synthèse : chaque Point de Blessure infligé par Empoisonné ignore les modificateurs.
Test de **Résistance** en fin de Round : succès → retire 1 + DR pions d'Empoisonné,
mais gagne 1 État *Exténué*.

---

## Herbes et potions

**Source : LDB 72 l.3–44**

> LDB 72 l.25 : « Les herbes médicinales peuvent être achetées ou cueillies dans la nature (voir
> Trouver de la nourriture et des herbes page 131). Une préparation avec des Outils de profession
> (Herboriste) est en général nécessaire pour extraire les principes médicinaux des plantes et
> concocter des cataplasmes. Les potions peuvent être brassées en utilisant la Compétence
> Métier (Apothicaire). »

Toutes ces substances ont **Enc 0**.

### Table (LDB 72 l.26–32)

| Objet | Coût | Disponibilité |
|---|---|---|
| Belladone | 3 CO | Rare |
| Cataplasme de guérison | 12/– | Commune |
| Faxtoryll | 15/– | Exotique |
| Potion de guérison | 10/– | Limitée |
| Potion de vitalité | 18/– | Limitée |
| Racine de terre | 5 CO | Limitée |
| Soude commune | 12/– | Commune |
| Tonique digestif | 3/– | Commune |

### Effets

#### Belladone (3 CO, Rare)
Plonge la victime dans un profond sommeil au bout de 2-3 heures, sauf si elle réussit
un Test de **Résistance**.

- Sommeil induit : **1d10 + 4 heures**.
- **Dose** : 1 par personne.

#### Cataplasme de guérison (12/–, Commune)
Bande médicinale à base d'excréments et d'urine animaux + herbes communes
(sigmafoil, tarrabeth, valériane).

- Effet : **aucune Infection mineure** ne résulte d'une Blessure Critique traitée avec ce cataplasme.

#### Faxtoryll (15/–, Exotique)
Coagulant végétal appliqué sur une plaie.

- Effet : retire **tous les États *Hémorragique*** sans Test de Guérison.
- **Dose** : 1 par Blessure Critique.

#### Potion de guérison (10/–, Limitée)
> Verbatim LDB 72 l.24 : « si vous avez plus de 0 Blessure, récupérez immédiatement un nombre
> de Points de Blessure égal à votre Bonus d'Endurance. »

- Condition d'usage : avoir > 0 Blessure.
- Soin : = **Bonus d'Endurance** du buveur.
- **Dose** : 1 par rencontre.

#### Potion de vitalité (18/–, Limitée)
> Verbatim LDB 72 l.28 : « boire cette décoction retire instantanément tous les États *Exténué*. »

- Effet : retire **tous** les pions *Exténué*.

#### Racine de terre (5 CO, Limitée)
Ingérée pour annuler les effets de bubons causés par la Peste noire.

- Effet : annule les bubons de Peste noire (l'odeur persiste). +10 à tous les Tests concernant la maladie.
- **Dose** : 1 par jour.

#### Soude commune (12/–, Commune)
Branche écrasée maintenue sous le nez.

- Effet : retire **1 État *Sonné***.
- **Dose** : 1 par rencontre.

#### Tonique digestif (3/–, Commune)
- Effet : +20 aux Tests pour se remettre de maux d'estomac (Courante galopante, Flux sanglant — LDB 20).

---

## Prothèses

**Source : LDB 73 l.4–32**

> LDB 73 l.4 : « Que ce soit à cause d'une maladie, de la guerre ou de la malchance, il est assez
> courant dans l'Empire de perdre une partie de son corps. »

> LDB 73 l.5 : « Toutes les prothèses ont un Encombrement de 0 quand elles sont portées. »

### Table (LDB 73 l.7–18)

| Objet | Coût | Enc (non porté) | Disponibilité |
|---|---|---|---|
| Cache-œil | 6 sc | 0 | Commune |
| Crochet | 3/4 | 1 | Commune |
| Dents en bois | 10/– | 0 | Rare |
| Fausse jambe | 16/– | 2 | Limitée |
| Merveille d'ingénierie | 20 CO | 1 | Exotique |
| Nez doré | 18/– | 0 | Limitée |
| Œil de verre | 1 CO | 0 | Rare |

### Effets

#### Cache-œil (6 sc)
Souvent décoratif. Recouvre un globe oculaire meurtri. Pas d'effet mécanique propre.

#### Crochet (3/4, Commune)
Remplace une main manquante.

- Pénalité de base : **−20** à tous les Tests impliquant deux mains.
- Réduction de la pénalité : pour **100 PX** chaque tranche de 5 points soustraite.
  Pénalité entière supprimée pour **400 PX**.
- En combat : le Crochet est considéré comme une **Dague**.

#### Dents en bois (10/–, Rare)
Souvent magnifiquement sculptées. Ignorent **toutes les pénalités** dues à la perte de dents.

#### Fausse jambe (16/–, Limitée)

> LDB 73 l.23 : « une fausse jambe (ou juste un faux pied, pour la moitié du prix) vous permet
> d'ignorer 1 Point de Mouvement perdu par la perte de votre membre. »

- Faux pied uniquement : **moitié du prix** (8/–).
- Ignore **1 Point de Mouvement** perdu.
- Pour **100 PX** : récupère le dernier Point de Mouvement perdu (entraînement).
- Pour **200 PX** supplémentaires : réapprend **Esquive** (perdue avec la jambe).
- Condition : ne pas perdre la fausse jambe elle-même.

#### Merveille d'ingénierie (20 CO, Exotique)
Prothèse à vapeur commandée à une Guilde d'Ingénieurs.

- Ignore complètement la perte d'une oreille, d'une main, d'un bras ou d'une jambe
  (tant que la machinerie fonctionne).
- Si la Merveille subit une **Blessure Critique** : tombe en panne automatiquement.
  Réparation : **≥ 10 % du prix de base** (selon la Blessure).

#### Nez doré (18/–, Limitée)
Souvent en bois ou céramique (le terme « doré » est resté).

- Ignore la perte de **Sociabilité** due à l'absence de nez.

#### Œil de verre (1 CO, Rare)
Du bois au verre poli. Pas d'effet mécanique propre (cosmétique).

---

## Outils et nécessaires à effet mécanique

**Source : LDB 67 l.3–63**

> LDB 67 l.3 : « La majorité des outils sont considérés comme des armes Improvisées quand ils sont
> utilisés durant un combat. Cependant les MJ peuvent décider que des outils lourds ou tranchants
> (par exemple les pieds-de-biche et les faucilles) comptent comme des Armes de poing. »

Seuls les outils conférant un **bonus ou effet de règle** sont listés ici. Les listes de prix
complètes (aiguille, balai, binette…) relèvent du catalogue banal.

### Outils à effet

#### Bésicles (3 CO, Rare ; Enc 0)
> LDB 67 l.7 : « confèrent un bonus de +20 aux Tests de Lire/Écrire pour déchiffrer une écriture
> minuscule ou inintelligible. »

+20 aux Tests de **Perception** pour chercher des détails précis (porte/compartiment secret).

#### Menottes (18/–, Limitée ; Enc 0)
> LDB 67 l.11 : « les prisonniers qui essaient de se libérer de menottes subissent 1 Blessure et
> doivent réussir un Test de Force Très difficile (−30). »

#### Nécessaire antipoison (3 CO, Limitée ; Enc 0)
Contient : petit couteau + herbes + bocal de sangsue.

> LDB 67 l.13 : « Un Test de Guérison réussi avec un nécessaire antipoison retire tous les États
> *Empoisonné*. Le traitement prend au moins deux Rounds. »

#### Nécessaire de déguisement (6/6, Limitée ; Enc 0)
Pas de bonus chiffré dans LDB 67 — l'usage relève de la Compétence **Tromperie** (LDB 09).
Inclus pour mémoire (référencé dans les Carrières).

#### Outils de crochetage (15/–, Limitée ; Enc 0)
Requis pour tenter **Crochetage de serrure** (LDB 09 — Dextérité). Sans eux : pénalité ou impossibilité selon le MJ.

#### Télescope (5 CO, Rare ; Enc 0)
Pas de bonus RAW chiffré dans LDB 67 — effet à discrétion du MJ (amélioration de Perception à distance).

### Principe général : Outils de profession

Les Outils de profession et les Ateliers (LDB 69) sont **requis** pour la plupart des Activités
professionnelles (Artisanat, Soins, Herboristerie, Alchimie…). L'absence d'outil approprié
entraîne une **impossibilité ou une pénalité de Test** fixée par le MJ.
Détail complet → [`activites.md`](activites.md) § Artisanat.

---

## Possessions diverses à effet

**Source : LDB 74 l.5–78 (début de section « Possessions Diverses »)**

Les objets divers sans effet mécanique (affiche, allumette, assiette…) relèvent du catalogue banal.
Seuls les effets chiffrés sont transcrits ici.

#### Bandages (4 sc, Commune ; Enc 0)
> LDB 74 l.41 : « un Test de Guérison ou de Dextérité réussi retire +1 État *Hémorragique*
> supplémentaire. »

*Note* : l'effet « Objet porté lors d'un soin : pas d'Infection » relève du Cataplasme de guérison
(LDB 72), pas des Bandages seuls.

#### Bougie / douzaine (1/–, Commune ; Enc 0)
> LDB 74 l.43 : « fournit un éclairage sur **10 mètres** lorsqu'elle est allumée. »

#### Lanterne (2/–, Commune ; Enc 1)
> LDB 75 l.4 : « fournit un éclairage sur **20 mètres**. »

#### Lampe tempête (5/–, Peu commune ; Enc 1)
> LDB 75 l.4 : « des obturateurs protègent la flamme du vent, et permet également de diriger la lumière dans un arc de 90° ou de l'obscurcir complètement. Fournit un éclairage sur 20 mètres, ou 30 quand il est ciblé. »

---

### Éclairage — récapitulatif mécanique

| Source | Rayon standard | Rayon ciblé | Ref |
|---|---|---|---|
| Bougie (ou équivalent) | 10 m | — | `LDB 74 l.43` |
| Lanterne | 20 m | — | `LDB 75 l.4` |
| Lampe tempête | 20 m | 30 m (arc 90°) | `LDB 75 l.4` |

Échelle moteur : 1 case = 2 m → Bougie = 5 cases, Lanterne = 10 cases, Lampe tempête 10/15 cases.

Le Talent **Vision nocturne** étend le rayon effectif de toute source de lumière de **+20 m / niveau** (`LDB 11 l.176`).

**Sources RAW :** `LDB 74 l.43` (Bougie), `LDB 75 l.4–15` (Lampe tempête, Lanterne)

**Voir aussi :** `talents.md` § Vision nocturne — extension de portée d'éclairage.

**Implémente :** `src/state/vision.ts` — `CANDLE_RADIUS` (10 m / 2 = 5 cases), `LANTERN_RADIUS` (20 m / 2 = 10 cases) ; `lightLevels.json` (éclairage par scène / prop).

#### Grappin (1 CO, Limitée ; Enc 1)
> LDB 74 l.45 : « couplé à une corde, il permet de gravir des surfaces inaccessibles. »

Utilisé avec Corde (Enc 1, 8/4 la corde de 10 m). Test d'Athlétisme selon MJ.

---

## Catalogue banal — à transcrire séparément

Les chapitres suivants contiennent essentiellement des **listes de prix** sans règle propre :

| Chapitre LDB | Contenu | Traitement |
|---|---|---|
| **64** — Sacs et contenants | Besaces, sacs à dos, coffres… + capacité (Contenu en Enc) | Catalogue — Disponibilité et Contenu utiles pour l'éditeur |
| **65** — Vêtements et accessoires | Chemises, manteaux, bottes, bijoux… | Catalogue banal |
| **66** — Nourriture, boisson et hébergement | Rations, bière, auberge/pension… | Catalogue + règles Faim → [`activites.md`](activites.md) |
| **68** — Livres et documents | Cartes, parchemins, journaux intimes… | Catalogue banal |
| **69** — Outils professionnels et Ateliers | Kits par métier (Forgeron, Herboriste…) | Catalogue — requis pour les Activités (voir `activites.md`) |
| **74** — Possessions diverses | Objet courant (corde, tente, sac de couchage…) | Catalogue — exceptions à effet listées ci-dessus |
| **75** — Mercenaires | Coût journalier / hebdomadaire + bonus | Catalogue de PNJ recrutables |
| **70** — Animaux et véhicules | Montures, véhicules, animaux de trait + Contenu | Catalogue + règles montures → [`deplacement.md`](deplacement.md) |

---

## Voir aussi

- **Combat** [`combat.md`](combat.md) — armes, armures, dégâts d'arme, dégâts d'armure
- **Déplacement** [`deplacement.md`](deplacement.md) — Mouvement, Encombrement et fatigue voyage,
  montures, véhicules
- **Économie** [`economie.md`](economie.md) — prix, Disponibilité, Marchandage, Fabrication (Atouts/Défauts)
- **États** [`etats.md`](etats.md) — Empoisonné, Hémorragique, Exténué, Sonné (mécaniques complètes)
- **Maladies** [`maladies.md`](maladies.md) — Infection mineure, Peste noire, Courante galopante…
- **Activités** [`activites.md`](activites.md) — Soins, Artisanat, Trouver de la nourriture et herbes

---

## Implémente (refs code)

| Ref source | Fichier | Mécanique |
|---|---|---|
| `LDB 61 l.4` | `src/engine/items.ts` : `maxEncumbrance` | Capacité = BF + BE + bonus talent Robuste |
| `LDB 61 l.21` | `src/engine/items.ts` : `totalEncumbrance` l.205 | Objet porté : Enc −1 (armure/vêtement) |
| `LDB 60 l.18/91` | `src/engine/items.ts` : `totalEncumbrance` l.202 | Léger −1 / Volumineux +1 via `craftEncDelta` |
| `LDB 61 l.33–43` | `src/engine/encumbrance.ts` : `encumbrancePenalties` | Table seuils 0/1/2/3× → paliers Mouvement/Agilité/Fatigue |
| `LDB 61 l.43–43` | `src/engine/encumbrance.ts` : commentaires | Mouvement immédiat ; Fatigue = échelle voyage (fin de journée) |
| `LDB 62 l.27` | `src/engine/items.ts` l.269 | Mains nues : +BF+0, Personnelle, Inoffensive |
| `LDB 63 l.18–55` | `src/engine/items.ts` l.481 / `damageArmour` | PA nette = PA − dégâts pris ; endommagement armure |
| `LDB 72 l.5–6` (p.307) | `src/engine/consumables.ts` | Parsing desc `récupérer/Blessure` → soin (Bonus d'Endurance) ; parsing `retire … État` → retrait d'État |
| `LDB 72 l.24` | `src/engine/consumables.ts` : `parseConsumable` | Potion de guérison : Bonus d'Endurance, garde-fou poison/drogue |
| `LDB 72 l.28` | `src/engine/consumables.ts` + test | Potion de vitalité : retire tout *Exténué* |
| `LDB 74 l.41` | `src/engine/consumables.ts` : `removeStacks: 1` (Bandages) | +1 pion *Hémorragique* retiré (pas « tout ») |
| `LDB 18 l.262` | `src/engine/items.ts` l.309 | Amputation → pas d'arme à 2 mains |

**Fichiers engine** : `src/engine/encumbrance.ts`, `src/engine/items.ts`, `src/engine/consumables.ts`

**Store / State** : `src/state/partyFlow.ts` (`usePartyItem`), `src/state/combatFlow.ts` (`battleUseItem`)

**Données** : `src/data/trappings.json` (catalogue avec `enc`, `kind`, `desc`)

**Écarts code ↔ RAW** :
- **Drogues** (LDB 71 : Bave, Bonnet de fou, Délice de Ranald, Mystracine, Racine de mandragore)
  et **Poisons** (Brise-cœur, Lotus noir) : effets **non modélisés** dans le moteur.
  Les données sont dans `trappings.json` (desc verbatim) mais aucun `parseConsumable` ne les active
  (effets complexes : Tests à la consommation, modificateurs temporaires de carac, dégâts différés).
- **Prothèses** : Crochet (réduction pénalité par PX) et Fausse jambe (récupération Mouvement + Esquive)
  non suivis dans `src/engine/`. Le `Combatant` n'a pas de champ `prosthetics` — à implémenter si les
  Blessures Critiques permanentes sont jouées (LDB 18).
- **Nécessaire antipoison** : règle « retire tous les États Empoisonné après Test Guérison » non
  distincte dans le moteur (le Test Guérison retire Empoisonné via `poisonResistApply` en fin de Round,
  mais le nécessaire comme objet requis n'est pas vérifié).
- **Bésicles** : +20 Lire/Écrire et +20 Perception non intégrés (objet passif non géré).
