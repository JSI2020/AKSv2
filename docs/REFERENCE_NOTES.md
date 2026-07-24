# Reference notes — next-shadcn-dashboard-starter

Cloned into `/reference/next-shadcn-dashboard-starter` (gitignored).  
**Do not copy** its Clerk auth or client-side-only RBAC. Patterns below are for tables, forms, layout, and kanban only.

---

## 1. Data table

**Stack:** TanStack Table + `nuqs` URL state + React Query for data.

**Layers:**

| Piece | Where | Role |
|---|---|---|
| Column defs | `features/*/components/*-tables/columns.tsx` | `ColumnDef<T>[]` with `meta` for filter UI (label, placeholder, variant) |
| Feature table | e.g. `product-tables/index.tsx` | Reads URL params via `useQueryStates`, fetches with `useSuspenseQuery`, builds table via `useDataTable` |
| Hook | `hooks/use-data-table.ts` | Wraps `useReactTable`; syncs page / perPage / sort / filters to the URL (`nuqs`); manual pagination/filtering/sorting |
| Presentational | `components/ui/table/data-table.tsx` | Renders header/body via `flexRender`, sticky header, horizontal scroll, pagination, optional bulk action bar |
| Toolbar | `data-table-toolbar.tsx` + faceted/date/slider filters | Driven by column `meta` |

**Pattern to copy:** feature owns columns + query wiring; shared `DataTable` is dumb. Filter/sort/page live in the URL so refresh and share work. Pin actions column with `columnPinning: { right: ['actions'] }`.

---

## 2. Form with validation

**Stack:** TanStack Form (`useAppForm` / `useFormFields` in `components/ui/tanstack-form.tsx`) + Zod schemas in `features/*/schemas/*.ts` + React Query mutations.

**Pattern (see `features/products/components/product-form.tsx`):**

1. Define a Zod schema (`productSchema`) next to a typed `ProductFormValues`.
2. `useAppForm({ defaultValues, validators: { onSubmit: schema }, onSubmit })`.
3. Field-level validators on blur where needed (`validators: { onBlur: z.string().min(2) }`).
4. Typed field helpers: `FormTextField`, `FormSelectField`, `FormTextareaField`, `FormFileUploadField`.
5. Submit calls `createMutation` / `updateMutation`; toast + `router.push` on success.

**AKS note:** our stack mandates React Hook Form + Zod (`.cursorrules`). Steal the *shape* (schema colocated with feature, typed fields, mutation on submit) — implement with RHF, not TanStack Form.

---

## 3. Sidebar layout

**Composition (`app/dashboard/layout.tsx`):**

```
KBar
  └── SidebarProvider (open state from cookie `sidebar_state`)
        ├── AppSidebar          // left rail from nav config
        └── SidebarInset
              ├── Header        // breadcrumbs / controls
              └── InfobarProvider
                    ├── {children}
                    └── InfoSidebar (right)
```

**Nav data:** `config/nav-config.ts` → `navGroups[]` with `label`, `items[]` (`title`, `url`, `icon`, `shortcut`, nested `items`, optional `access`).

**Sidebar UI:** shadcn `Sidebar` primitives (`components/ui/sidebar.tsx`) + `AppSidebar` (`components/layout/app-sidebar.tsx`) which maps `navGroups` into `SidebarGroup` / `SidebarMenu` items.

**Cmd+K:** `KBar` wraps the whole dashboard; shortcuts on nav items feed the command palette.

**AKS note:** filter nav by **server-resolved** permissions (`useCan` is UI-only). Do not adopt Clerk `access` checks as the security boundary.

---

## 4. Kanban board

**Stack:** custom `components/ui/kanban.tsx` primitives + Zustand store + column/card components.

**Data (`features/kanban/utils/store.ts`):**

- State: `columns: Record<string, Task[]>` (column id → tasks).
- Actions: `setColumns`, `addTask`.
- Demo seed: `backlog` / `inProgress` / `done`.

**Board (`features/kanban/components/kanban-board.tsx`):**

- `<Kanban value={columns} onValueChange={setColumns} getItemValue={…}>`
- Maps `Object.entries(columns)` → `<TaskColumn>`
- `<KanbanOverlay>` renders drag preview for column or card
- Drag confined with `createRestrictToContainer`

**Pieces:** `board-column.tsx` (column shell + droppable list), `task-card.tsx` (card UI).

**Pattern to copy:** column map as source of truth; board is controlled; overlay for drag ghost. Persist via our domain (production board / order statuses) — not a client-only Zustand toy in production.

---

## Spec docs present

Confirmed in `/docs`:

- `AKS_Design_And_Sizing_Unified.md`
- `AKS_Admin_Portal_Prompt.md`
- `AKS_Brand_Foundation.md`
- `AKS_Tier1_RealShop_Prompt.md`
- `AKS_Tier2_Production_Prompt.md`
