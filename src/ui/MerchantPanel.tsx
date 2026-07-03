import { useState, useMemo, Fragment } from 'react';
import { useGame } from '../state/store';
import { findTrappingById, weaponGroupLabel, type QualityRef } from '../data/index';
import { priceToMoney, fromBrass, toBrass, canAfford, add as moneyAdd, type Money } from '../engine/money';
import { craftPriceFactor } from '../engine/qualities/craftEconomy';
import { isRepairable, itemRepairCostBrass } from '../engine/repair';
import { bargainBuyFactor } from '../engine/bargain';
import { compareEquip, isShieldItem } from '../engine/equipCompare';
import { itemFromTrappingById, isWeaponActive, damageString } from '../engine/items';
import { rangeSpecLabel, ammoRangeModLabel } from './weaponStats';
import type { WeaponDamageSpec, WeaponRangeSpec, AmmoRangeMod } from '../engine/types';
import { describeQuality } from '../engine/qualities/describe';
import { sellGain, barterQuote, sellBuyerAvailability } from '../state/merchantFlow';
import type { Combatant, ItemInstance } from '../engine/types';
import { Coins } from './Coins';
import { Prose, mdToText } from './Prose';
import { CharFrame } from './CharFrame';
import { TeamPortrait } from './TeamPortrait';

type MerchantState = NonNullable<ReturnType<typeof useGame.getState>['merchant']>;

/** 6 familles de présentation du stock (ne pas mélanger arme/armure/etc.). */
const FAMILIES: { key: string; label: string }[] = [
  { key: 'melee', label: 'Armes de mêlée' },
  { key: 'ranged', label: 'Armes à distance' },
  { key: 'ammo', label: 'Munitions' },
  { key: 'boucliers', label: 'Boucliers' },
  { key: 'armor', label: 'Armures' },
  { key: 'divers', label: 'Divers' },
];
const AVAIL_RANK: Record<string, number> = { Commune: 0, Limitée: 1, Rare: 2, Exotique: 3 };

function familyOf(id: string): string {
  const t = findTrappingById(id);
  if (!t) return 'divers';
  if (isShieldItem({ qualities: t.qualities })) return 'boucliers';
  if (t.type === 'melee') return 'melee';
  if (t.type === 'ranged') return 'ranged';
  if (t.type === 'ammunition') return 'ammo';
  if (t.type === 'armor') return 'armor';
  return 'divers';
}
function availRank(id: string): number {
  return AVAIL_RANK[findTrappingById(id)?.availability ?? ''] ?? 4;
}

/** Colonnes de stats par famille (tableau comparatif). 1re colonne (`emph`) = info clé mise en avant. */
type TrapRow = { damage?: WeaponDamageSpec | null; reach?: string | null; range?: WeaponRangeSpec | null; ammoRangeMod?: AmmoRangeMod | null; pa?: number | null; qualities?: QualityRef[] };
const DASH = '—';
const dmg = (t: TrapRow) => (t.damage ? damageString(t.damage) : DASH);
const FAMILY_COLS: Record<string, { label: string; get: (t: TrapRow) => string; emph?: boolean }[]> = {
  melee: [
    { label: 'Dégâts', get: dmg, emph: true },
    { label: 'Allonge', get: (t) => t.reach || DASH },
  ],
  ranged: [
    { label: 'Dégâts', get: dmg, emph: true },
    { label: 'Portée', get: (t) => rangeSpecLabel(t.range) ?? (ammoRangeModLabel(t.ammoRangeMod) || DASH) }, // « N m » fixe / « BF×k m » jet ; sinon modificateur de munition (« ×½ »)
  ],
  ammo: [{ label: 'Dégâts', get: dmg, emph: true }],
  boucliers: [{ label: 'Protection', get: (t) => { const q = (t.qualities ?? []).find((x) => x.id === 'protectrice'); return q ? `Protectrice ${q.value ?? ''}`.trim() : DASH; }, emph: true }],
  armor: [{ label: 'PA', get: (t) => (t.pa != null ? String(t.pa) : DASH), emph: true }],
  divers: [],
};

/** Coût d'achat unitaire (catalogue × qualité d'artisanat × Marchandage). null si prix non chiffré (« ND »). */
function lineCost(id: string, factor: number): Money | null {
  const t = findTrappingById(id);
  if (!t) return null;
  const brass = toBrass(priceToMoney(t.price)) * craftPriceFactor({ qualities: t.qualities }) * factor;
  if (!Number.isFinite(brass)) return null;
  return fromBrass(Math.round(brass));
}

/** Coût de réparation d'un objet endommagé — armure (LDB 63 l.97-98) ou arme (LDB 62 l.135). */
function repairCost(item: ItemInstance): Money {
  const t = item.trappingId ? findTrappingById(item.trappingId) : undefined;
  const base = t ? toBrass(priceToMoney(t.price)) : 0;
  return fromBrass(itemRepairCostBrass(item, base));
}

const TREND_CLASS: Record<string, string> = { up: 'cmp-up', down: 'cmp-down', same: '' };
const TREND_SYM: Record<string, string> = { up: '▲', down: '▼', same: '' };

/** Présentationnel (props) — testable hors store. `initialTab`/`initialDetails`/`initialBuyView` = état de départ (SSR/test). */
export function MerchantPanelView({ merchant, party, money, onAddToCart, onDecCart, onRemoveCart, onClearCart, onRefuse, onPay, onAssignDist, onConfirmDist, onSell, onAddToSellCart, onRemoveSellCart, onClearSellCart, onConfirmSell, onRepair, onBargain, onAppraise, onClose, onSellHalving, onBarter, onSearchAvailability, initialTab, initialDetails, initialBuyView, initialSellView }: {
  merchant: MerchantState;
  party: Combatant[];
  money: Money;
  onAddToCart: (id: string) => void;
  onDecCart: (id: string) => void;
  onRemoveCart: (id: string) => void;
  onClearCart: () => void;
  onRefuse: (mode: 'buy' | 'sell') => void;
  onPay: () => void;
  onAssignDist: (index: number, heroId: string) => void;
  onConfirmDist: () => void;
  onSell: (uid: string, heroId: string) => void;
  onAddToSellCart: (uid: string, heroId: string) => void;
  onRemoveSellCart: (uid: string) => void;
  onClearSellCart: () => void;
  onConfirmSell: () => void;
  onRepair: (uid: string, heroId: string) => void;
  onBargain: (mode: 'buy' | 'sell') => void;
  onAppraise: (uid: string, heroId: string) => void;
  onClose: () => void;
  /** « Baisse des prix » à la vente (LDB 59 l.60) — optionnel (rendu sans si absent). */
  onSellHalving?: (uid: string, delta: number) => void;
  /** Troc (LDB 59 l.64-76) — optionnel : l'onglet Troc n'apparaît que s'il est fourni. */
  onBarter?: (opts: { giveHeroId: string; giveTrappingId: string; getStockId: string; getCount?: number }) => void;
  /** Recherche active de Disponibilité (LDB 59 l.50) — optionnel : le bouton n'apparaît que s'il est fourni. */
  onSearchAvailability?: () => void;
  initialTab?: 'buy' | 'sell' | 'repair' | 'barter';
  initialDetails?: string;
  initialBuyView?: 'browse' | 'cart';
  initialSellView?: 'browse' | 'cart';
}) {
  const [tab, setTab] = useState<'buy' | 'sell' | 'repair' | 'barter'>(initialTab ?? 'buy');
  const [buyCat, setBuyCat] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(initialDetails ?? null);
  const [buyView, setBuyView] = useState<'browse' | 'cart'>(initialBuyView ?? 'browse');
  const [sellView, setSellView] = useState<'browse' | 'cart'>(initialSellView ?? 'browse');
  const [sellHero, setSellHero] = useState<string | null>(null); // onglet PJ actif côté Vente
  const [barterGive, setBarterGive] = useState(''); // Troc : « heroId|trappingId » du bien cédé
  const [barterGetId, setBarterGetId] = useState(''); // Troc : id du stock acquis
  const [barterCount, setBarterCount] = useState(1);
  const toggleDetails = (label: string) => setDetails((d) => (d === label ? null : label));

  const damaged = party.flatMap((h) => (h.items ?? []).filter((it) => isRepairable(it)).map((it) => ({ h, it })));
  const sellable = party.flatMap((h) => (h.items ?? []).map((it) => ({ h, it })));

  // Marchandage (LDB 60 l.12) : achat (panier) et vente = négociations distinctes.
  const buyHaggle = merchant.bargainBuy ? bargainBuyFactor(merchant.bargainBuy.won, merchant.bargainBuy.drNet, merchant.bargainBuy.negotiator) : 1;
  const buyFactor = (merchant.buyMarkup ?? 1) * buyHaggle;
  const buyDiscount = Math.round((1 - buyHaggle) * 100);
  const sellPriceMoney = (it: ItemInstance): Money => sellGain(it, merchant); // prix de vente = source unique (engine)
  // Panier de VENTE (#22b) : instances résolues chez leur porteur + total (mêmes briques que l'achat).
  const sellCart = merchant.sellCart ?? [];
  const sellInCart = (uid: string) => sellCart.some((c) => c.uid === uid);
  const sellCartItems = sellCart
    .map((c) => ({ hero: party.find((h) => h.id === c.heroId), it: party.find((h) => h.id === c.heroId)?.items?.find((i) => i.uid === c.uid) }))
    .filter((x): x is { hero: Combatant; it: ItemInstance } => !!x.it && !!x.hero);
  const sellCartTotal = sellCartItems.reduce((acc, x) => moneyAdd(acc, sellPriceMoney(x.it)), fromBrass(0));

  // Stock groupé par famille puis trié (Disponibilité → nom). Lignes keyées par `trappingId`.
  const labelOf = (id: string) => findTrappingById(id)?.label ?? id;
  const inStock = merchant.stock.filter((l) => l.qty > 0);
  const byFamily: Record<string, { id: string; qty: number }[]> = {};
  for (const l of inStock) (byFamily[familyOf(l.id)] ??= []).push(l);
  for (const k of Object.keys(byFamily)) byFamily[k].sort((a, b) => availRank(a.id) - availRank(b.id) || labelOf(a.id).localeCompare(labelOf(b.id)));

  const cart = merchant.cart ?? [];
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const cartTotalBrass = cart.reduce((s, c) => { const u = lineCost(c.id, buyFactor); return s + (u ? toBrass(u) * c.qty : 0); }, 0);
  const cartTotal = fromBrass(cartTotalBrass);
  const affordCart = toBrass(money) >= cartTotalBrass;
  const sealed = merchant.bargainBuy != null; // a négocié : prix figé, on peut RETIRER mais pas ajouter ni renégocier
  const cartQtyOf = (id: string) => cart.find((c) => c.id === id)?.qty ?? 0;
  const dist = merchant.pendingDistribution ?? null;

  const previews = useMemo(() => {
    const map: Record<string, ItemInstance> = {};
    for (const l of inStock) { const it = itemFromTrappingById(l.id); if (it) map[l.id] = it; }
    return map;
  }, [inStock.map((l) => l.id).join('|')]);

  // Bloc de comparaison d'un héros (info : la neuve vs l'équipement actuel). Pas de bouton d'équipement (cart).
  const heroCompareBlock = (item: ItemInstance, h: Combatant) => {
    const cmp = compareEquip(item, h);
    return (
      <div className="mc-hero" key={h.id}>
        <div className="mc-hero-head" title={h.name}>
          <TeamPortrait combatant={h} size={24} />
          <span className="mc-cur">{cmp.currentName ? `actuel : ${cmp.currentName}` : 'rien d’équipé'}</span>
        </div>
        {cmp.rows.length > 0 && (
          <table className="mc-table">
            <tbody>
              {cmp.rows.map((r) => (
                <tr key={r.label} className={TREND_CLASS[r.trend]}>
                  <th>{r.label}</th>
                  <td className="mc-old">{r.current}</td>
                  <td className="mc-arrow">→</td>
                  <td className="mc-new">{r.next} <span className="mc-trend">{TREND_SYM[r.trend]}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  // Fiche de détail (clic sur le nom) : INFORMATIVE — Atouts/Défauts + description + comparaison.
  const renderDetailCard = (item: ItemInstance) => {
    const quals = item.qualities.map((q) => describeQuality(q)).filter((q): q is NonNullable<typeof q> => q != null);
    const atouts = quals.filter((q) => q.type !== 'Défaut');
    const defauts = quals.filter((q) => q.type === 'Défaut');
    const canCompare = item.kind === 'melee' || item.kind === 'ranged' || item.kind === 'armor';
    return (
      <div className="merch-compare preview" role="region" aria-label={`Détails ${item.name}`}>
        <div className="mc-head">
          <strong>{item.name}</strong>
          <button className="btn small" onClick={() => setDetails(null)}>Fermer</button>
        </div>
        {(atouts.length > 0 || defauts.length > 0) && (
          <div className="mc-quals">
            {atouts.map((q) => <div className="mc-qual atout" key={`a-${q.key}`}><span className="q-name">{q.label}</span>{q.desc && <span className="q-desc">{mdToText(q.desc)}</span>}</div>)}
            {defauts.map((q) => <div className="mc-qual flaw" key={`d-${q.key}`}><span className="q-name">{q.label}</span>{q.desc && <span className="q-desc">{mdToText(q.desc)}</span>}</div>)}
          </div>
        )}
        {item.desc && <div className="mc-desc"><Prose md={item.desc} /></div>}
        {canCompare && party.map((h) => heroCompareBlock(item, h))}
      </div>
    );
  };

  // Contrôle de Marchandage du panier (clair : ce qu'il fait + son effet).
  const buyHaggleControl = () => {
    if (merchant.soured) return <span className="bargain-tag soured" title="Le marchand se méfie de votre monnaie">🚫 Marchand méfiant — fini de marchander</span>;
    if (merchant.bargainLocked) return <span className="bargain-tag locked" title="Vous avez déjà négocié puis quitté sans conclure ; revenez après son réassort">🔒 Marchandage indisponible jusqu’au réassort</span>;
    if (merchant.bargainBuy == null) return <button className="btn small" onClick={() => onBargain('buy')} title="Test de Marchandage : en cas de réussite, le marchand baisse ses prix de 10 à 20 %">💬 Marchander le panier</button>;
    return merchant.bargainBuy.won
      ? <span className="bargain-tag won">✔ Prix réduits de {buyDiscount} %</span>
      : <span className="bargain-tag">✘ Marchandage raté — prix plein</span>;
  };

  // --- Vue : Répartition (après paiement) ---
  const renderDistribution = () => (
    <div className="merch-tab">
      <div className="dist-head"><strong>Répartition</strong> — qui récupère quoi ?</div>
      <div className="dist-list">
        {(dist ?? []).map((d, i) => (
          <div className="dist-row" key={d.item.uid}>
            <span className="merch-name">{d.item.name}</span>
            <div className="frame-row">
              {party.map((h) => (
                <CharFrame key={h.id} c={h} variant="identity" size="xs" selected={d.heroId === h.id} onClick={() => onAssignDist(i, h.id)} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="cart-actions">
        <button className="btn btn-primary" onClick={() => { onConfirmDist(); setBuyView('browse'); }}>Confirmer la répartition</button>
      </div>
    </div>
  );

  // --- Vue : Panier ---
  const renderCart = () => (
    <div className="merch-tab">
      <div className="cart-head">
        <button className="btn small" disabled={sealed} title={sealed ? 'Marché négocié : réglez ou refusez le marché' : undefined} onClick={() => setBuyView('browse')}>← Continuer les achats</button>
        <strong>🛒 Panier</strong>
      </div>
      {!cart.length ? (
        <p className="empty">— panier vide —</p>
      ) : (
        <>
          <table className="cart-table">
            <tbody>
              {cart.map((c) => {
                const u = lineCost(c.id, buyFactor);
                const sub = u ? fromBrass(toBrass(u) * c.qty) : null;
                const stockQty = merchant.stock.find((l) => l.id === c.id)?.qty ?? 0;
                return (
                  <tr key={c.id}>
                    <td className="cart-name">{labelOf(c.id)}</td>
                    <td className="cart-step">
                      <button className="btn-step" onClick={() => onDecCart(c.id)} aria-label="Un de moins">−</button>
                      <span className="cart-n">{c.qty}</span>
                      <button className="btn-step" disabled={sealed || c.qty >= stockQty} title={sealed ? 'Marché négocié — vous ne pouvez plus ajouter' : undefined} onClick={() => onAddToCart(c.id)} aria-label="Un de plus">+</button>
                    </td>
                    <td className="cart-unit">{u ? <Coins money={u} /> : '—'}</td>
                    <td className="cart-sub">{sub ? <Coins money={sub} /> : '—'}</td>
                    <td className="cart-rm"><button className="btn-step" onClick={() => onRemoveCart(c.id)} aria-label="Retirer">✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="cart-haggle">{buyHaggleControl()}</div>
          {sealed && (
            <p className="cart-sealed" title="Refuser ou partir sans payer : le marchand ne marchandera plus avant son réassort.">🤝 Prix arrêté — vous pouvez retirer des articles, puis régler ou refuser.</p>
          )}
          <div className="cart-total">Total : <strong><Coins money={cartTotal} /></strong>{buyDiscount > 0 && <span className="cart-disc"> (marchandé −{buyDiscount} %)</span>}</div>
          <div className="cart-actions">
            {sealed
              ? <button className="btn small danger" onClick={() => { onRefuse('buy'); setBuyView('browse'); }}>Refuser le marché</button>
              : <button className="btn small" onClick={onClearCart}>Vider le panier</button>}
            <button className="btn btn-primary" disabled={!affordCart} title={affordCart ? undefined : 'Bourse insuffisante'} onClick={onPay}>Payer <Coins money={cartTotal} /></button>
          </div>
          {!affordCart && <p className="cart-warn">Bourse insuffisante (<Coins money={money} />).</p>}
        </>
      )}
    </div>
  );

  // --- Vue : Parcourir ---
  const renderBrowse = () => {
    const cats = FAMILIES.filter((f) => byFamily[f.key]?.length);
    const activeCat = (buyCat && byFamily[buyCat]?.length ? buyCat : cats[0]?.key) ?? '';
    const rows = byFamily[activeCat] ?? [];
    return (
      <div className="merch-tab">
        <div className="cart-bar">
          {cartCount > 0
            ? <><span className="cart-info">🛒 {cartCount} article{cartCount > 1 ? 's' : ''} · <Coins money={cartTotal} /></span><button className="btn small btn-primary" onClick={() => setBuyView('cart')}>Voir le panier →</button></>
            : <span className="cart-info empty">🛒 Panier vide</span>}
          {onSearchAvailability && (
            <button className="btn small" onClick={onSearchAvailability} title="Passer une journée entière à écumer les étals (Test de Ragot) : réassort frais, Disponibilité +10 % si le Ragot réussit (LDB 59 l.50)">
              🔎 Chercher activement (1 journée)
            </button>
          )}
        </div>
        {!cats.length ? (
          <p className="empty">— rien en stock —</p>
        ) : (
          <>
            <div className="merch-subtabs" role="tablist">
              {cats.map((fam) => (
                <button key={fam.key} className={`mtab sub ${activeCat === fam.key ? 'active' : ''}`} onClick={() => setBuyCat(fam.key)}>
                  {fam.label}<span className="tab-count">{byFamily[fam.key].length}</span>
                </button>
              ))}
            </div>
            {(() => {
              const cols = FAMILY_COLS[activeCat] ?? [];
              const span = cols.length + 4;
              const groups: { key: string; label: string; items: typeof rows }[] = [];
              for (const l of rows) {
                const g = findTrappingById(l.id)?.subType ?? 'autres';
                let bucket = groups.find((x) => x.key === g);
                if (!bucket) { bucket = { key: g, label: weaponGroupLabel(g) || 'Autres', items: [] }; groups.push(bucket); }
                bucket.items.push(l);
              }
              groups.sort((a, b) => a.label.localeCompare(b.label));
              const showGroups = groups.length > 1;
              const itemRow = (l: { id: string; qty: number }) => {
                const t = findTrappingById(l.id);
                const unit = lineCost(l.id, buyFactor);
                const canAffordOne = unit ? canAfford(money, unit) : false;
                const inCart = cartQtyOf(l.id);
                const open = details === l.id;
                return (
                  <Fragment key={l.id}>
                    <tr className={`merch-trow ${canAffordOne ? '' : 'unaffordable'} ${open ? 'open' : ''}`}>
                      <td className="col-name">
                        <button className="merch-name as-link" onClick={() => toggleDetails(l.id)} aria-expanded={open} title="Voir les détails de l’objet">
                          <span className="caret">{open ? '▾' : '▸'}</span> {labelOf(l.id)}
                          <span className="merch-qty" title="En stock">×{l.qty}</span>
                        </button>
                      </td>
                      {cols.map((c) => <td key={c.label} className={c.emph ? 'col-emph' : 'col-stat'}>{t ? c.get(t) : DASH}</td>)}
                      <td className="col-enc">{t?.enc ?? 0}</td>
                      <td className="col-price">{unit ? <Coins money={unit} /> : '—'}</td>
                      <td className="col-buy">
                        {inCart > 0 ? (
                          <span className="cart-step">
                            <button className="btn-step" onClick={() => onDecCart(l.id)} aria-label="Un de moins">−</button>
                            <span className="cart-n">{inCart}</span>
                            <button className="btn-step" disabled={sealed || inCart >= l.qty || !canAffordOne} onClick={() => onAddToCart(l.id)} aria-label="Un de plus">+</button>
                          </span>
                        ) : (
                          <button className="btn small" disabled={sealed || !canAffordOne} title={sealed ? 'Marché conclu — panier figé' : canAffordOne ? 'Ajouter au panier' : 'Bourse insuffisante'} onClick={() => onAddToCart(l.id)}>+ Ajouter</button>
                        )}
                      </td>
                    </tr>
                    {open && previews[l.id] && (
                      <tr className="detail-row"><td colSpan={span}>{renderDetailCard(previews[l.id])}</td></tr>
                    )}
                  </Fragment>
                );
              };
              return (
                <table className="merch-table">
                  <thead>
                    <tr>
                      <th className="col-name">Objet</th>
                      {cols.map((c) => <th key={c.label} className={c.emph ? 'col-emph' : 'col-stat'}>{c.label}</th>)}
                      <th className="col-enc" title="Encombrement">Enc</th>
                      <th className="col-price">Prix</th>
                      <th className="col-buy" aria-label="Panier" />
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <Fragment key={g.key}>
                        {showGroups && <tr className="group-row"><td colSpan={span}>{g.label}</td></tr>}
                        {g.items.map(itemRow)}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              );
            })()}
          </>
        )}
      </div>
    );
  };

  // --- Vente : Parcourir (un onglet par PJ) — bouton « + Vendre » qui pousse au panier de vente ---
  const renderSellBrowse = () => {
    const sellHeroes = party.filter((h) => (h.items ?? []).length > 0);
    if (!sellHeroes.length) return <p className="empty">— rien à vendre —</p>;
    const activeSellId = (sellHero && sellHeroes.some((h) => h.id === sellHero) ? sellHero : sellHeroes[0]?.id) ?? '';
    const sellHeroObj = party.find((h) => h.id === activeSellId);
    const heroItems = sellHeroObj?.items ?? [];
    // « équipé » = armure portée (`equipped`) OU arme tenue dans le set actif (loadout) — plus de flag d'arme.
    const isEquippedForSell = (it: ItemInstance) =>
      it.kind === 'melee' || it.kind === 'ranged' ? !!sellHeroObj && isWeaponActive(sellHeroObj, it.uid) : !!it.equipped;
    return (
      <>
        <div className="cart-bar">
          {sellCart.length > 0
            ? <><span className="cart-info">🛒 {sellCart.length} à vendre · +<Coins money={sellCartTotal} /></span><button className="btn small btn-primary" onClick={() => setSellView('cart')}>Voir le panier →</button></>
            : <span className="cart-info empty">🛒 Rien à vendre sélectionné</span>}
        </div>
        <div className="merch-subtabs" role="tablist">
          {sellHeroes.map((h) => (
            <button key={h.id} className={`mtab sub ${activeSellId === h.id ? 'active' : ''}`} onClick={() => setSellHero(h.id)} title={h.name}>
              <TeamPortrait combatant={h} size={24} /><span className="tab-count">{(h.items ?? []).length}</span>
            </button>
          ))}
        </div>
        {heroItems.map((it) => (
          <div className="merch-row sell" key={it.uid}>
            <span className="merch-name">
              {it.name}
              {isEquippedForSell(it) && <span className="equipped-tag" title="Actuellement équipé">✓ équipé</span>}
              {it.identified === false ? ' (non identifié)' : ''}
            </span>
            <span className="merch-price"><Coins money={sellPriceMoney(it)} /></span>
            {/* « Baisse des prix » (LDB 59 l.60) : brader (÷2) monte la Disponibilité d'un acheteur d'un
                cran. Montré pour les biens qu'un acheteur commun ne prend pas d'emblée (Limitée+). */}
            {onSellHalving && (() => {
              const h = merchant.sellHalvings?.[it.uid] ?? 0;
              if (sellBuyerAvailability(it, 0) === 'Commune' && h === 0) return null;
              return (
                <span className="sell-haggle" title="Baisser le prix de moitié augmente la Disponibilité d'un acheteur d'un cran (LDB 59 l.60)">
                  <button className="btn-step" disabled={h <= 0} onClick={() => onSellHalving(it.uid, -1)} aria-label="Prix plein">−</button>
                  <span className="sell-av">acheteur {sellBuyerAvailability(it, h)}{h > 0 ? ` (÷${2 ** h})` : ''}</span>
                  <button className="btn-step" disabled={h >= 4} onClick={() => onSellHalving(it.uid, 1)} aria-label="Brader de moitié" title="Diviser le prix par deux">÷2</button>
                </span>
              );
            })()}
            {it.identified === false && (
              <button className="btn small" onClick={() => onAppraise(it.uid, activeSellId)} title="Test d'Évaluation : révèle les qualités cachées">Évaluer</button>
            )}
            {sellInCart(it.uid)
              ? <button className="btn small" onClick={() => onRemoveSellCart(it.uid)} title="Retirer du panier de vente">✓ au panier</button>
              : <button className="btn small" onClick={() => onAddToSellCart(it.uid, activeSellId)} title="Ajouter au panier de vente">+ Vendre</button>}
          </div>
        ))}
        {!heroItems.length && <p className="empty">— rien à vendre pour ce personnage —</p>}
      </>
    );
  };

  // --- Vente : Panier (parité achat — mêmes briques cart-*) ---
  const renderSellCart = () => (
    <>
      <div className="cart-head">
        <button className="btn small" onClick={() => setSellView('browse')}>← Continuer</button>
        <strong>🛒 Vente</strong>
      </div>
      {!sellCartItems.length ? (
        <p className="empty">— panier de vente vide —</p>
      ) : (
        <>
          <table className="cart-table">
            <tbody>
              {sellCartItems.map(({ hero, it }) => (
                <tr key={it.uid}>
                  <td className="cart-name">{it.name}<span className="cart-owner" title={hero.name}><TeamPortrait combatant={hero} size={18} /></span></td>
                  <td className="cart-sub"><Coins money={sellPriceMoney(it)} /></td>
                  <td className="cart-rm"><button className="btn-step" onClick={() => onRemoveSellCart(it.uid)} aria-label="Retirer">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="cart-total">Total : <strong>+<Coins money={sellCartTotal} /></strong></div>
          <div className="cart-actions">
            <button className="btn small" onClick={onClearSellCart}>Vider</button>
            <button className="btn btn-primary" onClick={() => { onConfirmSell(); setSellView('browse'); }}>Vendre <Coins money={sellCartTotal} /></button>
          </div>
        </>
      )}
    </>
  );

  // --- Troc (LDB 59 l.64-76) : céder N exemplaires d'un bien contre M du stock, sans argent ---
  const renderBarter = () => {
    if (!onBarter) return null;
    // Biens cédables : par (héros, trapping) non équipé et à prix chiffré, avec le nombre en stock.
    const giveOpts: { key: string; heroId: string; trappingId: string; label: string; count: number }[] = [];
    for (const h of party) {
      const byTrap = new Map<string, number>();
      for (const it of h.items ?? []) if (it.trappingId && !it.equipped) byTrap.set(it.trappingId, (byTrap.get(it.trappingId) ?? 0) + 1);
      for (const [tid, count] of byTrap) {
        const t = findTrappingById(tid);
        if (t && (t.price?.gold || t.price?.silver || t.price?.bronze)) giveOpts.push({ key: `${h.id}|${tid}`, heroId: h.id, trappingId: tid, label: `${t.label} ×${count} (${h.name})`, count });
      }
    }
    const getOpts = inStock.map((l) => ({ id: l.id, label: `${labelOf(l.id)} ×${l.qty}` }));
    const give = giveOpts.find((o) => o.key === barterGive) ?? giveOpts[0];
    const getId = getOpts.find((o) => o.id === barterGetId)?.id ?? getOpts[0]?.id ?? '';
    const count = Math.max(1, barterCount);
    const quote = give && getId ? barterQuote(give.trappingId, getId, count) : null;
    const getStockQty = inStock.find((l) => l.id === getId)?.qty ?? 0;
    const ok = !!quote && !!give && give.count >= quote.giveCount && getStockQty >= count;
    return (
      <div className="merch-tab tavern-block">
        <p className="tavern-detail">Échange sans argent : la Disponibilité des deux biens fixe le ratio (LDB 59 l.64-76).</p>
        {!giveOpts.length ? <p className="empty">— aucun bien chiffré à céder —</p> : (
          <>
            <label className="tavern-amount">Céder
              <select value={give?.key ?? ''} onChange={(e) => setBarterGive(e.target.value)}>
                {giveOpts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="tavern-amount">Acquérir
              <select value={getId} onChange={(e) => setBarterGetId(e.target.value)}>
                {getOpts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              </select>
            </label>
            <label className="tavern-amount">Quantité acquise
              <input type="number" min={1} max={getStockQty || 1} value={count} onChange={(e) => setBarterCount(Math.max(1, Number(e.target.value) || 1))} />
            </label>
            {quote && give && (
              <p className="tavern-detail">
                Ratio {quote.giveAv} <b>{quote.ratio.give}:{quote.ratio.get}</b> {quote.getAv} → céder <b>{quote.giveCount}</b> × {findTrappingById(give.trappingId)?.label} contre <b>{count}</b> × {labelOf(getId)}.
                {give.count < quote.giveCount && <span className="cart-warn"> Exemplaires insuffisants ({give.count}/{quote.giveCount}).</span>}
                {getStockQty < count && <span className="cart-warn"> Stock insuffisant.</span>}
              </p>
            )}
            <div className="modal-actions">
              <button className="btn btn-primary" disabled={!ok} onClick={() => give && onBarter({ giveHeroId: give.heroId, giveTrappingId: give.trappingId, getStockId: getId, getCount: count })}>Échanger</button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="merchant-panel modal-overlay">
      <div className="merchant-box">
        <div className="merchant-head">
          <h2 className="merchant-title">🪙 Marchand</h2>
          <span className="purse">Bourse <Coins money={money} /></span>
          <button className="btn small" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="merchant-tabs" role="tablist">
          <button className={`mtab ${tab === 'buy' ? 'active' : ''}`} onClick={() => setTab('buy')}>Acheter{cartCount ? <span className="tab-count">{cartCount}</span> : null}</button>
          <button className={`mtab ${tab === 'sell' ? 'active' : ''}`} onClick={() => setTab('sell')}>Vendre{sellable.length ? <span className="tab-count">{sellable.length}</span> : null}</button>
          <button className={`mtab ${tab === 'repair' ? 'active' : ''}`} onClick={() => setTab('repair')}>Réparer{damaged.length ? <span className="tab-count">{damaged.length}</span> : null}</button>
          {onBarter && <button className={`mtab ${tab === 'barter' ? 'active' : ''}`} onClick={() => setTab('barter')}>Troc</button>}
        </div>

        <div className="merchant-body">
          {tab === 'buy' && (dist ? renderDistribution() : buyView === 'cart' ? renderCart() : renderBrowse())}

          {tab === 'sell' && (
            <div className="merch-tab">
              <div className="haggle-bar">
                {merchant.soured ? <span className="bargain-tag soured">🚫 Marchand méfiant — fini de marchander</span>
                  : merchant.bargainLocked ? <span className="bargain-tag locked" title="Vous avez refusé/renié un marché ; revenez après son réassort">🔒 Marchandage indisponible jusqu’au réassort</span>
                  : merchant.bargainSell == null ? <button className="btn small" onClick={() => onBargain('sell')} title="Test de Marchandage : en cas de réussite, il rachète à ½ du prix au lieu de ¼">💬 Marchander la vente</button>
                  : <>
                      <span className={`bargain-tag ${merchant.bargainSell.won ? 'won' : ''}`}>{merchant.bargainSell.won ? '✔ Rachat à ½ du prix' : '✘ Rachat à ¼ du prix'}</span>
                      <button className="btn small danger" onClick={() => onRefuse('sell')} title="Décliner l’offre — le marchand ne marchandera plus (achat ni vente) jusqu’au réassort">Refuser l’offre</button>
                    </>}
              </div>
              {sellView === 'cart' ? renderSellCart() : renderSellBrowse()}
            </div>
          )}

          {tab === 'repair' && (
            <div className="merch-tab">
              {damaged.map(({ h, it }) => (
                <div className="merch-row repair" key={it.uid}>
                  <span className="merch-name" title={h.name}><TeamPortrait combatant={h} size={20} /> {it.name}</span>
                  <span className="merch-price"><Coins money={repairCost(it)} /></span>
                  <button className="btn small" onClick={() => onRepair(it.uid, h.id)}>Réparer</button>
                </div>
              ))}
              {!damaged.length && <p className="empty">— aucun objet à réparer —</p>}
            </div>
          )}

          {tab === 'barter' && renderBarter()}
        </div>
      </div>
    </div>
  );
}

/** Connecté au store. */
export function MerchantPanel() {
  const merchant = useGame((s) => s.merchant);
  const party = useGame((s) => s.party);
  const money = useGame((s) => s.money);
  const addToCart = useGame((s) => s.addToCart);
  const decFromCart = useGame((s) => s.decFromCart);
  const removeFromCart = useGame((s) => s.removeFromCart);
  const clearCart = useGame((s) => s.clearCart);
  const refuseBargain = useGame((s) => s.refuseBargain);
  const payCart = useGame((s) => s.payCart);
  const assignDistribution = useGame((s) => s.assignDistribution);
  const confirmDistribution = useGame((s) => s.confirmDistribution);
  const sellItem = useGame((s) => s.sellItem);
  const addToSellCart = useGame((s) => s.addToSellCart);
  const removeFromSellCart = useGame((s) => s.removeFromSellCart);
  const clearSellCart = useGame((s) => s.clearSellCart);
  const confirmSell = useGame((s) => s.confirmSell);
  const repairItem = useGame((s) => s.repairItem);
  const startBargain = useGame((s) => s.startBargain);
  const appraiseItem = useGame((s) => s.appraiseItem);
  const closeMerchant = useGame((s) => s.closeMerchant);
  const setSellHalving = useGame((s) => s.setSellHalving);
  const barterExchange = useGame((s) => s.barterExchange);
  const searchAvailability = useGame((s) => s.searchAvailability);
  if (!merchant) return null;
  return (
    <MerchantPanelView
      merchant={merchant} party={party} money={money}
      onAddToCart={addToCart} onDecCart={decFromCart} onRemoveCart={removeFromCart} onClearCart={clearCart} onRefuse={refuseBargain} onPay={payCart}
      onAssignDist={assignDistribution} onConfirmDist={confirmDistribution}
      onSell={sellItem} onAddToSellCart={addToSellCart} onRemoveSellCart={removeFromSellCart} onClearSellCart={clearSellCart} onConfirmSell={confirmSell}
      onRepair={repairItem} onBargain={startBargain} onAppraise={appraiseItem} onClose={closeMerchant}
      onSellHalving={setSellHalving} onBarter={barterExchange} onSearchAvailability={searchAvailability}
    />
  );
}
