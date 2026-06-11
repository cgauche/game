import { useState } from 'react';
import { useGame } from '../state/store';
import { makePregens } from '../data/pregens';
import { rosterLoad, rosterRemove } from '../state/roster';
import { campaign } from '../scenes/campaign';
import { Combatant } from '../engine/types';
import { Money, formatMoney } from '../engine/money';
import { CharCard } from './CharCard';

export function PartyScreen() {
  const party = useGame((s) => s.party);
  const setParty = useGame((s) => s.setParty);
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const creditPartyMoney = useGame((s) => s.creditPartyMoney);
  const [picker, setPicker] = useState(false);

  const remove = (id: string) => setParty(party.filter((h) => h.id !== id));
  const pick = (h: Combatant, wealth?: Money) => {
    if (party.length >= 4 || party.some((p) => p.id === h.id)) return;
    setParty([...party, JSON.parse(JSON.stringify(h))]);
    if (wealth) creditPartyMoney(wealth, `Richesse initiale de ${h.name}`);
    if (party.length + 1 >= 4) setPicker(false); // groupe complet → on ferme ; sinon on enchaîne
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
                    Choisir un personnage
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {picker && party.length < 4 && <PartyPicker party={party} onPick={pick} onClose={() => setPicker(false)} />}
    </div>
  );
}

/** Modale de choix : personnages sauvegardés (roster localStorage) + pré-tirés. */
export function PartyPicker({
  party,
  onPick,
  onClose,
}: {
  party: Combatant[];
  onPick: (h: Combatant, wealth?: Money) => void;
  onClose: () => void;
}) {
  const pregens = useState(() => makePregens())[0];
  const [roster, setRoster] = useState(() => rosterLoad());
  const [tab, setTab] = useState<'roster' | 'pregens'>(roster.length ? 'roster' : 'pregens');

  const inParty = (id: string) => party.some((p) => p.id === id);
  const removeSaved = (id: string) => {
    rosterRemove(id);
    setRoster(rosterLoad());
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="picker-title">Recruter — {party.length}/4</h3>
        <div className="sheet-tabs">
          <button className={`tab ${tab === 'roster' ? 'on' : ''}`} onClick={() => setTab('roster')}>
            Mes personnages
          </button>
          <button className={`tab ${tab === 'pregens' ? 'on' : ''}`} onClick={() => setTab('pregens')}>
            Pré-tirés
          </button>
        </div>

        {tab === 'roster' ? (
          <div className="pregen-list">
            {roster.length === 0 && (
              <p className="hint">Aucun personnage sauvegardé — ceux créés dans le créateur apparaîtront ici.</p>
            )}
            {roster.map(({ hero, wealth }) => (
              <div key={hero.id} className="pregen-row">
                <CharCard hero={hero} compact />
                <span className="hint">Bourse : {formatMoney(wealth)}</span>
                <button
                  className="btn small btn-primary"
                  disabled={inParty(hero.id)}
                  onClick={() => onPick(hero, wealth)}
                >
                  {inParty(hero.id) ? 'Déjà choisi' : 'Choisir'}
                </button>
                <button className="btn small danger" onClick={() => removeSaved(hero.id)}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="pregen-list">
            {pregens.map((h) => (
              <div key={h.id} className="pregen-row">
                <CharCard hero={h} compact />
                <button className="btn small btn-primary" disabled={inParty(h.id)} onClick={() => onPick(h)}>
                  {inParty(h.id) ? 'Déjà choisi' : 'Choisir'}
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="btn" onClick={onClose}>
          Terminé
        </button>
      </div>
    </div>
  );
}
