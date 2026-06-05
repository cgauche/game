export const meta = {
  name: 'qc-recognizability',
  description: 'Audit de reconnaissabilité EN AVEUGLE des 13 armes + 57 créatures (2 juges/élément lisent le PNG sans le nom et devinent). Sort un classement par lisibilité.',
  whenToUse: 'Vérifier qu\'on reconnaît chaque arme/monstre sans connaître son nom.',
  phases: [{ title: 'Reconnaissance', detail: '2 juges aveugles par élément' }],
}

const WEAPONS = ['épée', 'hache', 'masse', 'dague', 'lance', 'bâton', 'arc', 'arbalète', 'arme à poudre', 'fronde', 'fouet', 'bombe/explosif', 'arme de parade (main-gauche)']
const CREATURES = ['Humain', 'Nain', 'Halfling', 'Elfe (haut et sylvain)', 'Ogre', 'Bella la Noire', 'Pol Dankels', 'Araignée géante', 'Chien', 'Loup', 'Ours', 'Pigeon', 'Rat géant', 'Sanglier', 'Serpent', 'Basilic', 'Bête des marais', 'Demigriffon', 'Dragon', 'Fimir', 'Géant', 'Griffon', 'Hyppogriffe', 'Hydre', 'Jabberslythe', 'Manticore', 'Pégase', 'Pieuvre des tourbières', 'Squig des cavernes', 'Troll', 'Vouivre', 'Orc', 'Gobelin', 'Snotling', 'Banshee', 'Chauve-souris vampire (Varghulf)', 'Fantôme', 'Goule de crypte', 'Loup funeste', 'Spectre de cairn', 'Squelette', 'Vampire', 'Zombie', 'Chamane-Brey', 'Gor', 'Minotaure', 'Ungor', 'Cultiste', 'Mutant', 'Guerrier du Chaos', 'Sanguinaire de Khorne', 'Démonette de Slaanesh', 'Slenderthigh Whiptongue', "Fr'hough Mournbreath", 'Guerrier des clans', 'Rat ogre', 'Vermine de choc']

const ITEMS = [
  ...WEAPONS.map((intended, i) => ({ id: `w${String(i).padStart(2, '0')}`, kind: 'weapon', intended })),
  ...CREATURES.map((intended, j) => ({ id: `c${String(j).padStart(2, '0')}`, kind: 'creature', intended })),
]

const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['guess', 'score', 'sees'],
  properties: { guess: { type: 'string' }, score: { type: 'integer', minimum: 1, maximum: 5 }, sees: { type: 'string' } },
}

function prompt(item) {
  const k = item.kind === 'weapon' ? 'UNE ARME de fantasy médiévale' : 'UNE CRÉATURE / un monstre de fantasy'
  return `Audit de lisibilité d'art de jeu (Warhammer Fantasy, sprite SVG isométrique, vu de face).
Lis l'image au chemin \`public/qc/${item.id}.png\` avec l'outil Read et REGARDE-la.
C'est censé représenter ${k}, mais ne présume RIEN de précis — dis ce que TU vois vraiment.
- guess : identifie le plus précisément possible (en français) ce que c'est (ex. arme : « hache », « arc », « masse »… ; créature : « rat géant », « dragon », « squelette », « homme en armure »…). Si c'est illisible/un blob, mets « indéterminé ».
- score : reconnaissabilité de 1 (blob informe, on ne devine pas) à 5 (évident au premier coup d'œil).
- sees : une phrase décrivant la silhouette/forme perçue.
Sois honnête et sévère : le but est de trouver ce qui n'est PAS reconnaissable.`
}

const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
function rough(intended, guesses) {
  const ni = norm(intended).split(/[ ()/'-]+/).filter((w) => w.length > 3)
  return guesses.some((g) => { const ng = norm(g.guess); return ni.some((w) => ng.includes(w) || w.includes(ng.split(' ')[0])) })
}

phase('Reconnaissance')
const results = await pipeline(ITEMS, async (item) => {
  const gs = await parallel([
    () => agent(prompt(item), { label: `j1:${item.id}`, phase: 'Reconnaissance', schema: SCHEMA }),
    () => agent(prompt(item), { label: `j2:${item.id}`, phase: 'Reconnaissance', schema: SCHEMA }),
  ])
  const guesses = gs.filter(Boolean)
  const avg = guesses.length ? guesses.reduce((a, g) => a + g.score, 0) / guesses.length : 0
  return { id: item.id, kind: item.kind, intended: item.intended, avg: +avg.toFixed(1), match: rough(item.intended, guesses), guesses: guesses.map((g) => ({ guess: g.guess, score: g.score, sees: g.sees })) }
})

const sorted = results.filter(Boolean).sort((a, b) => a.avg - b.avg)
const fails = sorted.filter((r) => r.avg < 3 || !r.match)
log(`Audit terminé : ${fails.length}/${results.length} éléments douteux (avg<3 ou hypothèse fausse).`)
return { count: results.length, fails: fails.map((r) => ({ id: r.id, kind: r.kind, intended: r.intended, avg: r.avg, match: r.match, guesses: r.guesses.map((g) => `${g.guess}(${g.score})`) })), ranking: sorted.map((r) => `${r.avg} ${r.kind} ${r.intended} [${r.match ? 'ok' : 'MISS'}]`) }
