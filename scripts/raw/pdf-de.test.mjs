// Couture du PDF d'un livre (#1739, 2026-09-19, bloquant 3) : `pdfDe` et ses sœurs (`scripts/raw/_lib.mjs`),
// et FORME du champ `pdf` du registre. La garde du dépôt : `scripts/guards/lib/pdfHorsCouture.mjs`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EXT, nomPdf } from '../guards/lib/pdfHorsCouture.mjs'
import {
  REGISTRE_LIVRES, copieMarkerDe, estLivreExtrait, markerDe, pdfDe, pdfDuSigle, pdfRequisDe, sortieMarkerDe,
} from './_lib.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

const REGISTRE = [
  { id: 'avec', abbr: 'AV', dir: 'Source/Avec', pdf: nomPdf('Le livre avec') },
  { id: 'sans', abbr: 'SA', dir: 'Source/Sans' },
  { id: 'absent', abbr: 'AB', dir: 'Source/Absent', pdf: nomPdf('Nulle part') },
  { id: 'non-extrait', abbr: 'NE', pdf: nomPdf('Non extrait') },
]

function avecSource(fn) {
  const racine = mkdtempSync(join(tmpdir(), 'pdf-de-'))
  try {
    writeFileSync(join(racine, nomPdf('Le livre avec')), 'PDF factice')
    return fn({ registre: REGISTRE, source: () => racine }, racine)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
}

test('pdfDe : `Source/<pdf>` de la racine résolue ; `null` sans `pdf` déclaré', () => avecSource((opts, racine) => {
  assert.equal(pdfDe('avec', opts), join(racine, nomPdf('Le livre avec')))
  assert.equal(pdfDe('sans', opts), null)
}))

test('pdfDe : LÈVE en nommant le livre, le chemin tenté et la racine quand le fichier manque', () => avecSource((opts, racine) => {
  assert.throws(() => pdfDe('absent', opts), (e) =>
    e.message.includes('« absent »') && e.message.includes(join(racine, nomPdf('Nulle part'))) && e.message.includes(racine))
}))

test('pdfDe : un id inconnu ou non extrait LÈVE, nommé — jamais `null`', () => avecSource((opts) => {
  assert.throws(() => pdfDe('inconnu', opts), /« inconnu »/)
  assert.throws(() => pdfDe('non-extrait', opts), /« non-extrait »/)
}))

test('pdfRequisDe : le PDF REQUIS — LÈVE, nommée, sans `pdf` déclaré', () => avecSource((opts, racine) => {
  assert.equal(pdfRequisDe('avec', opts), join(racine, nomPdf('Le livre avec')))
  assert.throws(() => pdfRequisDe('sans', opts), /« sans » ne déclare aucun PDF/)
}))

test('pdfDuSigle : le PDF REQUIS d\'un outil à sigle — LÈVE sans `pdf` déclaré ni livre extrait', () => avecSource((opts, racine) => {
  assert.equal(pdfDuSigle('AV', opts), join(racine, nomPdf('Le livre avec')))
  assert.throws(() => pdfDuSigle('SA', opts), /« sans » ne déclare aucun PDF/)
  assert.throws(() => pdfDuSigle('ZZ', opts), /« ZZ »/)
}))

test('copieMarkerDe : `_marker/<id>.<ext>`, chemin SEUL — rien n\'est écrit', () => avecSource((opts, racine) => {
  const attendu = join(racine, '_marker', nomPdf('avec'))
  assert.equal(markerDe(nomPdf('avec'), opts), attendu)
  assert.equal(copieMarkerDe('avec', opts), attendu)
  assert.equal(existsSync(attendu), false)
}))

test('sortieMarkerDe : `_marker/full/<id>` ; un LECTEUR lève en citant les sorties hors registre à renommer', () => avecSource((opts, racine) => {
  const attendu = join(racine, '_marker', 'full', 'avec')
  assert.equal(sortieMarkerDe('avec', { ...opts, exiger: false }), attendu)
  assert.throws(() => sortieMarkerDe('avec', opts), /aucune sortie Marker de ce livre/)
  mkdirSync(join(racine, '_marker', 'full', 'historique'), { recursive: true })
  assert.throws(() => sortieMarkerDe('avec', opts), (e) => e.message.includes(attendu) && e.message.includes('historique'))
  mkdirSync(attendu)
  assert.equal(sortieMarkerDe('avec', opts), attendu)
  assert.throws(() => sortieMarkerDe('inconnu', opts), /« inconnu »/)
}))

test('CLI pdf-de : sans argument, exit 1 sur l\'usage et RIEN sur stdout', () => {
  for (const args of [[], ['--marker']]) {
    const vu = spawnSync(process.execPath, [join(RACINE, 'scripts/raw/pdf-de.mjs'), ...args], { encoding: 'utf8' })
    assert.equal(vu.status, 1, args.join(' '))
    assert.equal(vu.stdout, '')
    assert.match(vu.stderr, /usage/)
  }
})

test('registre : `pdf` est un NOM de fichier sous `Source/`, d\'extension PDF, porté par un livre EXTRAIT seulement', () => {
  const porteurs = REGISTRE_LIVRES.filter((b) => b.pdf != null)
  assert.ok(porteurs.length > 0, 'aucun livre du registre ne déclare de `pdf`')
  for (const b of porteurs) {
    assert.equal(b.pdf.slice(-EXT.length - 1), `.${EXT}`, `${b.id} : \`pdf\` sans extension PDF`)
    assert.doesNotMatch(b.pdf, /[\\/]/, `${b.id} : \`pdf\` est un nom sous Source/, pas un chemin`)
    assert.ok(estLivreExtrait(b), `${b.id} : \`pdf\` sur un livre sans \`dir\` — \`pdfDe\` ne le résout pas`)
  }
})
