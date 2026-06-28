import { itemFromTrappingById } from '../../engine/items';
import { Combatant } from '../../engine/types';
import { SceneEntity } from '../../state/scene';
import { parseAsciiRows } from '../../state/asciiMap';
import { darkSightTiles } from '../../state/vision';
import { makeShowcaseParty } from '../../data/pregens';
import { arena } from './_shared';
import type { TestScenario } from './_shared';

/**
 * Vitrine VISION & LUMIÈRE en TÉNÈBRES sur une GRANDE caverne (48×26) — c'est sur les grandes
 * distances que le brouillard prend son sens. Carte authorée en ASCII (`parseAsciiRows`) :
 *   `#` mur (opaque) · `.` sol · `@` départ · `B` brasero · `F` feu de camp · `L` lampadaire
 *   `C` chandelier · `r` créature tapie dans le noir.
 * Le groupe = `makeShowcaseParty()` (4 : Soldat humain · Tueur NAIN · Sorcier humain · Chasseur ELFE) :
 * Nain + Elfe ont la Vision nocturne (voient ~10 cases dans le noir) ; l'humain ne voit que les zones
 * éclairées et porte une LANTERNE (halo qui le suit) ; le Sorcier reçoit le sort LUMIÈRE. Les sources
 * posées créent des îlots de lumière séparés par l'obscurité ; les créatures hors-vue ne sont pas
 * dessinées tant qu'on ne les éclaire/approche pas.
 */
const MAP: string[] = [
  '################################################',
  '#@.....#..............B...........#............#',
  '#......#.................................L.....#',
  '#......#.............#............#............#',
  '#......#.............#............#......####..#',
  '#......#.............#............#......#..#..#',
  '#....................#............#......#..#..#',
  '#####.######.........#......C.....#......#..#..#',
  '#...........#........#............#...........r#',
  '#...........#........#............#............#',
  '#...B.......#........D............#....#######.#',
  '#...........#........#............#............#',
  '#...........#........#............#............#',
  '#####.#######........#......######D######......#',
  '#....................#............#............#',
  '#..........F.........#............#......C.....#',
  '#....................#............#............#',
  '#....................######.......#............#',
  '#..........................#......#............#',
  '#..........................#......#.....r......#',
  '#......r...................#......#............#',
  '#..........................#......#............#',
  '#.........B................#......#......B.....#',
  '#..........................D......#............#',
  '#..........................#......#............#',
  '################################################',
];

const W = 48, H = 26;
const MARKERS: Record<string, string> = { B: 'brasero', F: 'feu-camp', L: 'lampadaire', C: 'chandelier' };

const scene = arena({ id: 'test-vision-lumiere', nom: 'Vision & Lumière (ténèbres)', w: W, h: H, terrain: 'dalle' });
scene.ambiance = 'interieur';
scene.ambientLight = 'tenebres'; // noir total : seules la lumière et la vision nocturne révèlent

// ASCII → terrain (marqueurs traités comme sol) + collecte des positions de marqueurs.
const clean = MAP.map((r) => r.replace(/[@BFLCr]/g, '.'));
scene.levels[0].tiles = parseAsciiRows(clean, 'dalle', { '#': 'mur' }).tiles;

const lights: SceneEntity[] = [];
const creatures: { x: number; y: number }[] = [];
let start = { x: 1, y: 1 };
MAP.forEach((row, y) =>
  [...row].forEach((ch, x) => {
    if (ch === '@') start = { x, y };
    else if (ch === 'r') creatures.push({ x, y });
    else if (MARKERS[ch]) lights.push({ id: `light-${x}-${y}`, kind: 'prop', pos: { x, y }, ref: MARKERS[ch] });
  }),
);
scene.entities = [{ id: 'start', kind: 'heroStart', pos: start }, ...lights];
// Créatures tapies dans le noir : entités d'ambiance (rats géants) — coupées du rendu tant qu'on ne
// les voit pas (LdV + lumière / vision nocturne), réapparaissent quand on les éclaire ou s'en approche.
creatures.forEach((c, i) =>
  scene.entities.push({ id: `lurk-${i}`, kind: 'personnage', pos: c, ref: 'rat-geant', appearance: { species: 'Rat géant' } } as SceneEntity),
);

scene.startMessage =
  'Ténèbres totales sur une vaste caverne. Le Nain et l\'Elfe voient ~10 cases dans le noir ; l\'humain ne distingue que les îlots éclairés (brasero / feu / lampadaire / chandelier) et porte une lanterne (son halo le suit). Wilhelmina connaît le sort Lumière. Avancez : les murs coupent la vue au loin, et des créatures tapies n\'apparaissent qu\'une fois éclairées ou approchées.';

export const scenario: TestScenario = {
  id: 'vision-lumiere',
  order: 23,
  icon: '🕯️',
  title: 'Vision & Lumière (ténèbres)',
  tests:
    'Brouillard sur grande distance : occlusion par les murs, îlots de lumière (sources posées), lanterne portée (halo mobile), sort Lumière, Vision nocturne (Nain/Elfe), culling des créatures hors-vue.',
  partyNote: 'Groupe pré-tiré : humain (lanterne) + lanceuse (sort Lumière) + Nain & Elfe (vision nocturne)',
  makeParty: () => {
    // Le GROUPE DE 4 de l'arène (PAS le roster complet `makePregens`) : Soldat humain + Tueur Nain +
    // Sorcier humain + Chasseur Elfe → 2 à vision nocturne + 1 lanceur + 1 humain, pile la démo.
    const P = makeShowcaseParty();
    const caster = P.find((p) => (p.spells?.length ?? 0) > 0 && darkSightTiles(p) === 0) ?? P.find((p) => (p.spells?.length ?? 0) > 0);
    const human = P.find((p) => darkSightTiles(p) === 0 && p !== caster) ?? P[0];
    const lant = itemFromTrappingById('lanterne');
    if (lant) {
      lant.equipped = true; // PORTÉE (gate de lumière : un objet rangé n'éclaire pas)
      human.items = [...(human.items ?? []), lant];
    }
    if (caster) caster.spells = ['lumiere', ...(caster.spells ?? [])];
    return P;
  },
  scene,
};
