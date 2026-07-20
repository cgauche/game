// STOCK CLIQUETÉ du LITTÉRAL == JETON dans les tenues (#583 point 1) — consommé par
// `src/gameIso/rig/parts/tenues/palette-literal.test.ts`. Patron whitelist-en-lib du dépôt
// (`fleshGradientStock.mjs`, `rigPartViewStock.mjs`, `folioRatchetStock.mjs`).
//
// Un littéral hex (`fill`/`stroke`/`stop-color`) qui vaut EXACTEMENT une valeur déclarée dans la
// `palette` du MÊME def aurait dû être le jeton `@<clé>` correspondant — peu importe la matière
// peinte (chair, cuir, tissu, plume…). Corps du Set GÉNÉRÉ par
// `npx tsx scripts/rig/regen-palette-literal-stock.mts` (DÉCROISSANT-SEULEMENT).
//
// Clé = `<tenueId>:<slot>:<vue>#<n>` (id STABLE `slugId(def.name)`, `n` = rang de l'occurrence
// DANS le slot) — le libellé est en commentaire. Le grain à l'OCCURRENCE est ce qui rend le
// cliquet incontournable : au grain `slot:vue`, une clé déjà stockée absolvait toute recopie
// NEUVE ajoutée au même slot (mesuré : 40 littéraux injectés dans un slot stocké, garde restée
// VERTE). Compter par occurrence a donc mécaniquement multiplié le COMPTE sans que la dette
// bouge : 221 clés à la pose (2026-07-18, grain `slot:vue`) = 1353 clés au grain actuel, sur les
// MÊMES 58 defs / 117 tenues. Ne jamais lire ces deux nombres comme une croissance. Un slot se solde en
// remplaçant SES littéraux par le jeton `@<clé>` qu'ils recopient (lot d'art, hors périmètre #583
// — mesure + garde seulement) puis en relançant le régénérateur, jamais en retirant la ligne à la
// main.
//
// CLIQUET, pas absolution : la garde échoue (a) sur toute clé NEUVE — une tenue neuve ne recopie
// pas un littéral qui vaut un jeton déclaré ; (b) sur toute clé du stock qui ne recopie plus
// (soldée) ; (c) si la TAILLE dépasse son plafond (`MAX_PALETTE_LITERAL`, gelé dans la garde, pas
// ici).
//
// ⚠ Comparaison EXACTE uniquement (distance ZÉRO, insensible casse/guillemets) — jamais une
// distance colorimétrique (faux positifs confirmés #583, cf. `fleshGradientStock.mjs`).

/** @type {ReadonlySet<string>} */
export const PALETTE_LITERAL_RATCHET = new Set([
  'apothicaire:tete:back#0', // Apothicaire
  'apothicaire:tete:back#1', // Apothicaire
  'apothicaire:tete:profile#0', // Apothicaire
  'apothicaire:tete:profile#1', // Apothicaire
  'apothicaire:torse:back#0', // Apothicaire
  'apothicaire:torse:back#1', // Apothicaire
  'apothicaire:torse:back#10', // Apothicaire
  'apothicaire:torse:back#2', // Apothicaire
  'apothicaire:torse:back#3', // Apothicaire
  'apothicaire:torse:back#4', // Apothicaire
  'apothicaire:torse:back#5', // Apothicaire
  'apothicaire:torse:back#6', // Apothicaire
  'apothicaire:torse:back#7', // Apothicaire
  'apothicaire:torse:back#8', // Apothicaire
  'apothicaire:torse:back#9', // Apothicaire
  'apothicaire:torse:profile#0', // Apothicaire
  'apothicaire:torse:profile#1', // Apothicaire
  'apothicaire:torse:profile#10', // Apothicaire
  'apothicaire:torse:profile#2', // Apothicaire
  'apothicaire:torse:profile#3', // Apothicaire
  'apothicaire:torse:profile#4', // Apothicaire
  'apothicaire:torse:profile#5', // Apothicaire
  'apothicaire:torse:profile#6', // Apothicaire
  'apothicaire:torse:profile#7', // Apothicaire
  'apothicaire:torse:profile#8', // Apothicaire
  'apothicaire:torse:profile#9', // Apothicaire
  'archer:bras:front#0', // Archer
  'archer:torse:back#0', // Archer
  'archer:torse:back#1', // Archer
  'archer:torse:front#0', // Archer
  'archer:torse:profile#0', // Archer
  'archer:torse:profile#1', // Archer
  'arquebusier:torse:front#0', // Arquebusier
  'arquebusier:torse:front#1', // Arquebusier
  'arquebusier:torse:front#2', // Arquebusier
  'arquebusier:torse:front#3', // Arquebusier
  'arquebusier:torse:front#4', // Arquebusier
  'arquebusier:torse:front#5', // Arquebusier
  'arquebusier:torse:front#6', // Arquebusier
  'arquebusier:torse:front#7', // Arquebusier
  'arquebusier:torse:profile#0', // Arquebusier
  'arquebusier:torse:profile#1', // Arquebusier
  'artiste:tete:back#0', // Artiste
  'artiste:tete:back#1', // Artiste
  'artiste:tete:back#2', // Artiste
  'artiste:tete:profile#0', // Artiste
  'artiste:tete:profile#1', // Artiste
  'artiste:tete:profile#2', // Artiste
  'artiste:tete:profile#3', // Artiste
  'artiste:torse:back#0', // Artiste
  'artiste:torse:back#1', // Artiste
  'artiste:torse:back#2', // Artiste
  'artiste:torse:back#3', // Artiste
  'artiste:torse:back#4', // Artiste
  'artiste:torse:back#5', // Artiste
  'artiste:torse:back#6', // Artiste
  'artiste:torse:back#7', // Artiste
  'artiste:torse:back#8', // Artiste
  'artiste:torse:profile#0', // Artiste
  'artiste:torse:profile#1', // Artiste
  'artiste:torse:profile#2', // Artiste
  'artiste:torse:profile#3', // Artiste
  'artiste:torse:profile#4', // Artiste
  'artiste:torse:profile#5', // Artiste
  'artiste:torse:profile#6', // Artiste
  'artiste:torse:profile#7', // Artiste
  'artiste:torse:profile#8', // Artiste
  'artiste:torse:profile#9', // Artiste
  'bailli:tete:back#0', // Bailli
  'bailli:tete:back#1', // Bailli
  'bailli:tete:back#2', // Bailli
  'bailli:tete:profile#0', // Bailli
  'bailli:tete:profile#1', // Bailli
  'bailli:torse:back#0', // Bailli
  'bailli:torse:back#1', // Bailli
  'bailli:torse:back#2', // Bailli
  'bailli:torse:back#3', // Bailli
  'bailli:torse:back#4', // Bailli
  'bailli:torse:back#5', // Bailli
  'bailli:torse:back#6', // Bailli
  'bailli:torse:profile#0', // Bailli
  'bailli:torse:profile#1', // Bailli
  'bailli:torse:profile#2', // Bailli
  'bailli:torse:profile#3', // Bailli
  'bailli:torse:profile#4', // Bailli
  'bailli:torse:profile#5', // Bailli
  'bailli:torse:profile#6', // Bailli
  'bailli:torse:profile#7', // Bailli
  'bailli:torse:profile#8', // Bailli
  'bailli:torse:profile#9', // Bailli
  'cavalier:tete:back#0', // Cavalier
  'cavalier:tete:back#1', // Cavalier
  'cavalier:tete:back#2', // Cavalier
  'cavalier:tete:back#3', // Cavalier
  'cavalier:tete:back#4', // Cavalier
  'cavalier:tete:back#5', // Cavalier
  'cavalier:tete:back#6', // Cavalier
  'cavalier:tete:back#7', // Cavalier
  'cavalier:tete:profile#0', // Cavalier
  'cavalier:tete:profile#1', // Cavalier
  'cavalier:tete:profile#2', // Cavalier
  'cavalier:tete:profile#3', // Cavalier
  'cavalier:tete:profile#4', // Cavalier
  'cavalier:tete:profile#5', // Cavalier
  'cavalier:tete:profile#6', // Cavalier
  'cavalier:tete:profile#7', // Cavalier
  'cavalier:torse:back#0', // Cavalier
  'cavalier:torse:back#1', // Cavalier
  'cavalier:torse:back#10', // Cavalier
  'cavalier:torse:back#11', // Cavalier
  'cavalier:torse:back#12', // Cavalier
  'cavalier:torse:back#2', // Cavalier
  'cavalier:torse:back#3', // Cavalier
  'cavalier:torse:back#4', // Cavalier
  'cavalier:torse:back#5', // Cavalier
  'cavalier:torse:back#6', // Cavalier
  'cavalier:torse:back#7', // Cavalier
  'cavalier:torse:back#8', // Cavalier
  'cavalier:torse:back#9', // Cavalier
  'cavalier:torse:profile#0', // Cavalier
  'cavalier:torse:profile#1', // Cavalier
  'cavalier:torse:profile#2', // Cavalier
  'cavalier:torse:profile#3', // Cavalier
  'cavalier:torse:profile#4', // Cavalier
  'cavalier:torse:profile#5', // Cavalier
  'cavalier:torse:profile#6', // Cavalier
  'cavalier:torse:profile#7', // Cavalier
  'cavalier:torse:profile#8', // Cavalier
  'cavalier:torse:profile#9', // Cavalier
  'charlatan:tete:back#0', // Charlatan
  'charlatan:tete:back#1', // Charlatan
  'charlatan:tete:back#2', // Charlatan
  'charlatan:tete:profile#0', // Charlatan
  'charlatan:tete:profile#1', // Charlatan
  'charlatan:tete:profile#2', // Charlatan
  'charlatan:tete:profile#3', // Charlatan
  'charlatan:tete:profile#4', // Charlatan
  'charlatan:torse:back#0', // Charlatan
  'charlatan:torse:back#1', // Charlatan
  'charlatan:torse:back#2', // Charlatan
  'charlatan:torse:back#3', // Charlatan
  'charlatan:torse:back#4', // Charlatan
  'charlatan:torse:back#5', // Charlatan
  'charlatan:torse:back#6', // Charlatan
  'charlatan:torse:back#7', // Charlatan
  'charlatan:torse:back#8', // Charlatan
  'charlatan:torse:back#9', // Charlatan
  'charlatan:torse:profile#0', // Charlatan
  'charlatan:torse:profile#1', // Charlatan
  'charlatan:torse:profile#2', // Charlatan
  'charlatan:torse:profile#3', // Charlatan
  'charlatan:torse:profile#4', // Charlatan
  'charlatan:torse:profile#5', // Charlatan
  'charlatan:torse:profile#6', // Charlatan
  'charlatan:torse:profile#7', // Charlatan
  'charlatan:torse:profile#8', // Charlatan
  'chasseur-de-primes:tete:profile#0', // Chasseur de primes
  'chasseur-de-primes:tete:profile#1', // Chasseur de primes
  'chasseur-de-primes:torse:back#0', // Chasseur de primes
  'chasseur-de-primes:torse:back#1', // Chasseur de primes
  'chasseur-de-primes:torse:back#2', // Chasseur de primes
  'chasseur-de-primes:torse:profile#0', // Chasseur de primes
  'chasseur-de-primes:torse:profile#1', // Chasseur de primes
  'chasseur-de-primes:torse:profile#2', // Chasseur de primes
  'chasseur-de-primes:torse:profile#3', // Chasseur de primes
  'chasseur-de-primes:torse:profile#4', // Chasseur de primes
  'chasseur-de-primes:torse:profile#5', // Chasseur de primes
  'chasseur:tete:back#0', // Chasseur
  'chasseur:tete:back#1', // Chasseur
  'chasseur:tete:back#2', // Chasseur
  'chasseur:tete:back#3', // Chasseur
  'chasseur:tete:back#4', // Chasseur
  'chasseur:tete:profile#0', // Chasseur
  'chasseur:tete:profile#1', // Chasseur
  'chasseur:tete:profile#2', // Chasseur
  'chasseur:tete:profile#3', // Chasseur
  'chasseur:torse:back#0', // Chasseur
  'chasseur:torse:back#1', // Chasseur
  'chasseur:torse:back#2', // Chasseur
  'chasseur:torse:back#3', // Chasseur
  'chasseur:torse:back#4', // Chasseur
  'chasseur:torse:back#5', // Chasseur
  'chasseur:torse:back#6', // Chasseur
  'chasseur:torse:back#7', // Chasseur
  'chasseur:torse:profile#0', // Chasseur
  'chasseur:torse:profile#1', // Chasseur
  'chasseur:torse:profile#2', // Chasseur
  'chasseur:torse:profile#3', // Chasseur
  'chevalier-panthere:bras:back#0', // Chevalier Panthère
  'chevalier-panthere:bras:front#0', // Chevalier Panthère
  'chevalier-panthere:bras:front#1', // Chevalier Panthère
  'chevalier-panthere:bras:front#2', // Chevalier Panthère
  'chevalier-panthere:bras:profile#0', // Chevalier Panthère
  'chevalier-panthere:bras:profile#1', // Chevalier Panthère
  'chevalier-panthere:jambes:back#0', // Chevalier Panthère
  'chevalier-panthere:jambes:back#1', // Chevalier Panthère
  'chevalier-panthere:jambes:back#2', // Chevalier Panthère
  'chevalier-panthere:jambes:front#0', // Chevalier Panthère
  'chevalier-panthere:jambes:front#1', // Chevalier Panthère
  'chevalier-panthere:jambes:front#2', // Chevalier Panthère
  'chevalier-panthere:jambes:profile#0', // Chevalier Panthère
  'chevalier-panthere:tete:back#0', // Chevalier Panthère
  'chevalier-panthere:tete:back#1', // Chevalier Panthère
  'chevalier-panthere:tete:front#0', // Chevalier Panthère
  'chevalier-panthere:tete:front#1', // Chevalier Panthère
  'chevalier-panthere:tete:front#2', // Chevalier Panthère
  'chevalier-panthere:tete:profile#0', // Chevalier Panthère
  'chevalier-panthere:tete:profile#1', // Chevalier Panthère
  'chevalier-panthere:tete:profile#2', // Chevalier Panthère
  'chevalier-panthere:tete:profile#3', // Chevalier Panthère
  'chevalier-panthere:tete:profile#4', // Chevalier Panthère
  'chevalier-panthere:torse:back#0', // Chevalier Panthère
  'chevalier-panthere:torse:back#1', // Chevalier Panthère
  'chevalier-panthere:torse:front#0', // Chevalier Panthère
  'chevalier-panthere:torse:front#1', // Chevalier Panthère
  'chevalier-panthere:torse:front#2', // Chevalier Panthère
  'chevalier-panthere:torse:profile#0', // Chevalier Panthère
  'chevalier:tete:back#0', // Chevalier
  'chevalier:tete:back#1', // Chevalier
  'chevalier:tete:back#2', // Chevalier
  'chevalier:tete:profile#0', // Chevalier
  'chevalier:tete:profile#1', // Chevalier
  'chevalier:tete:profile#2', // Chevalier
  'chevalier:torse:back#0', // Chevalier
  'chevalier:torse:back#1', // Chevalier
  'chevalier:torse:back#2', // Chevalier
  'chevalier:torse:back#3', // Chevalier
  'chevalier:torse:back#4', // Chevalier
  'chevalier:torse:back#5', // Chevalier
  'chevalier:torse:profile#0', // Chevalier
  'chevalier:torse:profile#1', // Chevalier
  'chevalier:torse:profile#2', // Chevalier
  'chevalier:torse:profile#3', // Chevalier
  'chevalier:torse:profile#4', // Chevalier
  'chevalier:torse:profile#5', // Chevalier
  'cocher:tete:back#0', // Cocher
  'cocher:tete:back#1', // Cocher
  'cocher:tete:back#2', // Cocher
  'cocher:tete:back#3', // Cocher
  'cocher:tete:profile#0', // Cocher
  'cocher:tete:profile#1', // Cocher
  'cocher:tete:profile#2', // Cocher
  'cocher:tete:profile#3', // Cocher
  'cocher:tete:profile#4', // Cocher
  'cocher:torse:back#0', // Cocher
  'cocher:torse:back#1', // Cocher
  'cocher:torse:back#10', // Cocher
  'cocher:torse:back#2', // Cocher
  'cocher:torse:back#3', // Cocher
  'cocher:torse:back#4', // Cocher
  'cocher:torse:back#5', // Cocher
  'cocher:torse:back#6', // Cocher
  'cocher:torse:back#7', // Cocher
  'cocher:torse:back#8', // Cocher
  'cocher:torse:back#9', // Cocher
  'cocher:torse:profile#0', // Cocher
  'cocher:torse:profile#1', // Cocher
  'cocher:torse:profile#2', // Cocher
  'cocher:torse:profile#3', // Cocher
  'cocher:torse:profile#4', // Cocher
  'cocher:torse:profile#5', // Cocher
  'cocher:torse:profile#6', // Cocher
  'cocher:torse:profile#7', // Cocher
  'cocher:torse:profile#8', // Cocher
  'cocher:torse:profile#9', // Cocher
  'colporteur:tete:back#0', // Colporteur
  'colporteur:tete:profile#0', // Colporteur
  'colporteur:tete:profile#1', // Colporteur
  'colporteur:tete:profile#2', // Colporteur
  'colporteur:tete:profile#3', // Colporteur
  'colporteur:torse:back#0', // Colporteur
  'colporteur:torse:back#1', // Colporteur
  'colporteur:torse:back#2', // Colporteur
  'colporteur:torse:back#3', // Colporteur
  'colporteur:torse:back#4', // Colporteur
  'colporteur:torse:profile#0', // Colporteur
  'colporteur:torse:profile#1', // Colporteur
  'colporteur:torse:profile#2', // Colporteur
  'colporteur:torse:profile#3', // Colporteur
  'colporteur:torse:profile#4', // Colporteur
  'conseiller:tete:back#0', // Conseiller
  'conseiller:tete:back#1', // Conseiller
  'conseiller:tete:back#2', // Conseiller
  'conseiller:tete:back#3', // Conseiller
  'conseiller:tete:back#4', // Conseiller
  'conseiller:tete:back#5', // Conseiller
  'conseiller:tete:back#6', // Conseiller
  'conseiller:tete:back#7', // Conseiller
  'conseiller:tete:profile#0', // Conseiller
  'conseiller:tete:profile#1', // Conseiller
  'conseiller:tete:profile#2', // Conseiller
  'conseiller:tete:profile#3', // Conseiller
  'conseiller:tete:profile#4', // Conseiller
  'conseiller:tete:profile#5', // Conseiller
  'conseiller:tete:profile#6', // Conseiller
  'conseiller:torse:back#0', // Conseiller
  'conseiller:torse:back#1', // Conseiller
  'conseiller:torse:back#2', // Conseiller
  'conseiller:torse:back#3', // Conseiller
  'conseiller:torse:back#4', // Conseiller
  'conseiller:torse:profile#0', // Conseiller
  'conseiller:torse:profile#1', // Conseiller
  'conseiller:torse:profile#2', // Conseiller
  'conseiller:torse:profile#3', // Conseiller
  'conseiller:torse:profile#4', // Conseiller
  'conseiller:torse:profile#5', // Conseiller
  'conseiller:torse:profile#6', // Conseiller
  'contrebandier:torse:back#0', // Contrebandier
  'contrebandier:torse:back#1', // Contrebandier
  'contrebandier:torse:back#2', // Contrebandier
  'contrebandier:torse:back#3', // Contrebandier
  'contrebandier:torse:back#4', // Contrebandier
  'contrebandier:torse:back#5', // Contrebandier
  'contrebandier:torse:back#6', // Contrebandier
  'contrebandier:torse:profile#0', // Contrebandier
  'contrebandier:torse:profile#1', // Contrebandier
  'contrebandier:torse:profile#2', // Contrebandier
  'contrebandier:torse:profile#3', // Contrebandier
  'debardeur:torse:back#0', // Débardeur
  'debardeur:torse:back#1', // Débardeur
  'debardeur:torse:back#10', // Débardeur
  'debardeur:torse:back#11', // Débardeur
  'debardeur:torse:back#12', // Débardeur
  'debardeur:torse:back#2', // Débardeur
  'debardeur:torse:back#3', // Débardeur
  'debardeur:torse:back#4', // Débardeur
  'debardeur:torse:back#5', // Débardeur
  'debardeur:torse:back#6', // Débardeur
  'debardeur:torse:back#7', // Débardeur
  'debardeur:torse:back#8', // Débardeur
  'debardeur:torse:back#9', // Débardeur
  'debardeur:torse:profile#0', // Débardeur
  'debardeur:torse:profile#1', // Débardeur
  'debardeur:torse:profile#2', // Débardeur
  'debardeur:torse:profile#3', // Débardeur
  'debardeur:torse:profile#4', // Débardeur
  'debardeur:torse:profile#5', // Débardeur
  'debardeur:torse:profile#6', // Débardeur
  'debardeur:torse:profile#7', // Débardeur
  'debardeur:torse:profile#8', // Débardeur
  'duelliste:torse:back#0', // Duelliste
  'duelliste:torse:back#1', // Duelliste
  'duelliste:torse:back#10', // Duelliste
  'duelliste:torse:back#11', // Duelliste
  'duelliste:torse:back#12', // Duelliste
  'duelliste:torse:back#13', // Duelliste
  'duelliste:torse:back#2', // Duelliste
  'duelliste:torse:back#3', // Duelliste
  'duelliste:torse:back#4', // Duelliste
  'duelliste:torse:back#5', // Duelliste
  'duelliste:torse:back#6', // Duelliste
  'duelliste:torse:back#7', // Duelliste
  'duelliste:torse:back#8', // Duelliste
  'duelliste:torse:back#9', // Duelliste
  'duelliste:torse:profile#0', // Duelliste
  'duelliste:torse:profile#1', // Duelliste
  'duelliste:torse:profile#10', // Duelliste
  'duelliste:torse:profile#2', // Duelliste
  'duelliste:torse:profile#3', // Duelliste
  'duelliste:torse:profile#4', // Duelliste
  'duelliste:torse:profile#5', // Duelliste
  'duelliste:torse:profile#6', // Duelliste
  'duelliste:torse:profile#7', // Duelliste
  'duelliste:torse:profile#8', // Duelliste
  'duelliste:torse:profile#9', // Duelliste
  'eclaireur:torse:back#0', // Éclaireur
  'eclaireur:torse:back#1', // Éclaireur
  'eclaireur:torse:back#2', // Éclaireur
  'eclaireur:torse:back#3', // Éclaireur
  'eclaireur:torse:back#4', // Éclaireur
  'eclaireur:torse:back#5', // Éclaireur
  'eclaireur:torse:back#6', // Éclaireur
  'eclaireur:torse:profile#0', // Éclaireur
  'eclaireur:torse:profile#1', // Éclaireur
  'eclaireur:torse:profile#2', // Éclaireur
  'eclaireur:torse:profile#3', // Éclaireur
  'eclaireur:torse:profile#4', // Éclaireur
  'eclaireur:torse:profile#5', // Éclaireur
  'eclaireur:torse:profile#6', // Éclaireur
  'eclaireur:torse:profile#7', // Éclaireur
  'eclaireur:torse:profile#8', // Éclaireur
  'eclaireur:torse:profile#9', // Éclaireur
  'emissaire:torse:back#0', // Émissaire
  'emissaire:torse:back#1', // Émissaire
  'emissaire:torse:back#10', // Émissaire
  'emissaire:torse:back#11', // Émissaire
  'emissaire:torse:back#12', // Émissaire
  'emissaire:torse:back#13', // Émissaire
  'emissaire:torse:back#2', // Émissaire
  'emissaire:torse:back#3', // Émissaire
  'emissaire:torse:back#4', // Émissaire
  'emissaire:torse:back#5', // Émissaire
  'emissaire:torse:back#6', // Émissaire
  'emissaire:torse:back#7', // Émissaire
  'emissaire:torse:back#8', // Émissaire
  'emissaire:torse:back#9', // Émissaire
  'emissaire:torse:profile#0', // Émissaire
  'emissaire:torse:profile#1', // Émissaire
  'emissaire:torse:profile#10', // Émissaire
  'emissaire:torse:profile#11', // Émissaire
  'emissaire:torse:profile#12', // Émissaire
  'emissaire:torse:profile#13', // Émissaire
  'emissaire:torse:profile#14', // Émissaire
  'emissaire:torse:profile#2', // Émissaire
  'emissaire:torse:profile#3', // Émissaire
  'emissaire:torse:profile#4', // Émissaire
  'emissaire:torse:profile#5', // Émissaire
  'emissaire:torse:profile#6', // Émissaire
  'emissaire:torse:profile#7', // Émissaire
  'emissaire:torse:profile#8', // Émissaire
  'emissaire:torse:profile#9', // Émissaire
  'enqueteur:torse:back#0', // Enquêteur
  'enqueteur:torse:back#1', // Enquêteur
  'enqueteur:torse:back#2', // Enquêteur
  'enqueteur:torse:back#3', // Enquêteur
  'enqueteur:torse:back#4', // Enquêteur
  'enqueteur:torse:back#5', // Enquêteur
  'enqueteur:torse:back#6', // Enquêteur
  'enqueteur:torse:back#7', // Enquêteur
  'enqueteur:torse:back#8', // Enquêteur
  'enqueteur:torse:profile#0', // Enquêteur
  'enqueteur:torse:profile#1', // Enquêteur
  'enqueteur:torse:profile#2', // Enquêteur
  'enqueteur:torse:profile#3', // Enquêteur
  'enqueteur:torse:profile#4', // Enquêteur
  'enqueteur:torse:profile#5', // Enquêteur
  'entremetteur:tete:back#0', // Entremetteur
  'entremetteur:tete:back#1', // Entremetteur
  'entremetteur:tete:back#2', // Entremetteur
  'entremetteur:tete:back#3', // Entremetteur
  'entremetteur:tete:back#4', // Entremetteur
  'entremetteur:tete:back#5', // Entremetteur
  'entremetteur:tete:profile#0', // Entremetteur
  'entremetteur:tete:profile#1', // Entremetteur
  'entremetteur:tete:profile#2', // Entremetteur
  'entremetteur:tete:profile#3', // Entremetteur
  'entremetteur:tete:profile#4', // Entremetteur
  'entremetteur:torse:back#0', // Entremetteur
  'entremetteur:torse:back#1', // Entremetteur
  'entremetteur:torse:back#2', // Entremetteur
  'entremetteur:torse:back#3', // Entremetteur
  'entremetteur:torse:back#4', // Entremetteur
  'entremetteur:torse:back#5', // Entremetteur
  'entremetteur:torse:profile#0', // Entremetteur
  'entremetteur:torse:profile#1', // Entremetteur
  'entremetteur:torse:profile#2', // Entremetteur
  'entremetteur:torse:profile#3', // Entremetteur
  'entremetteur:torse:profile#4', // Entremetteur
  'entremetteur:torse:profile#5', // Entremetteur
  'erudit:torse:back#0', // Érudit
  'erudit:torse:back#1', // Érudit
  'erudit:torse:back#10', // Érudit
  'erudit:torse:back#2', // Érudit
  'erudit:torse:back#3', // Érudit
  'erudit:torse:back#4', // Érudit
  'erudit:torse:back#5', // Érudit
  'erudit:torse:back#6', // Érudit
  'erudit:torse:back#7', // Érudit
  'erudit:torse:back#8', // Érudit
  'erudit:torse:back#9', // Érudit
  'erudit:torse:profile#0', // Érudit
  'erudit:torse:profile#1', // Érudit
  'erudit:torse:profile#2', // Érudit
  'erudit:torse:profile#3', // Érudit
  'erudit:torse:profile#4', // Érudit
  'erudit:torse:profile#5', // Érudit
  'erudit:torse:profile#6', // Érudit
  'erudit:torse:profile#7', // Érudit
  'erudit:torse:profile#8', // Érudit
  'erudit:torse:profile#9', // Érudit
  'espion:tete:profile#0', // Espion
  'espion:torse:back#0', // Espion
  'espion:torse:back#1', // Espion
  'espion:torse:back#2', // Espion
  'espion:torse:back#3', // Espion
  'espion:torse:back#4', // Espion
  'espion:torse:back#5', // Espion
  'espion:torse:back#6', // Espion
  'espion:torse:back#7', // Espion
  'espion:torse:back#8', // Espion
  'espion:torse:profile#0', // Espion
  'espion:torse:profile#1', // Espion
  'espion:torse:profile#2', // Espion
  'espion:torse:profile#3', // Espion
  'espion:torse:profile#4', // Espion
  'espion:torse:profile#5', // Espion
  'espion:torse:profile#6', // Espion
  'espion:torse:profile#7', // Espion
  'femme-du-fleuve:tete:back#0', // Femme du fleuve
  'femme-du-fleuve:tete:back#1', // Femme du fleuve
  'femme-du-fleuve:tete:back#2', // Femme du fleuve
  'femme-du-fleuve:tete:back#3', // Femme du fleuve
  'femme-du-fleuve:tete:back#4', // Femme du fleuve
  'femme-du-fleuve:tete:back#5', // Femme du fleuve
  'femme-du-fleuve:tete:back#6', // Femme du fleuve
  'femme-du-fleuve:tete:profile#0', // Femme du fleuve
  'femme-du-fleuve:tete:profile#1', // Femme du fleuve
  'femme-du-fleuve:tete:profile#2', // Femme du fleuve
  'femme-du-fleuve:tete:profile#3', // Femme du fleuve
  'femme-du-fleuve:tete:profile#4', // Femme du fleuve
  'femme-du-fleuve:tete:profile#5', // Femme du fleuve
  'femme-du-fleuve:tete:profile#6', // Femme du fleuve
  'femme-du-fleuve:tete:profile#7', // Femme du fleuve
  'femme-du-fleuve:tete:profile#8', // Femme du fleuve
  'femme-du-fleuve:torse:back#0', // Femme du fleuve
  'femme-du-fleuve:torse:back#1', // Femme du fleuve
  'femme-du-fleuve:torse:back#2', // Femme du fleuve
  'femme-du-fleuve:torse:back#3', // Femme du fleuve
  'femme-du-fleuve:torse:back#4', // Femme du fleuve
  'femme-du-fleuve:torse:back#5', // Femme du fleuve
  'femme-du-fleuve:torse:back#6', // Femme du fleuve
  'femme-du-fleuve:torse:back#7', // Femme du fleuve
  'femme-du-fleuve:torse:profile#0', // Femme du fleuve
  'femme-du-fleuve:torse:profile#1', // Femme du fleuve
  'femme-du-fleuve:torse:profile#2', // Femme du fleuve
  'femme-du-fleuve:torse:profile#3', // Femme du fleuve
  'femme-du-fleuve:torse:profile#4', // Femme du fleuve
  'femme-du-fleuve:torse:profile#5', // Femme du fleuve
  'femme-du-fleuve:torse:profile#6', // Femme du fleuve
  'femme-du-fleuve:torse:profile#7', // Femme du fleuve
  'femme-du-fleuve:torse:profile#8', // Femme du fleuve
  'femme-du-fleuve:torse:profile#9', // Femme du fleuve
  'garde:bras:back#0', // Garde
  'garde:bras:back#1', // Garde
  'garde:bras:back#2', // Garde
  'garde:bras:back#3', // Garde
  'garde:bras:back#4', // Garde
  'garde:bras:back#5', // Garde
  'garde:bras:front#0', // Garde
  'garde:bras:front#1', // Garde
  'garde:bras:front#2', // Garde
  'garde:bras:front#3', // Garde
  'garde:bras:front#4', // Garde
  'garde:bras:profile#0', // Garde
  'garde:bras:profile#1', // Garde
  'garde:bras:profile#2', // Garde
  'garde:bras:profile#3', // Garde
  'garde:bras:profile#4', // Garde
  'garde:bras:profile#5', // Garde
  'garde:jambes:front#0', // Garde
  'garde:jambes:front#1', // Garde
  'garde:jambes:front#2', // Garde
  'garde:jambes:front#3', // Garde
  'garde:jambes:front#4', // Garde
  'garde:tete:back#0', // Garde
  'garde:tete:front#0', // Garde
  'garde:tete:front#1', // Garde
  'garde:tete:front#2', // Garde
  'garde:tete:profile#0', // Garde
  'garde:torse:back#0', // Garde
  'garde:torse:back#1', // Garde
  'garde:torse:back#2', // Garde
  'garde:torse:back#3', // Garde
  'garde:torse:front#0', // Garde
  'garde:torse:front#1', // Garde
  'garde:torse:front#2', // Garde
  'garde:torse:front#3', // Garde
  'garde:torse:front#4', // Garde
  'garde:torse:front#5', // Garde
  'garde:torse:front#6', // Garde
  'garde:torse:front#7', // Garde
  'garde:torse:profile#0', // Garde
  'garde:torse:profile#1', // Garde
  'garde:torse:profile#2', // Garde
  'garde:torse:profile#3', // Garde
  'garde:torse:profile#4', // Garde
  'gladiateur:tete:back#0', // Gladiateur
  'gladiateur:tete:back#1', // Gladiateur
  'gladiateur:tete:back#10', // Gladiateur
  'gladiateur:tete:back#11', // Gladiateur
  'gladiateur:tete:back#12', // Gladiateur
  'gladiateur:tete:back#2', // Gladiateur
  'gladiateur:tete:back#3', // Gladiateur
  'gladiateur:tete:back#4', // Gladiateur
  'gladiateur:tete:back#5', // Gladiateur
  'gladiateur:tete:back#6', // Gladiateur
  'gladiateur:tete:back#7', // Gladiateur
  'gladiateur:tete:back#8', // Gladiateur
  'gladiateur:tete:back#9', // Gladiateur
  'gladiateur:tete:profile#0', // Gladiateur
  'gladiateur:tete:profile#1', // Gladiateur
  'gladiateur:tete:profile#10', // Gladiateur
  'gladiateur:tete:profile#11', // Gladiateur
  'gladiateur:tete:profile#2', // Gladiateur
  'gladiateur:tete:profile#3', // Gladiateur
  'gladiateur:tete:profile#4', // Gladiateur
  'gladiateur:tete:profile#5', // Gladiateur
  'gladiateur:tete:profile#6', // Gladiateur
  'gladiateur:tete:profile#7', // Gladiateur
  'gladiateur:tete:profile#8', // Gladiateur
  'gladiateur:tete:profile#9', // Gladiateur
  'gladiateur:torse:back#0', // Gladiateur
  'gladiateur:torse:back#1', // Gladiateur
  'gladiateur:torse:back#10', // Gladiateur
  'gladiateur:torse:back#11', // Gladiateur
  'gladiateur:torse:back#12', // Gladiateur
  'gladiateur:torse:back#13', // Gladiateur
  'gladiateur:torse:back#14', // Gladiateur
  'gladiateur:torse:back#15', // Gladiateur
  'gladiateur:torse:back#16', // Gladiateur
  'gladiateur:torse:back#17', // Gladiateur
  'gladiateur:torse:back#2', // Gladiateur
  'gladiateur:torse:back#3', // Gladiateur
  'gladiateur:torse:back#4', // Gladiateur
  'gladiateur:torse:back#5', // Gladiateur
  'gladiateur:torse:back#6', // Gladiateur
  'gladiateur:torse:back#7', // Gladiateur
  'gladiateur:torse:back#8', // Gladiateur
  'gladiateur:torse:back#9', // Gladiateur
  'gladiateur:torse:profile#0', // Gladiateur
  'gladiateur:torse:profile#1', // Gladiateur
  'gladiateur:torse:profile#10', // Gladiateur
  'gladiateur:torse:profile#11', // Gladiateur
  'gladiateur:torse:profile#12', // Gladiateur
  'gladiateur:torse:profile#2', // Gladiateur
  'gladiateur:torse:profile#3', // Gladiateur
  'gladiateur:torse:profile#4', // Gladiateur
  'gladiateur:torse:profile#5', // Gladiateur
  'gladiateur:torse:profile#6', // Gladiateur
  'gladiateur:torse:profile#7', // Gladiateur
  'gladiateur:torse:profile#8', // Gladiateur
  'gladiateur:torse:profile#9', // Gladiateur
  'herboriste:tete:back#0', // Herboriste
  'herboriste:tete:back#1', // Herboriste
  'herboriste:tete:back#2', // Herboriste
  'herboriste:tete:back#3', // Herboriste
  'herboriste:tete:back#4', // Herboriste
  'herboriste:tete:profile#0', // Herboriste
  'herboriste:tete:profile#1', // Herboriste
  'herboriste:tete:profile#2', // Herboriste
  'herboriste:tete:profile#3', // Herboriste
  'herboriste:tete:profile#4', // Herboriste
  'herboriste:torse:back#0', // Herboriste
  'herboriste:torse:back#1', // Herboriste
  'herboriste:torse:profile#0', // Herboriste
  'herboriste:torse:profile#1', // Herboriste
  'herboriste:torse:profile#2', // Herboriste
  'herboriste:torse:profile#3', // Herboriste
  'herboriste:torse:profile#4', // Herboriste
  'herboriste:torse:profile#5', // Herboriste
  'herboriste:torse:profile#6', // Herboriste
  'herboriste:torse:profile#7', // Herboriste
  'herboriste:torse:profile#8', // Herboriste
  'herboriste:torse:profile#9', // Herboriste
  'hors-la-loi:tete:back#0', // Hors-la-loi
  'hors-la-loi:tete:back#1', // Hors-la-loi
  'hors-la-loi:tete:back#2', // Hors-la-loi
  'hors-la-loi:tete:back#3', // Hors-la-loi
  'hors-la-loi:tete:profile#0', // Hors-la-loi
  'hors-la-loi:tete:profile#1', // Hors-la-loi
  'hors-la-loi:tete:profile#2', // Hors-la-loi
  'hors-la-loi:tete:profile#3', // Hors-la-loi
  'hors-la-loi:torse:back#0', // Hors-la-loi
  'hors-la-loi:torse:back#1', // Hors-la-loi
  'hors-la-loi:torse:back#10', // Hors-la-loi
  'hors-la-loi:torse:back#11', // Hors-la-loi
  'hors-la-loi:torse:back#2', // Hors-la-loi
  'hors-la-loi:torse:back#3', // Hors-la-loi
  'hors-la-loi:torse:back#4', // Hors-la-loi
  'hors-la-loi:torse:back#5', // Hors-la-loi
  'hors-la-loi:torse:back#6', // Hors-la-loi
  'hors-la-loi:torse:back#7', // Hors-la-loi
  'hors-la-loi:torse:back#8', // Hors-la-loi
  'hors-la-loi:torse:back#9', // Hors-la-loi
  'hors-la-loi:torse:profile#0', // Hors-la-loi
  'hors-la-loi:torse:profile#1', // Hors-la-loi
  'hors-la-loi:torse:profile#2', // Hors-la-loi
  'hors-la-loi:torse:profile#3', // Hors-la-loi
  'hors-la-loi:torse:profile#4', // Hors-la-loi
  'hors-la-loi:torse:profile#5', // Hors-la-loi
  'hors-la-loi:torse:profile#6', // Hors-la-loi
  'hors-la-loi:torse:profile#7', // Hors-la-loi
  'hors-la-loi:torse:profile#8', // Hors-la-loi
  'ingenieur:tete:back#0', // Ingénieur
  'ingenieur:tete:back#1', // Ingénieur
  'ingenieur:tete:back#2', // Ingénieur
  'ingenieur:tete:back#3', // Ingénieur
  'ingenieur:tete:back#4', // Ingénieur
  'ingenieur:tete:back#5', // Ingénieur
  'ingenieur:tete:back#6', // Ingénieur
  'ingenieur:tete:back#7', // Ingénieur
  'ingenieur:tete:back#8', // Ingénieur
  'ingenieur:tete:profile#0', // Ingénieur
  'ingenieur:tete:profile#1', // Ingénieur
  'ingenieur:tete:profile#10', // Ingénieur
  'ingenieur:tete:profile#11', // Ingénieur
  'ingenieur:tete:profile#2', // Ingénieur
  'ingenieur:tete:profile#3', // Ingénieur
  'ingenieur:tete:profile#4', // Ingénieur
  'ingenieur:tete:profile#5', // Ingénieur
  'ingenieur:tete:profile#6', // Ingénieur
  'ingenieur:tete:profile#7', // Ingénieur
  'ingenieur:tete:profile#8', // Ingénieur
  'ingenieur:tete:profile#9', // Ingénieur
  'ingenieur:torse:back#0', // Ingénieur
  'ingenieur:torse:back#1', // Ingénieur
  'ingenieur:torse:back#2', // Ingénieur
  'ingenieur:torse:back#3', // Ingénieur
  'ingenieur:torse:back#4', // Ingénieur
  'ingenieur:torse:back#5', // Ingénieur
  'ingenieur:torse:back#6', // Ingénieur
  'ingenieur:torse:back#7', // Ingénieur
  'ingenieur:torse:back#8', // Ingénieur
  'ingenieur:torse:profile#0', // Ingénieur
  'ingenieur:torse:profile#1', // Ingénieur
  'ingenieur:torse:profile#10', // Ingénieur
  'ingenieur:torse:profile#11', // Ingénieur
  'ingenieur:torse:profile#2', // Ingénieur
  'ingenieur:torse:profile#3', // Ingénieur
  'ingenieur:torse:profile#4', // Ingénieur
  'ingenieur:torse:profile#5', // Ingénieur
  'ingenieur:torse:profile#6', // Ingénieur
  'ingenieur:torse:profile#7', // Ingénieur
  'ingenieur:torse:profile#8', // Ingénieur
  'ingenieur:torse:profile#9', // Ingénieur
  'intendant:torse:back#0', // Intendant
  'intendant:torse:back#1', // Intendant
  'intendant:torse:back#2', // Intendant
  'intendant:torse:back#3', // Intendant
  'intendant:torse:back#4', // Intendant
  'intendant:torse:back#5', // Intendant
  'intendant:torse:back#6', // Intendant
  'intendant:torse:back#7', // Intendant
  'intendant:torse:back#8', // Intendant
  'intendant:torse:profile#0', // Intendant
  'intendant:torse:profile#1', // Intendant
  'intendant:torse:profile#2', // Intendant
  'intendant:torse:profile#3', // Intendant
  'intendant:torse:profile#4', // Intendant
  'intendant:torse:profile#5', // Intendant
  'intendant:torse:profile#6', // Intendant
  'joueur-d-epee:torse:back#0', // Joueur d'épée
  'joueur-d-epee:torse:back#1', // Joueur d'épée
  'joueur-d-epee:torse:front#0', // Joueur d'épée
  'joueur-d-epee:torse:front#1', // Joueur d'épée
  'joueur-d-epee:torse:profile#0', // Joueur d'épée
  'juriste:torse:back#0', // Juriste
  'juriste:torse:back#1', // Juriste
  'juriste:torse:back#2', // Juriste
  'juriste:torse:back#3', // Juriste
  'juriste:torse:back#4', // Juriste
  'juriste:torse:profile#0', // Juriste
  'juriste:torse:profile#1', // Juriste
  'juriste:torse:profile#2', // Juriste
  'juriste:torse:profile#3', // Juriste
  'juriste:torse:profile#4', // Juriste
  'juriste:torse:profile#5', // Juriste
  'juriste:torse:profile#6', // Juriste
  'marchand:bras:back#0', // Marchand
  'marchand:bras:back#1', // Marchand
  'marchand:bras:back#2', // Marchand
  'marchand:bras:back#3', // Marchand
  'marchand:bras:back#4', // Marchand
  'marchand:bras:back#5', // Marchand
  'marchand:bras:profile#0', // Marchand
  'marchand:bras:profile#1', // Marchand
  'marchand:bras:profile#2', // Marchand
  'marchand:bras:profile#3', // Marchand
  'marchand:tete:profile#0', // Marchand
  'marchand:tete:profile#1', // Marchand
  'marchand:torse:back#0', // Marchand
  'marchand:torse:back#1', // Marchand
  'marchand:torse:back#2', // Marchand
  'marchand:torse:back#3', // Marchand
  'marchand:torse:back#4', // Marchand
  'marchand:torse:back#5', // Marchand
  'marchand:torse:profile#0', // Marchand
  'marchand:torse:profile#1', // Marchand
  'marchand:torse:profile#2', // Marchand
  'marchand:torse:profile#3', // Marchand
  'marin:torse:back#0', // Marin
  'marin:torse:back#1', // Marin
  'marin:torse:back#2', // Marin
  'marin:torse:back#3', // Marin
  'marin:torse:back#4', // Marin
  'marin:torse:back#5', // Marin
  'marin:torse:back#6', // Marin
  'marin:torse:profile#0', // Marin
  'marin:torse:profile#1', // Marin
  'marin:torse:profile#2', // Marin
  'marin:torse:profile#3', // Marin
  'marin:torse:profile#4', // Marin
  'medecin:tete:back#0', // Médecin
  'medecin:tete:back#1', // Médecin
  'medecin:tete:profile#0', // Médecin
  'medecin:torse:back#0', // Médecin
  'medecin:torse:back#1', // Médecin
  'medecin:torse:back#2', // Médecin
  'medecin:torse:back#3', // Médecin
  'medecin:torse:profile#0', // Médecin
  'medecin:torse:profile#1', // Médecin
  'medecin:torse:profile#2', // Médecin
  'medecin:torse:profile#3', // Médecin
  'medecin:torse:profile#4', // Médecin
  'medecin:torse:profile#5', // Médecin
  'medecin:torse:profile#6', // Médecin
  'medecin:torse:profile#7', // Médecin
  'medecin:torse:profile#8', // Médecin
  'medecin:torse:profile#9', // Médecin
  'messager:bras:back#0', // Messager
  'messager:bras:back#1', // Messager
  'messager:bras:back#2', // Messager
  'messager:bras:back#3', // Messager
  'messager:bras:back#4', // Messager
  'messager:bras:back#5', // Messager
  'messager:bras:back#6', // Messager
  'messager:bras:back#7', // Messager
  'messager:bras:profile#0', // Messager
  'messager:bras:profile#1', // Messager
  'messager:bras:profile#2', // Messager
  'messager:bras:profile#3', // Messager
  'messager:bras:profile#4', // Messager
  'messager:bras:profile#5', // Messager
  'messager:torse:back#0', // Messager
  'messager:torse:back#1', // Messager
  'messager:torse:back#2', // Messager
  'messager:torse:back#3', // Messager
  'messager:torse:back#4', // Messager
  'messager:torse:back#5', // Messager
  'messager:torse:back#6', // Messager
  'messager:torse:back#7', // Messager
  'messager:torse:profile#0', // Messager
  'messager:torse:profile#1', // Messager
  'messager:torse:profile#2', // Messager
  'messager:torse:profile#3', // Messager
  'messager:torse:profile#4', // Messager
  'messager:torse:profile#5', // Messager
  'messager:torse:profile#6', // Messager
  'milicien:bras:back#0', // Milicien
  'milicien:bras:back#1', // Milicien
  'milicien:bras:back#2', // Milicien
  'milicien:bras:back#3', // Milicien
  'milicien:bras:back#4', // Milicien
  'milicien:bras:back#5', // Milicien
  'milicien:bras:back#6', // Milicien
  'milicien:bras:back#7', // Milicien
  'milicien:bras:back#8', // Milicien
  'milicien:bras:back#9', // Milicien
  'milicien:bras:profile#0', // Milicien
  'milicien:bras:profile#1', // Milicien
  'milicien:bras:profile#2', // Milicien
  'milicien:bras:profile#3', // Milicien
  'milicien:bras:profile#4', // Milicien
  'milicien:bras:profile#5', // Milicien
  'milicien:bras:profile#6', // Milicien
  'milicien:bras:profile#7', // Milicien
  'milicien:bras:profile#8', // Milicien
  'milicien:bras:profile#9', // Milicien
  'milicien:tete:back#0', // Milicien
  'milicien:tete:profile#0', // Milicien
  'milicien:tete:profile#1', // Milicien
  'milicien:torse:back#0', // Milicien
  'milicien:torse:back#1', // Milicien
  'milicien:torse:back#2', // Milicien
  'milicien:torse:back#3', // Milicien
  'milicien:torse:back#4', // Milicien
  'milicien:torse:back#5', // Milicien
  'milicien:torse:back#6', // Milicien
  'milicien:torse:back#7', // Milicien
  'milicien:torse:profile#0', // Milicien
  'milicien:torse:profile#1', // Milicien
  'milicien:torse:profile#2', // Milicien
  'milicien:torse:profile#3', // Milicien
  'milicien:torse:profile#4', // Milicien
  'milicien:torse:profile#5', // Milicien
  'milicien:torse:profile#6', // Milicien
  'milicien:torse:profile#7', // Milicien
  'milicien:torse:profile#8', // Milicien
  'mineur:tete:back#0', // Mineur
  'mineur:tete:back#1', // Mineur
  'mineur:tete:back#2', // Mineur
  'mineur:tete:back#3', // Mineur
  'mineur:tete:back#4', // Mineur
  'mineur:tete:back#5', // Mineur
  'mineur:tete:profile#0', // Mineur
  'mineur:tete:profile#1', // Mineur
  'mineur:tete:profile#2', // Mineur
  'mineur:tete:profile#3', // Mineur
  'mineur:tete:profile#4', // Mineur
  'mineur:tete:profile#5', // Mineur
  'mineur:torse:back#0', // Mineur
  'mineur:torse:back#1', // Mineur
  'mineur:torse:back#10', // Mineur
  'mineur:torse:back#2', // Mineur
  'mineur:torse:back#3', // Mineur
  'mineur:torse:back#4', // Mineur
  'mineur:torse:back#5', // Mineur
  'mineur:torse:back#6', // Mineur
  'mineur:torse:back#7', // Mineur
  'mineur:torse:back#8', // Mineur
  'mineur:torse:back#9', // Mineur
  'mineur:torse:profile#0', // Mineur
  'mineur:torse:profile#1', // Mineur
  'mineur:torse:profile#2', // Mineur
  'mineur:torse:profile#3', // Mineur
  'mineur:torse:profile#4', // Mineur
  'mineur:torse:profile#5', // Mineur
  'mineur:torse:profile#6', // Mineur
  'mineur:torse:profile#7', // Mineur
  'mineur:torse:profile#8', // Mineur
  'mineur:torse:profile#9', // Mineur
  'mystique:tete:back#0', // Mystique
  'mystique:tete:back#1', // Mystique
  'mystique:tete:back#2', // Mystique
  'mystique:tete:back#3', // Mystique
  'mystique:tete:profile#0', // Mystique
  'mystique:tete:profile#1', // Mystique
  'mystique:torse:back#0', // Mystique
  'mystique:torse:back#1', // Mystique
  'mystique:torse:back#10', // Mystique
  'mystique:torse:back#11', // Mystique
  'mystique:torse:back#12', // Mystique
  'mystique:torse:back#13', // Mystique
  'mystique:torse:back#2', // Mystique
  'mystique:torse:back#3', // Mystique
  'mystique:torse:back#4', // Mystique
  'mystique:torse:back#5', // Mystique
  'mystique:torse:back#6', // Mystique
  'mystique:torse:back#7', // Mystique
  'mystique:torse:back#8', // Mystique
  'mystique:torse:back#9', // Mystique
  'mystique:torse:profile#0', // Mystique
  'mystique:torse:profile#1', // Mystique
  'mystique:torse:profile#2', // Mystique
  'mystique:torse:profile#3', // Mystique
  'mystique:torse:profile#4', // Mystique
  'mystique:torse:profile#5', // Mystique
  'mystique:torse:profile#6', // Mystique
  'mystique:torse:profile#7', // Mystique
  'naufrageur:bras:back#0', // Naufrageur
  'naufrageur:bras:profile#0', // Naufrageur
  'naufrageur:bras:profile#1', // Naufrageur
  'naufrageur:bras:profile#2', // Naufrageur
  'naufrageur:bras:profile#3', // Naufrageur
  'naufrageur:bras:profile#4', // Naufrageur
  'naufrageur:bras:profile#5', // Naufrageur
  'naufrageur:bras:profile#6', // Naufrageur
  'naufrageur:torse:back#0', // Naufrageur
  'naufrageur:torse:back#1', // Naufrageur
  'naufrageur:torse:back#2', // Naufrageur
  'naufrageur:torse:back#3', // Naufrageur
  'naufrageur:torse:profile#0', // Naufrageur
  'naufrageur:torse:profile#1', // Naufrageur
  'naufrageur:torse:profile#2', // Naufrageur
  'naufrageur:torse:profile#3', // Naufrageur
  'naufrageur:torse:profile#4', // Naufrageur
  'naufrageur:torse:profile#5', // Naufrageur
  'naufrageur:torse:profile#6', // Naufrageur
  'nautonier:bras:back#0', // Nautonier
  'nautonier:bras:back#1', // Nautonier
  'nautonier:bras:back#2', // Nautonier
  'nautonier:bras:back#3', // Nautonier
  'nautonier:bras:back#4', // Nautonier
  'nautonier:bras:back#5', // Nautonier
  'nautonier:bras:back#6', // Nautonier
  'nautonier:bras:back#7', // Nautonier
  'nautonier:bras:profile#0', // Nautonier
  'nautonier:bras:profile#1', // Nautonier
  'nautonier:bras:profile#2', // Nautonier
  'nautonier:bras:profile#3', // Nautonier
  'nautonier:bras:profile#4', // Nautonier
  'nautonier:bras:profile#5', // Nautonier
  'nautonier:bras:profile#6', // Nautonier
  'nautonier:tete:back#0', // Nautonier
  'nautonier:tete:back#1', // Nautonier
  'nautonier:tete:back#2', // Nautonier
  'nautonier:tete:profile#0', // Nautonier
  'nautonier:tete:profile#1', // Nautonier
  'nautonier:tete:profile#2', // Nautonier
  'nautonier:tete:profile#3', // Nautonier
  'nautonier:torse:back#0', // Nautonier
  'nautonier:torse:back#1', // Nautonier
  'nautonier:torse:back#2', // Nautonier
  'nautonier:torse:back#3', // Nautonier
  'nautonier:torse:back#4', // Nautonier
  'nautonier:torse:profile#0', // Nautonier
  'nautonier:torse:profile#1', // Nautonier
  'nautonier:torse:profile#2', // Nautonier
  'nautonier:torse:profile#3', // Nautonier
  'patrouilleur-fluvial:tete:back#0', // Patrouilleur fluvial
  'patrouilleur-fluvial:tete:back#1', // Patrouilleur fluvial
  'patrouilleur-fluvial:tete:profile#0', // Patrouilleur fluvial
  'patrouilleur-fluvial:tete:profile#1', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:back#0', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:back#1', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:back#2', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:back#3', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:back#4', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#0', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#1', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#2', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#3', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#4', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#5', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#6', // Patrouilleur fluvial
  'patrouilleur-fluvial:torse:profile#7', // Patrouilleur fluvial
  'patrouilleur-routier:tete:back#0', // Patrouilleur routier
  'patrouilleur-routier:tete:back#1', // Patrouilleur routier
  'patrouilleur-routier:tete:profile#0', // Patrouilleur routier
  'patrouilleur-routier:tete:profile#1', // Patrouilleur routier
  'patrouilleur-routier:tete:profile#2', // Patrouilleur routier
  'patrouilleur-routier:tete:profile#3', // Patrouilleur routier
  'patrouilleur-routier:tete:profile#4', // Patrouilleur routier
  'patrouilleur-routier:torse:back#0', // Patrouilleur routier
  'patrouilleur-routier:torse:back#1', // Patrouilleur routier
  'patrouilleur-routier:torse:back#2', // Patrouilleur routier
  'patrouilleur-routier:torse:back#3', // Patrouilleur routier
  'patrouilleur-routier:torse:back#4', // Patrouilleur routier
  'patrouilleur-routier:torse:back#5', // Patrouilleur routier
  'patrouilleur-routier:torse:back#6', // Patrouilleur routier
  'patrouilleur-routier:torse:back#7', // Patrouilleur routier
  'patrouilleur-routier:torse:back#8', // Patrouilleur routier
  'patrouilleur-routier:torse:back#9', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#0', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#1', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#10', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#11', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#12', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#2', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#3', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#4', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#5', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#6', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#7', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#8', // Patrouilleur routier
  'patrouilleur-routier:torse:profile#9', // Patrouilleur routier
  'pilleur-de-tombes:tete:back#0', // Pilleur de tombes
  'pilleur-de-tombes:tete:back#1', // Pilleur de tombes
  'pilleur-de-tombes:tete:back#2', // Pilleur de tombes
  'pilleur-de-tombes:tete:back#3', // Pilleur de tombes
  'pilleur-de-tombes:tete:profile#0', // Pilleur de tombes
  'pilleur-de-tombes:tete:profile#1', // Pilleur de tombes
  'pilleur-de-tombes:tete:profile#2', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#0', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#1', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#2', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#3', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#4', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#5', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#6', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#7', // Pilleur de tombes
  'pilleur-de-tombes:torse:back#8', // Pilleur de tombes
  'pilleur-de-tombes:torse:profile#0', // Pilleur de tombes
  'pilleur-de-tombes:torse:profile#1', // Pilleur de tombes
  'pilleur-de-tombes:torse:profile#2', // Pilleur de tombes
  'pilleur-de-tombes:torse:profile#3', // Pilleur de tombes
  'pilleur-de-tombes:torse:profile#4', // Pilleur de tombes
  'pilleur-de-tombes:torse:profile#5', // Pilleur de tombes
  'pretre-guerrier:torse:back#0', // Prêtre guerrier
  'pretre-guerrier:torse:back#1', // Prêtre guerrier
  'pretre-guerrier:torse:back#2', // Prêtre guerrier
  'pretre-guerrier:torse:back#3', // Prêtre guerrier
  'pretre-guerrier:torse:back#4', // Prêtre guerrier
  'pretre-guerrier:torse:back#5', // Prêtre guerrier
  'pretre-guerrier:torse:back#6', // Prêtre guerrier
  'pretre-guerrier:torse:back#7', // Prêtre guerrier
  'pretre-guerrier:torse:profile#0', // Prêtre guerrier
  'pretre-guerrier:torse:profile#1', // Prêtre guerrier
  'pretre-guerrier:torse:profile#10', // Prêtre guerrier
  'pretre-guerrier:torse:profile#2', // Prêtre guerrier
  'pretre-guerrier:torse:profile#3', // Prêtre guerrier
  'pretre-guerrier:torse:profile#4', // Prêtre guerrier
  'pretre-guerrier:torse:profile#5', // Prêtre guerrier
  'pretre-guerrier:torse:profile#6', // Prêtre guerrier
  'pretre-guerrier:torse:profile#7', // Prêtre guerrier
  'pretre-guerrier:torse:profile#8', // Prêtre guerrier
  'pretre-guerrier:torse:profile#9', // Prêtre guerrier
  'pretre:torse:back#0', // Prêtre
  'pretre:torse:back#1', // Prêtre
  'pretre:torse:back#2', // Prêtre
  'pretre:torse:back#3', // Prêtre
  'pretre:torse:profile#0', // Prêtre
  'pretre:torse:profile#1', // Prêtre
  'pretre:torse:profile#2', // Prêtre
  'pretre:torse:profile#3', // Prêtre
  'pretre:torse:profile#4', // Prêtre
  'pretre:torse:profile#5', // Prêtre
  'ranconneur:torse:back#0', // Rançonneur
  'ranconneur:torse:back#1', // Rançonneur
  'ranconneur:torse:back#10', // Rançonneur
  'ranconneur:torse:back#2', // Rançonneur
  'ranconneur:torse:back#3', // Rançonneur
  'ranconneur:torse:back#4', // Rançonneur
  'ranconneur:torse:back#5', // Rançonneur
  'ranconneur:torse:back#6', // Rançonneur
  'ranconneur:torse:back#7', // Rançonneur
  'ranconneur:torse:back#8', // Rançonneur
  'ranconneur:torse:back#9', // Rançonneur
  'ranconneur:torse:profile#0', // Rançonneur
  'ranconneur:torse:profile#1', // Rançonneur
  'ranconneur:torse:profile#10', // Rançonneur
  'ranconneur:torse:profile#11', // Rançonneur
  'ranconneur:torse:profile#12', // Rançonneur
  'ranconneur:torse:profile#13', // Rançonneur
  'ranconneur:torse:profile#14', // Rançonneur
  'ranconneur:torse:profile#2', // Rançonneur
  'ranconneur:torse:profile#3', // Rançonneur
  'ranconneur:torse:profile#4', // Rançonneur
  'ranconneur:torse:profile#5', // Rançonneur
  'ranconneur:torse:profile#6', // Rançonneur
  'ranconneur:torse:profile#7', // Rançonneur
  'ranconneur:torse:profile#8', // Rançonneur
  'ranconneur:torse:profile#9', // Rançonneur
  'ratier:tete:back#0', // Ratier
  'ratier:tete:back#1', // Ratier
  'ratier:tete:back#2', // Ratier
  'ratier:tete:back#3', // Ratier
  'ratier:tete:profile#0', // Ratier
  'ratier:tete:profile#1', // Ratier
  'ratier:tete:profile#2', // Ratier
  'ratier:tete:profile#3', // Ratier
  'ratier:torse:back#0', // Ratier
  'ratier:torse:back#1', // Ratier
  'ratier:torse:back#10', // Ratier
  'ratier:torse:back#2', // Ratier
  'ratier:torse:back#3', // Ratier
  'ratier:torse:back#4', // Ratier
  'ratier:torse:back#5', // Ratier
  'ratier:torse:back#6', // Ratier
  'ratier:torse:back#7', // Ratier
  'ratier:torse:back#8', // Ratier
  'ratier:torse:back#9', // Ratier
  'ratier:torse:profile#0', // Ratier
  'ratier:torse:profile#1', // Ratier
  'ratier:torse:profile#2', // Ratier
  'ratier:torse:profile#3', // Ratier
  'ratier:torse:profile#4', // Ratier
  'ratier:torse:profile#5', // Ratier
  'ratier:torse:profile#6', // Ratier
  'ratier:torse:profile#7', // Ratier
  'receleur:torse:back#0', // Receleur
  'receleur:torse:back#1', // Receleur
  'receleur:torse:back#2', // Receleur
  'receleur:torse:back#3', // Receleur
  'receleur:torse:back#4', // Receleur
  'receleur:torse:profile#0', // Receleur
  'receleur:torse:profile#1', // Receleur
  'receleur:torse:profile#10', // Receleur
  'receleur:torse:profile#11', // Receleur
  'receleur:torse:profile#12', // Receleur
  'receleur:torse:profile#2', // Receleur
  'receleur:torse:profile#3', // Receleur
  'receleur:torse:profile#4', // Receleur
  'receleur:torse:profile#5', // Receleur
  'receleur:torse:profile#6', // Receleur
  'receleur:torse:profile#7', // Receleur
  'receleur:torse:profile#8', // Receleur
  'receleur:torse:profile#9', // Receleur
  'repurgateur:torse:back#0', // Répurgateur
  'repurgateur:torse:back#1', // Répurgateur
  'repurgateur:torse:back#2', // Répurgateur
  'repurgateur:torse:back#3', // Répurgateur
  'repurgateur:torse:back#4', // Répurgateur
  'repurgateur:torse:back#5', // Répurgateur
  'repurgateur:torse:back#6', // Répurgateur
  'repurgateur:torse:back#7', // Répurgateur
  'repurgateur:torse:profile#0', // Répurgateur
  'repurgateur:torse:profile#1', // Répurgateur
  'repurgateur:torse:profile#2', // Répurgateur
  'repurgateur:torse:profile#3', // Répurgateur
  'repurgateur:torse:profile#4', // Répurgateur
  'repurgateur:torse:profile#5', // Répurgateur
  'repurgateur:torse:profile#6', // Répurgateur
  'saltimbanque:torse:back#0', // Saltimbanque
  'saltimbanque:torse:back#1', // Saltimbanque
  'saltimbanque:torse:back#10', // Saltimbanque
  'saltimbanque:torse:back#11', // Saltimbanque
  'saltimbanque:torse:back#2', // Saltimbanque
  'saltimbanque:torse:back#3', // Saltimbanque
  'saltimbanque:torse:back#4', // Saltimbanque
  'saltimbanque:torse:back#5', // Saltimbanque
  'saltimbanque:torse:back#6', // Saltimbanque
  'saltimbanque:torse:back#7', // Saltimbanque
  'saltimbanque:torse:back#8', // Saltimbanque
  'saltimbanque:torse:back#9', // Saltimbanque
  'saltimbanque:torse:profile#0', // Saltimbanque
  'saltimbanque:torse:profile#1', // Saltimbanque
  'saltimbanque:torse:profile#10', // Saltimbanque
  'saltimbanque:torse:profile#2', // Saltimbanque
  'saltimbanque:torse:profile#3', // Saltimbanque
  'saltimbanque:torse:profile#4', // Saltimbanque
  'saltimbanque:torse:profile#5', // Saltimbanque
  'saltimbanque:torse:profile#6', // Saltimbanque
  'saltimbanque:torse:profile#7', // Saltimbanque
  'saltimbanque:torse:profile#8', // Saltimbanque
  'saltimbanque:torse:profile#9', // Saltimbanque
  'serviteur:tete:back#0', // Serviteur
  'serviteur:tete:back#1', // Serviteur
  'serviteur:tete:back#2', // Serviteur
  'serviteur:tete:profile#0', // Serviteur
  'serviteur:tete:profile#1', // Serviteur
  'serviteur:tete:profile#2', // Serviteur
  'serviteur:torse:back#0', // Serviteur
  'serviteur:torse:back#1', // Serviteur
  'serviteur:torse:back#2', // Serviteur
  'serviteur:torse:back#3', // Serviteur
  'serviteur:torse:back#4', // Serviteur
  'serviteur:torse:profile#0', // Serviteur
  'serviteur:torse:profile#1', // Serviteur
  'serviteur:torse:profile#2', // Serviteur
  'serviteur:torse:profile#3', // Serviteur
  'serviteur:torse:profile#4', // Serviteur
  'soldat:bras:front#0', // Soldat
  'soldat:bras:profile#0', // Soldat
  'soldat:jambes:front#0', // Soldat
  'soldat:jambes:profile#0', // Soldat
  'soldat:torse:back#0', // Soldat
  'soldat:torse:front#0', // Soldat
  'soldat:torse:front#1', // Soldat
  'soldat:torse:front#2', // Soldat
  'soldat:torse:front#3', // Soldat
  'soldat:torse:profile#0', // Soldat
  'soldat:torse:profile#1', // Soldat
  'soldat:torse:profile#2', // Soldat
  'sorcier-de-village:tete:back#0', // Sorcier de village
  'sorcier-de-village:tete:back#1', // Sorcier de village
  'sorcier-de-village:tete:back#2', // Sorcier de village
  'sorcier-de-village:tete:profile#0', // Sorcier de village
  'sorcier-de-village:tete:profile#1', // Sorcier de village
  'sorcier-de-village:torse:back#0', // Sorcier de village
  'sorcier-de-village:torse:back#1', // Sorcier de village
  'sorcier-de-village:torse:back#2', // Sorcier de village
  'sorcier-de-village:torse:back#3', // Sorcier de village
  'sorcier-de-village:torse:back#4', // Sorcier de village
  'sorcier-de-village:torse:back#5', // Sorcier de village
  'sorcier-de-village:torse:back#6', // Sorcier de village
  'sorcier-de-village:torse:profile#0', // Sorcier de village
  'sorcier-de-village:torse:profile#1', // Sorcier de village
  'sorcier-de-village:torse:profile#2', // Sorcier de village
  'sorcier-de-village:torse:profile#3', // Sorcier de village
  'sorcier-de-village:torse:profile#4', // Sorcier de village
  'sorcier-de-village:torse:profile#5', // Sorcier de village
  'sorcier-dissident:tete:profile#0', // Sorcier dissident
  'sorcier-dissident:tete:profile#1', // Sorcier dissident
  'sorcier-dissident:tete:profile#2', // Sorcier dissident
  'sorcier-dissident:tete:profile#3', // Sorcier dissident
  'sorcier-dissident:torse:back#0', // Sorcier dissident
  'sorcier-dissident:torse:back#1', // Sorcier dissident
  'sorcier-dissident:torse:profile#0', // Sorcier dissident
  'sorcier-dissident:torse:profile#1', // Sorcier dissident
  'spadassin:torse:back#0', // Spadassin
  'spadassin:torse:back#1', // Spadassin
  'spadassin:torse:back#2', // Spadassin
  'spadassin:torse:back#3', // Spadassin
  'spadassin:torse:back#4', // Spadassin
  'spadassin:torse:back#5', // Spadassin
  'spadassin:torse:back#6', // Spadassin
  'spadassin:torse:back#7', // Spadassin
  'spadassin:torse:profile#0', // Spadassin
  'spadassin:torse:profile#1', // Spadassin
  'spadassin:torse:profile#2', // Spadassin
  'spadassin:torse:profile#3', // Spadassin
  'spadassin:torse:profile#4', // Spadassin
  'spadassin:torse:profile#5', // Spadassin
  'spadassin:torse:profile#6', // Spadassin
  'spadassin:torse:profile#7', // Spadassin
  'spadassin:torse:profile#8', // Spadassin
  'spadassin:torse:profile#9', // Spadassin
  'tueur:torse:back#0', // Tueur
  'tueur:torse:back#1', // Tueur
  'tueur:torse:back#10', // Tueur
  'tueur:torse:back#11', // Tueur
  'tueur:torse:back#12', // Tueur
  'tueur:torse:back#2', // Tueur
  'tueur:torse:back#3', // Tueur
  'tueur:torse:back#4', // Tueur
  'tueur:torse:back#5', // Tueur
  'tueur:torse:back#6', // Tueur
  'tueur:torse:back#7', // Tueur
  'tueur:torse:back#8', // Tueur
  'tueur:torse:back#9', // Tueur
  'tueur:torse:profile#0', // Tueur
  'tueur:torse:profile#1', // Tueur
  'tueur:torse:profile#2', // Tueur
  'tueur:torse:profile#3', // Tueur
  'tueur:torse:profile#4', // Tueur
  'tueur:torse:profile#5', // Tueur
  'tueur:torse:profile#6', // Tueur
  'tueur:torse:profile#7', // Tueur
  'tueur:torse:profile#8', // Tueur
  'tueur:torse:profile#9', // Tueur
  'villageois:tete:back#0', // Villageois
  'villageois:tete:back#1', // Villageois
  'villageois:tete:back#2', // Villageois
  'villageois:tete:back#3', // Villageois
  'villageois:tete:profile#0', // Villageois
  'villageois:tete:profile#1', // Villageois
  'villageois:tete:profile#2', // Villageois
  'villageois:tete:profile#3', // Villageois
  'villageois:tete:profile#4', // Villageois
  'villageois:torse:back#0', // Villageois
  'villageois:torse:back#1', // Villageois
  'villageois:torse:back#2', // Villageois
  'villageois:torse:back#3', // Villageois
  'villageois:torse:back#4', // Villageois
  'villageois:torse:back#5', // Villageois
  'villageois:torse:back#6', // Villageois
  'villageois:torse:back#7', // Villageois
  'villageois:torse:profile#0', // Villageois
  'villageois:torse:profile#1', // Villageois
  'villageois:torse:profile#10', // Villageois
  'villageois:torse:profile#2', // Villageois
  'villageois:torse:profile#3', // Villageois
  'villageois:torse:profile#4', // Villageois
  'villageois:torse:profile#5', // Villageois
  'villageois:torse:profile#6', // Villageois
  'villageois:torse:profile#7', // Villageois
  'villageois:torse:profile#8', // Villageois
  'villageois:torse:profile#9', // Villageois
])
