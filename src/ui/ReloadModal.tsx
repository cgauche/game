import { useGame, type PendingReload } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';

/** Vue pure de la modale de rechargement (testable sans store). */
export function ReloadModalView({
  pr,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onConfirm,
  onCancel,
}: {
  pr: PendingReload;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pr.roll != null;
  const rerollable = rolled && pr.roll != null && canReroll(pr.roll > pr.target, !!pr.rerolled);
  const after = Math.max(0, pr.progressBefore + pr.sl);
  const done = after >= pr.reload;

  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>Recharger — {pr.weaponName}</h3>
        <p className="test-actor">
          <strong>{pr.actorName}</strong> — Projectiles, cible {pr.target} · {pr.progressBefore}/{pr.reload} DR
        </p>

        {!rolled ? (
          <div className="modal-actions">
            <button className="btn" onClick={onCancel}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={onRoll}>
              🎲 Lancer
            </button>
          </div>
        ) : (
          <>
            <div className={`test-result ${pr.success ? 'ok' : 'fail'}`}>
              <span className="dice">{pr.roll === 100 ? '00' : String(pr.roll).padStart(2, '0')}</span>
              <span className="vs">/ {pr.target}</span>
              <span className="verdict">
                {pr.success ? 'Réussite' : 'Échec'} ({pr.sl >= 0 ? '+' : ''}
                {pr.sl} DR) → {done ? 'rechargé ✓' : `${after}/${pr.reload} DR`}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={onReroll} onBonusSL={onBonusSL} />
              <button className="btn btn-primary" onClick={onConfirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Rechargement d'une arme à distance = Test étendu de Projectiles (LDB 63-Armures l.28-29 :
 * « une arme déchargée … nécessite un Test étendu de Projectiles … et nécessite d'obtenir
 * Indice DR pour être rechargée »). « Lancer » fait le jet, une Chance est possible avant
 * d'acquitter, et le DR obtenu se cumule vers l'Indice (12-Tests l.199-211).
 */
export function ReloadModal() {
  const pr = useGame((s) => s.pendingReload);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.reloadRoll);
  const reroll = useGame((s) => s.reloadReroll);
  const bonusSL = useGame((s) => s.reloadBonusSL);
  const confirm = useGame((s) => s.reloadConfirm);
  const cancel = useGame((s) => s.reloadCancel);
  if (!pr || !battle) return null;
  const fortune = battle.combatants.find((c) => c.id === pr.actorId)?.fortune ?? 0;
  return (
    <ReloadModalView pr={pr} fortune={fortune} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onConfirm={confirm} onCancel={cancel} />
  );
}
