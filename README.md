# DER Monitor — fleet console

A TypeScript + React console for the Hybrid Greentech / gridhub
[Distributed Energy Resources **v2** API](https://connect.gridhub.ai/distributed-resources/welcome),
built from the OpusFivePFiveMancer Figma file: the `Resource Monitor` screens, on the
shadcn/ui-shaped tokens and component library from `Foundations & Spec`, in Light and Dark.

Everything the UI shows is derived, in the browser, from MQTT traffic. There is no REST layer
and no mock data: an in-page client subscribes to the customer's topic tree, a pure reducer
folds every message into fleet state, and React renders that state.

## Screens

Hash-routed, so every screen and selection is linkable (`#/resources/bess-site-c-01`).

| Screen              | What it shows                                                                       |
| ------------------- | ----------------------------------------------------------------------------------- |
| 01 Resources        | State KPIs, fleet net power, per-resource table, and a detail panel per resource type |
| 02 Overview         | Summed headroom and battery energy, flexibility by type, market bounds, resource health |
| 03 Activations      | Setpoint / Release log joined to acknowledgements, latency vs bound, raw payloads    |
| 04 Events           | State transitions, faults, Last Will, and the three liveness layers                 |
| 05 Acknowledgements | Counts per acceptance value, p50/p95 latency per resource, refusals with reasons     |
| 06 Registration     | Declared envelope, granularity and configuration (PV compass), v1 → v2 migration     |

The detail panel changes with the resource type: charging session (EV), compressor and heater
stages (heat pump), state of charge and configuration (battery), curtailment and module groups
(PV), and the fault or Last Will when a resource is Faulted or Unavailable. States from the
design are covered too: type filter, broker disconnected (greyed, "Retry now"), the Release
confirmation that sets Release apart from "Setpoint 0 kW", an empty namespace, and a mobile
layout with a bottom tab bar below 900 px.

## Running

```sh
npm install
cp .env.example .env   # then fill in the broker details
npm run dev
```

| Variable                     | Purpose                                                                 |
| ---------------------------- | ----------------------------------------------------------------------- |
| `VITE_MQTT_URL`              | MQTT-over-WebSocket endpoint (`wss://…`). Unset → the app shows *Not connected*. |
| `VITE_MQTT_USERNAME/PASSWORD`| Broker credentials.                                                     |
| `VITE_MQTT_CUSTOMER`         | The `{customerName}` topic segment (default `acme-flex`).               |
| `VITE_MQTT_PROTOCOL_VERSION` | `4` (MQTT 3.1.1, default) or `5`.                                       |

The spec publishes the sandbox broker as `aggregator.gridhub.dev:8883` (MQTTS). Browsers cannot
open raw TLS sockets, so the client needs the broker's **WebSocket** listener; the spec does not
document one, so the URL is configuration. Credentials in the spec are per-resource; a fleet
console needs an account allowed to subscribe to `{zone}/{customer}/v2/#` and to publish on
`…/v2/activation/{resourceId}`.

`npm run build` type-checks and bundles; `npm run lint` runs oxlint. `mqtt.js` is code-split and
only downloaded when a URL is configured.

## How the data flows

```
broker ──wss──▶ MqttConnection ──▶ FleetStore.apply(topic, payload) ──▶ React (useSyncExternalStore)
   ▲                                                                           │
   └──────────── publish Setpoint / Release ◀── detail panel, Release dialog ◀──┘
```

- `src/mqtt/topics.ts` — `{DK1|DK2}/{customer}/v2/{channel}/{resourceId}` for the six channels
  (`register`, `update`, `measurements`, `events`, `activation`, `acknowledgement`). v1 topics are
  also subscribed, but only noted, so Registration can list resources still to migrate.
- `src/mqtt/messages.ts` — v2 payload types with the spec's field names (flat camelCase) and
  runtime guards. Seven resource types, four resource states, the eight acceptance values.
- `src/mqtt/store.ts` — the reducer. Registration sets the envelope (`maxImportKw`,
  `maxExportKw`, `controlGranularity`, `configuration`); `update` merges fields but replaces
  `configuration` whole. Each measurement is its own message. Events keep the previous state, so
  transitions and Last Will (`ConnectionLost` with a null `resourceTimestamp`) are explicit.
  Acknowledgements join their activation by `activationId`; latency is `executedAt −
  serverTimestamp`. QoS 1 redeliveries of the same `messageId` are ignored.
- `src/mqtt/fleet.ts` — `sendSetpoint` (signed kW, always with `endsAt`) and `sendRelease`.
  Publishes go to the broker only; the store updates from the broker's echo, so the UI never shows
  a command the broker did not take. Publishing is refused unless the connection is live.
- `src/mqtt/derive.ts` — tones, freshness, market bounds, nearest reachable setpoint, formatting.

### Rules the console follows from the spec

- **Generator convention.** Export is positive, import negative; bars grow right in sage for
  export and left in sky for import.
- **Release ≠ setpoint 0.** Release is a separate action with a confirmation that offers both.
- **Headroom is sampled.** `availablePowerUp/Down` are shown and summed as published, never
  recomputed from ratings.
- **Silence is not state.** Unavailable comes only from an event or the Last Will. A resource
  quiet for longer than the slowest market data frequency (1 min) is flagged *stale* instead.
- **Market enrolment is platform data.** It is not on the wire, so acknowledgement latency is
  judged against the 2 s bound shared by fcr, fcr-d, fcr-n and afrr.

Late joiners only see a resource once it publishes; its envelope fills in on the next
`register`/`update`. The spec marks every channel as not retained, so the client assumes none.

## Design system

- `src/styles/tokens.css` — the Figma theme variables one-to-one (`--background`, `--primary`,
  `--status-*`, `--type-*`, `--flow-*`, radius and spacing). `.dark` on `<html>` switches to the
  Dark mode values; the sidebar has a toggle.
- `src/components/ui/` — the component library, one file per Figma page: Button, Badge
  (Status, Type, Severity, EventKind, Command, Freshness), Card (KpiCard, MetricTile), Inputs
  (Input, Toggle, ToggleGroup), Feedback (Alert, Progress, Dialog), Sidebar, Table, and Data
  display (PowerBar, EnvelopeTrack, TimelineItem, KeyValue, CodeBlock). Icons are lucide-react.
