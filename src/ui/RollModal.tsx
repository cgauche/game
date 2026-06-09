import { useGame, movementRemaining } from '../state/store';
import { HitLocation, HIT_LOCATION_LABELS } from '../engine/types';
import { RollBreakdown, crowdMod } from '../engine/combat';
import { canReroll } from '../engine/fortune';
import { firedWeapon, crowdEligible, previewAttack } from '../state/combatFlow';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';
import { CombatantBadge } from './CombatantBadge';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/** Une ligne de jet : base + modificateurs = cible · d100 · DR (✓/✗), + le détail étiqueté
 *  des modificateurs (« Courte portée +40 », « Viser +20 »…) quand il reconcilie le total. */
export function RollLine({ d }: { d: RollBreakdown }) {
  const roll = d.roll === 100 ? '00' : String(d.roll).padStart(2, '0');
  const mod = d.modifier === 0 ? '' : ` ${d.modifier > 0 ? '+' : '−'}${Math.abs(d.modifier)}`;
  const mods = d.mods ?? [];
  const showMods = mods.length > 0 && mods.reduce((s, m) => s + m.value, 0) === d.modifier;
  return (
    <div className="rm-roll-block">
      <div className={`rm-roll ${d.success ? 'ok' : 'fail'}`}>
        <span className="rm-roll-label">{d.label}</span>
        <span className="rm-roll-calc" title="Compétence de base + modificateurs détaillés ci-dessous = cible à ne pas dépasser">
          {d.base}
          {mod} = <b>{d.target}</b>
        </span>
        <span className="rm-roll-dice">
          🎲 <b>{roll}</b>
        </span>
        <span className="rm-roll-sl">
          {d.success ? '✓' : '✗'} {d.sl >= 0 ? '+' : '−'}
          {Math.abs(d.sl)} DR
        </span>
      </div>
      {showMods && (
        <div className="rm-roll-mods">
          {mods.map((m, i) => (
            <span key={i} className={`rm-mod ${m.value >= 0 ? 'pos' : 'neg'}`}>
              {m.value >= 0 ? '+' : '−'}
              {Math.abs(m.value)} {m.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Modale d'attaque : on choisit la localisation visée (Complexe -10), on clique
 * « Lancer » pour faire le jet, puis on peut dépenser un point de Chance pour
 * relancer avant d'appliquer le résultat (LDB Destin / Combat).
 *
 * La mêlée est un TEST OPPOSÉ : on affiche donc les DEUX jets (attaquant ET défenseur),
 * leur cible (base + modificateurs) et leur DR — c'est le DR net qui décide.
 */
export function RollModal() {
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const setLocation = useGame((s) => s.attackSetLocation);
  const roll = useGame((s) => s.attackRoll);
  const reroll = useGame((s) => s.attackReroll);
  const bonusSL = useGame((s) => s.attackBonusSL);
  const forceSuccess = useGame((s) => s.attackForceSuccess);
  const confirm = useGame((s) => s.attackConfirm);
  const cancel = useGame((s) => s.attackCancel);
  const setIntoCrowd = useGame((s) => s.attackSetIntoCrowd);
  const setHeldGround = useGame((s) => s.attackSetHeldGround);
  const setCritLocation = useGame((s) => s.attackSetCritLocation);
  if (!pa || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
  const target = battle.combatants.find((c) => c.id === pa.targetId);
  if (!attacker || !target) return null;
  const weapon = firedWeapon(attacker, target); // arme RÉELLEMENT tirée (mêlée au contact / distance + munition), pas weapons[0]
  const res = pa.result;
  // « Tirer dans le tas » (LDB 14 l.136/146) : proposé au TIR quand ≥3 combattants sont serrés au contact de la cible.
  const crowd = !res && weapon?.type === 'ranged' ? crowdEligible(battle, attacker, target) : [];
  const cm = crowdMod(crowd.length);
  // Tir IMMOBILE (LDB 14 l.101) : proposé au TIR d'un héros qui n'a pas encore bougé ET qui PEUT encore se
  // déplacer (sinon il est immobile d'office, pas de −10 à annuler) — annule le −10 « Tir en bougeant » au
  // prix de son Mouvement du Tour (Mouvement décomposable : sinon on tirerait puis bougerait).
  const canHoldGround = !res && weapon?.type === 'ranged' && attacker.kind === 'hero' && battle.movementUsed === 0 && movementRemaining(battle, attacker) > 0;
  const fortune = attacker.fortune ?? 0;
  const rerollable = !!res && canReroll(!res.attackerDetail?.success, !!pa.rerolled);
  // Aperçu AVANT le jet (R4) : valeur de toucher + décomposition des modificateurs (plus de « validation à
  // l'aveugle »). Recalculé à chaque changement d'option (localisation / Tirer dans le tas / immobile).
  const preview = !res ? previewAttack(useGame.getState, attacker, target, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround }) : null;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>Attaque</h3>
        <div className="rm-vs">
          <CombatantBadge combatant={attacker} />
          <span className="rm-vs-arrow"><span className="rm-weapon">{weapon?.name ?? 'Mains nues'}</span><br />→</span>
          <CombatantBadge combatant={target} />
        </div>

        {!res ? (
          <>
            <div className="rm-loc">
              <span className="mini-title">Localisation visée {pa.location && <em className="rm-pen">(-10)</em>}</span>
              <div className="rm-loc-grid">
                <button className={`btn small ${pa.location == null ? 'btn-primary' : ''}`} onClick={() => setLocation(null)}>
                  Au hasard
                </button>
                {LOCS.map((l) => (
                  <button key={l} className={`btn small ${pa.location === l ? 'btn-primary' : ''}`} onClick={() => setLocation(l)}>
                    {HIT_LOCATION_LABELS[l]}
                  </button>
                ))}
              </div>
            </div>
            {cm && (
              <div className="rm-crowd">
                <button
                  className={`btn small ${pa.intoCrowd ? 'btn-primary' : ''}`}
                  onClick={() => setIntoCrowd(!pa.intoCrowd)}
                  title="Tu ne choisis pas ta cible : un combattant au contact de la cible (les DEUX camps — tir fratricide possible) est touché au hasard, mais tu gagnes le bonus, et un succès dû au seul bonus est à 0 DR."
                >
                  🎯 Tirer dans le tas (+{cm.value})
                </button>
                {pa.intoCrowd && <span className="rm-crowd-note">{crowd.length} au contact — touche au hasard, 0 DR si sauvé par le bonus.</span>}
              </div>
            )}
            {canHoldGround && (
              <div className="rm-crowd">
                <button
                  className={`btn small ${pa.heldGround ? 'btn-primary' : ''}`}
                  onClick={() => setHeldGround(!pa.heldGround)}
                  title="Tire sans bouger : annule la pénalité -10 « Tir en bougeant », mais consomme ton Mouvement du Tour (tu ne pourras plus te déplacer)."
                >
                  🦿 Je ne bouge pas (annule le -10)
                </button>
                {pa.heldGround
                  ? <span className="rm-crowd-note">Immobile : pas de -10, mais Mouvement du Tour consommé.</span>
                  : <span className="rm-crowd-note">Tir mobile : -10 « Tir en bougeant » (tu gardes ton Mouvement).</span>}
              </div>
            )}
            {preview && (preview.blocked ? (
              <div className="rm-preview bad">⛔ Pas de ligne de vue</div>
            ) : !preview.inRange ? (
              <div className="rm-preview bad">⛔ Hors de portée</div>
            ) : (
              <div className="rm-preview">
                <div className="rm-preview-hit">🎯 Toucher : <b>{Math.max(0, Math.min(100, preview.target))}%</b></div>
                {preview.mods.length > 0 && (
                  <div className="rm-roll-mods">
                    {preview.mods.map((m, i) => (
                      <span key={i} className={`rm-mod ${m.value >= 0 ? 'pos' : 'neg'}`}>
                        {m.value >= 0 ? '+' : '−'}{Math.abs(m.value)} {m.label}
                      </span>
                    ))}
                  </div>
                )}
                <div className="rm-preview-dmg" title="Blessures = Dégâts d'arme + DR du jet − (Bonus d'Endurance + PA). Plancher 1.">
                  ⚔️ Dégâts : <b>{preview.dmg}</b> + DR − <b>{preview.soak}</b> encaissé · ≈ <b>{Math.max(1, preview.dmg - preview.soak)}+</b> Blessures
                </div>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn" onClick={cancel}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={roll}>
                🎲 Lancer
              </button>
              {/* Résilience AVANT le jet (LDB 17 l.73) : on lance puis on force la réussite (résultat correct garanti). */}
              <ResilienceButton resilience={attacker.resilience ?? 0} show={(attacker.resilience ?? 0) > 0} onForce={() => { roll(); forceSuccess(); }} />
            </div>
          </>
        ) : (
          <>
            <div className="rm-rolls">
              {res.attackerDetail && <RollLine d={res.attackerDetail} />}
              {res.defenderDetail && <RollLine d={res.defenderDetail} />}
            </div>
            <div className={`rm-verdict ${res.hit ? 'ok' : 'fail'}`}>
              {res.hit ? (
                <>
                  Touché{res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}
                  {res.woundsLost ? ` · ${res.woundsLost} Blessure(s)` : ''}
                  {res.defenderDetail ? ` · DR net +${res.netSL}` : ''}
                  {res.critical ? ' · CRITIQUE' : ''}
                </>
              ) : res.defenderDetail ? (
                'Défense réussie — coup paré / esquivé'
              ) : (
                'Manqué'
              )}
            </div>
            <p className="rm-log">{res.log}</p>
            {res.critical && pa.forced && (
              <div className="rm-loc">
                {/* RAW-2 (LDB 17 l.73) : sur un Coup Critique forcé, le joueur CHOISIT la localisation atteinte. */}
                <span className="mini-title">🔥 Localisation du Coup Critique (Je ne faillirai pas !)</span>
                <div className="rm-loc-grid">
                  {LOCS.map((l) => (
                    <button key={l} className={`btn small ${res.critLocation === l ? 'btn-primary' : ''}`} onClick={() => setCritLocation(l)}>
                      {HIT_LOCATION_LABELS[l]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={attacker.resilience ?? 0} show={!!res && !res.hit} onForce={forceSuccess} />
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
