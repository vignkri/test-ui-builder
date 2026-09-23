# DER Monitor — fleet console

A TypeScript + React front end for the [GridHub Connect](https://connect.gridhub.ai/distributed-resources/welcome)
distributed-resources API, styled from the OpusFivePFiveMancer Figma file ("DER Monitor"): the
shadcn/ui-shaped theme tokens, text styles and component library on `Foundations & Spec`, with
Light and Dark themes.

## Design system

- `src/styles/tokens.css` — the Figma theme variables one-to-one (`--background`, `--primary`,
  `--status-{available,activated,unavailable,faulted}[-muted|-foreground]`, `--type-*`, `--flow-*`,
  radius and spacing). `.dark` on `<html>` switches to the Dark mode values; the sidebar has a toggle.
- `src/components/ui/` — the component library, one file per Figma page: Button, Badge
  (StatusBadge, TypeBadge, FreshnessBadge, CommandBadge), Card (KpiCard, MetricTile), Inputs
  (Input, ToggleGroup), Feedback (Alert, Progress), Sidebar (SidebarMenuButton, SidebarStatus) and
  Data display (PowerBar, TimelineItem, KeyValue). Icons are lucide-react, as the design specifies.
- The design is written for the v2 API; this app still speaks v1. `src/mqtt/derive.ts` maps v1
  states and acceptance codes onto the design's four state tones, shows power with the generator
  convention (export +, import −), and flags quiet resources as "stale" rather than Unavailable.

Everything the UI shows is derived, in the browser, from MQTT traffic. There is no REST layer
and no mock data: an in-page client subscribes to the customer's topic tree, a pure reducer
folds every message into fleet state, and React renders that state.

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
document one, so the URL is configuration. Credentials in the spec are per-resource (device
side); a fleet console needs an account allowed to subscribe to `{zone}/{customer}/v1/#`.

`npm run build` type-checks and bundles; `npm run lint` runs oxlint. `mqtt.js` is code-split and
only downloaded when a URL is configured.

## How the data flows

```
broker ──wss──▶ MqttConnection ──▶ FleetStore.apply(topic, payload) ──▶ React (useSyncExternalStore)
   ▲                                                                           │
   └──────────────── publish(activation) ◀── ResourceDetail buttons ◀──────────┘
```

- `src/mqtt/topics.ts` — parses/builds `{DK1|DK2}/{customer}/v1/{channel}/{resourceId}` and the
  `…/v1/bulk/{channel}` variants.
- `src/mqtt/messages.ts` — payload types with the spec's exact field names: snake_case for EV
  chargers (`register`, `power`, `status`, `activation`, `acknowledgement`, `update`), camelCase
  for heat pumps (`register`, `measurement`, `event`, `activation`), plus runtime type guards.
- `src/mqtt/store.ts` — the reducer. It creates a resource the first time any message names it,
  keeps a 20-sample power history, tracks the current activation and last acknowledgement, and
  derives **Pending** (activation delivered, no ack yet — not a spec value; heat pumps never ack)
  and **round trip** (`executed_at − sent_at`).
- `src/mqtt/connection.ts` — mqtt.js over WebSocket. Publishes go to the broker only; the store is
  updated by the broker's echo on our own subscription, so the UI never shows an activation the
  broker did not accept for delivery. Publishing is refused unless the connection is live.
- `src/mqtt/derive.ts` — display helpers and the health bucket (`ok`, `needs-attention`, `fault`,
  `offline`) used by the map, feed and Faults view.

Late joiners only see a resource once it emits something; registration fields fill in on its
next `register`/`update`. The spec does not mention retained messages, so the client assumes none.

## Connection states

The header badge and a banner reflect `connecting → live → reconnecting`, or `disconnected` when
the URL is unset or the broker never answered. Anything but *live* greys the workspace (last
known state stays readable) and disables activation controls.
