import { useState } from 'react';
import { getVolume, isMuted, setMuted, setVolume, playSfx } from '../audio/engine';

/** Contrôles audio du menu ☰ (Jalon 8 — sons CC0) : volume global + sourdine, persistants.
 *  Bouger le volume joue un échantillon (retour immédiat). */
export function AudioControls() {
  const [volume, setVol] = useState(getVolume());
  const [muted, setMute] = useState(isMuted());
  return (
    <div className="gm-section">
      <span className="mini-title">Audio</span>
      <div className="audio-controls">
        <button
          type="button"
          className="btn small"
          aria-label={muted ? 'Réactiver le son' : 'Couper le son'}
          title={muted ? 'Réactiver le son' : 'Couper le son'}
          onClick={() => {
            setMuted(!muted);
            setMute(!muted);
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          disabled={muted}
          aria-label="Volume"
          onChange={(e) => {
            const v = Number(e.target.value);
            setVolume(v);
            setVol(v);
          }}
          onPointerUp={() => playSfx('des')}
        />
      </div>
    </div>
  );
}
