import type { ReactNode } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { MultiRollList } from './MultiRollList';
import { TravelDayBody } from './TravelRecapModal';
import { OptionChooser } from './OptionChooser';
import { lodgingOptions, foodOptions, restCost, type RestLodging, type RestFood } from '../state/restFlow';
import { weatherExposure, exposureTestCount, exposureShelterFromTent } from '../engine/exposure';
import { hasCondition } from '../engine/conditions';
import { toBrass } from '../engine/money';
import { GameDate } from './GameDate';
import { ownsLocally } from '../state/netFlow';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import type { Combatant } from '../engine/types';

const LODGING_META: Record<RestLodging, { icon: IconIdInput; label: string }> = {
  privee: { icon: 'rest/bed', label: 'Privée' },
  commune: { icon: 'rest/couch', label: 'Commune' },
  maison: { icon: 'rest/home', label: 'Chez soi' },
  dehors: { icon: 'rest/camp', label: 'Dehors' },
  bord: { icon: 'travel/sail-ship', label: 'À bord' },
};
const FOOD_META: Record<RestFood, { icon: IconIdInput; label: string }> = {
  repas: { icon: 'rest/stew', label: 'Repas' },
  maison: { icon: 'rest/feast', label: 'Maison' },
  ration: { icon: 'item/misc', label: 'Ration' },
  rien: { icon: 'ui/forbidden', label: 'Rien' },
};

/** Avertissements de la ligne d'un héros (info de DÉCISION, pas de texte tuto). */
function heroWarnings(h: Combatant, lodging: RestLodging, food: RestFood, exposureTests: number): ReactNode[] {
  const out: ReactNode[] = [];
  if (hasCondition(h, 'hemorragique') || hasCondition(h, 'en-flammes') || hasCondition(h, 'empoisonne')) {
    out.push(<><Icon id="ui/warning" size="sm" /> à stabiliser (pas de repos réparateur)</>);
  }
  if (food === 'rien') out.push(<><Icon id="ui/warning" size="sm" /> ventre vide</>);
  if (lodging === 'dehors' && exposureTests > 0) out.push(<><Icon id="rest/cold" size="sm" /> Exposition ×{exposureTests}</>);
  return out;
}

/**
 * CORPS de la modale de repos — `embedded` (#333) bascule le rendu en zone embarquée (sans `Modal`,
 * patron `CascadeBody`/`RollShell embedded`) pour l'incrustation dans l'écran-hub de voyage. Défaut
 * `false` = modale flottante (inchangé) ; une nuit ÉTAPE, RÉGLAGES + BILAN en deux phases :
 *  - RÉGLAGES : par héros, couchage + pitance (choix PERSONNELS et orthogonaux — manger à
 *    l'auberge et dormir dehors est permis) ; coût RAW total calculé ; avertissements en ligne ;
 *  - BILAN : le temps passé est AFFICHÉ (avant → après), et tous les jets de la nuit tiennent
 *    sur UN écran (brique multi-jets) — abri, Exposition, récupération, cauchemars, contagion.
 */
export function RestBody({ embedded = false }: { embedded?: boolean } = {}) {
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
  const restLedgerReroll = useGame((s) => s.restLedgerReroll);
  const state = useGame();
  if (!p) return null;

  const title = p.places.auberge ? <><Icon id="rest/bed" size="sm" /> Nuit à l’auberge</> : p.places.maison ? <><Icon id="time/night" size="sm" /> Nuit chez soi</> : p.places.bord ? <><Icon id="travel/sail-ship" size="sm" /> Nuit à bord</> : <><Icon id="rest/camp" size="sm" /> Campement</>;

  // ── Phase BILAN : le temps écoulé + tous les jets de la nuit sur UN écran ──
  if (p.phase === 'bilan') {
    const bilanBody = (
      <>
        {p.slept && (
          <p className="rest-time">
            <GameDate time={p.slept.from} /> → <GameDate time={p.slept.to} />
            <span className="rest-time-len"> · {Math.round((p.slept.to - p.slept.from) / 60)} h</span>
          </p>
        )}
        {/* PV de la nuit : chaque ligne de HÉROS ratée à conséquence recalculable (récupération,
            cauchemars) est influençable après coup — la Chance RELANCE (LDB 17 l.21-27). */}
        <MultiRollList
          entries={p.results ?? []}
          influence={{ reroll: (id) => restLedgerReroll(id), owns: (hid) => net.mode === 'local' || ownsLocally(state, hid) }}
        />
        <div className="modal-actions">
          <button className="btn btn-primary" onClick={() => restContinue()}>{p.travelHalt ? 'Reprendre la route' : 'Continuer'}</button>
        </div>
      </>
    );
    if (embedded) {
      return <div className="rs-embedded rest-modal"><div className="mini-title">{title}</div>{bilanBody}</div>;
    }
    return (
      <Modal title={title} variant="plain" className="rest-modal" onClose={restContinue}>
        {bilanBody}
      </Modal>
    );
  }

  // ── Phase RÉGLAGES ──
  const cost = restCost(p, party);
  const severity = weatherExposure(scene?.weather);
  const sheltered = exposureShelterFromTent(party);
  const exposureTests = exposureTestCount(severity, sheltered);
  const online = net.mode !== 'local';
  const ready = p.readyBySeat ?? {};
  const seats = Object.entries(net.seatNames).map(([s, n]) => ({ seat: Number(s), name: n }));
  const allReady = !online || seats.every(({ seat }) => ready[seat]);
  const canPay = toBrass(cost) === 0 || toBrass(money) >= toBrass(cost);
  const reglagesTitle = <>{title}{p.days > 1 ? ` — ${p.days} nuits` : ''}{p.quality === 'pietre' ? ' (piètre)' : ''}</>;

  const reglagesBody = (
    <>
      {/* HALTE de voyage : le RAPPORT DU JOUR se lit le soir même (km, péripéties, jets en
          lignes multijet) — avant de régler la nuit. Même corps que le recap (TravelDayBody). */}
      {p.travelDay && (
        <div className="rest-travel-day">
          <p className="rest-time">
            <Icon id="scenario/travel" size="sm" /> Journée de route — {Math.round(p.travelDay.kmTo - p.travelDay.kmFrom)} km en {Math.round(p.travelDay.hours)} h
          </p>
          <TravelDayBody day={p.travelDay} />
        </div>
      )}
      {severity !== 'clement' && (
        <p className="rest-weather">{severity === 'extreme' ? <><Icon id="rest/storm" size="sm" /> Temps de chien</> : <><Icon id="rest/rain" size="sm" /> Mauvais temps</>}{sheltered ? ' — la tente abritera le camp' : ''}</p>
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
                  options={lodgingOptions(p.places).map((l) => ({ key: l, label: <><Icon id={LODGING_META[l].icon} size="sm" /> {LODGING_META[l].label}</>, selected: cfg.lodging === l, disabled: !mine, onSelect: () => restSet(h.id, { lodging: l }) }))}
                />
                <OptionChooser
                  layout="seg"
                  groupLabel="Nourriture"
                  options={foodOptions(p.places, h).map((f) => ({ key: f, label: <><Icon id={FOOD_META[f].icon} size="sm" /> {FOOD_META[f].label}</>, selected: cfg.food === f, disabled: !mine, onSelect: () => restSet(h.id, { food: f }) }))}
                />
                {warns.length > 0 && (
                  <span className="rest-warn">
                    {warns.map((w, i) => <span key={i}>{i > 0 && ' · '}{w}</span>)}
                  </span>
                )}
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
                {h ? <CharFrame c={h} variant="identity" size="xs" /> : <Icon id="nav/seat-owner" size="sm" />}
                {ready[seat] ? '✓' : '…'}
              </span>
            );
          })}
        </div>
      )}
      <div className="modal-actions">
        {!p.travelHalt && <button className="btn btn-ghost" onClick={() => restCancel()}>Annuler</button>}
        {online && !ready[net.mySeat] && (
          <button className="btn" onClick={() => restReady(net.mySeat)}><Icon id="action/attack" size="sm" /> Prêt</button>
        )}
        {(!online || net.mode === 'host') && (
          <button className="btn btn-primary" disabled={!canPay || !allReady} onClick={() => restSleep()} title={!canPay ? 'Pas assez d’argent — choisissez des couchages plus modestes' : undefined}>
            <Icon id="time/night" size="sm" /> Dormir jusqu’à l’aube
          </button>
        )}
      </div>
    </>
  );
  if (embedded) {
    return <div className="rs-embedded rest-modal"><div className="mini-title">{reglagesTitle}</div>{reglagesBody}</div>;
  }
  return (
    <Modal title={reglagesTitle} variant="plain" className="rest-modal" onClose={p.travelHalt ? undefined : () => restCancel()}>
      {reglagesBody}
    </Modal>
  );
}

/** MODALE DE REPOS flottante — repos au camp en exploration (hors hub de voyage). */
export function RestModal() {
  return <RestBody />;
}
