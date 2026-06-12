/**
 * « Entre deux aventures » (LDB ch.22-23 — Jalon 5) : flux d'interlude.
 *
 * Séquence RAW (ch.22 l.12) : Événement d100 par héros → Activités (« un maximum d'une Activité
 * par semaine, et […] un maximum de trois Activités au total », ch.23 l.6) → « Argent à
 * gaspiller » (ch.23 l.14 : tout l'argent non sécurisé disparaît ; les Revenus sont remis
 * « seulement une fois que vous avez disposé de l'argent de votre dernière aventure », l.179).
 *
 * Arbitrages jeu-sans-MJ (spec 2026-06-11) : la bourse étant PARTY-LEVEL, les pertes d'argent
 * d'événements (`moneyPct`) s'appliquent UNE fois (le pire tirage du groupe) ; le « +1 Chance
 * max » est crédité directement ; la clôture passe par le flux de repos standard (récupération,
 * convalescence, horloge — weeks × 7 jours).
 */
import type { GameState } from './store';
import { battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import { interludeEventFor, type InterludeEventFx } from '../data/interludeEvents';
import { fromBrass, toBrass, formatMoney } from '../engine/money';
import { itemFromTrapping, recomputeLoadout } from '../engine/items';
import { restPartyOvernight } from './combatFlow';
import { craftTarget, craftSpecOf, metierOf, statusIncome, bankWithdrawOutcome, bankPayout, apprenticeshipTutorCost, type PriceTier, type Availability } from '../engine/activities';
import { testValue } from '../engine/skills';
import { effectiveChar } from '../engine/characteristics';
import { buyTalent as engineBuyTalent, talentCost } from '../engine/advancement';
import { applyTalentAcquisition, fortuneMax, resolveMax, heroMaxWounds } from '../engine/talentEffects';
import { findCareer, levelsForCareer, findTrapping, findTalent } from '../data';
import { CHAR_BY_LABEL, CHAR_LABELS, type CharKey, type Combatant, type Difficulty } from '../engine/types';
import type { PendingBase } from './rollFlow';

type Get = () => GameState;
type Set = (s: Partial<GameState>) => void;

export interface InterludeHeroState {
  /** Jet d100 sur le Tableau des Événements (LDB 22). */
  eventRoll: number;
  /** Effets mécaniques de l'événement à consommer par les Activités (Revenus/banque). */
  fx?: InterludeEventFx;
  /** Activités restantes (min(3, semaines) − pertes d'événement/devoir elfique). */
  left: number;
  /** A entrepris Revenus — maintient les Niveaux 3-4 (« Avec le pouvoir », ch.23 l.30). */
  didRevenus?: boolean;
  /** Gains de Revenus, crédités APRÈS le gaspillage (ch.23 l.179) — en sous de cuivre. */
  revenueBrass: number;
  /** Artisanat en cours — « Tout travail inachevé peut être conservé » (ch.23 l.92). */
  craft?: { trapping: string; tier: PriceTier; avail: Availability; atouts: string[]; defauts: string[]; drDone: number; drTarget: number; difficulty: Difficulty };
  /** « +10 pour chaque tentative ratée » d'Apprentissage particulier (ch.23 l.63), par talent. */
  learnFails?: Record<string, number>;
}

export interface InterludeState {
  weeks: number;
  phase: 'activities' | 'closing';
  perHero: Record<string, InterludeHeroState>;
}

/** Dépôt bancaire (Opérations bancaires, ch.23 l.154-165) — survit aux interludes et aventures. */
export interface BankDeposit {
  heroId: string;
  kind: 'invest' | 'stash';
  /** Montant déposé, en sous de cuivre. */
  brass: number;
  /** Indice d'intérêts (1-10) — taux % ET risque de faillite (invest seulement). */
  rate: number;
}

/** Ouvre l'interlude : événements tirés et appliqués, commandes livrées, écran dédié. */
export function startInterlude(get: Get, set: Set, weeks = 1): void {
  if (get().battle) {
    get().log("Impossible d'ouvrir un interlude en plein combat.");
    return;
  }
  if (get().interlude) return; // déjà ouvert
  const party = get().party.filter((h) => !h.dead);
  if (!party.length) return;
  const w = Math.max(1, Math.floor(weeks));
  const lines: string[] = [`— Entre deux aventures : ${w} semaine${w > 1 ? 's' : ''} —`];
  // Passer commande (ch.23 l.170) : « L'objet sera achevé après votre prochaine aventure » —
  // les commandes du cycle précédent sont livrées à l'ouverture de CET interlude.
  for (const o of get().pendingOrders ?? []) {
    const hero = party.find((h) => h.id === o.heroId);
    const it = hero ? itemFromTrapping(o.trapping) : null;
    if (hero && it) {
      hero.items = [...(hero.items ?? []), it];
      recomputeLoadout(hero);
      lines.push(`${hero.name} reçoit sa commande : ${o.trapping}.`);
    }
  }
  const baseLeft = Math.min(3, w); // « 1/semaine, max 3 » (ch.23 l.6)
  const perHero: Record<string, InterludeHeroState> = {};
  let worstMoneyPct = 0;
  let bank = get().bank ?? [];
  for (const h of party) {
    const roll = d100(battleRng());
    const ev = interludeEventFor(roll);
    lines.push(`${h.name} — Événement (🎲 ${roll}) : ${ev.label}. ${ev.text}`);
    let left = baseLeft;
    if (ev.fx?.loseActivity) left -= 1;
    // « les elfes ne perdent une Activité que si la durée est d'au moins trois semaines » (ch.23 l.50).
    if (/elfe/i.test(h.species ?? '') && w >= 3) {
      left -= 1;
      lines.push(`${h.name} consacre une Activité au contact des siens (devoir elfique).`);
    }
    if (ev.fx?.moneyPct) worstMoneyPct = Math.min(worstMoneyPct, ev.fx.moneyPct);
    if (ev.fx?.fortuneMaxDelta) {
      h.fortune = (h.fortune ?? 0) + ev.fx.fortuneMaxDelta;
      lines.push(`${h.name} : +${ev.fx.fortuneMaxDelta} Point de Chance (présage).`);
    }
    if (ev.fx?.stashRaided && bank.some((b) => b.heroId === h.id && b.kind === 'stash')) {
      bank = bank.filter((b) => !(b.heroId === h.id && b.kind === 'stash'));
      lines.push(`${h.name} : sa planque a été dévalisée — tout l'argent caché a disparu (Mise à sac).`);
    }
    perHero[h.id] = { eventRoll: roll, fx: ev.fx, left: Math.max(0, left), revenueBrass: 0 };
  }
  if (worstMoneyPct < 0) {
    const total = toBrass(get().money);
    const lost = Math.floor((total * -worstMoneyPct) / 100);
    set({ money: fromBrass(Math.max(0, total - lost)) });
    lines.push(`La bourse du groupe perd ${-worstMoneyPct} % (${formatMoney(fromBrass(lost))}) — pire événement appliqué une fois (arbitrage bourse commune).`);
  }
  set({ interlude: { weeks: w, phase: 'activities', perHero }, bank, pendingOrders: [], screen: 'interlude' });
  for (const l of lines) get().log(l);
  set({ party: [...get().party] });
}

// ── Activités (ch.23) — flux de jet par modale (fabrique rollFlow) ────────────────────────────

/** Jet d'Activité en attente (modale) : Revenus / lancer d'Artisanat (Test étendu). */
export interface PendingActivity extends PendingBase {
  heroId: string;
  kind: 'revenus' | 'craft' | 'learn';
  label: string;
  skillLabel: string;
  skillValue: number;
  difficulty: Difficulty;
  roll: number | null;
  target: number;
  sl: number;
  success: boolean;
  /** Artisanat : progression du Test étendu (avant ce jet) et cible. */
  drBefore?: number;
  drTarget?: number;
  /** Apprentissage particulier (ch.23 l.58-63) : talent visé + coûts (débités MÊME sur échec). */
  talent?: string;
  xpCost?: number;
  tutorBrass?: number;
}

/** Statut « Échelon Standing » d'un héros (CareerLevelData.status, ex. « Argent 2 »). */
export function heroStatus(h: Combatant): { tier: PriceTier; standing: number } {
  const levels = levelsForCareer(h.career ?? '');
  const lvl = levels[Math.max(0, (h.careerLevel ?? 1) - 1)];
  const m = (lvl?.status ?? 'Bronze 1').match(/^(Bronze|Argent|Or)\s+(\d+)/i);
  const tier = (m?.[1] ?? 'Bronze').toLowerCase() as PriceTier;
  return { tier, standing: Math.max(1, Number(m?.[2] ?? 1)) };
}

/** Classe du héros (CareerData.class — pour les événements visant une Classe). */
export function heroClass(h: Combatant): string {
  return findCareer(h.career ?? '')?.class ?? '';
}

/** Compétence de carrière « qui permet de Gagner de l'argent » (LDB 08 l.135 : celle en italique
 *  du premier Niveau — l'italique n'est pas dans les données : on prend la première compétence du
 *  Niveau 1 que le héros POSSÈDE, sinon la première listée. Approximation documentée). */
function incomeSkillOf(h: Combatant): string {
  const lvl1 = levelsForCareer(h.career ?? '')[0];
  const skills = lvl1?.skills ?? [];
  const owned = skills.find((s) => h.skills.some((k) => s.toLowerCase().startsWith(k.name.toLowerCase())));
  return owned ?? skills[0] ?? 'Athlétisme';
}

const heroState = (s: GameState, heroId: string) => s.interlude?.perHero[heroId];

/** Ouvre la modale Revenus (LDB 08 l.135 : Test Accessible (+20) de la compétence de carrière). */
export function openRevenus(get: Get, set: Set, heroId: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  const cls = heroClass(h);
  const blocked = st.fx?.revenueBlockedClasses;
  if (blocked && (blocked.includes('*') || blocked.includes(cls))) {
    get().log(`${h.name} ne peut pas entreprendre Revenus (événement : ${interludeEventFor(st.eventRoll).label}).`);
    return;
  }
  const skill = incomeSkillOf(h);
  set({
    pendingActivity: {
      heroId, kind: 'revenus', label: 'Revenus — une semaine de travail',
      skillLabel: skill, skillValue: testValue(h, skill), difficulty: 'accessible',
      roll: null, target: 0, sl: 0, success: false,
    },
  });
}

/** Engage un Artisanat (ch.23 l.66) : exige une Compétence Métier (≥1 avance) ; les matériaux
 *  coûtent ¼ du prix listé, payés AVANT (« devront être achetées avant le début de l'Activité »). */
export function craftStart(get: Get, set: Set, heroId: string, trappingLabel: string, atouts: string[], defauts: string[]): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h) return;
  if (st.craft) {
    get().log(`${h.name} a déjà un ouvrage en cours (${st.craft.trapping}).`);
    return;
  }
  const metier = metierOf(h);
  if (!metier) {
    get().log(`${h.name} ne possède aucune Compétence Métier — impossible de fabriquer.`);
    return;
  }
  const t = findTrapping(trappingLabel);
  if (!t) {
    get().log(`Équipement inconnu : « ${trappingLabel} ».`);
    return;
  }
  // Gamme/Disponibilité/matériaux : dérivation PARTAGÉE avec le catalogue UI (craftSpecOf).
  const { tier, avail, materialsBrass: materials } = craftSpecOf(t);
  if (toBrass(get().money) < materials) {
    get().log(`Matériaux trop chers (${formatMoney(fromBrass(materials))}) pour la bourse du groupe.`);
    return;
  }
  const target = craftTarget(tier, avail, atouts.length, defauts.length);
  set({ money: fromBrass(toBrass(get().money) - materials) });
  const itl = get().interlude!;
  itl.perHero[heroId] = {
    ...st,
    craft: { trapping: trappingLabel, tier, avail, atouts, defauts, drDone: 0, drTarget: target.dr, difficulty: target.difficulty },
  };
  set({ interlude: { ...itl } });
  get().log(`${h.name} achète les matériaux (${formatMoney(fromBrass(materials))}) et installe son ouvrage : ${trappingLabel} (${target.dr} DR à atteindre, ${metier.name}).`);
}

/** Ouvre la modale du LANCER d'Artisanat — « Chaque Activité […] vous permet d'effectuer un
 *  lancer pour votre Test étendu » (ch.23 l.92). */
export function openCraftRoll(get: Get, set: Set, heroId: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st?.craft || !h || st.left <= 0) return;
  const metier = h.skills.find((k) => /^métier/i.test(k.name)) ?? { name: 'Métier' };
  set({
    pendingActivity: {
      heroId, kind: 'craft', label: `Artisanat — ${st.craft.trapping}`,
      skillLabel: metier.name, skillValue: testValue(h, metier.name), difficulty: st.craft.difficulty,
      roll: null, target: 0, sl: 0, success: false,
      drBefore: st.craft.drDone, drTarget: st.craft.drTarget,
    },
  });
}

/** Apprentissage particulier (ch.23 l.58-63) : Talent HORS carrière — « le prix pour apprendre le
 *  Talent est de 2D10 pistoles d'argent par 100PX » + le coût PX du Talent ; « Tentez un Test
 *  Difficile (-20) en utilisant la Caractéristique […] la plus pertinente » (V1 : celle du Maxi du
 *  Talent, sinon Int) ; « gagnez un modificateur de +10 pour chaque tentative ratée ». PX et
 *  argent sont dépensés MÊME sur un échec (« dépensant en vain des PX et de l'argent »). */
export function openLearn(get: Get, set: Set, heroId: string, talentLabel: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  const t = findTalent(talentLabel);
  if (!t) {
    get().log(`Talent inconnu : « ${talentLabel} ».`);
    return;
  }
  const xpCost = talentCost(h.talents.find((k) => k.name === talentLabel)?.times ?? 0);
  if ((h.xp ?? 0) < xpCost) {
    get().log(`${h.name} : PX insuffisants (${xpCost} requis pour ${talentLabel}).`);
    return;
  }
  const tutorBrass = toBrass(apprenticeshipTutorCost(xpCost, battleRng()));
  if (toBrass(get().money) < tutorBrass) {
    get().log(`Le tuteur demande ${formatMoney(fromBrass(tutorBrass))} — la bourse ne suit pas.`);
    return;
  }
  const m = typeof t.max === 'string' ? t.max.match(/Bonus d[e'’]\s*(.+)/i) : null;
  const ck: CharKey = (m && CHAR_BY_LABEL[m[1].trim()]) || 'Int';
  const fails = st.learnFails?.[talentLabel] ?? 0;
  set({
    pendingActivity: {
      heroId, kind: 'learn', label: `Apprentissage particulier — ${talentLabel}`,
      skillLabel: `${CHAR_LABELS[ck]}${fails ? ` (+${fails * 10} d'acharnement)` : ''}`,
      skillValue: effectiveChar(h, ck) + 10 * fails, difficulty: 'difficile',
      roll: null, target: 0, sl: 0, success: false,
      talent: talentLabel, xpCost, tutorBrass,
    },
  });
}

/** Passer commande (ch.23 l.167-172) : objet de rareté Exotique payé MAINTENANT, « achevé après
 *  votre prochaine aventure » (livré à l'ouverture du prochain interlude). 1 objet par Activité. */
export function orderItem(get: Get, set: Set, heroId: string, trappingLabel: string): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  const t = findTrapping(trappingLabel);
  if (!t) {
    get().log(`Équipement inconnu : « ${trappingLabel} ».`);
    return;
  }
  if (t.availability !== 'Exotique' && t.availability !== 'ND') {
    get().log(`${t.label} (${t.availability ?? '?'}) s'achète chez un marchand — Passer commande sert aux objets Exotiques.`);
    return;
  }
  const price = toBrass({ gold: t.price.gold, silver: t.price.silver, brass: t.price.bronze });
  if (toBrass(get().money) < price) {
    get().log(`Commande trop chère (${formatMoney(fromBrass(price))}).`);
    return;
  }
  set({ money: fromBrass(toBrass(get().money) - price), pendingOrders: [...(get().pendingOrders ?? []), { heroId, trapping: t.label }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  get().log(`${h.name} passe commande : ${t.label} (${formatMoney(fromBrass(price))}) — livraison après la prochaine aventure.`);
}

/** Applique le jet d'Activité confirmé (consomme l'Activité). */
export function confirmActivity(get: Get, set: Set): void {
  const pa = get().pendingActivity;
  if (!pa || pa.roll == null) return;
  const itl = get().interlude;
  const st = itl?.perHero[pa.heroId];
  const h = get().party.find((x) => x.id === pa.heroId);
  set({ pendingActivity: null });
  if (!itl || !st || !h || st.left <= 0) return;
  const lines: string[] = [];
  if (pa.kind === 'revenus') {
    // LDB 08 l.135 : succès = somme pleine ; échec = moitié ; Échec Stupéfiant (−6) = rien.
    const outcome = pa.success ? 'success' : pa.sl <= -6 ? 'astoundingFail' : 'fail';
    const { tier, standing } = heroStatus(h);
    let brass = toBrass(statusIncome(tier, standing, battleRng(), outcome));
    // Événements : ±% sur les Revenus (Fausse monnaie −20, Profits +50 pour une Classe…).
    if (st.fx?.revenuePct && (!st.fx.revenueClasses || st.fx.revenueClasses.includes(heroClass(h)))) {
      brass = Math.max(0, Math.floor((brass * (100 + st.fx.revenuePct)) / 100));
      lines.push(`Événement (${interludeEventFor(st.eventRoll).label}) : Revenus ${st.fx.revenuePct > 0 ? '+' : ''}${st.fx.revenuePct} %.`);
    }
    itl.perHero[pa.heroId] = { ...st, left: st.left - 1, didRevenus: true, revenueBrass: st.revenueBrass + brass };
    lines.push(`${h.name} travaille une semaine : ${formatMoney(fromBrass(brass))} (disponibles à la prochaine aventure).`);
  } else if (pa.kind === 'learn' && pa.talent) {
    // RAW ch.23 l.59-63 : argent du tuteur et PX dépensés MÊME sur un échec (« en vain »).
    set({ money: fromBrass(Math.max(0, toBrass(get().money) - (pa.tutorBrass ?? 0))) });
    if (pa.success) {
      const fortuneBefore = fortuneMax(h);
      const resolveBefore = resolveMax(h);
      const r = engineBuyTalent(h, pa.talent); // débite les PX + acquiert le Talent
      if (r.ok) {
        applyTalentAcquisition(h, pa.talent);
        h.wounds.max = heroMaxWounds(h); // Dur à cuire & co
        h.wounds.current = Math.min(h.wounds.current, h.wounds.max);
        h.fortune = (h.fortune ?? 0) + (fortuneMax(h) - fortuneBefore); // Chanceux
        h.resolve = (h.resolve ?? 0) + (resolveMax(h) - resolveBefore); // Obstiné
        lines.push(`${h.name} apprend ${pa.talent} hors carrière (−${r.cost} PX + ${formatMoney(fromBrass(pa.tutorBrass ?? 0))} de tuteur — Apprentissage particulier).`);
      }
      itl.perHero[pa.heroId] = { ...st, left: st.left - 1 };
    } else {
      h.xp = Math.max(0, (h.xp ?? 0) - (pa.xpCost ?? 0)); // PX perdus en vain
      const learnFails = { ...(st.learnFails ?? {}) };
      learnFails[pa.talent] = (learnFails[pa.talent] ?? 0) + 1;
      itl.perHero[pa.heroId] = { ...st, left: st.left - 1, learnFails };
      lines.push(`${h.name} échoue à apprendre ${pa.talent} — PX et argent dépensés en vain ; +10 à la prochaine tentative.`);
    }
  } else if (pa.kind === 'craft' && st.craft) {
    const drDone = Math.max(0, (pa.drBefore ?? 0) + pa.sl); // Test étendu : cumul du DR (LDB 12 l.199-211)
    if (drDone >= st.craft.drTarget) {
      const it = itemFromTrapping(st.craft.trapping);
      if (it) {
        it.qualities = [...(it.qualities ?? []), ...st.craft.atouts, ...st.craft.defauts];
        h.items = [...(h.items ?? []), it];
        recomputeLoadout(h);
      }
      lines.push(`${h.name} achève son ouvrage : ${st.craft.trapping}${st.craft.atouts.length ? ` (${st.craft.atouts.join(', ')})` : ''}${st.craft.defauts.length ? ` [${st.craft.defauts.join(', ')}]` : ''} !`);
      itl.perHero[pa.heroId] = { ...st, left: st.left - 1, craft: undefined };
    } else {
      lines.push(`${h.name} avance son ouvrage : ${drDone}/${st.craft.drTarget} DR (${st.craft.trapping}).`);
      itl.perHero[pa.heroId] = { ...st, left: st.left - 1, craft: { ...st.craft, drDone } };
    }
  }
  set({ interlude: { ...itl }, party: [...get().party] });
  for (const l of lines) get().log(l);
}

/** Opérations bancaires (ch.23 l.154-165) — dépôt (1 Activité). Invest : Statut Or/Argent. */
export function bankDeposit(get: Get, set: Set, heroId: string, kind: 'invest' | 'stash', amountBrass: number, rate?: number): void {
  const st = heroState(get(), heroId);
  const h = get().party.find((x) => x.id === heroId);
  if (!st || !h || st.left <= 0) return;
  if (kind === 'invest' && heroStatus(h).tier === 'bronze') {
    get().log(`${h.name} : « Vous devez être des échelons Or et Argent pour épargner dans une banque ».`);
    return;
  }
  const amount = Math.max(1, Math.floor(amountBrass));
  if (toBrass(get().money) < amount) {
    get().log('La bourse du groupe ne couvre pas ce dépôt.');
    return;
  }
  let deposited = amount;
  const lines: string[] = [];
  // Fausse monnaie (LDB 22) : « perdront 20 % de l'argent placé ».
  if (st.fx?.bankPct) {
    deposited = Math.max(0, Math.floor((deposited * (100 + st.fx.bankPct)) / 100));
    lines.push(`Événement : ${st.fx.bankPct} % sur l'argent placé (${interludeEventFor(st.eventRoll).label}).`);
  }
  const r = kind === 'invest' ? Math.max(1, Math.min(10, rate ?? d100(battleRng()) % 10 + 1)) : 0;
  set({ money: fromBrass(toBrass(get().money) - amount), bank: [...(get().bank ?? []), { heroId, kind, brass: deposited, rate: r }] });
  const itl = get().interlude!;
  itl.perHero[heroId] = { ...st, left: st.left - 1 };
  set({ interlude: { ...itl } });
  lines.push(kind === 'invest'
    ? `${h.name} investit ${formatMoney(fromBrass(deposited))} (Indice d'intérêts ${r} — ${r} % de gains, faillite sur 🎲 ≤ ${r}).`
    : `${h.name} planque ${formatMoney(fromBrass(deposited))} (retrait libre — découverte sur 🎲 ≤ 10).`);
  // Émeutes (LDB 22) : « les dépôts des banques réputées doivent vérifier immédiatement la faillite ».
  if (kind === 'invest' && st.fx?.bankCrashCheck) {
    lines.push(...bankWithdrawInner(get, set, get().bank.length - 1, true));
  }
  for (const l of lines) get().log(l);
}

/** Retrait (invest : coûte 1 Activité, « Retirer des fonds nécessite une autre Activité » l.157 ;
 *  planque : libre, l.159). Le d100 est journalisé (résolution directe — pas un Test de compétence). */
export function bankWithdraw(get: Get, set: Set, index: number): void {
  const dep = (get().bank ?? [])[index];
  if (!dep) return;
  if (dep.kind === 'invest') {
    const st = heroState(get(), dep.heroId);
    if (!st || st.left <= 0) {
      get().log('Retirer un investissement exige une Activité.');
      return;
    }
    const itl = get().interlude!;
    itl.perHero[dep.heroId] = { ...st, left: st.left - 1 };
    set({ interlude: { ...itl } });
  }
  for (const l of bankWithdrawInner(get, set, index, false)) get().log(l);
}

function bankWithdrawInner(get: Get, set: Set, index: number, crashCheckOnly: boolean): string[] {
  const dep = (get().bank ?? [])[index];
  if (!dep) return [];
  const h = get().party.find((x) => x.id === dep.heroId);
  const roll = d100(battleRng());
  const outcome = bankWithdrawOutcome(dep.kind, dep.rate, roll);
  const rest = (get().bank ?? []).filter((_, i) => i !== index);
  if (outcome === 'lost') {
    set({ bank: rest });
    return [`${h?.name ?? '?'} — 🎲 ${roll} ≤ ${dep.kind === 'invest' ? dep.rate : 10} : ${dep.kind === 'invest' ? 'la banque a fait faillite' : 'la planque a été découverte'} — ${formatMoney(fromBrass(dep.brass))} perdus !`];
  }
  if (crashCheckOnly) return [`Vérification de faillite (émeutes) — 🎲 ${roll} > ${dep.rate} : la banque tient bon.`];
  const payout = bankPayout(dep.kind, dep.brass, dep.rate);
  set({ bank: rest, money: fromBrass(toBrass(get().money) + payout) });
  return [`${h?.name ?? '?'} récupère ${formatMoney(fromBrass(payout))} (🎲 ${roll}${dep.kind === 'invest' ? ` > ${dep.rate}, intérêts ${dep.rate} %` : ''}).`];
}

/** Clôture : « Avec le pouvoir » (Niveaux 3-4 sans Revenus → −1 Niveau, ch.23 l.30), Argent à
 *  gaspiller (l.14), crédit des Revenus (l.179), puis le temps passe (repos standard). */
export function interludeEnd(get: Get, set: Set): void {
  const itl = get().interlude;
  if (!itl) return;
  const lines: string[] = [];
  for (const h of get().party) {
    const st = itl.perHero[h.id];
    if (!st) continue;
    if ((h.careerLevel ?? 1) >= 3 && !st.didRevenus) {
      h.careerLevel = (h.careerLevel ?? 1) - 1;
      lines.push(`${h.name} a négligé ses responsabilités (pas de Revenus) : retour au Niveau ${h.careerLevel} de sa Carrière (« Avec le pouvoir »).`);
    }
  }
  const wasted = toBrass(get().money);
  if (wasted > 0) {
    lines.push(`L'argent restant (${formatMoney(get().money)}) est dépensé, bu, parié ou donné — en totalité (Argent à gaspiller).`);
  }
  let revenue = 0;
  for (const h of get().party) revenue += itl.perHero[h.id]?.revenueBrass ?? 0;
  set({ money: fromBrass(revenue) });
  if (revenue > 0) lines.push(`Les Revenus de la période sont disponibles : ${formatMoney(fromBrass(revenue))}.`);
  set({ interlude: null, screen: 'campaign', party: [...get().party] });
  for (const l of lines) get().log(l);
  // Le temps de l'interlude s'écoule (récupération, convalescence, horloge — flux de repos
  // standard). `fedDaily` : la vie en ville (gîte ET couvert) est couverte par l'Argent à
  // gaspiller — la Faim RAW ne s'applique pas à la période (LDB 23, « le coût de la vie »).
  restPartyOvernight(get, set, itl.weeks * 7, { fedDaily: true });
}
