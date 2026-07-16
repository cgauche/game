import type { ReactNode } from 'react';
import type { Combatant, CharKey } from '../engine/types';
import type { Money } from '../engine/money';
import { dominantAxes } from '../engine/axes';
import { effectiveChar } from '../engine/characteristics';
import { itemLabel } from '../engine/items';
import { CORE_AXIS_IDS, findSpellById } from '../data';
import { Coins } from './Coins';
import { Icon } from './Icon';
import { CharacterPreview } from './CharacterPreview';
import { CharStatsGrid } from './CharStatsGrid';
import { MetalStatus } from './MetalStatus';
import { RoseAxes } from './RoseAxes';
import { SkillChip, TalentChip, EntityRef } from './EntityChip';
import { axisDataFor, heroRoseAxes, heroStatusLabel, heroSubtitle } from './CharCard';
import { t } from '../i18n';

/**
 * HeroSheet — corps de FICHE HÉROS, consécration de la duplication entre la fiche vivante du
 * créateur (`creator/CreatorSummary.tsx`) et le détail candidat de l'écran d'équipe
 * (`PartyScreen.tsx`, `CandidateDetailPane`) — constat utilisateur fondateur : « La fiche vivante ce
 * n'est pas une primitive ? » (2026-07-15). Rubriques (ordre du détail candidat, source la plus
 * riche) : bande d'en-tête (figurine+identité+statut+rose, `header` désactivable) → Caractéristiques
 * pleine largeur → dérivées 2 colonnes → Forces (axes qualifiés) → Compétences → Talents →
 * Sorts/Miracles → Possessions. Scroll interne natif (`overflow-y:auto`+`min-height:0`) VERROUILLÉ
 * ici — pas à chaque appelant.
 */
export function HeroSheet({
  hero,
  axisIds = CORE_AXIS_IDS,
  header = true,
  wealth,
  pending,
  statAnnotations,
  className,
}: {
  hero: Combatant;
  /** Axes ACTIFS de la campagne (rose + Forces) — `CORE_AXIS_IDS` par défaut. */
  axisIds?: string[];
  /** Bande d'en-tête figurine+identité+statut+rose — `false` quand l'appelant porte déjà sa propre
   *  alcôve (fiche vivante du créateur, alcôve grande à part). */
  header?: boolean;
  /** Bourse — chip dans la bande d'en-tête (ignoré si `header={false}`). */
  wealth?: Money;
  /** Roadmap PROSPECTIVE par rubrique (chips pointillées `RoadmapChip`, étapes ULTÉRIEURES du
   *  créateur) : Compétences/Possessions REMPLACENT le contenu vif quand elles sont fournies (masque
   *  un défaut moteur prématuré) ; Talents s'AJOUTE après les talents déjà réels (les talents
   *  d'espèce sont résolus dès l'espèce choisie, indépendamment de l'étape Compétences/Talents —
   *  cf. `CreatorSummary`, seul appelant à ce jour). */
  pending?: { skills?: ReactNode; talents?: ReactNode; possessions?: ReactNode };
  /** Annotation PAR CARACTÉRISTIQUE de la grille (`CharStatsGrid` `valClass`/`note`) — data-driven,
   *  aucun branchement créateur ICI : l'appelant (ex. `CreatorSummary`, augmentations/talents)
   *  calcule ses propres classes/notes et les fournit. */
  statAnnotations?: Partial<Record<CharKey, { valClass?: string; note?: string }>>;
  className?: string;
}) {
  const axes = dominantAxes(hero, axisDataFor(axisIds), 3);
  // TOUTES les Compétences avancées (correctif utilisateur 2026-07-15 : « faut virer Compétence clé
  // et mettre toutes les compétences ayant des points dedans ») — aucun écrémage top-N ici, le plafond
  // ne survit que sur les CARTES compactes (tuile candidat/carte de contrat, `CharCard.tsx`).
  const skills = [...hero.skills].filter((s) => s.advances > 0).sort((a, b) => b.advances - a.advances || a.skillId.localeCompare(b.skillId));
  const talents = hero.talents;
  const possessions = (hero.items ?? []).slice(0, 12);
  const spellRefs = (hero.spells ?? []).map((id) => ({ id, data: findSpellById(id) }));
  const hasSpell = spellRefs.some((s) => s.data && !s.data.isPrayer);
  const hasPrayer = spellRefs.some((s) => s.data?.isPrayer);
  const spellsTitle = hasSpell && hasPrayer ? t('present.spells.both') : hasPrayer ? t('present.spells.prayers') : t('present.spells.spells');

  return (
    <div className={['hero-sheet', className].filter(Boolean).join(' ')}>
      {header && (
        <div className="hero-sheet-head row-flex">
          <CharacterPreview hero={hero} size="md" ambiance="panel" className="hero-sheet-fig" />
          <div className="hero-sheet-id">
            <h3 className="detail-frame-name">{hero.name}</h3>
            <span className="detail-frame-sub">{heroSubtitle(hero)}</span>
            <div className="detail-frame-meta row-flex">
              <MetalStatus status={heroStatusLabel(hero)} size="chip" />
              {wealth != null && <span className="chip">{t('picker.hero.purse')} <Coins money={wealth} /></span>}
            </div>
          </div>
          <RoseAxes axes={heroRoseAxes(hero, axisIds)} size="medal" title={t('party.rose.title', { name: hero.name })} />
        </div>
      )}

      <CharStatsGrid
        size="sm"
        value={(k) => effectiveChar(hero, k)}
        valClass={(k) => statAnnotations?.[k]?.valClass}
        note={(k) => statAnnotations?.[k]?.note}
        className="hero-sheet-stats"
      />

      <div className="hero-sheet-derived">
        <span><Icon id="resource/wounds" size="sm" /> Blessures <b>{hero.wounds.max}</b></span>
        <span><Icon id="resource/movement" size="sm" /> Mouvement <b>{hero.movement}</b></span>
        <span><Icon id="resource/fate" size="sm" /> Destin <b>{hero.fate ?? '—'}</b> · Chance <b>{hero.fortune ?? '—'}</b></span>
        <span><Icon id="resource/resilience" size="sm" /> Résilience <b>{hero.resilience ?? '—'}</b> · Déterm. <b>{hero.resolve ?? '—'}</b></span>
      </div>

      <section className="hero-present-sec">
        <h4>{t('present.forces')}</h4>
        <div className="skill-tags">
          {axes.length ? axes.map((a) => <EntityRef key={a.id} category="axes" id={a.id} label={a.label} />) : <span className="hint">{t('party.roles.none')}</span>}
        </div>
      </section>

      <section className="hero-present-sec">
        <h4>{t('present.skills')}</h4>
        <div className="skill-tags">
          {pending?.skills ?? (skills.length ? skills.map((s) => <SkillChip key={`${s.skillId}|${s.spec ?? ''}`} skill={s} />) : <span className="hint">—</span>)}
        </div>
      </section>

      <section className="hero-present-sec">
        <h4>{t('present.talents')}</h4>
        <div className="skill-tags">
          {talents.length ? talents.map((tt) => <TalentChip key={`${tt.talentId}|${tt.spec ?? ''}`} talent={tt} />) : <span className="hint">—</span>}
          {pending?.talents}
        </div>
      </section>

      {spellRefs.length > 0 && (
        <section className="hero-present-sec">
          <h4>{spellsTitle}</h4>
          <div className="skill-tags">
            {spellRefs.map(({ id, data }) => <EntityRef key={id} category="spells" id={id} label={data?.label ?? id} />)}
          </div>
        </section>
      )}

      <section className="hero-present-sec">
        <h4>{t('present.possessions')}</h4>
        <div className="skill-tags">
          {pending?.possessions ?? (possessions.length
            ? possessions.map((it) => <EntityRef key={it.uid} category="trappings" id={it.trappingId} label={itemLabel(it)} />)
            : <span className="hint">—</span>)}
        </div>
      </section>
    </div>
  );
}

/** Chip prospective pointillée — rubrique renseignée à une étape ULTÉRIEURE du créateur (#417
 *  suite). Écrite ICI (vocabulaire de chip de la fiche) pour être composée aussi HORS `HeroSheet`
 *  (identité du créateur : `CreatorSummary` compose ce chip directement, hors mandat de la primitive
 *  qui n'entre qu'un `Combatant`). */
export function RoadmapChip({ children }: { children: ReactNode }) {
  return <span className="chip chip-roadmap">{children}</span>;
}
