import type { ReactNode } from 'react';
import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { TeamPortrait } from './TeamPortrait';
import { Coins } from './Coins';
import { DrBar } from './DrBar';
import { HealRollFlow } from './HealModal';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { isHealable, lodgedAmmoCount, type HealMode } from '../engine/healing';
import { hasTreatableTrauma, hasSurgeryTrauma, surgeryTraumas, recoverableTraumas, hasLimbAwaitingAid } from '../engine/trauma';
import { bestHealerFor } from '../state/medicFlow';
import { toMoney } from '../engine/money';
import { DIFFICULTY_LABELS, type Combatant } from '../engine/types';
import { Icon } from './Icon';

const ACT_META: Record<HealMode, { icon: ReactNode; label: string }> = {
  wounds: { icon: <Icon id="journal/heal" size="sm" />, label: 'Soigner les Blessures' },
  bleed: { icon: <Icon id="condition/bleeding" size="sm" />, label: 'Arrêter l’Hémorragie' },
  trauma: { icon: <Icon id="medical/tear" size="sm" />, label: 'Soigner la déchirure' },
  surgery: { icon: <Icon id="medical/scalpel" size="sm" />, label: 'Opérer' },
  recovery: { icon: <Icon id="medical/crutch" size="sm" />, label: 'Rééduquer un membre' },
  ammo: { icon: <Icon id="item/ammo" size="sm" />, label: 'Retirer une munition' },
};

/** Pourquoi un acte est grisé — affiché en title (info de décision, pas de texte tuto). */
function actBlockReason(patient: Combatant, act: HealMode, hasSurgeon: boolean): string | null {
  switch (act) {
    case 'wounds':
      if (patient.wounds.current >= patient.wounds.max) return 'Blessures au maximum';
      if (patient.soinRencontreUtilise) return 'A déjà reçu son soin de Blessures (une fois par rencontre)'; // LDB 09 l.233
      return null;
    case 'bleed':
      return (patient.conditions ?? []).some((c) => c.name === 'hemorragique' && c.value > 0) ? null : 'Aucune Hémorragie';
    case 'trauma':
      return hasTreatableTrauma(patient) ? null : 'Aucune déchirure à traiter';
    case 'surgery':
      if (!hasSurgeryTrauma(patient)) return 'Aucune blessure ne relève de la chirurgie';
      if (!hasSurgeon) return 'Aucun soigneur avec le Talent Chirurgie'; // prérequis LDB 10
      return null;
    case 'recovery':
      if (recoverableTraumas(patient).length) return null;
      if (hasLimbAwaitingAid(patient)) return 'Aide Médicale requise d’abord'; // LDB l.120/179 : « Après application de cette Aide… »
      return 'Aucun membre désactivé à rééduquer';
    case 'ammo':
      return lodgedAmmoCount(patient) > 0 ? null : 'Aucune munition logée';
  }
}

/**
 * Zone de jet EMBARQUÉE d'UNE passe de Chirurgie (Test ÉTENDU influençable) — calque `HealRollFlow` :
 * « Lancer » → Chance (relance / +1 DR) → Résilience → « Appliquer la passe » (surgeryNext). Le chirurgien
 * peut être un héros (Chance/Résilience) ; PNJ payant → ressources à 0. « Arrêter l'opération » (avant le
 * jet) annule la passe et l'opération (surgeryCancel), remboursant l'acte tant qu'aucune passe n'a abouti.
 */
function SurgeryRollFlow() {
  const ps = useGame((s) => s.pendingSurgery);
  const kind = useGame((s) => s.medic?.surgery?.kind);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.surgeryRoll);
  const reroll = useGame((s) => s.surgeryReroll);
  const bonusSL = useGame((s) => s.surgeryBonusSL);
  const darkPact = useGame((s) => s.surgeryDarkPact);
  const force = useGame((s) => s.surgeryForceSuccess);
  const next = useGame((s) => s.surgeryNext);
  const cancel = useGame((s) => s.surgeryCancel);
  if (!ps) return null;
  const surgeon = party.find((c) => c.id === ps.healerId); // absent (PNJ médecin) → Chance/Résilience à 0
  const fortune = surgeon?.fortune ?? 0;
  const rolled = ps.roll != null;
  const freeReroll = freeRerollOf(surgeon);
  const actorRow: RollRowData = {
    actor: surgeon,
    row: {
      combatant: surgeon,
      d: rolled ? testBreakdown('Guérison', ps.skillValue, { roll: ps.roll!, target: ps.target, sl: ps.sl, success: ps.success }, ps.difficulty) : undefined,
      pending: testPending('Guérison', ps.skillValue, ps.target, ps.difficulty),
    },
    rolled,
    fortune,
    freeReroll,
    rerollable: rolled && canReroll(ps.roll! > ps.target, !!ps.rerolled) && (fortune > 0 || freeReroll),
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: rolled && ps.roll! > ps.target && surgeon?.kind === 'hero',
    onDarkPact: darkPact,
    resilience: surgeon?.resilience ?? 0,
    onForce: force,
    forceShow: !ps.success,
  };
  const recovery = kind === 'recovery';
  const actions: RollAction[] = [
    { key: 'cancel', label: recovery ? 'Arrêter la rééducation' : 'Arrêter l’opération', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer la passe', onClick: next, when: 'post' },
  ];
  return (
    <RollShell
      embedded
      title={<>{recovery ? <Icon id="medical/crutch" size="sm" /> : <Icon id="medical/scalpel" size="sm" />} {recovery ? 'Rééduquer (une passe)' : 'Opérer (une passe)'}</>}
      subtitle={
        <>
          <strong>{ps.healerName}</strong> {recovery ? 'rééduque' : 'opère'} <strong>{ps.targetName}</strong>{' '}
          <span className="rm-weapon">(Guérison, {DIFFICULTY_LABELS[ps.difficulty]})</span>
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}

/**
 * INFIRMERIE — modale de soins PERSISTANTE (hors combat) : bandeau patients (tuiles full, la jauge
 * et les pastilles d'États SONT le diagnostic) → dossier du patient (actes : Guérison / Hémorragie /
 * Déchirure / Chirurgie, tarifés chez un PNJ `medicalAid`) → zone de jet embarquée (HealRollFlow).
 * Elle ne se ferme pas après un jet : on enchaîne actes et patients ; « Terminer » est la seule
 * sortie (verrouillée pendant un jet ou une opération). La CHIRURGIE est « armée » : DrBar +
 * passes, et Bander/Hémorragie restent des actes normaux du même patient entre deux passes.
 */
export function MedicModal() {
  const medic = useGame((s) => s.medic);
  const ph = useGame((s) => s.pendingHeal);
  const ps = useGame((s) => s.pendingSurgery);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const selectPatient = useGame((s) => s.medicSelectPatient);
  const act = useGame((s) => s.medicAct);
  const setWound = useGame((s) => s.medicSetWound);
  const openPass = useGame((s) => s.openSurgeryPass);
  const cancelSurgery = useGame((s) => s.surgeryCancel);
  const close = useGame((s) => s.closeMedic);
  if (!medic) return null;
  const patient = party.find((c) => c.id === medic.patientId) ?? null;
  const sg = medic.surgery;
  const busy = !!ph || !!sg || !!ps; // jet posé ou opération en cours : patients verrouillés, pas de sortie
  const npc = medic.npc;
  const paid = npc?.acts.some((a) => a.cost);
  const hasSurgeon = npc ? true : !!bestHealerFor(party, 'surgery');

  // Les actes proposés : ceux du PNJ (tarifés) ou les 4 actes du groupe — grisés avec leur raison.
  const offers: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[] =
    npc ? npc.acts : (['wounds', 'bleed', 'ammo', 'trauma', 'surgery', 'recovery'] as HealMode[]).map((a) => ({ act: a }));

  return (
    <Modal title={npc ? <><Icon id="journal/heal" size="sm" /> Soins — {npc.name}</> : <><Icon id="journal/heal" size="sm" /> Soins</>} variant="plain" className="medic-modal" onClose={busy ? undefined : close}>
      {paid && <span className="purse medic-purse">Bourse <Coins money={money} /></span>}

      {/* Bandeau PATIENTS : tuile full (jauge + États = le diagnostic), sélection or. */}
      <div className="medic-patients">
        {party.map((h) => (
          <CharFrame
            key={h.id}
            c={h}
            variant="full"
            size="md"
            selected={h.id === medic.patientId}
            onClick={!busy && isHealable(h) ? () => selectPatient(h.id) : undefined}
            title={isHealable(h) ? h.name : `${h.name} — rien à soigner`}
          />
        ))}
      </div>

      {/* Zone de JET : exclusive tant que le jet posé n'est pas résolu. */}
      {ph && <HealRollFlow embedded />}

      {/* DOSSIER du patient : les actes (l'opération en cours s'affiche au-dessus des actes). */}
      {patient && !ph && (
        <div className="medic-dossier">
          {sg && (() => {
            const recovery = sg.kind === 'recovery';
            const pool = recovery ? recoverableTraumas(patient) : surgeryTraumas(patient);
            return (
            <div className="medic-surgery">
              <p className="rm-vs">
                <strong>{sg.healerName}</strong> {recovery ? 'rééduque' : 'opère'} <strong>{patient.name}</strong>{' '}
                <span className="rm-weapon">(cumuler {sg.targetDR} DR · {DIFFICULTY_LABELS[sg.difficulty]})</span>
              </p>
              {!sg.last && pool.length > 1 && (
                <div className="modal-actions medic-wound-pick">
                  {pool.map((t, i) => (
                    <button key={i} className={`btn small${i === sg.traumaIdx ? ' btn-primary' : ''}`} onClick={() => setWound(i)}>
                      {t.label} ({t.location})
                    </button>
                  ))}
                </div>
              )}
              {/* EXCEPTION nommée au site unique `RollRow.extendedDr` (arbitrage user 2026-07-11, verrou
                  `travel-carto.test.ts`) : cet état d'OPÉRATION ARMÉE est visible AVANT/ENTRE les passes,
                  hors de toute rangée de jet (`SurgeryRollFlow` n'a pas de rangée tant qu'aucune passe n'est
                  ouverte) — ce n'est pas la barre d'UN jet mais le cumul PERSISTANT de l'opération. */}
              <DrBar cum={sg.cumDR} target={sg.targetDR} />
              {sg.last && <p className="rm-note">Dernière passe : {sg.last.sl >= 0 ? '+' : ''}{sg.last.sl} DR</p>}
              {/* coût RAW d'une passe de Chirurgie : LDB 10 l.154 (la rééducation Guérison n'inflige rien). */}
              <p className="rm-note">{recovery ? 'Test étendu de Guérison — récupération de l’usage du membre.' : 'Chaque passe inflige 1d10 PB + 1 Hémorragie. À 0 PB, l’opération s’interrompt.'}</p>
              {/* La passe est un jet INFLUENÇABLE (modale embarquée) ; avant le 1er jet, on l'arme/renonce. */}
              {ps ? (
                <SurgeryRollFlow />
              ) : (
                <div className="modal-actions">
                  <button className="btn btn-ghost" onClick={cancelSurgery} title={sg.last ? 'Le cumul de DR est perdu' : 'Renoncer (acte remboursé)'}>
                    {recovery ? 'Arrêter la rééducation' : 'Arrêter l’opération'}
                  </button>
                  <button className="btn btn-primary" onClick={openPass}>{recovery ? <><Icon id="medical/crutch" size="sm" /> Rééduquer (une passe)</> : <><Icon id="medical/scalpel" size="sm" /> Opérer (une passe)</>}</button>
                </div>
              )}
            </div>
            );
          })()}
          <div className="medic-acts">
            {offers.map(({ act: a, cost }) => {
              if (sg && (a === 'surgery' || a === 'trauma' || a === 'recovery')) return null; // pendant l'op : Bander/Hémorragie seulement
              const reason = actBlockReason(patient, a, hasSurgeon);
              const healer = npc ? undefined : bestHealerFor(party, a)?.actor;
              const meta = ACT_META[a];
              const stacks = a === 'bleed' ? (patient.conditions ?? []).find((c) => c.name === 'hemorragique')?.value ?? 0
                : a === 'ammo' ? lodgedAmmoCount(patient) : 0;
              return (
                <button
                  key={a}
                  className="btn medic-act"
                  disabled={!!reason || (!npc && !healer)}
                  onClick={() => act(a)}
                  title={reason ?? (npc ? `${npc.name} (Guérison ${npc.skill})` : healer ? `Soigné par ${healer.name}` : 'Aucun soigneur (Compétence Guérison) dans le groupe')}
                >
                  {meta.icon} {meta.label}
                  {(a === 'bleed' || a === 'ammo') && stacks > 0 ? ` ×${stacks}` : ''}
                  {cost && <span className="medic-price"><Coins money={toMoney(cost)} /></span>}
                  {healer && <TeamPortrait combatant={healer} size={20} />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="modal-actions">
        <button className="btn" disabled={busy} onClick={close} title={busy ? 'Résolvez le jet / arrêtez l’opération d’abord' : undefined}>
          Terminer
        </button>
      </div>
    </Modal>
  );
}
