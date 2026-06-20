import { useMemo, useState } from 'react';
import { useGame } from '../state/store';
import { interludeEventFor, type InterludeEventFx } from '../data/interludeEvents';
import { formatMoney, fromBrass, toBrass, PA_PER_SC, type Money } from '../engine/money';
import { heroStatus, heroClass, type InterludeState, type InterludeHeroState, type BankDeposit } from '../state/interludeFlow';
import {
  craftCatalog, craftTarget, learnableTalents, orderCatalog, metierOf, bankPayout,
  type CraftOption, type LearnOption,
} from '../engine/activities';
import { DIFFICULTY_LABELS } from '../engine/types';
import { QUALITY_DESC, describeQuality } from '../engine/qualities/describe';
import { findTalent, skillInstanceLabel, findTrappingById, qualities } from '../data';
import type { Combatant } from '../engine/types';
import { ActiveModal } from './ActiveModal';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { t } from '../i18n';

/** Atouts/Défauts d'artisanat (LDB 60 l.55-90) — dérivés de la DONNÉE éditable (`qualities.json`,
 *  qualités d'Objet) par `id` ; tooltips/libellés via le registre (`describeQuality`). */
const ATOUTS = qualities.filter((q) => q.type === 'Atout' && q.subType === 'Objet').map((q) => q.id);
const DEFAUTS = qualities.filter((q) => q.type === 'Défaut' && q.subType === 'Objet').map((q) => q.id);
/** Libellé + desc d'une qualité d'artisanat par id (registre via `describeQuality`). */
const craftQual = (id: string) => describeQuality(id) ?? { label: id, desc: undefined };

/** Familles d'équipement pour grouper les sélecteurs (mêmes données que le marchand). */
const FAMILY_LABEL: Record<string, string> = {
  melee: 'Armes de mêlée', ranged: 'Armes à distance', ammunition: 'Munitions',
  armor: 'Armures', trapping: 'Équipement', vehicle: 'Véhicules',
};

const fmt = (brass: number) => formatMoney(fromBrass(brass));

/** Vue réseau minimale pour la possession (audit M7) — sous-ensemble de `GameState['net']`. */
export interface InterludeNet {
  mode: 'local' | 'host' | 'guest';
  mySeat: number;
  ownership: Record<string, number>;
  seatNames: Record<number, string>;
}

/** Seam de test (rendu statique : le store SSR sert l'état initial — cf. WorldMapView). */
export interface InterludeSeam {
  interlude: InterludeState;
  party: Combatant[];
  money: Money;
  bank: BankDeposit[];
  pendingOrders: { heroId: string; trappingId: string }[];
  /** Phase d'ouverture forcée ('activities' saute l'intro Événements). */
  phase?: 'events' | 'activities' | 'closing';
  net?: InterludeNet;
}

/**
 * Écran « Entre deux aventures » (LDB 22-23) — refonte POC→produit (audit 2026-06-11) :
 * 1. Événements de la période RACONTÉS (révélation par héros, conséquences lisibles) ;
 * 2. Activités à SÉLECTEURS alimentés par la donnée (fini le libellé exact à deviner — audit
 *    B1/B2/B3) avec coûts et conditions affichés AVANT de s'engager ;
 * 3. Clôture RÉCAPITULATIVE (argent gaspillé / Revenus / commandes / dépôts) confirmée.
 *
 * Les lectures de DONNÉES restent dans ce composant racine (props descendantes) ; les enfants
 * ne tirent du store que des ACTIONS — testable en SSR via `seam`.
 */
export function InterludeScreen({ seam }: { seam?: InterludeSeam } = {}) {
  const storeInterlude = useGame((s) => s.interlude);
  const storeParty = useGame((s) => s.party);
  const storeMoney = useGame((s) => s.money);
  const storeBank = useGame((s) => s.bank);
  const storeOrders = useGame((s) => s.pendingOrders);
  const storeNet = useGame((s) => s.net);
  const interlude = seam?.interlude ?? storeInterlude;
  const party = seam?.party ?? storeParty;
  const money = seam?.money ?? storeMoney;
  const bank = seam?.bank ?? storeBank;
  const pendingOrders = seam?.pendingOrders ?? storeOrders;
  const net: InterludeNet = seam?.net ?? storeNet;
  const [phase, setPhase] = useState<'events' | 'activities' | 'closing'>(seam?.phase ?? 'events');
  if (!interlude) return null;
  const heroes = party.filter((h) => !h.dead && interlude.perHero[h.id]);
  // Possession coop (audit M7) : chaque joueur mène les Activités de SES héros ; l'hôte clôt.
  const ownsHero = (id: string) => net.mode === 'local' || (net.ownership[id] ?? 0) === net.mySeat;
  const ownerName = (id: string) => net.seatNames[net.ownership[id] ?? 0] ?? 'L\u2019h\u00f4te';
  const isGuest = net.mode === 'guest';
  return (
    <div className="menu interlude-screen">
      <div className="menu-card interlude-card">
        <h1 className="title">{t('interlude.title')}</h1>
        <p className="subtitle">
          {interlude.weeks} semaine{interlude.weeks > 1 ? 's' : ''} · Bourse du groupe {formatMoney(money)}
        </p>
        <div className="rule-fleur" aria-hidden>⚜</div>
        {phase === 'events' ? (
          <EventsIntro heroes={heroes} interlude={interlude} onDone={() => setPhase('activities')} />
        ) : (
          <>
            <div className="interlude-heroes">
              {heroes.map((h) => (
                <HeroCard
                  key={h.id}
                  hero={h}
                  st={interlude.perHero[h.id]}
                  weeks={interlude.weeks}
                  money={money}
                  canDrive={ownsHero(h.id)}
                  ownerName={ownsHero(h.id) ? undefined : ownerName(h.id)}
                />
              ))}
            </div>
            {bank.length > 0 && (
              <section className="interlude-hero panel">
                <h3>🏦 Dépôts en cours</h3>
                <BankList bank={bank} party={party} interlude={interlude} canDrive={ownsHero} />
              </section>
            )}
            <div className="interlude-close">
              <p className="interlude-warning" title={t('interlude.close.warning.title')}>
                {t('interlude.close.warning')}
              </p>
              {isGuest
                ? <p className="interlude-warning">{t('interlude.close.guest')}</p>
                : <button className="btn btn-primary" onClick={() => setPhase('closing')}>{t('interlude.close.btn')}</button>}
            </div>
          </>
        )}
      </div>
      {/* Arbitre partagé (audit M8) : la modale de jet d'Activité s'affiche chez le PROPRIÉTAIRE
          du héros, les autres voient « X joue… ». */}
      <ActiveModal />
      {phase === 'closing' && (
        <CloseRecap heroes={heroes} interlude={interlude} money={money} bank={bank} pendingOrders={pendingOrders} onCancel={() => setPhase('activities')} />
      )}
    </div>
  );
}

/** Conséquences mécaniques d'un événement, en clair (LDB 22). */
function fxChips(fx: InterludeEventFx | undefined, weeks: number, hero: Combatant): string[] {
  const chips: string[] = [];
  if (fx?.moneyPct) chips.push(`${fx.moneyPct} % sur la bourse du groupe (pire tirage appliqué une fois)`);
  if (fx?.loseActivity) chips.push('−1 Activité');
  if (fx?.fortuneMaxDelta) chips.push(`+${fx.fortuneMaxDelta} Point de Chance`);
  if (fx?.revenuePct) chips.push(`Revenus ${fx.revenuePct > 0 ? '+' : ''}${fx.revenuePct} %${fx.revenueClasses ? ` (${fx.revenueClasses.join(', ')})` : ''}`);
  if (fx?.revenueBlockedClasses) chips.push(fx.revenueBlockedClasses.includes('*') || fx.revenueBlockedClasses.includes(heroClass(hero)) ? 'Revenus impossibles cette période' : `Revenus bloqués pour : ${fx.revenueBlockedClasses.join(', ')}`);
  if (fx?.bankPct) chips.push(`${fx.bankPct} % sur l'argent placé en banque`);
  if (fx?.stashRaided) chips.push('Planque dévalisée !');
  if (fx?.bankCrashCheck) chips.push('Les banques vérifient leur faillite immédiatement');
  if (weeks >= 3 && /elfe/i.test(hero.species ?? '')) chips.push('−1 Activité (devoir elfique)');
  return chips;
}

/** Phase 1 — les événements d100 de la période, racontés héros par héros (audit M1). */
function EventsIntro({ heroes, interlude, onDone }: { heroes: Combatant[]; interlude: InterludeState; onDone: () => void }) {
  return (
    <>
      <p className="interlude-phase-hint">
        {t('interlude.events.hint')}
      </p>
      <div className="interlude-heroes">
        {heroes.map((h) => {
          const st = interlude.perHero[h.id];
          const ev = interludeEventFor(st.eventRoll);
          const chips = fxChips(st.fx, interlude.weeks, h);
          return (
            <section key={h.id} className="interlude-hero panel">
              <h3>
                <CharFrame c={h} variant="full" size="sm" /> <span className="interlude-left">🎲 {st.eventRoll}</span>
              </h3>
              <p className="interlude-event"><strong>{ev.label}.</strong> {ev.text}</p>
              {chips.length > 0 && (
                <div className="interlude-fx">
                  {chips.map((c) => <span key={c} className="interlude-fx-chip">{c}</span>)}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <div className="modal-actions">
        <button className="btn btn-primary" onClick={onDone}>{t('interlude.events.next')}</button>
      </div>
    </>
  );
}

type Pane = 'craft' | 'learn' | 'order' | 'bank' | 'identify' | null;

function HeroCard({ hero, st, weeks, money, canDrive, ownerName }: {
  hero: Combatant; st: InterludeHeroState; weeks: number; money: Money;
  /** Possession coop (audit M7) : false = ce héros est mené par un autre joueur (lecture seule). */
  canDrive: boolean;
  ownerName?: string;
}) {
  const revenus = useGame((s) => s.interludeRevenus);
  const craftRoll = useGame((s) => s.interludeCraftRoll);
  const [pane, setPane] = useState<Pane>(null);
  const ev = interludeEventFor(st.eventRoll);
  const status = heroStatus(hero);
  const none = st.left <= 0 || !canDrive;
  const blocked = st.fx?.revenueBlockedClasses;
  const revenusBlocked = !!blocked && (blocked.includes('*') || blocked.includes(heroClass(hero)));
  // « Gagner de l'argent grâce au Statut » (LDB 08 l.135-144) — la formule, lisible AVANT le jet.
  const incomeFormula = status.tier === 'bronze'
    ? `${status.standing} × 2d10 sous`
    : status.tier === 'argent'
      ? `${status.standing} × 1d10 pistole${status.standing > 1 ? 's' : ''}`
      : `${status.standing} couronne${status.standing > 1 ? 's' : ''} d'or`;
  const paneBtn = (key: Pane, label: string, title: string) => (
    <button
      className={`btn small${pane === key ? ' btn-primary' : ''}`}
      disabled={!canDrive || (none && pane !== key)}
      onClick={() => setPane(pane === key ? null : key)}
      title={canDrive ? title : `Mené par ${ownerName ?? 'un autre joueur'}`}
    >
      {label}
    </button>
  );
  return (
    <section className="interlude-hero panel">
      <h3>
        <CharFrame c={hero} variant="full" size="sm" />
        <span className="interlude-left">
          {!canDrive && <span className="interlude-owner">🎮 {ownerName ?? 'autre joueur'} · </span>}
          {'●'.repeat(st.left)}{'○'.repeat(Math.max(0, Math.min(3, weeks) - st.left))} {st.left} Activité{st.left > 1 ? 's' : ''} · Statut {status.tier} {status.standing}
        </span>
      </h3>
      <p className="interlude-event" title={ev.text}>🎲 {st.eventRoll} — {ev.label}</p>
      <div className="interlude-actions">
        <button
          className="btn small"
          disabled={none || revenusBlocked}
          onClick={() => revenus(hero.id)}
          title={revenusBlocked ? `Interdit par l'événement de la période (${ev.label})` : `Une semaine de travail — Test Accessible (+20) de la compétence de carrière ; succès = ${incomeFormula}, échec = moitié`}
        >
          💰 Revenus <span className="interlude-hint">({incomeFormula})</span>
        </button>
        {st.craft ? (
          <button className="btn small" disabled={none} onClick={() => craftRoll(hero.id)}
            title={`Test étendu de Métier — ${st.craft.drDone}/${st.craft.drTarget} DR (${DIFFICULTY_LABELS[st.craft.difficulty]})`}>
            🔨 Travailler — {findTrappingById(st.craft.trappingId)?.label ?? st.craft.trappingId} ({st.craft.drDone}/{st.craft.drTarget})
          </button>
        ) : (
          paneBtn('craft', '🔨 Artisanat…', 'Fabriquer un équipement du catalogue (matériaux = ¼ du prix, Test étendu de Métier)')
        )}
        {paneBtn('learn', '📚 Apprentissage…', 'Apprendre un Talent hors carrière auprès d’un tuteur (Test Difficile −20 ; PX et argent perdus sur un échec)')}
        {paneBtn('order', '📦 Commande…', 'Commander un objet Exotique : payé maintenant, livré après la prochaine aventure')}
        {paneBtn('bank', '🏦 Banque…', 'Déposer de l’argent pour qu’il survive à la clôture (Opérations bancaires)')}
        {paneBtn('identify', '🔮 Identifier…', 'Étudier un artefact magique une semaine — Test de Savoir (Magie) Intermédiaire (ADE2)')}
      </div>
      {pane === 'craft' && !st.craft && <CraftPane hero={hero} disabled={none} money={money} />}
      {pane === 'learn' && <LearnPane hero={hero} disabled={none} fails={st.learnFails} money={money} />}
      {pane === 'order' && <OrderPane hero={hero} disabled={none} money={money} />}
      {pane === 'bank' && <BankPane hero={hero} disabled={none} bronzeBlocked={status.tier === 'bronze'} money={money} />}
      {pane === 'identify' && <IdentifyPane hero={hero} disabled={none} />}
    </section>
  );
}

/** Identifier un artefact (ADE2 ch.4) : choisir un objet NON identifié du sac — une semaine
 *  d'étude par tentative, Test de Savoir (Magie) Intermédiaire (+0). */
function IdentifyPane({ hero, disabled }: { hero: Combatant; disabled: boolean }) {
  const identify = useGame((s) => s.interludeIdentify);
  const items = (hero.items ?? []).filter((i) => i.identified === false);
  const [uid, setUid] = useState(items[0]?.uid ?? '');
  const savoir = hero.skills.some((k) => k.skillId === 'savoir' && (k.spec ?? '') === 'Magie' && k.advances >= 1);
  if (!items.length) {
    return <div className="interlude-pane"><p className="interlude-blocked">Aucun objet non identifié dans le sac de {hero.name}.</p></div>;
  }
  return (
    <div className="interlude-pane">
      {!savoir && <p className="interlude-blocked">{hero.name} ne possède pas Savoir (Magie) — la longue étude d'un artefact est la voie des sorciers (ADE2).</p>}
      <select className="interlude-select" value={uid} onChange={(e) => setUid(e.target.value)} aria-label="Artefact à étudier">
        {items.map((i) => (
          <option key={i.uid} value={i.uid}>
            {i.name}{i.magicKnown ? ' ✨' : ''}{i.suspectedQualities?.length ? ' (certitudes douteuses)' : ''}
          </option>
        ))}
      </select>
      <p className="interlude-detail">
        Une semaine d'étude (1 Activité) · Test de <b>Savoir (Magie)</b> Intermédiaire (+0) · un grand
        succès révèle les Particularités ; une lourde méprise ancre de <b>fausses</b> certitudes.
      </p>
      <button
        className="btn small btn-primary"
        disabled={disabled || !savoir || !uid}
        title={savoir ? 'Installer l’étude au laboratoire (consomme l’Activité au jet)' : 'Savoir (Magie) requis'}
        onClick={() => uid && identify(hero.id, uid)}
      >
        Étudier l'artefact
      </button>
    </div>
  );
}

/** Sélecteur d'équipement groupé par famille + recherche (audit B1/B3). `value`/`onChange` = `id`. */
function TrappingSelect({ options, value, onChange, detail }: {
  options: { id: string; label: string; type: string; priceBrass: number }[];
  value: string;
  onChange: (v: string) => void;
  detail?: (id: string) => string;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);
  const families = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const o of filtered) {
      const f = FAMILY_LABEL[o.type] ?? 'Équipement';
      if (!m.has(f)) m.set(f, []);
      m.get(f)!.push(o);
    }
    return [...m.entries()];
  }, [filtered]);
  return (
    <>
      <input
        className="interlude-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔎 Filtrer le catalogue…"
        aria-label="Filtrer le catalogue"
      />
      <select className="interlude-select" value={value} onChange={(e) => onChange(e.target.value)} size={Math.min(8, Math.max(3, filtered.length))}>
        {families.map(([fam, list]) => (
          <optgroup key={fam} label={fam}>
            {list.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label} — {fmt(o.priceBrass)}{detail ? ` · ${detail(o.id)}` : ''}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </>
  );
}

function CraftPane({ hero, disabled, money }: { hero: Combatant; disabled: boolean; money: Money }) {
  const craftStart = useGame((s) => s.interludeCraftStart);
  const catalog = useMemo(() => craftCatalog(), []);
  const [id, setId] = useState('');
  const [atouts, setAtouts] = useState<string[]>([]);
  const [defauts, setDefauts] = useState<string[]>([]);
  const metier = metierOf(hero);
  const sel: CraftOption | undefined = catalog.find((o) => o.id === id);
  const target = sel ? craftTarget(sel.tier, sel.avail, atouts.length, defauts.length) : null;
  const affordable = !sel || toBrass(money) >= sel.materialsBrass;
  const toggle = (list: string[], setList: (v: string[]) => void, q: string) =>
    setList(list.includes(q) ? list.filter((x) => x !== q) : [...list, q]);
  const blockedReason = !metier
    ? 'Aucune Compétence Métier avec avances — impossible de fabriquer.'
    : !affordable && sel
      ? `Matériaux trop chers (${fmt(sel.materialsBrass)}) pour la bourse du groupe.`
      : null;
  return (
    <div className="interlude-pane">
      {!metier && <p className="interlude-blocked">{blockedReason}</p>}
      <TrappingSelect options={catalog} value={id} onChange={setId} />
      <div className="interlude-craft-q">
        {ATOUTS.map((q) => (
          <label key={q} title={craftQual(q).desc}>
            <input type="checkbox" checked={atouts.includes(q)} onChange={() => toggle(atouts, setAtouts, q)} /> {craftQual(q).label}
          </label>
        ))}
        {DEFAUTS.map((q) => (
          <label key={q} title={craftQual(q).desc}>
            <input type="checkbox" checked={defauts.includes(q)} onChange={() => toggle(defauts, setDefauts, q)} /> {craftQual(q).label} (défaut)
          </label>
        ))}
      </div>
      {sel && target && (
        <p className="interlude-detail">
          Matériaux <b>{fmt(sel.materialsBrass)}</b> (¼ du prix, payés à l'engagement) · Test étendu de{' '}
          <b>{metier ? skillInstanceLabel(metier) : 'Métier'}</b> {DIFFICULTY_LABELS[target.difficulty]} · <b>{target.dr} DR</b> à cumuler
          (1 lancer par Activité).
        </p>
      )}
      <button
        className="btn small btn-primary"
        disabled={disabled || !sel || !metier || !affordable}
        title={blockedReason ?? 'Achète les matériaux et installe l’ouvrage (le travail inachevé se conserve)'}
        onClick={() => sel && craftStart(hero.id, sel.id, atouts, defauts)}
      >
        Engager l'ouvrage{sel ? ` (${fmt(sel.materialsBrass)})` : ''}
      </button>
      {metier && !affordable && sel && <p className="interlude-blocked">{blockedReason}</p>}
    </div>
  );
}

function LearnPane({ hero, disabled, fails, money }: { hero: Combatant; disabled: boolean; fails?: Record<string, number>; money: Money }) {
  const learn = useGame((s) => s.interludeLearn);
  const options = useMemo(() => learnableTalents(hero), [hero]);
  const [label, setLabel] = useState('');
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);
  const sel: LearnOption | undefined = options.find((o) => o.label === label);
  const xp = hero.xp ?? 0;
  const failCount = sel ? fails?.[sel.id] ?? 0 : 0;
  const xpOk = !sel || xp >= sel.xpCost;
  const purseOk = !sel || toBrass(money) >= sel.tutorMinBrass;
  const desc = sel ? findTalent(sel.label)?.desc ?? '' : '';
  return (
    <div className="interlude-pane">
      <input className="interlude-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="🔎 Filtrer les talents…" aria-label="Filtrer les talents" />
      <select className="interlude-select" value={label} onChange={(e) => setLabel(e.target.value)} size={Math.min(8, Math.max(3, filtered.length))}>
        {filtered.map((o) => (
          <option key={o.label} value={o.label} title={findTalent(o.label)?.desc ?? ''}>
            {o.label} — {o.xpCost} PX · tuteur {fmt(o.tutorMinBrass)} à {fmt(o.tutorMaxBrass)}
          </option>
        ))}
      </select>
      {sel && (
        <p className="interlude-detail" title={desc}>
          {desc ? `${desc.slice(0, 140)}${desc.length > 140 ? '…' : ''} — ` : ''}
          Test <b>Difficile (−20)</b>{failCount ? <> (+{failCount * 10} d'acharnement)</> : null} · coût <b>{sel.xpCost} PX</b> (il vous en reste {xp})
          + tuteur <b>2d10 pa / 100 PX</b> — PX et argent perdus même sur un échec.
        </p>
      )}
      <button
        className="btn small btn-primary"
        disabled={disabled || !sel || !xpOk || !purseOk}
        title={!xpOk && sel ? `PX insuffisants (${sel.xpCost} requis)` : !purseOk ? 'La bourse ne couvre même pas le tuteur le moins cher' : 'Trouver un tuteur et tenter l’apprentissage'}
        onClick={() => sel && learn(hero.id, sel.id)}
      >
        Trouver un tuteur{sel ? ` (${sel.xpCost} PX)` : ''}
      </button>
      {sel && !xpOk && <p className="interlude-blocked">PX insuffisants : {xp}/{sel.xpCost}.</p>}
    </div>
  );
}

function OrderPane({ hero, disabled, money }: { hero: Combatant; disabled: boolean; money: Money }) {
  const order = useGame((s) => s.interludeOrder);
  const catalog = useMemo(() => orderCatalog(), []);
  const [id, setId] = useState('');
  const sel = catalog.find((o) => o.id === id);
  const affordable = !sel || toBrass(money) >= sel.priceBrass;
  return (
    <div className="interlude-pane">
      <TrappingSelect options={catalog} value={id} onChange={setId} />
      {sel && (
        <p className="interlude-detail">
          Payé <b>{fmt(sel.priceBrass)}</b> maintenant — « l'objet sera achevé après votre prochaine
          aventure » (livré à l'ouverture du prochain interlude).
        </p>
      )}
      <button
        className="btn small btn-primary"
        disabled={disabled || !sel || !affordable}
        title={!affordable && sel ? `Commande trop chère (${fmt(sel.priceBrass)})` : 'Passer commande (1 objet par Activité)'}
        onClick={() => sel && order(hero.id, sel.id)}
      >
        Commander{sel ? ` (${fmt(sel.priceBrass)})` : ''}
      </button>
      {sel && !affordable && <p className="interlude-blocked">La bourse du groupe ne couvre pas ce prix.</p>}
    </div>
  );
}

function BankPane({ hero, disabled, bronzeBlocked, money }: { hero: Combatant; disabled: boolean; bronzeBlocked: boolean; money: Money }) {
  const bankDeposit = useGame((s) => s.interludeBank);
  const [amountPa, setAmountPa] = useState(10);
  const purseBrass = toBrass(money);
  const pa = Math.max(1, Math.floor(amountPa));
  const amountBrass = pa * PA_PER_SC;
  const quick = (frac: number) => setAmountPa(Math.max(1, Math.floor(purseBrass * frac / PA_PER_SC)));
  return (
    <div className="interlude-pane">
      <div className="interlude-actions">
        <label className="ed-field interlude-amount">
          Montant (pistoles d'argent)
          <input type="number" min={1} value={amountPa} onChange={(e) => setAmountPa(Math.max(1, Number(e.target.value) || 1))} />
        </label>
        <button className="btn small" onClick={() => quick(0.25)} title="Un quart de la bourse">¼</button>
        <button className="btn small" onClick={() => quick(0.5)} title="La moitié de la bourse">½</button>
        <button className="btn small" onClick={() => quick(1)} title="Toute la bourse">Tout</button>
      </div>
      <p className="interlude-detail">
        Bourse du groupe : <b>{formatMoney(money)}</b> · dépôt prévu : <b>{fmt(amountBrass)}</b>
        {amountBrass > purseBrass && <span className="interlude-blocked"> (au-delà de la bourse)</span>}
      </p>
      <div className="interlude-actions">
        <button
          className="btn small"
          disabled={disabled || bronzeBlocked || amountBrass > purseBrass}
          onClick={() => bankDeposit(hero.id, 'invest', amountBrass)}
          title={bronzeBlocked ? '« Vous devez être des échelons Or et Argent pour épargner dans une banque »' : 'Intérêts = Indice d’intérêts (1-10) % ; au retrait, faillite sur 🎲 ≤ Indice (retrait = 1 Activité)'}
        >
          🏦 Investir
        </button>
        <button
          className="btn small"
          disabled={disabled || amountBrass > purseBrass}
          onClick={() => bankDeposit(hero.id, 'stash', amountBrass)}
          title="Sans intérêts ; retrait libre — mais découverte de la planque sur 🎲 ≤ 10"
        >
          🕳️ Planquer
        </button>
      </div>
      <p className="interlude-detail">
        Investir : intérêts de l'Indice (1-10) %, faillite au retrait sur 🎲 ≤ Indice — retirer coûte
        une Activité. Planquer : aucun intérêt, retrait libre, découverte sur 🎲 ≤ 10.
        {bronzeBlocked && <span className="interlude-blocked"> Investir exige le Statut Argent ou Or.</span>}
      </p>
    </div>
  );
}

function BankList({ bank, party, interlude, canDrive }: {
  bank: BankDeposit[]; party: Combatant[]; interlude: InterludeState;
  canDrive: (heroId: string) => boolean;
}) {
  const withdraw = useGame((s) => s.interludeWithdraw);
  return (
    <div className="interlude-actions">
      {bank.map((b, i) => {
        const owner = party.find((h) => h.id === b.heroId);
        const left = owner ? interlude.perHero[owner.id]?.left ?? 0 : 0;
        const foreign = !canDrive(b.heroId);
        const lockedInvest = b.kind === 'invest' && left <= 0;
        return (
          <button
            key={i}
            className="btn small"
            disabled={foreign || lockedInvest}
            onClick={() => withdraw(i)}
            title={foreign
              ? 'Dépôt d’un héros mené par un autre joueur.'
              : b.kind === 'invest'
                ? lockedInvest
                  ? 'Retirer un investissement exige une Activité — il n’en reste plus.'
                  : `Retirer (1 Activité) : ${fmt(bankPayout('invest', b.brass, b.rate))} si la banque tient (faillite sur 🎲 ≤ ${b.rate})`
                : `Retirer la planque (libre) : ${fmt(b.brass)} — découverte sur 🎲 ≤ 10`}
          >
            {b.kind === 'invest' ? '🏦' : '🕳️'} {owner?.name} : {fmt(b.brass)}
            {b.kind === 'invest' ? ` → ${fmt(bankPayout('invest', b.brass, b.rate))} (Indice ${b.rate})` : ''} — Retirer
          </button>
        );
      })}
    </div>
  );
}

/** Clôture confirmée : récapitulatif de ce qui sera perdu/crédité/conservé (audit M3). */
function CloseRecap({ heroes, interlude, money, bank, pendingOrders, onCancel }: {
  heroes: Combatant[];
  interlude: InterludeState;
  money: Money;
  bank: BankDeposit[];
  pendingOrders: { heroId: string; trappingId: string }[];
  onCancel: () => void;
}) {
  const end = useGame((s) => s.interludeEnd);
  const wasted = toBrass(money);
  const revenue = heroes.reduce((a, h) => a + (interlude.perHero[h.id]?.revenueBrass ?? 0), 0);
  const demoted = heroes.filter((h) => (h.careerLevel ?? 1) >= 3 && !interlude.perHero[h.id]?.didRevenus);
  const kept = bank.reduce((a, b) => a + b.brass, 0);
  const crafts = heroes.filter((h) => interlude.perHero[h.id]?.craft);
  return (
    <Modal title={t('interlude.recap.title')} variant="plain" className="interlude-recap" onClose={onCancel}>
      <ul className="interlude-recap-list">
        <li>
          💸 {wasted > 0
            ? <><b>{fmt(wasted)}</b> seront dépensés, bus, pariés ou donnés — en totalité (« Argent à gaspiller »).</>
            : 'La bourse est vide — rien à gaspiller.'}
        </li>
        <li>💰 Revenus crédités à la reprise : <b>{revenue > 0 ? fmt(revenue) : 'aucun'}</b>.</li>
        {kept > 0 && <li>🏦 Dépôts conservés : <b>{fmt(kept)}</b> (récupérables à un prochain interlude).</li>}
        {pendingOrders.length > 0 && (
          <li>📦 Commandes en cours : {pendingOrders.map((o) => findTrappingById(o.trappingId)?.label ?? o.trappingId).join(', ')} — livrées au prochain interlude.</li>
        )}
        {crafts.length > 0 && (
          <li>🔨 Ouvrages inachevés conservés : {crafts.map((h) => `${h.name} (${findTrappingById(interlude.perHero[h.id]!.craft!.trappingId)?.label ?? interlude.perHero[h.id]!.craft!.trappingId})`).join(', ')}.</li>
        )}
        {demoted.map((h) => (
          <li key={h.id} className="interlude-blocked">
            ⚠️ {h.name} n'a pas entrepris Revenus : retour au Niveau {(h.careerLevel ?? 1) - 1} de sa
            Carrière (« Avec le pouvoir »).
          </li>
        ))}
        <li>🌙 Le temps passe : {interlude.weeks * 7} jours (récupération et convalescence comprises).</li>
      </ul>
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>{t('interlude.recap.cancel')}</button>
        <button className="btn btn-primary" onClick={end}>{t('interlude.recap.confirm')}</button>
      </div>
    </Modal>
  );
}
