// SPÉCIFICATION du détecteur « valeur de design × lecture CSS dans un test » (#1806).
// Il vit ICI, hors de `src/**`, parce que ses fixtures sont précisément les lignes que le cliquet
// traque : écrites dans `src/`, elles le déclencheraient sur lui-même (patron de `commentPoison`,
// qui ne se lit pas lui-même par construction). Joué par `test:hooks` (racine `scripts/guards`).
// COUVERTURE : chaque forme COUVERTE et chaque faux positif ÉCARTÉ est ici en littéral — un
// détecteur ne vaut que ce que ses fixtures énoncent.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sitesValeurCss, valeurEpinglee, litDuCss, estNormeDite } from './cssValeurEnTest.mjs'

/** Un fichier d'une seule ligne : le détecteur rend 0 ou 1 site. */
const site = (ligne) => sitesValeurCss([{ rel: 'fixture', text: ligne }])

// ── COUVERT : la ligne lit une déclaration CSS ET épingle une valeur de design ───────────────────
test('longueur en px épinglée sur une déclaration lue', () => {
  const s = site("expect(decl(regle, 'bottom')).toBe('265px');")
  assert.equal(s.length, 1)
  assert.equal(s[0].valeur, '265px')
})

test('formule calc épinglée au TEXTE', () => {
  const s = site("expect(norm(decl(racine, '--cc-deck-h'))).toBe('calc(max(var(--a), var(--b)) + 3px)');")
  assert.equal(s.length, 1)
})

test('seuil numérique de design sur une grandeur lue', () => {
  assert.equal(site("expect(parseFloat(decl(r, 'top'))).toBeGreaterThanOrEqual(44);").length, 1)
  assert.equal(site("expect(parseFloat(decl(r, '--alv'))).toBeLessThan(40);").length, 1)
})

test('les autres portes de lecture comptent aussi', () => {
  for (const lecture of ["ruleOf(CSS, '.x')", "readCss('a.css')", "mediaBlock(X_CSS, '@media (max-width: 560px)')", 'baseSection(s)']) {
    assert.equal(litDuCss(`expect(${lecture}).toBe('12px');`), true, lecture)
  }
  assert.equal(site("expect(mediaBlock(CC_CSS, '@media (max-width: 700px)')).toContain('12px');").length, 1)
})

test('em, rem, %, vh, vw : toutes les unités de design', () => {
  for (const v of ['1.1em', '2rem', '84vh', '50vw', '-50%']) {
    assert.equal(site(`expect(decl(r, 'x')).toBe('${v}');`).length, 1, v)
  }
})

// ── ÉCARTÉ : ce qui n'est ni une lecture CSS, ni une valeur de design ────────────────────────────
test('aucune lecture CSS : hors périmètre, même avec un nombre', () => {
  assert.equal(site('expect(MORALE_BASE).toBe(75);').length, 0)
  assert.equal(site("expect(html).toContain('11/11');").length, 0)
})

test('aucun expect : une définition d’aide n’est pas un contrat', () => {
  assert.equal(site("const centre = decl(bloc, 'left') === '50%';").length, 0)
})

test('bornes TRIVIALES : « rien », « tout », « existe »', () => {
  assert.equal(site("expect(parseFloat(decl(r, 'left'))).toBe(0);").length, 0)
  assert.equal(site("expect(parseColor(decl(p, 'background-color'))[3]).toBe(1);").length, 0)
  assert.equal(site("expect(parseFloat(decl(r, '--cc-corner'))).toBeGreaterThan(0);").length, 0)
  assert.equal(site("expect(decl(svg, 'width')).toBe('100%');").length, 0)
  assert.equal(site("expect(decl(b, 'border')).toBe('0px');").length, 0)
})

test('une RELATION entre deux grandeurs lues ne cite aucune valeur', () => {
  assert.equal(site('expect(evalLen(a, 1920, 1080)).toBe(evalLen(b, 1920, 1080) - liseret);').length, 0)
  assert.equal(site("expect(parseFloat(decl(alv, '--alv'))).toBeLessThan(parseFloat(decl(cible, d)));").length, 0)
})

test('le NOM d’une tranche n’est pas une valeur de design', () => {
  assert.equal(site("expect(mediaBlock(CC_CSS, '@media (max-width: 900px)')).not.toContain('ouverture');").length, 0)
  // … mais une valeur POSÉE dans la même ligne reste vue.
  assert.equal(site("expect(mediaBlock(CC_CSS, '@media (max-width: 900px)')).toContain('top: 92px');").length, 1)
})

test('un viewport passé à un évaluateur n’est pas une valeur CSS', () => {
  assert.equal(site("expect(evalLen(decl(r, '--x'), 1920, 1080)).toBe(portrait + chrome);").length, 0)
})

// ── EXEMPTION AU SITE : une NORME, nommée sur la ligne ───────────────────────────────────────────
test('`// norme:` exempte la ligne, et exige que la norme soit NOMMÉE', () => {
  assert.equal(site("expect(parseFloat(decl(c, 'width'))).toBeGreaterThanOrEqual(44); // norme: cible tactile 44px").length, 0)
  assert.equal(estNormeDite('// norme:'), false)
  assert.equal(site("expect(parseFloat(decl(c, 'width'))).toBeGreaterThanOrEqual(44); // norme:").length, 1)
})

test('valeurEpinglee nomme CE qui est épinglé (le message de la garde le porte)', () => {
  assert.equal(valeurEpinglee("expect(decl(r, 'top')).toBe('92px');"), '92px')
  assert.equal(valeurEpinglee("expect(decl(r, 'x')).toBe('calc(var(--a) + 2px)');"), '2px')
  assert.equal(valeurEpinglee("expect(decl(r, 'x')).toBe('calc(var(--a) - var(--b))');"), 'calc(…) épinglé au texte')
  assert.equal(valeurEpinglee("expect(decl(r, 'x')).toBeNull();"), null)
})

test('la mesure porte le fichier et la LIGNE (un site se corrige où il est)', () => {
  const s = sitesValeurCss([{ rel: 'src/ui/a.test.tsx', text: "const a = 1;\nexpect(decl(r, 'top')).toBe('92px');\n" }])
  assert.deepEqual(s.map((x) => [x.file, x.line]), [['src/ui/a.test.tsx', 2]])
})
