// INTÉGRITÉ des LISTES DE DÉCOUPE (`scripts/raw/decoupes/<id du livre>.json`, #1739) : une liste est
// une PROMESSE sur le registre des livres (son nom de fichier est un id de `books.json`) et sur le
// grain que le dépôt s'impose (un fichier par section, qui OUVRE sur le titre de son nom). Deux
// choses qu'un schéma ne peut pas tenir — zod ne voit ni l'autre fichier, ni la règle du grain.
// La garde vit donc ICI, à côté du lecteur unique (`_lib.mjs#decoupeDe`), sous `npm run test:raw`.
// Le CONTRAT : le nom du fichier est l'id d'un livre COUVERT par l'Atlas ; le `book` déclaré le
// redit ; chaque entrée porte exactement son jeu de clés ; les pages sont croissantes (deux entrées
// peuvent partager une page : on coupe à la LIGNE du titre, pas à la page) ; aucune entrée n'est
// saisie deux fois ; chaque titre de fichier survit à `nomAscii` sans changer (le nom écrit sous
// `Source/` est celui de la donnée).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { DECOUPES_DIR, decoupeDe, livresDecoupes, REGISTRE_LIVRES } from './_lib.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import { titreDuFichier } from '../../src/data/source/decoupe.ts'

const LIVRES_COUVERTS = new Map(REGISTRE_LIVRES.filter((b) => b.dir && b.abbr).map((b) => [b.id, b]))
const IDS = livresDecoupes()

test('#1739 : au moins une liste de découpe existe — un dossier vide rendrait ce banc VERT À VIDE', () => {
  assert.ok(IDS.length, 'scripts/raw/decoupes/ ne porte aucune liste')
})

test('#1739 : le nom de chaque liste est l’id d’un livre du registre COUVERT par l’Atlas', () => {
  const inconnus = IDS.filter((id) => !LIVRES_COUVERTS.has(id))
  assert.deepEqual(inconnus, [], 'un fichier de découpe se nomme par l’`id` STABLE de son livre')
})

const CLES = { obligatoires: ['titre', 'page', 'pageFin'], facultatives: ['ouverture', 'chapitre'] }

test('#1739 : chaque entrée porte EXACTEMENT son jeu de clés — une clé inconnue est une faute muette', () => {
  const fautes = []
  for (const id of IDS) {
    const admises = new Set([...CLES.obligatoires, ...CLES.facultatives])
    decoupeDe(id).forEach((e, i) => {
      const ou = `${id} #${i + 1}`
      for (const k of Object.keys(e)) if (!admises.has(k)) fautes.push(`${ou} — clé INCONNUE \`${k}\``)
      for (const k of CLES.obligatoires) if (!(k in e)) fautes.push(`${ou} — clé MANQUANTE \`${k}\``)
      for (const k of ['page', 'pageFin']) {
        if (!Number.isInteger(e[k]) || e[k] <= 0) fautes.push(`${ou} — \`${k}\` doit être un entier positif, pas ${JSON.stringify(e[k])}`)
      }
      for (const k of ['titre', 'ouverture', 'chapitre']) {
        if (k in e && (typeof e[k] !== 'string' || !e[k].trim())) fautes.push(`${ou} — \`${k}\` doit être une chaîne non vide`)
      }
    })
  }
  assert.deepEqual(fautes, [], `jeu de clés violé :\n${fautes.join('\n')}`)
})

// La PLAGE est lue au LIVRE et COPIÉE par les outils : c'est donc ICI, et nulle part ailleurs, que
// sa cohérence se juge. Le livre est un PAVAGE de ses pages : les fichiers se suivent sans trou, et
// deux voisins PARTAGENT au plus UNE page (la section suivante qui n'ouvre pas la sienne).
test('#1739 : les plages pavent le livre — débuts croissants, aucun trou, au plus UNE page partagée', () => {
  const fautes = []
  for (const id of IDS) {
    const l = decoupeDe(id)
    if (l[0].page !== 1) fautes.push(`${id} — le premier fichier ouvre p.${l[0].page}, pas p.1`)
    l.forEach((e, i) => {
      if (e.pageFin < e.page) fautes.push(`${id} #${i + 1} — pageFin ${e.pageFin} avant page ${e.page}`)
      const s = l[i + 1]
      if (!s) return
      if (s.page <= e.page && s.page !== e.page) fautes.push(`${id} #${i + 2} — début ${s.page} avant ${e.page}`)
      if (s.page !== e.pageFin && s.page !== e.pageFin + 1) {
        fautes.push(`${id} #${i + 2} — début p.${s.page} pour une fin précédente p.${e.pageFin} : ${s.page > e.pageFin + 1 ? 'TROU' : 'recouvrement de plus d’une page'}`)
      }
    })
  }
  assert.deepEqual(fautes, [], `les plages ne pavent pas le livre :\n${fautes.join('\n')}`)
})

// Le PREMIER niveau du sommaire ne se perd pas à la découpe : on lit le livre CHAPITRE par chapitre
// autant qu'élément par élément (#1388). Un chapitre est donc un SEGMENT de la liste — et quand le
// livre imprime une page d'ouverture à son titre, c'est la PREMIÈRE entrée du segment qui la porte.
test('#1388 : les entrées d’un chapitre sont CONTIGUËS, et son titre n’ouvre que sa première', () => {
  const fautes = []
  for (const id of IDS) {
    const l = decoupeDe(id)
    const vus = []
    let courant = null
    l.forEach((e, i) => {
      const c = e.chapitre ?? null
      if (c === courant) return
      if (c != null && vus.includes(c)) fautes.push(`${id} #${i + 1} — le chapitre « ${c} » revient à « ${e.titre} » après avoir été quitté`)
      if (c != null) vus.push(c)
      courant = c
    })
    const premiere = new Map()
    l.forEach((e, i) => { if (e.chapitre != null && !premiere.has(e.chapitre)) premiere.set(e.chapitre, i) })
    l.forEach((e, i) => {
      if (e.ouverture == null || e.chapitre == null) return
      if (e.ouverture === e.chapitre && premiere.get(e.chapitre) !== i) {
        fautes.push(`${id} #${i + 1} — « ${e.titre} » ouvre sur le titre du chapitre « ${e.chapitre} » sans en être la première entrée`)
      }
    })
  }
  assert.deepEqual(fautes, [], `le premier niveau du sommaire est rompu :\n${fautes.join('\n')}`)
})

// Un même TITRE peut revenir (le CRB imprime `POISONS` deux fois, aux règles et au guide d'achat) :
// le numéro sépare les fichiers. Ce qui ne peut pas revenir, c'est l'entrée ENTIÈRE — même titre,
// même ouverture, même page : ce serait une ligne saisie deux fois, et la seconde couperait à vide.
test('#1739 : aucune entrée n’est saisie deux fois (titre, ouverture et page identiques)', () => {
  const fautes = []
  for (const id of IDS) {
    const vus = new Set()
    for (const e of decoupeDe(id)) {
      const cle = `${e.titre} :: ${e.ouverture ?? ''} :: ${e.page}`
      if (vus.has(cle)) fautes.push(`${id} — ${cle}`)
      vus.add(cle)
    }
  }
  assert.deepEqual(fautes, [], `entrée(s) en double :\n${fautes.join('\n')}`)
})

// Le titre de la donnée EST celui du fichier écrit : s'il change en passant par `nomAscii`, le nom
// sur le disque ne serait plus celui que la liste déclare, et la garde `ouverture` comparerait un
// titre imprimé à un nom que personne n'a voulu.
test('#1739 : tout titre de fichier survit à `nomAscii` sans changer', () => {
  const fautes = []
  for (const id of IDS) {
    for (const e of decoupeDe(id)) {
      const nom = nomAscii(`01 - ${e.titre}.md`)
      if (titreDuFichier(nom) !== e.titre) fautes.push(`${id} — « ${e.titre} » → « ${titreDuFichier(nom)} »`)
    }
  }
  assert.deepEqual(fautes, [], `titres non ASCII :\n${fautes.join('\n')}`)
})

test('#1739 : le `book` déclaré dans le fichier redit le nom du fichier', () => {
  const fautes = []
  for (const id of IDS) {
    const brut = JSON.parse(readFileSync(join(DECOUPES_DIR, `${id}.json`), 'utf8'))
    if (brut.book !== id) fautes.push(`${id}.json — \`book\` = ${JSON.stringify(brut.book)}`)
    if (typeof brut.quoi !== 'string' || !brut.quoi.trim()) fautes.push(`${id}.json — \`quoi\` vide : un registre dit ce qu'il est`)
  }
  assert.deepEqual(fautes, [], `en-tête de liste :\n${fautes.join('\n')}`)
})
