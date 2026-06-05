export const meta = {
  name: 'creatures-redo-recognizable',
  description: 'Redessine les créatures non reconnaissables (audit aveugle) en front+back+profile, silhouette-first, avec juge aveugle de reconnaissabilité. STAGING art-ref/directional/creatures-redo/.',
  whenToUse: 'Corriger les monstres illisibles repérés par l\'audit de reconnaissabilité.',
  phases: [{ title: 'Candidats' }, { title: 'Juge aveugle' }],
}

// [label, lecture erronée actuelle, cible WFRP fidèle]
const C = [
  ['Chien', 'corps de tonneau mécanique', 'un CHIEN de garde quadrupède : corps élancé, museau allongé, oreilles dressées, pattes fines, queue — clairement canin de profil/trois-quarts'],
  ['Basilic', 'crapaud informe', 'un BASILIC : grand reptile quadrupède à écailles, longue queue, crête dorsale épineuse, gueule reptilienne — silhouette de lézard/saurien, pas un crapaud'],
  ['Pégase', 'oiseau / oie', 'un PÉGASE : CHEVAL blanc quadrupède (la silhouette équine prime) avec deux grandes ailes emplumées déployées'],
  ['Pieuvre des tourbières', 'araignée', 'une PIEUVRE : grosse tête bulbeuse + 8 TENTACULES souples qui ondulent vers le bas (pas des pattes rigides d\'araignée), créature aquatique'],
  ['Troll', 'crapaud / blob vert', 'un TROLL : grand humanoïde dégingandé debout, longs bras qui pendent jusqu\'au sol, gros ventre, petite tête, large gueule — silhouette HAUTE et anguleuse, surtout PAS un blob rond vert'],
  ['Zombie', 'guerrier vivant à crête', 'un ZOMBIE mort-vivant : humanoïde décharné voûté, chair pourrie verdâtre/grise, vêtements en lambeaux, bras tendus en avant, démarche traînante, bouche béante'],
  ['Goule de crypte', 'ours', 'une GOULE : humanoïde émacié au dos voûté, peau grisâtre tendue, longues griffes, posture bestiale semi-accroupie, gueule pleine de crocs'],
  ['Manticore', 'loup / lion', 'une MANTICORE : corps de LION fauve quadrupède + grandes AILES de chauve-souris + QUEUE de scorpion dardée au-dessus + tête léonine'],
  ['Chauve-souris vampire (Varghulf)', 'sanglier', 'un VARGHULF : bête vampirique massive avec deux grandes AILES de chauve-souris membraneuses repliées, museau de loup/chauve-souris, posture quadrupède bossue'],
  ['Démonette de Slaanesh', 'lapin rose', 'une DÉMONETTE : démon humanoïde svelte à peau pâle/mauve, deux grandes PINCES de crabe à la place des mains, jambes digitigrades, cornes effilées — élégante et menaçante'],
  ['Sanguinaire de Khorne', 'minotaure trapu', 'un SANGUINAIRE (bloodletter) : démon humanoïde élancé rouge sang, tête cornue allongée, brandit une grande épée infernale ; PAS un minotaure bovin trapu'],
  ['Guerrier des clans', 'homme-cheval', 'un SKAVEN (homme-rat) : humanoïde debout voûté à TÊTE DE RAT (long museau, incisives, oreilles rondes), pelage brun, longue queue nue, tient une lame ébréchée et un bouclier de fortune'],
  ['Vermine de choc', 'cheval', 'un SKAVEN d\'élite (homme-rat) en armure de bric-à-brac, tête de rat à museau, longue queue nue, hallebarde — clairement un rat humanoïde'],
  ['Rat ogre', 'tatou / pangolin', 'un RAT OGRE : énorme brute musclée à TÊTE DE RAT, bras massifs, dos voûté, grosse queue nue — un monstre-rat colossal'],
]

const slug = (k) => k.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const V = { type: 'object', additionalProperties: false, required: ['front', 'back', 'profile'], properties: { front: { type: 'string' }, back: { type: 'string' }, profile: { type: 'string' } } }
const JUDGE = { type: 'object', additionalProperties: false, required: ['chosenFrom', 'guess', 'recognizable'], properties: { chosenFrom: { type: 'string' }, guess: { type: 'string' }, recognizable: { type: 'boolean' }, note: { type: 'string' } } }

function candPrompt(label, wrong, target, sl, n) {
  return `Tu redessines un sprite de créature pour un jeu SVG isométrique (Warhammer Fantasy 4e). Vue de face/trois-quarts, boîte viewBox "0 0 160 160", pieds vers y=150.

PROBLÈME : le sprite actuel de « ${label} » se lit comme « ${wrong} » — c'est raté.
CIBLE : il doit se reconnaître AU PREMIER COUP D'ŒIL comme ${target}.

Récupère l'art actuel comme point de départ :
  node -e "process.stdout.write(require('./src/gameIso/creatureSprites.json')[${JSON.stringify(label)}]||'')"
C'est un fragment SVG (sans <svg>). Tu peux t'en inspirer pour la palette mais CHANGE la silhouette pour qu'elle corresponde à la cible.

RÈGLES : silhouette reconnaissable AVANT tout ; PAS de blob informe ; réutilise des id de gradient déjà présents dans l'art (sinon couleurs hex) — n'invente AUCUN <defs>. Garde le même système de coordonnées (0..160, pieds ~150).

Produis 3 fragments SVG cohérents entre eux : front (face), back (dos, sans visage/yeux), profile (de profil à droite).
Écris art-ref/directional/creatures-redo/${sl}/cand${n}.json = {"front":...,"back":...,"profile":...} (crée les dossiers).
Variante ${n} : ${n === 1 ? 'lecture la plus claire et fidèle' : 'pousse encore la lisibilité de la silhouette'}.
Ne lance NI serveur NI tests. Renvoie aussi via l'outil structuré.`
}

function judgePrompt(label, target, sl) {
  return `Juge AVEUGLE de reconnaissabilité (jeu SVG iso WFRP4).
Lis art-ref/directional/creatures-redo/${sl}/cand1.json et cand2.json (chacun {front,back,profile}).
Pour CHAQUE candidat, rastérise mentalement le 'front' et demande-toi : « sans aucun contexte, qu'est-ce que je vois ? ».
Choisis le candidat dont le FRONT se lit le plus clairement comme ${target}. Tu peux MIXER (front de l'un, back/profile de l'autre) si mieux.
Écris l'ensemble retenu dans art-ref/directional/creatures-redo/${sl}/chosen.json (même format {front,back,profile}).
Renvoie { chosenFrom:"cand1"|"cand2"|"mix", guess: <ce que TU vois dans le front retenu, sans présumer>, recognizable: <true si ton guess correspond bien à « ${label} »>, note }.`
}

phase('Candidats')
const results = await pipeline(
  C,
  async ([label, wrong, target]) => {
    const sl = slug(label)
    const cands = await parallel([
      () => agent(candPrompt(label, wrong, target, sl, 1), { label: `c1:${sl}`, phase: 'Candidats', schema: V }),
      () => agent(candPrompt(label, wrong, target, sl, 2), { label: `c2:${sl}`, phase: 'Candidats', schema: V }),
    ])
    return { label, sl, target, ok: cands.filter(Boolean).length }
  },
  async (r) => {
    if (!r || !r.ok) return { label: r && r.label, done: false }
    const v = await agent(judgePrompt(r.label, r.target, r.sl), { label: `juge:${r.sl}`, phase: 'Juge aveugle', schema: JUDGE })
    return { label: r.label, sl: r.sl, done: !!v, recognizable: v && v.recognizable, guess: v && v.guess }
  },
)
const done = results.filter((x) => x && x.done)
const stillBad = done.filter((x) => !x.recognizable)
log(`Redo créatures : ${done.length}/${C.length} ; encore douteuses selon le juge : ${stillBad.map((x) => x.label).join(', ') || 'aucune'}`)
return { total: C.length, done: done.length, items: results.map((r) => r && ({ label: r.label, recognizable: r.recognizable, guess: r.guess })) }
