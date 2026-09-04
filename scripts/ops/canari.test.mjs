// CONTRAT du workflow `canari.yml` (node --test, sans réseau) : chaque MESURE joue, et le verdict est
// AGRÉGÉ par un seul step qui les nomme toutes.
//
// Ce que ces tests empêchent, mesuré sur les 5 derniers canaris (tous rouges) : un step de mesure qui
// COUPE le job — 17 à 22 steps skippés par run, un verdict sur 27 ; et un step qui joue sans être
// relu par le résumé — mesure muette, donc mesure inutile.
// Le YAML est lu par regex, comme `gatesRequises` lit `ci.yml` : le contrat porte sur des lignes.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const CHEMIN = join(RACINE, '.github', 'workflows', 'canari.yml')
const TEXTE = readFileSync(CHEMIN, 'utf8')

/** Steps du job, un bloc par tiret de 6 espaces. PUR. */
export function stepsDu(texte) {
  const lignes = texte.split(/\r?\n/)
  const steps = []
  let courant = null
  for (const ligne of lignes) {
    if (/^ {6}- /.test(ligne)) {
      if (courant) steps.push(courant)
      courant = { lignes: [] }
    }
    if (courant) courant.lignes.push(ligne)
  }
  if (courant) steps.push(courant)
  return steps.map((s) => {
    const bloc = s.lignes.join('\n')
    return {
      bloc,
      nom: /^\s*-?\s*name:\s*(.+)$/m.exec(bloc)?.[1]?.trim() ?? null,
      id: /^\s*-?\s*id:\s*([A-Za-z0-9_-]+)\s*$/m.exec(bloc)?.[1] ?? null,
      tolerant: /^\s*continue-on-error:\s*true\s*$/m.test(bloc),
      commande: /^\s*-?\s*(run|uses):/m.test(bloc),
      run: /^\s*-?\s*run:/m.test(bloc),
    }
  })
}

/** Ids nommés par le bloc `RESULTATS` du résumé. PUR. */
export function idsDuResume(texte) {
  const bloc = /RESULTATS:\s*\|\n([\s\S]*?)\n\s{8}run:/.exec(texte)
  assert.ok(bloc, 'le step « Résumé » ne porte pas de bloc RESULTATS lisible')
  return [...bloc[1].matchAll(/^\s*([A-Za-z0-9_-]+)=\$\{\{\s*steps\.([A-Za-z0-9_-]+)\.outcome\s*\}\}\s*$/gm)]
    .map((m) => ({ etiquette: m[1], step: m[2] }))
}

const STEPS = stepsDu(TEXTE)
const MESURES = STEPS.filter((s) => s.tolerant)
const RESUME = STEPS.find((s) => s.nom === 'Résumé du canari')

test('le workflow porte `permissions: issues: write` (sans quoi il ne peut ni labelliser ni commenter)', () => {
  assert.match(TEXTE, /^permissions:\n(?:.*\n)*?\s{2}issues:\s*write$/m)
})

test('CHAQUE step de mesure porte `continue-on-error: true` ET un `id`', () => {
  const sansId = MESURES.filter((s) => !s.id).map((s) => s.nom ?? s.bloc.split('\n')[0])
  assert.deepEqual(sansId, [], 'un step de mesure sans `id` est invisible au résumé — il joue pour rien')
  assert.ok(MESURES.length >= 20, `seulement ${MESURES.length} mesures tolérantes — le canari a maigri`)
})

test('AUCUN step de mesure sans `continue-on-error` : seuls l’installation et le résumé coupent', () => {
  const durs = STEPS.filter((s) => s.run && !s.tolerant).map((s) => s.id ?? s.nom)
  assert.deepEqual(durs.sort(), ['Résumé du canari', 'install'].sort(),
    'un step de mesure qui coupe le job SKIPPE toutes les mesures suivantes (17 à 22 par run mesurées)')
})

test('le résumé NOMME chaque step de mesure — et rien d’autre', () => {
  const nommes = idsDuResume(TEXTE)
  for (const { etiquette, step } of nommes) {
    assert.equal(etiquette, step, `l’étiquette « ${etiquette} » ne porte pas le nom du step relu (${step})`)
  }
  const idsResume = new Set(nommes.map((n) => n.step))
  const idsMesures = MESURES.map((s) => s.id)
  const oubliees = idsMesures.filter((id) => !idsResume.has(id))
  assert.deepEqual(oubliees, [], 'mesure(s) jouée(s) mais jamais relue(s) par le résumé')
  const idsExistants = new Set(STEPS.map((s) => s.id).filter(Boolean))
  const fantomes = [...idsResume].filter((id) => !idsExistants.has(id))
  assert.deepEqual(fantomes, [], 'le résumé relit un step qui n’existe pas — son verdict serait vide')
})

test('le résumé joue MÊME après un rouge, ne se blanchit pas, et ÉCHOUE sur une mesure rouge', () => {
  assert.ok(RESUME, 'aucun step « Résumé du canari »')
  assert.match(RESUME.bloc, /if:\s*\$\{\{\s*!cancelled\(\)\s*\}\}/)
  assert.equal(RESUME.tolerant, false, 'le résumé PORTE le verdict : il ne peut pas être `continue-on-error`')
  assert.match(RESUME.bloc, /exit 1/, 'le résumé doit rougir le job quand une mesure est rouge')
})

test('le label `canari` est créé de façon IDEMPOTENTE (mesuré : il n’existe pas sur le dépôt)', () => {
  assert.match(RESUME.bloc, /gh label create canari .*--force/)
})

test('l’issue SURVIVANTE est la plus ANCIENNE ouverte, commentée et non re-créée', () => {
  assert.match(RESUME.bloc, /gh issue list --state open --search 'Canari rouge in:title'/)
  assert.match(RESUME.bloc, /sort_by\(\.createdAt\)/)
  assert.match(RESUME.bloc, /gh issue comment "\$SURVIVANTE"/)
  assert.match(RESUME.bloc, /if \[ -n "\$SURVIVANTE" \]/,
    'la création ne doit avoir lieu QUE si aucune issue Canari n’est ouverte (6 doublons mesurés)')
})

test('un run VERT FERME la survivante ; un run ROUGE la laisse ouverte', () => {
  // Sans fermeture, l'issue vivait pour toujours : elle recevait un commentaire « tout est vert »
  // chaque semaine, et plus rien ne distinguait un canari sain d'un canari cassé.
  assert.match(RESUME.bloc, /gh issue close "\$SURVIVANTE" --reason completed/)
  const ferme = RESUME.bloc.split('\n').findIndex((l) => /gh issue close "\$SURVIVANTE"/.test(l))
  const garde = RESUME.bloc.split('\n').slice(Math.max(0, ferme - 2), ferme).join('\n')
  assert.match(garde, /if \[ -z "\$ROUGES" \]/, 'la fermeture doit être gardée par l’ABSENCE de rouge')
})

test('aucun `npm audit` brut ne fait échouer le canari : c’est `audit-stock.mjs` qui juge', () => {
  // Les COMMENTAIRES du workflow disent pourquoi cette forme a disparu : la mesure porte sur ce qui
  // s'EXÉCUTE, jamais sur la prose qui l'explique (sans quoi l'explication déclencherait son test).
  const execute = TEXTE.split(/\r?\n/).filter((l) => !/^\s*#/.test(l)).join('\n')
  assert.ok(!/npm(?: --prefix server)? audit/.test(execute),
    'un rouge permanent sur un stock connu ne mesure plus rien (4 des 5 derniers canaris)')
  assert.match(execute, /node scripts\/ops\/audit-stock\.mjs/)
})

test('les trois mesures d’ÉTAT sont jouées par le canari', () => {
  for (const script of ['audit-stock.mjs', 'fermetures-non-citees.mjs', 'rule-suites.mjs']) {
    assert.match(TEXTE, new RegExp(`node scripts/ops/${script.replace('.', '\\.')}`), `${script} absent du canari`)
  }
})

test('chaque `gh` du résumé ferme son stdin (un runner ne le ferme pas pour lui)', () => {
  const appels = [...RESUME.bloc.matchAll(/^\s*(?:[A-Z_]+="\$\()?gh [^\n]*$/gm)].map((m) => m[0])
  const suites = RESUME.bloc.split('\n')
  for (const appel of appels) {
    const i = suites.indexOf(appel)
    const fenetre = suites.slice(i, i + 4).join('\n')
    assert.match(fenetre, /< \/dev\/null/, `appel gh sans « < /dev/null » : ${appel.trim()}`)
  }
})
