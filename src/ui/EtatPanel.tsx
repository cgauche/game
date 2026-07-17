/**
 * Onglet ÉTAT — REGISTRE COMPACT (arbitrage user 2026-07-17, verbatim : « Oui : registre compact +
 * Codex » — une ligne par affliction, détail/prose à UN clic au popover Codex ; la fiche dit MON
 * état, le Codex dit la règle). Bandes de section ancrées (`ETAT_ANCHOR_*`, `sheetAlarms.ts`) —
 * une bande SANS contenu N'EXISTE PAS. Chaque ligne = `PlaqueRow` (nom `CodexRef tooltipOnly` — le
 * détail vit dans le popover, pas au clic-navigation —, chips d'effet net en `fx` SOUS le nom via
 * `GameOpChips`, valeur = l'horloge/le cumul, rendue DISCRÈTE — `sheet.css`) — AUCUNE prose inline
 * dans le registre. Grammaire de carte (liseré de gravité `data-tone`, icône, sous-ligne petites
 * capitales) affinée au lot #492 « chevet » (planche `docs/plans/2026-07-17-planche-etat-chevet.html`
 * — carrière de styles, pas un étalon docile : les tokens/primitives existants restent l'autorité).
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
import { encumbrancePenalties } from '../engine/encumbrance';
import { findCritEntrySuffered, critEntryCodexCategory, type CritTableKey } from '../engine/critical';
import { corruptionThreshold } from '../engine/corruption';
import { formatRemaining } from '../engine/disease';
import { CHAR_LABELS, type ConditionInstance } from '../engine/types';
import { formatTrait } from '../engine/traits/dispatch';
import { talentConcrete } from '../data';
import { findConditionById, diseaseLabel, findPsychologyById, symptomLabel, mutationLabel } from '../data';
import { datasetArray } from '../data/overrides';
import { isPsychAfflictionActive, ETAT_ANCHOR_CRITIQUES, ETAT_ANCHOR_CORRUPTION, ETAT_ANCHOR_MALADIES, ETAT_ANCHOR_MUTATIONS, ETAT_ANCHOR_TRAUMAS, ETAT_ANCHOR_PSYCHOLOGIE, ETAT_ANCHOR_ENCOMBREMENT } from './sheetAlarms';
import { CodexRef } from './compendium/CodexRef';
import { EntityRef } from './EntityChip';
import { GameOpChips } from './GameOpChips';
import { NotchGauge, type GaugeTone } from './NotchGauge';
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
 *  `extra` : jauge ADDITIONNELLE à côté du compte (ex. progression de Corruption) — les compteurs de
 *  DESTIN (Critiques actives/Mutations vs BE/BFM) ne vivent plus ICI mais dans `DestinBand`, la
 *  synthèse en tête de registre (arbitrage user 2026-07-17 : « ces textes énormes en gras… »). */
function Section({ anchor, title, count, tone, extra, children }: { anchor: string; title: string; count?: number; tone?: GravityTone; extra?: ReactNode; children: ReactNode }) {
  return (
    <div id={anchor} data-tone={tone}>
      <Band title={title} right={(count != null || extra) ? <>{count != null && <b>{count}</b>}{extra}</> : undefined}>
        {children}
      </Band>
    </div>
  );
}

/** Ton d'un compteur de DESTIN par seuil (pt.4, #492) : `neutral` loin du seuil, `warn` à seuil−1,
 *  `danger` au seuil ATTEINT ou FRANCHI — vocabulaire `GaugeTone` de `NotchGauge` (pas de couleur
 *  littérale, pas de 4e famille de ton parallèle). */
function destinTone(value: number, limit: number): GaugeTone {
  return value >= limit ? 'danger' : value === limit - 1 ? 'warn' : 'neutral';
}

/** Bande de synthèse DESTIN en tête du registre (arbitrage user 2026-07-17, idée retenue de la
 *  maquette v3bis) : mots PLEINS — « Critiques actives », « Mutations physiques », « Mutations
 *  mentales » — jamais les micro-libellés « actives/phys/ment » plantés dans le slot droit de
 *  chaque bande de rubrique (verdict user : « ces textes énormes en gras, pourquoi ? »). Les bandes
 *  de rubrique gardent leur compte sobre (badge droit) SEUL — cette synthèse est la SEULE porteuse
 *  des jauges de crans BE/BFM. Aucune mention de seuil de mort (pas de réf livre à l'écran). */
function DestinBand({ activeCriticals, be, physMutations, mentMutations, bfm }: { activeCriticals: number; be: number; physMutations: number; mentMutations: number; bfm: number }) {
  return (
    <Band title="Destin">
      <div className="etat-destin-row">
        <NotchGauge label="Critiques actives" value={activeCriticals} max={be} notches={be} tone={destinTone(activeCriticals, be)} />
        <NotchGauge label="Mutations physiques" value={physMutations} max={be} notches={be} tone={destinTone(physMutations, be)} />
        <NotchGauge label="Mutations mentales" value={mentMutations} max={bfm} notches={bfm} tone={destinTone(mentMutations, bfm)} />
      </div>
    </Band>
  );
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

/** Libellé plein d'un compte de Rounds (vocabulaire du jeu, ex. `humanizeOp`/`opRows.ts` : « Round »
 *  capitalisé comme un terme RAW, accord réel singulier/pluriel) — jamais l'abréviation muette « R ». */
function roundsLabel(n: number): string {
  return `${n} Round${n > 1 ? 's' : ''}`;
}

/** Durée compacte d'un effet actif/contrecoup, pour la valeur de sa `PlaqueRow`. */
function effectDuration(e: { duration?: Duration; roundsLeft?: number; untilTime?: number }): string {
  if (e.duration) return e.duration.scale === 'rounds' ? ` · ${roundsLabel(e.duration.left)}` : e.duration.scale === 'clock' ? ' · durée' : '';
  return e.roundsLeft != null ? ` · ${roundsLabel(e.roundsLeft)}` : e.untilTime != null ? ' · durée' : '';
}

/** Valeur de la `PlaqueRow` d'un État actif : cumul de pions (`ConditionInstance.value`, ex. 10
 *  Hémorragique) + durée d'instance temporisée (`roundsLeft`/`untilTime` — État posé par un Sort,
 *  ex. Sonné « N Rounds ») — MÊME vocabulaire que `effectDuration` (` · N R` / ` · durée`), sans
 *  quoi ces données d'instance restent invisibles hors popover Codex (qui ne porte que la règle
 *  générique, pas l'état vécu du Personnage). `undefined` si l'instance est nue (1 pion, permanente). */
function conditionValue(cond: ConditionInstance): string | undefined {
  const parts: string[] = [];
  if (cond.value > 1) parts.push(`×${cond.value}`);
  if (cond.roundsLeft != null) parts.push(roundsLabel(cond.roundsLeft));
  else if (cond.untilTime != null) parts.push('durée');
  return parts.length ? parts.join(' · ') : undefined;
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
  const corruptionMax = Math.max(corruptionThreshold(hero), corruption);
  const diseases = hero.diseases ?? [];
  const mutations = hero.mutations ?? [];
  const traumas = hero.traumas ?? [];
  const activePsych = (hero.psychState ?? []).filter(isPsychAfflictionActive);
  const overEnc = totalEncumbrance(hero) > maxEncumbrance(hero);
  // Palier de Surcharge (0 sans signal ici, puisque `overEnc` filtre déjà) — l'id/label CODEX (#422)
  // vit dans `encumbranceTiers.json`, résolu par `tier` (le moteur n'expose que la valeur numérique).
  const encTier = overEnc ? datasetArray('encumbranceTiers').find((t) => t.tier === encumbrancePenalties(hero).tier) : undefined;
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
      <DestinBand activeCriticals={activeCriticals} be={be} physMutations={physMutations} mentMutations={mentMutations} bfm={bfm} />

      {criticalEntries.length > 0 && (
        <Section
          anchor={ETAT_ANCHOR_CRITIQUES}
          title="Blessures critiques"
          tone="sang"
          count={criticalEntries.length}
        >
          {criticalEntries.map((c) => {
            const row = (
              <PlaqueRow
                key={c.id}
                prefix={<Icon id="medical/scalpel" size="sm" />}
                name={<CodexRef category={critEntryCodexCategory(c.table, c.kind)} id={c.id} label={c.entry.name} tooltipOnly>{c.entry.name}</CodexRef>}
                sub={locationLabel(critLocation(c.table), hero.bodyShape)}
                fx={(c.entry.ops?.length ?? 0) > 0 ? <GameOpChips ops={c.entry.ops!} /> : undefined}
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
                fx={def?.passive?.length ? <GameOpChips ops={def.passive} /> : undefined}
                value={conditionValue(cond)}
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
                fx={(t.ops?.length ?? 0) > 0 ? <GameOpChips ops={t.ops!} /> : undefined}
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
              fx={d.symptoms.length > 0 ? (
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
        >
          {mutations.map((m, i) => {
            const label = mutationLabel(m.id);
            return (
              <PlaqueRow
                key={i}
                prefix={<Icon id="nav/mutation" size="sm" />}
                name={<CodexRef category="mutations" id={m.id} label={label} tooltipOnly>{label}</CodexRef>}
                sub={m.kind === 'physique' ? 'Mutation physique' : 'Mutation mentale'}
                fx={(m.passive?.length ?? 0) > 0 ? <GameOpChips ops={m.passive!} /> : undefined}
              />
            );
          })}
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
                fx={def?.passive?.length ? <GameOpChips ops={def.passive} /> : undefined}
              />
            );
          })}
        </Section>
      )}

      {corruption > 0 && (
        <Section
          anchor={ETAT_ANCHOR_CORRUPTION}
          title="Corruption"
          tone="violet"
          extra={<NotchGauge value={corruption} max={corruptionMax} notches={corruptionMax} tone="danger" />}
        >
          {/* Le chiffre vit dans la jauge de bande (`extra`) — pas de ligne redondante, sauf la
              mention DAMNÉ (info d'instance qui n'a pas d'autre siège). */}
          {hero.damned && (
            <PlaqueRow prefix={<Icon id="flag/anger" size="sm" />} name="Corruption" fx={<span className="chip tone-danger">DAMNÉ</span>} />
          )}
        </Section>
      )}

      {overEnc && (
        <Section anchor={ETAT_ANCHOR_ENCOMBREMENT} title="Surcharge">
          <PlaqueRow
            prefix={<Icon id={FALLBACK_ICON} size="sm" />}
            // Palier RÉEL (`encumbrancePenalties`, LDB 61) — le moteur applique déjà ces paliers
            // (Mouvement/Agilité, `engine/encumbrance.ts`), la ligne ne peut pas en montrer moins.
            name={<CodexRef category="encumbranceTiers" id={encTier?.id ?? ''} label={encTier?.label ?? 'Surchargé'} tooltipOnly>Surchargé</CodexRef>}
            value={`${encTier?.label ?? ''} · ${totalEncumbrance(hero)}/${maxEncumbrance(hero)}`}
          />
        </Section>
      )}

      <ActiveEffectsSection hero={hero} />
    </div>
  );
}
