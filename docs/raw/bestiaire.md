# Atlas RAW — Bestiaire & Profils de créature

> Base de connaissance des **règles WFRP4 (RAW)**, consolidées sur les livres autorisés, à usage d'agent
> (vérifier que le code respecte le RAW). Chaque règle cite sa source `LIVRE NN l.X-Y`
> (NN = préfixe du fichier de chapitre, l = lignes du `.md` source). **Voir aussi** tisse les renvois
> entre règles ; **Implémente** pointe le(s) module(s) `src/` correspondant(s).
> Conventions d'abréviation : voir [`sources.md`](sources.md). Carte code→règle : [`code-map.md`](code-map.md).
>
> ⚠️ **Brouillon agent-généré** — fidélité contrôlée par une passe de vérification adversariale.
> Les entrées marquées y restent à corriger.

## Sommaire

- [Introduction au Bestiaire (LDB 76)](#introduction-au-bestiaire)
- [Localisation des créatures non humaines](#localisation-des-creatures-non-humaines)
- [Localisations alternatives (Serpents, Araignées)](#localisations-alternatives)
- [Traits Standard de créature](#traits-standard-de-creature)
- [Structure d'un profil de créature](#structure-dun-profil-de-creature)
- [Traits Facultatifs et personnalisation](#traits-facultatifs-et-personnalisation)
- [Taille : catégories, Blessures et modificateurs](#taille-categories-blessures-et-modificateurs)
- [Utiliser les Tailles (agrandir/réduire)](#utiliser-les-tailles)
- [Modificateurs de Taille en combat](#modificateurs-de-taille-en-combat)
- [Caractéristiques aléatoires (LDB 78)](#caracteristiques-aleatoires)
- [Index des Traits de créature (renvois)](#index-des-traits-de-creature)
- [Catalogue du bestiaire (à transcrire séparément)](#catalogue-du-bestiaire)
- [Bilan de fidélité](#bilan-de-fidelite)

- **La Mer des Griffes (MDG)** <!-- MDG-INTEGRATION -->
- Trait de créature : Créature marine (MDG) — `MDG 16 l.15-19`
- Trait Redoutable — variante de formulation (MDG, clause Avantage de groupe AA) — `MDG 16 l.9-13`

---

## Introduction au Bestiaire

**Source RAW** : `LDB 76 l.4-13`

Le chapitre 76 sert d'introduction au bestiaire WFRP4. Les créatures présentées sont des **exemples génériques représentatifs de leur espèce**. Le MJ est invité à les personnaliser en :

- utilisant les **caractéristiques** du chapitre ;
- ajoutant des **Compétences et des Talents** jugés nécessaires ;
- utilisant éventuellement le **système complet de Carrière** pour créer de terrifiants adversaires.

> « La façon la plus simple de le faire est d'utiliser les Traits de créature ; toutes les créatures possèdent un ou plusieurs Traits de créature standard, mais d'autres peuvent être ajoutés si besoin est, et peuvent être mêlés à des Compétences et des Talents, à votre convenance. » — `LDB 76 l.9-11`

Les **Traits Facultatifs** listés à côté de chaque créature représentent certains des Traits les plus courants de l'espèce. On peut cependant appliquer **n'importe quel Trait** à n'importe quelle créature si cela correspond au jeu voulu (`LDB 76 l.16-19`).

**Implémente** :
- `creatureToCombatant` (`src/state/spawn.ts`) — point d'entrée unique du spawn : lit `CreatureData` (bestiaire) + `SpawnExtras` (traits facultatifs d'auteur), fusionne traits, dérive carac/armes/armure/Blessures/psycho.
- `findCreatureById` (`src/data/index.ts`) — lookup bestiaire par id stable.

---

## Localisation des créatures non humaines

**Source RAW** : `LDB 76 l.22-45`

En principe, déterminer une **Localisation** pour une créature non humaine est simple :

- **Quadrupèdes** : remplacer les bras par les membres antérieurs, les jambes par les membres postérieurs.
- **Oiseaux** : remplacer les bras par les ailes.
- **Autres** : certaines créatures nécessitent une attention particulière → utiliser les **Localisations Alternatives** (voir section suivante).

> « Pour toute créature de 2 catégories plus grande que vous (voir Taille page 342), choisissez une Localisation correspondant à ce qui est le plus proche de vous (ou en Ligne de Vue pour tirer). » — `LDB 76 l.19-22`

> « Si un animal possède une Localisation sans Tableau de Critiques, comme un tentacule, une queue ou une aile, faites un jet sur le Tableau des Bras et décrivez le résultat de façon appropriée. » — `LDB 76 l.21-23`

**Voir aussi** : [Tableau de Localisation humanoïde](combat.md#tableau-de-localisation-humanoide) — `combat.md` ; Critiques et Frappe Mortelle — `combat.md`.

**Implémente** :
- `bodyShapeOf(name)` (`src/state/spawn.ts` l.29-38) — dérive la `BodyShape` (`humanoide`/`quadrupede`/`oiseau`/`serpent`/`araignee`) depuis le gabarit rig (`bodyPlanOf`). Les gabarits sans table canon (`céphalopode`/`amorphe`/`squig`/`spectral`/`jabberslythe`) retombent sur `humanoide` (table par défaut, pas d'invention).
- `aim-bigger.test.ts` (`src/state/aim-bigger.test.ts`) — teste le choix gratuit de localisation contre une cible ≥ 2 catégories plus grande (`LDB 76 l.40`).

---

## Localisations alternatives

**Source RAW** : `LDB 76 l.28-35` (tableaux)

| Serpents | | Araignées | |
|---|---|---|---|
| 01–19 | Tête | 01–09 | Tête |
| 20–00 | Corps | 10–79 | Pattes |
| | | 80–00 | Abdomen |

> Verbatim : `LDB 76 l.28-35`.

Ces deux tables remplacent la table humanoïde standard pour les morphologies concernées. Toutes les autres créatures — quadrupèdes, oiseaux, créatures à tentacules — utilisent le **tableau humanoïde réétiquetté** (membres antérieurs = bras, membres postérieurs = jambes, ailes = bras).

**Implémente** :
- Type `BodyShape` (`src/engine/types.ts`) : `'humanoide' | 'quadrupede' | 'oiseau' | 'serpent' | 'araignee'`. Le tableau de localisation utilisé en combat est sélectionné par `bodyShapeOf` sur ce type.

---

## Traits Standard de créature

**Source RAW** : `LDB 76 l.31-35`

Les Traits suivants sont ajoutés à la liste **Facultative de toutes les créatures** sans exception :

> *Animosité, Arme, Armure, Brutal, Coriace, Craintif, Élite, Endurant, Grand, Haine, Intelligent, Meneur, Préjugé, Rapide, Rusé*

> « La plupart des créatures possèdent une Arme indiquée en suggestion, et peut-être aussi une Armure, mais cela n'empêche pas de les modifier comme bon vous semble. » — `LDB 76 l.37`

Ces Traits dits « standard » peuvent donc être ajoutés à **n'importe quelle créature du bestiaire** sans justification spéciale, en dehors des Traits Facultatifs spécifiques à l'espèce.

**Voir aussi** : [Index des Traits de créature](#index-des-traits-de-creature) ; Traits Facultatifs.

**Implémente** :
- `TraitData.standard?: boolean` (`src/data/index.ts` l.378-380) — flag en donnée (`traits.json`) ; le picker de Traits Facultatifs dans l'éditeur l'utilise pour proposer tous les Traits standard sur n'importe quel bestiaire.

---

## Structure d'un profil de créature

**Source RAW** : `LDB 76 l.44-46` (Schéma des Profils du Bestiaire)

Un profil de créature comprend les champs suivants :

| Champ | Contenu |
|---|---|
| **Nom** | Nom de la créature |
| **Description** | Présentation narrative |
| **Attributs** | Les 12 Attributs (Caractéristiques) de la créature |
| **Traits** | Traits que la créature possède presque toujours |
| **Facultatif** | Traits courants que l'on peut ajouter lors de la création d'une version personnalisée |

Les **12 Attributs** = les 10 Caractéristiques standard (CC, CT, F, E, I, Ag, Dex, Int, FM, Soc) + **M** (Mouvement) + **B** (Blessures). Un « **–** » dans le profil imprimé indique une caractéristique **inexistante** (→ 0 en runtime ; pas de valeur de repli inventée).

> Le profil imprimé d'une créature inclut ses **Compétences** et **Talents** quand la créature a un comportement plus élaboré qu'une bête sauvage. Ces données sont traitées comme des données d'auteur (valeurs de Test imprimées → avances dérivées).

**Traits de créature** (LDB 85) : voir [Index des Traits de créature](#index-des-traits-de-creature) et `combat.md` § traits — toutes les définitions sont dans `LDB 85` ; seules les règles *systémiques* (Taille, Blessures, Localisations) sont dupliquées ici.

**Sources RAW** :
- `LDB 76 l.44-46` — schéma complet des champs d'un profil.
- `LDB 76 l.46` (spawn.ts l.163-164) — « – » du schéma = caractéristique inexistante → 0.

**Implémente** :
- `CreatureData` (`src/data/index.ts`) — type de donnée bestiaire : `char` (12 attributs), `traits: TraitInstance[]`, `skills?: SkillRef[]`, `talents?: TalentRef[]`, `appearance?`, `id`, `label`.
- `charsFrom(src, fallback=0)` (`src/state/spawn.ts` l.40-47) — dérive `Characteristics` en traitant « – » → 0 (fallback 0, pas 30 inventé).
- `skillsFromBook` / `talentsFromBook` (`src/state/spawn.ts` l.118-137) — PNJ nommés : valeur imprimée → avances = valeur − Carac.

---

## Traits Facultatifs et personnalisation

**Source RAW** : `LDB 76 l.11-13` (principe) + `LDB 76 l.45` (champ Facultatif)

Les Traits Facultatifs d'un profil représentent les variations courantes de l'espèce. L'auteur du scénario peut les choisir au moment de poser la créature dans une scène. Ils se **fusionnent avant toutes les dérivations** (armes, armure, psycho, Nuée, Taille optionnelle…).

Règle d'application des Traits Facultatifs modificateurs de profil (**Élite, Coriace, Brutal, Rapide…** — LDB 85) :
- Le **profil imprimé est final** pour les traits déjà inclus (« cuits »).
- Un Trait Facultatif **ajouté par l'auteur** s'applique en DIRECT via `liveTraits` (collecteur passif), sans modifier `characteristics` (base bestiaire) → pas de double-compte.

**Sources RAW** :
- `LDB 76 l.45` — « Traits Facultatifs : Traits de créature courants que vous pouvez ajouter si vous créez votre propre version. »
- `LDB 85 l.339-340` — « Utiliser les Tailles » (si la Taille Facultative change la catégorie → ±10 F/E, ∓5 Ag).

**Implémente** :
- `SpawnExtras.optionals?: TraitInstance[]` (`src/state/spawn.ts` l.141) — traits facultatifs choisis par l'auteur de scène, fusionnés avant dérivation.
- `creatureToCombatant` l.158-162 — fusion `[...creature.traits, ...optTraits]` avant tout.
- `liveTraits` (`Combatant`) — traits facultatifs modificateurs de profil appliqués en direct ; `withTraitChars` + `traitBonusWoundsBE` pour recalculer Blessures avec les facultatifs.
- `Scene.entities[].combat.optionals` (`src/state/scene.ts` l.141) — champ d'auteur éditable dans l'éditeur.

---

## Taille : catégories, Blessures et modificateurs

**Source RAW** : `LDB 85 l.343-406`

### Catégories de Taille

Sept catégories, de la plus petite à la plus grande (`LDB 85 l.343-344`) :

| Catégorie | Exemples |
|---|---|
| Minuscule | Papillon, souris, pigeon |
| Très Petite | Chat, faucon, bébé humain |
| Petite | Rat géant, halfling, enfant humain |
| **Moyenne** | **Nain, elfe, humain** — standard implicite des espèces jouables |
| Grande | Cheval, ogre, troll |
| Énorme | Griffon, vouivre, manticore |
| Monstrueuse | Dragon, géant, Prince démon |

> La Taille **Moyenne** est le standard implicite (pas de Trait Taille nécessaire pour les espèces jouables). — `LDB 85 l.344` + commentaire code `src/engine/size.ts` l.5-6.

### Blessures par Taille

Formule de base = **BF + 2×BE + BFM** (Taille Moyenne). Modificateurs par catégorie (`LDB 85 l.391-406`) :

| Taille | Blessures |
|---|---|
| Minuscule | 1 (fixe) |
| Très Petite | Bonus d'Endurance (BE) |
| Petite | (2×BE) + BFM |
| Moyenne | BF + (2×BE) + BFM |
| Grande | (BF + 2×BE + BFM) × 2 |
| Énorme | (BF + 2×BE + BFM) × 4 |
| Monstrueuse | (BF + 2×BE + BFM) × 8 |

> Verbatim : `LDB 85 l.391-406`.

Le trait **Endurant** ajoute +BE aux Blessures calculées (appliqué avant tout modificateur de Taille, `LDB 85`).

**Sources RAW** :
- `LDB 85 l.343-344` — sept catégories (table Taille/Exemples).
- `LDB 85 l.391-406` — Blessures par catégorie (table verbatim ci-dessus).

**Voir aussi** : [Modificateurs de Taille en combat](#modificateurs-de-taille-en-combat) ; [Taille dans combat.md](combat.md#taille-categories-et-modificateurs-de-combat) (récapitulatif en-combat, renvoi ici pour le détail des Blessures).

**Implémente** :
- `SizeCategory` / `SIZE_ORDER` / `SIZE_LABEL` (`src/engine/size.ts` l.9-46) — 7 catégories en ordinal 0..6.
- `woundsForSize(bf,be,bfm,size)` (`src/engine/size.ts` l.109-128) — formule exacte par catégorie.
- `effectiveSize(size?)` (l.49) — défaut Moyenne si absent.
- `maxWounds(chars,size)` (`src/engine/characteristics.ts`) — interface publique.
- `characteristics-size.test.ts` — 7 cas couvrant chaque catégorie (`LDB 85 l.391-406`).
- `traitBonusWoundsBE` (`src/engine/traits/dispatch.ts`) — détection du trait Endurant en Facultatif.

---

## Utiliser les Tailles

**Source RAW** : `LDB 85 l.339-340`

Pour agrandir une créature d'une catégorie de Taille (transformer par exemple une Araignée Géante en Araignée Gigantesque) :

> « Augmentez **F** et **E** de +10, et réduisez **Ag** de -5 par catégorie de taille supérieure. Inversez le procédé si vous voulez rendre une créature plus petite. » — `LDB 85 l.276-277`

Ces modificateurs s'appliquent **par catégorie d'écart**. Ils sont cumulatifs sur plusieurs catégories.

**Sources RAW** :
- `LDB 85 l.339-340` — règle d'agrandissement/réduction.

**Implémente** :
- `resizeBySteps(chars, steps, def=30)` (`src/engine/size.ts` l.142-145) — applique ±10 F/E et ∓5 Ag par cran d'écart ; retourne un nouvel objet (immuable). `def=30` = valeur de repli si la carac. est absente (statbloc partiel).
- `stepSize(size, steps)` (l.131-134) — décale la catégorie de `steps` crans, bornée [0..6].
- Usage spawn : `creatureToCombatant` (`src/state/spawn.ts` l.174-178) — Taille Facultative prime sur Taille du bestiaire ; si elle diffère, `resizeBySteps` applique l'écart.

---

## Modificateurs de Taille en combat

**Source RAW** : `LDB 85 l.357-387`

### Si la créature est plus grande

(`LDB 85 l.359-363`)

- Ses armes gagnent l'Atout **Dévastatrice** si elle est d'une catégorie supérieure.
- Ses armes gagnent aussi **Percutante** si elle est supérieure d'au moins **deux catégories**.
- Les Dégâts sont **multipliés par le nombre de catégories supérieures** (2 catégories = ×2, 3 = ×3…). Cette multiplication est calculée **après** application des autres modificateurs.
- Toutes les frappes réussies activent la règle optionnelle **Frappe Mortelle** (même si la cible survit, `LDB 85 l.362`).

### Si la créature est plus petite

(`LDB 85 l.364-367`)

- Elle gagne un **bonus de +10 pour toucher** (mêlée ET tir).

### Défense contre les grosses créatures

(`LDB 85 l.369-370`)

- Pénalité de **DR −2 par catégorie supérieure de l'adversaire** quand on utilise CC pour se défendre en Test opposé (il vaut mieux esquiver un Géant).

### Mouvement en combat

(`LDB 85 l.373-374`)

- Une créature plus grande **ignore la nécessité de se Désengager** : elle dégage les combattants de taille inférieure, se déplaçant où elle veut.

### Force Opposée

(`LDB 85 l.377-378`)

- Si la créature est **supérieure d'au moins 2 Tailles** → elle **gagne automatiquement** les Tests opposés de Force.
- Si elle est **supérieure de 1 Taille** → la plus petite doit obtenir un **Critique** pour pouvoir s'opposer.

### Peur et Terreur par Taille

(`LDB 85 l.382-383`)

Si la créature est considérée comme agressive, elle provoque :
- **Peur** chez toute créature plus petite qu'elle.
- **Terreur** chez toute créature plus petite d'**au moins deux catégories**.
- Le niveau de Peur/Terreur = différence de catégories (ex. Grande vs Petite = Terreur 2).

### Piétinement

(`LDB 85 l.386-387`)

Une créature plus grande peut effectuer une **Attaque de Piétinement comme Action Gratuite** au prix de **1 Avantage** quand elle frappe vers le bas sur un adversaire plus petit. L'attaque inflige **Bonus de Force +0** Dégâts et utilise la Compétence **Corps à corps (Bagarre)**.

> Verbatim extrait clé : `LDB 85 l.360-378` (voir Read source).

**Sources RAW** :
- `LDB 85 l.359-363` — Dévastatrice/Percutante, ×N Dégâts, Frappe Mortelle.
- `LDB 85 l.364-367` — +10 pour toucher (plus petit).
- `LDB 85 l.369-370` — pénalité −2 DR/catégorie en Parade.
- `LDB 85 l.373-374` — désengagement gratuit du plus grand.
- `LDB 85 l.377-378` — Force Opposée (autoWin ≥ +2 cat / needCrit +1 cat).
- `LDB 85 l.382-383` — Peur/Terreur par Taille.
- `LDB 85 l.386-387` — Piétinement (BF+0, Corps à corps Bagarre, 1 Avantage).

**Voir aussi** : [Localisation des créatures non humaines](#localisation-des-creatures-non-humaines) ; [Taille — tir sur créature grande](combat.md#taille-categories-et-modificateurs-de-combat).

**Implémente** :
- `sizeGap(a,b)` (`src/engine/size.ts` l.52-53) — écart ordinal.
- `sizeGrantedQualities(atk,tgt)` (l.92-98) — Dévastatrice à +1 cat, Percutante à +2.
- `sizeDamageMultiplier(atk,tgt)` (l.85-90) — ×N AVANT soak (`LDB 85 l.361`, confirmé utilisateur) ; ≥ 1.
- `forceOpposedOutcome(a,b)` (l.100-107) — `autoWin` / `needCrit` / `normal`.
- `SIZE_RANGED_MOD` (l.28-36) — mod tir −30..+60 (`LDB 14 l.142-165`).
- `attackModifiers` (`src/engine/combat.ts` l.280-297) — +10 plus petit, pénalité −2 DR/cat en Parade, localisation gratuite vs +2 cat (`LDB 76 l.40`).
- `applyHit` (combat.ts) + `sizeDamageMultiplier` — ×N Dégâts (après l'application des autres mods, `LDB 85 l.361`).
- `res.cleave = true` (combat.ts l.565/596) — Frappe Mortelle si attaquant plus grand OU Nuée (`LDB 85 l.362/200`).
- Piétinement : `trample` (`src/state/combatSlice.ts` l.629/671), `trampleAttack` (`src/state/combatFlow.ts` l.1770).
- Désengagement gratuit du plus grand : `combatFlow.ts` l.674, `combatGeometry.ts` l.76.
- Peur/Terreur par Taille : `fearFromSize` / `terrorFromSize` (`src/engine/psychology.ts` l.119-130).
- Tests : `combat-breakdown.test.ts`, `size.test.ts`, `cleave.test.ts`.

---

## Caractéristiques aléatoires

**Source RAW** : `LDB 78` (chapitre Les Bêtes du Reikland)

Pour les bêtes sauvages, les profils du bestiaire sont **arrondis à des multiples de 5 ou 10**. Le MJ peut individualiser une créature :

> « Soustrayez -10 et ajoutez 2d10. Une Caractéristique de 30 se traduit donc par 2d10+20. Si une Caractéristique vaut 5, lancez juste 1d10. » — source `LDB 78`

Les Caractéristiques inexistantes (« – » → 0) **ne sont pas tirées**.

**Implémente** :
- `randomizeChars(chars, id)` (`src/state/spawn.ts` l.91-100) — applique la formule LDB 78 ; graine déterministe dérivée de `id` (rejouable). Cas « valeur 5 → 1d10 » implémenté.
- `SpawnExtras.randomChars?: boolean` (l.146) — flag d'auteur.
- Quand `randomChars` est actif, les Blessures sont **recalculées** par la formule (le `B` imprimé est ignoré).

---

## Index des Traits de créature

**Source RAW** : `LDB 85 l.1-382` (chapitres Traits de créature)

Les Traits de créature sont **définis dans `LDB 85`** et sont indexés ici pour référence rapide. Leurs règles complètes sont transcrites dans les domaines suivants :

- **Traits d'attaque naturelle** (Arme, Morsure, Attaque Caudale, Cornes, Tentacules, Souffle, Vomissement, Regard Pétrifiant, Hurlement Fantomatique, Étreinte Glaciale, Langue Préhensile, À Distance) → [`combat.md`](combat.md) §§ *Traits d'attaque naturelle* + *Souffle et attaques de zone*.
- **Traits de défense et résilience** (Armure, Immunité, Résistance à la Magie, Protection, Démoniaque, Increvable, Régénération, Sang Corrosif, Éthéré, Instable, Insensible à la Douleur, Fabriqué, Mort-Vivant, Vampirique) → [`combat.md`](combat.md) § *Traits de défense et de résilience*.
- **Traits de psychologie et comportement** (Bestial, Peur, Terreur, Haine, Animosité, Préjugé, Immunité Psychologique, Belliqueux, Frénésie, Rage, Territorial, Dressé, Effrayé, Affamé, Perturbant, Stupide, Nuée) → [`psychologie.md`](psychologie.md) + [`combat.md`](combat.md) § *Traits de comportement*.
- **Traits de mouvement et d'attributs** (Bond, Foulée, Vol, Grimpant, Amphibie, Arboricole, Limicole, Furtif, Infravision, Vision Nocturne, Pisteur) → [`deplacement.md`](deplacement.md) + [`combat.md`](combat.md) § *Traits de mouvement*.
- **Traits de magie** (Magique, Lanceur de Sorts, Béni, Miracles, Mutation, Corruption, Corruption Mentale) → [`magie.md`](magie.md) + [`corruption.md`](corruption.md).
- **Taille** → présent fichier § [Taille](#taille-categories-blessures-et-modificateurs).
- **Modificateurs de profil** (Élite, Grand, Coriace, Brutal, Rapide, Intelligent, Rusé, Meneur, Endurant) → tous définis `LDB 85 l.122-203` ; effets en `passive: GameOp[]` dans `traits.json`.

### Traits standard (ajoutés à toute créature)

`LDB 76 l.31-35` : *Animosité, Arme, Armure, Brutal, Coriace, Craintif, Élite, Endurant, Grand, Haine, Intelligent, Meneur, Préjugé, Rapide, Rusé*.

### Traits d'attaque naturelle : déclenchement RAW

Ces traits octroient une ou plusieurs manœuvres d'attaque à la créature (`LDB 85`) :

| Trait | Déclenchement | Coût | Notes |
|---|---|---|---|
| **Arme (Indice)** | Action normale | — | Arme de C-à-C standard |
| **À Distance (Indice)(Portée)** | Action normale | — | Attaque à distance |
| **Morsure (Indice)** | Attaque gratuite | 1 Avantage | `LDB 85 l.194` |
| **Attaque Caudale (Indice)** | Attaque gratuite | 1 Avantage | Cible Taille inférieure → À Terre (`LDB 85 l.395`) |
| **Cornes (Aspect)(Indice)** | Attaque gratuite | — | À la Charge seulement (`LDB 85 l.83`) |
| **Tentacules # (Indice)** | Attaque gratuite par tentacule | — | Empêtré si Dégâts ; Empoignade possible (`LDB 85 l.408-408`) |
| **Souffle (Indice)(Type)** | Attaque gratuite zone | 2 Avantages | Portée BE+20m, zone BF cible ; Magique (`LDB 85 l.317-330`) |
| **Vomissement** | Attaque gratuite zone | 3 Avantages | Portée BE, zone 2m ; corrosif ; État Sonné (`LDB 85 l.442-447`) |
| **Regard Pétrifiant** | Action | 1+ Avantages | CT/Init opposé, +1DR/Avantage ; pétrification à 6+ DR (`LDB 85 l.290`) |
| **Hurlement Fantomatique** | Gratuite (hors Action) | Tous Avantages ≥ 2 | Zone Init mètres ; 1d10 Blessures + Test Résistance ou Brisé (`LDB 85 l.168`) |
| **Étreinte Glaciale** | Action | 2 Avantages | Test opposé CC/Esquive ; 1d10+DR Blessures sans PA ; Magique (`LDB 85 l.138`) |
| **Langue Préhensile (Indice)(Portée)** | Attaque gratuite | 1 Avantage | Distance ; Empêtré ; tire la cible si Taille inférieure (`LDB 85 l.211-213`) |

**Implémente** :
- `creatureAttacks(traits)` (`src/engine/creatureAttacks.ts`) — résout les traits → `CreatureAttack[]` via `TraitData.grantsManeuvers` (dataset `maneuvers`). Chaque trait d'attaque octroie sa/ses manœuvre(s) ; `pickGranted` désambiguïse Souffle (Feu/Froid/…) par suffixe d'id.
- `AttackKind` (creatureAttacks.ts l.18) : `'arme'|'morsure'|'caudale'|'cornes'|'souffle'|'vomi'|'tentacules'|'etreinte'|'regard'|'langue'|'hurlement'`.
- `AttackTrigger` (l.21) : `'action'|'free'|'charge'`.
- Résolution IA/flux : `combatManeuvers.ts`, `combatFlow.ts`, `combatSlice.ts`.

---

## Catalogue du bestiaire (à transcrire séparément)

Les chapitres suivants du LDB listent les profils de créatures individuelles. Ils constituent un **catalogue à transcrire dans un fichier séparé** (`docs/raw/catalogue-creatures.md` — non encore créé) :

| Chapitre | Titre | Contenu |
|---|---|---|
| `LDB 77` | Les populations du Reikland | Humains, halflings, nains, elfes — PNJ de civilisation |
| `LDB 78` | Les Bêtes du Reikland | Faune commune (loup, sanglier, cheval, griffon, etc.) + règle carac. aléatoires |
| `LDB 79` | Les bêtes monstrueuses du Reikland | Géants, trolls, ogres, araignées géantes… |
| `LDB 80` | Les hordes de peaux-vertes | Gobelins, orques, trolls verts, chamans |
| `LDB 82` | Les morts sans repos | Zombies, squelettes, fantômes, vampires, nécromancers |
| `LDB 83` | Esclaves des Ténèbres | Skavens, cultistes du Chaos, hommes-bêtes, démons |
| **ZI** | Le Zoo Impérial | Créatures exotiques (tigre à dents de sabre, etc.) + trait Redoutable |
| **frenchy.bzh** | Guide v4.5 | 88 créatures Part II (homebrew, taguées `source: "frenchy.bzh"`) |
| **EDO** | L'Ennemi dans l'Ombre | Créatures du Chaos : Horreurs, Furies, etc. |
| **T2/T2C** | Mort sur le Reik | Créatures aquatiques, PNJ nommés statblockés |
| **T3** | Le Pouvoir derrière le Trône | Créatures de scénario |
| **NADAJ** | Nuits agitées | Créatures de scénario |
| **ADE I/II** | Archives de l'Empire | Créatures supplémentaires, Ogres (ADE II) |

> **Ces chapitres NE sont PAS transcrits dans ce fichier.** Le présent document couvre le **système** ; le catalogue des statblocs individuels est dans `src/data/creatures.json` (source app-owned, éditée dans le Compendium).

**Implémente** :
- `src/data/creatures.json` — source app-owned commitée ; index via `findCreatureById`, `allCreatures` (`src/data/index.ts`).

---


---

<!-- MDG-INTEGRATION -->

## Trait de créature : Créature marine (MDG)

**Source RAW** : `MDG 16 l.15-19`

La **Mer des Griffes** (MDG) introduit un nouveau Trait de créature, **Créature marine**, propre au bestiaire marin. Il décrit une bête adaptée à l'océan et **inadaptée à la vie sur terre**. C'est un Trait distinct d'**Aquatique** (T2C) : Aquatique permet seulement de respirer sous l'eau et de se déplacer à pleine vitesse en immersion ; **Créature marine** ajoute en plus une **pénalité hors de l'eau** et un **risque de suffocation**.

Effets mécaniques (le profil suppose un environnement aquatique) :
- Dans l'eau, la créature se déplace de **tout son M**.
- **Sortie de l'eau** : son **M tombe à 1** et **tous ses Tests subissent −2 DR**.
- La créature doit être **immergée pour respirer**. Hors de l'eau, elle doit être **régulièrement aspergée d'eau** sous peine de **suffoquer** (règle de suffocation p. 181 du LDB).

> « La créature est chez elle dans l'océan et est inadaptée à la vie sur terre. Le profil de ce type de créature part du principe qu'elle se trouve dans un environnement aquatique et qu'elle se déplace de tout son M dans l'eau. Si elle est sortie de l'eau, son M tombe à 1 et tous les Tests qu'elle effectue subissent –2 DR. » — `MDG 16 l.17`

> « Les créatures possédant le Trait *Créature marine* doivent être immergées pour respirer correctement. Si elles sont sorties de l'eau, elles doivent être régulièrement aspergées d'eau, sinon elles se mettent à suffoquer comme décrit en page 181 de **WFJDR**. » — `MDG 16 l.19`

Créatures MDG portant ce Trait : Anguille mâcheprise, Stylet, Élémentaire de mer, Gargantuan, Wyrm des mers, Hydre d'os, Sangsue des abysses, Léviathan-phare, Léviathan noir, Triton (`MDG 16 l.63/82/103/129/187/224/241/259/272/305`). Les créatures **amphibies** (Baudroye, Crabe boxeur, Kharibde, Syrène bleue) ne portent **pas** ce Trait et ne subissent pas la pénalité terrestre.

**Voir aussi** : [Index des Traits de créature](#index-des-traits-de-creature) ; Trait *Aquatique* (T2C) — `combat.md` § *Traits de mouvement* ; Trait *Amphibie* — `deplacement.md`.

**Implémente** :
- `src/data/traits.json` (`creature-marine`, desc verbatim ; passif `offTerrainMod` avec `mSet:1`,
  `testDR:-2`, `suffocates:true` ; `aquatique` T2C p.90 également porté). Malus hors-eau consommé par
  `src/engine/ops.ts` (`offTerrainMoveCap`/`offTerrainTestDR`) ; suffocation dérivée par
  `offTerrainSuffocates` et exécutée par `src/engine/suffocation.ts` (`suffocationTick`, hook
  `suffocation-tick` de `src/state/combat/roundHooks.ts`) — #477.

---

## Trait Redoutable — variante de formulation (MDG)

**Source RAW** : `MDG 16 l.9-13`

La **Mer des Griffes** rappelle et reformule le Trait **Redoutable (Indice)**, déjà introduit par le Zoo Impérial (`ZI 14 l.1045`). La règle de fond est **identique** (regain d'Avantage au début du tour jusqu'à l'Indice), mais MDG en donne une formulation propre et **ajoute une clause d'interaction** avec les règles d'**Avantage de groupe** d'*Aux Armes !* (AA).

- Au début de son tour, si la créature n'a pas autant d'Avantages que son **Indice** de Redoutable (par défaut **1**), elle gagne **immédiatement tous les Avantages manquants**.
- **Pas de regain** si la créature est sous l'effet d'un État **Empêtré**, **Inconscient** ou **Surpris**.
- **Clause AA** : avec les règles d'Avantage de groupe d'*Aux Armes !*, la créature **génère un nombre d'Avantages égal à son Indice de Redoutable pour la réserve d'Avantages des adversaires**.

> « Si, au début de son tour, la créature n'a pas autant d'Avantages que son *Indice* de Redoutable le voudrait (par défaut, 1), elle gagne immédiatement tous les Avantages qui lui manquent. Si la créature est sous l'effet d'un État *Empêtré*, *Inconscient* ou *Surpris*, elle ne gagne pas d'Avantage. » — `MDG 16 l.11`

> « Si vous utilisez les règles d'Avantage de groupe du supplément **Aux Armes !**, la créature génère un nombre d'Avantages égal à son Indice dans le Trait *Redoutable* pour la réserve d'Avantages des adversaires. » — `MDG 16 l.13`

Indices observés dans le bestiaire MDG : Redoutable 1 (Baudroye, Hydre d'os, Sangsue des abysses), Redoutable 2 (Kharibde, Wyrm des mers, Léviathan-phare), Redoutable 3 (Élémentaire de mer, Gargantuan, Triton), Redoutable 5 (Léviathan noir). Le **Kharibde** porte un cas particulier (« **Gigue d'os** ») : son Indice passe de *Redoutable 2* à *Redoutable 4* tant qu'il reste Engagé après avoir gagné 1 Avantage en combat (`MDG 16 l.152`).

**Voir aussi** : [Avantage permanent — Trait *Redoutable* (Grim) (ZI)](combat.md#avantage-permanent--trait-redoutable-grim-zi) — `combat.md` ; Avantage de groupe (AA) — `combat.md`.

**Implémente** :
- `src/data/traits.json` (`redoutable`, desc verbatim — la clause AA l.13 y est appendue) : le regain d'Avantage début de tour EST câblé (`effects` `onTurnStart` → op `gainAdvantage{feedOpposingPool:true}`, gardé Empêtré/Inconscient/Surpris par le nœud `if` englobant). Clause AA d'Avantage de groupe : `src/engine/ops.ts` (`OpsCtx.onOpposingAdvantage`, case `gainAdvantage`) appelle le callback QUAND l'op s'exécute (le garde-fou de la donnée gate NATURELLEMENT la clause) ; fourni par `src/state/combat/advantagePool.ts` (`creditOpposingAdvantage`, self-gardée `groupAdvantage()`) via `src/state/combat/turnHooks.ts` (`fireTurnEdgeTriggers`, `onTurnStart`).

## Bilan de fidélité

### Système couvert

| Topic | Source | État |
|---|---|---|
| Introduction bestiaire | `LDB 76 l.4-19` | ✅ verbatim cité |
| Localisation créatures non humaines | `LDB 76 l.22-45` | ✅ tables verbatim |
| Traits Standard | `LDB 76 l.31-35` | ✅ liste verbatim |
| Structure du profil | `LDB 76 l.44-46` | ✅ |
| Traits Facultatifs | `LDB 76 l.45` + spawn.ts | ✅ |
| 7 catégories de Taille | `LDB 85 l.343-344` | ✅ table verbatim |
| Blessures par Taille | `LDB 85 l.391-406` | ✅ table verbatim |
| Utiliser les Tailles | `LDB 85 l.339-340` | ✅ verbatim |
| Mods Taille en combat | `LDB 85 l.357-387` | ✅ |
| Caractéristiques aléatoires | `LDB 78` | ✅ règle citée |
| Index Traits — déclenchement | `LDB 85 l.83-455` | ✅ tableau de synthèse |

### Catalogue créatures — flagué

Les chapitres `LDB 77-83`, `ZI`, `frenchy.bzh`, `EDO`, `T2/T2C`, `T3`, `NADAJ`, `ADE I/II` constituent le catalogue des statblocs individuels. Non transcrits ici (→ catalogue séparé).

### Refs code confirmées

- `src/engine/size.ts` — `LDB 85 l.343-406` (7 catégories, Blessures, mods combat).
- `src/state/spawn.ts` — `LDB 76 l.45` (Facultatifs), `LDB 78` (carac. aléatoires).
- `src/engine/creatureAttacks.ts` — `LDB 85 traits` (grantsManeuvers par id).
- `src/engine/creatureEquip.ts` — `LDB 85 l.408` (Tentacules, compte/attaques gratuites).
- `src/engine/combat.ts` l.280-297, 565, 596 — `LDB 85 l.253/299/301-303/305-306`.
- `src/state/combatFlow.ts` l.674, 1770 — `LDB 85 l.373-374` (désengagement gratuit), `LDB 85 l.386-387` (Piétinement).
- `src/engine/psychology.ts` l.119-130 — `LDB 85 l.382-383` (Peur/Terreur par Taille).
- `src/state/aim-bigger.test.ts` — `LDB 76 l.40` (localisation gratuite ≥ 2 cat).

### Écarts ou points à vérifier

- La règle **Piétinement** mentionne « Corps à corps (Bagarre) » (`LDB 85 l.321`) : vérifier que le code utilise bien cette Compétence (pas Corps à corps base générique).
- La règle **Nuée** (`LDB 85 l.252-258`) est synthétisée dans `combat.md` — ce fichier ne la re-transcrit pas (renvoi).
- **Chapitres chamaniques / sorts de créatures** (Lanceur de Sorts, Béni, Miracles) : règle dans `magie.md` / `religion.md`, pas ici.
- La règle d'**Animosité** (LDB 85 l.18 → LDB 21 l.X) est dans `psychologie.md`.
