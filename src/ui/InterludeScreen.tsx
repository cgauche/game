import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { interludeEventFor } from '../data/interludeEvents';
import { formatMoney, fromBrass, toBrass, PA_PER_SC, PA_PER_CO, type Money } from '../engine/money';
import { MINUTES_PER_DAY } from '../engine/clock';
import { heroStatus, heroClass, incomeSkillOf, interludeCatalog, type InterludeState, type InterludeHeroState, type BankDeposit } from '../state/interludeFlow';
import {
  craftCatalog, craftTarget, learnableTalents, orderCatalog, metierOf, bankPayout,
  type ActivityDef, type CraftOption, type LearnOption,
} from '../engine/activities';
import type { GameOp } from '../engine/ops';
import { learnableSpells } from '../engine/grimoire';
import { DIFFICULTY_LABELS, DIFFICULTY_MODIFIERS, CHAR_LABELS, type CharKey, type Difficulty } from '../engine/types';
import { describeQuality } from '../engine/qualities/describe';
import { effectiveChar } from '../engine/characteristics';
import { testValue } from '../engine/skills';
import { combatValue } from '../engine/combat';
import { buildWeapon } from '../engine/items';
import { findTalent, findTalentById, skillInstanceLabel, findTrappingById, qualities, refLabel } from '../data';
import type { Combatant, ConditionId } from '../engine/types';
import { rule } from '../engine/policy';
import { ActiveModal } from './ActiveModal';
import { TavernGameModal } from './TavernGameModal';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { EffectChips } from './EffectChips';
import { EntityRef } from './EntityChip';
import { FxChip } from './FxChip';
import { RuleDivider } from './Ornaments';
import { GameDate } from './GameDate';
import { Icon } from './Icon';
import type { IconId } from './icons';
import { PendingRollLine, type PendingRoll } from './RollLine';
import { testPending, optionPending, difficultyMods } from './breakdown';
import { Prose, mdToText } from './Prose';
import { t } from '../i18n';

/** Atouts/Défauts d'artisanat (LDB 60 l.55-90) — dérivés de la DONNÉE éditable (`qualities.json`,
 *  qualités d'Objet) par `id` ; tooltips/libellés via le registre (`describeQuality`). */
const ATOUTS = qualities.filter((q) => q.type === 'atout' && q.subType === 'objet').map((q) => q.id);
const DEFAUTS = qualities.filter((q) => q.type === 'defaut' && q.subType === 'objet').map((q) => q.id);
/** Libellé + desc d'une qualité d'artisanat par id (registre via `describeQuality`). */
const craftQual = (id: string) => describeQuality({ id }) ?? { label: id, desc: undefined };

/** Familles d'équipement pour grouper les sélecteurs (mêmes données que le marchand). */
const FAMILY_LABEL: Record<string, string> = {
  melee: 'Armes de mêlée', ranged: 'Armes à distance', ammunition: 'Munitions',
  armor: 'Armures', trapping: 'Équipement', vehicle: 'Véhicules',
};

/** Montant en TEXTE (attributs `title`, contenu d'`<option>` — HTML texte seul) ; tout AFFICHAGE
 *  passe par `<Coins>` (source visuelle unique des montants, LOT 5). */
const fmt = (brass: number) => formatMoney(fromBrass(brass));
/** Montant AFFICHÉ : le rendu coloré unique. */
const CoinsB = ({ brass }: { brass: number }) => <Coins money={fromBrass(brass)} />;

/** Compétence du pré-jet : chip Codex + Difficulté TOUJOURS lisible — en texte quand son
 *  modificateur est nul (Intermédiaire +0), sinon la chip de mod du pré-jet l'affiche déjà. */
const skillNode = (chip: ReactNode, diff: Difficulty): ReactNode =>
  DIFFICULTY_MODIFIERS[diff] === 0 ? <>{chip} <span className="interlude-hint">{DIFFICULTY_LABELS[diff]}</span></> : chip;

/** Chip de compétence du Codex (popover desc + source) par id (+ spécialisation affichée). */
const SkillChip = ({ skillId, show }: { skillId: string; show?: string }) => (
  <EntityRef category="skills" label={refLabel('skills', { id: skillId })} show={show} />
);

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
  /** Volet OUVERT forcé (tests SSR du gabarit : pied pré-jet visible). */
  openPane?: { heroId: string; pane: string };
  /** Catalogue d'Activités data-driven proposables ICI (contexte 'interlude' + gate `where`) —
   *  en jeu, dérivé du store (`interludeCatalog`) ; en SSR, fourni par le seam (le store SSR sert
   *  l'état initial, comme les autres lectures). */
  catalog?: ActivityDef[];
  net?: InterludeNet;
}

/** Volet ouvert d'un héros : outil codé ('revenus'/'craft'/…) OU id d'une Activité du catalogue. */
type OpenPane = { heroId: string; pane: string } | null;

/**
 * Écran « Entre deux aventures » (LDB 22-23) — refonte UX LOT 6 :
 * 1. SYNTHÈSE persistante (bandeau sticky, les 3 phases) : une vignette par héros — portrait +
 *    États actifs (CharFrame `full`), Activités restantes (●○), propriétaire coop — + bourse du
 *    groupe. Les conséquences des Événements s'y reflètent immédiatement (lecture du store).
 * 2. VOLETS homogènes : chaque Activité passe par le gabarit unique `ActivityPane` — en-tête
 *    (icône + titre), description `<Prose>`, paramètres, et PIED FIXE : pré-jet (`testPending`/
 *    `optionPending`) + coût `<Coins>` + « Entreprendre » jamais caché par le scroll.
 * 3. Clôture RÉCAPITULATIVE confirmée (audit M3).
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
  // Catalogue d'Activités data-driven (`activities.json`) : contexte 'interlude' + gate `where`
  // résolu contre le LIEU courant (place de la carte du monde ↔ scène courante).
  const worldMap = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const catalog = useMemo(
    () => seam?.catalog ?? interludeCatalog({ scene, worldMap }),
    [seam?.catalog, scene, worldMap],
  );
  const [phase, setPhase] = useState<'events' | 'activities' | 'closing'>(seam?.phase ?? 'events');
  // Volet ouvert (UN seul à la fois, tous héros confondus) — remonté ici pour que la vignette de
  // synthèse du héros « actif » soit mise en évidence.
  const [openPane, setOpenPane] = useState<OpenPane>(seam?.openPane ?? null);
  if (!interlude) return null;
  const heroes = party.filter((h) => !h.dead && interlude.perHero[h.id]);
  const mecenat = catalog.find((d) => d.resolver === 'mecenat');
  // Possession coop (audit M7) : chaque joueur mène les Activités de SES héros ; l'hôte clôt.
  const ownsHero = (id: string) => net.mode === 'local' || (net.ownership[id] ?? 0) === net.mySeat;
  const ownerName = (id: string) => net.seatNames[net.ownership[id] ?? 0] ?? 'L’hôte';
  const isGuest = net.mode === 'guest';
  return (
    <div className="menu interlude-screen">
      <div className="menu-card interlude-card">
        <h1 className="title">{t('interlude.title')}</h1>
        <p className="subtitle">{interlude.weeks} semaine{interlude.weeks > 1 ? 's' : ''}</p>
        <SynthBar
          heroes={heroes}
          interlude={interlude}
          money={money}
          activeId={phase === 'activities' ? openPane?.heroId ?? null : null}
          ownsHero={ownsHero}
          ownerName={ownerName}
        />
        <RuleDivider />
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
                  money={money}
                  catalog={catalog}
                  mecenat={mecenat}
                  canDrive={ownsHero(h.id)}
                  ownerName={ownsHero(h.id) ? undefined : ownerName(h.id)}
                  pane={openPane?.heroId === h.id ? openPane.pane : null}
                  onPane={(p) => setOpenPane(p ? { heroId: h.id, pane: p } : null)}
                />
              ))}
            </div>
            {bank.length > 0 && (
              <section className="interlude-hero panel">
                <h3><Icon id="resource/gold-purse" size="sm" /> Dépôts en cours</h3>
                <BankList bank={bank} party={party} interlude={interlude} canDrive={ownsHero} />
              </section>
            )}
            {/* Préparation d'une bataille en attente (ADE II ch.8) : le budget d'Activités est CELUI de
                l'interlude (l.65) — la préparation se joue sur l'écran de Puissance de Bataille, chaque
                Activité y décomptant une Activité d'interlude du meneur. */}
            <BattlePrepEntry />
            {/* Jeux de taverne (NADJ ch.16) — délassement entre deux aventures ; affordance montrée
                seulement si l'option `tavern-games` est active. Ne consomme pas d'Activité. */}
            {rule('tavern-games') && <TavernGamesEntry />}
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
      <TavernGameModal />
      {phase === 'closing' && (
        <CloseRecap heroes={heroes} interlude={interlude} money={money} bank={bank} pendingOrders={pendingOrders} onCancel={() => setPhase('activities')} />
      )}
    </div>
  );
}

/** Pips d'Activités restantes (●○) d'un héros — partagés entre le bandeau et les tooltips. */
function ActivityPips({ st, weeks }: { st: InterludeHeroState; weeks: number }) {
  const total = Math.max(st.left, Math.min(3, weeks));
  return (
    <span className="interlude-pips" title={`${st.left} Activité${st.left > 1 ? 's' : ''} restante${st.left > 1 ? 's' : ''}`}>
      {'●'.repeat(st.left)}{'○'.repeat(Math.max(0, total - st.left))}
    </span>
  );
}

/** Bandeau de SYNTHÈSE persistant (sticky, les 3 phases) : une vignette par héros — portrait +
 *  jauge + États actifs (CharFrame `full`), Activités restantes, propriétaire coop, Revenus déjà
 *  gagnés — plus la bourse du GROUPE (les pertes d'Événements s'y lisent immédiatement). Le héros
 *  dont on regarde le volet est mis en évidence. */
function SynthBar({ heroes, interlude, money, activeId, ownsHero, ownerName }: {
  heroes: Combatant[];
  interlude: InterludeState;
  money: Money;
  activeId: string | null;
  ownsHero: (id: string) => boolean;
  ownerName: (id: string) => string;
}) {
  return (
    <div className="interlude-synth">
      {heroes.map((h) => {
        const st = interlude.perHero[h.id]!;
        return (
          <div key={h.id} className={`interlude-synth-hero${h.id === activeId ? ' active' : ''}`}>
            <CharFrame c={h} variant="full" size="sm" maxStates={3} />
            <div className="interlude-synth-meta">
              <span className="interlude-synth-name">{h.name}</span>
              <ActivityPips st={st} weeks={interlude.weeks} />
              {!ownsHero(h.id) && (
                <span className="interlude-owner"><Icon id="nav/seat-owner" size="sm" /> {ownerName(h.id)}</span>
              )}
              {st.revenueBrass > 0 && (
                <span className="interlude-synth-rev" title="Revenus de la période — crédités à la reprise"><CoinsB brass={st.revenueBrass} /></span>
              )}
            </div>
          </div>
        );
      })}
      <div className="interlude-synth-purse" title={t('interlude.close.warning.title')}>
        <Icon id="resource/gold-purse" />
        <Coins money={money} />
      </div>
    </div>
  );
}

/** Entrée « Préparation de bataille » (ADE II ch.8) : si une bataille est en attente de préparation
 *  (`massBattle.phase === 'prep'`), propose de rejoindre l'écran de Puissance de Bataille. Les Activités
 *  de préparation qui s'y jouent DÉCOMPTENT le budget d'Activités d'interlude du meneur (budget UNIQUE,
 *  l.65) — pas de second budget. */
function BattlePrepEntry() {
  const mb = useGame((s) => s.massBattle);
  const setScreen = useGame((s) => s.setScreen);
  if (!mb || mb.phase !== 'prep') return null;
  return (
    <section className="interlude-hero panel">
      <h3><Icon id="action/attack" size="sm" /> Préparation de bataille</h3>
      <p className="interlude-detail">
        Une bataille se prépare : <b>{mb.ally.name}</b> contre <b>{mb.enemy.name}</b>. Les Activités de
        préparation (Discours, Planification, Repérage, Sabotage…) puisent dans vos Activités
        <em> Entre deux aventures</em> (max 3, ADE II ch.8).
      </p>
      <button className="btn small btn-primary" onClick={() => setScreen('massBattle')}>
        Rejoindre le conseil de guerre
      </button>
    </section>
  );
}

/** Entrée « Jeux de taverne » (NADJ ch.16) : ouvre la modale de jeu (choix jeu + adversaire). */
function TavernGamesEntry() {
  const open = useGame((s) => s.openTavernGames);
  return (
    <section className="interlude-hero panel">
      <h3><Icon id="nav/dice" size="sm" /> Jeux de taverne</h3>
      <p className="interlude-detail">Un moment de détente : dés, boules, bras de fer… (Nuits agitées, ch.16).</p>
      <button className="btn small btn-primary" onClick={open}>Proposer une partie</button>
    </section>
  );
}

/** Conséquences mécaniques d'un événement, STRUCTURÉES (LDB 22) : les ops sont de la donnée, ceci
 *  est un RENDU — chaque conséquence porte son icône du registre (`<FxChip>`), aucun parsing. */
function fxChips(st: InterludeHeroState, hero: Combatant): { icon: IconId; label: string }[] {
  const fx = st.fx;
  const chips: { icon: IconId; label: string }[] = [];
  if (fx?.moneyPct) chips.push({ icon: 'resource/gold-purse', label: `${fx.moneyPct} % sur la bourse du groupe (pire tirage appliqué une fois)` });
  if (fx?.loseActivity) chips.push({ icon: 'nav/activity', label: '−1 Activité' });
  if (fx?.fortuneMaxDelta) chips.push({ icon: 'resource/fortune', label: `+${fx.fortuneMaxDelta} Point de Chance` });
  if (fx?.revenuePct) chips.push({ icon: 'resource/gold-purse', label: `Revenus ${fx.revenuePct > 0 ? '+' : ''}${fx.revenuePct} %${fx.revenueClasses ? ` (${fx.revenueClasses.join(', ')})` : ''}` });
  if (fx?.revenueBlockedClasses) chips.push({ icon: 'resource/gold-purse', label: fx.revenueBlockedClasses.includes('*') || fx.revenueBlockedClasses.includes(heroClass(hero)) ? 'Revenus impossibles cette période' : `Revenus bloqués pour : ${fx.revenueBlockedClasses.join(', ')}` });
  if (fx?.bankPct) chips.push({ icon: 'resource/gold-purse', label: `${fx.bankPct} % sur l'argent placé en banque` });
  if (fx?.stashRaided) chips.push({ icon: 'ui/warning', label: 'Planque dévalisée !' });
  if (fx?.bankCrashCheck) chips.push({ icon: 'ui/warning', label: 'Les banques vérifient leur faillite immédiatement' });
  // Devoir elfique : conséquence APPLIQUÉE par le flow (règle optionnelle comprise) — jamais re-dérivée ici.
  if (st.elfDuty) chips.push({ icon: 'nav/activity', label: '−1 Activité (devoir elfique)' });
  return chips;
}

/** Phase 1 — les événements d100 de la période, racontés héros par héros (audit M1). L'impact
 *  mécanique se lit en chips ET dans le bandeau de synthèse (déjà appliqué au store). */
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
          const chips = fxChips(st, h);
          return (
            <section key={h.id} className="interlude-hero panel">
              <h3>
                <CharFrame c={h} variant="identity" size="sm" /> <b className="interlude-name">{h.name}</b>
                <span className="interlude-left"><Icon id="nav/dice" size="sm" /> {st.eventRoll}</span>
              </h3>
              <p className="interlude-event"><strong>{ev.label}.</strong> {ev.text}</p>
              {chips.length > 0 && (
                <div className="interlude-fx">
                  {chips.map((c) => <FxChip key={c.label} icon={c.icon} label={c.label} />)}
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

/** Toutes les ops d'issue d'une Activité (binaire `onSuccess` + bandes `outcomes`) — pour les gates
 *  d'affordance DATA-DRIVEN (ex. « expie du Péché » ⇒ inutile à 0 Péché). */
const activityOps = (def: ActivityDef): GameOp[] =>
  [...(def.onSuccess ?? []), ...(def.outcomes ?? []).flatMap((b) => b.ops ?? [])];

/**
 * GABARIT UNIQUE des volets d'Activité : en-tête (icône du registre + titre), description
 * VERBATIM `<Prose>`, zone de paramètres (corps DÉFILABLE), et PIED FIXE — pré-jet
 * (`PendingRollLine`), coût `<Coins>`, formule des activités sans jet, bouton(s) d'action
 * jamais cachés par le scroll.
 */
function ActivityPane({ icon, title, desc, blocked, prejet, cost, note, actions, children }: {
  icon: string;
  title: string;
  /** Description VERBATIM (Markdown) de la source — rendue par `<Prose>` (règle 5). */
  desc?: string;
  /** Raison d'indisponibilité (gate d'affordance) — l'action du pied est alors désactivée. */
  blocked?: ReactNode;
  /** Ligne de test AVANT d'entreprendre (compétence en chip + Difficulté + cible). */
  prejet?: PendingRoll;
  /** Coût de l'Activité (rendu `<Coins>`/PX) — affiché dans le pied. */
  cost?: ReactNode;
  /** Formule/complément du pied (activités SANS jet : tirage direct, taux, livraison…). */
  note?: ReactNode;
  /** Bouton(s) du pied. */
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="interlude-pane">
      <header className="interlude-pane-head"><Icon id={icon} /> <b>{title}</b></header>
      <div className="interlude-pane-body">
        {desc && <div className="interlude-pane-desc"><Prose md={desc} /></div>}
        {blocked && <p className="interlude-blocked">{blocked}</p>}
        {children}
      </div>
      <footer className="interlude-pane-foot">
        <div className="interlude-pane-terms">
          {prejet && <PendingRollLine p={prejet} />}
          {(cost != null || note != null) && (
            <p className="interlude-detail">
              {cost != null && <>Coût : <b>{cost}</b>{note != null ? ' · ' : ''}</>}
              {note}
            </p>
          )}
        </div>
        <div className="interlude-pane-actions">{actions}</div>
      </footer>
    </div>
  );
}

/** Résolveurs des Activités du catalogue qui ont un VOLET DÉDIÉ (UX riche : formule de Revenus,
 *  flux 2 étapes de l'Artisanat, sélecteur de Talent, sélecteur d'artefact) ou vivent ailleurs
 *  (`mecenat` = dans la banque). Exclus de la liste GÉNÉRIQUE du catalogue pour ne pas les doubler. */
const CORE_RESOLVERS = new Set(['income', 'craftExtended', 'learnTalent', 'identify', 'mecenat']);

/** Icônes des Activités à volet dédié — les Activités du catalogue générique portent la leur
 *  en DONNÉE (`ActivityDef.icon`). */
const PANE_ICON = {
  revenus: 'resource/gold-purse',
  craft: 'item/misc',
  learn: 'nav/compendium',
  order: 'scenario/market',
  bank: 'resource/gold-purse',
  identify: 'nav/identify',
} as const;

function HeroCard({ hero, st, money, catalog, mecenat, canDrive, ownerName, pane, onPane }: {
  hero: Combatant; st: InterludeHeroState; money: Money;
  /** Activités du catalogue data-driven proposables ICI (contexte + gate `where`). */
  catalog: ActivityDef[];
  /** Activité de Mécénat (variante d'Opération bancaire) si proposable ici. */
  mecenat?: ActivityDef;
  /** Possession coop (audit M7) : false = ce héros est mené par un autre joueur (lecture seule). */
  canDrive: boolean;
  ownerName?: string;
  /** Volet ouvert de CE héros (état remonté à l'écran — un seul volet ouvert à la fois). */
  pane: string | null;
  onPane: (pane: string | null) => void;
}) {
  const ev = interludeEventFor(st.eventRoll);
  const status = heroStatus(hero);
  const none = st.left <= 0 || !canDrive;
  const paneBtn = (key: string, label: ReactNode, title: string) => (
    <button
      key={key}
      className={`btn small${pane === key ? ' btn-primary' : ''}`}
      disabled={!canDrive || (none && pane !== key)}
      onClick={() => onPane(pane === key ? null : key)}
      title={canDrive ? title : `Mené par ${ownerName ?? 'un autre joueur'}`}
    >
      {label}
    </button>
  );
  // Volet du catalogue GÉNÉRIQUE : les 4 activités socle (Revenus/Artisanat/Apprentissage/
  // Identification) ont leur volet dédié ci-dessous — CatalogPane ne sert que les AUTRES.
  const def = pane ? catalog.find((d) => d.id === pane && !CORE_RESOLVERS.has(d.resolver ?? '')) : undefined;
  return (
    <section className={`interlude-hero panel${pane ? ' active' : ''}`}>
      <h3>
        <CharFrame c={hero} variant="identity" size="sm" />
        <b className="interlude-name">{hero.name}</b>
        <span className="interlude-left">
          {!canDrive && <span className="interlude-owner"><Icon id="nav/seat-owner" size="sm" /> {ownerName ?? 'autre joueur'} · </span>}
          Statut {status.tier} {status.standing}
        </span>
      </h3>
      <p className="interlude-event" title={ev.text}><Icon id="nav/dice" size="sm" /> {st.eventRoll} — {ev.label}</p>
      <div className="interlude-actions">
        {paneBtn('revenus', <><Icon id={PANE_ICON.revenus} size="sm" /> Revenus…</>, 'Une semaine de travail — Test Accessible (+20) de la compétence de carrière (LDB 08)')}
        {paneBtn('craft', st.craft
          ? <><Icon id={PANE_ICON.craft} size="sm" /> Artisanat — {findTrappingById(st.craft.trappingId)?.label ?? st.craft.trappingId} ({st.craft.drDone}/{st.craft.drTarget})</>
          : <><Icon id={PANE_ICON.craft} size="sm" /> Artisanat…</>,
          st.craft
            ? `Test étendu de Métier — ${st.craft.drDone}/${st.craft.drTarget} DR (${DIFFICULTY_LABELS[st.craft.difficulty]})`
            : 'Fabriquer un équipement du catalogue (matériaux = ¼ du prix, Test étendu de Métier)')}
        {paneBtn('learn', <><Icon id={PANE_ICON.learn} size="sm" /> Apprentissage…</>, 'Apprendre un Talent hors carrière auprès d’un tuteur (Test Difficile −20 ; PX et argent perdus sur un échec)')}
        {paneBtn('order', <><Icon id={PANE_ICON.order} size="sm" /> Commande…</>, 'Commander un objet Exotique : payé maintenant, livré après la prochaine aventure')}
        {paneBtn('bank', <><Icon id={PANE_ICON.bank} size="sm" /> Banque…</>, 'Déposer de l’argent pour qu’il survive à la clôture (Opérations bancaires)')}
        {paneBtn('identify', <><Icon id={PANE_ICON.identify} size="sm" /> Identifier…</>, 'Étudier un artefact magique une semaine — Test de Savoir (Magie) Intermédiaire (ADE2)')}
        {/* Activités du catalogue SANS volet dédié : les 4 activités « socle » (Revenus/Artisanat/
            Apprentissage/Identification, volets riches ci-dessus) et Mécénat (dans la banque) sont
            exclues pour ne pas les doubler — leur résolveur les identifie en DONNÉE. */}
        {catalog.filter((d) => !CORE_RESOLVERS.has(d.resolver ?? '')).map((d) => (
          paneBtn(d.id, <><Icon id={d.icon} size="sm" /> {d.label}…</>, d.desc ? `${mdToText(d.desc).slice(0, 160)}…` : d.label)
        ))}
      </div>
      {pane === 'revenus' && <RevenusPane hero={hero} st={st} disabled={none} />}
      {pane === 'craft' && (st.craft
        ? <CraftProgressPane hero={hero} craft={st.craft} disabled={none} />
        : <CraftPane hero={hero} disabled={none} money={money} />)}
      {pane === 'learn' && <LearnPane hero={hero} disabled={none} fails={st.learnFails} money={money} />}
      {pane === 'order' && <OrderPane hero={hero} disabled={none} money={money} />}
      {pane === 'bank' && <BankPane hero={hero} disabled={none} bronzeBlocked={status.tier === 'bronze'} money={money} mecenat={mecenat} />}
      {pane === 'identify' && <IdentifyPane hero={hero} disabled={none} />}
      {def && <CatalogPane hero={hero} def={def} disabled={none} />}
    </section>
  );
}

/** Revenus (LDB 08 l.135-144) : Test Accessible (+20) de la compétence de carrière — la formule
 *  ET le pré-jet sont lisibles AVANT d'entreprendre. */
function RevenusPane({ hero, st, disabled }: { hero: Combatant; st: InterludeHeroState; disabled: boolean }) {
  const activity = useGame((s) => s.interludeActivity);
  const ev = interludeEventFor(st.eventRoll);
  const blockedCls = st.fx?.revenueBlockedClasses;
  const blocked = !!blockedCls && (blockedCls.includes('*') || blockedCls.includes(heroClass(hero)))
    ? `Interdit par l'événement de la période (${ev.label}).`
    : null;
  const status = heroStatus(hero);
  // « Gagner de l'argent grâce au Statut » (LDB 08 l.135-144) — la formule, lisible AVANT le jet.
  const incomeFormula = status.tier === 'bronze'
    ? `${status.standing} × 2d10 sous`
    : status.tier === 'argent'
      ? `${status.standing} × 1d10 pistole${status.standing > 1 ? 's' : ''}`
      : `${status.standing} couronne${status.standing > 1 ? 's' : ''} d'or`;
  const skillId = incomeSkillOf(hero);
  return (
    <ActivityPane
      icon={PANE_ICON.revenus}
      title="Revenus — une semaine de travail"
      blocked={blocked}
      prejet={testPending(skillNode(<SkillChip skillId={skillId} />, 'accessible'), testValue(hero, skillId), undefined, 'accessible')}
      note={<>Succès : <b>{incomeFormula}</b> · échec : moitié · Échec Stupéfiant : rien. Crédités à la reprise.</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !!blocked}
          title={blocked ?? 'Travailler une semaine (consomme l’Activité au jet)'}
          onClick={() => activity(hero.id, 'revenus')}
        >
          Entreprendre
        </button>
      }
    />
  );
}

/** Lancer d'un ouvrage EN COURS — « Chaque Activité […] vous permet d'effectuer un lancer pour
 *  votre Test étendu » (ch.23 l.92). */
function CraftProgressPane({ hero, craft, disabled }: {
  hero: Combatant; craft: NonNullable<InterludeHeroState['craft']>; disabled: boolean;
}) {
  const activity = useGame((s) => s.interludeActivity);
  const metier = hero.skills.find((k) => k.skillId === 'metier');
  const label = findTrappingById(craft.trappingId)?.label ?? craft.trappingId;
  const chip = metier
    ? <SkillChip skillId={metier.skillId} show={skillInstanceLabel(metier)} />
    : <b>Métier</b>;
  return (
    <ActivityPane
      icon={PANE_ICON.craft}
      title={`Artisanat — ${label}`}
      prejet={testPending(skillNode(chip, craft.difficulty), testValue(hero, 'metier', undefined, metier?.spec), undefined, craft.difficulty)}
      note={<>Test étendu : <b>{craft.drDone}/{craft.drTarget} DR</b> (1 lancer par Activité — le travail inachevé se conserve).</>}
      actions={
        <button className="btn small btn-primary" disabled={disabled} onClick={() => activity(hero.id, 'craft')}
          title={`Avancer l'ouvrage — ${craft.drDone}/${craft.drTarget} DR (${DIFFICULTY_LABELS[craft.difficulty]})`}>
          Entreprendre
        </button>
      }
    />
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
        placeholder="Filtrer le catalogue…"
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

/** Engager un Artisanat (ch.23 l.66) : catalogue + Atouts/Défauts visés ; matériaux ¼ du prix. */
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
  // Titre (attribut texte) et message (affiché : montant en <Coins>) portent la même raison.
  const blockedTitle = !metier
    ? 'Aucune Compétence Métier avec avances — impossible de fabriquer.'
    : !affordable && sel
      ? `Matériaux trop chers (${fmt(sel.materialsBrass)}) pour la bourse du groupe.`
      : null;
  const blockedMsg = !metier
    ? <>Aucune Compétence Métier avec avances — impossible de fabriquer.</>
    : !affordable && sel
      ? <>Matériaux trop chers (<CoinsB brass={sel.materialsBrass} />) pour la bourse du groupe.</>
      : null;
  const chip = metier
    ? <SkillChip skillId={metier.skillId} show={skillInstanceLabel(metier)} />
    : <b>Métier</b>;
  return (
    <ActivityPane
      icon={PANE_ICON.craft}
      title="Artisanat — engager un ouvrage"
      blocked={blockedMsg}
      prejet={sel && target
        ? testPending(skillNode(chip, target.difficulty), metier ? testValue(hero, 'metier', undefined, metier.spec) : 0, undefined, target.difficulty)
        : undefined}
      cost={sel ? <CoinsB brass={sel.materialsBrass} /> : undefined}
      note={sel && target
        ? <>matériaux ¼ du prix, payés à l'engagement · Test étendu : <b>{target.dr} DR</b> à cumuler (1 lancer par Activité).</>
        : <>Choisir un équipement du catalogue — matériaux ¼ du prix, Test étendu de Métier.</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !sel || !metier || !affordable}
          title={blockedTitle ?? 'Achète les matériaux et installe l’ouvrage (le travail inachevé se conserve)'}
          onClick={() => sel && craftStart(hero.id, sel.id, atouts, defauts)}
        >
          Entreprendre
        </button>
      }
    >
      <TrappingSelect options={catalog} value={id} onChange={setId} />
      <div className="interlude-craft-q">
        {ATOUTS.map((q) => (
          <label key={q} title={mdToText(craftQual(q).desc ?? '')}>
            <input type="checkbox" checked={atouts.includes(q)} onChange={() => toggle(atouts, setAtouts, q)} /> {craftQual(q).label}
          </label>
        ))}
        {DEFAUTS.map((q) => (
          <label key={q} title={mdToText(craftQual(q).desc ?? '')}>
            <input type="checkbox" checked={defauts.includes(q)} onChange={() => toggle(defauts, setDefauts, q)} /> {craftQual(q).label} (défaut)
          </label>
        ))}
      </div>
    </ActivityPane>
  );
}

/** Apprentissage particulier (ch.23 l.58-63) : Talent hors carrière — Test Difficile (−20) sur la
 *  Caractéristique du Maxi (+10 par tentative ratée) ; PX et argent perdus MÊME sur un échec. */
function LearnPane({ hero, disabled, fails, money }: { hero: Combatant; disabled: boolean; fails?: Record<string, number>; money: Money }) {
  const activity = useGame((s) => s.interludeActivity);
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
  // Caractéristique du Test = celle du Maxi du Talent, sinon Int (même dérivation que le flux).
  const talent = sel ? findTalentById(sel.id) : undefined;
  const ck: CharKey = talent?.max && typeof talent.max !== 'number' ? talent.max.bonusOf : 'Int';
  const prejet = sel
    ? optionPending(
        CHAR_LABELS[ck],
        effectiveChar(hero, ck),
        [...(difficultyMods('difficile') ?? []), ...(failCount ? [{ label: 'Acharnement', value: failCount * 10 }] : [])],
      )
    : undefined;
  return (
    <ActivityPane
      icon={PANE_ICON.learn}
      title="Apprentissage particulier"
      blocked={sel && !xpOk ? <>PX insuffisants : {xp}/{sel.xpCost}.</> : undefined}
      prejet={prejet}
      cost={sel ? <>{sel.xpCost} PX (il vous en reste {xp}) + tuteur {fmt(sel.tutorMinBrass)} à {fmt(sel.tutorMaxBrass)}</> : undefined}
      note={sel
        ? <><EntityRef category="talents" label={sel.label} /> — tuteur 2d10 pa / 100 PX ; PX et argent perdus même sur un échec.</>
        : <>Choisir un Talent hors carrière — tuteur 2d10 pa / 100 PX ; PX et argent perdus même sur un échec.</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !sel || !xpOk || !purseOk}
          title={!xpOk && sel ? `PX insuffisants (${sel.xpCost} requis)` : !purseOk ? 'La bourse ne couvre même pas le tuteur le moins cher' : 'Trouver un tuteur et tenter l’apprentissage'}
          onClick={() => sel && activity(hero.id, 'learn', { talentId: sel.id })}
        >
          Entreprendre
        </button>
      }
    >
      <input className="interlude-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filtrer les talents…" aria-label="Filtrer les talents" />
      <select className="interlude-select" value={label} onChange={(e) => setLabel(e.target.value)} size={Math.min(8, Math.max(3, filtered.length))}>
        {filtered.map((o) => (
          <option key={o.label} value={o.label} title={mdToText(findTalent(o.label)?.desc ?? '')}>
            {o.label} — {o.xpCost} PX · tuteur {fmt(o.tutorMinBrass)} à {fmt(o.tutorMaxBrass)}
          </option>
        ))}
      </select>
    </ActivityPane>
  );
}

/** Passer commande (ch.23 l.167-172) : objet Exotique payé MAINTENANT, livré au prochain interlude.
 *  Pas de jet — le pied porte le coût et la formule. */
function OrderPane({ hero, disabled, money }: { hero: Combatant; disabled: boolean; money: Money }) {
  const order = useGame((s) => s.interludeOrder);
  const catalog = useMemo(() => orderCatalog(), []);
  const [id, setId] = useState('');
  const sel = catalog.find((o) => o.id === id);
  const affordable = !sel || toBrass(money) >= sel.priceBrass;
  return (
    <ActivityPane
      icon={PANE_ICON.order}
      title="Passer commande"
      blocked={sel && !affordable ? <>La bourse du groupe ne couvre pas ce prix.</> : undefined}
      cost={sel ? <CoinsB brass={sel.priceBrass} /> : undefined}
      note={<>payé maintenant — « l'objet sera achevé après votre prochaine aventure » (livré à l'ouverture du prochain interlude). Sans jet : 1 objet par Activité.</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !sel || !affordable}
          title={!affordable && sel ? `Commande trop chère (${fmt(sel.priceBrass)})` : 'Passer commande (1 objet par Activité)'}
          onClick={() => sel && order(hero.id, sel.id)}
        >
          Entreprendre
        </button>
      }
    >
      <TrappingSelect options={catalog} value={id} onChange={setId} />
    </ActivityPane>
  );
}

/** Opérations bancaires (ch.23 l.154-165) + Mécénat (ACE p.220) : dépôt sans jet — le pied porte
 *  les formules (Indice d'intérêts, découverte de planque) et les trois dépôts possibles. */
function BankPane({ hero, disabled, bronzeBlocked, money, mecenat }: { hero: Combatant; disabled: boolean; bronzeBlocked: boolean; money: Money; mecenat?: ActivityDef }) {
  const bankDeposit = useGame((s) => s.interludeBank);
  const [amountPa, setAmountPa] = useState(10);
  const purseBrass = toBrass(money);
  const pa = Math.max(1, Math.floor(amountPa));
  const amountBrass = pa * PA_PER_SC;
  const quick = (frac: number) => setAmountPa(Math.max(1, Math.floor(purseBrass * frac / PA_PER_SC)));
  const mecenatMinBrass = (mecenat?.minInvest?.gold ?? 0) * PA_PER_CO;
  return (
    <ActivityPane
      icon={PANE_ICON.bank}
      title="Opérations bancaires"
      blocked={amountBrass > purseBrass ? <>Dépôt au-delà de la bourse du groupe.</> : undefined}
      cost={<CoinsB brass={amountBrass} />}
      note={<>
        Sans jet · Investir : intérêts de l'Indice (1-10) %, faillite au retrait sur d100 ≤ Indice
        (retirer coûte 1 Activité) · Planquer : aucun intérêt, retrait libre, découverte sur d100 ≤ 10.
        {bronzeBlocked && <span className="interlude-blocked"> Investir exige le Statut Argent ou Or.</span>}
      </>}
      actions={<>
        <button
          className="btn small btn-primary"
          disabled={disabled || bronzeBlocked || amountBrass > purseBrass}
          onClick={() => bankDeposit(hero.id, 'invest', amountBrass)}
          title={bronzeBlocked ? '« Vous devez être des échelons Or et Argent pour épargner dans une banque »' : 'Intérêts = Indice d’intérêts (1-10) % ; au retrait, faillite sur d100 ≤ Indice (retrait = 1 Activité)'}
        >
          <Icon id="resource/gold-purse" size="sm" /> Investir
        </button>
        <button
          className="btn small btn-primary"
          disabled={disabled || amountBrass > purseBrass}
          onClick={() => bankDeposit(hero.id, 'stash', amountBrass)}
          title="Sans intérêts ; retrait libre — mais découverte de la planque sur d100 ≤ 10"
        >
          <Icon id="item/misc" size="sm" /> Planquer
        </button>
        {mecenat && (
          <button
            className="btn small btn-primary"
            disabled={disabled || amountBrass > purseBrass || amountBrass < mecenatMinBrass}
            onClick={() => bankDeposit(hero.id, 'mecenat', amountBrass)}
            title={amountBrass < mecenatMinBrass
              ? `Mise minimale ${formatMoney(fromBrass(mecenatMinBrass))} (« au moins 5 CO », ACE p.220)`
              : 'Sponsoriser un dramaturge prometteur — retrait résolu par un Test d’Évaluation Intermédiaire (+0)'}
          >
            <Icon id="scenario/opera" size="sm" /> Mécénat
          </button>
        )}
      </>}
    >
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
        Bourse du groupe : <b><Coins money={money} /></b> · dépôt prévu : <b><CoinsB brass={amountBrass} /></b>
      </p>
    </ActivityPane>
  );
}

/** Identifier un artefact (ADE2 ch.4) : choisir un objet NON identifié du sac — une semaine
 *  d'étude par tentative, Test de Savoir (Magie) Intermédiaire (+0). */
function IdentifyPane({ hero, disabled }: { hero: Combatant; disabled: boolean }) {
  const activity = useGame((s) => s.interludeActivity);
  const items = (hero.items ?? []).filter((i) => i.identified === false);
  const [uid, setUid] = useState(items[0]?.uid ?? '');
  const savoir = hero.skills.find((k) => k.skillId === 'savoir' && (k.spec ?? '') === 'magie' && k.advances >= 1);
  const blocked = !items.length
    ? `Aucun objet non identifié dans le sac de ${hero.name}.`
    : !savoir
      ? `${hero.name} ne possède pas Savoir (Magie) — la longue étude d'un artefact est la voie des sorciers (ADE2).`
      : null;
  return (
    <ActivityPane
      icon={PANE_ICON.identify}
      title="Identifier un artefact"
      blocked={blocked}
      prejet={savoir
        ? testPending(skillNode(<SkillChip skillId={savoir.skillId} show={skillInstanceLabel(savoir)} />, 'intermediaire'), testValue(hero, savoir.skillId, undefined, savoir.spec), undefined, 'intermediaire')
        : undefined}
      note={<>Une semaine d'étude · un grand succès révèle les Particularités ; une lourde méprise ancre de <b>fausses</b> certitudes.</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !!blocked || !uid}
          title={blocked ?? 'Installer l’étude au laboratoire (consomme l’Activité au jet)'}
          onClick={() => uid && activity(hero.id, 'identify', { itemUid: uid })}
        >
          Entreprendre
        </button>
      }
    >
      {items.length > 0 && (
        <select className="interlude-select" value={uid} onChange={(e) => setUid(e.target.value)} aria-label="Artefact à étudier">
          {items.map((i) => (
            <option key={i.uid} value={i.uid}>
              {i.name}{i.magicKnown ? ' ★' : ''}{i.suspectedQualities?.length ? ' (certitudes douteuses)' : ''}
            </option>
          ))}
        </select>
      )}
    </ActivityPane>
  );
}

/** Volet d'une Activité du CATALOGUE data-driven : description VERBATIM (`<Prose>`), pré-jet dérivé
 *  de la DONNÉE (compétences « au choix » → la meilleure ; `masterWeapon` → celle de l'arme visée),
 *  cible éventuelle selon le résolveur, et gates d'affordance dérivés des ops. */
function CatalogPane({ hero, def, disabled }: { hero: Combatant; def: ActivityDef; disabled: boolean }) {
  const start = useGame((s) => s.interludeActivity);
  const [targetUid, setTargetUid] = useState('');
  const [spellId, setSpellId] = useState('');
  const ops = activityOps(def);
  // Cibles par résolveur (data-driven : PAR résolveur, jamais par id d'activité).
  const weapons = def.resolver === 'masterWeapon'
    ? (hero.items ?? []).filter((i) => (i.kind === 'melee' || i.kind === 'ranged') && i.requiresMastery
        && i.trappingId && !(hero.masteredWeapons ?? []).includes(i.trappingId))
    : [];
  const artefacts = def.resolver === 'identifyByResearch'
    ? (hero.items ?? []).filter((i) => i.identified === false)
    : [];
  const spellOptions = useMemo(
    () => (def.resolver === 'memorizeDiscount' ? learnableSpells(hero).filter((x) => x.cost > 0) : []),
    [def.resolver, hero],
  );
  // Gates d'affordance dérivés des ops de la donnée — jamais un cas par id.
  const blocked =
    def.resolver === 'masterWeapon' && !weapons.length ? 'Aucune arme inhabituelle à maîtriser dans le sac.'
    : def.resolver === 'identifyByResearch' && !artefacts.length ? `Aucun objet non identifié dans le sac de ${hero.name}.`
    : def.resolver === 'memorizeDiscount' && !spellOptions.length ? 'Aucun sort à mémoriser (Talent de lanceur et sort payant requis).'
    : ops.some((o) => o.op === 'sinMod' && o.amount < 0) && !(hero.sinPoints ?? 0) ? `${hero.name} n'a aucun Point de Péché à expier.`
    : ops.some((o) => o.op === 'removePsychTrait') && !(hero.psychTraits?.length) ? `${hero.name} n'a aucun Trait psychologique à soigner.`
    : null;
  const uid = targetUid || weapons[0]?.uid || artefacts[0]?.uid || '';
  const spell = spellId || spellOptions[0]?.spell.id || '';
  const diff = def.difficulty ?? 'intermediaire';
  // Pré-jet dérivé de la DONNÉE — même dérivation que le flux (`openCatalogActivity`) :
  // `masterWeapon` impose la compétence de l'arme visée ; sinon la MEILLEURE des déclarées.
  let prejet: PendingRoll | undefined;
  if (def.resolver === 'masterWeapon') {
    const item = weapons.find((i) => i.uid === uid);
    if (item) {
      const kind = item.kind === 'ranged' ? ('ranged' as const) : ('melee' as const);
      const base = combatValue(hero, kind, buildWeapon({ name: item.name, type: kind, damage: item.damage ?? { plusBF: true, flat: 0 }, subType: item.subType }));
      prejet = testPending(skillNode(<SkillChip skillId={kind === 'melee' ? 'corps-a-corps' : 'projectiles'} />, diff), base, undefined, diff);
    }
  } else if (def.skills?.length) {
    const best = def.skills
      .map((ref) => ({ ref, v: testValue(hero, ref.skillId, undefined, ref.spec) }))
      .sort((a, b) => b.v - a.v)[0];
    const chips = def.skills.map((s, i) => (
      <Fragment key={`${s.skillId}-${s.spec ?? ''}`}>
        {i > 0 && ' ou '}
        <SkillChip skillId={s.skillId} show={s.spec ? `${refLabel('skills', { id: s.skillId })} (${s.spec})` : undefined} />
      </Fragment>
    ));
    prejet = testPending(skillNode(<>{chips}</>, diff), best.v, undefined, diff);
  }
  return (
    <ActivityPane
      icon={def.icon}
      title={def.label}
      desc={def.desc}
      blocked={blocked}
      prejet={prejet}
      note={<>1 Activité — consommée au jet.</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !!blocked}
          title={blocked ?? `Entreprendre ${def.label} (consomme l'Activité au jet)`}
          onClick={() => start(hero.id, def.id, { ...(uid ? { itemUid: uid } : {}), ...(spell ? { spellId: spell } : {}) })}
        >
          Entreprendre
        </button>
      }
    >
      {weapons.length > 0 && (
        <select className="interlude-select" value={uid} onChange={(e) => setTargetUid(e.target.value)} aria-label="Arme à maîtriser">
          {weapons.map((i) => <option key={i.uid} value={i.uid}>{i.name}</option>)}
        </select>
      )}
      {artefacts.length > 0 && (
        <select className="interlude-select" value={uid} onChange={(e) => setTargetUid(e.target.value)} aria-label="Objet magique à tester">
          {artefacts.map((i) => <option key={i.uid} value={i.uid}>{i.name}{i.magicKnown ? ' ★' : ''}</option>)}
        </select>
      )}
      {spellOptions.length > 0 && (
        <select className="interlude-select" value={spell} onChange={(e) => setSpellId(e.target.value)} aria-label="Sort à mémoriser">
          {spellOptions.map((x) => <option key={x.spell.id} value={x.spell.id}>{x.spell.label} — {x.cost} PX</option>)}
        </select>
      )}
    </ActivityPane>
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
        // Retirer un invest OU un mécénat exige une Activité (la planque est libre).
        const locked = b.kind !== 'stash' && left <= 0;
        return (
          <button
            key={i}
            className="btn small"
            disabled={foreign || locked}
            onClick={() => withdraw(i)}
            title={foreign
              ? 'Dépôt d’un héros mené par un autre joueur.'
              : locked
                ? 'Retirer ce dépôt exige une Activité — il n’en reste plus.'
                : b.kind === 'invest'
                  ? `Retirer (1 Activité) : ${fmt(bankPayout('invest', b.brass, b.rate))} si la banque tient (faillite sur d100 ≤ ${b.rate})`
                  : b.kind === 'mecenat'
                    ? 'Retirer (1 Activité) : Test d’Évaluation Intermédiaire (+0) — rendu de 120 % à la perte totale (Mécénat, ACE p.220)'
                    : `Retirer la planque (libre) : ${fmt(b.brass)} — découverte sur d100 ≤ 10`}
          >
            <Icon id={b.kind === 'invest' ? 'resource/gold-purse' : b.kind === 'mecenat' ? 'scenario/opera' : 'item/misc'} size="sm" />
            {' '}{owner?.name} : <CoinsB brass={b.brass} />
            {b.kind === 'invest' && <> → <CoinsB brass={bankPayout('invest', b.brass, b.rate)} /> (Indice {b.rate})</>} — Retirer
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
  const gameTime = useGame((s) => s.gameTime);
  const wasted = toBrass(money);
  const revenue = heroes.reduce((a, h) => a + (interlude.perHero[h.id]?.revenueBrass ?? 0), 0);
  const demoted = heroes.filter((h) => (h.careerLevel ?? 1) >= 3 && !interlude.perHero[h.id]?.didRevenus);
  const kept = bank.reduce((a, b) => a + b.brass, 0);
  const crafts = heroes.filter((h) => interlude.perHero[h.id]?.craft);
  return (
    <Modal title={t('interlude.recap.title')} variant="plain" className="interlude-recap" onClose={onCancel}>
      <ul className="interlude-recap-list">
        <li>
          <Icon id="resource/gold-purse" size="sm" /> {wasted > 0
            ? <><b><CoinsB brass={wasted} /></b> seront dépensés, bus, pariés ou donnés — en totalité (« Argent à gaspiller »).</>
            : 'La bourse est vide — rien à gaspiller.'}
        </li>
        <li><Icon id="resource/gold-purse" size="sm" /> Revenus crédités à la reprise : <b>{revenue > 0 ? <CoinsB brass={revenue} /> : 'aucun'}</b>.</li>
        {kept > 0 && <li><Icon id="resource/gold-purse" size="sm" /> Dépôts conservés : <b><CoinsB brass={kept} /></b> (récupérables à un prochain interlude).</li>}
        {pendingOrders.length > 0 && (
          <li><Icon id="scenario/market" size="sm" /> Commandes en cours : {pendingOrders.map((o) => findTrappingById(o.trappingId)?.label ?? o.trappingId).join(', ')} — livrées au prochain interlude.</li>
        )}
        {crafts.length > 0 && (
          <li><Icon id="item/misc" size="sm" /> Ouvrages inachevés conservés : {crafts.map((h) => `${h.name} (${findTrappingById(interlude.perHero[h.id]!.craft!.trappingId)?.label ?? interlude.perHero[h.id]!.craft!.trappingId})`).join(', ')}.</li>
        )}
        {demoted.map((h) => (
          <li key={h.id} className="interlude-blocked">
            <Icon id="ui/warning" size="sm" /> {h.name} n'a pas entrepris Revenus : retour au Niveau {(h.careerLevel ?? 1) - 1} de sa
            Carrière (« Avec le pouvoir »).
          </li>
        ))}
        {heroes.filter((h) => interlude.perHero[h.id]?.closeOps?.length).map((h) => {
          // Les ÉTATS réels de clôture passent par la primitive partagée (chips + popover Codex) ;
          // une op non-État éventuelle reste en clair.
          const ops = interlude.perHero[h.id]!.closeOps ?? [];
          const conds = ops.filter((o) => o.op === 'condition').map((o) => ({ name: o.name as ConditionId, value: typeof o.value === 'number' ? o.value : 1 }));
          const others = ops.filter((o) => o.op !== 'condition');
          return (
            <li key={`close-${h.id}`} className="interlude-blocked">
              {h.name} : <EffectChips conditions={conds} />{others.length > 0 && ` ${others.map((o) => o.op).join(', ')}`} au premier
              jour de la prochaine aventure (Activité échouée).
            </li>
          );
        })}
        <li>
          <Icon id="time/night" size="sm" /> Le temps passe : {interlude.weeks * 7} jours (récupération et
          convalescence comprises) — reprise <GameDate time={gameTime + interlude.weeks * 7 * MINUTES_PER_DAY} />.
        </li>
      </ul>
      <div className="modal-actions">
        <button className="btn" onClick={onCancel}>{t('interlude.recap.cancel')}</button>
        <button className="btn btn-primary" onClick={end}>{t('interlude.recap.confirm')}</button>
      </div>
    </Modal>
  );
}
