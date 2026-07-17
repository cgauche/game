// STOCK CLIQUETÉ de l'intégrité du folio (#536) — consommé par
// `src/data/book-source-integrity.test.ts`. Patron whitelist-en-lib du dépôt
// (`rollSeamWhitelist.mjs`, `battleRngEngineLeakWhitelist.mjs`).
//
// Chaque clé `<dataset>:<id>` est une entrée dont le `source.page` déclaré est RÉFUTÉ par
// `folioIntegrity.mjs`, par l'une des deux voies : sa `desc` a été retrouvée VERBATIM dans le livre
// déclaré, encadrée des DEUX côtés par des marqueurs `data-folio` qui excluent le folio annoncé ; ou
// le folio dépasse le dernier folio ATTESTÉ du livre (`hors livre`, réfutation qui se passe de desc).
// Le commentaire de fin de ligne porte le folio déclaré → le folio MESURÉ.
//
// CLIQUET, pas absolution — trois verrous, tous dans le test :
//   (a) toute violation ABSENTE de cette liste échoue : une entrée neuve doit citer juste ;
//   (b) toute clé de cette liste qui ne viole PLUS échoue : le stock se solde en corrigeant le folio
//       au Source, jamais en gonflant la liste ;
//   (c) la TAILLE du stock est plafonnée (`FOLIO_RATCHET_MAX` dans le test) : sans ce plafond,
//       « le stock ne peut que décroître » n'était qu'un COMMENTAIRE, et le chemin le plus court pour
//       « solder » une régression restait d'ajouter une ligne ici, CI verte — le précédent `reconcile`
//       (157 dettes affichées, CI verte) que le dépôt a déjà payé. Faire croître ce stock impose donc
//       de relever le plafond DANS la garde : un geste visible en revue, jamais un append discret.
// `node scripts/data/audit-folios.mjs --stock` re-rend ce fichier et REFUSE de l'agrandir : l'outil
// ne sait que solder.
//
// COUVERTURE — les angles morts, dits sans détour (aucune de ces entrées n'est « absoute ») : sur
// 2082 entrées citées scannées, 1135 échappent à tout verdict d'encadrement — desc reformulée donc introuvable
// (729), desc trop courte pour localiser (138), chapitre sans marqueur (127), livre sans
// extraction FR (141). Une entrée neuve à desc non verbatim et à folio faux mais PLAUSIBLE
// (dans les bornes du livre) passe donc encore : seule la règle 5 la rattrape. La voie `hors livre`
// ne ferme que l'évasion « folio au-delà du livre ».
//
// Ampleur à la pose (2026-07-17) : 140 réfutées / 2082 scannées. Le stock n'est PAS « les défauts
// du dépôt » : c'est « les défauts que ces deux voies PROUVENT ». Il est dominé par le report à l'œil
// au fil des imports (écarts de ±1 à ±5 folios) ; échantillonnage adversarial : ~82 % de vraies
// erreurs, ~18 % d'ambiguïté prose/table (`source.page` désigne-t-il le folio de la PROSE ou celui de
// la ligne de stats / du titre de section gouvernant ?) — cas défendables laissés au stock, leur sort
// dépend d'un arbitrage de convention utilisateur, pas d'une correction.
//
// Déjà SOLDÉS à la pose, donc absents de la liste : le trio de Psychologie `amour`/`camaraderie`/
// `phobie` (190 → 191, LDB — attesté par la table de renvoi du LDB lui-même,
// `85 - Traits de créature.md:511/538/675`), `redoutable` (11 → 134, ZI — folio 11 sans contenu, seule
// définition en `14 - Expéditions prévues.md:1043`) et `fouissement` (13 → 134, ZI). Le ZI définit
// Fouissement DEUX fois, en toutes lettres : folio 23 (`02 - Griffon.md:66-70`, marqueurs 23 l.47 /
// 24 l.72), amorce « **Fouissement :** cette créature… » ; et folio 134 (`14 - Expéditions
// prévues.md:1047-1051`, marqueurs 134 l.1010 / 135 l.1053), amorce « Cette créature… », sous la même
// formule de titre `#### **Nouveau Trait de créature : X**` que `redoutable` (l.1043). Le folio retenu
// est 134 : c'est ce texte-là que la `desc` stocke VERBATIM (règle stricte 5 — la réf pointe le folio
// dont le texte est stocké). Le RÉCAPITULATIF, lui, est la table des folios 135-137
// (`14:1053+`), où Fouissement reparaît ABRÉGÉ en l.1097-1101 (folio 136). Les deux définitions
// complètes sont hors de portée du schéma (une entrée = une `source`) : #563.
/** @type {ReadonlySet<string>} */
export const FOLIO_RATCHET = new Set([
  // activities.json
  'activities.json:cartographie', // p.130 -> 134
  'activities.json:charge', // p.137 -> hors livre (dernier folio 98)
  'activities.json:commerce-opportunite', // p.130 -> 134
  'activities.json:compte-a-rebours', // p.167 -> hors livre (dernier folio 98)
  'activities.json:duel', // p.223 -> hors livre (dernier folio 98)
  'activities.json:entrainement-equipage', // p.130 -> 134
  'activities.json:infiltration', // p.73 -> 84
  'activities.json:inspire', // p.71 -> 84
  'activities.json:intrus', // p.219 -> hors livre (dernier folio 98)
  'activities.json:ligne-de-mire', // p.206 -> hors livre (dernier folio 98)
  'activities.json:motivation', // p.149 -> hors livre (dernier folio 98)
  'activities.json:percee', // p.173 -> hors livre (dernier folio 98)
  'activities.json:planification', // p.79 -> 84
  'activities.json:pluie-de-fleches', // p.143 -> hors livre (dernier folio 98)
  'activities.json:protection', // p.155 -> hors livre (dernier folio 98)
  'activities.json:rassemblement', // p.122 -> hors livre (dernier folio 98)
  'activities.json:rassembler-des-forces', // p.94 -> 85
  'activities.json:reperage', // p.100 -> hors livre (dernier folio 98)
  'activities.json:sabotage', // p.104 -> hors livre (dernier folio 98)
  'activities.json:survol', // p.215 -> hors livre (dernier folio 98)
  'activities.json:tenez-votre-position', // p.161 -> hors livre (dernier folio 98)
  'activities.json:tuez-la-bete', // p.211 -> hors livre (dernier folio 98)
  // careers.json
  'careers.json:chevalier-du-loup-blanc', // p.34 -> 32
  // characteristics.json
  'characteristics.json:chance', // p.34 -> 170
  // creatures.json
  'creatures.json:anguille-du-reik', // p.85 -> 86
  'creatures.json:athlete', // p.145 -> 143
  'creatures.json:beate-moser', // p.143 -> 141
  'creatures.json:brute', // p.145 -> 143
  'creatures.json:frere-bengt', // p.102 -> 96-100
  'creatures.json:gerdon-salzwed', // p.151 -> 150
  'creatures.json:grand-vizir-bhar', // p.108 -> 103-106
  'creatures.json:hasso-schroeter', // p.152 -> 151
  'creatures.json:hugo-vallonvert', // p.143 -> 141
  'creatures.json:johen', // p.80 -> 76-78
  'creatures.json:kat-sperber', // p.153 -> 152
  'creatures.json:naiade', // p.87 -> 88
  'creatures.json:theresia-kleist', // p.154 -> 153
  'creatures.json:yanni-weber', // p.69 -> 65-67
  // domains.json
  'domains.json:dhar', // p.44 -> 233+
  'domains.json:magie-naturelle', // p.44 -> 233+
  // locations.json
  'locations.json:les-sinistres-et-sombres-forets', // p.269 -> 268
  // maladies.json
  'maladies.json:verole-cerebrale-a-taches-vertes', // p.131 -> 128
  // naval-traits.json
  'naval-traits.json:blindage-bronze', // p.97 -> 98
  'naval-traits.json:cabine-de-luxe', // p.97 -> 98
  'naval-traits.json:clinfoc', // p.97 -> 98
  'naval-traits.json:embarcation-de-bord', // p.97 -> 98
  'naval-traits.json:figure-de-proue', // p.97 -> 98
  'naval-traits.json:lissage', // p.97 -> 99
  'naval-traits.json:murs-blindes', // p.65 -> 66
  'naval-traits.json:propulsion-a-vapeur', // p.97 -> 99
  'naval-traits.json:ralentisseurs-lateraux', // p.97 -> 98
  'naval-traits.json:sabord', // p.97 -> 99
  // qualities.json
  'qualities.json:brise-coque', // p.48 -> 44
  'qualities.json:immobilisante-fixe', // p.95 -> 96
  // skills.json
  'skills.json:escalade', // p.12 -> 118+
  // species.json
  'species.json:humains-bjornling-norse', // p.54 -> 56
  'species.json:humains-sarl-norse', // p.54 -> 56
  'species.json:humains-skaeling-norse', // p.54 -> 56
  'species.json:nains-norse', // p.54 -> 41
  // spells.json
  'spells.json:bon-baiser-d-la-fosse-noire', // p.10 -> 15
  'spells.json:maitre-de-la-bete', // p.245 -> 246
  'spells.json:nuee-d-escampette', // p.10 -> 15
  // symptoms.json
  'symptoms.json:crampes-abdominales', // p.92 -> 93
  'symptoms.json:malaise', // p.190 -> 188-189
  'symptoms.json:nausee', // p.190 -> 188-189
  'symptoms.json:persistant', // p.190 -> 188-189
  'symptoms.json:rage-meurtriere', // p.131 -> 128
  'symptoms.json:touxEternuements', // p.190 -> 188-189
  // talents.json
  'talents.json:empreint-d-ulgu', // p.90 -> 88
  // tavernGames.json
  'tavernGames.json:al-zahr', // p.93 -> 91
  'tavernGames.json:bras-de-fer', // p.93 -> 92
  'tavernGames.json:cerevis', // p.94 -> 93
  // traits.json
  'traits.json:capricieux', // p.89 -> 90
  'traits.json:engloutir', // p.89 -> 90
  'traits.json:forme-de-guerriere-naiade', // p.87 -> 88
  'traits.json:hallucinogene', // p.89 -> 90
  'traits.json:impenetrable-structure', // p.8 -> 88+
  'traits.json:rampant', // p.89 -> 90
  'traits.json:resistant', // p.8 -> 88+
  'traits.json:s-accrocher-pour-se-nourrir', // p.89 -> 90
  'traits.json:salive-analgesique', // p.89 -> 90
  'traits.json:salive-anticoagulante', // p.89 -> 90
  // trappings.json
  'trappings.json:arme-simple', // p.294 -> 296
  'trappings.json:arquebuse-a-double-canon', // p.100 -> 101
  'trappings.json:arquebuse-a-meche', // p.100 -> 101
  'trappings.json:balle-de-gros-calibre-et-poudre', // p.102 -> 103
  'trappings.json:batterie-tonnerre-de-feu', // p.123 -> 122
  'trappings.json:bombe-incendiaire-mortier', // p.106 -> 101
  'trappings.json:boussole', // p.127 -> 126
  'trappings.json:canne-pistolet', // p.100 -> 103
  'trappings.json:canon-crache-plomb', // p.29 -> 30
  'trappings.json:cape-2', // p.95 -> 96
  'trappings.json:cartouche-en-papier', // p.102 -> 104
  'trappings.json:cartouche-et-poudre-de-precision', // p.102 -> 104
  'trappings.json:catapulte-grande', // p.122 -> 123
  'trappings.json:catapulte-moyenne', // p.122 -> 123
  'trappings.json:catapulte-petite', // p.122 -> 123
  'trappings.json:cimeterre', // p.91 -> 90
  'trappings.json:dague-ballock', // p.91 -> 90
  'trappings.json:epee-de-cour', // p.90 -> 93
  'trappings.json:filet', // p.31 -> 29
  'trappings.json:filet-leste', // p.95 -> 96
  'trappings.json:gaffe-2', // p.90 -> 94
  'trappings.json:gantelet-a-pointes', // p.90 -> 94
  'trappings.json:grande-lance', // p.29 -> 30
  'trappings.json:grande-massue-ogre', // p.29 -> 30
  'trappings.json:grappin-munition', // p.102 -> 104
  'trappings.json:hache-arquebuse', // p.100 -> 101
  'trappings.json:hache-d-armes', // p.96 -> 97
  'trappings.json:hallebarde-arquebuse', // p.100 -> 102
  'trappings.json:haquebute', // p.100 -> 102
  'trappings.json:huile-de-lampe', // p.308 -> 309+
  'trappings.json:jezail-a-malepierre', // p.45 -> 94
  'trappings.json:lampe-tempete', // p.308 -> 309+
  'trappings.json:livre-medecine', // p.304 -> 305+
  'trappings.json:livre-religion', // p.304 -> 305+
  'trappings.json:massue-ogre', // p.29 -> 30
  'trappings.json:mortier-a-main', // p.100 -> 103
  'trappings.json:necessaire-de-deguisement', // p.303 -> 304+
  'trappings.json:outils-de-crochetage', // p.303 -> 304+
  'trappings.json:peau-de-phoque', // p.127 -> 126
  'trappings.json:pertuisane-fauchard', // p.96 -> 97
  'trappings.json:pieces-detachees-de-navire', // p.127 -> 126
  'trappings.json:piege-a-animaux', // p.303 -> 304+
  'trappings.json:piege-a-chaines', // p.29 -> 30
  'trappings.json:pistolet-ogre', // p.29 -> 30
  'trappings.json:pistolet-patte-de-griffon', // p.100 -> 102
  'trappings.json:poing-de-fer', // p.29 -> 30
  'trappings.json:poivriere', // p.100 -> 103
  'trappings.json:poudre-impregnee-d-aqshy', // p.102 -> 104
  'trappings.json:ration-biscuits-de-mer', // p.127 -> 126
  'trappings.json:ration-nourriture-preservee', // p.127 -> 126
  'trappings.json:ration-soupe-chou-fermente', // p.127 -> 126
  'trappings.json:sabre', // p.90 -> 93
  'trappings.json:sac-de-couchage', // p.308 -> 309+
  'trappings.json:serpe-de-guerre', // p.96 -> 97
  'trappings.json:tente', // p.308 -> 309+
  'trappings.json:tonneau-d-eau-douce', // p.127 -> 125
  'trappings.json:tonneau-de-petite-biere', // p.127 -> 126
  'trappings.json:zweihander-flamberge', // p.96 -> 97
])
