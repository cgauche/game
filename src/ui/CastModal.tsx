import { useGame } from '../state/store';
import { ownsLocally } from '../state/netFlow';
import { FLOWS } from '../state/rollFlowSpecs';
import { overcastTargetCandidates, previewCast } from '../state/combatFlow';
import { findSpellById } from '../data/index';
import { spellEffectOps } from '../state/flow';
import { conjureFormOptions } from '../engine/conjuredWeapons';
import { testValue } from '../engine/skills';
import { castingValue, spellTargetCount } from '../engine/magic';
import { type OvercastAxis, overcastSourceOf, overcastAxes, extraTargetCapacity } from '../engine/overcast';
import { canReroll } from '../engine/fortune';
import { availableResistance } from '../engine/menace';
import { freeRerollOf } from '../engine/activeFlags';
import { rule } from '../engine/policy';
import { CharFrame } from './CharFrame';
import { OptionChooser } from './OptionChooser';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { VsHeader } from './VsHeader';
import { RollRow } from './RollRow';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { testBreakdown, testPending } from './breakdown';

/**
 * Modale d'incantation — paramétrage de la coquille PARTAGÉE `RollShell` (comme Attaque/Défense) :
 * on sélectionne un sort + une cible, « Lancer » (rangée mono) fait le jet, on voit le résultat
 * (réussite DR ≥ NI, échec, ou Maladresse), Chance/Pacte/Résilience DANS la rangée, puis « Appliquer ».
 * Le métier propre à l'incantation (Surincantation, Contre-sort, Opposition, choix du Critique, pose de
 * zone) passe par les slots `setup`/`postRollExtra` ; toute la mécanique générique vit dans la coquille.
 *
 * Surincantation « +Cible » : EN COMBAT, le choix des cibles supplémentaires se fait SUR LE CHAMP
 * DE BATAILLE (`castPickTargets` efface la modale, bandeau TargetPrompt + clic carte) ; hors
 * combat (pas de carte tactique), repli sur des boutons-portraits dans la modale.
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
  const setConjureForm = useGame((s) => s.castSetConjureForm);
  const setDiscreet = useGame((s) => s.castSetDiscreet);
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
  const oppResist = useGame((s) => s.oppositionResist); // Résistance (Menace : Magie) — auto-succès du talent (LDB 10)
  const oppConfirm = useGame((s) => s.oppositionConfirm);
  // Contre-sort (Dissipation) : RÉACTION au Sort ENNEMI figé dans `pendingCast` — plus de modale
  // séparée (« le contre-sort, c'est le lancement d'un sort qui peut être opposé »). Chaque héros
  // contre-lanceur a SA rangée (`RollRow`), DANS cette modale d'incantation, exactement comme
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

  // Rangée MONO d'incantation = le jet du lanceur, porteur de son cycle d'influence (Lancer → Chance/
  // +1 DR/Pacte/Résilience → Appliquer). Pré-jet : ligne en attente (base+mods=cible, dé/DR vides) via
  // `testPending`, dérivée du même `previewCast` que le panneau (parité Attaque/Défense). Post-jet :
  // `testBreakdown` (base = cible du Test, aucun mod post-hoc — parité avec l'ancien littéral inline).
  const preview = previewCast(caster, spell, { missile: pc.missile, focused: pc.focused });
  const castLabel = isPrayer ? 'Prière' : `Incantation / NI ${ni}`; // le jet reste Langue (Magick) ; un Projectile magique ne change que Localisation/Dégâts post-réussite
  const castRow: RollRowData = {
    actor: caster,
    row: res
      ? { combatant: caster, d: testBreakdown(castLabel, res.target, { roll: res.roll, target: res.target, sl: res.sl, success: res.cast }) }
      : { combatant: caster, pending: testPending(castLabel, preview.base, preview.target, undefined, preview.mods) },
    rolled: !!res,
    onRoll: roll,
    rerollable,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: caster.kind === 'hero' && res != null && res.roll > 0 && res.roll > res.target,
    onDarkPact: darkPact,
    fortune: caster.fortune ?? 0,
    freeReroll: freeRerollOf(caster),
    resilience: caster.resilience ?? 0,
    onForce: forceSuccess,
    preRollForce: () => { roll(); forceSuccess(); },
    forceShow: !!res && !res.cast,
    forcedRoll: forcedDie ? { ...forcedDie, onSet: setForcedRoll } : undefined,
  };

  const journal = res && (
    <JournalLine
      className="rm-journal"
      event={ev(res.isCritical ? 'crit' : 'cast', outcome, caster.id, selfTarget ? undefined : target.id)}
      combatants={pool}
    />
  );

  const actions: RollAction[] = [
    // Annuler : « Laisser passer » (Contre-sort) sinon Renoncer (héros lanceur) — pré-jet uniquement.
    ...(csp
      ? [{ key: 'cancel', label: 'Laisser passer', kind: 'ghost', onClick: cspCancel, when: 'pre' } as RollAction]
      : caster.kind !== 'enemy'
        ? [{ key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'pre' } as RollAction]
        : []),
    {
      key: 'confirm',
      label: csp ? (csp.participants.some((p) => p.result?.dispelled) ? 'Appliquer (dissipé)' : 'Appliquer') : placeable ? '📍 Poser la zone' : 'Appliquer',
      title: placeable && !csp ? "La modale s'efface — clique une case du champ de bataille pour déposer la zone" : undefined,
      kind: 'primary',
      onClick: csp ? cspConfirm : pcs ? oppConfirm : placeable ? () => placeZone(true) : confirm,
      when: 'post',
    },
  ];

  return (
    <RollShell
      title={isPrayer ? 'Prière' : 'Incantation'}
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
      rows={[castRow]}
      rolled={!!res}
      outcome={journal}
      setup={
        <>
          {/* « Prêchez, ma sœur ! » (LDB 40 l.40-42) : entonner la Prière à voix haute (Intermédiaire)
              ou discrètement (murmurée → un cran plus dure). Seulement Prière + option active + avant le jet. */}
          {isPrayer && !res && rule('prayer-conviction') && (
            <OptionChooser
              layout="seg"
              groupLabel="🙏 Ton de la Prière"
              options={[
                { key: 'aloud', label: 'À voix haute', selected: !pc.discreet, onSelect: () => setDiscreet(false), title: 'Prière entonnée fermement (Intermédiaire +0, RAW)' },
                { key: 'discreet', label: 'Discrètement', selected: !!pc.discreet, onSelect: () => setDiscreet(true), title: 'Prière murmurée / sans conviction : Difficulté d’un cran plus dure (LDB 40 l.42)' },
              ]}
            />
          )}
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
        </>
      }
      postRollExtra={res && (
        <>
          {/* Surincantation : un STEPPER +/− par axe (Portée/ZdE/Durée/Cible), borné au budget (+2 DR/pas ;
              DR − NI pour un Sort, DR entier pour Prière). L'effet d'un pas est SOURCE-AWARE (engine/overcast) :
              ×initial (Sort/Miracle) vs +6 m/+1/+6 R FIXE (Bénédiction), ZdE réservée à l'arcane. La désignation
              des cibles supplémentaires est SÉPARÉE de l'allocation (en combat : sur la carte). */}
          {(() => {
            if (!res.cast || caster.kind !== 'hero' || (pc.zone && !zoneUnplaced)) return null;
            const source = overcastSourceOf(spell);
            const budget = Math.floor(Math.max(0, res.sl - (isPrayer || pc.focused ? 0 : ni)) / 2);
            if (budget <= 0) return null;
            const oc = pc.overcast ?? { range: 0, zone: 0, duration: 0, targets: 0 };
            const left = budget - oc.range - oc.zone - oc.duration - oc.targets;
            // Axes = ceux de la SOURCE (ZdE arcane seulement) ∩ ceux que CE sort porte (RAW : « Vous »/
            // « Contact »/« Spécial »/Instantané non extensibles ; une Bénédiction étend même le Contact).
            const can: Record<OvercastAxis, boolean> = {
              range: spell.range?.kind === 'distance' || (spell.range?.kind === 'touch' && source === 'blessing'),
              zone: zoneUnplaced,
              duration: spell.duration?.kind === 'rounds',
              targets: !pc.zone && spell.target?.kind === 'count' && spell.range?.kind !== 'self',
            };
            const rows = overcastAxes(source).filter((a) => can[a]);
            if (!rows.length) return null;
            const META: Record<OvercastAxis, [string, string]> = {
              range: ['📏', 'Portée'], zone: ['🌀', 'Zone'], duration: ['⏳', 'Durée'], targets: ['🎯', 'Cibles'],
            };
            const cap = extraTargetCapacity(source, oc.targets, spellTargetCount(spell, caster));
            const designated = pc.extraTargetIds?.length ?? 0;
            const candidates = overcastTargetCandidates(pool, caster, pc.targetId, spell, !!pc.missile, source, oc.range);
            return (
              <div className="rm-overcast rm-options">
                <span className="mini-title">🌬️ Surincantation — {left} pas (+2 DR) restant(s)</span>
                <div className="rm-stepper-list">
                  {rows.map((a) => (
                    <div key={a} className="rm-stepper">
                      <span className="rm-stepper-label">
                        {META[a][0]} {META[a][1]}
                        {a === 'zone' && pc.zone ? ` ${pc.zone.radius * 2 + 1}×${pc.zone.radius * 2 + 1}` : ''}
                        {a === 'targets' && cap > 0 ? ` +${cap}` : ''}
                      </span>
                      <button className="btn small" disabled={oc[a] <= 0} onClick={() => allocOvercast(a, -1)} title="Rendre ce pas">−</button>
                      <strong className="rm-stepper-val">{oc[a]}</strong>
                      <button className="btn small" disabled={left <= 0} onClick={() => allocOvercast(a, 1)} title="Allouer un pas (+2 DR)">+</button>
                    </div>
                  ))}
                </div>
                {/* Désignation des cibles supplémentaires — SÉPARÉE de l'allocation (plus de bouton carte redondant). */}
                {can.targets && cap > 0 && (battle ? (
                  <button className="btn small rm-overcast-pick" onClick={() => pickTargets(true)} title="Choisir les cibles supplémentaires sur le champ de bataille">
                    🗺️ Désigner les cibles ({designated}/{cap})
                  </button>
                ) : (
                  <div className="rm-loc-grid">
                    {candidates.map((m) => (
                      <CharFrame key={m.id} c={m} variant="vital" size="sm" selected={(pc.extraTargetIds ?? []).includes(m.id)} onClick={() => toggleExtraTarget(m.id)} />
                    ))}
                  </div>
                ))}
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
                  ? { combatant: actor, d: testBreakdown(lab, testValue(actor, pcs.skill, pcs.char), r.oppose) }
                  : { combatant: actor, pending: testPending(lab, testValue(actor, pcs.skill, pcs.char)) };
                return (
                  <RollRow
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
                    /* Résistance (Menace : Magie), LDB 10 : auto-succès du Test qui résiste au Sort. */
                    resist={pcs.menace != null && availableResistance(actor, pcs.menace) != null && (!r || !r.resisted)
                      ? { menace: pcs.menace, onResist: () => oppResist(part.id) } : undefined}
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
                  ? { combatant: actor, d: testBreakdown('Langue (Magick)', val, r.counter) }
                  : { combatant: actor, pending: testPending('Langue (Magick)', val) };
                return (
                  <RollRow
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
      actions={actions}
      /* Échap = Annuler : RollShell le neutralise dès qu'un jet est lancé (`!rolled ? onCancel`). */
      onCancel={csp ? cspCancel : caster.kind !== 'enemy' ? cancel : undefined}
    />
  );
}
