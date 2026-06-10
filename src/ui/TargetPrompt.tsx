import { useGame } from '../state/store';
import { cleaveTargets, dualStrikeTargets } from '../state/combatFlow';
import { bonus, effectiveChar } from '../engine/characteristics';
import { pickActiveModalKey } from './ActiveModal';

/**
 * Bandeau NON bloquant de ciblage sur le champ de bataille — remplace les modales qui faisaient
 * cliquer des boutons-noms (Frappe Mortelle, 2ᵉ frappe des Deux armes, cibles supplémentaires de
 * Surincantation). Les cibles éligibles sont surlignées sur la carte (IsoStage) et le clic route
 * vers l'action du store (`battleClickEntity`) ; ce bandeau donne le contexte + l'action de
 * sortie (Terminer / Renoncer / Valider).
 */
export function TargetPrompt() {
  const battle = useGame((s) => s.battle);
  const activeModal = pickActiveModalKey(useGame());
  const pc = useGame((s) => s.pendingCleave);
  const ds = useGame((s) => s.pendingDualStrike);
  const cast = useGame((s) => s.pendingCast);
  const cleaveEnd = useGame((s) => s.cleaveEnd);
  const dualStrikeSkip = useGame((s) => s.dualStrikeSkip);
  const pickTargets = useGame((s) => s.castPickTargets);
  if (!battle || activeModal) return null; // une modale a la main (jet en cours, révélation…)

  // Frappe Mortelle (LDB 14 l.12 / 85 l.299) : enchaîner sur des adversaires adjacents, jusqu'à BCC.
  if (pc) {
    const attacker = battle.combatants.find((c) => c.id === pc.attackerId);
    if (!attacker) return null;
    const targets = cleaveTargets(battle, attacker, pc.hitIds);
    const bcc = bonus(effectiveChar(attacker, 'CC'));
    return (
      <div className="target-prompt">
        <span className="tp-text">
          ⚔️ <b>Frappe Mortelle</b> — {targets.length
            ? `choisis une cible sur le champ de bataille (enchaînement ${pc.count + 1}/${bcc})`
            : "plus d'adversaire à portée"}
        </span>
        <button className="btn small" onClick={cleaveEnd}>Terminer</button>
      </div>
    );
  }

  // Maniement de deux armes (LDB 10 l.638) : 2ᵉ frappe de la main secondaire, cible au choix.
  if (ds) {
    const attacker = battle.combatants.find((c) => c.id === ds.attackerId);
    const off = attacker?.weapons.find((w) => w.uid === ds.offWeaponUid);
    if (!attacker || !off) return null;
    const targets = dualStrikeTargets(battle, attacker, off);
    return (
      <div className="target-prompt">
        <span className="tp-text">
          ⚔️ <b>Des deux armes</b> — {targets.length
            ? `2ᵉ frappe (${off.name}) : choisis une cible sur le champ de bataille`
            : "plus d'adversaire à portée"}
        </span>
        <button className="btn small" onClick={dualStrikeSkip} title="Ne pas frapper de la 2ᵉ arme (pas d'Avantage gagné)">
          Renoncer
        </button>
      </div>
    );
  }

  // Surincantation « +Cible » (LDB 47 l.28-31) : choix des cibles supplémentaires sur la carte.
  if (cast?.pickingTargets) {
    const max = cast.overcast?.targets ?? 0;
    const n = cast.extraTargetIds?.length ?? 0;
    return (
      <div className="target-prompt">
        <span className="tp-text">
          🎯 <b>Surincantation</b> — clique les cibles supplémentaires sur le champ de bataille ({n}/{max})
        </span>
        <button className="btn small btn-primary" onClick={() => pickTargets(false)} title="Revenir à la modale d'incantation">
          Valider
        </button>
      </div>
    );
  }
  return null;
}
