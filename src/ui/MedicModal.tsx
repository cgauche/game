import { useGame } from '../state/store';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { TeamPortrait } from './TeamPortrait';
import { Coins } from './Coins';
import { DrBar } from './DrBar';
import { HealRollFlow } from './HealModal';
import { isHealable, availableHealModes, type HealMode } from '../engine/healing';
import { hasTreatableTrauma, hasSurgeryTrauma, surgeryTraumas } from '../engine/trauma';
import { bestHealerFor } from '../state/medicFlow';
import { toMoney } from '../engine/money';
import type { Combatant } from '../engine/types';

const ACT_META: Record<HealMode, { icon: string; label: string }> = {
  wounds: { icon: '🩹', label: 'Soigner les Blessures' },
  bleed: { icon: '🩸', label: 'Arrêter l’Hémorragie' },
  trauma: { icon: '🦵', label: 'Soigner la déchirure' },
  surgery: { icon: '🔪', label: 'Opérer' },
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
  }
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
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const selectPatient = useGame((s) => s.medicSelectPatient);
  const act = useGame((s) => s.medicAct);
  const setWound = useGame((s) => s.medicSetWound);
  const surgeryPass = useGame((s) => s.medicSurgeryPass);
  const endSurgery = useGame((s) => s.medicEndSurgery);
  const close = useGame((s) => s.closeMedic);
  if (!medic) return null;
  const patient = party.find((c) => c.id === medic.patientId) ?? null;
  const sg = medic.surgery;
  const busy = !!ph || !!sg; // jet posé ou opération en cours : patients verrouillés, pas de sortie
  const npc = medic.npc;
  const paid = npc?.acts.some((a) => a.cost);
  const hasSurgeon = npc ? true : !!bestHealerFor(party, 'surgery');

  // Les actes proposés : ceux du PNJ (tarifés) ou les 4 actes du groupe — grisés avec leur raison.
  const offers: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[] =
    npc ? npc.acts : (['wounds', 'bleed', 'trauma', 'surgery'] as HealMode[]).map((a) => ({ act: a }));

  return (
    <Modal title={npc ? `🩺 Soins — ${npc.name}` : '🩺 Soins'} variant="plain" className="medic-modal" onClose={busy ? undefined : close}>
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

      {/* Zone de JET : exclusive tant que le jet posé n'est pas résolu (un jet = une modale). */}
      {ph && <HealRollFlow embedded />}

      {/* DOSSIER du patient : les actes (l'opération en cours s'affiche au-dessus des actes). */}
      {patient && !ph && (
        <div className="medic-dossier">
          {sg && (
            <div className="medic-surgery">
              <p className="rm-vs">
                <strong>{sg.healerName}</strong> opère <strong>{patient.name}</strong>{' '}
                <span className="rm-weapon">(cumuler {sg.targetDR} DR · Intermédiaire +0)</span>
              </p>
              {!sg.last && surgeryTraumas(patient).length > 1 && (
                <div className="modal-actions medic-wound-pick">
                  {surgeryTraumas(patient).map((t, i) => (
                    <button key={i} className={`btn small${i === sg.traumaIdx ? ' btn-primary' : ''}`} onClick={() => setWound(i)}>
                      {t.label} ({t.location})
                    </button>
                  ))}
                </div>
              )}
              <DrBar cum={sg.cumDR} target={sg.targetDR} />
              {sg.last && <p className="rm-note">Dernière passe : {sg.last.sl >= 0 ? '+' : ''}{sg.last.sl} DR</p>}
              {/* coût RAW d'une passe : LDB 10 l.154 */}
              <p className="rm-note">Chaque passe inflige 1d10 PB + 1 Hémorragie. À 0 PB, l’opération s’interrompt.</p>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={endSurgery} title={sg.last ? 'Le cumul de DR est perdu' : 'Renoncer (acte remboursé)'}>
                  Arrêter l’opération
                </button>
                <button className="btn btn-primary" onClick={surgeryPass}>🔪 Opérer (une passe)</button>
              </div>
            </div>
          )}
          <div className="medic-acts">
            {offers.map(({ act: a, cost }) => {
              if (sg && (a === 'surgery' || a === 'trauma')) return null; // pendant l'opération : Bander/Hémorragie seulement
              const reason = actBlockReason(patient, a, hasSurgeon);
              const healer = npc ? undefined : bestHealerFor(party, a)?.actor;
              const meta = ACT_META[a];
              const stacks = a === 'bleed' ? (patient.conditions ?? []).find((c) => c.name === 'hemorragique')?.value ?? 0 : 0;
              return (
                <button
                  key={a}
                  className="btn medic-act"
                  disabled={!!reason || (!npc && !healer)}
                  onClick={() => act(a)}
                  title={reason ?? (npc ? `${npc.name} (Guérison ${npc.skill})` : healer ? `Soigné par ${healer.name}` : 'Aucun soigneur (Compétence Guérison) dans le groupe')}
                >
                  {meta.icon} {meta.label}
                  {a === 'bleed' && stacks > 0 ? ` ×${stacks}` : ''}
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
