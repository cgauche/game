// @vitest-environment jsdom
/**
 * ARDOISE AMONT — LE BATTEMENT (#1680), jumeau de `ardoise-amont.test.ts` pour l'autre drapeau.
 *
 * La boucle d'images du stage s'arme sur un rAF et ne s'en réarme qu'AU RETOUR de celui-ci
 * (`armer`, `stageFrames.ts` : `if (image || …) return`). `image` est donc l'exact jumeau de
 * `sliceArmed` du cuiseur : armé sur un rAF qui meurt avec l'environnement jsdom du fichier qui l'a
 * posé, il reste levé dans le graphe de modules que la suite partage (`isolate: false`), et plus
 * aucun banc suivant ne peint une seule image — quoi qu'il demande.
 *
 * Le `beforeEach` ci-dessous est enregistré AVANT `brancherArdoise()` : il joue le fichier précédent.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demanderFrames, relacherFrames, subscribeStageFrames } from './stageFrames';
import { brancherArdoise } from './banc-volumique';

/** Le rAF du « fichier précédent » : compté, jamais servi — celui qui meurt avec son environnement. */
let arméesAilleurs = 0;
const SOURCE_AILLEURS = Symbol('écran du fichier précédent');

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', () => { arméesAilleurs += 1; return 1; });
  demanderFrames(SOURCE_AILLEURS);
  vi.unstubAllGlobals();
});

brancherArdoise();

describe('Banc volumique — l’ardoise amont lave aussi le BATTEMENT', () => {
  it('une boucle héritée ARMÉE SANS SERVIR ne coince pas le banc : ses images sont peintes', () => {
    expect(arméesAilleurs, 'PRÉMISSE : le fichier précédent doit avoir armé la boucle — sinon rien n’est mesuré').toBe(1);

    const rafs: Array<() => void> = [];
    vi.stubGlobal('requestAnimationFrame', (cb: () => void) => { rafs.push(cb); return rafs.length; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);

    let peintes = 0;
    const désabonner = subscribeStageFrames(() => { peintes += 1; });
    const source = Symbol('écran de ce banc');
    demanderFrames(source);

    expect(rafs.length, 'la boucle est entrée COINCÉE : aucune image ne partira, et ce banc mesurerait un écran figé').toBe(1);

    // Drainage : chaque rappel servi peint son image et réarme la suivante.
    for (let tour = 0; tour < 3 && rafs.length > 0; tour++) for (const cb of rafs.splice(0)) cb();
    expect(peintes, 'la boucle n’a peint aucune image alors qu’une source en demande').toBeGreaterThan(0);

    relacherFrames(source);
    désabonner();
  });
});
