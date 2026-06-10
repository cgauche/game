import { useGame } from '../state/store';
import { findSpell } from '../data/index';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale d'incantation (« tous les jets méritent leur modale ») : on sélectionne un sort + une
 * cible, on clique « Lancer » (le jet d'incantation se fait alors), on voit le résultat — réussite
 * (DR ≥ NI), échec, ou Maladresse — on peut dépenser un point de Chance pour relancer, puis
 * « Appliquer ». Même flux différé que l'attaque.
 */
export function CastModal() {
  const pc = useGame((s) => s.pendingCast);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.castRoll);
  const reroll = useGame((s) => s.castReroll);
  const bonusSL = useGame((s) => s.castBonusSL);
  const darkPact = useGame((s) => s.castDarkPact);
  const setCritChoice = useGame((s) => s.castSetCritChoice);
  const forceSuccess = useGame((s) => s.castForceSuccess);
  const confirm = useGame((s) => s.castConfirm);
  const cancel = useGame((s) => s.castCancel);
  if (!pc) return null;
  const pool = battle?.combatants ?? party; // même modale en combat (file) et hors combat (groupe)
  const caster = pool.find((c) => c.id === pc.casterId);
  const target = pool.find((c) => c.id === pc.targetId);
  const spell = findSpell(pc.spellLabel);
  if (!caster || !target || !spell) return null;
  const res = pc.result;
  const fortune = caster.fortune ?? 0;
  const rerollable = !!res && canReroll(res.roll > res.target, !!pc.rerolled);
  const isPrayer = spell.cn == null;
  const ni = spell.cn ?? 0;
  const selfTarget = caster.id === target.id;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>{isPrayer ? 'Prière' : 'Incantation'}</h3>
        <p className="rm-vs">
          <strong>{caster.name}</strong>{' '}
          <span className="rm-weapon">
            ({spell.label}
            {!isPrayer ? ` · NI ${ni}` : ''})
          </span>
          {selfTarget ? (
            ' — sur lui-même'
          ) : (
            <>
              {' '}
              → <strong>{target.name}</strong>
            </>
          )}
        </p>

        {!res ? (
          <div className="modal-actions">
            <button className="btn" onClick={cancel}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={roll}>
              🎲 Lancer
            </button>
            {/* Résilience AVANT le jet (LDB 17 l.73) : on lance puis on force la réussite. */}
            <ResilienceButton resilience={caster.resilience ?? 0} show={(caster.resilience ?? 0) > 0} onForce={() => { roll(); forceSuccess(); }} />
          </div>
        ) : (
          <>
            <div className="rm-rolls">
              <div className={`rm-roll ${res.cast ? 'ok' : 'fail'}`}>
                <span className="rm-roll-label">{pc.missile ? 'Projectile' : isPrayer ? 'Prière' : 'Incantation'}</span>
                <span className="rm-roll-calc">
                  cible <b>{res.target}</b>
                </span>
                <span className="rm-roll-dice">
                  🎲 <b>{res.roll === 100 ? '00' : String(res.roll).padStart(2, '0')}</b>
                </span>
                <span className="rm-roll-sl">
                  {res.sl >= 0 ? '+' : '−'}
                  {Math.abs(res.sl)} DR{!isPrayer ? ` / NI ${ni}` : ''}
                </span>
              </div>
            </div>
            <div className={`rm-verdict ${res.cast ? 'ok' : 'fail'}`}>
              {res.cast
                ? pc.missile && res.hit
                  ? `Touché${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}${res.woundsLost ? ` · ${res.woundsLost} Blessure(s)` : ''}${res.defenderDefeated ? ' · hors de combat !' : ''}${res.isCritical ? ' · CRITIQUE' : ''}`
                  : 'Sort lancé !'
                : res.isFumble
                  ? 'Maladresse — Incantation Imparfaite / Colère des dieux'
                  : res.roll <= res.target
                    ? `Réussite trop faible : DR ${res.sl} < NI ${ni}`
                    : 'Incantation échouée'}
            </div>
            <p className="rm-log">{res.log}</p>
            {res.isCritical && !isPrayer && caster.kind === 'hero' && (
              <div className="rm-crit-choice">
                {/* Incantation CRITIQUE (LDB 46 l.52-59) : puissance supplémentaire au choix
                    (le contrecoup — Imparfaite Mineure sauf Diction instinctive — est automatique). */}
                <span className="mini-title">⚡ Incantation Critique — choisir l'effet</span>
                <div className="modal-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                  {([
                    ...(pc.missile ? [['critique', '💥 Blessure Critique', 'Si le Sort inflige des Dégâts, il inflige aussi une Blessure Critique.']] : []),
                    ['puissance', '🌀 Puissance totale', 'Le Sort est lancé quels que soient son NI et votre DR, mais il peut être Dissipé.'],
                    ['ineluctable', '🛡️ Force inéluctable', 'Si vous avez assez de DR pour lancer le Sort, il ne peut pas être Dissipé.'],
                  ] as [('critique' | 'puissance' | 'ineluctable'), string, string][]).map(([val, label, tip]) => {
                    const def = !res.cast ? 'puissance' : pc.missile ? 'critique' : 'ineluctable';
                    const selected = (pc.critChoice ?? def) === val;
                    return (
                      <button key={val} className={`btn small ${selected ? 'btn-primary' : ''}`} title={tip} onClick={() => setCritChoice(val)}>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <ChanceButtons
                fortune={fortune}
                rerollable={rerollable}
                onReroll={reroll}
                onBonusSL={bonusSL}
                darkPactable={caster.kind === 'hero' && res.roll > 0 && res.roll > res.target}
                onDarkPact={darkPact}
              />
              <ResilienceButton resilience={caster.resilience ?? 0} show={!!res && !res.cast} onForce={forceSuccess} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
