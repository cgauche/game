/**
 * Audit des armes : (a) QUALITÉ = reconnaissabilité aveugle de la silhouette ISOLÉE
 * (2 juges/arme), (b) SUR MODÈLE = le rig tient l'arme (orientation/prise/échelle).
 * args = [{ slug, label, target, isolated, held }] (chemins PNG). Sort la liste des fails.
 */
export const meta = {
  name: 'weapons-qc',
  description: 'Audit aveugle des armes : silhouette isolée (devine sans le nom, 1–5) + tenue sur le rig (orientation/prise/échelle). Sort les échecs.',
  whenToUse: 'Vérifier que chaque arme se reconnaît seule ET tient correctement sur le personnage.',
  phases: [{ title: 'Qualité (isolé)' }, { title: 'Sur modèle' }],
}

const ISO = { type: 'object', additionalProperties: false, required: ['guess', 'score', 'sees'], properties: { guess: { type: 'string' }, score: { type: 'integer', minimum: 1, maximum: 5 }, sees: { type: 'string' } } }
const HELD = { type: 'object', additionalProperties: false, required: ['readable', 'orientation_ok', 'grip_ok', 'scale_ok'], properties: { readable: { type: 'boolean' }, orientation_ok: { type: 'boolean' }, grip_ok: { type: 'boolean' }, scale_ok: { type: 'boolean' }, note: { type: 'string' } } }

function isoPrompt(w) {
  return `Audit de lisibilité d'art de jeu (Warhammer Fantasy, sprite SVG iso, vu de face).
Lis l'image \`${w.isolated}\` avec l'outil Read et REGARDE-la. C'est censé représenter UNE ARME, mais ne présume RIEN — dis ce que TU vois.
- guess : la famille d'arme la plus précise (ex. « hache », « arbalète », « fléau », « pistolet »…) ; « indéterminé » si illisible.
- score : 1 (blob) à 5 (évident au 1er coup d'œil).
- sees : une phrase sur la silhouette perçue. Sois honnête et sévère.`
}
function heldPrompt(w) {
  return `Vérif « sur modèle » (jeu SVG iso WFRP4). Lis l'image \`${w.held}\` avec l'outil Read : un soldat humain TIENT une arme censée être : ${w.target}.
Réponds factuellement :
- readable : l'arme est-elle lisible/identifiable une fois tenue ?
- orientation_ok : tenue dans le bon sens (lame/tête vers l'extérieur/haut, pas à l'envers ni dans le corps) ?
- grip_ok : la poignée est-elle DANS la main (pas flottante, pas décalée) ?
- scale_ok : taille crédible (ni minuscule ni démesurée par rapport au personnage) ?
- note : le défaut principal si un critère est false.`
}

const _argv = typeof args === 'string' ? JSON.parse(args) : args // le harness peut passer args en JSON-string
const work = (Array.isArray(_argv) ? _argv : []).filter((w) => w && w.slug)
if (!work.length) { log('aucune arme en entrée (args vide).'); return { fails: [], ranking: [] } }
log(`Audit de ${work.length} arme(s) : isolé (2 juges) + sur modèle (1 juge).`)

phase('Qualité (isolé)')
const results = await pipeline(
  work,
  async (w) => {
    const gs = (await parallel([
      () => agent(isoPrompt(w), { label: `iso1:${w.slug}`, phase: 'Qualité (isolé)', schema: ISO }),
      () => agent(isoPrompt(w), { label: `iso2:${w.slug}`, phase: 'Qualité (isolé)', schema: ISO }),
    ])).filter(Boolean)
    const avg = gs.length ? +(gs.reduce((a, g) => a + g.score, 0) / gs.length).toFixed(1) : 0
    return { w, avg, guesses: gs.map((g) => `${g.guess}(${g.score})`) }
  },
  async (r) => {
    const h = await agent(heldPrompt(r.w), { label: `held:${r.w.slug}`, phase: 'Sur modèle', schema: HELD })
    const heldOk = !!h && h.readable && h.orientation_ok && h.grip_ok && h.scale_ok
    const isoOk = r.avg >= 3
    return { slug: r.w.slug, label: r.w.label, avg: r.avg, guesses: r.guesses, isoOk, heldOk, held: h, fail: !(isoOk && heldOk) }
  },
)
const ok = results.filter(Boolean)
const fails = ok.filter((r) => r.fail)
log(`Audit terminé : ${fails.length}/${ok.length} échecs (isolé avg<3 ou tenue incorrecte).`)
return {
  count: ok.length,
  fails: fails.map((r) => ({ slug: r.slug, label: r.label, avg: r.avg, isoOk: r.isoOk, heldOk: r.heldOk, guesses: r.guesses, note: r.held && r.held.note })),
  ranking: ok.sort((a, b) => a.avg - b.avg).map((r) => `${r.avg} ${r.label} [iso ${r.isoOk ? 'ok' : 'X'} | tenue ${r.heldOk ? 'ok' : 'X'}]`),
}
