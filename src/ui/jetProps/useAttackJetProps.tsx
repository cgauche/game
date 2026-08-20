import type { ComponentProps } from 'react';
import { useGame, movementRemaining } from '../../state/store';
import { FLOWS } from '../../state/rollFlowSpecs';
import { HitLocation, type Weapon } from '../../engine/types';
import type { RollLabelRef } from '../RollLine';
import { crowdMod, bestRangedDefense, locationLabel, weaponInflictsFlames, attackTestLabel, isHelplessTarget } from '../../engine/combat';
import { isUnarmed } from '../../engine/items';
import { isInanimate } from '../../engine/structures';
import { combatDistance } from '../../state/footprint';
import { attackWeaponOf, crowdEligible, previewAttack, previewDefense, defenseDodgeMod, surfacedDefensePending } from '../../state/combatFlow';
import { t } from '../../i18n';
import { itemCapability } from '../../engine/capabilities';
import { attackModesFor, offHandPenalty } from '../../engine/combatFeatures/dispatch';
import { CritLocationPicker } from '../ForcedRollPicker';
import { DeterminationButton } from '../DeterminationButton';
import { CodexRef } from '../compendium/CodexRef';
import { RollShell, type RollAction } from '../RollShell';
import { buildRollRow, witnessRow, type BuiltRollRow } from '../rollRowBuild';
import { VsHeader } from '../VsHeader';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../state/combatLog';
import { Icon } from '../Icon';
import { composeRollLabel } from '../../state/rollSeam';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/** Fiche Codex du NOM du jet d'attaque — MÊME source que son libellé (`attackTestLabel`) : une
 *  Résolution alternative déclarée par l'arme pointe la Caractéristique qui résout, sinon la
 *  Compétence lancée. Ids STABLES, jamais un libellé de recherche. */
function attackLabelRef(weapon: Weapon | undefined, kind: 'melee' | 'ranged'): RollLabelRef {
  const label = attackTestLabel(weapon, kind);
  return weapon?.resolveChar
    ? { category: 'characteristics', id: weapon.resolveChar, label }
    : { category: 'skills', id: kind === 'ranged' ? 'projectiles' : 'corps-a-corps', label };
}

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'attaque — hook à part de `RollModal`,
 * pour être réutilisé à l'IDENTIQUE par la séquence de combat (`CascadeModal` rend l'étape-jet via ce
 * hook, sans démonter la coquille → une seule fenêtre). Renvoie les props de `RollShell`, ou
 * `null` si aucune attaque en attente. AUCUNE mécanique générique réécrite : que du métier d'attaque.
 * La rangée [0] = MON attaque (interactive, cycle d'influence) ; la rangée [1] éventuelle = défense
 * adverse (aperçu pré-jet / résultat témoin) — figée (`interactive:false`).
 */
export function useAttackJetProps(): ComponentProps<typeof RollShell> | null {
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
  const reverseVerb = useGame((s) => s.attackReverse);
  const confirm = useGame((s) => s.attackConfirm);
  const cancel = useGame((s) => s.attackCancel);
  const setIntoCrowd = useGame((s) => s.attackSetIntoCrowd);
  const setHeldGround = useGame((s) => s.attackSetHeldGround);
  const setHarpoonRopeCut = useGame((s) => s.attackSetHarpoonRopeCut);
  const setWithhold = useGame((s) => s.attackSetWithhold);
  const setGrapple = useGame((s) => s.attackSetGrapple);
  const setCritLocation = useGame((s) => s.attackSetCritLocation);
  const spendResolve = useGame((s) => s.spendResolveCondition);
  if (!pa || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pa.attackerId);
  const target = battle.combatants.find((c) => c.id === pa.targetId);
  if (!attacker || !target) return null;
  // Arme RÉELLEMENT employée (arme + munition + sous-effectif du poste servi, arme NATURELLE d'une
  // manœuvre de trait comprise) : MÊME primitive que l'application (`attackConfirm`, #1026) — l'écran
  // et la fenêtre de Défense qui suit ne peuvent plus parler de deux armes différentes.
  const weapon = attackWeaponOf(battle, attacker, target, pa);
  const pickable = attacker.weapons.filter((w) => !isUnarmed(w) && !!w.uid);
  // LDB 14 (Tableau des Difficultés de Combat, « Attaquer avec votre main secondaire ») — valeur du
  // MOTEUR, la même que celle qui pèsera sur la cible (`attackModifiers`).
  const offPen = offHandPenalty(attacker);
  const res = pa.result;
  const rolled = !!res;
  // LDB 10 l.767-773
  const dualEligible = !res && attacker.kind === 'hero' && attackModesFor(attacker).includes('dual-wield')
    && attacker.weapons.some((w) => w.hand === 'main' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && attacker.weapons.some((w) => w.hand === 'off' && w.type === 'melee' && (w.hands ?? 1) === 1)
    && !pa.cleave && !pa.dualSecond;
  // LDB 14 l.106
  const crowd = !res && weapon?.type === 'ranged' ? crowdEligible(battle, attacker, target) : [];
  const cm = crowdMod(crowd.length);
  // LDB 14 l.70
  const canHoldGround = !res && !pa.interrupt && weapon?.type === 'ranged' && attacker.kind === 'hero' && battle.movementUsed === 0 && movementRemaining(battle, attacker) > 0;
  // ADE II 02 l.677
  const weaponItem = weapon ? attacker.items?.find((it) => it.uid === weapon.uid) : undefined;
  const canHarpoonRopeCut = !res && weapon?.type === 'ranged' && attacker.kind === 'hero' && !!weaponItem && itemCapability(weaponItem, 'ropeMode');
  // AA 07 l.59-61
  const canWithhold = !res && weapon?.type === 'melee' && attacker.kind === 'hero' && !weaponInflictsFlames(weapon);
  // LDB 14 l.159
  const canGrapple = !res && weapon?.type === 'melee' && isUnarmed(weapon) && attacker.kind === 'hero';
  // Panneau pré-rempli (l'avant-jet = le résultat, pré-rempli) : MA ligne (score + mods) recalculée à
  // chaque changement d'option ; la ligne adverse via `previewDefense` (compétence + mods, sans valeur).
  const preview = !res ? previewAttack(useGame.getState, attacker, target, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround, weaponUid: pa.weaponUid, harpoonRopeCut: pa.harpoonRopeCut }) : null;
  // LDB 13 l.135
  const rangedDef = !res && weapon?.type === 'ranged' ? bestRangedDefense(attacker, target, weapon, combatDistance(attacker, target)) : undefined;
  // La rangée adverse annonce la Difficulté que le jet de défense subira VRAIMENT : même pénalité
  // d'esquive que la résolution (`defenseDodgeMod`) et même arme attaquante (Rapide, LDB 62 l.298-302).
  const dodge = defenseDodgeMod(useGame.getState, target);
  const defenderPending = res
    ? undefined
    : weapon?.type === 'ranged'
      ? (rangedDef ? previewDefense(target, { mode: rangedDef.mode, parryWeapon: rangedDef.parryWeapon, vsWeapon: weapon, dodgeMod: dodge }) : undefined)
      : isInanimate(target) ? undefined : previewDefense(target, { vsWeapon: weapon, dodgeMod: dodge });
  // LDB 16 l.113 ; LDB 17 l.68
  const helplessForced = isHelplessTarget(target);
  // LDB 23 l.209 ; LDB 10
  const reverseAvail = rolled && FLOWS.attack.reverseAvailable(useGame.getState, useGame.setState);
  const reversePreview = reverseAvail ? FLOWS.attack.reversePreview(useGame.getState, useGame.setState) : null;

  // Bloqué (pas de ligne de vue / hors de portée) : pas de jet possible → rangée sans ligne, message seul.
  const blocked = preview && (preview.blocked || !preview.inRange);

  // Une fenêtre de Défense va-t-elle s'interposer avant l'application (#1004) ? Prédicat PARTAGÉ avec
  // `openSurfacedDefense` (`attackConfirm`) — jamais re-dérivé ici.
  const awaitingDefense = !!res && surfacedDefensePending(useGame.getState(), attacker, target, weapon, pa);

  // Rangée [0] = MON attaque (interactive, cycle d'influence).
  const attackerRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: res
      ? { combatant: attacker, d: res.attackerDetail }
      : blocked
        ? { combatant: attacker }
        : {
            combatant: attacker,
            pending: {
              label: attackTestLabel(preview!.weapon, preview!.kind),
              labelRef: attackLabelRef(preview!.weapon, preview!.kind),
              base: preview!.base,
              target: Math.max(0, Math.min(100, preview!.target)),
              mods: preview!.mods,
              difficulty: preview!.difficulty, // LDB 13 l.118 ; palier composé LDB 14 l.91-96
              ...(preview!.difficultyCombined != null ? { difficultyCombined: preview!.difficultyCombined } : {}),
              ...(preview!.difficultyParts ? { difficultyParts: preview!.difficultyParts } : {}),
              ...(preview!.clamped ? { clamped: preview!.clamped } : {}),
            },
          },
    rerolled: !!pa.rerolled,
    onReroll: reroll,
    onBonusSL: bonusSL,
    // Le second coup d'une attaque à DEUX ARMES n'offre pas le Sombre Pacte : l'OFFRE se dit par
    // l'absence du handler, jamais par un booléen que la coquille pourrait rallumer.
    ...(pa.dualSecond ? {} : { onDarkPact: darkPact }),
    onForce: forceSuccess,
    onRoll: roll,
  }, {
    rollFrisson: true,
    fortune: attacker.fortune ?? 0,
    resilience: attacker.resilience ?? 0,
    preRollForce: () => { roll(); forceSuccess(); },
    noForcedDie: helplessForced,
    reverse: reverseAvail ? { onReverse: reverseVerb, preview: reversePreview } : undefined,
  });
  // Rangée [1] éventuelle = défense adverse : aperçu pré-jet (compétence + mods, sans valeur) ou résultat témoin.
  const defenderRow: BuiltRollRow | null = res
    ? (res.defenderDetail ? witnessRow({ row: { combatant: target, d: res.defenderDetail } }) : null)
    : (!blocked && defenderPending ? buildRollRow({ row: { combatant: target, pending: { ...defenderPending, mask: 'value' as const } } }, { interactive: false }) : null);
  const rows = [attackerRow, ...(defenderRow ? [defenderRow] : [])];
  const attackTest = weapon?.resolveChar
    ? { char: weapon.resolveChar }
    : { skill: weapon?.type === 'ranged' ? 'projectiles' as const : 'corps-a-corps' as const };

  return {
    flowKey: 'attack',
    title: 'Attaque',
    subtitle: composeRollLabel(attacker, 'Attaque', attackTest),
    extra: (
      <VsHeader
        actor={attacker}
        target={target}
        label={<>{weapon?.label ?? 'Mains nues'}{preview ? <> · Dégâts +{preview.dmg}</> : null}</>}
      />
    ),
    rolled,
    onCancel: cancel,
    /* Options d'attaque + aperçu de la défense adverse + bouton Détermination (retirer un État), pré-jet. */
    setup: (
      <>
        <div className="rm-options">
          {/* LDB 10 l.767-773 */}
          {dualEligible && (
            <div className="rm-loc-inline rm-dual-toggle">
              <label>
                <input type="checkbox" checked={!!pa.dualMode} onChange={(e) => setDualMode(e.target.checked)} />
                <span className="mini-title"><Icon id="action/attack" size="sm" /> Des deux armes</span>
              </label>
              <CodexRef category="regles" id="combat-deux-armes" label="Combat à deux armes" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {pickable.length >= 2 && !pa.dualMode && (
            <div className="rm-loc-inline">
              <span className="mini-title">Arme</span>
              <select
                className="rm-loc-select"
                value={pa.weaponUid ?? weapon.uid ?? ''}
                onChange={(e) => setWeapon(e.target.value || null)}
              >
                {/* La pénalité affichée est celle du MOTEUR (`offHandPenalty` : le Talent
                    Ambidextre la réduit puis l'annule) — un « -20 » écrit ici mentirait à l'écran
                    du personnage qui ne la subit pas. Nulle ⇒ rien à annoncer. */}
                {pickable.map((w) => (
                  <option key={w.uid} value={w.uid}>{w.label}{w.hand === 'off' && offPen ? ` (2nde ${offPen})` : ''}</option>
                ))}
              </select>
              <CodexRef category="regles" id="main-secondaire" label="Attaque de la main secondaire" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {!isInanimate(target) && (
            <div className="rm-loc-inline">
              <span className="mini-title">Localisation</span>
              <select
                className="rm-loc-select"
                value={pa.location ?? ''}
                onChange={(e) => setLocation((e.target.value as HitLocation) || null)}
              >
                <option value="">Au hasard</option>
                {LOCS.map((l) => (
                  <option key={l} value={l}>{locationLabel(l, target.bodyShape)} (-20)</option>
                ))}
              </select>
              <CodexRef category="regles" id="viser-une-localisation" label="Viser une Localisation" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {cm && (
            <div className="rm-crowd">
              <button
                className={`btn small ${pa.intoCrowd ? 'btn-primary' : ''}`}
                onClick={() => setIntoCrowd(!pa.intoCrowd)}
              >
                <Icon id="action/aim" size="sm" /> Tirer dans le tas (+{cm.value})
              </button>
              <CodexRef category="regles" id="tirer-dans-le-tas" label="Tirer dans le tas" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              {pa.intoCrowd && <span className="rm-crowd-note">{crowd.length} au contact — touche au hasard, 0 DR si sauvé par le bonus.</span>}
            </div>
          )}
          {canHoldGround && (
            <div className="rm-crowd">
              <button
                className={`btn small ${pa.heldGround ? 'btn-primary' : ''}`}
                onClick={() => setHeldGround(!pa.heldGround)}
              >
                <Icon id="travel/anchor" size="sm" /> Je ne bouge pas (annule le -10)
              </button>
              <CodexRef category="regles" id="tir-en-mouvement" label="Tirer en se déplaçant" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              {pa.heldGround
                ? <span className="rm-crowd-note">Immobile : pas de -10, mais Mouvement du Tour consommé.</span>
                : <span className="rm-crowd-note">Tir mobile : -10 « Tir en bougeant » (tu gardes ton Mouvement).</span>}
            </div>
          )}
          {canHarpoonRopeCut && (
            <div className="rm-crowd">
              <button
                className={`btn small ${pa.harpoonRopeCut ? 'btn-primary' : ''}`}
                onClick={() => setHarpoonRopeCut(!pa.harpoonRopeCut)}
              >
                <Icon id="action/aim" size="sm" /> Tirer sans la corde (60 m, sans Immobilisante)
              </button>
              {pa.harpoonRopeCut
                ? <span className="rm-crowd-note">Corde séparée : Portée 60, mais la cible n'est plus Immobilisée.</span>
                : <span className="rm-crowd-note">Corde tenue : Immobilisante, Portée 20.</span>}
            </div>
          )}
          {canWithhold && (
            <div className="rm-crowd">
              <button
                className={`btn small ${pa.withhold ? 'btn-primary' : ''}`}
                onClick={() => setWithhold(!pa.withhold)}
              >
                <Icon id="melee/pulled-punch" size="sm" /> Retenir ses coups
              </button>
              <CodexRef category="regles" id="retenir-ses-coups" label="Retenir ses coups (maîtriser sans tuer)" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              {pa.withhold && <span className="rm-crowd-note">Non létal : Critique seulement si la cible tombe à 0 ; sans Empaleuse/Percutante/Perforante/Taille.</span>}
            </div>
          )}
          {canGrapple && (
            <div className="rm-crowd">
              <button
                className={`btn small ${pa.grapple ? 'btn-primary' : ''}`}
                onClick={() => setGrapple(!pa.grapple)}
              >
                <Icon id="melee/grapple" size="sm" /> Empoigner
              </button>
              <CodexRef category="regles" id="empoignade" label="Empoignade" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
              {pa.grapple && <span className="rm-crowd-note">Sur une touche : aucun Dégât ; Empoignade + Empêtré (cible).</span>}
            </div>
          )}
        </div>
        {blocked && (
          <div className="rm-blocked"><Icon id="ui/warning" size="sm" /> {preview!.blocked ? 'Pas de ligne de vue' : 'Hors de portée'}</div>
        )}
        <DeterminationButton combatant={attacker} onSpend={(name) => spendResolve(attacker.id, name)} />
      </>
    ),
    rows,
    winnerIndex: res?.defenderDetail ? (res.hit ? 0 : 1) : undefined,
    netSL: res?.defenderDetail ? res.netSL : undefined,
    // Issue = LA ligne de journal du moteur (`res.log` : « X touche Y (loc) : N − (BE+PA) = Z Blessures »),
    // pas une ligne condensée dupliquée. Source unique, le calcul des Dégâts est visible dans la popin.
    // #1004 : quand une fenêtre de Défense va s'interposer (`surfacedDefensePending`, MÊME prédicat que
    // `openSurfacedDefense`), `res` est une résolution `defense:'none'` contre PERSONNE — son verdict et
    // ses Dégâts seraient invalidés par l'opposition qui suit. Il n'y a alors AUCUNE issue : seule une
    // ATTENTE s'affiche (zone d'état, `postRollExtra`) ; le verdict réel s'énonce après la Défense.
    outcome: res && !awaitingDefense
      ? [recapLineOfEvent(
          ev(res.critical ? 'crit' : res.hit ? 'damage' : 'attack', res.log, attacker.id, target.id),
          battle.combatants,
        )]
      : undefined,
    postRollExtra: res && awaitingDefense
      ? <p className="rm-await">{t('defense.awaiting', { cible: target.label })}</p>
      : undefined,
    forcedExtra: res?.critical && pa.forced ? <CritLocationPicker current={res.critLocation} onSet={setCritLocation} shape={target.bodyShape} /> : undefined,
    actions: [
      { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' } as RollAction,
      { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
    ],
  };
}
