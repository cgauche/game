import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { PovBillboards } from './billboards';
import { makeCamera } from './camera';
import type { Scene, SceneEntity, Terrain } from '../../state/scene';

/**
 * Billboards POV : les entités `personnage` VISIBLES se rendent en rig plat ancré aux pieds ; une
 * entité hors `visible` (occlusion LdV/brouillard) ou au-delà de la portée est droppée. Rendu PUR
 * via `renderToStaticMarkup` (composant à props, zéro store) — idiome de `InspectPanel.test.tsx`.
 */
const W = 12;
const H = 24;

/** Scène plate minimale (herbe, une couche z=0, pas de hauteurs) + un départ héros. */
function makeScene(entities: SceneEntity[]): Scene {
  return {
    id: 'pov-bb-test',
    nom: 'Test billboards',
    description: 'Scène plate pour tester les billboards POV.',
    dimensions: { w: W, h: H },
    ambiance: 'exterieur',
    layers: [{ z: 0, tiles: new Array(W * H).fill('herbe') as Terrain[] }],
    entities: [{ id: 'start', kind: 'heroStart', pos: { x: 5, y: 5 } }, ...entities],
    dialogues: [],
    triggers: [],
    encounters: [],
    flags: {},
  };
}

/** PNJ debout devant la caméra (au sud). `facing:'N'` → il regarde vers nous (vue de face). */
const npc = (id: string, x: number, y: number): SceneEntity => ({ id, kind: 'personnage', pos: { x, y }, facing: 'N', label: 'villageois' });

describe('PovBillboards', () => {
  // Groupe en (5,5) regardant le SUD (+y) → fwd = (0,1) : tout ce qui est au sud est droit devant.
  const cam = makeCamera(makeScene([]), { x: 5, y: 5 }, 'S');

  it('rend le rig d’une entité personnage visible (markup SVG)', () => {
    const scene = makeScene([npc('pnj1', 5, 9)]);
    const visible = new Set(['5,9,0']);
    const html = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={visible} />);
    expect(html).toContain('pov-billboards');
    expect(html).toContain('class="rig"'); // le RigSprite émet un <g class="rig">
    expect(html).toContain('data-bone'); // au moins un os
    expect(html).toContain('<path'); // art vectoriel du rig
    expect(html).toContain('translate'); // ancrage aux pieds / projection
  });

  it('ne rend RIEN pour une entité hors de `visible` (occlusion)', () => {
    const scene = makeScene([npc('pnj1', 5, 9)]);
    const html = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={new Set()} />);
    expect(html).not.toContain('data-bone');
    expect(html).not.toContain('<path');
  });

  it('ignore heroStart et prop (seuls les personnages sont la « vie »)', () => {
    const scene = makeScene([{ id: 'crate', kind: 'prop', pos: { x: 5, y: 9 }, ref: 'tonneau' }]);
    const html = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={new Set(['5,9,0', '5,5,0'])} />);
    expect(html).not.toContain('data-bone');
  });

  it('CULL de distance : une entité au-delà de FAR est droppée', () => {
    // FAR_TILES=14 cases × 2 m/case = 28 m ; entité à y=25 → depth = (25−5)·2 = 40 m > 28 → droppée.
    const far = makeScene([npc('loin', 5, 25)]);
    const html = renderToStaticMarkup(<PovBillboards scene={far} cam={cam} visible={new Set(['5,25,0'])} />);
    expect(html).not.toContain('data-bone');
  });

  it('CULL « derrière » : une entité DANS LE DOS de la caméra est droppée', () => {
    // Groupe regarde le SUD → une entité au NORD (y<5) est derrière le plan proche.
    const back = makeScene([npc('derriere', 5, 1)]);
    const html = renderToStaticMarkup(<PovBillboards scene={back} cam={cam} visible={new Set(['5,1,0'])} />);
    expect(html).not.toContain('data-bone');
  });

  it('deux personnages visibles → deux rigs rendus', () => {
    const scene = makeScene([npc('a', 4, 9), npc('b', 6, 11)]);
    const html = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={new Set(['4,9,0', '6,11,0'])} />);
    expect((html.match(/class="rig"/g) ?? []).length).toBe(2);
  });
});
