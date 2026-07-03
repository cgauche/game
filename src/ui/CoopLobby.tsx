import { useState, type ReactNode } from 'react';
import { useGame } from '../state/store';
import { CoopRoomPanel, CoopSeatList, CoopAssignList } from './CoopPanels';
import { SaveLoadModal } from './SaveLoadModal';
import { RuleDivider } from './Ornaments';
import { t } from '../i18n';

/**
 * Lobby coop — connexion par CODE DE ROOM court (relay WebSocket, spec coop v2).
 *
 * HÔTE : « Héberger » crée la room → un code à 6 caractères (et un lien d'invitation) à
 * partager. Les invités apparaissent dans la liste dès qu'ils rejoignent. L'hôte continue vers
 * l'écran d'équipe, où il attribue les EMPLACEMENTS aux joueurs — chacun remplit les siens
 * (créer / roster local / pré-tiré) ; les écrans invités REFLÈTENT le sien (snapshots).
 * INVITÉ : code + nom → connecté. Reconnexion automatique avec reprise de siège.
 *
 * Présentation (Jalon 9) : carte centrée sur la charte (même coquille que le menu principal),
 * sections en `.panel`.
 */

/** Coquille de carte centrée, partagée par les 3 états du lobby (local / invité / hôte). */
function CoopShell({
  title,
  backLabel,
  onBack,
  wide,
  children,
}: {
  title: string;
  backLabel: string;
  onBack: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="menu coop-lobby">
      <div className={`menu-card coop-card${wide ? ' wide' : ''}`}>
        <div className="coop-top">
          <button className="btn small btn-ghost" onClick={onBack}>
            {backLabel}
          </button>
        </div>
        <h1 className="coop-title">{title}</h1>
        <RuleDivider />
        {children}
      </div>
    </div>
  );
}

export function CoopLobby() {
  const setScreen = useGame((s) => s.setScreen);
  const net = useGame((s) => s.net);
  const hostStart = useGame((s) => s.netHostStart);
  const join = useGame((s) => s.netJoin);
  const leave = useGame((s) => s.netLeave);

  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState(() => new URLSearchParams(location.search).get('join')?.toUpperCase() ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loadOpen, setLoadOpen] = useState(false);

  if (net.mode === 'local') {
    return (
      <CoopShell title={t("coop.title.local")} backLabel={t("coop.back.menu")} onBack={() => { leave(); setScreen('menu'); }}>
        <label className="field coop-name">
          <span>{t("coop.name.label")}</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("coop.name.placeholder")} autoFocus />
        </label>
        <div className="coop-roles">
          <section className="panel coop-role">
            <div className="mini-title">{t("coop.host.section")}</div>
            <p className="hint">{t("coop.host.hint")}</p>
            <button
              className="btn btn-primary"
              disabled={!name.trim() || busy}
              onClick={async () => {
                setError('');
                setBusy(true);
                if (!(await hostStart(name.trim()))) setError(t("coop.host.error"));
                setBusy(false);
              }}
            >
              {t("coop.host.btn")}
            </button>
          </section>
          <section className="panel coop-role">
            <div className="mini-title">{t("coop.join.section")}</div>
            <input
              className="coop-code-input"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder={t("coop.join.placeholder")}
              maxLength={6}
            />
            <button
              className="btn btn-primary"
              disabled={!name.trim() || joinCode.trim().length !== 6 || busy}
              onClick={async () => {
                setError('');
                setBusy(true);
                const err = await join(joinCode, name.trim());
                if (err) setError(err);
                setBusy(false);
              }}
            >
              {t("coop.join.btn")}
            </button>
            {error && <p className="hint coop-error">{error}</p>}
          </section>
        </div>
      </CoopShell>
    );
  }

  if (net.mode === 'guest') {
    return (
      <CoopShell title={t("coop.title.guest")} backLabel={t("coop.back.quit")} onBack={() => { leave(); setScreen('menu'); }}>
        <section className="panel coop-role">
          <div className="mini-title">Partie {net.roomCode}</div>
          <CoopSeatList />
        </section>
        <p className="hint coop-waiting">
          {net.hostAway ? t("coop.guest.waiting.hostAway")
            : net.connection === 'reconnecting' ? t("coop.guest.waiting.reconnecting")
            : t("coop.guest.waiting.default")}
        </p>
      </CoopShell>
    );
  }

  // ── HÔTE ──
  return (
    <CoopShell title={t("coop.title.host")} backLabel={t("coop.back.quit")} onBack={() => { leave(); setScreen('menu'); }} wide>
      <section className="panel coop-role">
        <div className="mini-title">{t("coop.host.invite.section")}</div>
        <CoopRoomPanel />
      </section>
      <section className="panel coop-role">
        <div className="mini-title">{t("coop.host.players.section")}</div>
        <CoopSeatList />
      </section>
      <section className="panel coop-role">
        <div className="mini-title">{t("coop.host.assign.section")}</div>
        <CoopAssignList />
      </section>
      {/* Charger en session : le salon survit (`applyLoadedSave` préserve `net`), l'invité
          suit au snapshot — c'est LE chemin pour reprendre une partie coop sauvegardée. */}
      <div className="coop-actions">
        <button className="btn" onClick={() => setLoadOpen(true)}>{t("coop.host.loadGame")}</button>
        <button className="btn btn-primary" onClick={() => setScreen('party')}>
          {t("coop.host.compose")}
        </button>
      </div>
      {loadOpen && <SaveLoadModal mode="load" onClose={() => setLoadOpen(false)} />}
    </CoopShell>
  );
}
