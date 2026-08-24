/**
 * GARDE DÉCROISSANTE — le congédiement a UNE couture (#1476).
 *
 * Toute surface qui se ferme à Échap s'empile (`useDismissLayer`/`useModalA11y`) et se fait
 * congédier par `resoudreEchap` ; le code physique de la touche vit au registre (`CODE_ECHAP`).
 * Écrire `'Escape'` ailleurs, c'est rouvrir une porte parallèle — celle-là même qui faisait
 * s'ouvrir le menu système par-dessus un popover fermé.
 *
 * La liste ci-dessous est une BASELINE : elle ne peut que DÉCROÎTRE. Chaque entrée nomme son lot de
 * résorption ; un site NEUF, ou un site existant qui gagne une porte, échoue.
 *
 * COUVERTURE de cette garde — ce qu'elle voit et ce qu'elle ne voit PAS. Elle compte le LITTÉRAL
 * `'Escape'`/`"Escape"` dans les sources `src/` hors tests. Restent hors de portée : `keyCode === 27`
 * et `e.which`, un code passé par variable ou constante locale, un backtick, et toute porte posée
 * hors de `src/`. Un détecteur ne mesure que sa couverture : élargir la mesure est un geste, pas un
 * effet de bord d'un autre lot.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const RACINE = join(process.cwd(), 'src');

/** Fichiers AUTORISÉS à nommer la touche : le registre en est la source (`CODE_ECHAP`). */
const SOURCE = ['src/state/keybindings.ts'];

/**
 * Portes ENCORE ouvertes, chacune avec le lot qui la résorbe. Le nombre est un PLAFOND.
 * - `KeyBindingsPanel.tsx` : CAPTEUR de touches (l'écran de remap lit le `code` brut pour annuler
 *   une capture) — il n'ouvre ni ne ferme aucune surface. Exemption AU SITE, pas au fichier.
 * - `MediaSelect.tsx` : liste déroulante d'atelier → couche de la pile au lot L3 (sweep des modales).
 * - `editor/Editor.tsx`, `editor/EditorToolbar.tsx` : sélection et menu Fichier de l'éditeur → L4.
 */
const BASELINE: Record<string, number> = {
  'src/ui/KeyBindingsPanel.tsx': 1,
  'src/ui/MediaSelect.tsx': 1,
  'src/ui/editor/Editor.tsx': 1,
  'src/ui/editor/EditorToolbar.tsx': 1,
};

function fichiers(dir: string, acc: string[] = []): string[] {
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) fichiers(p, acc);
    else if (/\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom)) acc.push(p);
  }
  return acc;
}

const PORTE = /(['"])Escape\1/g;

describe('Échap : une seule couture (#1476)', () => {
  it('aucune porte NEUVE, et les portes restantes ne grossissent pas', () => {
    const compte: Record<string, number> = {};
    for (const p of fichiers(RACINE)) {
      const rel = relative(process.cwd(), p).split(sep).join('/');
      if (SOURCE.includes(rel)) continue;
      const n = (readFileSync(p, 'utf8').match(PORTE) ?? []).length;
      if (n > 0) compte[rel] = n;
    }
    const neuves = Object.keys(compte).filter((f) => !(f in BASELINE));
    expect(neuves, 'porte Échap OUVERTE HORS de la couture — passer par useDismissLayer/resoudreEchap').toEqual([]);
    for (const [f, plafond] of Object.entries(BASELINE)) {
      expect(compte[f] ?? 0, `${f} : la baseline ne peut que décroître`).toBeLessThanOrEqual(plafond);
    }
  });
});
