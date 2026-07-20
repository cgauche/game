import { useState } from 'react';
import { useGame } from '../state/store';
import { TAVERN_GAMES, findTavernGameById } from '../engine/tavernGame';
import { tavernGameValue, TAVERN_GAME_KIND, type TavernOpponent } from '../state/tavernFlow';
import { bourseOf } from '../state/bourseFlow';
import { refLabel } from '../data/index';
import { PA_PER_SC, toBrass, fromBrass } from '../engine/money';
import { Modal } from './Modal';
import { OptionChooser } from './OptionChooser';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { Prose } from './Prose';
import { SceneBackdrop } from './SceneBackdrop';

/**
 * Jeux de taverne (Nuits agitées & dures journées, ch.16) — modale UNIQUE : choisir un jeu, un
 * challenger et un adversaire (compagnon OU valeur abstraite fixée par la table), puis résoudre EN
 * DEUX TEMPS (#370) : le jet du challenger s'ouvre par le seam de jet (`openRoll`, modale RollShell
 * influençable Chance/Pacte/Résilience, surfacée PAR-DESSUS) ; à son retour, le moteur générique
 * (`resolveTavernRound`, variante « jeu rapide » : Test opposé Intermédiaire (+0), le plus de DR
 * l'emporte) décide l'issue depuis les deux jets. Affiche l'issue et la mise éventuelle. Ouverte via
 * `openTavernGames` (affordance montrée seulement si l'option `tavern-games` est active).
 */
export function TavernGameModal() {
  const state = useGame((s) => s.tavernGames);
  const party = useGame((s) => s.party);
  const play = useGame((s) => s.playTavernGame);
  const replay = useGame((s) => s.openTavernGames);
  const close = useGame((s) => s.closeTavernGames);
  // Manche EN COURS (jet du challenger surfacé par-dessus, cf. docstring) : masque le formulaire de
  // réglage — la cascade (RollShell) porte l'interaction tant qu'elle n'a pas committé.
  const rolling = useGame((s) => !!s.pendingCascade?.participants.some((p) => p.kind === TAVERN_GAME_KIND));

  const heroes = party.filter((h) => !h.dead);
  const [gameId, setGameId] = useState(TAVERN_GAMES[0]?.id ?? '');
  const [challengerId, setChallengerId] = useState(heroes[0]?.id ?? '');
  const [oppMode, setOppMode] = useState<'hero' | 'abstract'>(heroes.length > 1 ? 'hero' : 'abstract');
  const [oppHeroId, setOppHeroId] = useState('');
  const [abstractValue, setAbstractValue] = useState<number | undefined>(undefined);
  const [stakePa, setStakePa] = useState(0);

  if (!state) return null;
  const result = state.result;
  const game = findTavernGameById(gameId);
  const challenger = heroes.find((h) => h.id === challengerId);

  // Cadre du jet (variante rapide, l.9-11) : la Compétence indiquée, ou Pari si aucune.
  const skillLine = game
    ? game.skill
      ? `${refLabel('skills', { id: game.skill, spec: game.spec })} Intermédiaire (+0)`
      : game.characteristic
        ? `${game.characteristic} Intermédiaire (+0)`
        : 'Pari Intermédiaire (+0)'
    : '';
  const challengerVal = game && challenger ? tavernGameValue(challenger, game) : 0;
  const oppValue = abstractValue ?? challengerVal; // défaut : match égal (valeur du challenger)

  const oppCandidates = heroes.filter((h) => h.id !== challengerId);
  // La mise sort de la bourse du CHALLENGER (débit/crédit personnel) : le plafond affiché est SA bourse.
  const challengerPurse = challenger ? bourseOf(challenger) : { gold: 0, silver: 0, brass: 0 };
  const purseInPa = Math.floor(toBrass(challengerPurse) / PA_PER_SC);
  const stakeActive = !!game?.stake && oppMode === 'abstract';
  const stake = stakeActive ? Math.min(Math.max(0, stakePa), purseInPa) : 0;

  const canPlay = !!game && !!challenger && (oppMode === 'abstract' ? oppValue > 0 : oppCandidates.some((h) => h.id === (oppHeroId || oppCandidates[0]?.id)));

  const onPlay = () => {
    if (!game || !challenger) return;
    const opponent: TavernOpponent = oppMode === 'hero'
      ? { kind: 'hero', id: oppHeroId || oppCandidates[0]?.id || '' }
      : { kind: 'abstract', value: oppValue };
    play({ gameId: game.id, challengerId: challenger.id, opponent, stakeBrass: stake * PA_PER_SC });
  };

  return (
    <Modal title="Jeux de taverne" variant="plain" className="tavern-modal" onClose={close} backdropClose>
      <SceneBackdrop backdropId="taverne-commune" />
      {rolling ? (
        <div className="tavern-result panel">
          <p className="tavern-detail muted">Jet en cours…</p>
        </div>
      ) : result ? (
        <div className="tavern-result panel">
          <p className="tavern-vs">
            <strong>{result.gameLabel}</strong> — {result.challengerName} contre {result.opponentName}
          </p>
          <p className={`tavern-verdict ${result.winner === 'player' ? 'ok-text' : result.winner === 'opponent' ? 'ko-text' : ''}`}>
            {result.winner === 'player' ? `✓ ${result.challengerName} l'emporte !` : result.winner === 'opponent' ? `✗ ${result.opponentName} l'emporte.` : 'Égalité.'}
          </p>
          <p className="tavern-detail">
            DR {result.playerSL} contre {result.opponentSL}
            {result.rounds > 1 ? ` · ${result.rounds} manches` : ''}
          </p>
          {result.netBrass !== 0 && (
            <p className="tavern-detail">
              {result.netBrass > 0 ? 'Gain : +' : 'Perte : −'}
              <Coins money={fromBrass(Math.abs(result.netBrass))} />
            </p>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={replay}>Rejouer</button>
            <button className="btn btn-primary" onClick={close}>Fermer</button>
          </div>
        </div>
      ) : (
        <div className="tavern-setup">
          <div className="tavern-block">
            <span className="mini-title">Le jeu</span>
            <OptionChooser
              layout="grid"
              options={TAVERN_GAMES.map((g) => ({ key: g.id, label: g.label, primary: g.id === gameId, onSelect: () => setGameId(g.id) }))}
            />
          </div>
          {game && (
            <>
              <div className="tavern-desc"><Prose md={game.desc} /></div>
              <p className="tavern-detail">Test opposé : <b>{skillLine}</b>{game.mode === 'extended' ? ` · premier à ${game.target ?? 10} DR cumulés` : ''}.</p>
            </>
          )}
          <div className="tavern-block">
            <span className="mini-title">Qui joue ?</span>
            <div className="frame-row">
              {heroes.map((h) => (
                <CharFrame key={h.id} c={h} variant="identity" size="xs" selected={h.id === challengerId} onClick={() => setChallengerId(h.id)} />
              ))}
            </div>
            {game && challenger && <p className="tavern-detail">{challenger.label} : valeur de jeu <b>{challengerVal}</b>.</p>}
          </div>
          <div className="tavern-block">
            <span className="mini-title">Adversaire</span>
            <OptionChooser
              layout="seg"
              options={[
                { key: 'hero', label: 'Un compagnon', selected: oppMode === 'hero', disabled: oppCandidates.length === 0, onSelect: () => setOppMode('hero') },
                { key: 'abstract', label: 'Un habitué (MJ)', selected: oppMode === 'abstract', onSelect: () => setOppMode('abstract') },
              ]}
            />
            {oppMode === 'hero' ? (
              <div className="frame-row">
                {oppCandidates.map((h) => (
                  <CharFrame key={h.id} c={h} variant="identity" size="xs" selected={h.id === (oppHeroId || oppCandidates[0]?.id)} onClick={() => setOppHeroId(h.id)} />
                ))}
              </div>
            ) : (
              <label className="tavern-amount">
                Valeur de l'adversaire (fixée par la table)
                <input type="number" min={1} max={100} value={oppValue} onChange={(e) => setAbstractValue(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} />
              </label>
            )}
          </div>
          {stakeActive && (
            <div className="tavern-block">
              <span className="mini-title">Mise ({game?.stake})</span>
              <label className="tavern-amount">
                Pistoles d'argent (bourse : {purseInPa})
                <input type="number" min={0} max={purseInPa} value={stakePa} onChange={(e) => setStakePa(Math.max(0, Math.min(purseInPa, Number(e.target.value) || 0)))} />
              </label>
            </div>
          )}
          {oppMode === 'hero' && !!game?.stake && (
            <p className="tavern-detail muted">Une mise entre compagnons ne change pas la bourse du groupe — jouez contre un habitué pour parier.</p>
          )}
          <div className="modal-actions">
            <button className="btn" onClick={close}>Fermer</button>
            <button className="btn btn-primary" disabled={!canPlay} onClick={onPlay}>Jouer</button>
          </div>
        </div>
      )}
    </Modal>
  );
}
