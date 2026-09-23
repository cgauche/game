// ORDRE DE LECTURE d'une page de PDF (#1739) : les BOÎTES de texte que pdfminer a LUES
// (`scripts/raw/lib/pdf-lignes.py`, qui porte l'analyse de mise en page) rangées en COLONNES, puis
// leurs lignes rendues colonne par colonne. PUR, joué en CI sur des pages réelles
// (`scripts/raw/lib/fixtures/pages-crb/`). Aucune coupe à mi-page ni largeur de gouttière fixée.

/** Médiane de `[valeur, poids]` : la valeur où le poids cumulé atteint la moitié. */
const mediane = (paires) => {
  const s = [...paires].sort((a, b) => a[0] - b[0])
  const moitie = s.reduce((t, [, p]) => t + p, 0) / 2
  let cumul = 0
  for (const [v, p] of s) if ((cumul += p) >= moitie) return v
  return -Infinity
}

/**
 * Bords gauches des COLONNES de la page, croissants. Un CANDIDAT est une grappe d'abscisses `x0` de
 * boîtes (à 1 pt de la première, abscisse = la plus petite) qui porte au moins deux lignes. Un candidat
 * ouvre une colonne s'il tombe au-delà de la MARGE DROITE de la colonne en cours — la médiane des `x1`
 * des boîtes qui partent de son bord, pondérée par leur nombre de lignes : un encadré en retrait ou une
 * boîte de tableau restent dans son emprise, la gouttière est l'écart entre cette marge et le bord
 * suivant.
 * @param {{ x0: number, x1: number, lignes: unknown[] }[]} boites
 */
export function colonnes(boites) {
  const grappes = []
  for (const b of [...boites].sort((a, c) => a.x0 - c.x0)) {
    const g = grappes.at(-1)
    if (g && b.x0 - g.x <= 1) g.boites.push(b)
    else grappes.push({ x: b.x0, boites: [b] })
  }
  const bords = []
  let marge = -Infinity
  for (const g of grappes.filter((x) => x.boites.reduce((n, b) => n + b.lignes.length, 0) >= 2)) {
    if (g.x < marge) continue
    bords.push(g.x)
    marge = mediane(g.boites.map((b) => [b.x1, b.lignes.length]))
  }
  return bords
}

/**
 * LIGNES de la page dans l'ORDRE DE LECTURE : chaque boîte va à la colonne du plus grand bord qui ne
 * dépasse pas son `x0` (0,5 pt d'arrondi) ; colonne par colonne, boîtes du haut vers le bas, et dans
 * une boîte ses lignes dans l'ordre de pdfminer.
 * @returns {{ colonne: number, x0: number, y0: number, texte: string, spans: { texte: string, police: string, taille: number }[] }[]}
 */
export function lignes(boites, bords = colonnes(boites)) {
  const colonneDe = (x) => Math.max(0, ...bords.map((b, k) => (x >= b - 0.5 ? k : 0)))
  return boites
    .map((b) => ({ b, k: colonneDe(b.x0) }))
    .sort((a, c) => a.k - c.k || c.b.y1 - a.b.y1)
    .flatMap(({ b, k }) =>
      b.lignes.map((l) => ({
        colonne: k,
        x0: l.x0,
        y0: l.y0,
        texte: l.texte,
        spans: l.spans.map(([texte, police, taille]) => ({ texte, police, taille })),
      })),
    )
}
