/**
 * Éditeurs STRUCTURÉS du Codex (lot E2) — sortent du repli `json` brut les champs « objet » /
 * « tableau d'objets » des datasets éditables, sur le MÊME patron que les éditeurs déjà en place
 * (filtrer le champ inféré + rendre un composant dédié au-dessus du formulaire). Tous réutilisent :
 *  - `RefField` (lot E1) pour les parties RÉFÉRENCE (compétence/talent/possession par id, +spec/+count) ;
 *  - le patron de LIGNES `RefField`/`GameOpEditor` (rangée + ✕ + « +Ajouter ») — pas de re-roll maison.
 * On édite les VRAIS objets de `src/data/*.json` (rien de transformé) → la donnée stockée reste celle
 * que le moteur lit (DiseaseSymptom / CombatFeature / AdvancementRef / TrappingRef).
 */
import { RefField } from './RefField';
import { DIFFICULTY_LABELS, type Difficulty } from '../../engine/types';
import type { DiseaseSymptom, DiseaseSymptomKind } from '../../engine/disease';
import type { CombatFeature, CastingKind } from '../../engine/combatFeatures/types';
import type { AdvancementRef, TrappingRef, Ref, CountSpec } from '../../data';

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS) as Difficulty[];

/* ─────────────────────────────────────────────────────────────────────────────
 * 1) maladies.symptoms — DiseaseSymptom[] = { kind, severity?, difficulty? }
 * ──────────────────────────────────────────────────────────────────────────── */

/** Valeurs de `DiseaseSymptomKind` (DÉRIVÉES de la donnée — un nouveau symptôme dans `maladies.json`
 *  apparaît tout seul ; la liste figée du type sert juste de repli pour une entrée vierge). */
const SYMPTOM_KINDS: DiseaseSymptomKind[] = [
  'malaise', 'blesse', 'fievre', 'persistant', 'toxine',
  'bubons', 'convulsions', 'demangeaisons', 'gangrene', 'intoxication', 'nausee', 'touxEternuements',
];

export function SymptomsField({ value, onChange }: { value: DiseaseSymptom[] | undefined; onChange: (v: DiseaseSymptom[]) => void }) {
  const list = value ?? [];
  const set = (i: number, patch: Partial<DiseaseSymptom>) => onChange(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="ed-field">
      <span>symptômes (LDB 20 — chacun = un type + sévérité/difficulté éventuelles)</span>
      {list.map((s, i) => (
        <div className="de-reflrow" key={i}>
          <select value={s.kind} onChange={(e) => set(i, { kind: e.target.value as DiseaseSymptomKind })}>
            {SYMPTOM_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={s.severity ?? ''} onChange={(e) => set(i, { severity: (e.target.value || undefined) as DiseaseSymptom['severity'] })}>
            <option value="">— sévérité —</option>
            <option value="moderee">Modérée</option>
            <option value="grave">Grave</option>
          </select>
          <select value={s.difficulty ?? ''} onChange={(e) => set(i, { difficulty: (e.target.value || undefined) as Difficulty | undefined })}>
            <option value="">— difficulté —</option>
            {DIFFICULTIES.map((d) => <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>)}
          </select>
          <button className="btn small danger" title="Retirer le symptôme" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { kind: 'malaise' }])}>+ Symptôme</button>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 2) talents.combat — CombatFeature partiel : ~40 drapeaux booléens + champs spéciaux
 * ──────────────────────────────────────────────────────────────────────────── */

/** Clés NON-booléennes de `CombatFeature` (rendues par des contrôles dédiés) — le RESTE est traité
 *  génériquement comme un drapeau booléen. Source unique pour ne PAS les compter comme des cases. */
const COMBAT_NON_BOOL = new Set<keyof CombatFeature>(['offHandPenalty', 'attackModes', 'castingKind']);

/** Drapeaux booléens de `CombatFeature` (LDB 10) — DÉRIVÉS de la donnée existante (union des clés
 *  présentes dans `talents.json`, moins les clés spéciales) → un nouveau drapeau câblé dans la donnée
 *  s'édite tout seul, aucun libellé codé à la main. Le LABEL affiché est la clé (le type est la doc). */
function combatBoolKeys(all: (Partial<CombatFeature> | undefined)[]): (keyof CombatFeature)[] {
  const keys = new Set<keyof CombatFeature>();
  for (const c of all) if (c) for (const k of Object.keys(c) as (keyof CombatFeature)[]) if (!COMBAT_NON_BOOL.has(k)) keys.add(k);
  return [...keys].sort((a, b) => a.localeCompare(b));
}

const CASTING_KINDS: CastingKind[] = ['mineure', 'arcane', 'invocation', 'beni', 'chaos'];

export function CombatField(
  { value, onChange, allFeatures }:
  { value: Partial<CombatFeature> | undefined; onChange: (v: Partial<CombatFeature> | undefined) => void; allFeatures: (Partial<CombatFeature> | undefined)[] },
) {
  const c = value ?? {};
  // Patch CREUX : on ne stocke QUE les drapeaux à `true` et les champs spéciaux renseignés (pas de
  // `false`/`undefined` qui alourdiraient le JSON). Objet vide → champ supprimé (undefined).
  const emit = (next: Partial<CombatFeature>) => {
    const clean: Partial<CombatFeature> = {};
    for (const [k, v] of Object.entries(next)) if (v !== undefined && v !== false) (clean as Record<string, unknown>)[k] = v;
    onChange(Object.keys(clean).length ? clean : undefined);
  };
  const boolKeys = combatBoolKeys([...allFeatures, c]);
  const offHand = c.offHandPenalty;
  return (
    <div className="ed-field">
      <span>capacité de combat (drapeaux LDB 10 — n'afficher/stocker que les actifs)</span>
      <div className="de-grid de-flags">
        {boolKeys.map((k) => (
          <label className="ed-check" key={k}>
            <input type="checkbox" checked={!!c[k]} onChange={(e) => emit({ ...c, [k]: e.target.checked || undefined })} />
            <span>{k}</span>
          </label>
        ))}
      </div>
      <div className="tf-row">
        <label className="dr">Famille d'incantation
          <select value={c.castingKind ?? ''} onChange={(e) => emit({ ...c, castingKind: (e.target.value || undefined) as CastingKind | undefined })}>
            <option value="">— (aucune) —</option>
            {CASTING_KINDS.map((ck) => <option key={ck} value={ck}>{ck}</option>)}
          </select>
        </label>
      </div>
      <div className="ed-subfield">
        <span>Modes d'attaque ajoutés (ex. dual-wield)</span>
        {(c.attackModes ?? []).map((mode, i) => (
          <div className="de-reflrow" key={i}>
            <input value={mode} onChange={(e) => emit({ ...c, attackModes: (c.attackModes ?? []).map((m, j) => (j === i ? e.target.value : m)) })} />
            <button className="btn small danger" title="Retirer" onClick={() => { const next = (c.attackModes ?? []).filter((_, j) => j !== i); emit({ ...c, attackModes: next.length ? next : undefined }); }}>✕</button>
          </div>
        ))}
        <button className="btn small" onClick={() => emit({ ...c, attackModes: [...(c.attackModes ?? []), ''] })}>+ Mode d'attaque</button>
      </div>
      <div className="tf-row">
        <label className="dr"><input type="checkbox" checked={!!offHand} onChange={(e) => emit({ ...c, offHandPenalty: e.target.checked ? { perLevel: 10, zeroAt: 2 } : undefined })} /> Pénalité de main secondaire</label>
        {offHand && (
          <>
            <label className="dr">par niveau<input type="number" value={offHand.perLevel} onChange={(e) => emit({ ...c, offHandPenalty: { ...offHand, perLevel: Number(e.target.value) || 0 } })} /></label>
            <label className="dr">nulle à<input type="number" value={offHand.zeroAt} onChange={(e) => emit({ ...c, offHandPenalty: { ...offHand, zeroAt: Number(e.target.value) || 0 } })} /></label>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 3) skills/talents d'avancement — AdvancementRef[] (espèce / niveau de carrière)
 *    union { ref } | { wildcard, specOptions? } | { choice[] } | { random }
 * ──────────────────────────────────────────────────────────────────────────── */

type AdvMode = 'ref' | 'wildcard' | 'choice' | 'random';
const ADV_MODE_LABEL: Record<AdvMode, string> = { ref: 'Réf.', wildcard: 'Joker (Au choix)', choice: 'Choix (A ou B)', random: 'Aléatoire (N)' };
const advMode = (a: AdvancementRef): AdvMode => ('ref' in a ? 'ref' : 'wildcard' in a ? 'wildcard' : 'choice' in a ? 'choice' : 'random');

/** Convertit une entrée vers un autre mode en gardant ce qui se transpose (la réf courante). */
function advTo(a: AdvancementRef, mode: AdvMode): AdvancementRef {
  const cur: Ref = 'ref' in a ? a.ref : 'wildcard' in a ? a.wildcard : { id: '' };
  switch (mode) {
    case 'ref': return { ref: cur };
    case 'wildcard': return { wildcard: cur };
    case 'choice': return { choice: 'choice' in a ? a.choice : [{ ref: cur }] };
    case 'random': return { random: 'random' in a ? a.random : 1 };
  }
}

/** `ds` = dataset cible des réfs (skills OU talents) selon le champ édité. */
export function AdvancementRefField(
  { ds, label, value, onChange }:
  { ds: 'skills' | 'talents'; label: string; value: AdvancementRef[] | undefined; onChange: (v: AdvancementRef[]) => void },
) {
  const list = value ?? [];
  const set = (i: number, a: AdvancementRef) => onChange(list.map((x, j) => (j === i ? a : x)));
  const refCfg = { ds, single: true as const, spec: true as const };
  return (
    <div className="ed-field">
      <span>{label} — emplacements d'avancement (réf / joker / choix / aléatoire)</span>
      {list.map((a, i) => {
        const mode = advMode(a);
        return (
          <div className="ed-subfield" key={i}>
            <div className="de-reflrow">
              <select value={mode} onChange={(e) => set(i, advTo(a, e.target.value as AdvMode))}>
                {(Object.keys(ADV_MODE_LABEL) as AdvMode[]).map((m) => <option key={m} value={m}>{ADV_MODE_LABEL[m]}</option>)}
              </select>
              <button className="btn small danger" title="Retirer l'emplacement" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
            </div>
            {'ref' in a && (
              <RefField cfg={refCfg} fieldKey="réf" value={a.ref} onChange={(v) => set(i, { ref: (v as Ref) ?? { id: '' } })} />
            )}
            {'wildcard' in a && (
              <>
                <RefField cfg={refCfg} fieldKey="joker" value={a.wildcard} onChange={(v) => set(i, { wildcard: (v as Ref) ?? { id: '' }, specOptions: a.specOptions })} />
                <label className="dr">specs restreintes (CSV — vide = « Au choix »)
                  <input value={(a.specOptions ?? []).join(', ')} onChange={(e) => { const opts = e.target.value.split(',').map((s) => s.trim()).filter(Boolean); set(i, { wildcard: a.wildcard, specOptions: opts.length ? opts : undefined }); }} />
                </label>
              </>
            )}
            {'choice' in a && (
              <ChoiceList ds={ds} value={a.choice} onChange={(choice) => set(i, { choice })} />
            )}
            {'random' in a && (
              <label className="dr">nombre aléatoire<input type="number" min={1} value={a.random} onChange={(e) => set(i, { random: Math.max(1, Number(e.target.value) || 1) })} /></label>
            )}
          </div>
        );
      })}
      <button className="btn small" onClick={() => onChange([...list, { ref: { id: '' } }])}>+ Emplacement</button>
    </div>
  );
}

/** Branches d'un `{ choice: AdvancementRef[] }` — chaque branche est elle-même un AdvancementRef
 *  (récursif : on réutilise `AdvancementRefField` borné aux modes ref/joker pour rester lisible). */
function ChoiceList({ ds, value, onChange }: { ds: 'skills' | 'talents'; value: AdvancementRef[]; onChange: (v: AdvancementRef[]) => void }) {
  return (
    <div className="ed-subfield">
      <AdvancementRefField ds={ds} label="branches du choix" value={value} onChange={onChange} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
 * 4) trappings (classe / niveau de carrière) — TrappingRef[]
 *    ( Ref & { count? } ) | { text, count? }
 * ──────────────────────────────────────────────────────────────────────────── */

const isText = (t: TrappingRef): t is { text: string; count?: CountSpec } => 'text' in t;

export function TrappingRefField({ value, onChange }: { value: TrappingRef[] | undefined; onChange: (v: TrappingRef[]) => void }) {
  const list = value ?? [];
  const set = (i: number, t: TrappingRef) => onChange(list.map((x, j) => (j === i ? t : x)));
  const refCfg = { ds: 'trappings' as const, single: true as const };
  // Quantité : nombre fixe « (3) » OU jet « (1d10) » — une seule entrée texte, jet si elle contient un d.
  const countOf = (t: TrappingRef): string => (t.count ? ('fixed' in t.count ? String(t.count.fixed) : t.count.roll) : '');
  const parseCount = (s: string): CountSpec | undefined => {
    const v = s.trim();
    if (!v) return undefined;
    return /[dD]/.test(v) ? { roll: v } : { fixed: Number(v) || 1 };
  };
  return (
    <div className="ed-field">
      <span>possessions — par id du catalogue (+ quantité) ou texte narratif hors catalogue</span>
      {list.map((t, i) => (
        <div className="ed-subfield" key={i}>
          <div className="de-reflrow">
            <select value={isText(t) ? 'text' : 'ref'} onChange={(e) => set(i, e.target.value === 'text' ? { text: '', count: t.count } : { id: '', count: t.count })}>
              <option value="ref">Réf. (catalogue)</option>
              <option value="text">Texte (narratif)</option>
            </select>
            <label className="dr">quantité<input style={{ width: 80 }} placeholder="3 / 1d10" value={countOf(t)} onChange={(e) => set(i, { ...t, count: parseCount(e.target.value) })} /></label>
            <button className="btn small danger" title="Retirer la possession" onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </div>
          {isText(t)
            ? <input placeholder="possession narrative (ex. Pile de prospectus)" value={t.text} onChange={(e) => set(i, { text: e.target.value, count: t.count })} />
            : <RefField cfg={refCfg} fieldKey="possession" value={t.id} onChange={(v) => set(i, { id: typeof v === 'string' ? v : (v as Ref)?.id ?? '', count: t.count })} />}
        </div>
      ))}
      <button className="btn small" onClick={() => onChange([...list, { id: '' }])}>+ Possession</button>
    </div>
  );
}
