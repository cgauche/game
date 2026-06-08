import { BONE_IDS, type BoneId, type Bone, type Skeleton } from './bones';
import { worldTransforms, apply } from './kinematics';
import { gabaritById, type GabaritDef } from './gabarits';

function mk(spec: Record<BoneId, Omit<Bone, 'id'>>): Skeleton {
  const sk = {} as Skeleton;
  for (const id of BONE_IDS) sk[id] = { id, ...spec[id] };
  return sk;
}

/** Squelette HUMAIN mâle de référence (boîte 120×150, pieds ~y=150). Point de départ. */
const HUMAIN_M: Skeleton = mk({
  bassin:     { parent: null,         pivot: { x: 60, y: 96 },  length: 0,  thickness: 18, angle: 0,  z: 5 },
  torse:      { parent: 'bassin',     pivot: { x: 0,  y: -2 },  length: 34, thickness: 20, angle: 0,  z: 5 },
  cou:        { parent: 'torse',      pivot: { x: 0,  y: -34 }, length: 6,  thickness: 6,  angle: 0,  z: 6 },
  tete:       { parent: 'cou',        pivot: { x: 0,  y: -6 },  length: 14, thickness: 14, angle: 0,  z: 7 },
  epauleG:    { parent: 'torse',      pivot: { x: -14, y: -26 }, length: 18, thickness: 7, angle: 8,  z: 4 },
  avantBrasG: { parent: 'epauleG',    pivot: { x: 0,  y: 18 },  length: 18, thickness: 6,  angle: 5,  z: 4 },
  mainG:      { parent: 'avantBrasG', pivot: { x: 0,  y: 18 },  length: 6,  thickness: 6,  angle: 0,  z: 4 },
  epauleD:    { parent: 'torse',      pivot: { x: 14, y: -26 }, length: 18, thickness: 7,  angle: -8, z: 8 },
  avantBrasD: { parent: 'epauleD',    pivot: { x: 0,  y: 18 },  length: 18, thickness: 6,  angle: -5, z: 8 },
  mainD:      { parent: 'avantBrasD', pivot: { x: 0,  y: 18 },  length: 6,  thickness: 6,  angle: 0,  z: 8 },
  cuisseG:    { parent: 'bassin',     pivot: { x: -9, y: 4 },   length: 26, thickness: 9,  angle: 4,  z: 3 },
  tibiaG:     { parent: 'cuisseG',    pivot: { x: 0,  y: 26 },  length: 24, thickness: 7,  angle: 2,  z: 3 },
  piedG:      { parent: 'tibiaG',     pivot: { x: 0,  y: 24 },  length: 10, thickness: 6,  angle: 0,  z: 3 },
  cuisseD:    { parent: 'bassin',     pivot: { x: 9,  y: 4 },   length: 26, thickness: 9,  angle: -4, z: 6 },
  tibiaD:     { parent: 'cuisseD',    pivot: { x: 0,  y: 26 },  length: 24, thickness: 7,  angle: -2, z: 6 },
  piedD:      { parent: 'tibiaD',     pivot: { x: 0,  y: 24 },  length: 10, thickness: 6,  angle: 0,  z: 6 },
  arme:       { parent: 'mainD',      pivot: { x: 0,  y: 4 },   length: 0,  thickness: 0,  angle: 165, z: 9 },
  bouclier:   { parent: 'mainG',      pivot: { x: 0,  y: 4 },   length: 0,  thickness: 0,  angle: 0,  z: 4 },
});

/** Échelle (longueur sl, épaisseur st) appliquée à tout le squelette. Renvoie un nouvel objet. */
function scaleSkeleton(sk: Skeleton, sl: number, st: number): Skeleton {
  const out = {} as Skeleton;
  for (const id of BONE_IDS) {
    const b = sk[id];
    // La RACINE (bassin, parent null) est l'ANCRE ABSOLUE de la figure : son pivot.x = 60 est
    // l'axe de symétrie = centre de la boîte 120 large (le token ancre rig-x=60 sur la case).
    // Mettre ce x à l'échelle décentrerait toute la figure (Minotaure/Ogre st=1.7 → bassin à
    // x=102 → la silhouette débordait à droite de sa case). On garde donc le pivot.x de la
    // racine ; seuls les pivots des os ENFANTS (offsets RELATIFS : épaules ±14, hanches ±9)
    // s'échelonnent en x pour élargir la carrure.
    const isRoot = b.parent == null;
    out[id] = {
      ...b,
      pivot: { x: isRoot ? b.pivot.x : b.pivot.x * st, y: b.pivot.y * sl },
      length: b.length * sl,
      thickness: b.thickness * st,
    };
  }
  return out;
}

/** Variantes régionales → espèce de base. */
export function baseSpeciesOf(species: string): string {
  const s = species.toLowerCase();
  if (s.startsWith('haut')) return 'Haut-Elfe';
  if (s.includes('sylvain')) return 'Elfe sylvain';
  if (s.startsWith('elf')) return 'Elfe sylvain';
  if (s.startsWith('nain')) return 'Nain';
  if (s.startsWith('halfling')) return 'Halfling';
  if (s.startsWith('gnome')) return 'Gnome';
  if (s.startsWith('ogre')) return 'Ogre';
  if (s.startsWith('skaven')) return 'Skaven';
  // Phase B : familles monstrueuses bipèdes (carrure dédiée dans PROPS).
  if (s.startsWith('orc')) return 'Orc';
  if (s.startsWith('gobelin')) return 'Gobelin';
  if (s.startsWith('snotling')) return 'Snotling';
  if (s.startsWith('minotaure')) return 'Minotaure';
  if (s.startsWith('homme')) return 'Homme-bête';
  if (s.startsWith('squelette')) return 'Squelette';
  if (s.startsWith('zombie')) return 'Zombie';
  if (s.startsWith('goule')) return 'Goule';
  if (s.startsWith('troll')) return 'Troll';
  if (s.startsWith('vampire')) return 'Vampire';
  if (s.startsWith('démon') || s.startsWith('demon')) return 'Démon';
  if (s.startsWith('fimir')) return 'Ogre'; // brute hulking à œil unique → proportions d'ogre
  return 'Humain';
}


export function baseSkeleton(p: GabaritDef, sex: 'M' | 'F'): Skeleton {
  let sk = scaleSkeleton(HUMAIN_M, p.sl, p.st);
  // Jambes spécifiques (Nain/Halfling courtes, Elfe longues). On raccourcit la
  // LONGUEUR des os de jambe ET le pivot des joints enfants (tibia sur cuisse,
  // pied sur tibia) : dans le gabarit de réf, tibia.pivot.y == cuisse.length, etc.
  // Sans ça, le chaînage FK reste à la longueur d'origine → membres déconnectés
  // (la part dessinée est plus courte que l'écart des joints) ET pieds qui flottent
  // (la FK place le pied plus bas que la jambe réellement dessinée).
  if (p.legs !== 1) {
    for (const id of ['cuisseG', 'tibiaG', 'cuisseD', 'tibiaD'] as BoneId[])
      sk[id] = { ...sk[id], length: sk[id].length * p.legs };
    for (const id of ['tibiaG', 'tibiaD', 'piedG', 'piedD'] as BoneId[])
      sk[id] = { ...sk[id], pivot: { x: sk[id].pivot.x, y: sk[id].pivot.y * p.legs } };
  }
  // Bras allongés (ex. Troll, bras jusqu'au sol) — même logique que les jambes : longueur des
  // os + pivot des joints enfants (avant-bras sur épaule, main sur avant-bras).
  const arms = p.arms ?? 1;
  if (arms !== 1) {
    for (const id of ['epauleG', 'avantBrasG', 'epauleD', 'avantBrasD'] as BoneId[])
      sk[id] = { ...sk[id], length: sk[id].length * arms };
    for (const id of ['avantBrasG', 'avantBrasD', 'mainG', 'mainD'] as BoneId[])
      sk[id] = { ...sk[id], pivot: { x: sk[id].pivot.x, y: sk[id].pivot.y * arms } };
  }
  // Tête surdimensionnée (gremlins) : la PART tête se rend à l'échelle (thickness/réf,
  // length/réf) de l'os `tete` → on agrandit cet os pour une grosse tête sur petit corps.
  const head = p.head ?? 1;
  if (head !== 1) sk.tete = { ...sk.tete, length: sk.tete.length * head, thickness: sk.tete.thickness * head };
  if (sex === 'F') sk = feminize(sk);
  return sk;
}

/** Proportions féminines : épaules plus étroites, hanches un peu plus larges. */
function feminize(sk: Skeleton): Skeleton {
  const out = { ...sk };
  out.epauleG = { ...sk.epauleG, pivot: { x: sk.epauleG.pivot.x * 0.85, y: sk.epauleG.pivot.y } };
  out.epauleD = { ...sk.epauleD, pivot: { x: sk.epauleD.pivot.x * 0.85, y: sk.epauleD.pivot.y } };
  out.torse = { ...sk.torse, thickness: sk.torse.thickness * 0.92 };
  out.cuisseG = { ...sk.cuisseG, pivot: { x: sk.cuisseG.pivot.x * 1.08, y: sk.cuisseG.pivot.y } };
  out.cuisseD = { ...sk.cuisseD, pivot: { x: sk.cuisseD.pivot.x * 1.08, y: sk.cuisseD.pivot.y } };
  return out;
}

/**
 * Squelette de RÉFÉRENCE (humain M, build 0.5) — gabarit dont les parts SVG sont
 * dessinées. Le rendu échelonne chaque part par (thickness/réf, length/réf).
 */
let _ref: Skeleton | null = null;
export function referenceSkeleton(): Skeleton {
  if (!_ref) _ref = applyBuild(baseSkeleton(gabaritById('moyen'), 'M'), 0.5);
  return _ref;
}

/**
 * Ancre les PIEDS au sol (y=floorY) quelle que soit la taille de l'espèce. Le scaling
 * d'espèce déplace la racine (bassin) → sans ça, les petits (Nain/Gnome) flottent et
 * les grands (Ogre) débordent sous la boîte. On calcule la position réelle du pied en
 * FK (pose de repos) et on translate tout le squelette via le pivot du bassin.
 */
export function groundSkeleton(sk: Skeleton, floorY = 150): Skeleton {
  const world = worldTransforms(sk, {});
  const footY = Math.max(
    apply(world.piedG, { x: 0, y: sk.piedG.length }).y,
    apply(world.piedD, { x: 0, y: sk.piedD.length }).y,
  );
  const delta = floorY - footY;
  if (Math.abs(delta) < 0.01) return sk;
  return { ...sk, bassin: { ...sk.bassin, pivot: { x: sk.bassin.pivot.x, y: sk.bassin.pivot.y + delta } } };
}

/** Profil : rapproche épaules/hanches de l'AXE. Le pantin est de face (épaules à ±14) ;
 *  de profil le corps est étroit et les membres alignés sur la ligne médiane — sinon les
 *  bras « flottent » loin du torse étroit. Ne touche pas les y (pieds restent au sol). */
export function profileNarrow(sk: Skeleton): Skeleton {
  const out = { ...sk };
  const narrow = (id: BoneId, f: number) => {
    out[id] = { ...sk[id], pivot: { x: sk[id].pivot.x * f, y: sk[id].pivot.y } };
  };
  narrow('epauleG', 0.32);
  narrow('epauleD', 0.32);
  narrow('cuisseG', 0.38);
  narrow('cuisseD', 0.38);
  return out;
}

/** Morphologie continue : build 0..1 → épaississement (torse/membres). Pur, sans mutation. */
export function applyBuild(sk: Skeleton, build: number): Skeleton {
  const b = Math.max(0, Math.min(1, build));
  const k = 0.7 + b * 0.7; // 0.7..1.4
  const out = {} as Skeleton;
  for (const id of BONE_IDS)
    out[id] = { ...sk[id], thickness: sk[id].thickness * k, length: sk[id].length * (1 + (b - 0.5) * 0.05) };
  return out;
}
