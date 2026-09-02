/**
 * Contrats NEUTRES du décor : type de prop app-owned (`props.json`), recette VOLUMIQUE locale, matériaux
 * et places assises. Vivent hors de `src/data/index.ts` pour rester importables par `src/state` comme par
 * `src/gameIso` sans traverser le chargeur app-owned. PUR — aucune donnée, aucune caméra, aucun rendu.
 *
 * Repère LOCAL d'une recette : origine à l'ANCRE du décor, `x`/`y` en cases, `h` en mètres depuis le
 * pied de l'ancrage. L'ancre est le point MONDE que le builder déclare (`AncrageDecor`,
 * `gameIso/builders/props.ts`) : le CENTRE de l'empreinte pour un décor d'entité (donc le centre de sa
 * case quand elle est 1×1, le milieu du bloc au-delà), le point fractionnaire de l'arête pour une
 * feature de façade, le milieu de l'empreinte pour un ornement de faîte. L'orientation vient du cap
 * déclaré (`SceneEntity.facing` pour un décor posé).
 *
 * ÉCART OUVERT sur les places assises : `state/seating.ts` ancre les `seatSlots` sur `SceneEntity.pos`
 * (le coin NO), le builder pose la recette sur le CENTRE de l'empreinte. Les deux coïncident sur un
 * meuble 1×1 ; au-delà, ils divergent d'un demi-pas par axe étendu — le catalogue porte désormais un
 * meuble 2×1 à recette (`table-2x1`, #1644). Résolution au socle #1509 (le corps tourné décide des
 * cases) ; en attendant, aucun meuble multi-case ne déclare de place.
 *
 * TROU DE LA MÊME FAMILLE, tant que #1509 n'est pas construit : la recette TOURNE avec le cap, pas
 * l'empreinte (`propFootTiles` ignore `facing`). Un meuble multi-case au cap E/O présente donc sa
 * géométrie en travers de cases qui restent traversables, et bloque des cases vides. La population
 * authorée est tenue aux caps N/S par un contrat de `gameIso/catalog/props-volumiques.test.ts`.
 *
 * CAP D'IDENTITÉ = `N` — contrat de DONNÉE, à connaître pour authorer : une recette (et les
 * `seatSlots` qui l'accompagnent) s'écrit FACE AU NORD, front vers `y` négatif, et c'est à ce cap
 * seul qu'elle sort telle qu'authorée. Les sept autres caps la tournent de 45° par cran, en sens
 * horaire (l'ordre de `DIR8_ORDER`).
 *
 * PIÈGE QUI EN DÉCOULE : une instance de scène SANS `facing` vaut `S` (le défaut canonique du monde),
 * donc un DEMI-TOUR par rapport à la recette. Un meuble à dos (comptoir, âtre, lit) placé sans cap
 * explicite présente donc son dos là où l'auteur a dessiné sa face : l'auteur pose le cap, il ne le
 * laisse pas au défaut. Matérialisé par `builders/propVolumes.test.ts`.
 */
import { DIR8_ORDER, estCardinal, type Dir4, type Dir8 } from '../state/dir8';

/**
 * Le CAP d'un décor volumique, résolu et VERROUILLÉ. Une entité sans `facing` vaut `S` : c'est le
 * défaut du monde, pas une vertu — une recette s'authore au cap `N` (cf. l'en-tête de ce module), si
 * bien qu'un décor posé sans cap explicite présente son DOS. L'écart est traité par #1680 ligne 16.
 * Ce que cette porte verrouille, c'est la DIAGONALE, refusée nominativement : la recette tourne là où
 * l'empreinte solide ne tourne pas (#1509), une diagonale poserait le corps en travers de cases restées
 * traversables. Dernier filet d'une chaîne : le schéma de scène la refuse au parse
 * (`schemas/defs-scenes/scene.ts`), l'éditeur ne l'offre pas (`ui/editor/Inspector.tsx`) et
 * `state/validateScene.ts` la nomme à l'écran. PURE.
 */
export function capVolumique(facing: Dir8 | undefined, quoi: string): Dir4 {
  const cap = facing ?? 'S';
  if (!estCardinal(cap)) throw new Error(`${quoi} : cap ${cap} — un décor volumique ne prend qu'un cap cardinal (N/E/S/O)`);
  return cap;
}

/**
 * Rotation d'un point du repère LOCAL d'une recette vers le repère de la scène, au cap d'auteur —
 * l'UNIQUE définition de ce que `SceneEntity.facing` fait subir à une géométrie de décor (volumes,
 * ancres de place, cases d'abord). Vit ici, à l'étage NEUTRE, pour être servie aussi bien au
 * builder volumique (`gameIso`) qu'à la résolution d'assise (`state`) : deux copies divergeraient.
 * `N` (index 0 de `DIR8_ORDER`) est l'identité ; chaque cran vaut 45° horaires. PURE.
 */
export function rotatePropLocal(x: number, y: number, facing: Dir8): [number, number] {
  const a = DIR8_ORDER.indexOf(facing) * Math.PI / 4;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

/**
 * Ref de décor par DÉFAUT du monde : ce qu'une entité `kind:'prop'` dessine quand elle ne nomme pas son
 * type. Vit ici, à l'étage NEUTRE, parce que ses lecteurs sont des deux côtés de la frontière des
 * schémas : le CATALOGUE (`data/index.ts`, `refEstVolumique`) et le SCHÉMA de scène
 * (`schemas/defs-scenes/scene.ts`) — or `data/index.ts` importe les schémas, l'inverse est impossible.
 * Lue aussi par le rendu (`gameIso/builders/props.ts`, `backends/webgl/sceneMeshes.ts`), le validateur
 * (`state/validateScene.ts`) et l'éditeur : une seule valeur, jamais huit littéraux.
 */
export const REF_DECOR_DEFAUT = 'tonneau';

/**
 * LE CAP DE CE DÉCOR EST-IL ADMIS ? Règle de décor, écrite UNE fois : un décor dont le type porte une
 * recette volumique ne prend qu'un cap CARDINAL (#1680 ligne 3) ; un billboard prend les huit, et une
 * entité sans cap n'en discute pas. Vit ici parce que ses deux lecteurs sont de part et d'autre de la
 * frontière des schémas — le SCHÉMA de scène (`schemas/defs-scenes/scene.ts`, refus au parse) et le
 * VALIDATEUR (`state/validateScene.ts`, signalement à l'éditeur) — et que `src/data` ne peut pas
 * dépendre de `src/state` (règle 3, #421 ; ce module est la seule couture tracée, #1506). PURE.
 */
export const capDecorAdmis = (estVolumique: boolean, facing: Dir8 | undefined): boolean =>
  !estVolumique || !facing || estCardinal(facing);

/** Id d'un matériau de `propMaterials.json`. */
export type PropMaterialId = string;

/** Point du repère local d'une recette (cases en x/y, mètres en h). */
export interface PropPoint3 { x: number; y: number; h: number }
/** Dimensions dans le repère local d'une recette (cases en x/y, mètres en h). */
export interface PropSize3 { x: number; y: number; h: number }

/** Côtés admis d'un cylindre. 12 est EXCLU : ses faces latérales tombent sur l'arête de couteau du
 *  modelé de forme (4 normales à ±45°, `backends/webgl/sceneMeshes:shadeFamily` départage alors des
 *  familles de 4/3/3/2 au lieu de 3/3/3/3) — un fût de la même recette y prend deux tons de trop. */
export type PropCylinderSides = 8 | 16;
export const PROP_CYLINDER_SIDES: readonly PropCylinderSides[] = [8, 16];

/** Volume élémentaire d'une recette : caisse droite, cylindre à N faces, ou prisme en pente. */
export type PropPrimitive =
  | { kind: 'box'; center: PropPoint3; size: PropSize3; material: PropMaterialId }
  | { kind: 'cylinder'; center: PropPoint3; radius: number; heightM: number; sides: PropCylinderSides; material: PropMaterialId }
  | { kind: 'prism'; center: PropPoint3; size: PropSize3; slope: 'x+' | 'x-' | 'y+' | 'y-'; material: PropMaterialId };

/** Recette volumique d'un prop : la liste de ses primitives, dans le repère local. */
export interface PropVolumeRecipe { primitives: PropPrimitive[] }

// ————————————————————————————————————————————————————————————————
// GÉOMÉTRIE LOCALE d'une primitive — UNE définition, deux consommateurs
// ————————————————————————————————————————————————————————————————
// Vit ici, à l'étage NEUTRE, pour la même raison que `rotatePropLocal` : le builder volumique
// (`gameIso/builders/propVolumes.ts`, qui la tourne et la pose dans le monde) et le validateur de
// catalogue (`validatePropCatalog`, plus bas, qui vérifie la fermeture de la coquille) lisent les
// MÊMES polygones. Deux copies divergeraient, et le contrat de fermeture ne prouverait plus rien
// sur ce qui est réellement cuit.

/** Normale (non unitaire) d'un polygone local, en convention three (X = est, Y = haut, Z = sud) — Newell. */
function normale(poly: readonly PropPoint3[]): PropPoint3 {
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    nx += (a.h - b.h) * (a.y + b.y);
    ny += (a.y - b.y) * (a.x + b.x);
    nz += (a.x - b.x) * (a.h + b.h);
  }
  return { x: nx, y: ny, h: nz };
}

/** Barycentre des sommets d'une primitive : un point STRICTEMENT INTÉRIEUR à son volume, quelle que
 *  soit sa forme — le référent du dehors. Le centre de la BOÎTE n'en est pas un : pour un prisme, il
 *  tombe exactement dans le plan du rampant (mi-hauteur à mi-pente), et le produit scalaire d'une face
 *  passant par son propre référent ne décide plus rien. */
function barycentre(polys: readonly (readonly PropPoint3[])[]): PropPoint3 {
  let n = 0;
  const s = { x: 0, y: 0, h: 0 };
  for (const poly of polys) for (const p of poly) { s.x += p.x; s.y += p.y; s.h += p.h; n++; }
  return { x: s.x / n, y: s.y / n, h: s.h / n };
}

/** Le polygone, tourné vers le DEHORS du point intérieur fourni (sens de parcours inversé s'il regardait
 *  dedans). */
function versLeDehors(poly: PropPoint3[], dedans: PropPoint3): PropPoint3[] {
  const n = normale(poly);
  const c = poly.reduce((acc, p) => ({ x: acc.x + p.x / poly.length, y: acc.y + p.y / poly.length, h: acc.h + p.h / poly.length }), { x: 0, y: 0, h: 0 });
  // Produit scalaire en convention three : (X, Y, Z) = (x, h, y).
  const dehors = n.x * (c.x - dedans.x) + n.y * (c.h - dedans.h) + n.h * (c.y - dedans.y);
  return dehors >= 0 ? poly : [...poly].reverse();
}

/** Les six faces d'une caisse droite, dans l'ordre −x, +x, −y, +y, bas, haut. */
function facesBoite(centre: PropPoint3, size: PropSize3): PropPoint3[][] {
  const x0 = centre.x - size.x / 2, x1 = centre.x + size.x / 2;
  const y0 = centre.y - size.y / 2, y1 = centre.y + size.y / 2;
  const h0 = centre.h - size.h / 2, h1 = centre.h + size.h / 2;
  const s = (x: number, y: number, h: number): PropPoint3 => ({ x, y, h });
  return [
    [s(x0, y0, h0), s(x0, y1, h0), s(x0, y1, h1), s(x0, y0, h1)],
    [s(x1, y0, h0), s(x1, y1, h0), s(x1, y1, h1), s(x1, y0, h1)],
    [s(x0, y0, h0), s(x1, y0, h0), s(x1, y0, h1), s(x0, y0, h1)],
    [s(x0, y1, h0), s(x1, y1, h0), s(x1, y1, h1), s(x0, y1, h1)],
    [s(x0, y0, h0), s(x1, y0, h0), s(x1, y1, h0), s(x0, y1, h0)],
    [s(x0, y0, h1), s(x1, y0, h1), s(x1, y1, h1), s(x0, y1, h1)],
  ];
}

/** Les `sides` faces latérales d'un cylindre, plus son dessus et son dessous. */
function facesCylindre(centre: PropPoint3, radius: number, heightM: number, sides: number): PropPoint3[][] {
  const h0 = centre.h - heightM / 2, h1 = centre.h + heightM / 2;
  const anneau = Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * 2 * Math.PI;
    return { x: centre.x + radius * Math.cos(a), y: centre.y + radius * Math.sin(a) };
  });
  const out: PropPoint3[][] = [];
  for (let k = 0; k < sides; k++) {
    const a = anneau[k];
    const b = anneau[(k + 1) % sides];
    out.push([{ ...a, h: h0 }, { ...b, h: h0 }, { ...b, h: h1 }, { ...a, h: h1 }]);
  }
  out.push(anneau.map((p) => ({ ...p, h: h0 })));
  out.push(anneau.map((p) => ({ ...p, h: h1 })));
  return out;
}

/** Arête BASSE d'un prisme selon sa pente : la pente DESCEND vers ce côté, l'arête opposée porte la hauteur pleine. */
const BAS_DE_PENTE: Record<'x+' | 'x-' | 'y+' | 'y-', (p: { x: number; y: number }) => boolean> = {
  'x+': (p) => p.x > 0,
  'x-': (p) => p.x < 0,
  'y+': (p) => p.y > 0,
  'y-': (p) => p.y < 0,
};

/** Les cinq faces d'un prisme : semelle, rampant, dosseret vertical du haut de pente, deux joues triangulaires. */
function facesPrisme(centre: PropPoint3, size: PropSize3, slope: 'x+' | 'x-' | 'y+' | 'y-'): PropPoint3[][] {
  const dx = size.x / 2, dy = size.y / 2;
  const h0 = centre.h - size.h / 2, h1 = centre.h + size.h / 2;
  const bas = BAS_DE_PENTE[slope];
  // Les quatre coins de la semelle, en tour, plus la hauteur de crête que chacun porte.
  const coins = [
    { x: -dx, y: -dy }, { x: dx, y: -dy }, { x: dx, y: dy }, { x: -dx, y: dy },
  ].map((c) => ({ x: centre.x + c.x, y: centre.y + c.y, crete: bas(c) ? h0 : h1 }));
  const semelle = coins.map((c) => ({ x: c.x, y: c.y, h: h0 }));
  const rampant = coins.map((c) => ({ x: c.x, y: c.y, h: c.crete }));
  const hauts = coins.filter((c) => c.crete === h1);
  const dosseret = [
    { x: hauts[0].x, y: hauts[0].y, h: h0 },
    { x: hauts[1].x, y: hauts[1].y, h: h0 },
    { x: hauts[1].x, y: hauts[1].y, h: h1 },
    { x: hauts[0].x, y: hauts[0].y, h: h1 },
  ];
  const joues = [0, 1].map((k) => {
    const haut = hauts[k];
    const bas0 = coins.find((c) => c.crete === h0 && (c.x === haut.x || c.y === haut.y))!;
    return [
      { x: haut.x, y: haut.y, h: h0 },
      { x: bas0.x, y: bas0.y, h: h0 },
      { x: haut.x, y: haut.y, h: h1 },
    ];
  });
  return [semelle, rampant, dosseret, ...joues];
}

/**
 * Les polygones LOCAUX d'une primitive, chacun tourné vers le DEHORS par le barycentre de la primitive
 * — une seule définition du dehors pour les trois formes, et la SEULE géométrie que le catalogue
 * possède. Le builder les tourne au cap et les pose dans le monde sans rien y ajouter ; le validateur y
 * vérifie la fermeture de la coquille. PURE.
 */
export function polygonesDePrimitive(p: PropPrimitive): PropPoint3[][] {
  const brutes = p.kind === 'box' ? facesBoite(p.center, p.size)
    : p.kind === 'cylinder' ? facesCylindre(p.center, p.radius, p.heightM, p.sides)
      : facesPrisme(p.center, p.size, p.slope);
  const dedans = barycentre(brutes);
  return brutes.map((poly) => versLeDehors(poly, dedans));
}

/** Clé d'un sommet local, arrondie au nanomètre — deux sommets calculés par des chemins différents
 *  (coin partagé de deux faces) doivent porter la MÊME clé. `+ 0` normalise le zéro négatif. */
const cléSommet = (p: PropPoint3): string =>
  `${Math.round(p.x * 1e9) / 1e9 + 0},${Math.round(p.y * 1e9) / 1e9 + 0},${Math.round(p.h * 1e9) / 1e9 + 0}`;

/**
 * ARÊTES NON APPARIÉES d'un jeu de polygones — le défaut de FERMETURE, nommé. Une COQUILLE CLOSE porte
 * chaque arête par EXACTEMENT deux faces, parcourues en sens OPPOSÉS (a→b sur l'une, b→a sur l'autre) :
 * c'est ce qui rend le volume étanche ET son orientation cohérente. Rend la liste des arêtes fautives
 * (clé `sommet→sommet` et le compte des deux sens), `[]` = coquille close.
 * Prend des POLYGONES, pas une primitive : le même contrat se mesure sur la géométrie LOCALE du
 * catalogue (`polygonesDePrimitive`) comme sur les faces MONDE que le builder en tire — la
 * transformation rigide du cap et de l'ancre doit le préserver. PURE.
 */
export function aretesNonAppariees(polys: readonly (readonly PropPoint3[])[]): { arete: string; sens: number; contreSens: number }[] {
  const compte = new Map<string, number>();
  for (const poly of polys)
    for (let i = 0; i < poly.length; i++) {
      const a = cléSommet(poly[i]);
      const b = cléSommet(poly[(i + 1) % poly.length]);
      const k = `${a}→${b}`;
      compte.set(k, (compte.get(k) ?? 0) + 1);
    }
  const out: { arete: string; sens: number; contreSens: number }[] = [];
  for (const [k, n] of compte) {
    const [a, b] = k.split('→');
    const inverse = compte.get(`${b}→${a}`) ?? 0;
    if (n !== 1 || inverse !== 1) out.push({ arete: k, sens: n, contreSens: inverse });
  }
  return out.sort((x, y) => (x.arete < y.arete ? -1 : x.arete > y.arete ? 1 : 0));
}

/** Place assise offerte par un prop : ancre du corps, cap du corps assis, et case d'ABORD (relative à
 *  l'ancre de l'empreinte) depuis laquelle on rejoint la place.
 *  `id` : préfixé `place-` — il entre dans l'index GLOBAL des ids de la donnée authorée
 *  (`scripts/docs/lib/structures-scan.mts`), où un mot commun (`nord`) résoudrait depuis un autre
 *  dataset. Il reste keyé sous son meuble dans `Scene.seatAssignments` (`propId → slotId`). */
export interface PropSeatSlot { id: string; anchor: PropPoint3; facing: Dir8; approach: { x: number; y: number } }

/** Matériau de rendu d'une primitive : couleur de base + réponse à la lumière. Aucune émission — une
 *  source lumineuse est un `light` de prop/d'instance, jamais un matériau. */
export interface PropMaterialData { id: string; type: 'propMaterials'; label: string; color: string; roughness: number; metalness: number }

/**
 * Type de PROP/décor app-owned : couche SÉMANTIQUE (physique `solid`, opacité `opaque`, classe de
 * `cover`, émission de lumière `light`, empreinte `foot`) ET géométrie locale (`volume`, `seatSlots`) —
 * le rendu SVG de vignette reste au catalogue gameIso. Vérité UNIQUE des dimensions d'un
 * décor : une instance de scène ne redéclare aucune empreinte. Lu par la walkability (`sceneRules`), la
 * Ligne de Vue/couvert (`lineOfSight`), la lumière (`vision`) et le monde volumique. Édité au Codex.
 * Un prop ABSENT du dataset = passable, transparent, sans couvert, sans lumière et sans empreinte.
 */
export interface PropData {
  id: string;
  type: 'props';
  /** Nom d'auteur du décor. Miroir du `label` de la def d'ART du même id
   *  (`src/gameIso/catalog/decor/defs/<id>.ts`) — parité gardée par `src/data/props-label-parite.test.ts`. */
  label: string;
  solid?: boolean;
  opaque?: boolean;
  cover?: 'imparfaite' | 'moyenne' | 'totale';
  light?: { radiusTiles: number; tone?: string };
  foot?: { w: number; h: number };
  volume?: PropVolumeRecipe;
  seatSlots?: PropSeatSlot[];
}

/** Empreinte EFFECTIVE d'un type de prop — défaut 1×1. Source unique de la dérivation par les consommateurs. */
export const propFootOf = (prop: PropData | undefined): { w: number; h: number } => prop?.foot ?? { w: 1, h: 1 };

/** Anomalies d'UNE primitive : matériau connu, coordonnées finies, dimensions positives, côtés admis,
 *  et FERMETURE en coquille close. La fermeture n'est mesurée que sur une géométrie déjà non ambiguë —
 *  des dimensions folles n'ajouteraient qu'un bruit d'arêtes par-dessus leur propre diagnostic. */
function erreursDePrimitive(propId: string, primitive: PropPrimitive, materiauxConnus: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (!materiauxConnus.has(primitive.material)) errors.push(`${propId}: matériau inconnu « ${primitive.material} »`);
  const centre = [primitive.center.x, primitive.center.y, primitive.center.h];
  const dimensions = primitive.kind === 'cylinder'
    ? [primitive.radius, primitive.heightM]
    : [primitive.size.x, primitive.size.y, primitive.size.h];
  const fini = [...centre, ...dimensions].every((n) => Number.isFinite(n));
  const positif = dimensions.every((n) => !Number.isFinite(n) || n > 0);
  // Le JSON n'est pas typé à l'EXÉCUTION : l'union `PropCylinderSides` se re-vérifie ici.
  const côtésAdmis = primitive.kind !== 'cylinder' || PROP_CYLINDER_SIDES.includes(primitive.sides);
  if (!fini) errors.push(`${propId}: coordonnée non finie`);
  if (!positif) errors.push(`${propId}: dimension non positive`);
  if (!côtésAdmis) errors.push(`${propId}: cylindre à ${(primitive as { sides: number }).sides} côtés (admis : ${PROP_CYLINDER_SIDES.join(' ou ')})`);
  if (fini && positif && côtésAdmis)
    for (const { arete, sens, contreSens } of aretesNonAppariees(polygonesDePrimitive(primitive)))
      errors.push(`${propId}: primitive ${primitive.kind} « ${primitive.material} » — arête non appariée ${arete} (${sens} dans le sens, ${contreSens} à contre-sens)`);
  return errors;
}

/**
 * Invariants de CATALOGUE que le schéma seul ne peut pas voir (référence croisée aux matériaux, cohérence
 * géométrique, FERMETURE de chaque primitive en coquille close, côtés admis d'un cylindre, unicité des
 * places). Renvoie la liste des anomalies en français, `[]` = catalogue intègre.
 */
export function validatePropCatalog(entries: readonly PropData[], materials: readonly PropMaterialData[]): string[] {
  const known = new Set(materials.map((m) => m.id));
  const errors: string[] = [];
  for (const prop of entries) {
    const slots = new Set<string>();
    const approaches = new Set<string>();
    for (const primitive of prop.volume?.primitives ?? []) errors.push(...erreursDePrimitive(prop.id, primitive, known));
    const { w, h } = propFootOf(prop);
    for (const slot of prop.seatSlots ?? []) {
      if (!slot.id.trim()) errors.push(`${prop.id}: slot sans id`);
      else if (slots.has(slot.id)) errors.push(`${prop.id}: slot dupliqué « ${slot.id} »`);
      slots.add(slot.id);
      const key = `${slot.approach.x},${slot.approach.y}`;
      if (approaches.has(key)) errors.push(`${prop.id}: approche dupliquée (${key})`);
      approaches.add(key);
      const dansEmpreinte = slot.approach.x >= -0.5 && slot.approach.x <= w - 0.5
        && slot.approach.y >= -0.5 && slot.approach.y <= h - 0.5;
      if (prop.solid && dansEmpreinte) errors.push(`${prop.id}: approche « ${slot.id} » dans l’empreinte (${key})`);
    }
  }
  return errors;
}
