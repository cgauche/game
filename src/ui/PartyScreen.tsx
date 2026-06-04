import { useState } from 'react';
import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { campaign } from '../scenes/campaign';
import { Combatant } from '../engine/types';
import { CharCard } from './CharCard';

export function PartyScreen() {
  const party = useGame((s) => s.party);
  const setParty = useGame((s) => s.setParty);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const [picker, setPicker] = useState(false);
  const pregens = useState(() => makePregens())[0];

  const remove = (id: string) => setParty(party.filter((h) => h.id !== id));
  const addPregen = (h: Combatant) => {
    if (party.length >= 4 || party.some((p) => p.id === h.id)) return;
    setParty([...party, JSON.parse(JSON.stringify(h))]);
    setPicker(false);
  };
  const startCampaign = () => {
    startScene(campaign[0].scene);
    setScreen('campaign');
  };

  return (
    <div className="screen party-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Menu
        </button>
        <h2>Votre groupe d'aventuriers ({party.length}/4)</h2>
        <button className="btn btn-primary" disabled={party.length === 0} onClick={startCampaign}>
          Commencer la campagne →
        </button>
      </header>

      <div className="party-grid">
        {[0, 1, 2, 3].map((i) => {
          const h = party[i];
          return (
            <div className="party-slot" key={i}>
              {h ? (
                <>
                  <CharCard hero={h} />
                  <button className="btn small danger" onClick={() => remove(h.id)}>
                    Retirer
                  </button>
                </>
              ) : (
                <div className="empty-slot">
                  <span className="slot-num">Aventurier {i + 1}</span>
                  <button className="btn" onClick={() => setScreen('creator')}>
                    Créer un personnage
                  </button>
                  <button className="btn" onClick={() => setPicker(true)}>
                    Choisir un pré-tiré
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picker && (
        <div className="modal-overlay" onClick={() => setPicker(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Personnages pré-tirés</h3>
            <div className="pregen-list">
              {pregens.map((h) => (
                <div key={h.id} className="pregen-row">
                  <CharCard hero={h} compact />
                  <button
                    className="btn small btn-primary"
                    disabled={party.some((p) => p.id === h.id)}
                    onClick={() => addPregen(h)}
                  >
                    {party.some((p) => p.id === h.id) ? 'Déjà choisi' : 'Choisir'}
                  </button>
                </div>
              ))}
            </div>
            <button className="btn" onClick={() => setPicker(false)}>
              Fermer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
