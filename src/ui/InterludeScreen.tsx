import { useState } from 'react';
import { useGame } from '../state/store';
import { interludeEventFor } from '../data/interludeEvents';
import { formatMoney, fromBrass, PA_PER_SC } from '../engine/money';
import { heroStatus, heroClass } from '../state/interludeFlow';
import type { Combatant } from '../engine/types';
import { ActivityModal } from './ActivityModal';

const ATOUTS = ['Léger', 'Pratique', 'Raffiné', 'Solide'];
const DEFAUTS = ['Bâclé', 'Laid', 'Peu Fiable', 'Volumineux'];

/**
 * Écran « Entre deux aventures » (LDB 22-23, Jalon 5) : événement par héros + Activités jouables
 * V1 (Revenus, Artisanat en Test étendu, Opérations bancaires) + clôture (Argent à gaspiller).
 */
export function InterludeScreen() {
  const interlude = useGame((s) => s.interlude);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const bank = useGame((s) => s.bank);
  const end = useGame((s) => s.interludeEnd);
  if (!interlude) return null;
  return (
    <div className="menu interlude-screen">
      <div className="menu-card interlude-card">
        <h1 className="title">Entre deux aventures</h1>
        <p className="subtitle">
          {interlude.weeks} semaine{interlude.weeks > 1 ? 's' : ''} — Bourse du groupe : {formatMoney(money)}
        </p>
        <div className="interlude-heroes">
          {party.filter((h) => !h.dead).map((h) => (
            <HeroCard key={h.id} hero={h} />
          ))}
        </div>
        {bank.length > 0 && (
          <section className="interlude-hero">
            <h3>🏦 Dépôts</h3>
            <BankList />
          </section>
        )}
        <p className="interlude-warning">
          À la clôture, l'argent restant du groupe sera dépensé en totalité (« Argent à gaspiller », LDB 23) —
          seuls les dépôts et les Revenus survivent.
        </p>
        <div className="menu-buttons">
          <button className="btn btn-primary" onClick={end}>Clore l'interlude</button>
        </div>
      </div>
      <ActivityModal />
    </div>
  );
}

function HeroCard({ hero }: { hero: Combatant }) {
  const interlude = useGame((s) => s.interlude)!;
  const revenus = useGame((s) => s.interludeRevenus);
  const craftStart = useGame((s) => s.interludeCraftStart);
  const craftRoll = useGame((s) => s.interludeCraftRoll);
  const bankDeposit = useGame((s) => s.interludeBank);
  const [trapping, setTrapping] = useState('');
  const [atouts, setAtouts] = useState<string[]>([]);
  const [defauts, setDefauts] = useState<string[]>([]);
  const [amountPa, setAmountPa] = useState(10);
  const st = interlude.perHero[hero.id];
  if (!st) return null;
  const ev = interludeEventFor(st.eventRoll);
  const status = heroStatus(hero);
  const none = st.left <= 0;
  const blocked = st.fx?.revenueBlockedClasses;
  const revenusBlocked = !!blocked && (blocked.includes('*') || blocked.includes(heroClass(hero)));
  const toggle = (list: string[], setList: (v: string[]) => void, q: string) =>
    setList(list.includes(q) ? list.filter((x) => x !== q) : [...list, q]);
  return (
    <section className="interlude-hero">
      <h3>
        {hero.name} <span className="interlude-left">{st.left} Activité{st.left > 1 ? 's' : ''} · Statut {status.tier} {status.standing}</span>
      </h3>
      <p className="interlude-event"><strong>🎲 {st.eventRoll} — {ev.label}.</strong> {ev.text}</p>
      <div className="interlude-actions">
        <button className="btn small" disabled={none || revenusBlocked} onClick={() => revenus(hero.id)}
          title={revenusBlocked ? 'Interdit par l’événement de la période' : 'Une semaine de travail — Test de compétence de carrière (LDB 08)'}>
          💰 Revenus
        </button>
        {st.craft ? (
          <button className="btn small" disabled={none} onClick={() => craftRoll(hero.id)}
            title={`Test étendu de Métier — ${st.craft.drDone}/${st.craft.drTarget} DR`}>
            🔨 Travailler — {st.craft.trapping} ({st.craft.drDone}/{st.craft.drTarget})
          </button>
        ) : (
          <details className="interlude-craft">
            <summary>🔨 Artisanat…</summary>
            <label className="ed-field">
              Objet (nom exact d'équipement)
              <input value={trapping} onChange={(e) => setTrapping(e.target.value)} placeholder="Épée, Bouclier, Rations (1 jour)…" />
            </label>
            <div className="interlude-craft-q">
              {ATOUTS.map((q) => (
                <label key={q}><input type="checkbox" checked={atouts.includes(q)} onChange={() => toggle(atouts, setAtouts, q)} /> {q}</label>
              ))}
              {DEFAUTS.map((q) => (
                <label key={q}><input type="checkbox" checked={defauts.includes(q)} onChange={() => toggle(defauts, setDefauts, q)} /> {q} (défaut)</label>
              ))}
            </div>
            <button className="btn small" disabled={!trapping.trim()} onClick={() => craftStart(hero.id, trapping.trim(), atouts, defauts)}
              title="Achète les matériaux (¼ du prix listé) et installe l'ouvrage">
              Engager l'ouvrage
            </button>
          </details>
        )}
        <details className="interlude-bank">
          <summary>🏦 Banque…</summary>
          <label className="ed-field">
            Montant (pistoles d'argent)
            <input type="number" min={1} value={amountPa} onChange={(e) => setAmountPa(Math.max(1, Number(e.target.value) || 1))} />
          </label>
          <div className="interlude-actions">
            <button className="btn small" disabled={none || status.tier === 'bronze'} onClick={() => bankDeposit(hero.id, 'invest', amountPa * PA_PER_SC)}
              title={status.tier === 'bronze' ? 'Réservé aux échelons Or et Argent (LDB 23)' : 'Intérêts = Indice % ; faillite sur 🎲 ≤ Indice au retrait'}>
              Investir
            </button>
            <button className="btn small" disabled={none} onClick={() => bankDeposit(hero.id, 'stash', amountPa * PA_PER_SC)}
              title="Sans intérêts ; retrait libre — découverte sur 🎲 ≤ 10">
              Planquer
            </button>
          </div>
        </details>
      </div>
    </section>
  );
}

function BankList() {
  const bank = useGame((s) => s.bank);
  const party = useGame((s) => s.party);
  const withdraw = useGame((s) => s.interludeWithdraw);
  return (
    <div className="interlude-actions">
      {bank.map((b, i) => {
        const owner = party.find((h) => h.id === b.heroId);
        return (
          <button key={i} className="btn small" onClick={() => withdraw(i)}
            title={b.kind === 'invest' ? `Retirer (1 Activité) — faillite sur 🎲 ≤ ${b.rate}` : 'Retirer la planque (libre) — découverte sur 🎲 ≤ 10'}>
            {b.kind === 'invest' ? '🏦' : '🕳️'} {owner?.name} : {formatMoney(fromBrass(b.brass))}{b.kind === 'invest' ? ` (Indice ${b.rate})` : ''} — Retirer
          </button>
        );
      })}
    </div>
  );
}
