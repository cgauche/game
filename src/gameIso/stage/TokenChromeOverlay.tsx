/**
 * CHROME D'ÉCRAN des jetons du monde volumique (#1176, P3-0f) — barre de PV, icônes d'États,
 * pastille d'état de FIN, peintes AU-DESSUS du canevas, dans le SVG du stage.
 *
 * Pourquoi un OVERLAY et pas un quad texturé de plus : une barre de PV rasterisée dans le monde
 * mesure 1,7 px de haut à jeton de 40 px et scintille sans mipmaps ; un cache de texture par état de
 * PV fuit sur le GPU ; et la moindre clé de décoration dans l'identité des sujets remonterait tous
 * les billboards à chaque point de vie perdu. Le chrome est de l'INTERFACE : il vit à l'écran, à
 * taille constante, avec ses icônes du registre et ses `<title>` d'accessibilité.
 * Conséquence ENTÉRINÉE (juge vision 2026-08-13) : peint à l'écran, ce chrome garde sa LUMINANCE PLEINE
 * là où l'affine, dessiné dans la scène, s'assombrit avec elle — barre de PV mesurée ×2,75 plus claire.
 *
 * CADENCE : le rendu React donne son CONTENU (PV, États, état de fin), la BOUCLE DE MARCHE donne sa
 * POSITION. Les deux ne battent pas au même rythme, et c'est structurel : en volumique aucun rendu
 * React ne se produit entre deux pas (`fx/useWalkAnim`, `repaint = false`), si bien qu'un chrome posé
 * au seul rendu attendrait le marcheur sur sa case de départ pendant que son quad glisse. Le groupe de
 * chaque jeton porte donc une RÉF, et le battement de la marche y réécrit un `transform` — le patron du
 * groupe caméra du stage (`IsoStage`, `camGRef`), sans un `setState` par frame.
 *
 * HAUTEUR : celle du CORPS DESSINÉ, pas celle de son cadre — la toise du gabarit (`bodyTopFrac`,
 * `composeRig`) dit quelle part de la boîte 120×150 le sujet remplit, et les DEUX voies en tirent
 * leur ancre : la boîte affine (`BodyToken`) et le quad volumique (`billboardHeightM` × échelle du
 * sujet) la multiplient par la même fraction. Sans elle l'ancre était une CONSTANTE par famille : le
 * nain, le halfling et le gobelin voyaient leur barre flotter à mi-chemin d'un voisin. En VUE DU
 * DESSUS il n'y a plus de tête à surmonter : la voie affine y remplace le corps par un disque-portrait
 * et pose son chrome au bord de CE disque (`BodyToken`, branche `flat` : `badgeY = −discR`) — même
 * ancre ici.
 */
import { useEffect, useRef } from 'react';
import { isSquareView, tileCenter, type Dims } from '../../geometry/iso';
import { ISO_PX_PER_M } from '../iso';
import { billboardHeightM } from '../backends/webgl/billboardMath';
import { CONVENTION } from './GameStage3D';
import { TokenChromeMarks } from '../TokenChromeMarks';
import { discR } from '../builders/dynamicMarks';
import { subscribeWalkFrames } from '../fx/useWalkAnim';
import type { TokenChromeMark } from '../builders/tokenChrome';
import type { WalkPos } from './tokens';

/** Lift d'étage d'une case (mêmes unités que le `z` de `tileCenter`). */
export type LiftAt = (x: number, y: number, z?: number) => number;

/** Hauteur ÉCRAN (px) à laquelle le chrome d'un jeton s'ancre, sous la vue `dims` :
 *  - LOSANGE : la hauteur MONDE de son billboard, à la cadence verticale de la projection affine
 *    (`ISO_PX_PER_M` — un mètre de haut y vaut toujours ces pixels, quel que soit le lacet),
 *    RABATTUE sur la part de la boîte que le corps occupe vraiment (`bodyTopFrac`) ;
 *  - DESSUS : le rayon du disque-portrait de son empreinte (`discR`), la même ancre que l'affine. */
export function chromeHeadPx(dims: Dims, mark: { scaleK: number; n: number; bodyTopFrac: number }): number {
  return isSquareView(dims.view)
    ? discR(mark.n)
    : billboardHeightM(CONVENTION, 'personnage') * mark.scaleK * mark.bodyTopFrac * ISO_PX_PER_M;
}

/** Position ÉCRAN du chrome d'un jeton à l'instant que porte `wp` : le CENTRE de son bloc d'empreinte,
 *  glissement de marche compris. Un seul calcul, partagé par le rendu React et le battement de marche —
 *  deux formules divergeraient au premier pas. */
export function chromeTransform(m: TokenChromeMark, dims: Dims, liftAt: LiftAt, wp: WalkPos): string {
  const p = wp(m.id, m.cell.x, m.cell.y, m.cell.z);
  const off = (m.n - 1) / 2;
  const x = p.x + off;
  const y = p.y + off;
  const { cx, cy } = tileCenter(x, y, dims, liftAt(x, y, m.cell.z));
  return `translate(${cx},${cy})`;
}

export interface TokenChromeOverlayProps {
  /** Chromes de la frame, déjà dérivés des jetons postés (`builders/tokenChrome`). */
  chromes: readonly TokenChromeMark[];
  dims: Dims;
  liftAt: LiftAt;
  /** Position visuelle des jetons à un instant DONNÉ — le rendu la demande au sien, la boucle de
   *  marche la redemande à chaque frame (c'est là que le glissement se lit). */
  walkPosAt: (now: number) => WalkPos;
}

export function TokenChromeOverlay({ chromes, dims, liftAt, walkPosAt }: TokenChromeOverlayProps): JSX.Element {
  const groupes = useRef(new Map<string, SVGGElement>());
  // Sans tableau de dépendances PAR CONSTRUCTION : l'abonnement se refait après chaque rendu, donc la
  // closure du battement porte toujours les chromes et la vue du rendu courant (même patron que la
  // passe de dessin du monde volumique, `GameStage3D`).
  useEffect(() =>
    subscribeWalkFrames(() => {
      const wp = walkPosAt(performance.now());
      for (const m of chromes) {
        const g = groupes.current.get(m.id);
        if (g) g.setAttribute('transform', chromeTransform(m, dims, liftAt, wp));
      }
    }),
  );
  const wp = walkPosAt(performance.now());
  return (
    <>
      {chromes.map((m) => (
        <g
          key={m.id}
          ref={(g) => {
            if (g) groupes.current.set(m.id, g);
            else groupes.current.delete(m.id);
          }}
          data-chrome-cid={m.id}
          transform={chromeTransform(m, dims, liftAt, wp)}
          pointerEvents="none"
        >
          <TokenChromeMarks hp={m.hp} icons={m.icons} iconsMore={m.iconsMore} endState={m.endState} badgeY={-chromeHeadPx(dims, m)} />
        </g>
      ))}
    </>
  );
}
