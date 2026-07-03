import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { MultiRollList } from './MultiRollList';
import { TravelDayBody } from './TravelRecapModal';
import { OptionChooser } from './OptionChooser';
import { lodgingOptions, foodOptions, restCost, type RestLodging, type RestFood } from '../state/restFlow';
import { weatherExposure, exposureTestCount, partyHasTent } from '../engine/exposure';
import { hasCondition } from '../engine/conditions';
import { toBrass } from '../engine/money';
import { GameDate } from './GameDate';
import { ownsLocally } from '../state/netFlow';
import type { Combatant } from '../engine/types';

const LODGING_META: Record<RestLodging, { icon: string; label: string }> = {
  privee: { icon: '🛏', label: 'Privée' },
  commune: { icon: '🛋', label: 'Commune' },
  maison: { icon: '🏠', label: 'Chez soi' },
  dehors: { icon: '⛺', label: 'Dehors' },
};
const FOOD_META: Record<RestFood, { icon: string; label: string }> = {
  repas: { icon: '🍲', label: 'Repas' },
  maison: { icon: '🥘', label: 'Maison' },
  ration: { icon: '🎒', label: 'Ration' },
  rien: { icon: '🚫', label: 'Rien' },
};

/** Avertissements de la ligne d'un héros (info de DÉCISION, pas de texte tuto). */
function heroWarnings(h: Combatant, lodging: RestLodging, food: RestFood, exposureTests: number): string[] {
  const out: string[] = [];
  if (hasCondition(h, 'hemorragique') || hasCondition(h, 'en-flammes') || hasCondition(h, 'empoisonne')) {
    out.push('⚠ à stabiliser (pas de repos réparateur)');
  }
  if (food === 'rien') out.push('⚠ ventre vide');
  if (lodging === 'dehors' && exposureTests > 0) out.push(`🥶 Exposition ×${exposureTests}`);
  return out;
}

/**
 * MODALE DE REPOS — une nuit (auberge / chez soi / campement) en deux phases :
 *  - RÉGLAGES : par héros, couchage + pitance (choix PERSONNELS et orthogonaux — manger à
 *    l'auberge et dormir dehors est permis) ; coût RAW total calculé ; avertissements en ligne ;
 *  - BILAN : le temps passé est AFFICHÉ (avant → après), et tous les jets de la nuit tiennent
 *    sur UN écran (brique multi-jets) — abri, Exposition, récupération, cauchemars, contagion.
 */
export function RestModal() {
  const p = useGame((s) => s.pendingRest);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const scene = useGame((s) => s.scene);
  const net = useGame((s) => s.net);
  const restSet = useGame((s) => s.restSet);
  const restSleep = useGame((s) => s.restSleep);
  const restCancel = useGame((s) => s.restCancel);
  const restContinue = useGame((s) => s.restContinue);
  const restReady = useGame((s) => s.restReady);
  const state = useGame();
  if (!p) return null;

  const title = p.places.auberge ? '🛏 Nuit à l’auberge' : p.places.maison ? '🌙 Nuit chez soi' : '⛺ Campement';

  // ── Phase BILAN : le temps écoulé + tous les jets de la nuit sur UN écran ──
  if (p.phase === 'bilan') {
    return (
      <Modal title={title} variant="plain" className="rest-modal" onClose={restContinue}>
        {p.slept && (
          <p className="rest-time">
            <GameDate time={p.slept.from} /> → <GameDate time={p.slept.to} />
            <span className="rest-time-len"> · {Math.round((p.slept.to - p.slept.from) / 60)} h</span>
          </p>
        )}
        <MultiRollList entries={p.results ?? []} />
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => restContinue()}>{p.travelHalt ? 'Reprendre la route' : 'Continuer'}</button>
        </div>
      </Modal>
    );
  }

  // ── Phase RÉGLAGES ──
  const cost = restCost(p, party);
  const severity = weatherExposure(scene?.weather);
  const sheltered = partyHasTent(party);
  const exposureTests = exposureTestCount(severity, sheltered);
  const online = net.mode !== 'local';
  const ready = p.readyBySeat ?? {};
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  const allReady = !online || seats.every(({ seat }) => ready[seat]);
  const canPay = toBrass(cost) === 0 || toBrass(money) >= toBrass(cost);

  return (
    <Modal title={`${title}${p.days > 1 ? ` — ${p.days} nuits` : ''}${p.quality === 'pietre' ? ' (piètre)' : ''}`} variant="plain" className="rest-modal" onClose={p.travelHalt ? undefined : () => restCancel()}>
      {/* HALTE de voyage : le RAPPORT DU JOUR se lit le soir même (km, péripéties, jets en
          lignes multijet) — avant de régler la nuit. Même corps que le recap (TravelDayBody). */}
      {p.travelDay && (
        <div className="rest-travel-day">
          <p className="rest-time">
            🧭 Journée de route — {Math.round(p.travelDay.kmTo - p.travelDay.kmFrom)} km en {Math.round(p.travelDay.hours)} h
          </p>
          <TravelDayBody day={p.travelDay} />
        </div>
      )}
      {severity !== 'clement' && (
        <p className="rest-weather">{severity === 'extreme' ? '🌩 Temps de chien' : '🌧 Mauvais temps'}{sheltered ? ' — la tente abritera le camp' : ''}</p>
      )}
      <div className="rest-rows">
        {party.filter((h) => !h.dead && p.perHero[h.id]).map((h) => {
          const cfg = p.perHero[h.id];
          const mine = !online || ownsLocally(state, h.id);
          const warns = heroWarnings(h, cfg.lodging, cfg.food, exposureTests);
          return (
            <div key={h.id} className="rest-row">
              <CharFrame c={h} variant="full" size="sm" />
              <div className="rest-choices">
                <OptionChooser
                  layout="seg"
                  groupLabel="Couchage"
                  options={lodgingOptions(p.places).map((l) => ({ key: l, label: <>{LODGING_META[l].icon} {LODGING_META[l].label}</>, selected: cfg.lodging === l, disabled: !mine, onSelect: () => restSet(h.id, { lodging: l }) }))}
                />
                <OptionChooser
                  layout="seg"
                  groupLabel="Nourriture"
                  options={foodOptions(p.places, h).map((f) => ({ key: f, label: <>{FOOD_META[f].icon} {FOOD_META[f].label}</>, selected: cfg.food === f, disabled: !mine, onSelect: () => restSet(h.id, { food: f }) }))}
                />
                {warns.length > 0 && <span className="rest-warn">{warns.join(' · ')}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rest-foot">
        {toBrass(cost) > 0 ? (
          <span className={`rest-cost ${canPay ? '' : 'over'}`}>Total <Coins money={cost} /> · Bourse <Coins money={money} /></span>
        ) : (
          <span className="rest-cost">Nuit gratuite</span>
        )}
      </div>
      {online && (
        <div className="ready-row">
          {seats.map(({ seat, name }) => {
            const h = party.find((x) => !x.dead && (net.ownership[x.id] ?? 0) === seat);
            return (
              <span key={seat} className={`ready-chip${ready[seat] ? ' ok' : ''}`} title={name}>
                {h ? <CharFrame c={h} variant="identity" size="xs" /> : '👤'}
                {ready[seat] ? '✓' : '…'}
              </span>
            );
          })}
        </div>
      )}
      <div className="modal-actions">
        {!p.travelHalt && <button className="btn btn-ghost" onClick={() => restCancel()}>Annuler</button>}
        {online && !ready[net.mySeat] && (
          <button className="btn" onClick={() => restReady(net.mySeat)}>⚔️ Prêt</button>
        )}
        {(!online || net.mode === 'host') && (
          <button className="btn btn-primary" disabled={!canPay || !allReady} onClick={() => restSleep()} title={!canPay ? 'Pas assez d’argent — choisissez des couchages plus modestes' : undefined}>
            🌙 Dormir jusqu’à l’aube
          </button>
        )}
      </div>
    </Modal>
  );
}
