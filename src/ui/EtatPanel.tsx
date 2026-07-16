/**
 * Onglet ÉTAT (§3.4 design v4, #492 Lot 1b) — « qu'est-ce qui m'arrive ? ». Silhouette organisatrice
 * en tête, puis les rubriques ancrées (`ETAT_ANCHOR_*`, `sheetAlarms.ts`) : une rubrique SANS contenu
 * N'EXISTE PAS (aucune chip morte) — État vide = silhouette calme + « Rien à signaler. » seule.
 * `Un GameOp = une rangée` (doctrine #295) ; toute prose est VERBATIM (`<Prose>`, règle 5).
 */
import type { ReactNode } from 'react';
import type { Combatant, HitLocation } from '../engine/types';
import type { Duration } from '../engine/duration';
import { locationLabel } from '../engine/combat';
import { effectiveArmourAt } from '../engine/characteristics';
import { maxEncumbrance, totalEncumbrance, giveTrappingLabel } from '../engine/items';
import { findCritEntrySuffered, critEntryCodexCategory, type CritTableKey } from '../engine/critical';
import type { CritEntry } from '../data/criticals';
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
import { Prose } from './Prose';
import { NotchGauge } from './NotchGauge';
import { Icon } from './Icon';
import type { IconIdInput } from './icons';
import { CharacterPreview } from './CharacterPreview';

/** Zone de la silhouette organisatrice — regroupe les 6 Localisations en 4 zones affichables (un id
 *  de `critEntriesSuffered` n'a pas de côté attaché, cf. `findCritEntrySuffered` : les tables Bras/
 *  Jambe couvrent LES DEUX côtés au RAW, LDB 18). */
const ZONES: { key: 'tete' | 'bras' | 'corps' | 'jambe'; label: string; locs: HitLocation[] }[] = [
  { key: 'tete', label: 'Tête', locs: ['tete'] },
  { key: 'bras', label: 'Bras', locs: ['brasG', 'brasD'] },
  { key: 'corps', label: 'Corps', locs: ['corps'] },
  { key: 'jambe', label: 'Jambes', locs: ['jambeG', 'jambeD'] },
];

/** Critique SUFFERT résolu (`findCritEntrySuffered`) + son décompte d'occurrences (id STABLE). */
export interface CritSuffered { id: string; count: number; entry: CritEntry; table: CritTableKey; kind: 'ldb' | 'aa' }

/** Silhouette organisatrice : le rig réel (`CharacterPreview`) + une zone par groupe de Localisation
 *  (PA + critiques subis rattachables + traumas actifs), tonalité `bad` si la zone porte un signal. */
function EtatSilhouette({ hero, criticalEntries, traumas }: {
  hero: Combatant;
  criticalEntries: CritSuffered[];
  traumas: NonNullable<Combatant['traumas']>;
}) {
  const calm = criticalEntries.length === 0 && traumas.every((t) => t.cosmetic);
  return (
    <div className="etat-body">
      <CharacterPreview hero={hero} size="lg" />
      {!calm && (
        <div className="etat-zones">
          {ZONES.map((z) => {
            const zoneCrits = criticalEntries.filter((c) => c.table === z.key);
            const zoneTraumas = traumas.filter((t) => !t.cosmetic && z.locs.includes(t.location));
            const bad = zoneCrits.length > 0 || zoneTraumas.length > 0;
            const pas = z.locs.map((l) => effectiveArmourAt(hero, l));
            const paText = pas.every((p) => p === pas[0]) ? `${pas[0]}` : pas.join(' · ');
            return (
              <div key={z.key} className="etat-zone" data-tone={bad ? 'bad' : 'ok'}>
                <b>{z.label}</b> <small>PA {paText}</small>
                {zoneCrits.map((c, i) => <div key={`c${i}`}>{c.entry.name}</div>)}
                {zoneTraumas.map((t, i) => <div key={`t${i}`}>{t.label}</div>)}
                {!bad && <small className="muted"> · Aucun critique</small>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
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

/** Panneau « Effets actifs » : buffs/débuffs de Sort, Traits accordés, contrecoups d'incantation —
 *  DERNIÈRE rubrique de l'onglet État (§3.4). */
function ActiveEffectsPanel({ hero }: { hero: Combatant }) {
  const fx = hero.activeEffects ?? [];
  const cp = hero.castPenalties ?? [];
  if (!fx.length && !cp.length) return null;
  const dur = (e: { duration?: Duration; roundsLeft?: number; untilTime?: number }) => {
    if (e.duration) return e.duration.scale === 'rounds' ? ` · ${e.duration.left} R` : e.duration.scale === 'clock' ? ' · durée' : '';
    return e.roundsLeft != null ? ` · ${e.roundsLeft} R` : e.untilTime != null ? ' · durée' : '';
  };
  return (
    <>
      <div className="mini-title">Effets actifs</div>
      <div className="sheet-effects">
        {fx.map((e, i) => (
          <div className="skill-line" key={`e${i}`}>
            <span className="sk-name">{e.label}</span>
            <span className="sk-val">{describeEffect(e)}{dur(e)}</span>
          </div>
        ))}
        {cp.map((p, i) => (
          <div className="skill-line" key={`c${i}`}>
            <span className="sk-name">{p.label}</span>
            <span className="sk-val warn-text">{p.blocked ? 'Incantation bloquée' : p.maxZeroDR ? 'Prière plafonnée à 0 DR' : `${p.mod} ${p.skill}`}{dur(p)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/** En-tête de rubrique (`mini-title` + compte, primitive existante — zéro classe neuve). */
function Rubric({ anchor, title, count, children }: { anchor: string; title: string; count: number; children: ReactNode }) {
  return (
    <div id={anchor}>
      <div className="mini-title">{title}<span className="count">{count}</span></div>
      {children}
    </div>
  );
}

export function EtatPanel({ hero }: { hero: Combatant }) {
  const critIds = hero.critEntriesSuffered ?? [];
  const critCounts = new Map<string, number>();
  for (const id of critIds) critCounts.set(id, (critCounts.get(id) ?? 0) + 1);
  const criticalEntries = [...critCounts.entries()]
    .map(([id, count]) => {
      const found = findCritEntrySuffered(id);
      return found ? { id, count, ...found } : null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

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

  return (
    <div className="sheet-etat">
      <EtatSilhouette hero={hero} criticalEntries={criticalEntries} traumas={traumas} />

      {!hasSignal && (
        <div className="etat-ras">
          <span className="ras-title">Rien à signaler.</span>
        </div>
      )}

      {criticalEntries.length > 0 && (
        <Rubric anchor={ETAT_ANCHOR_CRITIQUES} title="Blessures critiques" count={criticalEntries.length}>
          <div className="inv-rows">
            {criticalEntries.map((c) => (
              <div key={c.id}>
                <div className="inv-row">
                  <span className="ir-name">
                    <CodexRef category={critEntryCodexCategory(c.table, c.kind)} id={c.id} label={c.entry.name}>{c.entry.name}</CodexRef>
                    {c.count > 1 ? ` ×${c.count}` : ''}
                  </span>
                  <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                    {locationLabel(c.table === 'bras' ? 'brasG' : c.table === 'jambe' ? 'jambeG' : c.table, hero.bodyShape)} · d100 {c.entry.min}–{c.entry.max}
                  </span>
                </div>
                {(c.entry.ops?.length ?? 0) > 0 && <div className="skill-tags"><GameOpChips ops={c.entry.ops!} /></div>}
                <Prose md={c.entry.desc} />
              </div>
            ))}
          </div>
        </Rubric>
      )}

      {conditions.length > 0 && (
        <Rubric anchor="etat-etats" title="États" count={conditions.length}>
          <div className="skill-tags">
            {conditions.map((cond, i) => {
              const def = findConditionById(cond.name);
              return (
                <EntityRef key={i} category="etats" id={cond.name} label={def?.label ?? cond.name} badge={cond.value > 1 ? `×${cond.value}` : undefined} />
              );
            })}
          </div>
          {conditions.map((cond, i) => {
            const def = findConditionById(cond.name);
            if (!def?.passive?.length) return null;
            return <div className="skill-tags" key={`ops${i}`}><GameOpChips ops={def.passive} /></div>;
          })}
        </Rubric>
      )}

      {corruption > 0 && (
        <Rubric anchor={ETAT_ANCHOR_CORRUPTION} title="Corruption" count={corruption}>
          <NotchGauge
            value={corruption}
            max={Math.max(corruptionThreshold(hero), corruption)}
            tone="danger"
            icon={<Icon id="nav/mutation" size="sm" />}
            label="Corruption"
          />
          {hero.damned && <span className="chip tone-danger">DAMNÉ</span>}
        </Rubric>
      )}

      {traumas.length > 0 && (
        <Rubric anchor={ETAT_ANCHOR_TRAUMAS} title="Traumatismes (séquelles)" count={traumas.length}>
          <div className="inv-rows">
            {traumas.map((t, i) => (
              <div key={i}>
                <div className="inv-row">
                  <span className="ir-name">
                    <CodexRef category="traumas" id={t.traumaId} label={t.label}>{t.label}</CodexRef>
                    {t.location ? ` (${locationLabel(t.location, hero.bodyShape)})` : ''}
                    {t.count != null && t.count > 1 ? ` ×${t.count}` : ''}
                  </span>
                  <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                    {t.recoveryDays != null ? `convalescence ${t.recoveryDays} j` : t.needsSurgery ? 'Chirurgie requise' : 'permanent'}
                  </span>
                </div>
                {(t.ops?.length ?? 0) > 0 && <div className="skill-tags"><GameOpChips ops={t.ops!} /></div>}
                {t.desc && <Prose md={t.desc} />}
              </div>
            ))}
          </div>
        </Rubric>
      )}

      {diseases.length > 0 && (
        <Rubric anchor={ETAT_ANCHOR_MALADIES} title="Maladies" count={diseases.length}>
          <div className="inv-rows">
            {diseases.map((d, i) => (
              <div key={i}>
                <div className="inv-row">
                  <span className="ir-name">{diseaseLabel(d.name)}</span>
                  <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                    {d.phase === 'incubation' ? `incubation : ${formatRemaining(d.minutesLeft)}` : `${formatRemaining(d.minutesLeft)} restants`}
                  </span>
                </div>
                <div className="skill-tags">
                  {d.symptoms.map((s, si) => (
                    <EntityRef key={si} category="symptoms" id={s.symptomId} label={symptomLabel(s.symptomId)} show={s.spec ? `${symptomLabel(s.symptomId)} (${s.spec})` : symptomLabel(s.symptomId)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Rubric>
      )}

      {mutations.length > 0 && (
        <Rubric anchor={ETAT_ANCHOR_MUTATIONS} title="Mutations" count={mutations.length}>
          <div className="inv-rows">
            {mutations.map((m, i) => (
              <div key={i}>
                <div className="inv-row">
                  <span className="ir-name">
                    <CodexRef category="mutations" id={m.id} label={m.label}>{m.label}</CodexRef>
                  </span>
                  <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
                    mutation {m.kind === 'physique' ? 'physique' : 'mentale'}
                  </span>
                </div>
                {(m.passive?.length ?? 0) > 0 && <div className="skill-tags"><GameOpChips ops={m.passive!} /></div>}
                <Prose md={m.desc} />
                {m.note && <p className="muted">{m.note}</p>}
              </div>
            ))}
          </div>
        </Rubric>
      )}

      {activePsych.length > 0 && (
        <Rubric anchor={ETAT_ANCHOR_PSYCHOLOGIE} title="Psychologie" count={activePsych.length}>
          <div className="inv-rows">
            {activePsych.map((p, i) => {
              const def = findPsychologyById(p.type);
              return (
                <div key={i}>
                  <div className="inv-row">
                    {def?.icon && <Icon id={def.icon as IconIdInput} size="sm" />}
                    <span className="ir-name">
                      <CodexRef category="psychologies" id={p.type} label={def?.label ?? p.type}>{def?.label ?? p.type}</CodexRef>
                    </span>
                  </div>
                  {def?.desc && <Prose md={def.desc} />}
                </div>
              );
            })}
          </div>
        </Rubric>
      )}

      {overEnc && (
        <Rubric anchor={ETAT_ANCHOR_ENCOMBREMENT} title="Encombrement" count={totalEncumbrance(hero)}>
          <div className="inv-row">
            <span className="ir-name">Surchargé</span>
            <span className="ir-stats" style={{ marginLeft: 'auto', opacity: 0.85 }}>
              {totalEncumbrance(hero)}/{maxEncumbrance(hero)} — Mouvement/Agilité pénalisés (LDB 15)
            </span>
          </div>
        </Rubric>
      )}

      <ActiveEffectsPanel hero={hero} />
    </div>
  );
}
