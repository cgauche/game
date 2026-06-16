import type { AppearanceElement } from '../types';
import { plumeFan } from '../../textures';

/**
 * « Peau de plumes » — couvre torse et épaules de plumes imbriquées, teintées par la palette de PEAU
 * (`@peau`/`@peauO`/`@peauH`) : `colors.peau` recolore donc le plumage (ex. rouge sang `#8b0000`).
 *
 * EXEMPLE de « primitif manquant » ajouté UNE fois en code : déposer ce fichier `defs/` → l'élément
 * `plumage` est dès lors sélectionnable EN DONNÉE (`appearance.features: ['plumage']`) sur n'importe
 * quelle mutation/trait/créature, sans plus toucher au code. C'est le process documenté pour étendre
 * le catalogue (cf. docs/superpowers/specs/2026-06-14-apparence-catalogue-unifie.md).
 */
const FEATHERS = ['@peau', '@peauO', '@peauH'];
const row = (cx: number, cy: number, k: number) => plumeFan(cx, cy, { n: 3, spread: 72, k, baseRot: 180, colors: FEATHERS });
const PLUMAGE_TORSE = '<g data-feature="plumage">'
  + row(-5, -17, 0.8) + row(0, -17, 0.9) + row(5, -17, 0.8)
  + row(-5.5, -10, 0.85) + row(0, -10, 0.95) + row(5.5, -10, 0.85)
  + row(-4, -3, 0.8) + row(2.5, -3, 0.85)
  + '</g>';
const PLUMAGE_EPAULE = `<g data-feature="plumage">${plumeFan(0, 1, { n: 3, spread: 60, k: 0.8, colors: FEATHERS })}</g>`;

export const element: AppearanceElement = {
  key: 'plumage', label: 'Peau de plumes', category: 'trait',
  overlays: [
    { bone: 'torse', svg: PLUMAGE_TORSE },
    { bone: 'epauleG', svg: PLUMAGE_EPAULE },
    { bone: 'epauleD', svg: PLUMAGE_EPAULE },
  ],
};
