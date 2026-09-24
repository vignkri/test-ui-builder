import { useMemo, useState } from "react";
import type { Resource, ResourceType } from "../types";
import { TYPE_LABEL, TYPE_ORDER, fleetPower, formatClock, formatKw } from "../mqtt/derive";
import { ResourceCards, ResourceTable } from "../components/resource/ResourceTable";
import { ResourceDetail } from "../components/resource/ResourceDetail";
import { Card, KpiCard } from "../components/ui/Card";
import { Toggle } from "../components/ui/Inputs";
import type { ScreenProps } from "./types";
import "./screens.css";

export function FleetPowerKpi({ resources }: { resources: Resource[] }) {
  const f = fleetPower(resources);
  return (
    <KpiCard
      label="Fleet net power"
      tone="highlight"
      value={formatKw(f.net)}
      caption={`Import ${f.importKw.toFixed(1)} · Export ${f.exportKw.toFixed(1)} kW`}
    />
  );
}

export function StateKpis({ resources }: { resources: Resource[] }) {
  const count = (s: Resource["state"]) => resources.filter((r) => r.state === s).length;
  return (
    <>
      <KpiCard label="Available" tone="available" value={count("Available")} caption="Dispatchable · own control logic" />
      <KpiCard label="Activated" tone="activated" value={count("Activated")} caption="Holding a platform setpoint" />
      <KpiCard label="Unavailable" tone="unavailable" value={count("Unavailable")} caption="Affirmative event or Last Will" />
      <KpiCard label="Faulted" tone="faulted" value={count("Faulted")} caption="Equipment fault reported" />
    </>
  );
}

export function ResourcesScreen({
  snapshot,
  now,
  live,
  isMobile,
  selectedId,
  navigate,
  search,
}: ScreenProps & { search: string }) {
  const { resources, events, lastMessageAt } = snapshot;
  const [typeFilter, setTypeFilter] = useState<ResourceType | "all">("all");

  const counts = useMemo(() => {
    const c = new Map<ResourceType, number>();
    for (const r of resources) if (r.type) c.set(r.type, (c.get(r.type) ?? 0) + 1);
    return c;
  }, [resources]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return resources.filter((r) => (typeFilter === "all" || r.type === typeFilter) && (!q || r.id.toLowerCase().includes(q)));
  }, [resources, typeFilter, search]);

  const selected =
    resources.find((r) => r.id === selectedId) ?? (isMobile ? null : (visible[0] ?? null));
  const select = (id: string) => navigate("resources", id);
  const unsubscribed = resources.filter((r) => r.subscriptionStatus === "Unsubscribed").length;

  if (isMobile && selected) {
    return <ResourceDetail resource={selected} events={events} now={now} live={live} onBack={() => navigate("resources")} />;
  }

  const chips = (
    <div className="chip-row">
      <Toggle pressed={typeFilter === "all"} onPressedChange={() => setTypeFilter("all")} count={resources.length}>
        All
      </Toggle>
      {TYPE_ORDER.filter((t) => counts.has(t)).map((t) => (
        <Toggle key={t} pressed={typeFilter === t} onPressedChange={(p) => setTypeFilter(p ? t : "all")} count={counts.get(t)}>
          {TYPE_LABEL[t]}
        </Toggle>
      ))}
    </div>
  );

  return (
    <>
      <div className="kpi-grid">
        <StateKpis resources={resources} />
        <FleetPowerKpi resources={resources} />
      </div>

      {isMobile ? (
        <>
          {chips}
          <ResourceCards resources={visible} onSelect={select} now={now} />
        </>
      ) : (
        <div className="screen-split">
          <Card
            title={
              <span className="card-title-inline">
                Resources
                <span className="card-meta">
                  {resources.length} registered · {unsubscribed ? `${unsubscribed} unsubscribed` : "all subscribed"}
                </span>
              </span>
            }
            action={
              <span className={`card-meta ${live ? "" : "cell-faulted"}`}>
                {lastMessageAt ? `${live ? "Updated" : "Last update"} ${formatClock(lastMessageAt)}` : "No messages yet"}
                {live ? " · measurements QoS 0" : " · stale"}
              </span>
            }
          >
            <div className="card-chips">{chips}</div>
            <ResourceTable resources={visible} selectedId={selected?.id ?? null} onSelect={select} now={now} live={live} />
            <div className="table-footer">
              <span>
                <span className="legend-swatch legend-import" />
                Import (−, consuming)
              </span>
              <span>
                <span className="legend-swatch legend-export" />
                Export (+, generating)
              </span>
              <span>Headroom is measured from the current operating point, net of site limits.</span>
            </div>
          </Card>
          {selected && <ResourceDetail key={selected.id} resource={selected} events={events} now={now} live={live} />}
        </div>
      )}
    </>
  );
}
