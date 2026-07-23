import { P } from '../decorPalette';

/**
 * Ébénisterie partagée du décor — le TRACÉ commun de l'escalier et de la balustrade de bois, moissonné
 * des defs `escalier-loge`/`balustrade-loge` pour mutualiser l'invariant (credo). Ce fichier vit HORS de
 * `defs/` : il n'est PAS scanné par le registre (aucun `export const prop`). Chaque def appelle une de ces
 * fonctions pures en injectant ses tons : la variante loge passe des dorures (or + velours), la variante
 * générique reste en bois nu — même géométrie, matériau distinct. Canvas local 120×150, ancré aux pieds
 * (~y=147). Les tons de MARCHES/CORPS restent fixes (le bois), seuls rampe/pommeaux/tenture varient.
 */

/** Volée de marches (1×1) montant vers l'arrière (haut-gauche) + rampe et pommeaux dans les tons fournis. */
export function woodStairSvg(opts: { railColor: string; knobColor: string }): string {
  const { railColor, knobColor } = opts;
  return (
    `<g><ellipse cx="60" cy="147" rx="46" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const w = 84 - i * 6;
        const x = 20 + i * 3;
        const y = 134 - i * 16;
        return (
          `<rect x="${x}" y="${y}" width="${w}" height="16" rx="2" fill="${P.boisFonce12}"/>` + // contremarche (face avant, sombre)
          `<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="7" rx="2" fill="${P.boisFonce8}"/>` + // nez de marche (clair)
          `<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="2" fill="${P.boisMoyen3}"/>` // reflet
        );
      })
      .join('') +
    `<path d="M16 140 L34 52" stroke="${railColor}" stroke-width="3" fill="none"/>` + // rampe
    `<g fill="${knobColor}"><circle cx="16" cy="140" r="3.4"/><circle cx="34" cy="52" r="3.8"/></g></g>`
  );
}

/** Garde-corps (3×1) : balustres à pommeaux + main courante dans les tons fournis. `tenture` optionnelle
 *  ajoute le velours festonné à clous de la loge. `knobHi` = liseré clair de la main courante (défaut =
 *  `knobColor`, donc aucun reflet visible sur un bois sobre ; la loge y passe son reflet doré).
 *  `balusterColor` = ton des fuseaux (défaut `railColor`, la loge garde ses fuseaux dorés) ; `balusterBottom`
 *  = y du bas des fuseaux (défaut 108). `endPosts` (générique bois) ajoute deux MONTANTS D'ABOUT plus hauts
 *  et plus épais aux extrémités + une lisse basse qui relie les fuseaux : le garde-corps est TENU par ses
 *  poteaux (lecture « rambarde de galerie ») au lieu de lire comme un peigne. Toutes ces options sont NON
 *  fournies par la loge → sa sortie reste identique octet pour octet. */
export function woodBalustradeSvg(opts: {
  railColor: string;
  knobColor: string;
  knobHi?: string;
  balusterColor?: string;
  balusterBottom?: number;
  endPosts?: boolean;
  tenture?: { cloth: string; stud: string };
}): string {
  const { railColor, knobColor, tenture, endPosts } = opts;
  const knobHi = opts.knobHi ?? knobColor;
  const balusterColor = opts.balusterColor ?? railColor;
  const balBottom = opts.balusterBottom ?? 108;
  const post = (cx: number) =>
    `<rect x="${cx - 5}" y="80" width="10" height="46" rx="3" fill="${knobColor}"/>` + // montant d'about épais
    `<rect x="${cx - 5}" y="80" width="10" height="3" rx="1.5" fill="${balusterColor}"/>` + // arête claire du fût
    `<circle cx="${cx}" cy="78" r="5.5" fill="${knobColor}"/>` + // pommeau de tête
    `<circle cx="${cx}" cy="76.5" r="2" fill="${balusterColor}"/>`; // reflet du pommeau
  return (
    `<g><ellipse cx="60" cy="147" rx="54" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    (tenture
      ? `<path d="M8 104 Q23 130 38 108 Q53 130 68 108 Q83 130 98 108 Q108 122 112 110 L112 140 L8 140 Z" fill="${tenture.cloth}"/>` +
        `<path d="M8 104 Q23 130 38 108 Q53 130 68 108 Q83 130 98 108 Q108 122 112 110" stroke="${railColor}" stroke-width="2.5" fill="none"/>` +
        `<g fill="${tenture.stud}"><circle cx="23" cy="123" r="2.6"/><circle cx="53" cy="123" r="2.6"/><circle cx="83" cy="123" r="2.6"/></g>`
      : '') +
    [16, 33, 50, 67, 84, 101]
      .map((x) => `<rect x="${x - 2.5}" y="92" width="5" height="${balBottom - 92}" rx="2" fill="${balusterColor}"/><circle cx="${x}" cy="92" r="4" fill="${knobColor}"/>`)
      .join('') +
    (endPosts
      ? `<rect x="7" y="115" width="106" height="7" rx="3" fill="${knobColor}"/><rect x="7" y="115" width="106" height="2" rx="1" fill="${balusterColor}"/>` // lisse basse qui relie les fuseaux
      : '') +
    `<rect x="6" y="84" width="108" height="9" rx="4" fill="${knobColor}"/><rect x="6" y="84" width="108" height="3" rx="1" fill="${knobHi}"/>` +
    (endPosts ? post(10.5) + post(109.5) : '') +
    `</g>`
  );
}
