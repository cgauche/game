/**
 * Onglet ÉTAT — REGISTRE COMPACT (arbitrage user 2026-07-17, verbatim : « Oui : registre compact +
 * Codex » — une ligne par affliction, détail/prose à UN clic au popover Codex ; la fiche dit MON
 * état, le Codex dit la règle). Bandes de section ancrées (`ETAT_ANCHOR_*`, `sheetAlarms.ts`) —
 * une bande SANS contenu N'EXISTE PAS. Chaque ligne = `PlaqueRow` (nom `CodexRef tooltipOnly` — le
 * détail vit dans le popover, pas au clic-navigation —, méta en `GameOpChips`, valeur = l'horloge/le
 * cumul) — AUCUNE prose inline dans le registre.
 *
 * La bande de zones EN TÊTE du registre (`ZoneBand`, pt.4) est MORTE (lot « corps-index », arbitrage
 * user 2026-07-17) — doublon d'index : le CORPS de la colonne (`FigTile.zoneBadges`, composé par
 * `CharacterSheet.tsx`) porte désormais ce résumé par Localisation. `zoneAfflictions`/`zoneAnchor`/
 * `ZONE_ORDER` restent exportés d'ICI (source unique du calcul) et alimentent ce badge ; l'ancre de
 * la PREMIÈRE rangée Critiques/Séquelles par Localisation (posée dans le registre, `zoneAnchorFor`)
 * reste la cible de clic du badge. Liserés de gravité (sang/ambre/violet, pt.5) posés en attribut
 * `data-tone` sur la bande de section (`Section`) — jamais une classe par ton.
 */
import type { ReactNode } from 'react';
import type { Combatant, HitLocation } from '../engine/types';
import type { Duration } from '../engine/duration';
import { locationLabel } from '../engine/combat';
import { bonus, effectiveChar } from '../engine/characteristics';
import { maxEncumbrance, totalEncumbrance, giveTrappingLabel } from '../engine/items';
import { findCritEntrySuffered, critEntryCodexCategory, type CritTableKey } from '../engine/critical';
import { corruptionThreshold } from '../engine/corruption';
import { formatRemaining } from '../engine/disease';
import { CHAR_LABELS } from '../engine/types';
import { formatTrait } from '../engine/traits/dispatch';
import { talentConcrete } from '../data';
import { findConditionById, diseaseLabel, findPsychologyById, symptomLabel } from '../data';
import { isPsychAfflictionActive, ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_CORRUPTION, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT } from './sheetAlarms';
import { CodexRef } from './compendium/CodexRef';
import { EntityRef } from './EntityChip';
import { GameOpChips } from './GameOpChips';
import { NotchGauge } from './NotchGauge';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { PlaqueRow } from './PlaqueRow';
import { Band } from './Band';

/** Icône de repli quand aucune icône du registre ne porte la famille (jamais d'emoji), à l'égal de
 *  `sheetAlarms.ts`. */
const FALLBACK_ICON: IconIdInput = 'ui/warning';

/** Tonalité de gravité d'une bande (pt.5, #492) : sang = critiques/états, ambre = séquelles/maladies,
 *  violet = corruption/mutations — posée en attribut, jamais en classe par ton. */
type GravityTone = 'sang' | 'ambre' | 'violet';

/** Bande de section ancrée : titre + compte en badge sobre (`Band`, primitive partagée). L'appelant
 *  filtre déjà les rubriques vides — une bande SANS contenu n'apparaît jamais dans l'arbre.
 *  `extra` : compteur de DESTIN additionnel (actives/BE, phys/ment) affiché À CÔTÉ du compte brut. */
function Section({ anchor, title, count, tone, extra, children }: { anchor: string; title: string; count?: number; tone?: GravityTone; extra?: ReactNode; children: ReactNode }) {
  return (
    <div id={anchor} data-tone={tone}>
      <Band title={title} right={(count != null || extra) ? <>{count != null && <b>{count}</b>}{extra}</> : undefined}>
        {children}
      </Band>
    </div>
  );
}

/** Ton d'un compteur de DESTIN par seuil (pt.4, #492) : `muted` loin du seuil, `warn` à seuil−1,
 *  `danger` au seuil ATTEINT ou FRANCHI — jamais une couleur littérale. */
function thresholdTone(value: number, limit: number): GravityCounterTone {
  return value >= limit ? 'danger' : value === limit - 1 ? 'warn' : 'muted';
}
type GravityCounterTone = 'muted' | 'warn' | 'danger';
const COUNTER_TONE_RANK: Record<GravityCounterTone, number> = { muted: 0, warn: 1, danger: 2 };
/** Pire ton parmi plusieurs seuils indépendants (Mutations : phys ET ment) — un seul compteur combiné. */
function worstTone(...tones: GravityCounterTone[]): GravityCounterTone {
  return tones.reduce((a, b) => (COUNTER_TONE_RANK[b] > COUNTER_TONE_RANK[a] ? b : a));
}
/** Rendu du compteur de DESTIN — plaque sobre, ton en attribut (jamais une classe par ton). */
function ThresholdBadge({ tone, children }: { tone: GravityCounterTone; children: ReactNode }) {
  return <b className="etat-threshold" data-tone={tone}>{children}</b>;
}

/** Localisation d'un critique suffered (les tables RAW ne distinguent pas le côté — repli G, comme
 *  la ligne de détail existante du registre). */
function critLocation(table: CritTableKey): HitLocation {
  return table === 'bras' ? 'brasG' : table === 'jambe' ? 'jambeG' : table;
}

/** Ordre canonique des 6 Localisations (`HitLocation`, `engine/types.ts`) — tête → bras → corps →
 *  jambes. Exporté : source unique de l'ordre, réutilisé par `CharacterSheet.tsx` (badges de la
 *  colonne). */
export const ZONE_ORDER: HitLocation[] = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'];

/** Ancre de la PREMIÈRE rangée Critiques/Séquelles d'une Localisation dans le registre — cible de
 *  clic du badge de zone de la colonne (`FigTile.zoneBadges`, `CharacterSheet.tsx`). */
export function zoneAnchor(loc: HitLocation): string {
  return `etat-zone-${loc}`;
}

/** Critiques subis, dédupliqués/comptés (source unique — alimente le registre ET `zoneAfflictions`). */
function criticalEntriesOf(hero: Combatant) {
  const critIds = hero.critEntriesSuffered ?? [];
  const critCounts = new Map<string, number>();
  for (const id of critIds) critCounts.set(id, (critCounts.get(id) ?? 0) + 1);
  return [...critCounts.entries()]
    .map(([id, count]) => {
      const found = findCritEntrySuffered(id);
      return found ? { id, count, ...found } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);
}

/** Localisations TOUCHÉES (pt.4, #492) — ≥1 critique ou séquelle, comptées par famille. Alimente le
 *  badge de zone de la colonne (`FigTile.zoneBadges`) : une zone intacte n'est jamais retournée. */
export function zoneAfflictions(hero: Combatant): { loc: HitLocation; crit: number; trauma: number }[] {
  const critByLoc = new Map<HitLocation, number>();
  for (const c of criticalEntriesOf(hero)) critByLoc.set(critLocation(c.table), (critByLoc.get(critLocation(c.table)) ?? 0) + c.count);
  const traumaByLoc = new Map<HitLocation, number>();
  for (const t of hero.traumas ?? []) traumaByLoc.set(t.location, (traumaByLoc.get(t.location) ?? 0) + (t.count ?? 1));
  return ZONE_ORDER.filter((l) => (critByLoc.get(l) ?? 0) > 0 || (traumaByLoc.get(l) ?? 0) > 0).map((loc) => ({
    loc,
    crit: critByLoc.get(loc) ?? 0,
    trauma: traumaByLoc.get(loc) ?? 0,
  }));
}

/** Description courte d'un effet actif (buff de carac, Trait/Talent accordé, enchantement…). */
function describeEffect(e: NonNullable<Combatant['activeEffects']>[number]): string {
  if (e.char) return `${e.bonus >= 0 ? '+' : ''}${e.bonus} ${CHAR_LABELS[e.char]}`;
  if (e.grantedTrait) return `Trait ${formatTrait(e.grantedTrait)}`;
  if (e.conjuredSet) return `Arme invoquée (${e.label})`;
  if (e.grantedTalent) return `Talent ${talentConcrete(e.grantedTalent)}`;
  if (e.apAll) return `+${e.apAll} PA (toutes Localisations)`;
  if (e.enchantRef) return 'Arme enchantée';
  if (e.weatherImmune) return 'Immunisé aux intempéries';
  if (e.suffocates) return 'Suffoque (−1 PB/Round)';
  if (e.noBreath) return 'Respiration superflue';
  if (e.ignoreStatePenalties) return 'Ignore les pénalités d’État';
  if (e.opsPerRound?.length) {
    const cond = e.opsPerRound.find((o) => o.op === 'condition');
    if (cond && cond.op === 'condition') return `${cond.name} chaque Round`;
    const give = e.opsPerRound.find((o) => o.op === 'giveTrapping');
    if (give && give.op === 'giveTrapping') return `${giveTrappingLabel(give)} chaque Round`;
    return 'Effet récurrent chaque Round';
  }
  if (e.grantedFortune) return `+${e.grantedFortune} Chance (le temps du Sort)`;
  if (e.grantedFate) return `+${e.grantedFate} Destin (le temps du Sort)`;
  return e.label;
}

/** Durée compacte d'un effet actif/contrecoup, pour la valeur de sa `PlaqueRow`. */
function effectDuration(e: { duration?: Duration; roundsLeft?: number; untilTime?: number }): string {
  if (e.duration) return e.duration.scale === 'rounds' ? ` · ${e.duration.left} R` : e.duration.scale === 'clock' ? ' · durée' : '';
  return e.roundsLeft != null ? ` · ${e.roundsLeft} R` : e.untilTime != null ? ' · durée' : '';
}

/** Rubrique « Effets en cours » : buffs/débuffs de Sort, Traits accordés, contrecoups d'incantation
 *  — DERNIÈRE bande du registre. */
function ActiveEffectsSection({ hero }: { hero: Combatant }) {
  const fx = hero.activeEffects ?? [];
  const cp = hero.castPenalties ?? [];
  if (!fx.length && !cp.length) return null;
  return (
    <Section title="Effets en cours" count={fx.length + cp.length} anchor="etat-effets">
      {fx.map((e, i) => (
        <PlaqueRow
          key={`e${i}`}
          prefix={<Icon id="mechanic/stat-mod" size="sm" />}
          name={e.label}
          value={`${describeEffect(e)}${effectDuration(e)}`}
        />
      ))}
      {cp.map((p, i) => (
        <PlaqueRow
          key={`c${i}`}
          prefix={<Icon id="ui/warning" size="sm" />}
          name={p.label}
          value={`${p.blocked ? 'Incantation bloquée' : p.maxZeroDR ? 'Prière plafonnée à 0 DR' : `${p.mod} ${p.skill}`}${effectDuration(p)}`}
        />
      ))}
    </Section>
  );
}

export function EtatPanel({ hero }: { hero: Combatant }) {
  const criticalEntries = criticalEntriesOf(hero);

  // Compteurs de DESTIN (pt.4, #492) : ACTIF (décompté au soin) — pas l'historique `critEntriesSuffered`
  // (`sheetAlarms.ts` porte déjà ce distinguo pour la bande d'alarmes). Mort si actives > BE quand
  // Inconscient + 0 PB (`inDeathCondition`, engine/conditions.ts:595-605, LDB 18 l.34).
  const activeCriticals = hero.criticalWounds ?? 0;
  const be = bonus(effectiveChar(hero, 'endurance'));
  // Damné si mutations physiques > BE OU mentales > BFM (`mutationLimitExceeded`,
  // engine/corruption.ts:139-142, LDB 19 l.87) — mêmes filtres par `kind` ici.
  const bfm = bonus(effectiveChar(hero, 'force-mentale'));
  const physMutations = (hero.mutations ?? []).filter((m) => m.kind === 'physique').length;
  const mentMutations = (hero.mutations ?? []).filter((m) => m.kind === 'mentale').length;

  const conditions = hero.conditions ?? [];
  const corruption = hero.corruption ?? 0;
  const diseases = hero.diseases ?? [];
  const mutations = hero.mutations ?? [];
  const traumas = hero.traumas ?? [];
  const activePsych = (hero.psychState ?? []).filter(isPsychAfflictionActive);
  const overEnc = totalEncumbrance(hero) > maxEncumbrance(hero);
  const hasEffects = (hero.activeEffects?.length ?? 0) > 0 || (hero.castPenalties?.length ?? 0) > 0;

  const hasSignal = criticalEntries.length > 0 || conditions.length > 0 || corruption > 0 || diseases.length > 0
    || mutations.length > 0 || traumas.some((t) => !t.cosmetic) || activePsych.length > 0 || overEnc || hasEffects;

  if (!hasSignal) {
    return (
      <div className="sheet-etat">
        <div className="etat-ras">
          <span className="ras-title">Rien à signaler.</span>
          <span className="ras-sub">Ni blessure, ni affliction — le corps et l'âme tiennent bon.</span>
        </div>
      </div>
    );
  }

  // Ancre la PREMIÈRE rangée Critiques/Séquelles de chaque Localisation (une seule fois, dans l'ordre
  // de rendu du registre) — cible de clic du badge de zone de la colonne (`FigTile.zoneBadges`, pt.4).
  // Pas de coût CSS : un `id`, pas de classe.
  const seenZoneAnchor = new Set<HitLocation>();
  const zoneAnchorFor = (loc: HitLocation): string | undefined => {
    if (seenZoneAnchor.has(loc)) return undefined;
    seenZoneAnchor.add(loc);
    return zoneAnchor(loc);
  };

  return (
    <div className="sheet-etat">
      {criticalEntries.length > 0 && (
        <Section
          anchor={ETAT_ANCHOR_CRITIQUES}
          title="Blessures critiques"
          count={criticalEntries.length}
          tone="sang"
          extra={<ThresholdBadge tone={thresholdTone(activeCriticals, be)}>actives {activeCriticals}/{be}</ThresholdBadge>}
        >
          {criticalEntries.map((c) => {
            const row = (
              <PlaqueRow
                key={c.id}
                prefix={<Icon id="medical/scalpel" size="sm" />}
                name={<CodexRef category={critEntryCodexCategory(c.table, c.kind)} id={c.id} label={c.entry.name} tooltipOnly>{c.entry.name}</CodexRef>}
                sub={locationLabel(critLocation(c.table), hero.bodyShape)}
                meta={(c.entry.ops?.length ?? 0) > 0 ? <GameOpChips ops={c.entry.ops!} /> : undefined}
                value={c.count > 1 ? `×${c.count}` : undefined}
              />
            );
            const anchorId = zoneAnchorFor(critLocation(c.table));
            return anchorId ? <div key={c.id} id={anchorId}>{row}</div> : row;
          })}
        </Section>
      )}

      {conditions.length > 0 && (
        <Section anchor="etat-etats" title="États actifs" count={conditions.length} tone="sang">
          {conditions.map((cond, i) => {
            const def = findConditionById(cond.name);
            return (
              <PlaqueRow
                key={i}
                prefix={<Icon id={(def?.icon as IconIdInput | undefined) ?? FALLBACK_ICON} size="sm" />}
                name={<CodexRef category="etats" id={cond.name} label={def?.label ?? cond.name} tooltipOnly>{def?.label ?? cond.name}</CodexRef>}
                meta={def?.passive?.length ? <GameOpChips ops={def.passive} /> : undefined}
                value={cond.value > 1 ? `×${cond.value}` : undefined}
              />
            );
          })}
        </Section>
      )}

      {traumas.length > 0 && (
        <Section anchor={ETAT_ANCHOR_TRAUMAS} title="Séquelles" count={traumas.length} tone="ambre">
          {traumas.map((t, i) => {
            const row = (
              <PlaqueRow
                key={i}
                prefix={<Icon id="medical/crutch" size="sm" />}
                name={<CodexRef category="traumas" id={t.traumaId} label={t.label} tooltipOnly>{t.label}</CodexRef>}
                sub={t.location ? locationLabel(t.location, hero.bodyShape) : undefined}
                meta={(t.ops?.length ?? 0) > 0 ? <GameOpChips ops={t.ops!} /> : undefined}
                value={`${t.recoveryDays != null ? `${t.recoveryDays} j` : t.needsSurgery ? 'Chirurgie requise' : 'Permanent'}${t.count != null && t.count > 1 ? ` · ×${t.count}` : ''}`}
              />
            );
            const anchorId = zoneAnchorFor(t.location);
            return anchorId ? <div key={i} id={anchorId}>{row}</div> : row;
          })}
        </Section>
      )}

      {diseases.length > 0 && (
        <Section anchor={ETAT_ANCHOR_MALADIES} title="Maladies" count={diseases.length} tone="ambre">
          {diseases.map((d, i) => (
            <PlaqueRow
              key={i}
              prefix={<Icon id="medical/infection" size="sm" />}
              name={<CodexRef category="maladies" id={d.name} label={diseaseLabel(d.name)} tooltipOnly>{diseaseLabel(d.name)}</CodexRef>}
              meta={d.symptoms.length > 0 ? (
                <>
                  {d.symptoms.map((s, si) => (
                    <EntityRef key={si} category="symptoms" id={s.symptomId} label={symptomLabel(s.symptomId)} show={s.spec ? `${symptomLabel(s.symptomId)} (${s.spec})` : symptomLabel(s.symptomId)} />
                  ))}
                </>
              ) : undefined}
              value={d.phase === 'incubation' ? `Incubation · ${formatRemaining(d.minutesLeft)}` : formatRemaining(d.minutesLeft)}
            />
          ))}
        </Section>
      )}

      {mutations.length > 0 && (
        <Section
          anchor={ETAT_ANCHOR_MUTATIONS}
          title="Mutations"
          count={mutations.length}
          tone="violet"
          extra={
            <ThresholdBadge tone={worstTone(thresholdTone(physMutations, be), thresholdTone(mentMutations, bfm))}>
              phys {physMutations}/{be} · ment {mentMutations}/{bfm}
            </ThresholdBadge>
          }
        >
          {mutations.map((m, i) => (
            <PlaqueRow
              key={i}
              prefix={<Icon id="nav/mutation" size="sm" />}
              name={<CodexRef category="mutations" id={m.id} label={m.label} tooltipOnly>{m.label}</CodexRef>}
              sub={m.kind === 'physique' ? 'Mutation physique' : 'Mutation mentale'}
              meta={(m.passive?.length ?? 0) > 0 ? <GameOpChips ops={m.passive!} /> : undefined}
            />
          ))}
        </Section>
      )}

      {activePsych.length > 0 && (
        <Section anchor={ETAT_ANCHOR_PSYCHOLOGIE} title="Psychologie" count={activePsych.length}>
          {activePsych.map((p, i) => {
            const def = findPsychologyById(p.type);
            return (
              <PlaqueRow
                key={i}
                prefix={<Icon id={(def?.icon as IconIdInput | undefined) ?? FALLBACK_ICON} size="sm" />}
                name={<CodexRef category="psychologies" id={p.type} label={def?.label ?? p.type} tooltipOnly>{def?.label ?? p.type}</CodexRef>}
                meta={def?.passive?.length ? <GameOpChips ops={def.passive} /> : undefined}
              />
            );
          })}
        </Section>
      )}

      {corruption > 0 && (
        <div id={ETAT_ANCHOR_CORRUPTION} data-tone="violet">
          <PlaqueRow
            prefix={<Icon id="nav/mutation" size="sm" />}
            name="Corruption"
            meta={<NotchGauge value={corruption} max={Math.max(corruptionThreshold(hero), corruption)} tone="danger" />}
            value={hero.damned ? 'DAMNÉ' : undefined}
          />
        </div>
      )}

      {overEnc && (
        <Section anchor={ETAT_ANCHOR_ENCOMBREMENT} title="Surcharge">
          <PlaqueRow
            prefix={<Icon id={FALLBACK_ICON} size="sm" />}
            name="Surchargé"
            value={`${totalEncumbrance(hero)}/${maxEncumbrance(hero)}`}
          />
        </Section>
      )}

      <ActiveEffectsSection hero={hero} />
    </div>
  );
}
