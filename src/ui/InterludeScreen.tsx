import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { interludeEventFor } from '../data/interludeEvents';
import { formatMoney, fromBrass, toBrass, add as moneyAdd, PA_PER_SC, PA_PER_CO, type Money } from '../engine/money';
import { bourseOf } from '../state/bourseFlow';
import { MINUTES_PER_DAY } from '../engine/clock';
import { heroStatus, heroClass, incomeSkillOf, interludeCatalog, bestActivitySkill, type InterludeState, type InterludeHeroState, type BankDeposit } from '../state/interludeFlow';
import { favorRequiredActivities, type Favor, type FavorLevel } from '../engine/favor';
import { armyMight, battleActivityDifficulty, battlePrepEntries, type MassBattleState } from '../state/massBattleFlow';
import {
  craftCatalog, craftTarget, learnableTalents, orderCatalog, metierOf, bankPayout, entrainementOptions,
  classGatedDifficulty,
  type ActivityDef, type ActivityResolver, type CraftOption, type LearnOption, type EntrainementOption,
} from '../engine/activities';
import type { GameOp } from '../engine/ops';
import { learnableSpells } from '../engine/grimoire';
import { DIFFICULTY_LABELS, CHAR_LABELS, type CharKey, type Difficulty } from '../engine/types';
import { describeQuality } from '../engine/qualities/describe';
import { effectiveChar } from '../engine/characteristics';
import { testValue } from '../engine/skills';
import { combatValue } from '../engine/combat';
import { RULE_REF } from '../engine/ruleRefs';
import { buildWeapon } from '../engine/items';
import { findTalentById, skillInstanceLabel, findTrappingById, qualities, refLabel, trappingTypeLabel, activityStakeRef, hasActivityStake } from '../data';
import type { Combatant, ConditionId } from '../engine/types';
import { rule } from '../engine/policy';
import { effectiveEntry } from '../engine/variants';
import { ownsLocalNet } from './ownership';
import { ActiveModal } from './ActiveModal';
import { TavernGameModal } from './TavernGameModal';
import { Modal } from './Modal';
import { CharFrame } from './CharFrame';
import { Coins } from './Coins';
import { EffectChips } from './EffectChips';
import { EntityRef } from './EntityChip';
import { FxChip } from './FxChip';
import { ParchmentCard } from './ParchmentCard';
import { RuleDivider, OrnateFrame } from './Ornaments';
import { GameDate } from './GameDate';
import { Icon } from './Icon';
import { NumberField } from './NumberField';
import type { IconId } from './icons';
import { type PendingRoll } from './RollLine';
import { testPending, optionPending } from './breakdown';
import { mdToText } from './Prose';
import { ActivityPane } from './ActivityPane';
import { SearchFilterField, useFilteredList } from './SearchFilterField';
import { MasterDetail } from './MasterDetail';
import { Tabs } from './Tabs';
import { t } from '../i18n';

/** Atouts/Défauts d'artisanat (LDB 60 l.9-62) — dérivés de la DONNÉE éditable (`qualities.json`,
 *  qualités d'Objet) par `id` ; tooltips/libellés via le registre (`describeQuality`). */
const ATOUTS = qualities.filter((q) => q.polarite === 'atout' && q.subType === 'objet').map((q) => q.id);
const DEFAUTS = qualities.filter((q) => q.polarite === 'defaut' && q.subType === 'objet').map((q) => q.id);
/** Libellé + desc d'une qualité d'artisanat par id (registre via `describeQuality`). */
const craftQual = (id: string) => describeQuality({ id }) ?? { label: id, desc: undefined };

/** Montant en TEXTE (attributs `title`, contenu d'`<option>` — HTML texte seul) ; tout AFFICHAGE
 *  passe par `<Coins>` (source visuelle unique des montants, LOT 5). */
const fmt = (brass: number) => formatMoney(fromBrass(brass));
/** Montant AFFICHÉ : le rendu coloré unique. */
const CoinsB = ({ brass }: { brass: number }) => <Coins money={fromBrass(brass)} />;

/** Libellés d'affichage des Niveaux de Faveur (LDB 23 l.145-151, #509). */
const FAVOR_LEVEL_LABELS: Record<FavorLevel, string> = { mineure: 'Faveur Mineure', majeure: 'Faveur Majeure', importante: 'Faveur Importante' };

/** Chip de compétence du Codex (popover desc + source) par id (+ spécialisation affichée). */
const SkillChip = ({ skillId, show }: { skillId: string; show?: string }) => (
  <EntityRef category="skills" id={skillId} label={refLabel('skills', { id: skillId })} show={show} />
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
  /** Faveurs dues (LDB 23, #509) — en jeu, dérivé du store ; en SSR, fourni par le seam. */
  favors?: Favor[];
  /** Phase d'ouverture forcée ('activities' saute l'intro Événements). */
  phase?: 'events' | 'activities' | 'closing';
  /** Volet OUVERT forcé (tests SSR du gabarit : pied pré-jet visible). */
  openPane?: { heroId: string; pane: string };
  /** Catalogue d'Activités data-driven proposables ICI (contexte 'interlude' + gate `where`) —
   *  en jeu, dérivé du store (`interludeCatalog`) ; en SSR, fourni par le seam (le store SSR sert
   *  l'état initial, comme les autres lectures). */
  catalog?: ActivityDef[];
  net?: InterludeNet;
  /** Bataille de masse en attente de préparation (ADE II 8) — bandeau d'info + Activités de prépa
   *  dans les volets par-héros. `null`/absent = pas de bataille pendante. */
  massBattle?: MassBattleState | null;
}

/**
 * Écran « Entre deux aventures » (LDB 22-23) — refonte UX LOT 6, puis maître-détail #330 :
 * 1. SYNTHÈSE persistante (bandeau sticky, les 3 phases) : une vignette par héros — portrait +
 *    États actifs (CharFrame `full`), Activités restantes (●○), propriétaire coop — + bourse du
 *    groupe. Les conséquences des Événements s'y reflètent immédiatement (lecture du store).
 * 2. UN héros à la fois (`Tabs` sélectionne) : les Activités du héros ACTIF se posent en
 *    `MasterDetail` — GAUCHE la liste des Activités (icône + nom), CENTRE le détail au gabarit
 *    unique `ActivityPane` (description `<Prose>` verbatim, pré-jet `testPending`/`optionPending`,
 *    coût `<Coins>`, PIED FIXE avec « Entreprendre » jamais caché par le scroll).
 * 3. Clôture RÉCAPITULATIVE confirmée (audit M3).
 *
 * Les lectures de DONNÉES restent dans ce composant racine (props descendantes) ; les enfants
 * ne tirent du store que des ACTIONS — testable en SSR via `seam`.
 */
export function InterludeScreen({ seam }: { seam?: InterludeSeam } = {}) {
  const storeInterlude = useGame((s) => s.interlude);
  const storeParty = useGame((s) => s.party);
  const storeBank = useGame((s) => s.bank);
  const storeOrders = useGame((s) => s.pendingOrders);
  const storeFavors = useGame((s) => s.favors);
  const storeNet = useGame((s) => s.net);
  const interlude = seam?.interlude ?? storeInterlude;
  const party = seam?.party ?? storeParty;
  // Somme des bourses PERSONNELLES du groupe (#531) — plus aucune bourse commune. Affichages agrégés
  // (bandeau de synthèse, récap de clôture) ; les affordances PAR héros lisent `bourseOf(hero)`.
  const money = seam?.money ?? party.reduce((sum, h) => moneyAdd(sum, bourseOf(h)), { gold: 0, silver: 0, brass: 0 });
  const bank = seam?.bank ?? storeBank;
  const pendingOrders = seam?.pendingOrders ?? storeOrders;
  const favors = seam?.favors ?? storeFavors ?? [];
  const net: InterludeNet = seam?.net ?? storeNet;
  // Catalogue d'Activités data-driven (`activities.json`) : contexte 'interlude' + gate `where`
  // résolu contre le LIEU courant (place de la carte du monde ↔ scène courante).
  const worldMap = useGame((s) => s.worldMap);
  const scene = useGame((s) => s.scene);
  const storeMassBattle = useGame((s) => s.massBattle);
  const massBattle = seam?.massBattle ?? storeMassBattle;
  // Le catalogue inclut les Activités de PRÉPARATION de bataille quand une bataille est en attente de prépa
  // (`interludeCatalog` lit `massBattle`) — « Interlude c'est interlude » : pas d'écran à part.
  const catalog = useMemo(
    () => seam?.catalog ?? interludeCatalog({ scene, worldMap, massBattle }),
    [seam?.catalog, scene, worldMap, massBattle],
  );
  const [phase, setPhase] = useState<'events' | 'activities' | 'closing'>(seam?.phase ?? 'events');
  // Héros ACTIF (les onglets sélectionnent — un seul volet d'Activités rendu à la fois, #330) +
  // Activité ouverte de ce héros (maître-détail : liste GAUCHE, détail CENTRE).
  const [activeHeroId, setActiveHeroId] = useState<string | null>(seam?.openPane?.heroId ?? null);
  const [pane, setPane] = useState<string | null>(seam?.openPane?.pane ?? null);
  if (!interlude) return null;
  const heroes = party.filter((h) => !h.dead && interlude.perHero[h.id]);
  const activeHero = heroes.find((h) => h.id === activeHeroId) ?? heroes[0];
  const mecenat = catalog.find((d) => d.resolver === 'mecenat');
  // Possession coop (audit M7) : chaque joueur mène les Activités de SES héros ; l'hôte clôt. Porte
  // UI UNIQUE (#1262) : le siège se lit par le routage d'état, jamais par une comparaison recopiée.
  const ownsHero = (id: string) => ownsLocalNet(net, id);
  const ownerName = (id: string) => net.seatNames[net.ownership[id] ?? 0] ?? 'L’hôte';
  const isGuest = net.mode === 'guest';
  return (
    <div className="interlude-shell tx-ink">
      <div className="interlude-column">
        <OrnateFrame tone="gold" className="interlude-masthead">
          <h1 className="interlude-title">{t('interlude.title')}</h1>
          <p className="interlude-subtitle">
            {interlude.weeks} semaine{interlude.weeks > 1 ? 's' : ''} de répit avant la prochaine aventure
          </p>
        </OrnateFrame>
        <SynthBar
          heroes={heroes}
          interlude={interlude}
          money={money}
          activeId={phase === 'activities' ? activeHero?.id ?? null : null}
          ownsHero={ownsHero}
          ownerName={ownerName}
        />
        <RuleDivider label={phase === 'events' ? 'Les nouvelles de la période' : 'Les Activités du groupe'} />
        {phase === 'events' ? (
          <EventsIntro heroes={heroes} interlude={interlude} onDone={() => setPhase('activities')} />
        ) : (
          <>
            {massBattle?.phase === 'prep' && <BattleBanner mb={massBattle} />}
            <div className="interlude-heroes">
              {heroes.length > 1 && (
                <Tabs
                  tabs={heroes.map((h) => ({ key: h.id, label: h.label }))}
                  active={activeHero?.id ?? null}
                  onChange={(id) => { setActiveHeroId(id); setPane(null); }}
                  label="Héros"
                />
              )}
              {activeHero && (
                <HeroCard
                  hero={activeHero}
                  st={interlude.perHero[activeHero.id]}
                  catalog={catalog}
                  mecenat={mecenat}
                  favors={favors.filter((f) => f.heroId === activeHero.id)}
                  massBattle={massBattle ?? null}
                  canDrive={ownsHero(activeHero.id)}
                  ownerName={ownsHero(activeHero.id) ? undefined : ownerName(activeHero.id)}
                  pane={pane}
                  onPane={setPane}
                />
              )}
            </div>
            {bank.length > 0 && (
              <section className="interlude-hero panel">
                <h3><Icon id="resource/gold-purse" size="sm" /> Dépôts en cours</h3>
                <BankList bank={bank} party={party} interlude={interlude} canDrive={ownsHero} />
              </section>
            )}
            {/* Jeux de taverne (NADJ 16) — délassement entre deux aventures ; affordance montrée
                seulement si l'option `tavern-games` est active. Ne consomme pas d'Activité. */}
            {rule('tavern-games') && <TavernGamesEntry />}
            <div className="interlude-close">
              <p className="interlude-warning" title={t('interlude.close.warning.title')}>
                <Icon id="resource/gold-purse" size="sm" /> {t('interlude.close.warning')}
              </p>
              {isGuest
                ? <p className="interlude-warning"><Icon id="time/night" size="sm" /> {t('interlude.close.guest')}</p>
                /* Bataille en attente : la clôture ENGAGE la bataille (interludeEnd → massBattleBegin, C2b) —
                   le bouton de clôture porte alors ce libellé, une SEULE porte de sortie (pas de 2e écran). */
                : massBattle?.phase === 'prep'
                  ? <button className="btn btn-primary" onClick={() => setPhase('closing')} title="Clore l'interlude et engager la bataille (les Activités de préparation restantes sont perdues)">
                      <Icon id="action/attack" size="sm" /> Engager la bataille
                    </button>
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
              <span className="interlude-synth-name">{h.label}</span>
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

/** Bandeau d'INFO bataille (non-cliquable, ADE II 8) : une bataille est imminente — les deux camps et
 *  leur Puissance. Les Activités de préparation (Discours, Planification, Repérage, Sabotage…) figurent DANS
 *  les volets par-héros, comme toute Activité (budget UNIQUE d'interlude, l.65). Pas d'écran à part. */
function BattleBanner({ mb }: { mb: MassBattleState }) {
  return (
    <section className="interlude-battle-banner panel">
      <h3><Icon id="action/attack" size="sm" /> Bataille imminente</h3>
      <p className="interlude-detail">
        <b>{mb.ally.label}</b> (Puissance {armyMight(mb.ally)}) contre <b>{mb.enemy.label}</b> (Puissance {armyMight(mb.enemy)}).
        Préparez-la depuis vos Activités <em>Entre deux aventures</em> : Discours, Planification, Repérage,
        Sabotage… (max 3, ADE II 8). « Engager la bataille » clôt l'interlude et lance les Rounds.
      </p>
    </section>
  );
}

/** Entrée « Jeux de taverne » (NADJ 16) : ouvre la modale de jeu (choix jeu + adversaire). */
function TavernGamesEntry() {
  const open = useGame((s) => s.openTavernGames);
  return (
    <section className="interlude-hero panel">
      <h3><Icon id="nav/dice" size="sm" /> Jeux de taverne</h3>
      <p className="interlude-detail">Un moment de détente : dés, boules, bras de fer… (Nuits agitées, ch.16).</p>
      <button className="btn small btn-primary" onClick={() => open()}>Proposer une partie</button>
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
  // Dés d'Événement encore à poser (#942 L7, phase 'tirage') : la pose se fait dans la fenêtre de
  // séquence (`CascadeModal`), jamais ici — la chronique ATTEND, elle n'affiche pas un dé qui
  // n'existe pas, et les Activités ne s'ouvrent pas avant le dernier dé.
  const enAttente = heroes.filter((h) => interlude.perHero[h.id].eventRoll == null);
  return (
    <>
      <p className="interlude-phase-hint">
        {t('interlude.events.hint')}
      </p>
      <div className="interlude-chronicle">
        {heroes.map((h) => {
          const st = interlude.perHero[h.id];
          if (st.eventRoll == null) {
            return (
              <ParchmentCard key={h.id} title="Le dé n’est pas encore tombé">
                <header className="interlude-chronicle-head">
                  <CharFrame c={h} variant="identity" size="sm" />
                  <span className="interlude-chronicle-who">{h.label}</span>
                </header>
                <p className="interlude-event">Son Événement de la période reste à tirer.</p>
              </ParchmentCard>
            );
          }
          const ev = interludeEventFor(st.eventRoll);
          const chips = fxChips(st, h);
          return (
            <ParchmentCard key={h.id} seal={{ label: 'd100', roll: st.eventRoll }} title={ev.label}>
              <header className="interlude-chronicle-head">
                <CharFrame c={h} variant="identity" size="sm" />
                <span className="interlude-chronicle-who">{h.label}</span>
              </header>
              <p className="interlude-event">{ev.desc}</p>
              {chips.length > 0 && (
                <div className="interlude-fx">
                  {chips.map((c) => <FxChip key={c.label} icon={c.icon} label={c.label} />)}
                </div>
              )}
            </ParchmentCard>
          );
        })}
      </div>
      <div className="interlude-phase-actions">
        {enAttente.length > 0 && (
          <p className="hint" id="interlude-draw-pending">
            {enAttente.length} dé{enAttente.length > 1 ? 's' : ''} d’Événement à poser ({enAttente.map((h) => h.label).join(', ')}) avant d’entreprendre la moindre Activité.
          </p>
        )}
        <button
          className="btn btn-primary"
          onClick={onDone}
          disabled={enAttente.length > 0}
          aria-describedby={enAttente.length > 0 ? 'interlude-draw-pending' : undefined}
        >
          {t('interlude.events.next')}
        </button>
      </div>
    </>
  );
}

/** Toutes les ops d'issue d'une Activité (binaire `onSuccess` + bandes `outcomes`) — pour les gates
 *  d'affordance DATA-DRIVEN (ex. « expie du Péché » ⇒ inutile à 0 Péché). */
const activityOps = (def: ActivityDef): GameOp[] =>
  [...(def.onSuccess ?? []), ...(def.outcomes ?? []).flatMap((b) => b.ops ?? [])];

/** ENJEU (Z3b, #1117 L3) posé sur la ligne de pré-jet d'un volet d'Activité : la RÉFÉRENCE de donnée
 *  (`ActivityDef.stake`, éditable au Codex) via la porte unique — jamais un texte écrit ici. Une
 *  Activité sans enjeu authoré (donc sans Test) traverse inchangée : pas de zone muette. */
const withStake = (p: PendingRoll, activityId: string): PendingRoll =>
  (hasActivityStake(activityId) ? { ...p, stake: activityStakeRef(activityId) } : p);

/** Résolveurs des Activités du catalogue qui ont un VOLET DÉDIÉ (UX riche : formule de Revenus,
 *  flux 2 étapes de l'Artisanat, sélecteur de Talent, sélecteur d'artefact) ou vivent ailleurs
 *  (`mecenat` = dans la banque). Exclus de la liste GÉNÉRIQUE du catalogue pour ne pas les doubler. */
const CORE_RESOLVERS = new Set<ActivityResolver>(['income', 'craftExtended', 'learnTalent', 'identify', 'mecenat', 'entrainement']);
const hasCoreResolver = (r?: ActivityResolver): boolean => !!r && CORE_RESOLVERS.has(r);

/** Icônes des Activités à volet dédié — les Activités du catalogue générique portent la leur
 *  en DONNÉE (`ActivityDef.icon`). */
const PANE_ICON = {
  revenus: 'resource/gold-purse',
  craft: 'item/misc',
  learn: 'nav/compendium',
  order: 'scenario/market',
  bank: 'resource/gold-purse',
  identify: 'nav/identify',
  entrainement: 'nav/compendium',
} as const;

function HeroCard({ hero, st, catalog, mecenat, favors, massBattle, canDrive, ownerName, pane, onPane }: {
  hero: Combatant; st: InterludeHeroState;
  /** Faveurs dues par CE héros (LDB 23, #509) — gate l'affordance « Acquitter une Faveur ». */
  favors: Favor[];
  /** Activités du catalogue data-driven proposables ICI (contexte + gate `where`) — inclut les Activités de
   *  PRÉPARATION de bataille (contexte 'bataille') quand une bataille est en attente de prépa. */
  catalog: ActivityDef[];
  /** Activité de Mécénat (variante d'Opération bancaire) si proposable ici. */
  mecenat?: ActivityDef;
  /** Bataille en attente de préparation (état de blocage/anti-répétition des Activités de prépa). */
  massBattle: MassBattleState | null;
  /** Possession coop (audit M7) : false = ce héros est mené par un autre joueur (lecture seule). */
  canDrive: boolean;
  ownerName?: string;
  /** Volet ouvert de CE héros (état remonté à l'écran — un seul volet ouvert à la fois). */
  pane: string | null;
  onPane: (pane: string | null) => void;
}) {
  // Le dé peut manquer (phase 'tirage', #942 L7) : la rangée d'événement dit alors l'attente.
  const ev = st.eventRoll != null ? interludeEventFor(st.eventRoll) : null;
  const status = heroStatus(hero);
  const none = st.left <= 0 || !canDrive;
  // Affordance PAR héros : chaque débit d'Activité (matériaux/tuteur/commande/dépôt) est ponctionné
  // sur la bourse PERSONNELLE du héros actif (#531), jamais sur un total de groupe.
  const purse = bourseOf(hero);
  // État (bloqué/déjà fait) des Activités de PRÉPARATION de bataille par id — source UNIQUE `battlePrepEntries`.
  const prepState = massBattle?.phase === 'prep'
    ? new Map(battlePrepEntries(massBattle).map((e) => [e.def.id, e]))
    : null;
  // Volet du catalogue GÉNÉRIQUE : les 4 activités socle (Revenus/Artisanat/Apprentissage/
  // Identification) ont leur volet dédié ci-dessous — CatalogPane ne sert que les AUTRES.
  const def = pane ? catalog.find((d) => d.id === pane && !hasCoreResolver(d.resolver)) : undefined;
  // Description VERBATIM d'une Activité socle (`activities.json`, id = clé de volet) — la donnée
  // EXISTE (revenus/craft/learn/identify), passée au gabarit `ActivityPane` de chaque volet dédié.
  const coreDesc = (id: string) => catalog.find((d) => d.id === id)?.desc;
  const detail =
    pane === 'revenus' ? <RevenusPane hero={hero} st={st} disabled={none} desc={coreDesc('revenus')} />
    : pane === 'craft' ? (hero.craft
        ? <CraftProgressPane hero={hero} craft={hero.craft} disabled={none} desc={coreDesc('craft')} />
        : <CraftPane hero={hero} disabled={none} money={purse} desc={coreDesc('craft')} />)
    : pane === 'learn' ? <LearnPane hero={hero} disabled={none} fails={st.learnFails} money={purse} desc={coreDesc('learn')} />
    : pane === 'order' ? <OrderPane hero={hero} disabled={none} money={purse} />
    : pane === 'bank' ? <BankPane hero={hero} disabled={none} bronzeBlocked={status.tier === 'bronze'} money={purse} mecenat={mecenat} />
    : pane === 'identify' ? <IdentifyPane hero={hero} disabled={none} desc={coreDesc('identify')} />
    : pane === 'entrainement' ? <EntrainementPane hero={hero} disabled={none} money={purse} desc={coreDesc('entrainement')} />
    : pane === 'favor-settle' && favors.length ? <FavorSettlePane hero={hero} disabled={none} favors={favors} />
    : def ? (def.contexts.includes('bataille')
        ? <BattlePrepPane hero={hero} def={def} disabled={none} entry={prepState?.get(def.id)} />
        : <CatalogPane hero={hero} def={def} disabled={none} />)
    : <p className="interlude-detail interlude-master-empty">Choisissez une Activité à gauche pour voir sa description et le jet à faire.</p>;
  return (
    <section className={`interlude-hero panel${pane ? ' active' : ''}`}>
      <h3>
        <CharFrame c={hero} variant="identity" size="sm" />
        <b className="interlude-name">{hero.label}</b>
        <span className="interlude-left">
          {!canDrive && <span className="interlude-owner"><Icon id="nav/seat-owner" size="sm" /> {ownerName ?? 'autre joueur'} · </span>}
          Statut {status.tier} {status.standing}
        </span>
      </h3>
      {ev
        ? <p className="interlude-event" title={ev.desc}><Icon id="nav/dice" size="sm" /> {st.eventRoll} — {ev.label}</p>
        : <p className="interlude-event"><Icon id="nav/dice" size="sm" /> Événement de la période : dé à poser.</p>}
      <MasterDetail
        className="interlude-master"
        listLabel={`Activités de ${hero.label}`}
        list={
          <ActivityList hero={hero} catalog={catalog} favors={favors} pane={pane} onPane={onPane} canDrive={canDrive} none={none} ownerName={ownerName} />
        }
        detail={detail}
      />
    </section>
  );
}

/** Slot GAUCHE du maître-détail (`MasterDetail`) : liste des Activités du héros — les 6 activités
 *  « socle » (LDB/ADE II, volets dédiés) + les Activités du catalogue SANS volet dédié (Mécénat
 *  exclu : variante du volet Banque). Filtre si la liste est longue (`SearchFilterField`). */
function ActivityList({ hero, catalog, favors, pane, onPane, canDrive, none, ownerName }: {
  hero: Combatant; catalog: ActivityDef[];
  /** Faveurs dues par ce héros (LDB 23, #509) — l'entrée « Acquitter une Faveur » n'apparaît que si non-vide. */
  favors: Favor[];
  pane: string | null; onPane: (pane: string | null) => void;
  canDrive: boolean; none: boolean; ownerName?: string;
}) {
  const item = (key: string, label: ReactNode, title: string, textLabel: string) => ({
    id: key,
    textLabel,
    node: (
      <button
        key={key}
        className={`btn small interlude-activity-btn${pane === key ? ' btn-primary' : ''}`}
        disabled={!canDrive || (none && pane !== key)}
        onClick={() => onPane(pane === key ? null : key)}
        title={canDrive ? title : `Mené par ${ownerName ?? 'un autre joueur'}`}
      >
        {label}
      </button>
    ),
  });
  const core = [
    item('revenus', <><Icon id={PANE_ICON.revenus} size="sm" /> Revenus</>, 'Une semaine de travail — Test Accessible (+20) de la compétence de carrière', 'Revenus'),
    item('craft', hero.craft
      ? <><Icon id={PANE_ICON.craft} size="sm" /> Artisanat — {findTrappingById(hero.craft.trappingId)?.label ?? hero.craft.trappingId} ({hero.craft.drDone}/{hero.craft.drTarget})</>
      : <><Icon id={PANE_ICON.craft} size="sm" /> Artisanat</>,
      hero.craft
        ? `Test étendu de Métier — ${hero.craft.drDone}/${hero.craft.drTarget} DR (${DIFFICULTY_LABELS[hero.craft.difficulty]})`
        : 'Fabriquer un équipement du catalogue (matériaux = ¼ du prix, Test étendu de Métier)', 'Artisanat'),
    item('learn', <><Icon id={PANE_ICON.learn} size="sm" /> Apprentissage</>, 'Apprendre un Talent hors carrière auprès d’un tuteur (Test Difficile −20 ; PX et argent perdus sur un échec)', 'Apprentissage'),
    item('order', <><Icon id={PANE_ICON.order} size="sm" /> Commande</>, 'Commander un objet Exotique : payé maintenant, livré après la prochaine aventure', 'Commande'),
    item('bank', <><Icon id={PANE_ICON.bank} size="sm" /> Banque</>, 'Déposer de l’argent pour qu’il survive à la clôture (Opérations bancaires)', 'Banque'),
    item('identify', <><Icon id={PANE_ICON.identify} size="sm" /> Identifier</>, 'Étudier un artefact magique une semaine — Test de Savoir (Magie) Intermédiaire (ADE II)', 'Identifier'),
    item('entrainement', <><Icon id={PANE_ICON.entrainement} size="sm" /> Entraînement</>, 'S’entraîner à une Compétence ou une Caractéristique hors carrière avec un tuteur (PX + 1d10 sc, sans jet)', 'Entraînement'),
    // « Acquitter une Faveur » (LDB 23 l.147/149, #509) — visible seulement si une Faveur est en cours.
    ...(favors.length ? [item('favor-settle', <><Icon id="ui/balance" size="sm" /> Acquitter une Faveur</>, 'Consacrer une Activité à l’acquittement d’une Faveur due', 'Acquitter une Faveur')] : []),
  ];
  // Activités du catalogue SANS volet dédié : les 4 activités « socle » (Revenus/Artisanat/
  // Apprentissage/Identification, volets riches ci-dessus) et Mécénat (dans la banque) sont
  // exclues pour ne pas les doubler — leur résolveur les identifie en DONNÉE.
  const catalogItems = catalog.filter((d) => !hasCoreResolver(d.resolver)).map((d) =>
    item(d.id, <><Icon id={d.icon} size="sm" /> {d.label}</>, d.desc ? `${mdToText(d.desc).slice(0, 160)}…` : d.label, d.label));
  const items = [...core, ...catalogItems];
  const { search, setSearch, filtered } = useFilteredList(items, (o) => o.textLabel);
  return (
    <>
      {items.length > 6 && (
        <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer les activités…" ariaLabel="Filtrer les activités" />
      )}
      {filtered.map((o) => o.node)}
    </>
  );
}

/** Revenus (LDB 08 l.105-120) : Test Accessible (+20) de la compétence de carrière — la formule
 *  ET le pré-jet sont lisibles AVANT d'entreprendre. */
function RevenusPane({ hero, st, disabled, desc }: { hero: Combatant; st: InterludeHeroState; disabled: boolean; desc?: string }) {
  const activity = useGame((s) => s.interludeActivity);
  const ev = st.eventRoll != null ? interludeEventFor(st.eventRoll) : null;
  // `fx` et le dé sont écrits ENSEMBLE au dénouement du tirage : pas de blocage sans événement tiré.
  const blockedCls = st.fx?.revenueBlockedClasses;
  const blocked = ev && !!blockedCls && (blockedCls.includes('*') || blockedCls.includes(heroClass(hero)))
    ? `Interdit par l'événement de la période (${ev.label}).`
    : null;
  const status = heroStatus(hero);
  // « Gagner de l'argent grâce au Statut » (LDB 08 l.105-120) — la formule, lisible AVANT le jet.
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
      desc={desc}
      blocked={blocked}
      prejet={withStake(testPending(<SkillChip skillId={skillId} />, testValue(hero, skillId), undefined, 'accessible'), 'revenus')}
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
function CraftProgressPane({ hero, craft, disabled, desc }: {
  hero: Combatant; craft: NonNullable<Combatant['craft']>; disabled: boolean; desc?: string;
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
      desc={desc}
      prejet={withStake(testPending(chip, testValue(hero, 'metier', undefined, metier?.spec), undefined, craft.difficulty), 'craft')}
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
  options: { id: string; label: string; categorie: string; priceBrass: number }[];
  value: string;
  onChange: (v: string) => void;
  detail?: (id: string) => string;
}) {
  const { search, setSearch, filtered } = useFilteredList(options, (o) => o.label);
  const families = useMemo(() => {
    const m = new Map<string, typeof filtered>();
    for (const o of filtered) {
      const f = trappingTypeLabel(o.categorie) || 'Équipement';
      if (!m.has(f)) m.set(f, []);
      m.get(f)!.push(o);
    }
    return [...m.entries()];
  }, [filtered]);
  return (
    <>
      <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer le catalogue…" ariaLabel="Filtrer le catalogue" />
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
function CraftPane({ hero, disabled, money, desc }: { hero: Combatant; disabled: boolean; money: Money; desc?: string }) {
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
      ? `Matériaux trop chers (${fmt(sel.materialsBrass)}) pour votre bourse.`
      : null;
  const blockedMsg = !metier
    ? <>Aucune Compétence Métier avec avances — impossible de fabriquer.</>
    : !affordable && sel
      ? <>Matériaux trop chers (<CoinsB brass={sel.materialsBrass} />) pour votre bourse.</>
      : null;
  const chip = metier
    ? <SkillChip skillId={metier.skillId} show={skillInstanceLabel(metier)} />
    : <b>Métier</b>;
  return (
    <ActivityPane
      icon={PANE_ICON.craft}
      title="Artisanat — engager un ouvrage"
      desc={desc}
      blocked={blockedMsg}
      prejet={sel && target
        ? withStake(testPending(chip, metier ? testValue(hero, 'metier', undefined, metier.spec) : 0, undefined, target.difficulty), 'craft')
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
function LearnPane({ hero, disabled, fails, money, desc }: { hero: Combatant; disabled: boolean; fails?: Record<string, number>; money: Money; desc?: string }) {
  const activity = useGame((s) => s.interludeActivity);
  const options = useMemo(() => learnableTalents(hero), [hero]);
  const [id, setId] = useState('');
  const { search, setSearch, filtered } = useFilteredList(options, (o) => o.label);
  const sel: LearnOption | undefined = options.find((o) => o.id === id);
  const xp = hero.xp ?? 0;
  const failCount = sel ? fails?.[sel.id] ?? 0 : 0;
  const xpOk = !sel || xp >= sel.xpCost;
  const purseOk = !sel || toBrass(money) >= sel.tutorMinBrass;
  // Caractéristique du Test = celle du Maxi du Talent, sinon Int (même dérivation que le flux,
  // `state/interludeFlow.ts`) — donc lue sur l'entrée EFFECTIVE : une variante réglée (AA) peut
  // remplacer le `max` (`{bonusOf}` → nombre), et l'affichage suivrait sinon la base.
  const talent = sel ? findTalentById(sel.id) : undefined;
  const tMax = effectiveEntry(talent)?.max;
  const ck: CharKey = tMax && typeof tMax !== 'number' ? tMax.bonusOf : 'intelligence';
  const prejet = sel
    ? withStake(
        optionPending(
          CHAR_LABELS[ck],
          effectiveChar(hero, ck),
          failCount ? [{ label: 'Acharnement', value: failCount * 10, famille: 'jet' as const, ref: RULE_REF['apprentissage-particulier'] }] : [],
          undefined,
          'difficile',
        ),
        'learn',
      )
    : undefined;
  return (
    <ActivityPane
      icon={PANE_ICON.learn}
      title="Apprentissage particulier"
      desc={desc}
      blocked={sel && !xpOk ? <>PX insuffisants : {xp}/{sel.xpCost}.</> : undefined}
      prejet={prejet}
      cost={sel ? <>{sel.xpCost} PX (il vous en reste {xp}) + tuteur <CoinsB brass={sel.tutorMinBrass} /> à <CoinsB brass={sel.tutorMaxBrass} /></> : undefined}
      note={sel
        ? <><EntityRef category="talents" id={sel.id} label={sel.label} /> — tuteur 2d10 pa / 100 PX ; PX et argent perdus même sur un échec.</>
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
      <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer les talents…" ariaLabel="Filtrer les talents" />
      <select className="interlude-select" value={id} onChange={(e) => setId(e.target.value)} size={Math.min(8, Math.max(3, filtered.length))}>
        {filtered.map((o) => (
          <option key={o.id} value={o.id} title={mdToText(effectiveEntry(findTalentById(o.id))?.desc ?? '')}>
            {o.label} — {o.xpCost} PX · tuteur {fmt(o.tutorMinBrass)} à {fmt(o.tutorMaxBrass)}
          </option>
        ))}
      </select>
    </ActivityPane>
  );
}

/** Entraînement (ch.23 l.130-136) : Compétence ou Caractéristique HORS carrière, avec un tuteur —
 *  PAS de jet (achat direct comme Passer commande/Banque). Coût = PX normal (hors carrière, déjà
 *  doublé) + tuteur 1D10 sc, doublé pour une Compétence Avancée (l.135). */
function EntrainementPane({ hero, disabled, money, desc }: { hero: Combatant; disabled: boolean; money: Money; desc?: string }) {
  const entrainement = useGame((s) => s.interludeEntrainement);
  const options = useMemo(() => entrainementOptions(hero), [hero]);
  const [key, setKey] = useState('');
  const keyOf = (o: EntrainementOption) => `${o.kind}|${o.id}|${o.spec ?? ''}`;
  const { search, setSearch, filtered } = useFilteredList(options, (o) => o.label);
  const sel = options.find((o) => keyOf(o) === key);
  const xp = hero.xp ?? 0;
  const xpOk = !sel || xp >= sel.xpCost;
  const purseOk = !sel || toBrass(money) >= sel.tutorMinBrass;
  return (
    <ActivityPane
      icon={PANE_ICON.entrainement}
      title="Entraînement"
      desc={desc}
      blocked={sel && !xpOk ? <>PX insuffisants : {xp}/{sel.xpCost}.</> : undefined}
      cost={sel ? <>{sel.xpCost} PX (il vous en reste {xp}) + tuteur <CoinsB brass={sel.tutorMinBrass} /> à <CoinsB brass={sel.tutorMaxBrass} /></> : undefined}
      note={sel
        ? <>{sel.kind === 'skill' ? <SkillChip skillId={sel.id} show={sel.label} /> : sel.label} hors carrière{sel.advanced ? ' (Compétence Avancée — tuteur doublé)' : ''} — 1d10 sc de tuteur{sel.advanced ? ' ×2' : ''}, sans jet.</>
        : <>Choisir une Compétence ou une Caractéristique hors carrière — tuteur 1d10 sc (×2 pour une Compétence Avancée), sans jet.</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !sel || !xpOk || !purseOk}
          title={!xpOk && sel ? `PX insuffisants (${sel.xpCost} requis)` : !purseOk ? 'La bourse ne couvre même pas le tuteur le moins cher' : 'S’entraîner avec un tuteur'}
          onClick={() => sel && entrainement(hero.id, sel.kind, sel.id, sel.spec)}
        >
          Entreprendre
        </button>
      }
    >
      <SearchFilterField className="interlude-search" value={search} onChange={setSearch} placeholder="Filtrer les Compétences/Caractéristiques…" ariaLabel="Filtrer les Compétences et Caractéristiques" />
      <select className="interlude-select" value={key} onChange={(e) => setKey(e.target.value)} size={Math.min(8, Math.max(3, filtered.length))}>
        {filtered.map((o) => (
          <option key={keyOf(o)} value={keyOf(o)}>
            {o.label}{o.advanced ? ' (Avancée)' : ''} — {o.xpCost} PX · tuteur {fmt(o.tutorMinBrass)} à {fmt(o.tutorMaxBrass)}
          </option>
        ))}
      </select>
    </ActivityPane>
  );
}

/** « Acquitter une Faveur » (LDB 23 l.147/149, #509) : consacre l'Activité à la progression d'une
 *  Faveur en cours — sans jet. Mineure : 1 Activité ; Majeure : 2+ CONSÉCUTIVES (RAW l.149 ; la
 *  rupture par CHOIX SEUL est maison — arbitrage utilisateur 2026-08-03 [entériné 2026-08-03],
 *  verbatim au ticket #1040, cf. `resetInterruptedFavorProgress`, state/favorFlow) ; Importante :
 *  jamais par Activité (l.151, mention verbatim affichée). */
function FavorSettlePane({ hero, disabled, favors }: { hero: Combatant; disabled: boolean; favors: Favor[] }) {
  const settle = useGame((s) => s.favorSettle);
  const [id, setId] = useState(favors[0]?.id ?? '');
  const sel = favors.find((f) => f.id === id) ?? favors[0];
  const required = sel ? favorRequiredActivities(sel.level) : null;
  const settleable = sel != null && required != null;
  return (
    <ActivityPane
      icon="ui/balance"
      title="Acquitter une Faveur"
      blocked={sel && required == null
        ? <>Une Faveur Importante « ne peut pas être acquittée par le biais d’Activités : elle est jouée comme une aventure complète ».</>
        : undefined}
      note={sel
        ? <>{FAVOR_LEVEL_LABELS[sel.level]} envers {sel.owedTo}{sel.desc ? ` — ${sel.desc}` : ''}{required != null ? ` (${sel.progress}/${required} Activité${required > 1 ? 's' : ''} consécutive${required > 1 ? 's' : ''})` : ''}</>
        : undefined}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || !settleable}
          title={settleable ? 'Consacrer cette Activité à l’acquittement de la Faveur' : undefined}
          onClick={() => sel && settleable && settle(hero.id, sel.id)}
        >
          Entreprendre
        </button>
      }
    >
      {favors.length > 1 && (
        <select className="interlude-select" value={id} onChange={(e) => setId(e.target.value)}>
          {favors.map((f) => (
            <option key={f.id} value={f.id}>{FAVOR_LEVEL_LABELS[f.level]} envers {f.owedTo}</option>
          ))}
        </select>
      )}
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
      blocked={sel && !affordable ? <>Votre bourse ne couvre pas ce prix.</> : undefined}
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

/** Opérations bancaires (ch.23 l.154-165) + Mécénat (ACE 12 l.45-49) : dépôt sans jet — le pied porte
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
      blocked={amountBrass > purseBrass ? <>Dépôt au-delà de votre bourse.</> : undefined}
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
          <NumberField variant="nu" label="Montant (pistoles d'argent)" min={1} value={amountPa} onChange={setAmountPa} />
        </label>
        <button className="btn small" onClick={() => quick(0.25)} title="Un quart de la bourse">¼</button>
        <button className="btn small" onClick={() => quick(0.5)} title="La moitié de la bourse">½</button>
        <button className="btn small" onClick={() => quick(1)} title="Toute la bourse">Tout</button>
      </div>
      <p className="interlude-detail">
        Votre bourse : <b><Coins money={money} /></b> · dépôt prévu : <b><CoinsB brass={amountBrass} /></b>
      </p>
    </ActivityPane>
  );
}

/** Identifier un artefact (ADE II 4) : choisir un objet NON identifié du sac — une semaine
 *  d'étude par tentative, Test de Savoir (Magie) Intermédiaire (+0). */
function IdentifyPane({ hero, disabled, desc }: { hero: Combatant; disabled: boolean; desc?: string }) {
  const activity = useGame((s) => s.interludeActivity);
  const items = (hero.items ?? []).filter((i) => i.identified === false);
  const [uid, setUid] = useState(items[0]?.uid ?? '');
  const savoir = hero.skills.find((k) => k.skillId === 'savoir' && (k.spec ?? '') === 'magie' && k.advances >= 1);
  const blocked = !items.length
    ? `Aucun objet non identifié dans le sac de ${hero.label}.`
    : !savoir
      ? `${hero.label} ne possède pas Savoir (Magie) — la longue étude d'un artefact est la voie des sorciers (ADE II).`
      : null;
  return (
    <ActivityPane
      icon={PANE_ICON.identify}
      title="Identifier un artefact"
      desc={desc}
      blocked={blocked}
      prejet={savoir
        ? withStake(testPending(<SkillChip skillId={savoir.skillId} show={skillInstanceLabel(savoir)} />, testValue(hero, savoir.skillId, undefined, savoir.spec), undefined, 'intermediaire'), 'identify')
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
              {i.label}{i.magicKnown ? ' ★' : ''}{i.suspectedQualities?.length ? ' (certitudes douteuses)' : ''}
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
    : def.resolver === 'identifyByResearch' && !artefacts.length ? `Aucun objet non identifié dans le sac de ${hero.label}.`
    : def.resolver === 'memorizeDiscount' && !spellOptions.length ? 'Aucun sort à mémoriser (Talent de lanceur et sort payant requis).'
    : ops.some((o) => o.op === 'sinMod' && o.amount < 0) && !(hero.sinPoints ?? 0) ? `${hero.label} n'a aucun Point de Péché à expier.`
    : ops.some((o) => o.op === 'removePsychTrait') && !(hero.psychTraits?.length) ? `${hero.label} n'a aucun Trait psychologique à soigner.`
    : null;
  const uid = targetUid || weapons[0]?.uid || artefacts[0]?.uid || '';
  const spell = spellId || spellOptions[0]?.spell.id || '';
  // Gate de Classe appliquée EN CATALOGUE — même dérivation que `openCatalogActivity`
  // (`src/state/interludeFlow.ts`) : source unique `classGatedDifficulty`.
  const diff = classGatedDifficulty(def, hero);
  // Pré-jet dérivé de la DONNÉE — même dérivation que le flux (`openCatalogActivity`) :
  // `masterWeapon` impose la compétence de l'arme visée ; sinon `bestActivitySkill` (SOURCE UNIQUE
  // partagée avec le flux — voies à Difficulté hétérogène comme Punchausen comprises).
  let prejet: PendingRoll | undefined;
  if (def.resolver === 'masterWeapon') {
    const item = weapons.find((i) => i.uid === uid);
    if (item) {
      const kind = item.kind === 'ranged' ? ('ranged' as const) : ('melee' as const);
      const base = combatValue(hero, kind, buildWeapon({ label: item.label, type: kind, damage: item.damage ?? { plusBF: true, flat: 0 }, subType: item.subType }));
      prejet = withStake(testPending(<SkillChip skillId={kind === 'melee' ? 'corps-a-corps' : 'projectiles'} />, base, undefined, diff), def.id);
    }
  } else if (def.skills?.length) {
    const best = bestActivitySkill(hero, def);
    const chips = def.skills.map((s, i) => (
      <Fragment key={`${s.id}-${s.spec ?? ''}`}>
        {i > 0 && ' ou '}
        <SkillChip skillId={s.id} show={s.spec ? `${refLabel('skills', { id: s.id })} (${s.spec})` : undefined} />
      </Fragment>
    ));
    if (best) {
      const bestDiff = classGatedDifficulty({ difficulty: best.difficulty, classGate: def.classGate }, hero);
      prejet = withStake(testPending(<>{chips}</>, best.value, undefined, bestDiff), def.id);
    }
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
          {weapons.map((i) => <option key={i.uid} value={i.uid}>{i.label}</option>)}
        </select>
      )}
      {artefacts.length > 0 && (
        <select className="interlude-select" value={uid} onChange={(e) => setTargetUid(e.target.value)} aria-label="Objet magique à tester">
          {artefacts.map((i) => <option key={i.uid} value={i.uid}>{i.label}{i.magicKnown ? ' ★' : ''}</option>)}
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

/** Volet d'une Activité de PRÉPARATION de bataille (ADE II 8), rendu DANS le menu d'interlude par le
 *  gabarit `ActivityPane` (comme toute Activité). « Entreprendre » DÉSIGNE ce héros comme meneur puis ouvre
 *  le jet par le canal UNIQUE de bataille (`massBattleActivity`) — l'issue porte sur l'ARMÉE,
 *  le budget d'Activité consommé est celui, UNIQUE, de l'interlude. Le pré-jet montre la compétence du héros ;
 *  la résolution RAW (Soutien/Test combiné/prérequis) reste dans `openMassBattleActivity`. */
function BattlePrepPane({ hero, def, disabled, entry }: {
  hero: Combatant; def: ActivityDef; disabled: boolean;
  /** État de l'Activité de prépa (bloquée par prérequis / déjà réalisée) — cf. `battlePrepEntries`. */
  entry?: { done: boolean; blocked: string | null };
}) {
  const battleActivity = useGame((s) => s.massBattleActivity);
  const setHero = useGame((s) => s.setMassBattleHero);
  const mb = useGame((s) => s.massBattle);
  // Difficulté : celle que l'entrée DÉCLARE — dérivée de l'écart d'armées quand elle porte
  // `difficultyFrom` (Discours, l.71), sinon fixe. MÊME source que l'ouverture du jet.
  const diff: Difficulty = mb ? battleActivityDifficulty(def, mb) : def.difficulty ?? 'intermediaire';
  // Pré-jet : la MEILLEURE des compétences déclarées pour CE héros (approx. du jet mené par lui).
  let prejet: PendingRoll | undefined;
  if (def.skills?.length) {
    const best = def.skills
      .map((ref) => ({ ref, v: testValue(hero, ref.id, undefined, ref.spec) }))
      .sort((a, b) => b.v - a.v)[0];
    const chips = def.skills.map((s, i) => (
      <Fragment key={`${s.id}-${s.spec ?? ''}`}>
        {i > 0 && (def.combined ? ' + ' : ' ou ')}
        <SkillChip skillId={s.id} show={s.spec ? `${refLabel('skills', { id: s.id })} (${s.spec})` : undefined} />
      </Fragment>
    ));
    prejet = withStake(testPending(<>{chips}</>, best.v, undefined, diff), def.id);
  }
  const done = entry?.done ?? false;
  const blocked = done ? 'Déjà réalisée cette bataille (Activité non répétable).' : entry?.blocked ?? null;
  const undertake = () => {
    setHero(def.id, [hero.id]); // désigne CE héros comme meneur de l'Activité de préparation
    battleActivity(def.id);
  };
  return (
    <ActivityPane
      icon={def.icon}
      title={def.label}
      desc={def.desc}
      blocked={blocked}
      prejet={prejet}
      note={<>1 Activité d'interlude — l'issue porte sur l'armée (ADE II 8).{def.assisted
        ? rule('interlude-assist-costs-activity')
          ? ' Les autres PJ peuvent prêter leur Soutien — chacun y dépense un créneau.'
          : ' Les autres PJ peuvent prêter leur Soutien, gratuitement.'
        : ''}</>}
      actions={
        <button
          className="btn small btn-primary"
          disabled={disabled || done || !!blocked}
          title={blocked ?? `Entreprendre ${def.label} (consomme une Activité d'interlude)`}
          onClick={undertake}
        >
          Entreprendre
        </button>
      }
    />
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
                    : `Retirer la planque (libre) : ${fmt(b.brass)} — découverte sur d100 ≤ ${b.rate > 0 ? b.rate : 10}`}
          >
            <Icon id={b.kind === 'invest' ? 'resource/gold-purse' : b.kind === 'mecenat' ? 'scenario/opera' : 'item/misc'} size="sm" />
            {' '}{owner?.label} : <CoinsB brass={b.brass} />
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
  const crafts = heroes.filter((h) => h.craft);
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
          <li><Icon id="item/misc" size="sm" /> Ouvrages inachevés conservés : {crafts.map((h) => `${h.label} (${findTrappingById(h.craft!.trappingId)?.label ?? h.craft!.trappingId})`).join(', ')}.</li>
        )}
        {demoted.map((h) => (
          <li key={h.id} className="interlude-blocked">
            <Icon id="ui/warning" size="sm" /> {h.label} n'a pas entrepris Revenus : retour au Niveau {(h.careerLevel ?? 1) - 1} de sa
            Carrière (« Avec le pouvoir »).
          </li>
        ))}
        {heroes.filter((h) => interlude.perHero[h.id]?.closeOps?.length).map((h) => {
          // Les ÉTATS réels de clôture passent par la primitive partagée (chips + popover Codex) ;
          // une op non-État éventuelle reste en clair.
          const ops = interlude.perHero[h.id]!.closeOps ?? [];
          const conds = ops.filter((o) => o.op === 'condition').map((o) => ({ id: o.id as ConditionId, value: typeof o.value === 'number' ? o.value : 1 }));
          const others = ops.filter((o) => o.op !== 'condition');
          return (
            <li key={`close-${h.id}`} className="interlude-blocked">
              {h.label} : <EffectChips conditions={conds} />{others.length > 0 && ` ${others.map((o) => o.op).join(', ')}`} au premier
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
