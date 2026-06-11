import { useGame } from '../state/store';
import { counterspellCandidates, overcastTargetCandidates } from '../state/combatFlow';
import { findSpell } from '../data/index';
import { HIT_LOCATION_LABELS } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { Dice } from './Dice';
import { Modal } from './Modal';

/**
 * Modale d'incantation (« tous les jets méritent leur modale ») : on sélectionne un sort + une
 * cible, on clique « Lancer » (le jet d'incantation se fait alors), on voit le résultat — réussite
 * (DR ≥ NI), échec, ou Maladresse — on peut dépenser un point de Chance pour relancer, puis
 * « Appliquer ». Même flux différé que l'attaque.
 */
export function CastModal() {
  const pc = useGame((s) => s.pendingCast);
  const battle = useGame((s) => s.battle);
  const scene = useGame((s) => s.scene);
  const party = useGame((s) => s.party);
  const counterspell = useGame((s) => s.castCounterspell);
  const roll = useGame((s) => s.castRoll);
  const reroll = useGame((s) => s.castReroll);
  const bonusSL = useGame((s) => s.castBonusSL);
  const darkPact = useGame((s) => s.castDarkPact);
  const setCritChoice = useGame((s) => s.castSetCritChoice);
  const allocOvercast = useGame((s) => s.castAllocOvercast);
  const toggleExtraTarget = useGame((s) => s.castToggleExtraTarget);
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
    <Modal title={isPrayer ? 'Prière' : 'Incantation'} onClose={!res && caster.kind !== 'enemy' ? cancel : undefined}>
        <p className="rm-vs">
          <strong>{caster.name}</strong>{' '}
          <span className="rm-weapon">
            ({spell.label}
            {!isPrayer ? ` · NI ${ni}` : ''})
          </span>
          {pc.zone ? (
            <>
              {' '}
              → <strong>Zone d'Effet</strong> ({1 + (pc.extraTargetIds?.length ?? 0)} cible{(pc.extraTargetIds?.length ?? 0) > 0 ? 's' : ''} : {[target.name, ...(pc.extraTargetIds ?? []).map((id) => pool.find((c) => c.id === id)?.name ?? '?')].join(', ')})
            </>
          ) : selfTarget ? (
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
            {/* Lanceur ennemi : le témoin ne peut pas annuler l'action de l'IA (tour suspendu). */}
            {caster.kind !== 'enemy' && (
              <button className="btn" onClick={cancel}>
                Annuler
              </button>
            )}
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
                  🎲 <b><Dice roll={res.roll} /></b>
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
            {/* Surincantation : pour chaque +2 DR (au-delà du NI pour un Sort, LDB 47 l.28-31 ;
                DR entier pour une Bénédiction/un Miracle, LDB 41/42), étendre la Durée
                (+durée initiale) ou la Cible (+1) — jamais « Vous »/« Spécial »/Instantanée. */}
            {(() => {
              if (!res.cast || caster.kind !== 'hero' || pc.zone) return null;
              const budget = Math.floor(Math.max(0, res.sl - (isPrayer || pc.focused ? 0 : ni)) / 2);
              if (budget <= 0) return null;
              const oc = pc.overcast ?? { duration: 0, targets: 0 };
              const left = budget - oc.duration - oc.targets;
              const canDuration = spell.duration != null && /rounds?/i.test(spell.duration ?? '');
              const canTargets = typeof spell.target === 'number' && spell.target >= 1 && spell.range !== 'Vous';
              if (!canDuration && !canTargets) return null;
              const pool = battle?.combatants ?? party;
              const candidates = overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile);
              return (
                <div className="rm-overcast">
                  <span className="mini-title">🌬️ Surincantation — surplus {left}×2 DR disponible</span>
                  <div className="modal-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    {canDuration && (
                      <button className="btn small" disabled={left <= 0} onClick={() => allocOvercast('duration')} title="Ajoute la durée initiale du sort (cumulable) — 2 DR">
                        ⏳ +Durée{oc.duration ? ` ×${oc.duration + 1}` : ''}
                      </button>
                    )}
                    {canTargets && (
                      <button className="btn small" disabled={left <= 0} onClick={() => allocOvercast('targets')} title="Cible supplémentaire (même jet) — 2 DR">
                        🎯 +Cible{oc.targets ? ` (+${oc.targets})` : ''}
                      </button>
                    )}
                  </div>
                  {oc.targets > 0 && (
                    <div className="modal-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                      {candidates.map((m) => {
                        const on = (pc.extraTargetIds ?? []).includes(m.id);
                        return (
                          <button key={m.id} className={`btn small ${on ? 'btn-primary' : ''}`} onClick={() => toggleExtraTarget(m.id)}>
                            {on ? '✓ ' : ''}{m.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            {/* Dissipation (LDB 46 l.201-202) : un héros lanceur ÉLIGIBLE oppose Langue (Magick) au
                Sort ennemi figé — gratuit, un seul par Round. Bloqué si le critique ennemi sera
                « Force inéluctable » (défaut IA d'un Sort non-Projectile réussi, l.59). */}
            {(() => {
              if (caster.kind !== 'enemy' || !res.cast || res.dispelled || isPrayer) return null;
              if (res.isCritical && !pc.missile) return null; // inéluctable (défaut IA)
              const cands = counterspellCandidates(battle ?? null, scene, caster, target).filter((c) => c.kind === 'hero');
              if (!cands.length) return null;
              return (
                <div className="rm-overcast">
                  <span className="mini-title">🛡️ Contre-sort (Dissipation) — Test opposé de Langue (Magick), 1/Round</span>
                  <div className="modal-actions" style={{ justifyContent: 'flex-start', flexWrap: 'wrap' }}>
                    {cands.map((h) => (
                      <button key={h.id} className="btn small" onClick={() => counterspell(h.id)} title="Gagné : le Sort est dissipé. Perdu : l'incantation se résout au DR net du Test opposé.">
                        🛡️ {h.name}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
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
                freeReroll={freeRerollOf(caster)}
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
    </Modal>
  );
}
