/**
 * Re-audit ciblé (anti-rate-limit) : moins d'agents que weapons-qc.
 *   args = { full: [{slug,label,target,isolated,held}], heldOnly: [{…}] }
 *   - full     : iso (2 juges) + sur-modèle (1 juge) — armes régénérées ou non encore auditées.
 *   - heldOnly : sur-modèle (1 juge) seulement — iso déjà validé au run précédent.
 * Sort la liste des échecs (iso avg<3 OU tenue incorrecte).
 */
export const meta = {
  name: 'weapons-qc2',
  description: 'Re-audit ciblé des armes (iso+modèle pour les inconnues/régénérées, modèle seul pour les iso déjà OK). Moins d\'agents, moins de rate-limit.',
  whenToUse: 'Reprendre un audit weapons-qc partiellement rate-limité sans tout relancer.',
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

const _argv = typeof args === 'string' ? JSON.parse(args) : args
const full = (_argv && Array.isArray(_argv.full)) ? _argv.full : []
const heldOnly = (_argv && Array.isArray(_argv.heldOnly)) ? _argv.heldOnly : []
log(`re-audit : ${full.length} complètes (iso+modèle) + ${heldOnly.length} modèle-seul.`)

// FULL : iso (2 juges) puis modèle (1 juge), pipeliné par arme.
phase('Qualité (isolé)')
const fullRes = await pipeline(
  full,
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

// HELD-ONLY : iso déjà validé → juste la tenue.
phase('Sur modèle')
const heldRes = await parallel(
  heldOnly.map((w) => () =>
    agent(heldPrompt(w), { label: `held:${w.slug}`, phase: 'Sur modèle', schema: HELD })
      .then((h) => {
        const heldOk = !!h && h.readable && h.orientation_ok && h.grip_ok && h.scale_ok
        return { slug: w.slug, label: w.label, avg: null, guesses: ['(iso déjà OK)'], isoOk: true, heldOk, held: h, fail: !heldOk }
      }),
  ),
)

const all = [...fullRes, ...heldRes].filter(Boolean)
const fails = all.filter((r) => r.fail)
log(`re-audit terminé : ${fails.length}/${all.length} échecs.`)
return {
  count: all.length,
  fails: fails.map((r) => ({ slug: r.slug, label: r.label, avg: r.avg, isoOk: r.isoOk, heldOk: r.heldOk, guesses: r.guesses, note: r.held && r.held.note })),
  ranking: all.map((r) => `${r.avg ?? '—'} ${r.label} [iso ${r.isoOk ? 'ok' : 'X'} | tenue ${r.heldOk ? 'ok' : 'X'}]`),
}
