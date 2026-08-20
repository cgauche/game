// Stock GELÉ des désalignements folio ↔ ligne mesurés le 2026-08-20 (#1318 E8), consommé par le
// cliquet `src/data/folio-line-align.test.ts`. Chaque clé = `<dataset>#<id de l'entrée>` ; le
// commentaire porte la citation à la ligne et les DEUX folios (mesuré au marqueur / déclaré).
//
// Ce que le stock dit : ces entrées citent deux fois leur source et les deux citations divergent.
// Il ne dit PAS laquelle ment — trancher demande d'ouvrir le `Source/` entrée par entrée (une ligne
// dérivée à la ré-extraction Marker, un folio pris sur le titre de section gouvernant et un folio
// simplement faux se ressemblent tous les trois ici). Le stock ne peut que DÉCROÎTRE : on solde une
// entrée en RELEVANT le passage, jamais en alignant l'une sur l'autre à l'aveugle.
//
// 43 au relevé initial, 41 après les deux soldes du MÊME lot (folios pleinement faux, relevés au
// `Source/`) : `combat-stakes.json#combat-aa-bleed` 61 → 80 (sommaire imprimé d'Aux Armes,
// `01 - CRÉDITS.md` : « Blessures, Blessures Critiques et mort 80 ») et
// `flow-stakes.json#fate-save-choice` 34 → 170 (« Dépenser du Destin » sous l'ancre
// `data-folio="170"` de `17 - Destin et Résistance.md` ; le folio 34 est celui de la CRÉATION de
// personnage, où le Destin est attribué, pas celui de son sacrifice).
export const FOLIO_LINE_ALIGN_RATCHET = new Set([
  // careers.json (2)
  'careers.json#alchimiste-ordinaire', // « VDM 03 l.40 » → mesuré 35, déclaré 36
  'careers.json#devin', // « VDM 03 l.236 » → mesuré 39, déclaré 40
  // combat-stakes.json (6)
  'combat-stakes.json#combat-end-disease', // « LDB 20 l.25 … » → mesuré 186, déclaré 187
  'combat-stakes.json#combat-spell-plus', // « LDB 47 l.311 » → mesuré 242, déclaré 236
  'combat-stakes.json#combat-psych', // « LDB 21 l.9 … et l.27 » → mesuré 190, déclaré 192
  'combat-stakes.json#encounter-psych', // « LDB 21 l.9 … et l.27 » → mesuré 190, déclaré 192
  'combat-stakes.json#water-exposure', // « MSRC 16 l.13 et l.49 » → mesuré 91, déclaré 92
  'combat-stakes.json#structure-critical', // « AA 10 l.114 » → mesuré 121, déclaré 120
  // flow-stakes.json (9)
  'flow-stakes.json#appraise-evaluate', // « LDB 59 l.41 » → mesuré 291, déclaré 289
  'flow-stakes.json#appraise-detect', // « LDB 10 l.336 » → mesuré 136, déclaré 128
  'flow-stakes.json#heal-wounds', // « LDB 09 l.243 » → mesuré 122, déclaré 123
  'flow-stakes.json#heal-bleed', // « LDB 09 l.243 » → mesuré 122, déclaré 123
  'flow-stakes.json#heal-ammo', // « LDB 62 l.250 » → mesuré 298, déclaré 291
  'flow-stakes.json#shanty-roll', // « MDG 09 l.32-40 » → mesuré 63, déclaré 71
  'flow-stakes.json#recover-empetre', // « LDB 16 l.66 » → mesuré 168, déclaré 171
  'flow-stakes.json#recover-en-flammes', // « LDB 16 l.84 » → mesuré 168, déclaré 171
  'flow-stakes.json#crew-test-roll', // « MDG 14 l.13-19 » → mesuré 121, déclaré 108
  // regles.json (7)
  'regles.json#navigation-agilite-de-rame', // « MSRC 7 l.17 » → mesuré 28, déclaré 29
  'regles.json#navigation-derive', // « MSRC 7 l.38 » → mesuré 28, déclaré 29
  'regles.json#navigation-louvoyage', // « MSRC 7 l.39 » → mesuré 28, déclaré 29
  'regles.json#navigation-chavirage', // « MSRC 7 l.40 » → mesuré 28, déclaré 29
  'regles.json#navigation-greement', // « MSRC 7 l.41 » → mesuré 28, déclaré 29
  'regles.json#exposition-hydrique', // « MSRC 16 l.13 … et l.49 » → mesuré 91, déclaré 92
  'regles.json#tests-opposes', // « LDB 12 l.155-160 » → mesuré 153, déclaré 154
  // voyage-stakes.json (16)
  'voyage-stakes.json#river-nav', // « MSRC 7 l.38 » → mesuré 28, déclaré 29
  'voyage-stakes.json#river-tack', // « MSRC 7 l.39 » → mesuré 28, déclaré 29
  'voyage-stakes.json#river-capsize', // « MSRC 7 l.40 » → mesuré 28, déclaré 29
  'voyage-stakes.json#river-rigging', // « MSRC 7 l.41 » → mesuré 28, déclaré 29
  'voyage-stakes.json#river-righting', // « MSRC 7 l.40 » → mesuré 28, déclaré 29
  'voyage-stakes.json#river-peril-detect', // « MSRC 7 l.136 » → mesuré 31, déclaré 30
  'voyage-stakes.json#sea-overspeed', // « MDG 12 l.121-142 » → mesuré 96, déclaré 121
  'voyage-stakes.json#sea-force-pace', // « MDG 13 l.95-111 » → mesuré 105, déclaré 132
  'voyage-stakes.json#sea-epuisement', // « MDG 13 l.109-111 » → mesuré 105, déclaré 132
  'voyage-stakes.json#sea-scorbut', // « MDG 14 l.230 » → mesuré 125, déclaré 143
  'voyage-stakes.json#sea-mal-de-mer', // « MDG 14 l.211-222 » → mesuré 125, déclaré 142
  'voyage-stakes.json#sea-tonneau-expose', // « MDG 14 l.209 » → mesuré 125, déclaré 142
  'voyage-stakes.json#sea-tonneau-contamine', // « MDG 14 l.209 » → mesuré 125, déclaré 142
  'voyage-stakes.json#sea-degagement', // « MDG 13 l.471-499 » → mesuré 112, déclaré 132
  'voyage-stakes.json#crew-progression', // « MDG 14 l.63 » → mesuré 122, déclaré 123
  'voyage-stakes.json#crew-tourbillon', // « MDG 13 l.514-528 » → mesuré 113, déclaré 110
  // weaponGroups.json (1)
  'weaponGroups.json#munitions', // « LDB 62 l.106 … » → mesuré 295, déclaré 296
])

/**
 * Entrées que le détecteur REFUSE de juger faute d'ancres (`reason: 'queue-trouee'` : la ligne citée
 * tombe au-delà de la dernière ancre `data-folio` du chapitre, et le chapitre suivant ne reprend pas
 * la numérotation — résidu #522). Gelées NOMINATIVEMENT pour que la COUVERTURE du détecteur soit un
 * chiffre tenu et non un angle mort : leur folio déclaré est plausible mais n'a PAS été
 * machine-vérifié (relu à la main, #1318 E8). Si une extraction regagne ses ancres, l'entrée devient
 * jugeable et doit SORTIR de cette liste.
 */
export const FOLIO_LINE_ALIGN_NON_JUGEABLE = new Set([
  'obsessions.json#(racine)', // « EDOC 12 l.170 » — déclaré 69 (EDOC 12 : ancres 64 et 65 seules, folios 66-71 sans ancre)
  'reglesOptionnelles.json#vents-tourbillonnants', // « LDB 46 l.179-190 » — déclaré 238 (dernière ancre du chapitre, le voisin ne la continue pas)
  'reglesOptionnelles.json#corruption-tables-edoc', // « EDOC 12 l.63 » — déclaré 65 (même trou EDOC 12)
])
