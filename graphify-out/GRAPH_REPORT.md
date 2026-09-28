# Graph Report - bendahara  (2026-09-27)

## Corpus Check
- Corpus is ~22,233 words - fits in a single context window. You may not need a graph.

## Summary
- 350 nodes · 629 edges · 19 communities (12 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Kas and Data Model
- Shared UI and Auth
- Runtime Dependencies
- Build Dependencies
- Routing and API
- Form Components
- Ledger and Dashboard
- UI Configuration
- TypeScript Configuration
- Kas and Period Routes
- Project Overview
- Authentication Design
- Finance Workflow
- Archived Period Policy
- PostgreSQL Setup
- Legacy Counter State

## God Nodes (most connected - your core abstractions)
1. `Kas()` - 14 edges
2. `compilerOptions` - 12 edges
3. `Route` - 11 edges
4. `FileRoutesByPath` - 9 edges
5. `listActivityLogs` - 8 edges
6. `ensureSession` - 8 edges
7. `auth` - 8 edges
8. `Route` - 8 edges
9. `getUserKasStatus` - 7 edges
10. `listPeriodes` - 7 edges

## Surprising Connections (you probably didn't know these)
- `Bun` --semantically_similar_to--> `Bun`  [INFERRED] [semantically similar]
  AGENTS.md → README.md
- `CreateCashInput` --references--> `CashMethod`  [EXTRACTED]
  src/lib/kas.functions.ts → src/db/kas-schema.ts
- `UpdateCashInput` --references--> `CashMethod`  [EXTRACTED]
  src/lib/kas.functions.ts → src/db/kas-schema.ts
- `UpdateLedgerInput` --references--> `LedgerMethod`  [EXTRACTED]
  src/lib/ledger.functions.ts → src/db/kas-schema.ts
- `Kas()` --calls--> `listActivityLogs`  [EXTRACTED]
  src/routes/kas.tsx → src/lib/activity.functions.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Period-based finance workflow** — agents_finance_dashboard, agents_kas, agents_ledger, agents_periode [EXTRACTED 1.00]

## Communities (19 total, 4 thin omitted)

### Community 0 - "Kas and Data Model"
Cohesion: 0.07
Nodes (48): [chunk], NOTE: the chunk exports the generator under a minified alias (`o`)., account, accountRelations, session, sessionRelations, user, userRelations (+40 more)

### Community 1 - "Shared UI and Auth"
Cohesion: 0.10
Nodes (42): ArchiveBadge(), Badge(), BadgeTone, badgeTones, btnPrimary, btnQuiet, btnSecondary, Card() (+34 more)

### Community 2 - "Runtime Dependencies"
Cohesion: 0.05
Nodes (39): @base-ui/react, better-auth, @better-auth/drizzle-adapter, class-variance-authority, cn, drizzle-orm, elysia, @elysia/eden (+31 more)

### Community 3 - "Build Dependencies"
Cohesion: 0.06
Nodes (34): @better-auth/cli, @better-auth/core, drizzle-kit, devDependencies, @better-auth/cli, @better-auth/core, drizzle-kit, tailwindcss (+26 more)

### Community 4 - "Routing and API"
Cohesion: 0.09
Nodes (24): getRouter(), app, Route, getTreaty, Route, Route, Route, ApiAuthSplatRoute (+16 more)

### Community 5 - "Form Components"
Cohesion: 0.11
Nodes (13): LoginForm(), Button(), buttonVariants, Field(), FieldDescription(), FieldGroup(), FieldLabel(), FieldSeparator() (+5 more)

### Community 6 - "Ledger and Dashboard"
Cohesion: 0.15
Nodes (20): LedgerMethod, LedgerTipe, createLedgerEntry, CreateLedgerInput, DashboardData, DashboardFilter, getDashboardData, LedgerFilter (+12 more)

### Community 7 - "UI Configuration"
Cohesion: 0.09
Nodes (21): aliases, components, hooks, lib, ui, utils, iconLibrary, menuAccent (+13 more)

### Community 8 - "TypeScript Configuration"
Cohesion: 0.10
Nodes (20): **/*, bun, dist, node_modules, .tanstack, vite/client, compilerOptions, allowJs (+12 more)

### Community 9 - "Kas and Period Routes"
Cohesion: 0.16
Nodes (20): assertValidCashInput(), createCashEntry, ensureActivePeriode(), getCashStats, listCashEntries, listUsers, requireBendahara(), requireSession() (+12 more)

### Community 10 - "Project Overview"
Cohesion: 0.29
Nodes (7): Bun, React, TanStack Start, Vite, Bendahara project, Build-from-scratch guide, Bun

### Community 11 - "Authentication Design"
Cohesion: 0.33
Nodes (6): Archived period read-only policy, FIFO allocation, Finance dashboard, Kas (iuran), Ledger, Periode

## Knowledge Gaps
- **132 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+127 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 151 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Runtime Dependencies` to `Build Dependencies`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Why does `authClient` connect `Form Components` to `Shared UI and Auth`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _132 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Kas and Data Model` be split into smaller, more focused modules?**
  _Cohesion score 0.06957047791893527 - nodes in this community are weakly interconnected._
- **Should `Shared UI and Auth` be split into smaller, more focused modules?**
  _Cohesion score 0.09954751131221719 - nodes in this community are weakly interconnected._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `Build Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._