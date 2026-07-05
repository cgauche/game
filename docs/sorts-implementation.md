# Sorts & Miracles — état d'implémentation

> GÉNÉRÉ par `npx tsx scripts/gen-sorts-doc.mts` — ne pas éditer à la main.
> ✅ = effets connus appliqués par le moteur ·
> 🟡 = partiel (volet « arbitrage MJ » journalisé en jeu) · 📜 = rien de mécanique
> (effet journalisé verbatim). « curé » = spec complète dans SpellData (spells.json).

## Bénédiction (5)
**Synthèse** : 416 sorts — ✅ 77 mécaniques · 🟡 127 partiels · 📜 212 narratifs (arbitrage MJ) · 278 specs curées.


| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Culpabilité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Justice | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rapidité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Robustesse | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Soins | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Béni (19)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bénédiction de Bataille | ✅ | oui |  |
| Bénédiction de Chance | ✅ | oui |  |
| Bénédiction de Charisme | ✅ | oui |  |
| Bénédiction de Conscience | 📜 | oui | Bénédiction de Conscience : Test de Force Mentale Accessible (+20) pour briser un Commandement de la divinité, sinon Honte (pas d’Action) — arbitrage MJ. |
| Bénédiction de Convalescence | ✅ | oui |  |
| Bénédiction de Courage | ✅ | oui |  |
| Bénédiction de Droiture | ✅ | oui |  |
| Bénédiction de Finesse | ✅ | oui |  |
| Bénédiction de Grâce | ✅ | oui |  |
| Bénédiction de Guérison | ✅ | oui |  |
| Bénédiction de La Chasse | ✅ | oui |  |
| Bénédiction de Protection | ✅ | oui |  |
| Bénédiction de Puissance | ✅ | oui |  |
| Bénédiction de Sagesse | ✅ | oui |  |
| Bénédiction de Sauvagerie | ✅ | oui |  |
| Bénédiction de Souffle | ✅ | oui |  |
| Bénédiction de Ténacité | ✅ | oui |  |
| Bénédiction de Vigueur | ✅ | oui |  |
| Bénédiction de Vivacité | ✅ | oui |  |

## du Domaine de la Peste (3)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Brume Acide | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Contamination | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Immuno - Déficience | 📜 | repli | Non curé : desc journalisée telle quelle. |

## du Domaine de la Ruine (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Crépitement Funeste | ✅ | repli |  |
| Crevasse | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Dépeçage | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Flamme Verdâtre | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Hébètement | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rafale Hurlante | 🟡 | repli | Non curé : desc journalisée telle quelle. |

## du Domaine des Ombres (9)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Armure d’Obscurité | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bond Furtif | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Disparition | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pattes Gluantes | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Poids Plume | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Poudre d’Escampette | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rage Meurtrière | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Rat Esclave | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Shurikens Enchantés | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Invocation — Déesse-Araignée (3)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bon Baiser d'la Fosse Noire | ✅ | oui |  |
| Nuée d'Escampette | ✅ | oui |  |
| Toile surprise | 🟡 | oui | Toile surprise : pour chaque +2 DR, vous pouvez PLUTÔT étendre la zone de BSoc m (au lieu de l'Empêtré supplémentaire) — arbitrage MJ. |

## Invocation — Manann (14)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Apaiser les eaux | 📜 | oui | Apaiser les eaux : l'Indice M d'un Détroit ou d'un Tourbillon tombe à 0 tant que le Miracle fait effet — arbitrage MJ (péril nautique non modélisé). |
| Bénédiction de l'albatros | 📜 | oui | Bénédiction de l'albatros : un albatros suit le navire ; tant qu'il est présent le navire NE PEUT PAS couler, quels que soient les Dégâts. Si l'albatros est tué : –1d10 au Moral et –2d10 à l'Humeur de Manann — arbitrage MJ. |
| Bénédiction du marinier | 📜 | oui | Bénédiction du marinier : tous les Tests de Natation, de Ramer ou de Voile de la cible bénéficient de +1 DR pendant 1 jour. |
| Contre-courants | 📜 | oui | Contre-courants : le navire ciblé subit –1 M et –1 DR sur sa caractéristique Man tant que le Miracle fait effet — arbitrage MJ (caractéristiques de navire non ciblables par op). |
| Encalminé | 📜 | oui | Encalminé : un navire dans la Ligne de vue est privé de vent pendant 1 heure ; une zone d’eaux calmes (BInit m) l’entoure et le suit s’il avance autrement — arbitrage MJ. |
| Générosité de Manann | 🟡 | oui | Générosité de Manann : en pleine mer, la prise nourrit le double (Rations × 2) — arbitrage MJ. |
| Malédiction de la mer | 📜 | oui | Malédiction de la mer : si l'équipage du navire ciblé ne mérite pas le respect de Manann (Chaos, Stromfels, orcs/gobelins, skavens, Humeur de Manann négative), +2 aux Dégâts de tous les coups reçus par l'équipage tant que le Miracle fait effet — arbitrage MJ. |
| Marcher sur les eaux | 📜 | oui | Marcher sur les eaux : vous franchissez une grande étendue d’eau (≥ 10 m de large) comme un sol ferme, pour la durée — arbitrage MJ. |
| Mer déchainée | 🟡 | oui | Mer déchainée : pour utiliser son Mouvement, la cible doit réussir un Test d’Agilité Accessible (+20), sinon elle gagne aussi À Terre — arbitrage MJ. |
| Navigation bénie | 📜 | oui | Navigation bénie : au calcul de l'Humeur de Manann du navire, l'Humeur s'améliore de 2d10, –1 par Point de Péché actuel du prêtre — arbitrage MJ (Humeur de Manann non modélisée). |
| Repousser une créature marine | 📜 | oui | Repousser une créature marine : la créature (Trait Aquatique ou Créature marine) n'effectue aucune action hostile tant qu'elle ne subit ni Dégâts ni États nuisibles, pendant la durée du Miracle — arbitrage MJ/IA. |
| Respiration aquatique | ✅ | oui |  |
| Vents favorables | 📜 | oui | Vents favorables : un voilier dans la Ligne de vue file à sa vitesse maximale (quels que soient vent/marée/courant) et gagne +10 à tous les Tests de pilotage, pendant 1 heure — arbitrage MJ. |
| Visage de l'homme noyé | 🟡 | oui | Visage de l’homme noyé : à la fin du Miracle, la cible effectue un Test de Résistance Difficile (−20) sous peine de gagner l’État À Terre — arbitrage MJ. |

## Invocation — Morr (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Anéantir les morts-vivants | 🟡 | oui | Anéantir les morts-vivants : un mort-vivant détruit par ce Miracle ne peut jamais être relevé par Nécromancie — arbitrage MJ. |
| Condamné | 📜 | oui | Condamné : vous offrez à la cible une vision de sa mort à venir ; elle peut désormais acheter le Talent Destinée par PX (une seule fois par Personnage) — arbitrage MJ. |
| Main de Morr | 📜 | oui | Main de Morr : une cible consentante à 0 PB gagne Inconscient et cesse de se dégrader (maladie, Blessures Critiques, poisons repoussés) pour la durée du Miracle — arbitrage MJ. |
| Masque mortuaire | ✅ | oui |  |
| Rites funéraires | 📜 | oui | Rites funéraires : l’âme d’un cadavre est envoyée au Royaume de Morr (immunisé à la Nécromancie) ; un mort-vivant ou un être Fabriqué ciblé est détruit — arbitrage MJ. |
| Seuil du Portail | 📜 | oui | Seuil du Portail : une ligne de 8 m qu’un Mort-vivant ne franchit que sur un Test de Force Mentale (+0) réussi (jamais s’il est aussi Fabriqué), jusqu’à l’aube — arbitrage MJ. |

## Invocation — Myrmidia (15)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Appel à la Fureur | 🟡 | oui | Appel à la Fureur : la Haine vise précisément ceux qui engagent l’allié au combat — arbitrage MJ. |
| Bouclier de Myrmidia | ✅ | oui |  |
| Commander la Légion | 📜 | oui | Commander la Légion : un ordre à un allié à vue ; votre prochain Test de Commandement lié bénéficie de +10 — arbitrage MJ. |
| Connais Ton Ennemi | 📜 | oui | Connais Ton Ennemi : profil, Traits, Compétences et Talents d’un ennemi à portée sont révélés (panneau d’inspection). |
| Dévotion de la Vierge Guerrière | 🟡 | oui | Dévotion de la Vierge Guerrière : +1 rang Sans peur visant un ennemi précis (individu ou espèce) — arbitrage MJ. |
| En Bon Ordre | 🟡 | oui | En Bon Ordre : vos alliés à portée peuvent rompre le combat (Fuite) sans céder d’Avantage ni subir d’attaque gratuite — arbitrage MJ. |
| En Terrain Dangereux | 🟡 | oui | En Terrain Dangereux : vos alliés à portée ne reçoivent pas l’État Brisé tant que le Miracle est actif — arbitrage MJ. |
| Frappe Rapide | 📜 | oui | Frappe Rapide : au début de chaque Round, un Test d’Initiative Intermédiaire (+0) réussi octroie une attaque gratuite immédiate (main principale) — arbitrage MJ. |
| Fureur Vengeresse | 📜 | oui | Fureur Vengeresse : vous devez Charger l’ennemi impénitent le plus proche et pouvez relancer tous vos jets de Corps à corps tant que le Miracle est actif — arbitrage MJ. |
| Inspirant | 🟡 | oui | Inspirant : +1 Talent Coude-à-coude (bonus de surnombre coopératif) — arbitrage MJ si non câblé. |
| Lance de Myrmidia | ✅ | oui |  |
| Œil de l'aigle | 📜 | oui | Œil de l’aigle : un aigle spectral invulnérable survole le champ ; vous percevez par ses yeux et dirigez son vol, mais vous ne percevez plus par les vôtres (vulnérable) — arbitrage MJ. |
| Prouesses Martiales | ✅ | oui |  |
| Soleil flamboyant | 🟡 | oui | Soleil flamboyant : ne touche que les non-Myrmidiens qui regardent dans votre direction — arbitrage MJ. |
| Terrifier l'Ennemi | ✅ | oui |  |

## Invocation — Ranald (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Grâce de Ranald | 🟡 | oui | Grâce de Ranald : la cible gagne aussi +10 en Discrétion pour la durée — arbitrage MJ. |
| Invitation | 📜 | oui | Invitation : un système de verrouillage (serrure, loquet, corde) d’une porte/fenêtre/trappe cède, +1 par +2 DR — arbitrage MJ. |
| Que la chance persiste | 🟡 | oui | Que la chance persiste : vous ne pourrez ré-invoquer ce Miracle qu’une fois revenu à 0 Point de Chance — arbitrage MJ. |
| Riche, pauvre, mendiant, voleur | 📜 | oui | Riche, pauvre, mendiant, voleur : par cible, une illusion au choix (bourse vide/pleine, tenue misérable/riche, objet de valeur imperceptible), +1 effet par +2 DR — arbitrage MJ. |
| Vous ne m'avez pas vu, n'est-ce pas? | 📜 | oui | Vous ne m’avez pas vu : les cibles passent inaperçues tant qu’elles n’attirent pas l’attention (toucher, attaquer, parler, incanter, faire du bruit) — arbitrage MJ. |
| Yeux de chat | 📜 | oui | Yeux de chat : un chat-serviteur invulnérable explore les environs ; vous percevez par ses sens et dirigez ses pas, mais vous ne percevez plus par les vôtres (vulnérable) — arbitrage MJ. |

## Invocation — Rhya (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Abri de Rhya | 📜 | oui | Abri de Rhya : en extérieur sauvage, un abri naturel protégé du vent et de la pluie apparaît (1 personne, +1 par +2 DR) et ne peut être redécouvert une fois quitté — arbitrage MJ. |
| Caresse de Rhya | 🟡 | oui | Caresse de Rhya : au lieu du soin, vous pouvez traiter 1 maladie contractée naturellement ; +1 effet (au choix) par +2 DR ; les résultats mettent ≥ 10 minutes à se manifester — arbitrage MJ. |
| Enfants de Rhya | 📜 | oui | Enfants de Rhya : en pleine nature, vous percevez toutes les créatures conscientes dans un rayon de (Sociabilité) m (+(Sociabilité) m par +2 DR) — arbitrage MJ. |
| Récolte de Rhya | ✅ | oui |  |
| Secours de Rhya | 🟡 | oui | Secours de Rhya : si ce retrait élimine TOUS les États de la cible, elle gagne +10 à tous ses Tests lors de son prochain Tour — arbitrage MJ. |
| Union de Rhya | 📜 | oui | Union de Rhya : vous bénissez l’union de deux âmes ; tant que le Miracle dure (heures), le couple concevra un enfant si c’est biologiquement possible — arbitrage MJ. |

## Invocation — Shallya (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Amère catharsis | 🟡 | oui | Amère catharsis : le prêtre subit 1d10 − BSoc Blessures NON mitigées par poison/maladie purgé — arbitrage MJ. |
| Baume pour un esprit blessé | 🟡 | oui | Baume pour un esprit blessé : sommeil réparateur jusqu’à l’aube si non dérangé (cible non volontaire : Test de Calme +0 pour résister) — arbitrage MJ. |
| Endurance de l'anachorète | 🟡 | oui | Endurance de l’anachorète : la cible ne ressent aucune douleur (effets hors pénalités d’États — arbitrage MJ). |
| Innocence immaculée | 🟡 | oui | Innocence immaculée : sur Maladresse, prêtre ET cible gagnent 1d10 Corruption — arbitrage MJ. |
| Larmes de Shallya | 🟡 | oui | Larmes de Shallya : exige 10 − BSoc Rounds de Prière ininterrompue — arbitrage MJ. |
| Martyr | ✅ | oui |  |

## Invocation — Sigmar (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Comète à Deux Queues | 🟡 | oui | Comète à Deux Queues : cible les ennemis de Sigmar, à l’extérieur seulement — arbitrage MJ. |
| Feu de l'âme | 🟡 | oui | Feu de l’âme : par +2 DR, étendre la ZdE de +BSoc mètres OU +2 Dégâts aux peaux-vertes/morts-vivants/serviteurs de la Ruine — au choix, arbitrage MJ. |
| Flambeau de Vertu | 🟡 | oui | Flambeau de Vertu : le Talent tient tant que la cible reste en Ligne de Vue du prêtre ; les peaux-vertes en LdV doivent tester leur Psychologie — arbitrage MJ. |
| Marteau ardent de Sigmar | ✅ | oui |  |
| N'écoutez point la Sorcière | ✅ | oui |  |
| Vaincre les impies | ✅ | oui |  |

## Invocation — Stromfels (7)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Faire fi de l'Humeur de Manann | 📜 | oui | Faire fi de l'Humeur de Manann : d10 (+1 par Point de Péché) sur la table du Miracle, appliqué au score d'Humeur de Manann du navire du prêtre — arbitrage MJ (Humeur de Manann non modélisée). |
| Flairer le sang | 📜 | oui | Flairer le sang : pendant 1 heure, vous pouvez suivre la piste d'un blessé sur terre comme sur l'eau en réussissant un Test de Pistage Facile (+40) — arbitrage MJ. |
| Lame de fond | 📜 | oui | Lame de fond : une vague énorme s'écrase sur la cible (personne, bateau, phare…) — collision d'IC 15 (Indice de Collision, MDG p.111) — arbitrage MJ (collisions navales non modélisées). |
| Mal de mer | ✅ | oui |  |
| Malédiction de la maîtresse cruelle | 📜 | oui | Malédiction de la maîtresse cruelle : pendant (Bonus de Force) jours, à chaque repos visant à récupérer d'États Exténué, la cible doit réussir un Test de Calme Complexe (–10), sinon l'État Exténué persiste — arbitrage MJ (hook de repos). |
| Sacrifice à Stromfels | 📜 | oui | Sacrifice à Stromfels : l'Indice de Voie d'eau du navire ciblé est DOUBLÉ — arbitrage MJ (pas d'op de mise à l'échelle d'un État à valeur). |
| Vents de tempête | 📜 | oui | Vents de tempête : l'intensité du vent augmente d'un cran pour le navire ciblé pendant (Force) minutes ; direction inchangée — arbitrage MJ (échelle de vent non modélisée). |

## Invocation — Taal (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bondissant comme un cerf | 🟡 | oui | Bondissant comme un cerf : vous gagnez aussi +1 Mouvement et réussissez automatiquement les Tests d’Athlétisme pour sauter (DR minimum 0) — arbitrage MJ. |
| Dent et griffe | ✅ | oui |  |
| Enchevêtrement | 🟡 | oui | Enchevêtrement (Taal) : pour chaque +2 DR, vous pouvez plutôt étendre la zone de BSoc m (au lieu de l’Empêtré supplémentaire) — arbitrage MJ. |
| Instincts animaux | 🟡 | oui | Instincts animaux : si vous vous reposez, vous êtes automatiquement réveillé par toute menace dans un rayon de (Initiative) m — arbitrage MJ. |
| Roi de la Nature | 🟡 | oui | Roi de la Nature : le MJ choisit l’animal invoqué selon l’environnement (voir « Les bêtes du Reikland ») — ici un Loup par défaut. |
| Seigneur de la Chasse | 📜 | oui | Seigneur de la Chasse : vous ne perdez plus la piste de votre proie désignée et gagnez +10 à tous les Tests la concernant, pour la durée (heures) — arbitrage MJ. |

## Invocation — Ulric (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Frisson du givre | 🟡 | oui | Frisson du givre : tous ceux dans un rayon de (Sociabilité) m perdent −1 Avantage au début de chaque round (gelés jusqu’aux os) — arbitrage MJ. |
| Fureur d'Ulric | ✅ | oui |  |
| Hurlement du loup | 🟡 | oui | Hurlement du loup : à la fin du Miracle, le loup blanc repart aux Terrains de Chasse d’Ulric dans un hurlement effrayant — arbitrage MJ. |
| Jugement du Roi de la neige | 🟡 | oui | Jugement du Roi de la neige : si le MJ juge la cible ni faible, ni couarde, ni fourbe, c’est VOUS qui subissez ces Blessures à sa place — arbitrage MJ. |
| Morsure de l'hiver | 🟡 | oui | Morsure de l’hiver : la hache inflige aussi +DR Dégâts et ses frappes retirent tout Hémorragique sans jamais en causer — arbitrage MJ. |
| Peau de loup d'hiver | ✅ | oui |  |

## Invocation — Verena (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Entraves à la vérité | 🟡 | oui | Entraves à la vérité : l’Empêtré ne s’applique que si la cible a réellement commis un crime et le nie (et il ne peut être retiré tant que le Miracle dure) ; une fausse accusation vous coûte +1 Point de Péché et un jet de Colère des dieux — arbitrage MJ. |
| Épée de justice | 🟡 | oui | Épée de justice : marquez les adversaires criminels du Groupe « Criminel » (éditeur) pour que l’Inconscient les frappe — le statut de criminel relève de l’arbitrage MJ. |
| Justice aveugle | 📜 | oui | Justice aveugle : vous pouvez tester Perception (+0) pour percer les illusions magiques, et Intuition (+20) pour savoir si un interlocuteur pense dire la vérité — arbitrage MJ. |
| La Vérité éclatera | 📜 | oui | La Vérité éclatera : vous posez une question à laquelle les cibles répondent sincèrement, à moins de battre votre DR par un Test de Calme (+20) — refus à +0, dissimulation mineure à +2 DR, majeure à +4, mensonge à +6 — arbitrage MJ. |
| Sagesse de la chouette | ✅ | oui |  |
| Verena est mon témoin | 📜 | oui | Verena est mon témoin : tant que vous ne dites que la vérité, tous vos auditeurs croient vos paroles pour la durée (sans nécessairement partager vos conclusions) — arbitrage MJ. |

## Magie des Arcanes (47)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Algues Cruelles | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Âme Dévoilée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Arme aethyrique | ✅ | oui |  |
| Armure Aethyrique | ✅ | oui |  |
| Attaques en chaîne | ✅ | oui |  |
| Aura ordinaire | 📜 | oui | Aura ordinaire : votre nature magique est indétectable (Perception de la magie et similaires). |
| Bélier | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Berceuse Soporifique UA II | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bouclier | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Bouclier anti-flèches | ✅ | oui |  |
| Bouclier magique | 📜 | oui | Bouclier magique : +BFM DR à vos tentatives de Dissipation tant que le Sort est actif (la Dissipation n’est pas encore modélisée). |
| Cacophonie Scabreuse | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Carreau | ✅ | oui |  |
| Chute | 📜 | oui | Chute : l’objet tenu tombe (arme au sol — arbitrage MJ). |
| Crue Mortelle | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Décharge Cérébrale | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Déplacement d'objet | 📜 | oui | Déplacement d’objet : déplace un objet inanimé (Force = votre FM) de BFM mètres. |
| Désarroi | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Dôme | ✅ | oui |  |
| Duplicité de Tzeentch | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Effrayant | ✅ | oui |  |
| Enchevêtrement | ✅ | oui |  |
| Envol | ✅ | oui |  |
| Esprit Enfiévré | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Explosion | ✅ | oui |  |
| Explosion de Dhar | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Fêlure AEthyrique | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Haleine Fétide | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Introspection | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue Acérée | ✅ | repli |  |
| Maîtrise du Destin | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Perturbant | ✅ | oui |  |
| Pierre de Souffrance | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pont | 🟡 | oui | Pont : pont d’énergie de BFM mètres (long./larg.), +BFM mètres par +2 DR (arbitrage MJ). |
| Poussée | ✅ | oui |  |
| Projectile | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Projectile de Dhar | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Protection | ✅ | oui |  |
| Rejeton de Slaanesh | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sang corrosif | ✅ | oui |  |
| Secousse Tellurique | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Souffle | ✅ | oui |  |
| Téléportation | ✅ | oui |  |
| Terrifiant | ✅ | oui |  |
| Trouble | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Vague Scélérate | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Vision dans l'obscurité | ✅ | oui |  |

## Magie des Arcanes — Bête (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Forme bestiale | 🟡 | oui | Forme bestiale : choisissez votre forme parmi les Bêtes du Reikland (ici l’Ours par défaut) ; +1 Trait facultatif par +2 DR — arbitrage MJ. |
| Incarnation de Wyssan | 🟡 | oui | Incarnation de Wyssan : gagnez aussi Arboricole et Grand (Taille) ; vous ne pouvez plus utiliser vos Compétences Langue ou Savoir — arbitrage MJ. |
| La lance d'Ambre | 🟡 | oui | La lance d’Ambre : traverse en ligne droite, ignore les PA de cuir/fourrure et frappe chaque cible suivante avec −1 Dégât, jusqu’à n’infliger aucune Blessure — arbitrage MJ. |
| Langue bestiale | 📜 | oui | Langue bestiale : vous parlez aux créatures Bestial (+20 en Emprise sur les animaux et Dressage) mais ne pouvez parler aucune langue civilisée ni incanter tant que le Sort dure — arbitrage MJ. |
| Maître de la bête | 📜 | oui | Maître de la bête : une créature Bestial vous considère comme son chef de meute et obéit à vos instructions simples pour la durée ; libérée, elle garde assez de crainte pour ne pas vous attaquer — arbitrage MJ. |
| Peau de chasseur | 🟡 | oui | Peau de chasseur : vous gagnez aussi le Talent Sens aiguisé (Odorat) — arbitrage MJ. |
| Serres d'ambre | 🟡 | oui | Serres d’ambre : vos attaques à mains nues (Bagarre) deviennent magiques et infligent des Dégâts égaux à votre BFM — arbitrage MJ pour la valeur de Dégâts. |
| Vol du Destin | 🟡 | oui | Vol du Destin : pour votre Action, un Test d’Emprise sur les animaux (+20) déplace la volée sur une autre cible à portée — arbitrage MJ. |

## Magie des Arcanes — Cieux (11)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arc de T'Essla | ✅ | oui |  |
| Bienfait de Bel Shanaar | 📜 | oui | Bienfait de Bel Shanaar : pendant 1 jour, tous les Tests d'Orientation du sorcier (ou impliquant le sorcier dans un Test d'équipage) bénéficient de +2 DR. |
| Bouclier céruléen | 📜 | oui | Bouclier céruléen : +DR PA à toutes les Localisations contre les attaques de Corps à corps ; un attaquant à l’arme métallique subit BFM Dégâts — arbitrage MJ. |
| Comète de Cassandora | 🟡 | oui | Comète de Cassandora : impact à la fin du prochain Round ; un Test de Perception ajuste (ou un échec fait dériver) le point de chute de BInit m par DR — arbitrage MJ. |
| Ironie du Destin | 🟡 | oui | Ironie du Destin : les alliés de la ZdE (hors Magie des Arcanes (Cieux)) partagent une réserve unique de Points de Chance pour la durée du Sort, réallouée à la fin — arbitrage MJ. |
| Le Premier Signe d'Amul | ✅ | oui |  |
| Le Second Signe d'Amul | 🟡 | oui | Le Second Signe d’Amul : +1 Point de Chance supplémentaire par tranche de +2 DR (en plus du +DR de base) — arbitrage MJ. |
| Le Troisième Signe d'Amul | ✅ | oui |  |
| Maudit | 📜 | oui | Maudit : tant que le Sort dure, vous pouvez dépenser un Point de Chance pour forcer la cible à relancer un Test — arbitrage MJ. |
| Mer d'huile | 📜 | oui | Mer d'huile : l'effet Calme plat (tableau Effet du vent, MDG p.107) s'applique dans une ZdE de (BFM) milles pendant (BFM) minutes — arbitrage MJ (échelle de vent non modélisée). |
| Solution de tir optimal de Niezlib | 📜 | oui | Solution de tir optimal de Niezlib : pendant 1 Round, les Tests effectués pour tirer avec un canon depuis le navire ciblé bénéficient de +1 DR. |

## Magie des Arcanes — Démonologie (4)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Destruction de Démon Mineur | 🟡 | oui | Destruction de Démon Mineur : ne draine que les Démons de Force Mentale inférieure à la vôtre ; vous gagnez alors +10 à une Caractéristique de votre choix pour la durée — arbitrage MJ. |
| Détection de démon | 📜 | oui | Détection de démon : vous percevez toute influence démoniaque à portée (invoquée, liée à un artefact, en possession…) — arbitrage MJ. |
| Manifestation de Démon mineur | 🟡 | oui | Manifestation de Démon mineur : Test opposé de Focalisation (Dhar)/Force Mentale — sur un succès il vous obéit puis disparaît ; sur un échec il se retourne contre vous (passez-le hostile) — arbitrage MJ. |
| Octogramme | 🟡 | oui | Octogramme : un cercle protecteur (diamètre BFM m) qu’aucune créature Démoniaque ne peut franchir, sauf si sa Force Mentale dépasse le double de la vôtre — arbitrage MJ. |

## Magie des Arcanes — Feu (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Cautériser | 🟡 | oui | La cible hurle de douleur (Aqshy brûle en guérissant). |
| Cœurs ardents | 🟡 | oui | Cœurs ardents : +1 Talent Coude-à-coude tant que le Sort est actif (arbitrage MJ). |
| Couronne de Flammes | 🟡 | oui | Couronne de Flammes : +1 Talent Seigneur de guerre tant que le Sort est actif ; par +2 DR, +1 Peur OU Seigneur de guerre repris — arbitrage MJ. |
| Grands feux d'U'Zhul | 🟡 | oui | Grands feux d’U’Zhul : la ZdE autour de la cible subit aussi +5 Dégâts immédiats (ignore PA) + Test d’Esquive ou En flammes — arbitrage MJ. |
| L'Égide d'Aqshy | 📜 | oui | Égide d’Aqshy : immunisé aux Dégâts de feu non magiques, ignore l’État En flammes, Protection (9+) contre le feu magique (arbitrage MJ). |
| L'Épée ardente de Rhuin | 🟡 | oui | Épée ardente de Rhuin : un porteur SANS Magie des Arcanes (Feu) qui obtient une Maladresse avec l’Épée subit ses flammes — arbitrage MJ. |
| Mur de feu | ✅ | oui |  |
| Purification | 🟡 | oui | Purification : consume les Influences corruptrices de la zone (malepierre, objets du Chaos) — arbitrage MJ. |

## Magie des Arcanes — Gueule (7)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bouf 'crâne | 🟡 | oui | Bouf’crâne : ceux qui connaissaient l’ancien propriétaire de la tête dévorée résistent à cette Peur avec −20 au Calme — arbitrage MJ. |
| Broyeur d'os | 🟡 | oui | Broyeur d’os : sur une Blessure Critique infligée, +20 au lancer sur le Tableau des Blessures Critiques — arbitrage MJ. |
| Festin des Damnés | 🟡 | oui | Festin des Damnés : seules les créatures de votre choix dans la ZdE sont affectées (résistance : Test de Résistance Difficile) ; à la fin du Sort, un non-ogre ayant blessé un ennemi teste Calme (+0) ou gagne Sonné — arbitrage MJ. |
| Goinfre costaud | 🟡 | oui | Goinfre costaud : à la fin du Sort, la cible doit se gaver d’un repas conséquent ou gagner un État Exténué (résistance initiale : Test de Calme Complexe) — arbitrage MJ. |
| Goûtemort | 📜 | oui | Goûtemort : en consommant une partie d’un cadavre, vous apprenez de façon générale comment la créature est morte (poison, lame, magie, mort naturelle…) — arbitrage MJ. |
| La Gueule | 🟡 | oui | La Gueule : un gouffre denté s’ouvre dans la ZdE. Test d’Esquive (+0) — réussite : +8 Dégâts (−1/DR) en se dégageant ; échec : chute dans la Gueule (+10 Dégâts + 3 Empêtré opposés à Force 60, +10 Dégâts/round, Critique si encore dedans à la fin) — arbitrage MJ. |
| Trollboyaux | 🟡 | oui | Trollboyaux : un non-ogre qui récupère des Blessures sous ce Sort teste Résistance (+20) ou voit sa chair verdir comme une peau de troll (cosmétique, pas une mutation) — arbitrage MJ. |

## Magie des Arcanes — Lumière (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bannissement | 🟡 | oui | Bannissement : seules les cibles d’Endurance < votre FM sont affectées ; une cible Mort-vivant/Démoniaque qui possédait DÉJÀ Instable est réduite à 0 PB — arbitrage MJ. |
| Clarté d'esprit | 🟡 | oui | Clarté d’esprit : les modificateurs négatifs issus de mutations mentales sont aussi ignorés — arbitrage MJ. |
| Fauche-démon | 🟡 | oui | Fauche-démon : les témoins (hors Magie des Arcanes (Lumière)) reçoivent +DR Aveuglé — arbitrage MJ. |
| Filet d'Amyntok | 🟡 | oui | Filet d’Amyntok : ce Sonné ne peut pas être retiré tant que le Sort dure et se récupère sur un Test d’Intelligence ; les créatures Bestial y sont immunisées — arbitrage MJ. |
| Lumière aveuglante | 🟡 | oui | Lumière aveuglante : touche quiconque regarde dans votre direction (hors Magie des Arcanes (Lumière)) — arbitrage MJ du ciblage. |
| Lumière de guérison | 🟡 | oui | Lumière de guérison : le retrait de Corruption ne vaut que pour 1 Point gagné dans l’heure précédente — arbitrage MJ. |
| Pensée rapide | ✅ | oui |  |
| Protection de Phâ | ✅ | oui |  |

## Magie des Arcanes — Magie naturelle (6)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bonne Volonté | 🟡 | oui | Bonne Volonté : dans la ZdE (BSoc m), tous les Tests de Sociabilité gagnent +10 et les Traits Psychologiques Animosité et Haine sont neutralisés — arbitrage MJ. |
| Charme protecteur | 📜 | oui | Charme protecteur : la breloque imprégnée confère le Talent Résistance à la magie à qui la porte, pour la durée (jours) — arbitrage MJ. |
| Chevaucher l'Obscurité | 📜 | oui | Chevaucher l’Obscurité : votre esprit quitte votre corps (qui reste immobile et insensible) et explore les environs en témoin invisible, traversant les obstacles non magiques — arbitrage MJ. |
| Nepenthès | 📜 | oui | Nepenthès : un philtre qui, bu tant que le Sort est actif, permet à la cible d’oublier définitivement un individu de son choix — arbitrage MJ. |
| Panacée | 📜 | oui | Panacée : la décoction enchantée, bue tant que le Sort dure, guérit BFM Blessures et 1 maladie (+1 maladie par +2 DR) — arbitrage MJ (effet à l’ingestion). |
| Séparer les branches | 📜 | oui | Séparer les branches : vous voyez dans le Monde des Esprits (créatures invisibles, esprits, démons, êtres normalement impossibles à repérer) — arbitrage MJ. |

## Magie des Arcanes — Métal (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arme enchantée | 🟡 | oui | Arme enchantée : par tranche de +3 DR, ajoutez +1 Atout ou retirez 1 Défaut de l’arme tant que le Sort dure — arbitrage MJ. |
| Creuset de Chamon | 🟡 | oui | Creuset de Chamon : un objet métallique non magique fond (lâché s’il est tenu, conserve sa valeur de matière première) ; la frappe ne touche que si l’objet est PORTÉ — arbitrage MJ. |
| Écaille d'acier | 🟡 | oui | Écaille d’acier : chaque frappe évitée améliore la Protection de 1 (jusqu’à 3+) — arbitrage MJ. |
| Forge de Chamon | 📜 | oui | Forge de Chamon : sur un objet métallique, ajoutez 1 Atout ou retirez 1 Défaut (+1 par +2 DR) — arbitrage MJ. |
| L'Or des fous | 📜 | oui | L’Or des fous : tout le métal d’un objet non magique devient de l’or pour la durée (peut alourdir une armure, ruiner une arme…) — arbitrage MJ. |
| Métal changeant | 📜 | oui | Métal changeant : un objet métallique non magique devient malléable (Test de Force ou de Métier pour le façonner) — arbitrage MJ. |
| Plume de plomb | 🟡 | oui | Plume de plomb : dans la ZdE, choisissez — les biens sont alourdis de +2 paliers de Surcharge, ou n’imposent plus de Surcharge — arbitrage MJ. |
| Transmutation de Chamon | 🟡 | oui | Transmutation de Chamon : une cible qui meurt pendant le Sort est enfermée dans une carapace de métal — arbitrage MJ. |

## Magie des Arcanes — Mort (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Caresse de Laniph | ✅ | oui |  |
| Dernières paroles | 📜 | oui | Dernières paroles : vous parlez à l’âme d’un mort récent (la journée précédente) ; elle ne peut que parler et ne ment pas — arbitrage MJ. |
| La Faux de Shyish | 🟡 | oui | La Faux de Shyish : les ennemis Mort-vivant ne reçoivent pas d’Avantage quand ils sont Engagés avec vous — arbitrage MJ. |
| Le Voile violet de Shyish | ✅ | oui |  |
| Mort rapide | 📜 | oui | Mort rapide : une cible à 0 Blessure et ≥ 2 Blessures Critiques meurt au contact (et ne peut être ranimée en mort-vivant) — arbitrage MJ. |
| Sanctifier | 🟡 | oui | Sanctifier : un cercle de Shyish (diamètre BFM m) qu’aucun Mort-vivant ne peut franchir, pour la durée — arbitrage MJ. |
| Vol de vie | ✅ | oui |  |
| Vortex d'âmes | 🟡 | oui | Vortex d’âmes : les +10 Dégâts (ignorant BE et PA) ne devraient toucher QUE les cibles Mort-vivant ; contre les vivants, seul le Brisé s’applique — arbitrage MJ. |

## Magie des Arcanes — Nécromancie (4)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Crâne hurlant | 🟡 | oui | Crâne hurlant : n’affecte que les cibles SANS le Trait Mort-vivant ; le Test de Calme se répète pour chaque Blessure infligée — arbitrage MJ. |
| L'appel de Vanhel | 📜 | oui | L’appel de Vanhel : (BInt) morts-vivants gagnent une Action ou un Mouvement gratuit (le même pour tous), +(BInt) cibles par +2 DR — arbitrage MJ. |
| Réanimation | 🟡 | oui | Réanimation : les réanimés (zombies, ou squelettes au choix) entrent avec l’État À Terre et tiennent jusqu’au lever du soleil ; +(BFM + DR) corps supplémentaires par +2 DR — arbitrage MJ. |
| Relever les morts | 🟡 | oui | Relever les morts : les squelettes entrent avec l’État À Terre et tiennent jusqu’au lever du soleil ; +(DR) squelettes supplémentaires par +2 DR — arbitrage MJ. |

## Magie des Arcanes — Ombres (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Destrier d'Ombre | 🟡 | oui | Destrier d’Ombre : chevauchez-le (règles de monture) ; la nuit, il gagne aussi Éthéré/Infravision/Insensible à la douleur/Furtif/Foulée/Protection 9+ — arbitrage MJ. |
| Illusion | 🟡 | oui | Illusion : masque la ZdE d’une image illusoire ; seul le Talent Seconde vue (Test de Perception Complexe) permet de la remarquer — arbitrage MJ. |
| Jumeau maléfique | 📜 | oui | Jumeau maléfique : vous prenez l’apparence d’un humanoïde familier (seul Seconde vue peut le percer) — arbitrage MJ. |
| Linceul d'Invisibilité | 📜 | oui | Linceul d’Invisibilité : la cible devient invisible aux sens ordinaires (Seconde vue la situe vaguement) ; le Sort cesse si elle fait du bruit ou attaque — arbitrage MJ. |
| Miasme mystifiant | 🟡 | oui | Miasme mystifiant : se déplacer dans la brume exige un Test de Perception (+0) sous peine d’À Terre ; à la dissipation, Test d’Initiative (+40) ou Sonné — arbitrage MJ. |
| Ombres étrangleuses | 🟡 | oui | Ombres étrangleuses : la cible ne peut pas parler (interactions vocales — arbitrage MJ). |
| Perte de mémoire | 📜 | oui | Perte de mémoire : la cible oublie tout de vous pour la durée ; au terme, un Test d’Intelligence (+20) raté rend l’oubli permanent — arbitrage MJ. |
| Portail d'Ombre | 🟡 | oui | Portail d’Ombre : les ennemis Engagés avec vous au départ ou à l’arrivée gagnent l’État Surpris — arbitrage MJ. |

## Magie des Arcanes — Sorcellerie (7)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Dégradation | 📜 | oui | Dégradation : un puits devient saumâtre, un champ pourrit en une nuit, ou un animal domestique tombe malade et meurt en 10 − DR jours — arbitrage MJ. |
| Horreur obsédante | 📜 | oui | Horreur obsédante : quiconque entre dans le lieu hanté gagne 1 Exténué (hors Talent Sorcellerie) et, sans Test de Calme (+0), +1 Exténué et un Brisé tant qu’il y reste — arbitrage MJ. |
| Infecte Bénédiction | ✅ | oui |  |
| Malédiction de douleur paralysante | 📜 | oui | Malédiction de douleur paralysante : poignardez la poupée à une Localisation — Jambe/Bras inutilisable (comme amputé), Corps (Exténué + À Terre sur Résistance ratée), Tête (Sonné + Inconscient sur Résistance ratée). Changer de Localisation = votre Action — arbitrage MJ. |
| Malédiction de malchance | 🟡 | oui | Malédiction de malchance : la cible ne peut plus dépenser de Points de Chance tant que le Sort dure — arbitrage MJ. |
| Mauvais œil | 🟡 | oui | Mauvais œil : Test opposé d’Intimidation/Calme (+ votre DR d’Incantation) — la cible subit +1 Exténué par tranche de DR+2 d’écart, et un Brisé au-delà de DR+6 — arbitrage MJ. |
| Menace rampante | 🟡 | oui | Menace rampante : pour votre Action, un Test d’Emprise sur les animaux envoie une nuée sur une autre cible à portée — arbitrage MJ. |

## Magie des Arcanes — Vie (11)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bourbier vivant | 📜 | oui | Bourbier vivant : le navire subit –2 Mouvement et –3 DR de Manœuvre tant qu'il est pris ; l'équipage peut couper les algues (Test étendu de Navigation Intermédiaire (+0), cibles = BFM + DR du lanceur) — arbitrage MJ (caractéristiques de navire). |
| Configuration du terrain | 📜 | oui | Configuration du terrain : après 1 minute de communion, vous percevez une carte mentale des reliefs/forêts/rivières naturels à portée (les zones habitées restent floues) — arbitrage MJ. |
| Don de Vie | 📜 | oui | Don de Vie : une rivière/un puits asséché renaît, un champ fructifie immédiatement, ou un animal malade guérit complètement — arbitrage MJ. |
| Eau de la terre | 🟡 | oui | Eau de la terre : vous jaillissez du sol — les ennemis que vous Engagez à l’arrivée gagnent l’État Surpris ; vous ne traversez pas la pierre (mais l’eau, oui) — arbitrage MJ. |
| Écorce | ✅ | oui |  |
| Forêt d'épines | 🟡 | oui | Forêt d’épines : traverser la zone sans le Talent Magie des Arcanes (Vie) impose un Test d’Agilité Difficile (−20) ; l’Empêtré subi utilise votre Force Mentale comme Force d’entrave — arbitrage MJ. |
| Graisse de la terre | 🟡 | oui | Graisse de la terre : la cible excrète d’un vert intense pour la durée — arbitrage MJ. |
| Que d'eau, que d'eau | 📜 | oui | Que d'eau, que d'eau : tous les tonneaux vides des réserves du navire se remplissent d'eau pure — arbitrage MJ (réserves d'eau du navire non modélisées). |
| Régénération | ✅ | oui |  |
| Sang de la Terre | 🟡 | oui | Sang de la Terre : seules les créatures en contact direct avec la terre (et vous, debout pieds nus) bénéficient du soin — arbitrage MJ. |
| Tourbillon | 📜 | oui | Tourbillon : un tourbillon (rotation lente, MDG p.113) se forme dans la ZdE ; Surincantation : 5 DR → Tourbillon, 8 → Puissant vortex, 13 → Maelstrom, 21+ → Maelstrom primordial — arbitrage MJ (périls nautiques non modélisés). |

## Magie des Arcanes & de Nécromancie (8)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Agression AEthyrique | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Appel de Vanhel | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Armure d’AEthyr | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Entrave | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Forme Spectrale | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Frénésie Artificielle | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Mouchard | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Télékinésie | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes & de Sorcellerie (5)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Effigie Maudite | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Faux- Semblant | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Nuée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Ruine | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Terreur Nocturne | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes & des Taillis (5)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Bienveillance | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Bouillon Revigorant | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fertilisation | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Nostrum | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Ramanchage | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie des Arcanes Skaven (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Avatar du Rat Cornu | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie du Chaos (9)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Allure démoniaque | 📜 | oui | Allure démoniaque : lancez 1d10 sur le Tableau des aspects démoniaques (selon votre Dieu) et gagnez le Trait obtenu pour la durée ; par +2 DR, prolongez et relancez. Trait Démoniaque + 0 PB = âme aspirée — arbitrage MJ. |
| Aspect sublimé | 📜 | oui | Aspect sublimé : la Cible paraît sans défaut (cicatrices, difformités, Mutations cachées) ; un Test de Perception Difficile (−20), ou Intermédiaire pour Seconde vue, révèle qu’un Sort opère sans en dévoiler la teneur — arbitrage MJ. |
| Décharge de Corruption | ✅ | oui |  |
| Déchirer l'Aethyr | 🟡 | oui | Déchirer l’Aethyr : un démon mineur de plus traverse le portail à CHAQUE fin de Round (+1/round par +5 DR) ; les vivants voyant la faille testent Résistance (+0) ou gagnent +1 Corruption ; entrer dedans tue, sauf à dépenser un Point de Destin — arbitrage MJ. |
| Esclave des Ténèbres | 📜 | oui | Esclave des Ténèbres : Test opposé de Force Mentale (à gagner d’au moins +2 DR) — l’âme de la Cible est envoyée dans les Royaumes du Chaos et son corps possédé par un démon (sauf Point de Destin) ; un échec retourne le Sort contre vous — arbitrage MJ. |
| Explosion de Corruption | ✅ | oui |  |
| Obsession | 📜 | oui | Obsession : via un objet cher à la Cible, vous l’obsédez (Tests de Résistance horaires, de plus en plus durs, une Maladresse la rend totalement obsédée 1d10−BFM heures) ; à la fin, Test de Résistance (+0) ou +1 Corruption — arbitrage MJ. |
| Odieux messager | 📜 | oui | Odieux messager : un essaim de démons mineurs invisibles porte un message (~25 mots, doublé par +2 DR) à votre Cible, presque instantanément — arbitrage MJ. |
| Pouvoir du Chaos | 🟡 | oui | Pouvoir du Chaos : dans la ZdE, le NI des Sorts est réduit de moitié (et l’incantation s’y fait en Difficulté Accessible +20) ; quiconque y reste teste Résistance (+0) à chaque fin de Round ou gagne +1 Corruption — arbitrage MJ. |

## Magie du Chaos — Nurgle (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Flot de Corruption | 🟡 | oui | Flot de Corruption : le Souffle ignore les PA et porte les Traits Corrosif et Poison ; une cible qui subit plus de Blessures que son BE teste Résistance (+0) ou contracte Infection du Sang — arbitrage MJ. |

## Magie du Chaos — Slaanesh (1)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Consentement | 📜 | oui | Consentement : l’Initiative de la cible chute à 10, ses déplacements deviennent erratiques (MJ), et elle ne peut entreprendre une Action qu’en réussissant un Test de Calme (+0) — arbitrage MJ. |

## Magie du Chaos — Tzeentch (15)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Aura dorée de Tzeentch | ✅ | oui |  |
| Avantage de Tzeentch | 📜 | oui | Avantage de Tzeentch : choisissez un Sort de n’importe quel Domaine et lancez-le comme s’il était mémorisé pour la durée (Focalisation Dhar ou celle du Domaine) ; une erreur de canalisation l’efface de votre esprit — arbitrage MJ. |
| Éclair du changement | 🟡 | oui | Éclair du changement : sur une Maladresse, la Cible effectue un jet de Mutation immédiat et gagne le Talent Magie du Chaos (Tzeentch) ; un Point de Détermination permet de résister à la Mutation — arbitrage MJ. |
| Feu bleu de Tzeentch | 🟡 | oui | Feu bleu de Tzeentch : tout le monde dans (BInit) m de la cible subit +3 Dégâts et gagne En flammes ; si une cible (Taille ≥ Petite) tombe à 0 PB sous cet État, sur un 1d10 = 9 deux Horreurs bleues éclosent de son corps — arbitrage MJ. |
| Feu rose de Tzeentch | 🟡 | oui | Feu rose de Tzeentch : si une cible (Taille ≥ Petite) tombe à 0 PB sous l’État En flammes de ce Sort, sur un 1d10 = 9 une Horreur rose éclot de son corps — arbitrage MJ. |
| Feu spirituel | 🟡 | oui | Feu spirituel : +1 Corruption supplémentaire par +2 DR si le Test de Calme échoue ; une Mutation déclenche un jet sur le tableau des Mutations mentales et +1 État En flammes — arbitrage MJ. |
| Flammes vacillantes du capricieux destin | 📜 | oui | Flammes vacillantes du capricieux destin : toute créature percevant ce feu inoffensif peut relancer chaque Test une fois (même réussi), mais teste alors Résistance (+0) ou gagne +1 Corruption (les porteurs de la marque de Tzeentch y sont immunisés) — arbitrage MJ. |
| La Main Pourpre | 📜 | oui | La Main Pourpre : à partir d’un cheveu/rognure de la Cible, ses paumes virent au violet profond pendant 1 heure par DR — un avertissement clair des sorciers de la Main Pourpre — arbitrage MJ. |
| Maître du Destin | 🟡 | oui | Maître du Destin : si l’Incantation échoue, vous gagnez +1 Point de Corruption par DR négatif ; le Sort ne peut être relancé avant la fin de sa durée — arbitrage MJ. |
| Malédiction de Tzeentch | 📜 | oui | Malédiction de Tzeentch : sur un Test opposé de Force Mentale gagné, la Cible (un autre lanceur) perd l’accès à un Sort tiré au hasard, pour 1 jour par DR — arbitrage MJ. |
| Parole de Tzeentch | 🟡 | oui | Parole de Tzeentch : sur une Maladresse, la Cible passe Inconscient + Corruption ; une fois remise, elle teste Résistance (+20) ou gagne +1 Corruption (Maladresse → Mutation mentale) — arbitrage MJ. |
| Percevoir l'écheveau | 📜 | oui | Percevoir l’écheveau : le MJ vous révèle la Motivation, l’Ambition à court terme et l’Ambition à long terme d’une cible que vous voyez — arbitrage MJ. |
| Tempête de feu de Tzeentch | 🟡 | oui | Tempête de feu de Tzeentch : les Cibles, ligotées de feu aethyrique, sont aussi considérées comme impuissantes pour la durée ; à la fin, un Test de Résistance (+0) opposé à votre Langue (Magick) perdu donne +1 Corruption (+1 par DR d’écart) — arbitrage MJ. |
| Trahison de Tzeentch | 📜 | oui | Trahison de Tzeentch : pour la durée, la cible ne peut plus utiliser ses Talents ni ajouter ses Augmentations de Compétences — tous ses Tests se font sur la Caractéristique nue — arbitrage MJ. |
| Transformation de Tzeentch | 🟡 | oui | Transformation de Tzeentch : la Cible est impuissante toute la durée du Sort. À la fin, elle fait un Test de Résistance Intermédiaire (+0) opposé à votre Langue (Magick) ; si elle échoue, +1 Point de Corruption, +1 par DR d’écart — arbitrage MJ. |

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
| Lumière | 🟡 | oui | Lumière : lueur de torche, modulable de bougie à lanterne sur un Test de Focalisation (+20). |
| Murmures | 📜 | oui | Murmures : projette votre voix vers un point à portée, sans Ligne de Vue. |
| Pas léger | 📜 | oui | Pas léger : votre passage ne laisse aucune trace organique (−20 implicite au Pistage adverse — arbitrage MJ). |
| Protection contre la pluie | ✅ | oui |  |
| Purification de l'eau | 📜 | oui | Purification de l’eau : purifie l’eau d’un récipient (poisons/polluants non magiques éliminés). |
| Putréfaction | 🟡 | oui | Putréfaction : denrées et vêtements organiques pourrissent (taille d’un poing) — arbitrage MJ. |
| Repères | 📜 | oui | Repères : vous savez où est le Nord. |
| Secousse | 📜 | oui | Secousse : l’objet tenu tombe (arme au sol — arbitrage MJ). |
| Serrure ouverte | 📜 | oui | Serrure ouverte : déverrouille une serrure non magique touchée. |
| Sommeil | 🟡 | oui | Sommeil : la cible se RÉVEILLE instantanément si on l'attaque (le coup la bouscule) — elle encaisse alors une attaque normale au lieu d'être achevée. Un bruit fort ou un allié qui la secoue peut aussi la tirer du sommeil. |
| Source | 📜 | oui | Source : fait jaillir ½ litre d’eau par Round (max Bonus d’Initiative litres). |
| Tendre l'oreille | 📜 | oui | Tendre l’oreille : vous entendez vos cibles comme si vous étiez à côté. |

## Magie Mineure (23)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Alarme | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bruit | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Brume Mystique | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Chuchotis | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Conserve | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Courant d’Air | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Eau Pure | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Éclat | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Espionnage | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fatigue | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Feu Follet | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Flamme | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Gors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Pestigors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Slaangors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Langue des Tzaangors | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Ouverture | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pied Léger | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Position | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Pourriture | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Projectile Mineur | ✅ | repli |  |
| Regard Lubrique | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Saccade | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Magie Mineure Skaven (2)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Faveur du Rat Cornu | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Marque du Rat Cornu | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Miracle (30)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Abondance de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Apaisement | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Arrière, Sorcière ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Aux Innocents les Mains Pleines ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Baratin | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bénédicité de Taal | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Blizzard | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Bon Débarras ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Catharsis | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Chaleur de la Fourrure | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Courage du Loup | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Dressage de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Fers de | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Haine du Faible | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Instinct Animal | 📜 | repli | Non curé : desc journalisée telle quelle. |
| La Vérité finit toujours par sortir | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Les Voies de la Nature | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Main de Rhya | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Marteau de Justice | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Modèle de Vertu | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Morsure d’Hiver | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Oeil de Lynx | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Piste Froide | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Résistance du Pénitent | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sagesse du Hibou | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sanctuaire | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Saut de Cabri | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Sus à l’Ennemi ! | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Trêve de Taal DSFL | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Verena m’est témoin ! | 📜 | repli | Non curé : desc journalisée telle quelle. |

## Sort (17)

| Sort | État | Curé | Reste à mécaniser (journalisé en jeu) |
|---|---|---|---|
| Arme Souillée | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Cogne-Fort | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Coup d’Boule ! | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Crépitements Vengeurs | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Démangeaison Agaçante | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Douces Paroles | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Flammes Bleues de Tzeentch | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Flammes Roses de Tzeentch | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Furoncle Infecté | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Lune de Malheur | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Malveillance Absolue | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Nuée de Mouches | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Prise de Tête | 📜 | repli | Non curé : desc journalisée telle quelle. |
| Soleil Noir | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Vol | 📜 | repli | Non curé : desc journalisée telle quelle. |
| WAAAGH ! | 🟡 | repli | Non curé : desc journalisée telle quelle. |
| Z’Oeils de Mork | 📜 | repli | Non curé : desc journalisée telle quelle. |
