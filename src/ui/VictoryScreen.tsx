import { useGame } from '../state/store';
import type { Money } from '../state/store';

/** Bourse en notation canon FR (couronne d'or / pistole d'argent / sou de cuivre → CO/pa/sc). */
function fmtMoney(m: Money): string {
  const parts = [m.gold && `${m.gold} CO`, m.silver && `${m.silver} pa`, m.brass && `${m.brass} sc`].filter(Boolean);
  return parts.length ? parts.join(' ') : '—';
}

/**
 * Écran de VICTOIRE plein écran (demande utilisateur) : récapitulatif de fin de combat — XP gagnée, or
 * récupéré, ennemis vaincus, et butin assignable à un héros (réutilise `giveItemToHero` = flux marchand).
 * « Continuer » revient à l'exploration. Ne s'affiche que sur `battle.over === 'victory'`.
 */
export function VictoryScreen() {
  const battle = useGame((s) => s.battle);
  const pv = useGame((s) => s.pendingVictory);
  const party = useGame((s) => s.party);
  const giveItemToHero = useGame((s) => s.giveItemToHero);
  const dismiss = useGame((s) => s.dismissVictory);
  if (!battle || battle.over !== 'victory') return null;

  const xp = pv?.xp ?? 0;
  const gold = pv?.gold ?? { gold: 0, silver: 0, brass: 0 };
  const loot = pv?.loot ?? [];
  const defeated = pv?.defeated ?? [];

  return (
    <div className="victory-overlay">
      <div className="victory-screen">
        <h1 className="victory-title">🏆 Victoire !</h1>

        <div className="victory-rewards">
          <div className="victory-stat"><span className="vs-ico">✨</span> <b>{xp}</b> XP</div>
          <div className="victory-stat"><span className="vs-ico">💰</span> {fmtMoney(gold)}</div>
        </div>

        {defeated.length > 0 && (
          <div className="victory-section">
            <h3>Ennemis vaincus</h3>
            <div className="victory-defeated">
              {defeated.map((d) => (
                <span key={d.name} className="victory-foe">{d.name}{d.count > 1 ? ` ×${d.count}` : ''}</span>
              ))}
            </div>
          </div>
        )}

        <div className="victory-section">
          <h3>Butin</h3>
          {loot.length === 0 ? (
            <p className="victory-empty">Aucun butin à répartir.</p>
          ) : (
            <>
              <ul className="victory-loot">
                {loot.map((label, i) => (
                  <li key={`${label}-${i}`} className="victory-loot-row">
                    <span className="vl-name">{label}</span>
                    <span className="vl-assign">
                      {party.map((h) => (
                        <button key={h.id} className="btn small" onClick={() => giveItemToHero(label, h.id)} title={`Donner « ${label} » à ${h.name}`}>
                          {h.name}
                        </button>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="victory-hint">Clique un héros pour lui attribuer l'objet ; le reste rejoint le stock du groupe.</p>
            </>
          )}
        </div>

        <button className="btn btn-primary victory-continue" onClick={dismiss}>Continuer</button>
      </div>
    </div>
  );
}
