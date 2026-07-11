import { useState } from 'react';
import type { CargoCarrier } from '../engine/cargo';
import { carriersColocated, carrierFreeEnc } from '../engine/cargo';

/**
 * SURFACE DE TRANSFERT de cargaison entre porteurs CO-LOCALISÉS (#327, décision 9) — composée dans les
 * écrans EXISTANTS (marché terrestre bât↔véhicule, dossier navire navire↔porteur terrestre au port). Route
 * sur l'action store `moveCargo` (→ `transferCargo` du tronc). Aucune 2ᵉ modale : un simple formulaire
 * source→cible→lot→quantité, filtré aux porteurs au même endroit (`carriersColocated`). Ne s'affiche que
 * s'il y a au moins deux porteurs et du vrac à déplacer.
 */
export function CargoTransferPanel({ carriers, onMove, labelOf, disabled }: {
  carriers: CargoCarrier[];
  onMove: (fromId: string, toId: string, cargoId: string, enc: number) => void;
  labelOf: (cargoId: string) => string;
  disabled?: boolean;
}) {
  const [rawFrom, setFrom] = useState('');
  const [rawTo, setTo] = useState('');
  const [rawCargo, setCargo] = useState('');
  const [rawEnc, setEnc] = useState('');

  const sources = carriers.filter((c) => c.cargo.length > 0);
  if (sources.length === 0 || carriers.length < 2) return null;

  const from = sources.find((c) => c.id === rawFrom) ?? sources[0];
  const dests = carriers.filter((c) => c.id !== from.id && carriersColocated(from, c));
  const to = dests.find((c) => c.id === rawTo) ?? dests[0];
  const lot = from.cargo.find((l) => l.cargoId === rawCargo) ?? from.cargo[0];
  const maxEnc = lot && to ? Math.min(lot.enc, carrierFreeEnc(to)) : 0;
  const amount = rawEnc === '' ? maxEnc : Math.max(0, Math.min(Math.floor(Number(rawEnc) || 0), maxEnc));

  return (
    <section className="panel port-section">
      <h3>Transférer une cargaison</h3>
      {dests.length === 0 ? (
        <p className="port-hint">Aucun autre porteur co-localisé pour recevoir la cargaison.</p>
      ) : (
        <div className="bar cargo-transfer">
          <label>De
            <select value={from.id} disabled={disabled} onChange={(e) => setFrom(e.target.value)}>
              {sources.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label>Lot
            <select value={lot?.cargoId ?? ''} disabled={disabled} onChange={(e) => setCargo(e.target.value)}>
              {from.cargo.map((l, i) => <option key={i} value={l.cargoId}>{labelOf(l.cargoId)} ({l.enc} Enc)</option>)}
            </select>
          </label>
          <label>Vers
            <select value={to?.id ?? ''} disabled={disabled} onChange={(e) => setTo(e.target.value)}>
              {dests.map((c) => <option key={c.id} value={c.id}>{c.label} — libre {carrierFreeEnc(c)} Enc</option>)}
            </select>
          </label>
          <label>Enc
            <input type="number" min={0} max={maxEnc} value={rawEnc} placeholder={String(maxEnc)} disabled={disabled}
              onChange={(e) => setEnc(e.target.value)} />
          </label>
          <button type="button" className="btn small" disabled={disabled || !to || !lot || amount <= 0}
            onClick={() => { if (to && lot && amount > 0) { onMove(from.id, to.id, lot.cargoId, amount); setEnc(''); } }}>
            Transférer
          </button>
        </div>
      )}
    </section>
  );
}
