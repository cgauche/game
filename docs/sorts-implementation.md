# Sorts & Miracles — état d'implémentation

> GÉNÉRÉ par `npx tsx scripts/gen-sorts-doc.mts` — ne pas éditer à la main.
> Backlog de curation du Jalon 2 : ✅ = effets connus appliqués par le moteur ·
> 🟡 = partiel (volet « arbitrage MJ » journalisé en jeu) · 📜 = rien de mécanique
> (effet journalisé verbatim). « curé » = spec relue de la source (`data/spellspecs/`),
> sinon repli regex iso-POC. Implémenter un sort = le curer dans son fichier de famille.

**Synthèse** : 221 sorts — ✅ 64 mécaniques · 🟡 18 partiels · 📜 139 narratifs (arbitrage MJ) · 87 specs curées.

## Béni (19)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bénédiction de Bataille | ✅ | oui |  |
| Bénédiction de Chance | 📜 | oui | Bénédiction de Chance : la cible peut relancer le prochain Test auquel elle échoue (second résultat conservé). |
| Bénédiction de Charisme | ✅ | oui |  |
| Bénédiction de Conscience | 📜 | oui | Bénédiction de Conscience : Test de Force Mentale Accessible (+20) pour briser un Commandement de la divinité, sinon Honte (pas d’Action) — arbitrage MJ. |
| Bénédiction de Convalescence | 📜 | oui | Bénédiction de Convalescence : réduit d’1 journée la durée d’une maladie (une seule fois par maladie et par personne). |
| Bénédiction de Courage | ✅ | oui |  |
| Bénédiction de Droiture | 📜 | oui | Bénédiction de Droiture : l’arme de la cible est considérée comme Magique. |
| Bénédiction de Finesse | ✅ | oui |  |
| Bénédiction de Grâce | ✅ | oui |  |
| Bénédiction de Guérison | ✅ | oui |  |
| Bénédiction de La Chasse | ✅ | oui |  |
| Bénédiction de Protection | 📜 | oui | Bénédiction de Protection : les ennemis doivent réussir un Test de Force Mentale Accessible (+20) pour attaquer la cible — arbitrage MJ. |
| Bénédiction de Puissance | ✅ | oui |  |
| Bénédiction de Sagesse | ✅ | oui |  |
| Bénédiction de Sauvagerie | 📜 | oui | Bénédiction de Sauvagerie : sur les Blessures Critiques infligées, deux lancers — garder le meilleur. |
| Bénédiction de Souffle | 📜 | oui | Bénédiction de Souffle : la cible n’a pas besoin de respirer (ignore la suffocation). |
| Bénédiction de Ténacité | ✅ | oui |  |
| Bénédiction de Vigueur | ✅ | oui |  |
| Bénédiction de Vivacité | ✅ | oui |  |

## Invocation — Manann (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Encalminé | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Générosité de Manann | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Marcher sur les eaux | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Mer déchainée | ✅ | repli |  |
| Vents favorables | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Visage de l'homme noyé | ✅ | repli |  |

## Invocation — Morr (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Anéantir les morts-vivants | ✅ | repli |  |
| Condamné | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Main de Morr | ✅ | repli |  |
| Masque mortuaire | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rites funéraires | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Seuil du Portail | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Invocation — Myrmidia (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Appel à la Fureur | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bouclier de Myrmidia | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Inspirant | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Lance de Myrmidia | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Œil de l'aigle | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Soleil flamboyant | ✅ | repli |  |

## Invocation — Ranald (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Grâce de Ranald | ✅ | repli |  |
| Invitation | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Que la chance persiste | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Riche, pauvre, mendiant, voleur | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Vous ne m'avez pas vu, n'est-ce pas? | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Yeux de chat | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Invocation — Rhya (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Abri de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Caresse de Rhya | ✅ | repli |  |
| Enfants de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Récolte de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Secours de Rhya | ✅ | repli |  |
| Union de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Invocation — Shallya (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Amère catharsis | 🟡 | oui | Amère catharsis : une maladie peut être retirée (+1 purge par +2 DR) ; le prêtre subit 1d10 − BSoc Blessures NON mitigées par purge — arbitrage MJ. |
| Baume pour un esprit blessé | 📜 | oui | Baume pour un esprit blessé : Traits psychologiques retirés pour la durée, puis sommeil réparateur jusqu’à l’aube (cible non volontaire : Test de Calme +0 pour résister) — arbitrage MJ. |
| Endurance de l'anachorète | 📜 | oui | Endurance de l’anachorète : la cible ne ressent aucune douleur et ne subit AUCUNE pénalité d’État pour la durée (immunité non modélisée — arbitrage MJ). |
| Innocence immaculée | 🟡 | oui | Innocence immaculée : −1 Point de Corruption supplémentaire par +2 DR ; sur Maladresse, prêtre ET cible gagnent 1d10 Corruption — arbitrage MJ. |
| Larmes de Shallya | 📜 | oui | Larmes de Shallya : après 10 − BSoc Rounds de Prière ininterrompue, guérit 1 Blessure Critique (+1 par +2 DR ; jamais une amputation) — appliquer via la convalescence, arbitrage MJ. |
| Martyr | 📜 | oui | Martyr : le prêtre reçoit les Dégâts subis par la cible (BE doublé pour ces Dégâts) — redirection non modélisée, arbitrage MJ. |

## Invocation — Sigmar (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Comète à Deux Queues | 🟡 | oui | Comète à Deux Queues : +DR Dégâts supplémentaires (ignorant BE/PA) — à ajouter selon le jet ; cible les ennemis de Sigmar, à l’extérieur seulement. |
| Feu de l'âme | 🟡 | oui | Feu de l’âme : les Morts-vivants et Démons gagnent aussi En flammes ; +2 Dégâts aux impies par +2 DR (arbitrage MJ). |
| Flambeau de Vertu | 🟡 | oui | Flambeau de Vertu : Talent Sans peur tant que le Miracle est actif et que la cible reste en Ligne de Vue ; les peaux-vertes en LdV doivent tester leur Psychologie (arbitrage MJ). |
| Marteau ardent de Sigmar | 📜 | oui | Marteau ardent : votre marteau devient Magique, +BSoc Dégâts, et chaque cible frappée reçoit En flammes + À Terre (enchantement d’arme — arbitrage MJ). |
| N'écoutez point la Sorcière | 📜 | oui | N’écoutez point la Sorcière : −20 aux Tests de Langue (Magick) de tout Sort ciblant la zone de BSoc mètres autour du prêtre (+BSoc m / −10 par +2 DR) — arbitrage MJ. |
| Vaincre les impies | 📜 | oui | Vaincre les impies : les alliés désignés gagnent le Trait psychologique Haine (peaux-vertes, morts-vivants, créatures du Chaos) pour la durée (arbitrage MJ). |

## Invocation — Taal (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bondissant comme un cerf | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Dent et griffe | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Enchevêtrement | ✅ | repli |  |
| Instincts animaux | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Roi de la Nature | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Seigneur de la Chasse | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Invocation — Ulric (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Frisson du givre | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fureur d'Ulric | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Hurlement du loup | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Jugement du Roi de la neige | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Morsure de l'hiver | ✅ | repli |  |
| Peau de loup d'hiver | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Invocation — Verena (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Entraves à la vérité | ✅ | repli |  |
| Épée de justice | ✅ | repli |  |
| Justice aveugle | 📜 | repli | Non curé : desc journalisée telle quelle. |
| La Vérité éclatera | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sagesse de la chouette | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Verena est mon témoin | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes (23)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arme aethyrique | 📜 | oui | Arme aethyrique : arme de Corps à corps MAGIQUE de Dégâts = BFM, toute Compétence de CC utilisable (arbitrage MJ — enchantement d’arme non modélisé). |
| Armure Aethyrique | ✅ | oui |  |
| Attaques en chaîne | 🟡 | oui | Attaques en chaîne : si la cible tombe à 0 Blessure, le Projectile rebondit sur une cible à BFM mètres (arbitrage MJ). |
| Aura ordinaire | 📜 | oui | Aura ordinaire : votre nature magique est indétectable (Perception de la magie et similaires). |
| Bouclier anti-flèches | 📜 | oui | Bouclier anti-flèches : les projectiles ORGANIQUES (flèches…) entrant dans la ZdE sont détruits ; les inorganiques passent (arbitrage MJ). |
| Bouclier magique | 📜 | oui | Bouclier magique : +BFM DR à vos tentatives de Dissipation tant que le Sort est actif (la Dissipation n’est pas encore modélisée). |
| Carreau | ✅ | oui |  |
| Chute | ✅ | oui |  |
| Déplacement d'objet | 📜 | oui | Déplacement d’objet : déplace un objet inanimé (Force = votre FM) de BFM mètres. |
| Dôme | 📜 | oui | Dôme : Protection (6+) contre les attaques magiques/à distance venant de l’extérieur, pour quiconque est dans la ZdE. |
| Effrayant | 📜 | oui | Effrayant : vous gagnez Peur 1 tant que le Sort est actif (+1 par +3 DR) — Trait temporisé, arbitrage MJ. |
| Enchevêtrement | 🟡 | oui | Enchevêtrement : Force de l’entrave = Intelligence du lanceur ; +1 Empêtré par +2 DR (arbitrage MJ). |
| Envol | 📜 | oui | Envol : vous gagnez le Trait Vol (Agilité) tant que le Sort est actif (déplacement aérien — arbitrage MJ). |
| Explosion | ✅ | oui |  |
| Perturbant | 📜 | oui | Perturbant : vous gagnez le Trait Perturbant tant que le Sort est actif (−10 aux Tests sociaux adverses — arbitrage MJ). |
| Pont | 📜 | oui | Pont : pont d’énergie de BFM mètres (long./larg.), +BFM mètres par +2 DR (arbitrage MJ). |
| Poussée | 🟡 | oui | Poussée : repoussé de BFM mètres (collision avec un obstacle : Dégâts = distance restante — arbitrage MJ). |
| Protection | 📜 | oui | Protection : vous gagnez le Trait Protection (9+) tant que le Sort est actif (arbitrage MJ). |
| Sang corrosif | 📜 | oui | Sang corrosif : vous gagnez le Trait Sang corrosif tant que le Sort est actif (arbitrage MJ). |
| Souffle | 🟡 | oui | Souffle : attaque de Souffle (type selon votre Domaine) — Projectile magique de Dégâts = votre Bonus d’Endurance. |
| Téléportation | 📜 | oui | Téléportation : vous vous téléportez de BFM mètres (+BFM par +2 DR) — déplacement hors grille, arbitrage MJ. |
| Terrifiant | 📜 | oui | Terrifiant : vous gagnez le Trait Terreur 1 tant que le Sort est actif (arbitrage MJ). |
| Vision dans l'obscurité | 📜 | oui | Vision dans l’obscurité : vous gagnez le Trait Infravision tant que le Sort est actif. |

## Magie des Arcanes — Bête (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Forme bestiale | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Incarnation de Wyssan | 📜 | repli | Non curé : desc journalisée telle quelle. |
| La lance d'Ambre | ✅ | repli |  |
| Langue bestiale | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Maître de la bête | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Peau de chasseur | ✅ | repli |  |
| Serres d'ambre | ✅ | repli |  |
| Vol du Destin | ✅ | repli |  |

## Magie des Arcanes — Cieux (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arc de T'Essla | ✅ | repli |  |
| Bouclier céruléen | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Comète de Cassandora | ✅ | repli |  |
| Ironie du Destin | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Le Premier Signe d'Amul | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Le Second Signe d'Amul | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Le Troisième Signe d'Amul | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Maudit | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes — Démonologie (4)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Destruction de Démon Mineur | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Détection de démon | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Manifestation de Démon mineur | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Octogramme | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes — Feu (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Cautériser | 🟡 | oui | Cautériser : les Blessures ne s’infecteront pas. |
| Cœurs ardents | 🟡 | oui | Cœurs ardents : +1 Talent Coude-à-coude, Sans peur et Cœur vaillant tant que le Sort est actif (arbitrage MJ). |
| Couronne de Flammes | 🟡 | oui | Couronne de Flammes : Trait Peur 1 + Talent Seigneur de guerre tant que le Sort est actif (arbitrage MJ). |
| Grands feux d'U'Zhul | 🟡 | oui | Grands feux d’U’Zhul : la ZdE autour de la cible subit +5 Dégâts (ignore PA) et brûle pour la durée du Sort (1d10+6 Dégâts/Round, +1 En flammes) — arbitrage MJ. |
| L'Égide d'Aqshy | 📜 | oui | Égide d’Aqshy : immunisé aux Dégâts de feu non magiques, ignore l’État En flammes, Protection (9+) contre le feu magique (arbitrage MJ). |
| L'Épée ardente de Rhuin | 📜 | oui | Épée ardente de Rhuin : l’arme gagne Dégâts +6, l’Atout Percutante, et inflige +1 En flammes à la touche (arbitrage MJ — enchantement d’arme non modélisé). |
| Mur de feu | 🟡 | oui | Mur de feu : mur de BFM mètres (épais d’1 m) pour la durée du Sort — traverser inflige 1 En flammes + un Projectile magique de BFM Dégâts (zone persistante : arbitrage MJ). |
| Purification | 🟡 | oui | Purification : chaque créature de la zone gagne +DR État En flammes (au-delà du 1er appliqué) ; consume les Influences corruptrices — arbitrage MJ. |

## Magie des Arcanes — Gueule (7)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bouf 'crâne | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Broyeur d'os | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Festin des Damnés | ✅ | repli |  |
| Goinfre costaud | ✅ | repli |  |
| Goûtemort | 📜 | repli | Non curé : desc journalisée telle quelle. |
| La Gueule | ✅ | repli |  |
| Trollboyaux | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes — Lumière (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bannissement | ✅ | repli |  |
| Clarté d'esprit | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fauche-démon | ✅ | repli |  |
| Filet d'Amyntok | ✅ | repli |  |
| Lumière aveuglante | ✅ | repli |  |
| Lumière de guérison | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pensée rapide | ✅ | repli |  |
| Protection de Phâ | ✅ | repli |  |

## Magie des Arcanes — Magie naturelle (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bonne Volonté | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Charme protecteur | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Chevaucher l'Obscurité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Nepenthès | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Panacée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Séparer les branches | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes — Métal (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arme enchantée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Creuset de Chamon | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Écaille d'acier | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Forge de Chamon | 📜 | repli | Non curé : desc journalisée telle quelle. |
| L'Or des fous | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Métal changeant | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Plume de plomb | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Transmutation de Chamon | ✅ | repli |  |

## Magie des Arcanes — Mort (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Caresse de Laniph | ✅ | repli |  |
| Dernières paroles | 📜 | repli | Non curé : desc journalisée telle quelle. |
| La Faux de Shyish | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Le Voile violet de Shyish | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Mort rapide | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sanctifier | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Vol de vie | ✅ | repli |  |
| Vortex d'âmes | ✅ | repli |  |

## Magie des Arcanes — Nécromancie (4)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Crâne hurlant | ✅ | repli |  |
| L'appel de Vanhel | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Réanimation | ✅ | repli |  |
| Relever les morts | ✅ | repli |  |

## Magie des Arcanes — Ombres (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Destrier d'Ombre | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Illusion | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Jumeau maléfique | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Linceul d'Invisibilité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Miasme mystifiant | ✅ | repli |  |
| Ombres étrangleuses | ✅ | repli |  |
| Perte de mémoire | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Portail d'Ombre | ✅ | repli |  |

## Magie des Arcanes — Sorcellerie (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Dégradation | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Horreur obsédante | ✅ | repli |  |
| Malédiction de douleur paralysante | ✅ | repli |  |
| Malédiction de malchance | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Mauvais œil | ✅ | repli |  |
| Menace rampante | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes — Vie (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Configuration du terrain | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Don de Vie | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Eau de la terre | ✅ | repli |  |
| Écorce | ✅ | repli |  |
| Forêt d'épines | ✅ | repli |  |
| Graisse de la terre | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Régénération | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sang de la Terre | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie du Chaos — Nurgle (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Flot de Corruption | 🟡 | repli | Non curé : desc journalisée telle quelle. |

## Magie du Chaos — Slaanesh (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Consentement | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie du Chaos — Tzeentch (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Trahison de Tzeentch | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie mineure (25)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Alerte | 📜 | oui | Alerte : révèle immédiatement si l’objet touché est empoisonné ou piégé. |
| Amitié animale | 📜 | oui | Amitié animale : une créature Bestiale plus petite vous fait totalement confiance (1 heure). |
| Bruits | 📜 | oui | Bruits : petits sons indistincts projetés à portée, sans Ligne de Vue. |
| Choc | ✅ | oui |  |
| Conservation | 📜 | oui | Conservation : préserve une journée de vivres de la putréfaction (durée en jours). |
| Coup de vent | 📜 | oui | Coup de vent : brève rafale (éteint une bougie, claque une porte…). |
| Créer un petit animal | 📜 | oui | Créer un petit animal : fait apparaître un petit animal local (lapin, colombe, rat…). |
| Drain | ✅ | oui |  |
| Éblouissant | ✅ | oui |  |
| En catimini | 📜 | oui | En catimini : téléporte un petit objet proche (taille d’un poing) entre vos mains. |
| Feux follets | 📜 | oui | Feux follets : jusqu’à (Bonus d’Int) lumières flottantes contrôlables (Test de Focalisation Accessible). |
| Flamme magique | 📜 | oui | Flamme magique : petite flamme inoffensive pour vous, qui chauffe et enflamme comme une flamme naturelle. |
| Fléchette | ✅ | oui |  |
| Lumière | 📜 | oui | Lumière : lueur de torche (modulable de bougie à lanterne) émanant de vous. |
| Murmures | 📜 | oui | Murmures : projette votre voix vers un point à portée, sans Ligne de Vue. |
| Pas léger | 📜 | oui | Pas léger : votre passage ne laisse aucune trace organique (−20 implicite au Pistage adverse — arbitrage MJ). |
| Protection contre la pluie | 📜 | oui | Protection contre la pluie : vous restez au sec sous toute précipitation. |
| Purification de l'eau | 📜 | oui | Purification de l’eau : purifie l’eau d’un récipient (poisons/polluants non magiques éliminés). |
| Putréfaction | 📜 | oui | Putréfaction : pourrit un volume organique de la taille d’un poing (cuir : −1 PA à 1 Localisation — arbitrage MJ). |
| Repères | 📜 | oui | Repères : vous savez où est le Nord. |
| Secousse | ✅ | oui |  |
| Serrure ouverte | 📜 | oui | Serrure ouverte : déverrouille une serrure non magique touchée. |
| Sommeil | 📜 | oui | Sommeil : une cible À Terre gagne l’État Inconscient pour la durée du Sort (réveillée par bruit fort/secousse) — appliquer si À Terre. |
| Source | 📜 | oui | Source : fait jaillir ½ litre d’eau par Round (max Bonus d’Initiative litres). |
| Tendre l'oreille | 📜 | oui | Tendre l’oreille : vous entendez vos cibles comme si vous étiez à côté. |
