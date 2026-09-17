# Weavemancer — Live fleet map

A TypeScript + React frontend implementing the "Weavemancer" design system
from Figma (Radix-based 12-step color scales, Inter type scale, 4px space
scale, medium radius) as a fleet-management dashboard for distributed
energy resources (EV chargers and heat pumps).

## Features

- KPI summary row (resource count, needs-attention, fault, live load)
- Searchable, filterable resource table with status/type badges
- Resource detail panel with a power-limit control (validated range,
  `SetPowerLimit` action) and a recent-activity/topic log
- Design tokens (`src/styles/tokens.css`) mirror the Figma foundations
  page 1:1 — slate/green/blue/amber/red color scales, type scale, spacing,
  and radius scale

## Development

```sh
npm install
npm run dev      # start the dev server
npm run lint      # oxlint
npm run build     # type-check + production build
```
