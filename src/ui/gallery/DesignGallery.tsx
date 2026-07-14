/**
 * DesignGallery — galerie design system IN-APP (#412, DEV uniquement), ratifiant le kit HTML
 * « Atelier du scribe » en PRIMITIVES React réelles. Chaque entrée est un spécimen VIVANT (données
 * réelles de `src/data`, jamais inventées, sauf note explicite) — la référence de goût pérenne
 * remplace la planche HTML (retraitée par ce ticket). Extension utilisateur (2026-07-14, verbatim :
 * « Faudrait forcer à ce que la galerie ait toutes les primitives ») : le contenu vient du REGISTRE
 * `./registry.ts` (SOURCE UNIQUE) — la garde structurelle `gallery-exhaustive.test.ts` exige une
 * entrée par primitive `src/ui/**.tsx` de la table « Primitives partagées » du CLAUDE.md.
 */
import { useState } from 'react';
import { ScreenShell } from '../ScreenShell';
import { MasterDetail } from '../MasterDetail';
import { Icon } from '../Icon';
import { useGame } from '../../state/store';
import { GALLERY_SPECIMENS, GALLERY_CATEGORIES } from './registry';

export function DesignGallery() {
  const setScreen = useGame((s) => s.setScreen);
  const [activeId, setActiveId] = useState(GALLERY_SPECIMENS[0]?.name);
  const entry = GALLERY_SPECIMENS.find((s) => s.name === activeId) ?? GALLERY_SPECIMENS[0];
  const Render = entry?.render;
  return (
    <ScreenShell title={<><Icon id="nav/art-gallery" /> Design system — L'Atelier du scribe</>} onClose={() => setScreen('menu')} body="centered-wide" className="gallery-screen">
      <div className="gallery-body">
        <MasterDetail
          listLabel="Primitives du design system"
          list={
            <>
              {GALLERY_CATEGORIES.map((cat) => (
                <div className="gallery-list-group" key={cat}>
                  <h4 className="gallery-list-heading">{cat}</h4>
                  {GALLERY_SPECIMENS.filter((s) => s.category === cat).map((s) => (
                    <button
                      key={s.name}
                      type="button"
                      className={`btn gallery-list-item${s.name === activeId ? ' active' : ''}`}
                      onClick={() => setActiveId(s.name)}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              ))}
            </>
          }
          detail={
            entry && Render ? (
              <div className="gallery-detail-wrap">
                <div className="gallery-detail-head row-flex">
                  <h3>{entry.name}</h3>
                  <span className="gallery-detail-source">{entry.file}</span>
                </div>
                {entry.note && <p className="hint">{entry.note}</p>}
                <div className="gallery-detail">
                  <div className="gallery-spec">
                    <div className="gallery-spec-stage row-flex">
                      <Render />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="hint">Aucun spécimen.</p>
            )
          }
        />
      </div>
    </ScreenShell>
  );
}
