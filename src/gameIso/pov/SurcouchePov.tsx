/**
 * SURCOUCHE DE PREMIÈRE PERSONNE — les voiles d'écran du regard à hauteur d'homme, posés SUR le canevas
 * volumique que l'hôte possède (`stage/MondeDeCampagne`). « Pov » nomme la VUE, pas une voie de rendu :
 * le monde est le MÊME (terrain, murs, hauteurs, entités), seul le `frame` change — c'est l'hôte qui le
 * sert. Cette feuille ne dérive AUCUNE vérité monde : elle ne peint que de l'ambiance d'écran.
 */
import { VW, VH } from './camera';
import { AMBIANCE, povAmbianceDefs } from '../catalog/ambiance';

export function SurcouchePov({ indoor }: { indoor: boolean }) {
  const bg = indoor ? AMBIANCE.pov.fogIndoor : AMBIANCE.pov.fogOutdoor;
  return (
    <div className="pov-stage" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* BRUME DE FOND : elle se pose DERRIÈRE le canevas (`zIndex: -1`) — le monde porte déjà la sienne
          dans le VOLUME (`povBackground`), et un fond opaque posé par-dessus l'effacerait. Elle ne
          couvre que le temps de l'entrée en scène, où le canevas reste vierge. */}
      <div aria-hidden="true" data-pov-brume="1" style={{ position: 'absolute', inset: 0, background: bg, zIndex: -1 }} />
      {/* VOILES D'ÉCRAN (#1176, P3-1c) : voile chaud d'extérieur et vignette, les defs d'ambiance
          partagées — ils se peignent PAR-DESSUS le canevas, jamais dans le volume (une vignette est une
          décoration de vue, pas une propriété du monde). Le voile de NUIT n'y est pas : le monde porte
          son palier dans le VOLUME — ses lampes (`stageLights`) pour les surfaces, `ambianceLum` pour le
          ciel et les brumes (`povBackground`/`povFog`) — et un second propriétaire en peindrait deux
          l'un sur l'autre. */}
      <svg data-pov-veils width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
        <defs dangerouslySetInnerHTML={{ __html: povAmbianceDefs() }} />
        {!indoor && <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-warm)" />}
        <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-vignette)" />
      </svg>
    </div>
  );
}
