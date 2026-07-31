import type { ComponentProps } from 'react';
import { useGame, movementRemaining } from '../../state/store';
import { FLOWS } from '../../state/rollFlowSpecs';
import { HitLocation } from '../../engine/types';
import { crowdMod, bestRangedDefense, DEFENSE_LABEL, defenseModifiers, locationLabel, weaponInflictsFlames, attackTestLabel, isHelplessTarget } from '../../engine/combat';
import { isUnarmed } from '../../engine/items';
import { isInanimate } from '../../engine/structures';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { combatDistance } from '../../state/footprint';
import { firedWeapon, crowdEligible, previewAttack, previewDefense } from '../../state/combatFlow';
import { itemCapability } from '../../engine/capabilities';
import { attackModesFor } from '../../engine/combatFeatures/dispatch';
import { CritLocationPicker } from '../ForcedRollPicker';
import { DeterminationButton } from '../DeterminationButton';
import { CodexRef } from '../compendium/CodexRef';
import { RollShell, type RollRowData, type RollAction } from '../RollShell';
import { VsHeader } from '../VsHeader';
import { JournalLine } from '../NarratedLine';
import { ev } from '../../state/combatLog';
import { Icon } from '../Icon';

const LOCS: HitLocation[] = ['tete', 'corps', 'brasD', 'brasG', 'jambeD', 'jambeG'];

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'attaque — extrait de `RollModal`
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
  const weapon = firedWeapon(attacker, target, pa.weaponUid, battle.combatants); // arme + munition + sous-effectif du poste servi
  // Armes choisissables du loadout actif (hors Mains nues) : ≥2 → sélecteur d'arme d'attaque (main secondaire -20).
  const pickable = attacker.weapons.filter((w) => !isUnarmed(w) && !!w.uid);
  const res = pa.result;
  const rolled = !!res;
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
  const canHoldGround = !res && !pa.interrupt && weapon?.type === 'ranged' && attacker.kind === 'hero' && battle.movementUsed === 0 && movementRemaining(battle, attacker) > 0;
  // Mode de tir « corde séparée » (Lance-harpon, ADE II 02 l.677) : proposé au TIR d'un héros dont l'arme
  // tirée porte la capacité `ItemCapabilities.ropeMode` — jamais un id d'arme en dur (#476).
  const weaponItem = weapon ? attacker.items?.find((it) => it.uid === weapon.uid) : undefined;
  const canHarpoonRopeCut = !res && weapon?.type === 'ranged' && attacker.kind === 'hero' && !!weaponItem && itemCapability(weaponItem, 'ropeMode');
  // « Retenir ses coups » (Aux Armes 07 l.59-61) : maîtriser sans tuer. Proposé seulement quand c'est légal —
  // attaque de MÊLÉE (jamais tir/sort), arme qui n'inflige PAS *En flammes* (l.61), avant le jet.
  const canWithhold = !res && weapon?.type === 'melee' && attacker.kind === 'hero' && !weaponInflictsFlames(weapon);
  // « Empoignade » (LDB 14 l.159) : déclarée AVANT le jet, MAINS NUES seulement, en mêlée. Sur une touche,
  // « au lieu d'infliger des Dégâts », pose l'Empoignade (les deux) + l'État Empêtré (cible).
  const canGrapple = !res && weapon?.type === 'melee' && isUnarmed(weapon) && attacker.kind === 'hero';
  const rerollable = !!res && canReroll(!res.attackerDetail?.success, !!pa.rerolled);
  // Panneau pré-rempli (l'avant-jet = le résultat, pré-rempli) : MA ligne (score + mods) recalculée à
  // chaque changement d'option ; la ligne adverse via `previewDefense` (compétence + mods, sans valeur).
  const preview = !res ? previewAttack(useGame.getState, attacker, target, pa.location ?? undefined, { intoCrowd: pa.intoCrowd, heldGround: pa.heldGround, weaponUid: pa.weaponUid, harpoonRopeCut: pa.harpoonRopeCut }) : null;
  // Aperçu de la défense ADVERSE dans le panneau pré-jet. À distance, le tir n'est PAS opposé par
  // défaut (LDB 13 l.135) : on n'affiche une ligne de défense QUE si le RAW l'autorise (Parade avec
  // bouclier Protectrice 2+/tireur Engagé, Esquive à Bout Portant — `bestRangedDefense`). Sinon AUCUNE
  // ligne : le tir n'est juste pas opposé — ce n'est PAS un état « cible sans défense » (règle
  // particulière distincte). En mêlée : défense probable.
  const rangedDef = !res && weapon?.type === 'ranged' ? bestRangedDefense(attacker, target, weapon, combatDistance(attacker, target)) : undefined;
  const defenderPending = res
    ? undefined
    : weapon?.type === 'ranged'
      ? (rangedDef ? { label: DEFENSE_LABEL[rangedDef.mode], mods: defenseModifiers(target, rangedDef.mode, 0, rangedDef.parryWeapon) } : undefined)
      : isInanimate(target) ? undefined : previewDefense(target); // OBJET INANIMÉ (structure/véhicule/affût) : aucune Parade/Esquive → pas de ligne de défense
  // Cible Inconsciente (LDB États l.113) : le dé est DÉJÀ le meilleur choisi par le moteur (helplessTest,
  // succès + Critique forcés) — seule la Localisation reste un choix (LDB 17 l.68, CritLocationPicker
  // plus bas) ; pas de re-choix du dé lui-même (réservé à la Résilience volontaire, `pa.forced` manuel).
  const helplessForced = isHelplessTarget(target);
  // Cible Inconsciente : aucun choix de dé (opt-out du sélecteur dérivé par `RollShell`).
  // Inversion de Test (LDB 23 l.209, LDB 10 — CHOIX du joueur, #558) : offerte dès qu'une voie
  // (Talent/jeton) est applicable (`reverseAvailable`, pure) ; `reversePreview` rend l'issue LISIBLE
  // avant le clic (le jeton, libre, peut dégrader un succès existant).
  const reverseAvail = rolled && FLOWS.attack.reverseAvailable(useGame.getState, useGame.setState);
  const reversePreview = reverseAvail ? FLOWS.attack.reversePreview(useGame.getState, useGame.setState) : null;

  // Bloqué (pas de ligne de vue / hors de portée) : pas de jet possible → rangée sans ligne, message seul.
  const blocked = preview && (preview.blocked || !preview.inRange);

  // Rangée [0] = MON attaque (interactive, cycle d'influence).
  const attackerRow: RollRowData = {
    actor: attacker,
    row: res
      ? { combatant: attacker, d: res.attackerDetail }
      : blocked
        ? { combatant: attacker }
        : {
            combatant: attacker,
            pending: {
              label: attackTestLabel(preview!.weapon, preview!.kind),
              base: preview!.base,
              target: Math.max(0, Math.min(100, preview!.target)),
              mods: preview!.mods,
            },
          },
    rolled,
    rollFrisson: true,
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
    noForcedDie: helplessForced,
    onRoll: roll,
    reverse: reverseAvail ? { onReverse: reverseVerb, preview: reversePreview } : undefined,
  };
  // Rangée [1] éventuelle = défense adverse : aperçu pré-jet (compétence + mods, sans valeur) ou résultat témoin.
  const defenderRow: RollRowData | null = res
    ? (res.defenderDetail ? { row: { combatant: target, d: res.defenderDetail }, rolled, interactive: false } : null)
    : (!blocked && defenderPending ? { row: { combatant: target, pending: { ...defenderPending, mask: 'value' as const } }, rolled, interactive: false } : null);
  const rows = [attackerRow, ...(defenderRow ? [defenderRow] : [])];

  return {
    flowKey: 'attack',
    title: 'Attaque',
    subtitle: null,
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
          {/* Maniement de deux armes (LDB 10 l.638) : attaquer des DEUX armes pour son Action. */}
          {dualEligible && (
            <div className="rm-loc-inline rm-dual-toggle">
              <label>
                <input type="checkbox" checked={!!pa.dualMode} onChange={(e) => setDualMode(e.target.checked)} />
                <span className="mini-title"><Icon id="action/attack" size="sm" /> Des deux armes</span>
              </label>
              <CodexRef category="regles" id="combat-deux-armes" label="Combat à deux armes" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
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
              >
                {pickable.map((w) => (
                  <option key={w.uid} value={w.uid}>{w.label}{w.hand === 'off' ? ' (2nde -20)' : ''}</option>
                ))}
              </select>
              <CodexRef category="regles" id="main-secondaire" label="Attaque de la main secondaire" className="ab-codex-info"><Icon id="journal/info" size="sm" /></CodexRef>
            </div>
          )}
          {/* Localisation visée = choix RARE (par défaut « Au hasard ») → menu déroulant compact.
              Viser une localisation rend le Test Complexe (-10). MASQUÉ pour un OBJET INANIMÉ
              (structure/véhicule/affût : pas de Tableau de Localisation — on ne « vise » pas un membre d'un mur). */}
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
                  <option key={l} value={l}>{locationLabel(l, target.bodyShape)} (-10)</option>
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
    // Rendue en `postRollExtra` (2 rangées possibles → `outcome` du shell ne s'affiche qu'en mono).
    postRollExtra: res ? (
      <JournalLine
        className="rm-journal"
        event={ev(res.critical ? 'crit' : res.hit ? 'damage' : 'attack', res.log, attacker.id, target.id)}
        combatants={battle.combatants}
      />
    ) : undefined,
    forcedExtra: res?.critical && pa.forced ? <CritLocationPicker current={res.critLocation} onSet={setCritLocation} shape={target.bodyShape} /> : undefined,
    actions: [
      { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' } as RollAction,
      { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
    ],
  };
}
