// L'OUTIL de réparation des renvois d'ancre (#1824) : ce qu'il plie, ce qu'il REFUSE de deviner, et
// ce qu'il n'écrit pas. L'Atlas des cas est JETABLE (`atlasFixture.mjs`) — `--apply` n'écrit que là.
//   node --test scripts/raw/reparer-ancres.test.mjs   (joué par `npm run test:raw`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { avecAtlasFixture } from './atlasFixture.mjs'
import { pageReecrite, reparer, verdictDeRenvoi } from './reparer-ancres.mjs'

test('verdictDeRenvoi : étage 1 — l’ancre citée SANS ses accents se plie sur l’ancre réelle', () => {
  const table = new Set(['créer-un-familier--traits-de-familier-vdm'])
  assert.deepEqual(verdictDeRenvoi('creer-un-familier--traits-de-familier-vdm', table), {
    etat: 'reparable', etage: 'accents', ancre: 'créer-un-familier--traits-de-familier-vdm',
  })
})

test('verdictDeRenvoi : étage 2 — les suites de `-` se fusionnent, jamais les `-` de BORD', () => {
  assert.deepEqual(verdictDeRenvoi('taille-categories-et-modificateurs', new Set(['taille--catégories-et-modificateurs'])), {
    etat: 'reparable', etage: 'accents+tirets', ancre: 'taille--catégories-et-modificateurs',
  })
  // Le `-` de queue que les guillemets laissent (`« … »`) n'est pas rogné : rien ne se devine.
  assert.deepEqual(verdictDeRenvoi('cadre-général-entre-deux-aventures', new Set(['cadre-général--entre-deux-aventures-'])), { etat: 'residuel' })
})

test('verdictDeRenvoi : PLUSIEURS candidats ne se départagent pas — le renvoi se rend, jamais deviné', () => {
  // Deux titres que seul leur accent distingue : l'ancre citée SANS accent les vise tous les deux.
  const table = new Set(['peripeties-ldb', 'péripéties-ldb'])
  assert.deepEqual(verdictDeRenvoi('peripeties-ldb', table), { etat: 'ambigu', etage: 'accents', candidats: ['peripeties-ldb', 'péripéties-ldb'] })
})

test('pageReecrite : la CIBLE seule change, sur la ligne du renvoi — la prose reste mot pour mot', () => {
  const avant = '# Une\n\nvoir [Créer un familier](#creer-un-familier) et [autre](#creer-un-familier) ailleurs\n[texte](#creer-un-familier)\n'
  const apres = pageReecrite(avant, [{ ligne: 3, ecrit: '#creer-un-familier', ancre: 'créer-un-familier' }])
  assert.equal(
    apres,
    '# Une\n\nvoir [Créer un familier](#créer-un-familier) et [autre](#créer-un-familier) ailleurs\n[texte](#creer-un-familier)\n',
  )
})

test('reparer : `--apply` répare et n’écrit qu’une fois — la seconde passe ne réécrit RIEN', () => {
  avecAtlasFixture(
    {
      'une.md': '# Une\n\n## Créer un familier\n\n## Cadre « ainsi »\n\n[a](#creer-un-familier) · [b](#cadre--ainsi)\n',
    },
    (rawDir, coeur) => {
      const chemin = join(rawDir, coeur, 'une.md')
      const avant = readFileSync(chemin, 'utf8')
      assert.deepEqual(reparer(['--dry'], rawDir), { reparables: 1, ambigus: 0, residuels: 1, pages: 0 })
      assert.equal(readFileSync(chemin, 'utf8'), avant, '`--dry` n’écrit rien')
      assert.deepEqual(reparer(['--apply'], rawDir), { reparables: 1, ambigus: 0, residuels: 1, pages: 1 })
      const apres = readFileSync(chemin, 'utf8')
      assert.ok(apres.includes('[a](#créer-un-familier)'))
      assert.deepEqual(reparer(['--apply'], rawDir), { reparables: 0, ambigus: 0, residuels: 1, pages: 0 })
      assert.equal(readFileSync(chemin, 'utf8'), apres, 'idempotent : la 2ᵉ passe ne réécrit rien')
    },
  )
})

test('reparer : la page réparée s’écrit en `\\n`, jamais en `\\r\\n`', () => {
  avecAtlasFixture(
    { 'une.md': '# Une\n\n## Créer un familier\n\n[a](#creer-un-familier)\n' },
    (rawDir, coeur) => {
      reparer(['--apply'], rawDir)
      assert.equal(readFileSync(join(rawDir, coeur, 'une.md'), 'utf8').includes('\r'), false)
    },
  )
})
