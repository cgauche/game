import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { FLOWS } from '../state/rollFlows';
import { overcastTargetCandidates, previewCast } from '../state/combatFlow';
import { findSpellById } from '../data/index';
import { spellEffectOps } from '../state/flow';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { testValue } from '../engine/skills';
import { castingValue } from '../engine/magic';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { CharFrame } from './CharFrame';
import { RollFlowShell } from './RollFlowShell';
import { RollPanel } from './RollPanel';
import { VsHeader } from './VsHeader';
import { ParticipantRow } from './ParticipantRow';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Modale d'incantation — paramétrage de la coquille PARTAGÉE `RollFlowShell` (comme Attaque/Défense) :
 * on sélectionne un sort + une cible, « Lancer » fait le jet, on voit le résultat (réussite DR ≥ NI,
 * échec, ou Maladresse), Chance/Pacte/Résilience en rangée d'influence, puis « Appliquer ». Le métier
 * propre à l'incantation (Surincantation, Contre-sort, choix du Critique, pose de zone) passe par les
 * slots `setup`/`postRollExtra` ; toute la mécanique générique vit dans la coquille.
 *
 * Surincantation « +Cible » : EN COMBAT, le choix des cibles supplémentaires se fait SUR LE CHAMP
 * DE BATAILLE (`castPickTargets` efface la modale, bandeau TargetPrompt + clic carte) ; hors
 * combat (pas de carte tactique), repli sur des boutons-portraits dans la modale.
 */
export function CastModal() {
  const pc = useGame((s) => s.pendingCast);
  const battle = useGame((s) => s.battle);
  const scene = useGame((s) => s.scene);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.castRoll);
  const reroll = useGame((s) => s.castReroll);
  const bonusSL = useGame((s) => s.castBonusSL);
  const darkPact = useGame((s) => s.castDarkPact);
  const setCritChoice = useGame((s) => s.castSetCritChoice);
  const setConjureForm = useGame((s) => s.castSetConjureForm);
  const allocOvercast = useGame((s) => s.castAllocOvercast);
  const toggleExtraTarget = useGame((s) => s.castToggleExtraTarget);
  const pickTargets = useGame((s) => s.castPickTargets);
  const placeZone = useGame((s) => s.castPlaceZone);
  const forceSuccess = useGame((s) => s.castForceSuccess);
  const setForcedRoll = useGame((s) => s.castSetForcedRoll);
  const confirm = useGame((s) => s.castConfirm);
  const cancel = useGame((s) => s.castCancel);
  // Opposition de la cible (multijet DANS cette modale) : chaque cible oppose son Test (FM/Int/Bagarre).
  const pcs = useGame((s) => s.pendingCastOpposition);
  const oppRoll = useGame((s) => s.oppositionRoll);
  const oppReroll = useGame((s) => s.oppositionReroll);
  const oppBonusSL = useGame((s) => s.oppositionBonusSL);
  const oppDarkPact = useGame((s) => s.oppositionDarkPact);
  const oppForce = useGame((s) => s.oppositionForceSuccess);
  const oppConfirm = useGame((s) => s.oppositionConfirm);
  // Contre-sort (Dissipation) : RÉACTION au Sort ENNEMI figé dans `pendingCast` — plus de modale
  // séparée (« le contre-sort, c'est le lancement d'un sort qui peut être opposé »). Chaque héros
  // contre-lanceur a SA rangée (`ParticipantRow`), DANS cette modale d'incantation, exactement comme
  // l'opposition de cible ci-dessus. « Laisser passer »/« Appliquer » agrègent via `counterspellConfirm`.
  const csp = useGame((s) => s.pendingCounterspell);
  const cspRoll = useGame((s) => s.counterspellRoll);
  const cspReroll = useGame((s) => s.counterspellReroll);
  const cspBonusSL = useGame((s) => s.counterspellBonusSL);
  const cspDarkPact = useGame((s) => s.counterspellDarkPact);
  const cspForce = useGame((s) => s.counterspellForceSuccess);
  const cspConfirm = useGame((s) => s.counterspellConfirm);
  const cspCancel = useGame((s) => s.counterspellCancel);
  const net = useGame((s) => s.net);
  if (!pc) return null;
  const pool = battle?.combatants ?? party; // même modale en combat (file) et hors combat (groupe)
  const caster = pool.find((c) => c.id === pc.casterId);
  const target = pool.find((c) => c.id === pc.targetId);
  const spell = findSpellById(pc.spellId);
  if (!caster || !target || !spell) return null;
  const res = pc.result;
  const rerollable = !!res && canReroll(res.roll > res.target, !!pc.rerolled);
  const isPrayer = spell.cn == null;
  const ni = spell.cn ?? 0;
  const selfTarget = caster.id === target.id;
  // Arme invoquée à forme libre (Arme aethyrique, op grantWeapon + chooseForm) : le lanceur choisit
  // la Compétence de Corps à corps / le profil d'arme avant d'appliquer (RAW LDB 47). Sinon : [].
  const conjureForms = spellEffectOps(spell.effects).some((o) => o.op === 'grantWeapon' && o.chooseForm)
    ? conjureFormOptions(caster) : [];
  const selectedForm = pc.conjureForm ?? conjureForms[0];
  // ZONE non posée (flux « jet puis pose », LDB 47 l.29/44) : pas de cible — le gabarit se dépose
  // APRÈS le jet et la Surincantation. « Puissance totale » (crit) repêche un DR insuffisant.
  const zoneUnplaced = !!pc.zone && !pc.zone.center;
  const placeable = zoneUnplaced && !!res && !res.dispelled &&
    (res.cast || (!!res.isCritical && (pc.critChoice ?? 'puissance') === 'puissance'));
  const forcedDie = FLOWS.cast.picker?.(pc, caster); // dé choisi (source unique : caps.picker)
  // Issue COURTE (1 ligne) — le panneau dit déjà qui lance quoi sur qui.
  const outcome = !res
    ? ''
    : res.cast
      ? pc.missile && res.hit
        ? res.log // Projectile magique touché : LA ligne de journal du moteur (calcul des Dégâts inclus), pas une ligne condensée dupliquée
        : `Sort lancé !${res.isCritical ? ' (Critique)' : ''}`
      : res.isFumble
        ? 'Maladresse — Incantation Imparfaite / Colère des dieux'
        : res.roll <= res.target
          ? `Réussite trop faible : DR ${res.sl} < NI ${ni}`
          : 'Incantation échouée';

  return (
    <RollFlowShell
      title={isPrayer ? 'Prière' : 'Incantation'}
      subtitle={null}
      extra={
        <>
          <VsHeader
            actor={caster}
            target={selfTarget || zoneUnplaced ? undefined : target}
            label={
              <>
                {spell.label}
                {!isPrayer ? ` · NI ${ni}` : ''}
              </>
            }
            verb="✨"
          />
          {(selfTarget || pc.zone) && (
            <p className="rm-vs">
              {pc.zone ? (
                <>
                  <strong>Zone d'Effet</strong> — gabarit {pc.zone.radius * 2 + 1}×{pc.zone.radius * 2 + 1} cases
                  {zoneUnplaced ? ' · la zone se pose après le jet' : ''}
                </>
              ) : (
                <>
                  <strong>{spell.label}</strong>
                  {!isPrayer ? ` · NI ${ni}` : ''} — sur lui-même
                </>
              )}
            </p>
          )}
        </>
      }
      rolled={!!res}
      onRoll={roll}
      onCancel={csp ? cspCancel : caster.kind !== 'enemy' ? cancel : undefined}
      cancelLabel={csp ? 'Laisser passer' : undefined}
      setup={
        <>
          {conjureForms.length > 0 && (
            <div className="rm-crit-choice rm-options">
              {/* Arme invoquée à forme libre (LDB 47) : le lanceur choisit sa Compétence de Corps à corps. */}
              <span className="mini-title">🗡️ Forme de l'arme invoquée</span>
              <div className="rm-loc-grid">
                {conjureForms.map((f) => (
                  <button
                    key={`${f.group}:${f.weapon}`}
                    className={`btn small ${selectedForm?.weapon === f.weapon ? 'btn-primary' : ''}`}
                    title={`Corps à corps (${f.group}) — l'arme prend la forme : ${f.weapon}`}
                    onClick={() => setConjureForm(f)}
                  >
                    {f.weapon} · {f.group}
                  </button>
                ))}
              </div>
            </div>
          )}
          {/* Panneau de jet PRÉ-REMPLI (même géométrie qu'après le jet) : ma ligne en attente, dé/DR
              vides — exactement comme l'Attaque (previewAttack) et la Défense (previewDefense). */}
          <RollPanel rows={[{ combatant: caster, pending: previewCast(caster, spell, { missile: pc.missile, focused: pc.focused }) }]} />
        </>
      }
      rows={res ? [{
        combatant: caster,
        d: {
          label: isPrayer ? 'Prière' : `Incantation / NI ${ni}`, // jet = Test de Langue (Magick) ; un Projectile magique ne change que Localisation/Dégâts post-réussite
          base: res.target,
          modifier: 0,
          target: res.target,
          roll: res.roll,
          success: res.cast,
          sl: res.sl,
        },
      }] : undefined}
      outcome={res && (
        <JournalLine
          className="rm-journal"
          event={ev(res.isCritical ? 'crit' : 'cast', outcome, caster.id, selfTarget ? undefined : target.id)}
          combatants={pool}
        />
      )}
      postRollExtra={res && (
        <>
          {/* Surincantation : pour chaque +2 DR (au-delà du NI pour un Sort, LDB 47 l.28-31 ;
              DR entier pour une Bénédiction/un Miracle, LDB 41/42), étendre la Durée
              (+durée initiale) ou la Cible (+1) — jamais « Vous »/« Spécial »/Instantanée. */}
          {(() => {
            if (!res.cast || caster.kind !== 'hero' || (pc.zone && !zoneUnplaced)) return null;
            const budget = Math.floor(Math.max(0, res.sl - (isPrayer || pc.focused ? 0 : ni)) / 2);
            if (budget <= 0) return null;
            const oc = pc.overcast ?? { duration: 0, targets: 0 };
            const left = budget - oc.duration - oc.targets - (oc.zone ?? 0);
            const canDuration = spell.duration != null && /rounds?/i.test(spell.duration ?? '');
            const canTargets = !pc.zone && typeof spell.target === 'number' && spell.target >= 1 && spell.range !== 'Vous';
            // « +Zone d'Effet » (LDB 47 l.29) : chaque allocation ajoute le Ø initial — gabarit agrandi.
            const canZone = zoneUnplaced;
            if (!canDuration && !canTargets && !canZone) return null;
            const candidates = overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile);
            return (
              <div className="rm-overcast rm-options">
                <span className="mini-title">🌬️ Surincantation — surplus {left}×2 DR disponible</span>
                <div className="rm-loc-grid">
                  {canDuration && (
                    <button className="btn small" disabled={left <= 0} onClick={() => allocOvercast('duration')} title="Ajoute la durée initiale du sort (cumulable) — 2 DR">
                      ⏳ +Durée{oc.duration ? ` ×${oc.duration + 1}` : ''}
                    </button>
                  )}
                  {canTargets && (
                    <button className="btn small" disabled={left <= 0 && oc.targets === 0} onClick={() => { if (left > 0) allocOvercast('targets'); if (battle) pickTargets(true); }} title="Cible supplémentaire (même jet) — 2 DR. En combat : choisis les cibles SUR le champ de bataille.">
                      🎯 +Cible{oc.targets ? ` (+${oc.targets})` : ''}
                    </button>
                  )}
                  {canZone && (
                    <button className="btn small" disabled={left <= 0} onClick={() => allocOvercast('zone')} title="Agrandit la Zone d'Effet du diamètre initial (cumulable) — 2 DR">
                      🌀 +Zone{(oc.zone ?? 0) > 0 ? ` ×${(oc.zone ?? 0) + 1}` : ''} ({pc.zone!.radius * 2 + 1}×{pc.zone!.radius * 2 + 1})
                    </button>
                  )}
                </div>
                {/* Hors combat (pas de carte tactique) : repli boutons-portraits dans la modale. */}
                {oc.targets > 0 && !battle && (
                  <div className="rm-loc-grid">
                    {candidates.map((m) => (
                      <CharFrame
                        key={m.id}
                        c={m}
                        variant="vital"
                        size="sm"
                        selected={(pc.extraTargetIds ?? []).includes(m.id)}
                        onClick={() => toggleExtraTarget(m.id)}
                      />
                    ))}
                  </div>
                )}
                {oc.targets > 0 && battle && (
                  <p className="rm-log">
                    {(pc.extraTargetIds?.length ?? 0)}/{oc.targets} cible(s) supplémentaire(s) choisie(s) —{' '}
                    <button className="btn small" onClick={() => pickTargets(true)}>🗺️ Choisir sur le champ de bataille</button>
                  </p>
                )}
              </div>
            );
          })()}
          {res.isCritical && !isPrayer && caster.kind === 'hero' && (
            <div className="rm-crit-choice rm-options">
              {/* Incantation CRITIQUE (LDB 46 l.52-59) : puissance supplémentaire au choix
                  (le contrecoup — Imparfaite Mineure sauf Diction instinctive — est automatique). */}
              <span className="mini-title">⚡ Incantation Critique — choisir l'effet</span>
              <div className="rm-loc-grid">
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
          {/* OPPOSITION de la cible (Fauche-démon → FM, Parole de Tzeentch → Int) : rangées DANS la
              modale d'incantation (cible IA = témoin auto-roulée, cible héros = interactive). */}
          {pcs && (
            <div className="cs-rows">
              <span className="mini-title">🛡️ Opposition — la cible oppose son {pcs.kind === 'contact' ? 'Corps à corps (Bagarre)' : (pcs.char ?? pcs.skill)}</span>
              {pcs.participants.map((part) => {
                const actor = pool.find((c) => c.id === part.id);
                if (!actor) return null;
                const r = part.result;
                const lab = pcs.char ?? pcs.skill ?? 'Opposition';
                const row = r
                  ? { combatant: actor, d: { label: lab, base: r.oppose.target, modifier: 0, target: r.oppose.target, roll: r.oppose.roll, success: r.oppose.success, sl: r.oppose.sl } }
                  : { combatant: actor, pending: { label: lab, base: testValue(actor, pcs.skill, pcs.char), mods: [] } };
                return (
                  <ParticipantRow
                    key={part.id}
                    actor={actor}
                    row={row}
                    rolled={!!r}
                    interactive={!!part.interactive}
                    rollLabel="🛡️ Résister"
                    onRoll={() => oppRoll(part.id)}
                    rerollable={!!r && canReroll(!r.resisted, !!part.rerolled)}
                    onReroll={() => oppReroll(part.id)}
                    onBonusSL={() => oppBonusSL(part.id)}
                    darkPactable={actor.kind === 'hero' && !!r && !r.resisted}
                    onDarkPact={() => oppDarkPact(part.id)}
                    onForce={() => oppForce(part.id)}
                    forceShow={!!r && !r.resisted}
                    extra={r && <div className={`cs-outcome ${r.resisted ? 'ok-text' : 'muted'}`}>{r.resisted ? '✅ Résiste !' : `subit · marge DR ${r.margin}`}</div>}
                  />
                );
              })}
            </div>
          )}
          {/* CONTRE-SORT (Dissipation, LDB 46 l.201-202/207) : le Sort ENNEMI est figé (révélé ci-dessus),
              chaque héros contre-lanceur oppose son Langue (Magick) — rangées DANS cette même modale
              d'incantation (plus de modale séparée : un contre-sort EST un lancement de sort opposé).
              COOP : on ne pilote QUE ses propres héros (rangées distantes en lecture seule). */}
          {csp && (
            <div className="cs-rows">
              <span className="mini-title">🛡️ Contre-sort — chaque lanceur oppose son Langue (Magick)</span>
              {csp.participants.map((part) => {
                const actor = pool.find((c) => c.id === part.id);
                if (!actor) return null;
                const r = part.result;
                const val = castingValue(actor, 'langue', 'Magick');
                const row = r
                  ? { combatant: actor, d: { label: 'Langue (Magick)', base: r.counter.target, modifier: 0, target: r.counter.target, roll: r.counter.roll, success: r.counter.success, sl: r.counter.sl } }
                  : { combatant: actor, pending: { label: 'Langue (Magick)', base: val, mods: [] } };
                return (
                  <ParticipantRow
                    key={part.id}
                    actor={actor}
                    row={row}
                    rolled={!!r}
                    interactive={net.mode === 'local' || ownsLocally(useGame.getState(), part.id)}
                    rollLabel="🛡️ Contre-sort"
                    onRoll={() => cspRoll(part.id)}
                    rerollable={!!r && canReroll(!r.counter.success, !!part.rerolled)}
                    onReroll={() => cspReroll(part.id)}
                    onBonusSL={() => cspBonusSL(part.id)}
                    darkPactable={actor.kind === 'hero' && !!r && !r.counter.success}
                    onDarkPact={() => cspDarkPact(part.id)}
                    onForce={() => cspForce(part.id)}
                    forceShow={!!r && !r.dispelled}
                    extra={r && <div className={`cs-outcome ${r.dispelled ? 'ok-text' : 'muted'}`}>{r.dispelled ? '✅ Dissipé !' : `DR net ${r.casterNetSL >= 0 ? '+' : ''}${r.casterNetSL}`}</div>}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
      forcedRoll={forcedDie ? { ...forcedDie, onSet: setForcedRoll } : undefined}
      fortune={caster.fortune ?? 0}
      freeReroll={freeRerollOf(caster)}
      rerollable={rerollable}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={caster.kind === 'hero' && res != null && res.roll > 0 && res.roll > res.target}
      onDarkPact={darkPact}
      resilience={caster.resilience ?? 0}
      onForce={forceSuccess}
      preRollForce={() => { roll(); forceSuccess(); }}
      forceShow={!!res && !res.cast}
      confirmLabel={csp ? (csp.participants.some((p) => p.result?.dispelled) ? 'Appliquer (dissipé)' : 'Appliquer') : placeable ? '📍 Poser la zone' : 'Appliquer'}
      confirmTitle={placeable && !csp ? "La modale s'efface — clique une case du champ de bataille pour déposer la zone" : undefined}
      onConfirm={csp ? cspConfirm : pcs ? oppConfirm : placeable ? () => placeZone(true) : confirm}
    />
  );
}
