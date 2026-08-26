// @vitest-environment jsdom
/**
 * CHARTE : une case à cocher est un CARRÉ de 18 px (charbon bordé, marque or) — `base.css`. La nappe
 * pleine largeur des saisies de l'atelier (`codex-edit.css`, importée APRÈS base.css par `styles.css`)
 * attrapait `input[type=checkbox]` à spécificité égale et le rendait en BARRE pleine largeur (constat
 * de recette 2026-08-26 : barres rouge sang / charbon, libellé centré dessous, association ambiguë).
 *
 * Ce test rejoue la CASCADE RÉELLE : les deux fichiers CSS du dépôt, injectés dans l'ordre de leurs
 * `@import` dans `styles.css`, sur le markup réel d'une case de l'atelier (`.codex-edit-form` +
 * `.ed-check`, cf. `CodexEdit.tsx`). La largeur attendue est LUE dans `base.css`, jamais écrite en dur.
 */
import { readFileSync } from 'node:fs';
import { describe, it, expect, beforeAll } from 'vitest';

const CSS = (f: string) => readFileSync(`src/ui/styles/${f}`, 'utf8');
const STYLES = readFileSync('src/ui/styles.css', 'utf8');

/** Largeur de case DÉCLARÉE par la charte (bloc `input[type='checkbox'], input[type='radio']`). */
function largeurDeLaCharte(): string {
  const bloc = CSS('base.css').match(/input\[type='checkbox'\],\s*\n\s*input\[type='radio'\]\s*\{([^}]*)\}/);
  expect(bloc, 'le bloc de charte des cases a changé de forme dans base.css').toBeTruthy();
  const w = bloc![1].match(/(?:^|;|\n)\s*width:\s*([^;]+);/);
  expect(w, 'la charte ne déclare plus de `width` pour les cases').toBeTruthy();
  return w![1].trim();
}

function poseLesFeuilles(fichiers: string[]) {
  document.head.innerHTML = '';
  for (const f of fichiers) {
    const style = document.createElement('style');
    style.textContent = CSS(f);
    document.head.appendChild(style);
  }
}

/** Markup réel d'une case de l'atelier (`Field`, branche `kind === 'checkbox'`). */
function poseUneCase(): HTMLInputElement {
  document.body.innerHTML = `
    <div class="codex-edit-form">
      <label class="ed-check"><input type="checkbox" /><span>Maison</span></label>
    </div>`;
  return document.querySelector('.ed-check input') as HTMLInputElement;
}

describe('cases à cocher de l’atelier — la charte tient contre la nappe de saisies', () => {
  beforeAll(() => {
    // L'ordre de cascade est celui des `@import` de styles.css : base.css AVANT codex-edit.css.
    const rang = (f: string) => STYLES.indexOf(`@import './styles/${f}'`);
    expect(rang('base.css')).toBeGreaterThanOrEqual(0);
    expect(rang('codex-edit.css'), 'codex-edit.css n’est plus importé après base.css — la cascade a changé')
      .toBeGreaterThan(rang('base.css'));
  });

  it('la charte SEULE donne la case carrée (référence de la mesure)', () => {
    poseLesFeuilles(['base.css']);
    expect(getComputedStyle(poseUneCase()).width).toBe(largeurDeLaCharte());
  });

  it('avec la feuille de l’atelier PAR-DESSUS, la case garde la largeur de la charte', () => {
    poseLesFeuilles(['base.css', 'codex-edit.css']);
    expect(
      getComputedStyle(poseUneCase()).width,
      'la nappe `.codex-edit-form input` a repris la case — l’exclure des saisies pleine largeur',
    ).toBe(largeurDeLaCharte());
  });

  it('les VRAIES saisies de l’atelier gardent, elles, la pleine largeur', () => {
    poseLesFeuilles(['base.css', 'codex-edit.css']);
    document.body.innerHTML = '<div class="codex-edit-form"><label class="ed-field"><span>Libellé</span><input /></label></div>';
    const texte = document.querySelector('.ed-field input') as HTMLInputElement;
    expect(getComputedStyle(texte).width).toBe('100%');
  });
});
