import type { ComponentProps } from 'react';
import { useGame, movementRemaining } from '../../state/store';
import { FLOWS } from '../../state/rollFlows';
import { HitLocation, HIT_LOCATION_LABELS } from '../../engine/types';
import { combatValue, crowdMod, bestRangedDefense, DEFENSE_LABEL, defenseModifiers } from '../../engine/combat';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { combatDistance } from '../../state/footprint';
import { firedWeapon, crowdEligible, previewAttack, previewDefense } from '../../state/combatFlow';
import { attackModesFor } from '../../engine/combatFeatures/dispatch';
import { CritLocationPicker } from '../ForcedRollPicker';
import { DeterminationButton } from '../DeterminationButton';
import { RollFlowShell } from '../RollFlowShell';
import { RollPanel } from '../RollPanel';
import { VsHeader } from '../VsHeader';
import { JournalLine } from '../NarratedLine';
import { ev } from '../../state/combatLog';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/**
 * PARAMÉTRAGE de la coquille partagée `RollFlowShell` pour le JET d'attaque — extrait de `RollModal`
 * pour être réutilisé à l'IDENTIQUE par la séquence de combat (`CascadeModal` rend l'étape-jet via ce
 * hook, sans démonter la coquille → une seule fenêtre). Renvoie les props de `RollFlowShell`, ou
 * `null` si aucune attaque en attente. AUCUNE mécanique générique réécrite : que du métier d'attaque.
 */
export function useAttackJetProps(): ComponentProps<typeof RollFlowShell> | null {
  const pa = useGame((s) => s.pendingAttack);
  const battle = useGame((s) => s.battle);
  const setLocation = useGame((s) => s.attackSetLocation);
  const setWeapon = useGame((s) => s.attackSetWeapon);
  const setDualMode = useGame((s) => s.attackSetDualMode);
  const roll = useGame((s) => s.attackRoll);
  const reroll = useGame((s) => s.attackReroll);
  const bonusSL = useGame((s) => s.attackBonusSL);
  const darkPact = useGame((s) => s.attackDarkPact);
  const forceSuccess = useGame((s) => s.attackForceSuccess);
  const confirm = useGame((s) => s.attackConfirm);
  const cancel = useGame((s) => s.attackCancel);
  const setIntoCrowd = useGame((s) => s.attackSetIntoCrowd);
  const setHeldGround = useGame((s) => s.attackSetHeldGround);
  const setCritLocation = useGame((s) => s.attackSetCritLocation);
  const setForcedRoll = useGame((s) => s.attackSetForcedRoll);
  const spendResolve = useGame((s) => s.spendResolveCondition);
  if (!pa || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
  const target = battle.combatants.find((c) => c.id === pa.targetId);
  if (!attacker || !target) return null;
  const weapon = firedWeapon(attacker, target, pa.weaponUid); // arme choisie (ou auto, mêlée au contact / distance) + munition
  // Armes choisissables du loadout actif (hors Mains nues) : ≥2 → sélecteur d'arme d'attaque (main secondaire -20).
  const pickable = attacker.weapons.filter((w) => w.name !== 'Mains nues' && !!w.uid);
  const res = pa.result;
  // Maniement de deux armes (LDB 10 l.638) : proposé seulement à un héros qui a le talent ET tient 2 armes de
  // MÊLÉE à 1 main, sur l'attaque-ACTION (jamais une frappe gratuite/enchaînée — ni cleave, ni 2ᵉ frappe).
  const dualEligible = !res && attacker.kind === 'hero' && attackModesFor(attacker).includes('dual-wield')
    && attacker.weapons.some((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && attacker.weapons.some((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && !pa.cleave && !pa.dualSecond;
  // « Tirer dans le tas » (LDB 14 l.136/146) : proposé au TIR quand ≥3 combattants sont serrés au contact de la cible.
  const crowd = !res && weapon?.type === 'ranged' ? crowdEligible(battle, attacker, target) : [];
  const cm = crowdMod(crowd.length);
  // Tir IMMOBILE (LDB 14 l.101) : proposé au TIR d'un héros qui n'a pas encore bougé ET qui PEUT encore se
  // déplacer (sinon il est immobile d'office, pas de −10 à annuler) — annule le −10 « Tir en bougeant » au
  // prix de son Mouvement du Tour (Mouvement décomposable : sinon on tirerait puis bougerait).
  const canHoldGround = !res && weapon?.type === 'ranged' && attacker.kind === 'hero' && battle.movementUsed === 0 && movementRemaining(battle, attacker) > 0;
  const rerollable = !!res && canReroll(!res.attackerDetail?.success, !!pa.rerolled);
  // Panneau pré-rempli (l'avant-jet = le résultat, pré-rempli) : MA ligne (score + mods) recalculée à
  // chaque changement d'option ; la ligne adverse via `previewDefense` (compétence + mods, sans valeur).
  const preview = !res ? previewAttack(useGame.getState, attacker, target, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround, weaponUid: pa.weaponUid }) : null;
  // Aperçu de la défense ADVERSE. À distance, le tir n'est PAS opposé par défaut (LDB 13 l.135) : on
  // n'affiche une défense que si le RAW l'autorise (Protectrice 2+ / Bout Portant / tireur Engagé,
  // `bestRangedDefense`), sinon « Sans défense » — fini le « Parade » fantôme. En mêlée : défense probable.
  const defenderPreview = !res && preview && !preview.blocked && preview.inRange
    ? weapon?.type === 'ranged'
      ? (() => {
          const rd = bestRangedDefense(attacker, target, weapon, combatDistance(attacker, target));
          return rd
            ? { label: DEFENSE_LABEL[rd.mode], mods: defenseModifiers(target, rd.mode, 0, rd.parryWeapon) }
            : { label: 'Sans défense', mods: [] };
        })()
      : previewDefense(target)
    : null;
  const forcedDie = FLOWS.attack.picker?.(pa, attacker); // dé choisi (source unique : caps.picker)
  // Issue COURTE (1 ligne, sans répéter les noms — le panneau dit déjà qui) à la place du log complet.
  const outcome = res
    ? res.critical
      ? `Coup Critique${res.critLocation || res.location ? ` — ${HIT_LOCATION_LABELS[(res.critLocation ?? res.location)!]}` : ''}${res.woundsLost ? ` · ${res.woundsLost} Blessure${res.woundsLost > 1 ? 's' : ''}` : ''}${res.defenderDefeated ? ' · hors de combat !' : ''}`
      : res.hit
        ? `Touché${res.location ? ` — ${HIT_LOCATION_LABELS[res.location]}` : ''}${res.woundsLost != null ? ` · ${res.woundsLost} Blessure${(res.woundsLost ?? 0) > 1 ? 's' : ''}` : ''}${res.defenderDefeated ? ' · hors de combat !' : ''}`
        : `Attaque déjouée${res.advantageTo === 'defender' ? " — l'adversaire gagne l'Avantage" : ''}`
    : '';

  return {
    title: 'Attaque',
    subtitle: null,
    extra: (
      <VsHeader
        actor={attacker}
        target={target}
        label={<>{weapon?.name ?? 'Mains nues'}{preview ? <> · Dégâts +{preview.dmg}</> : null}</>}
      />
    ),
    rolled: !!res,
    onRoll: roll,
    rollFrisson: true,
    onCancel: cancel,
    setup: (
      <>
        <div className="rm-options">
          {/* Maniement de deux armes (LDB 10 l.638) : attaquer des DEUX armes pour son Action. */}
          {dualEligible && (
            <label
              className="rm-loc-inline rm-dual-toggle"
              title="Frapper des deux armes : 2ᵉ frappe de la main secondaire si la 1ʳᵉ touche ; -10 à TOUTES vos défenses jusqu'à votre prochain Tour ; Avantage seulement si les deux touchent."
            >
              <input type="checkbox" checked={!!pa.dualMode} onChange={(e) => setDualMode(e.target.checked)} />
              <span className="mini-title">⚔️ Des deux armes</span>
            </label>
          )}
          {/* Choix d'arme (dual-wield) : la main secondaire affiche son -20 ; le panneau reflète le mod.
              Masqué en mode « des deux armes » (l'attaque-Action utilise alors la main directrice). */}
          {pickable.length >= 2 && !pa.dualMode && (
            <div className="rm-loc-inline">
              <span className="mini-title">Arme</span>
              <select
                className="rm-loc-select"
                value={pa.weaponUid ?? weapon.uid ?? ''}
                onChange={(e) => setWeapon(e.target.value || null)}
                title="Avec quelle arme frapper ? La main secondaire subit -20 (réduit par Ambidextre)."
              >
                {pickable.map((w) => (
                  <option key={w.uid} value={w.uid}>{w.name}{w.hand === 'off' ? ' (2nde -20)' : ''}</option>
                ))}
              </select>
            </div>
          )}
          {/* Localisation visée = choix RARE (par défaut « Au hasard ») → menu déroulant compact.
              Viser une localisation rend le Test Complexe (-10). */}
          <div className="rm-loc-inline">
            <span className="mini-title">Localisation</span>
            <select
              className="rm-loc-select"
              value={pa.location ?? ''}
              onChange={(e) => setLocation((e.target.value as HitLocation) || null)}
              title="Où frapper ? « Au hasard » par défaut ; viser une localisation précise rend le Test Complexe (-10)."
            >
              <option value="">🎯 Au hasard</option>
              {LOCS.map((l) => (
                <option key={l} value={l}>{HIT_LOCATION_LABELS[l]} (-10)</option>
              ))}
            </select>
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
        </div>
        {preview && (preview.blocked || !preview.inRange ? (
          <div className="rm-blocked">⛔ {preview.blocked ? 'Pas de ligne de vue' : 'Hors de portée'}</div>
        ) : (
          <RollPanel
            rows={[
              {
                combatant: attacker,
                pending: {
                  label: preview.kind === 'ranged' ? 'Projectiles' : 'Corps à corps',
                  base: combatValue(attacker, preview.kind, weapon),
                  target: Math.max(0, Math.min(100, preview.target)),
                  mods: preview.mods,
                },
              },
              { combatant: target, pending: { ...(defenderPreview ?? previewDefense(target)), hideValue: true } },
            ]}
          />
        ))}
      </>
    ),
    preInfluence: <DeterminationButton combatant={attacker} onSpend={(name) => spendResolve(attacker.id, name)} />,
    rows: res ? [{ combatant: attacker, d: res.attackerDetail }, { combatant: target, d: res.defenderDetail }] : undefined,
    winnerIndex: res?.defenderDetail ? (res.hit ? 0 : 1) : undefined,
    netSL: res?.defenderDetail ? res.netSL : undefined,
    outcome: res ? (
      <JournalLine
        className="rm-journal"
        event={ev(res.critical ? 'crit' : res.hit ? 'damage' : 'attack', outcome, attacker.id, target.id)}
        combatants={battle.combatants}
      />
    ) : undefined,
    forcedRoll: forcedDie ? { ...forcedDie, onSet: setForcedRoll } : undefined,
    forcedExtra: res?.critical && pa.forced ? <CritLocationPicker current={res.critLocation} onSet={setCritLocation} /> : undefined,
    fortune: attacker.fortune ?? 0,
    freeReroll: freeRerollOf(attacker),
    rerollable,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: attacker.kind === 'hero' && !pa.dualSecond && !!res && !res.attackerDetail?.success,
    onDarkPact: darkPact,
    resilience: attacker.resilience ?? 0,
    onForce: forceSuccess,
    preRollForce: () => { roll(); forceSuccess(); },
    forceShow: !!res && !res.hit,
    onConfirm: confirm,
  };
}
