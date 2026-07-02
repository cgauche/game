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

  it('un PROP visible se rend en billboard du MÊME SVG iso (pas un rig) ; heroStart reste ignoré', () => {
    const scene = makeScene([{ id: 'crate', kind: 'prop', pos: { x: 5, y: 9 }, ref: 'tonneau' }]);
    const html = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={new Set(['5,9,0', '5,5,0'])} />);
    expect(html).not.toContain('data-bone'); // pas un rig
    expect(html).toContain('<g transform="translate('); // billboard ancré aux pieds
    expect(html).toContain('scale('); // échelle ∝ profondeur
    expect(html.length).toBeGreaterThan(200); // le tonneau (SVG iso) est bien là
  });

  it('un PROP hors de `visible` ou au-delà de la portée est droppé (même mécanisme que les personnages)', () => {
    const hidden = makeScene([{ id: 'crate', kind: 'prop', pos: { x: 5, y: 9 }, ref: 'tonneau' }]);
    const h1 = renderToStaticMarkup(<PovBillboards scene={hidden} cam={cam} visible={new Set()} />);
    expect(h1).toBe('<g class="pov-billboards"></g>');
    // Portée = 32 cases × 2 m = 64 m ; prop à y=40 → depth = (40−5)·2 = 70 m > 64 → droppé.
    const far = makeScene([{ id: 'crate', kind: 'prop', pos: { x: 5, y: 40 }, ref: 'tonneau' }]);
    const h2 = renderToStaticMarkup(<PovBillboards scene={far} cam={cam} visible={new Set(['5,40,0'])} />);
    expect(h2).toBe('<g class="pov-billboards"></g>');
  });

  it('FONDU atmosphérique : un prop LOINTAIN (mais en portée) se rend délavé (opacity < 1), pas absent', () => {
    const misty = makeScene([{ id: 'crate', kind: 'prop', pos: { x: 5, y: 25 }, ref: 'tonneau' }]); // 20 cases
    const html = renderToStaticMarkup(<PovBillboards scene={misty} cam={cam} visible={new Set(['5,25,0'])} />);
    const m = html.match(/opacity="(0\.\d+)"/);
    expect(m).not.toBeNull(); // présent ET délavé
    expect(Number(m![1])).toBeLessThan(1);
    expect(Number(m![1])).toBeGreaterThan(0);
    // Un prop PROCHE reste plein (pas d'attribut opacity).
    const near = makeScene([{ id: 'crate', kind: 'prop', pos: { x: 5, y: 8 }, ref: 'tonneau' }]);
    const h2 = renderToStaticMarkup(<PovBillboards scene={near} cam={cam} visible={new Set(['5,8,0'])} />);
    expect(h2).not.toContain('opacity=');
  });

  it('une CRÉATURE non-humanoïde SANS idlePose (quadrupède) se rend en pose de repos figée (os du plan)', () => {
    const scene = makeScene([
      { id: 'loup', kind: 'personnage', pos: { x: 5, y: 9 }, facing: 'N', ref: 'loup', appearance: { species: 'loup' } },
    ]);
    const html = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={new Set(['5,9,0'])} />);
    expect(html).toContain('data-bone'); // os du gabarit (quadrupède)
    expect(html).not.toContain('class="rig"'); // PAS le rig bipède
  });

  it('une CRÉATURE ailée (idlePose) rend sa pose de repos INITIALE (phase 0) sous SSR — bones présents, rendu DÉTERMINISTE', () => {
    // Le griffon est un gabarit ailé (`plan.idlePose` = frémissement d'ailes). En jeu son sous-arbre
    // s'anime par frame (rAF isolé `usePovIdle`) ; sous `renderToStaticMarkup` l'horloge reste FIGÉE à 0
    // → phase 0 (pose de repos), aucun rAF → deux rendus IDENTIQUES (ni non-déterminisme, ni statique cassé).
    const scene = makeScene([
      { id: 'grif', kind: 'personnage', pos: { x: 5, y: 9 }, facing: 'N', ref: 'griffon', appearance: { species: 'griffon' } },
    ]);
    const visible = new Set(['5,9,0']);
    const h1 = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={visible} />);
    const h2 = renderToStaticMarkup(<PovBillboards scene={scene} cam={cam} visible={visible} />);
    expect(h1).toContain('data-bone'); // os du gabarit ailé (rendu même à phase 0)
    expect(h1).not.toContain('class="rig"'); // PAS le rig bipède
    expect(h1).toBe(h2); // rAF gelé en SSR → phase 0 stable (pas de dérive entre deux rendus)
  });

  it('CULL de distance : une entité au-delà de la portée est droppée ; à 20 cases elle est PRÉSENTE (délavée)', () => {
    // Portée extérieure = 32 cases × 2 m/case = 64 m ; entité à y=40 → depth = (40−5)·2 = 70 m → droppée.
    const far = makeScene([npc('loin', 5, 40)]);
    const html = renderToStaticMarkup(<PovBillboards scene={far} cam={cam} visible={new Set(['5,40,0'])} />);
    expect(html).not.toContain('data-bone');
    // À 20 cases (40 m) : petite silhouette délavée, PAS une absence — la profondeur se peuple.
    const mid = makeScene([npc('brume', 5, 25)]);
    const h2 = renderToStaticMarkup(<PovBillboards scene={mid} cam={cam} visible={new Set(['5,25,0'])} />);
    expect(h2).toContain('data-bone');
    expect(h2).toMatch(/opacity="0\.\d+"/);
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
