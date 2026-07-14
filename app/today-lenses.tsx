import { todayInterfaceOptions, type TodayInterfaceId } from "@/lib/today-interface-registry";
import type { TodayFocus, TodayInterfaceContract, TodaySignal, TodaySignalKind, TodayStat } from "@/app/today-ui/contract";

export type { TodayFocus, TodayInterfaceContract, TodaySignal, TodaySignalKind, TodayStat } from "@/app/today-ui/contract";

const focusOptions: Array<{ value: TodayFocus; label: string }> = [
  { value: "overview", label: "Chief" },
  { value: "errands", label: "Errands" },
  { value: "household", label: "Household" },
  { value: "quiet", label: "Quiet" }
];

const kinds: TodaySignalKind[] = ["do", "buy", "take", "watch", "help"];

function kindLabel(kind: TodaySignalKind) {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

function SignalAction({ signal, onOpen }: { signal: TodaySignal; onOpen: (signal: TodaySignal) => void }) {
  return (
    <button className="today-signal-row" onClick={() => onOpen(signal)}>
      <span className={`today-signal-mark kind-${signal.kind}`}>{kindLabel(signal.kind)}</span>
      <span className="today-signal-copy">
        <strong>{signal.title}</strong>
        <small>{signal.detail}</small>
      </span>
      <span className="today-signal-action">{signal.actionLabel}</span>
    </button>
  );
}

function LensDetail({ kind, signals, onOpen }: { kind: TodaySignalKind; signals: TodaySignal[]; onOpen: (signal: TodaySignal) => void }) {
  const matching = signals.filter((signal) => signal.kind === kind);
  return (
    <section className={`today-lens-detail detail-${kind}`}>
      <div className="today-lens-detail-head">
        <span className={`today-detail-dot kind-${kind}`} />
        <div>
          <span>{kindLabel(kind)}</span>
          <h3>{matching.length ? matching[0].title : `Nothing in ${kindLabel(kind).toLowerCase()} needs attention.`}</h3>
        </div>
      </div>
      <div className="today-detail-actions">
        {matching.slice(0, 4).map((signal) => <SignalAction signal={signal} onOpen={onOpen} key={signal.id} />)}
        {!matching.length ? <p className="today-lens-empty">This area is clear right now.</p> : null}
      </div>
    </section>
  );
}

type TodayLensesProps = TodayInterfaceContract;

export function TodayLenses({
  lens,
  focus,
  signals,
  selectedKind,
  briefTitle,
  briefText,
  stats,
  onLensChange,
  onFocusChange,
  onKindChange,
  onOpenSignal
}: TodayLensesProps) {
  const kindCounts = Object.fromEntries(kinds.map((kind) => [kind, signals.filter((signal) => signal.kind === kind).length])) as Record<TodaySignalKind, number>;
  const selectedSignal = signals.find((signal) => signal.kind === selectedKind) ?? signals[0];

  return (
    <div className={`today-command today-lens-${lens}`}>
      <div className="today-command-toolbar">
        <label className="today-mode-picker">
          <span>View</span>
          <select value={lens} onChange={(event) => onLensChange(event.target.value as TodayInterfaceId)}>
            {todayInterfaceOptions.map((option) => <option key={option.id} value={option.id}>{option.shortLabel}</option>)}
          </select>
        </label>

        <div className="today-focus-switcher" aria-label="Today focus">
          {focusOptions.map((option) => (
            <button className={focus === option.value ? "active" : ""} key={option.value} onClick={() => onFocusChange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {lens === "briefing" ? (
        <>
          <section className="today-desk">
            <div className="today-memo">
              <span className="today-eyebrow">Daily brief</span>
              <h2>{briefTitle}</h2>
              <p>{briefText}</p>
              <div className="today-brief-actions">
                {signals.slice(0, 5).map((signal) => <SignalAction signal={signal} onOpen={onOpenSignal} key={signal.id} />)}
                {!signals.length ? <p className="today-lens-empty">Nothing needs attention right now.</p> : null}
              </div>
            </div>
            <div className="today-instruments">
              {stats.map((stat) => (
                <div className={`today-instrument ${stat.tone ?? "calm"}`} key={stat.label}>
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {lens === "compass" ? (
        <>
          <section className="today-compass" aria-label="Command Compass">
            <div className="today-compass-ring" />
            {(["do", "buy", "take", "watch"] as TodaySignalKind[]).map((kind) => (
              <button className={`today-compass-zone zone-${kind} ${selectedKind === kind ? "active" : ""}`} key={kind} onClick={() => onKindChange(kind)}>
                <strong>{kindCounts[kind]}</strong><span>{kindLabel(kind)}</span>
              </button>
            ))}
            <button className={`today-compass-center ${selectedKind === "help" ? "active" : ""}`} onClick={() => onKindChange("help")}>
              <span>Now</span>
              <strong>{signals.length}</strong>
              <small>live signals</small>
            </button>
          </section>
          <LensDetail kind={selectedKind} signals={signals} onOpen={onOpenSignal} />
        </>
      ) : null}

      {lens === "radar" ? (
        <>
          <section className="today-radar" aria-label="Household Radar">
            <div className="today-radar-grid" />
            <div className="today-radar-center"><strong>{signals.length}</strong><span>signals</span></div>
            {signals.slice(0, 7).map((signal, index) => (
              <button className={`today-radar-ping ping-${index} kind-${signal.kind} ${selectedSignal?.id === signal.id ? "active" : ""}`} key={signal.id} onClick={() => onKindChange(signal.kind)} aria-label={signal.title}>
                {kindLabel(signal.kind)}
              </button>
            ))}
          </section>
          <LensDetail kind={selectedKind} signals={signals} onOpen={onOpenSignal} />
        </>
      ) : null}

      {lens === "verb-universe" ? (
        <>
          <section className="today-universe" aria-label="Verb Universe">
            <div className="today-universe-orbit" />
            {kinds.map((kind) => (
              <button className={`today-universe-verb verb-${kind} ${selectedKind === kind ? "active" : ""}`} key={kind} onClick={() => onKindChange(kind)}>
                <strong>{kindLabel(kind)}</strong><small>{kindCounts[kind]}</small>
              </button>
            ))}
            <div className="today-universe-core"><strong>{kindLabel(selectedKind)}</strong><span>{selectedSignal?.detail ?? "Clear right now."}</span></div>
          </section>
          <LensDetail kind={selectedKind} signals={signals} onOpen={onOpenSignal} />
        </>
      ) : null}

      {lens === "verb-portals" ? (
        <>
          <section className="today-portals" aria-label="Verb Portals">
            {kinds.map((kind) => (
              <button className={`today-portal portal-${kind} ${selectedKind === kind ? "active" : ""}`} key={kind} onClick={() => onKindChange(kind)}>
                <span>{kindLabel(kind)}</span>
                <strong>{kindCounts[kind]}</strong>
                <small>{signals.find((signal) => signal.kind === kind)?.title ?? "Clear"}</small>
              </button>
            ))}
          </section>
          <LensDetail kind={selectedKind} signals={signals} onOpen={onOpenSignal} />
        </>
      ) : null}
    </div>
  );
}
