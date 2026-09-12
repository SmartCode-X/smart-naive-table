<div align="center">

# smart-naive-table

A columns-driven table component for **Vue 3 + Naive UI**<br>
Write `columns`, plug in a `fetcher` — the search form, pagination, dict translation and column settings are generated for you

[![npm](https://img.shields.io/npm/v/smart-naive-table?color=18a058)](https://www.npmjs.com/package/smart-naive-table)
[![license](https://img.shields.io/github/license/SmartCode-X/smart-naive-table?color=18a058)](./LICENSE)

[简体中文](./README.md) | English

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-dark.png">
  <img alt="smart-naive-table screenshot" src="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-light.png">
</picture>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#recipes">Recipes</a> ·
  <a href="#global-defaults--i18n">i18n</a> ·
  <a href="#api">API</a>
</p>

## Features

- **Columns drive everything**: add `search` to a column and it becomes a search field; add `options` and it translates cells and feeds the select — one declaration, used everywhere
- **One function for the backend**: `fetcher` receives `{ page, pageSize, ...filters }` and returns `{ items, total }`
- **Toolbar out of the box**: refresh, density toggle, column settings (show / hide, drag to reorder, pin left / right), remembered per table
- **Follows your Naive theme**: light / dark and locale come from `<n-config-provider>`
- **Details handled**: race-guarded requests, empty params stripped, fixed-column width fallback, deduped async dicts
- **Lightweight**: the only runtime dependency is `sortablejs` (loaded only when row dragging is on); ESM with full TypeScript types

## Install

```bash
npm i smart-naive-table
```

Requires `vue >= 3.3` and `naive-ui >= 2.34` in your project.

## Quick start

```vue
<script setup lang="ts">
import { SmartTable, type SmartTableColumn, type SmartTableFetcher } from 'smart-naive-table'

interface User {
  id: number
  account: string
  name: string
  status: number
  createTime: string
}

// ① Columns: `search` creates a search field; `options` + `tag` turn status values into colored tags
const columns: SmartTableColumn<User>[] = [
  { type: 'index' },
  { key: 'account', title: 'Account', search: true },
  { key: 'name', title: 'Name', search: true },
  {
    key: 'status',
    title: 'Status',
    search: true,
    tag: true,
    options: [
      { label: 'Active', value: 1, tagType: 'success' },
      { label: 'Resigned', value: 2, tagType: 'error' },
    ],
  },
  { key: 'createTime', title: 'Created', format: 'datetime' },
]

// ② Backend: map your API response to { items, total }
const fetcher: SmartTableFetcher<User> = async ({ page, pageSize, ...query }) => {
  const res = await getUserPage({ current: page, size: pageSize, ...query }) // your API here
  return { items: res.records, total: res.total }
}
</script>

<template>
  <!-- ③ Render; storage-key remembers the user's column settings -->
  <SmartTable :columns="columns" :fetcher="fetcher" storage-key="user-list" />
</template>
```

That gives you a complete list page:

- **Search area**: "Account" and "Name" inputs, a "Status" select (options from `options`), plus Search / Reset buttons
- **Table**: row numbers, status tags, formatted time, pagination at the bottom
- **Toolbar**: refresh, density toggle, column settings

When you click Search, `fetcher` receives (empty values already stripped):

```js
{ page: 1, pageSize: 10, account: 'user01', status: 1 }
```

> **Tip**: render SmartTable inside `<n-config-provider>` — theme and locale follow it. The full code behind the screenshot is in [playground/DemoBasic.vue](./playground/DemoBasic.vue).

## Recipes

### Search fields

```ts
{ key: 'name', title: 'Name', search: true }                             // input
{ key: 'status', title: 'Status', options: statusOptions, search: true } // has options → select
{ key: 'age', title: 'Age', search: { type: 'number' } }                 // pick the control type
{ key: 'keyword', title: 'Keyword', hideInTable: true, search: true }    // search-only, not a column

// Date range, sent as createRange → fetcher receives createRange: ['2024-01-01', '2024-01-31']
{ key: 'createTime', title: 'Created', search: { type: 'daterange', key: 'createRange' } }
```

Control types: `input` (default), `number`, `select`, `date`, `daterange`, `switch`; use `search.render` for a fully custom control. All fields in [SearchConfig](#searchconfig).

Search area layout:

```vue
<SmartTable :search="{ collapsible: true, collapsedRows: 1 }" /> <!-- collapse beyond 1 row, with expand / collapse -->
<SmartTable :search="{ layout: 'inline' }" />                    <!-- no card, single wrapping row for narrow panes -->
<SmartTable :search="false" />                                   <!-- no search area -->
```

### Dicts, tags and formats

```ts
import type { SmartTableOption } from 'smart-naive-table'

const statusOptions: SmartTableOption[] = [
  { label: 'Active', value: 1, tagType: 'success' },
  { label: 'On leave', value: 2, tagType: 'warning' },
  { label: 'Resigned', value: 3, tagType: 'error' },
]

{ key: 'status', title: 'Status', options: statusOptions, tag: true }       // colored tag
{ key: 'deptId', title: 'Department', options: () => api.getDeptOptions() } // async dict: loading + dedup built in
{ key: 'salary', title: 'Salary', format: 'money' }                         // 6,000.00
{ key: 'birthday', title: 'Birthday', format: 'date' }                      // 2024-01-01
{ key: 'score', title: 'Score', format: (v) => `${v} pts` }                 // custom
```

`options` accepts a static array, a `ref`, or an async function; reload async dicts with the instance method `reloadOptions()`.

### Actions column and custom cells

```ts
import { h } from 'vue'
import { NButton } from 'naive-ui'

{
  key: 'actions',
  title: 'Actions',
  width: 120,
  fixed: 'right',
  hideInSetting: true, // not listed in column settings
  render: (row) => h(NButton, { text: true, type: 'primary', onClick: () => edit(row) }, () => 'Edit'),
}
```

Or use a slot instead of a `render` function:

```vue
<SmartTable :columns="columns" :fetcher="fetcher">
  <template #cell-name="{ row }">
    <a @click="open(row)">{{ row.name }}</a>
  </template>
</SmartTable>
```

Cell priority: `render` → `#cell-{key}` slot → `options` translation → `format` → raw value.

### Column settings

![Column settings](https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/column-settings.png)

Open it from the rightmost toolbar icon: toggle visibility, drag to reorder, pin left / right.

- With `storage-key`, settings are saved to localStorage and survive reloads
- When column definitions change, saved settings merge safely: removed columns are dropped, new ones are inserted at their declared position
- `hide: true` starts hidden (can be re-enabled in the panel); `hideInSetting: true` keeps a column out of the panel

### More scenarios

| Scenario | How |
|---|---|
| Server-side sorting | `sorter: true` on a column; `fetcher` receives `sortField` and `sortOrder` (`'asc'` / `'desc'`) |
| External filters | `:params="{ deptId }"`; changes go back to page 1 and reload (e.g. a department tree) |
| Static data | pass `:data="list"` without `fetcher` for client-side pagination; filter yourself on `@search` |
| Tree table | static rows with a `children` field, plus `row-key` |
| Expandable rows | special column `{ type: 'expand', renderExpand: (row) => ... }` |
| Multi-select | special column `{ type: 'selection' }` + `v-model:checked-row-keys` |
| Master-detail highlight | `:active-row-key="currentId"` + `@row-click` |
| Row drag-to-reorder | `row-draggable` + `@row-drag-sort`; the table reorders, you persist via your API |
| Column resize | `resizable: true` on a column |
| Virtual scroll | `virtual-scroll` + `max-height` |
| Summary row | `:summary="(pageData) => ..."` |
| Other table props | put them on SmartTable; they are forwarded to `n-data-table` (e.g. `striped`, `bordered`) |

### Calling table methods

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { SmartTableInst } from 'smart-naive-table'

const tableRef = ref<SmartTableInst<User>>()

// Call wherever needed:
// tableRef.value?.refresh()  reload the current page (e.g. after editing)
// tableRef.value?.search()   back to page 1 (e.g. after creating)
// tableRef.value?.reset()    clear filters and reload
</script>

<template>
  <SmartTable ref="tableRef" :columns="columns" :fetcher="fetcher" />
</template>
```

### Create / edit / delete dialogs

`useTableCrud` manages the dialog's open / submit / delete state; the dialog and form are your own `n-modal` + `n-form`:

```ts
import { useTableCrud } from 'smart-naive-table'

const crud = useTableCrud({
  form: () => ({ name: '', email: '' }), // empty form for "create"
  create: (form) => api.create(form),
  update: (form, row: User) => api.update(row.id, form),
  remove: (row: User) => api.remove(row.id),
  onSuccess: () => tableRef.value?.refresh(),
})
```

```vue
<!-- Open: crud.openCreate() / crud.openEdit(row); delete: crud.removeRow(row) -->
<n-modal v-model:show="crud.visible.value" preset="card" :title="crud.mode.value === 'create' ? 'Create' : 'Edit'">
  <n-form :model="crud.model.value">
    <n-form-item label="Name"><n-input v-model:value="crud.model.value.name" /></n-form-item>
  </n-form>
  <template #footer>
    <n-button type="primary" :loading="crud.submitting.value" @click="crud.submit()">Save</n-button>
  </template>
</n-modal>
```

On success `crud.submit()` closes the dialog and calls `onSuccess`. Full example: [playground/DemoCrud.vue](./playground/DemoCrud.vue).

## Global defaults & i18n

`provide` defaults once in your entry file and every table inherits them:

```ts
// main.ts
import { computed, createApp } from 'vue'
import { SMART_TABLE_DEFAULTS, createSmartTableDefaults } from 'smart-naive-table'
import App from './App.vue'

const app = createApp(App)
const t = i18n.global.t // your i18n function, e.g. vue-i18n

app.provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    align: 'left',
    pageSizes: [10, 20, 50, 100],
    emptyText: '-',
    // a ref / computed makes labels follow the locale — no :labels needed on each page
    labels: computed(() => ({ search: t('common.search'), reset: t('common.reset') /* ... */ })),
  }),
)

app.mount('#app')
```

- **Built-in text** is English; override any of `search`, `reset`, `refresh`, `density`, `densityComfortable`, `densityCompact`, `columnSettings`, `columnSettingsReset`, `fixedLeft`, `fixedRight`, `fixedNone`, `expand`, `collapse` via `labels`
- **Locale switching**: pass `labels` as a `computed`, and write column `title` / option `label` as functions `() => t('xxx')` — they update instantly
- **Precedence**: prop on the table / value on the column > global default > built-in default
- Input placeholders and date panels come from Naive UI's own locale — set `:locale` / `:date-locale` on `<n-config-provider>`
- All fields in [Global default fields](#global-default-fields)

## API

### Column

Data columns accept every Naive UI column prop (`width`, `minWidth`, `fixed`, `align`, `ellipsis`, `sorter`, `resizable`, ...), plus:

| Field | Type | Description |
|---|---|---|
| `key` | `string` | **Required**. Row field; also the search param name and slot name |
| `title` | `string \| () => VNodeChild` | Column title; the function form follows locale switches |
| `search` | `boolean \| SearchConfig` | Creates a search field; `true` = select if `options` exist, else input |
| `options` | `Option[] \| Ref<Option[]> \| () => Promise<Option[]>` | Dict: translates cells and feeds the search select |
| `tag` | `boolean` | Render the translated value as an `NTag`, colored by the option's `tagType` |
| `format` | `'date' \| 'datetime' \| 'money' \| (value, row) => string` | Display format |
| `render` | `(row, index) => VNodeChild` | Custom cell, highest priority |
| `hide` | `boolean` | Initially hidden; can be re-enabled in column settings |
| `hideInTable` | `boolean` | Search-only field, never rendered as a column |
| `hideInSetting` | `boolean` | Rendered, but not listed in column settings (typical: actions) |
| `children` | `SmartTableDataColumn[]` | Multi-level headers |

- **Option**: `{ label, value, tagType?, disabled?, children? }`; `tagType` is one of `default` / `primary` / `info` / `success` / `warning` / `error`
- **Special columns**: `{ type: 'index' }` row number (continues across pages), `{ type: 'selection' }` checkbox, `{ type: 'expand', renderExpand }` expandable row

### SearchConfig

| Field | Type | Description |
|---|---|---|
| `type` | `'input' \| 'number' \| 'select' \| 'date' \| 'daterange' \| 'switch'` | Control type |
| `key` | `string` | Request param name; defaults to the column `key` |
| `label` | `string \| () => string` | Form label; defaults to the column title |
| `placeholder` | `string` | Defaults to Naive's locale placeholder |
| `defaultValue` | `any` | Initial value, also restored on reset |
| `order` | `number` | Sort order, smaller first; defaults to column order |
| `span` | `number` | Grid span, default 1 |
| `props` | `object` | Forwarded to the underlying Naive control |
| `render` | `(ctx) => VNodeChild` | Fully custom control; `ctx` has `value`, `setValue`, `params`, `search` |

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `SmartTableColumn[]` | — | **Required**. Column definitions |
| `fetcher` | `(params) => Promise<{ items, total }>` | — | Remote data source |
| `data` | `T[]` | — | Static data (client-side pagination); use instead of `fetcher` |
| `row-key` | `string \| (row) => key` | `'id'` | Row identity |
| `params` | `object` | — | Extra request params; changes go back to page 1 and reload |
| `immediate` | `boolean` | `true` | Fetch on mount |
| `default-page-size` | `number` | `10` | Initial page size |
| `pagination` | `false \| PaginationProps` | — | `false` hides pagination; an object merges over built-in settings |
| `search` | `false \| SearchFormConfig` | — | Search area config (see below); `false` hides it |
| `toolbar` | `false \| { refresh, density, columnSettings }` | all on | Toolbar button switches |
| `title` | `string` | — | Table title, or use the `#title` slot |
| `storage-key` | `string` | — | Persist column settings and density to localStorage |
| `default-density` | `'comfortable' \| 'compact'` | `'comfortable'` | Initial density |
| `labels` | `Partial<SmartTableLabels>` | English | Override component text; pass a `computed` for locale switching |
| `active-row-key` | `string \| number \| null` | — | Highlight the matching row |
| `row-draggable` | `boolean` | `false` | Enable row drag-to-reorder |
| `drag-handle` | `string` | — | CSS selector for the drag handle; whole row if omitted |

Anything not listed (e.g. `striped`, `max-height`, `checked-row-keys`, `virtual-scroll`) is forwarded to `n-data-table`.

**SearchFormConfig** (object form of the `search` prop):

| Field | Default | Description |
|---|---|---|
| `layout` | `'grid'` | `'grid'` card with grid; `'inline'` no card, single wrapping row |
| `cols` | `'1 s:2 m:3 l:4'` | Grid columns (responsive to screen width) |
| `labelPlacement` | `'left'` | `'left'` / `'top'` |
| `labelWidth` | — | Label width |
| `collapsible` | `false` | Collapse when there are many fields (grid only) |
| `collapsedRows` | `1` | Rows kept visible when collapsed |

### Events

| Event | Payload | When |
|---|---|---|
| `search` | `params` | Search clicked (params already cleaned) |
| `reset` | — | Reset clicked |
| `loaded` | `rows, total` | Remote data loaded |
| `error` | `err` | Request failed (the table shows no message; handle it yourself) |
| `row-click` | `row, index` | Row clicked |
| `row-drag-sort` | `{ from, to, reordered }` | Row drag finished |

### Slots

| Slot | Props | Description |
|---|---|---|
| `title` | — | Table title |
| `toolbar` | — | Left side of the toolbar, e.g. Create / batch buttons |
| `toolbar-right` | — | Right side of the toolbar, before the built-in buttons |
| `cell-{key}` | `{ row, index }` | Custom cell for a column |
| `header-{key}` | `{ column }` | Custom header for a column |
| `empty` | — | Content when there is no data |
| `pagination-prefix` | Naive pagination info | Left of the pagination, e.g. "3 selected" |

### Instance methods

| Name | Description |
|---|---|
| `refresh()` | Reload with the current page and filters |
| `search()` | Back to page 1 and reload |
| `reset()` | Reset filters and reload |
| `reloadOptions(key?)` | Reload async dicts; all of them when `key` is omitted |
| `loading` / `rows` / `pagination` | Loading state, current rows, pagination state |
| `params` | Reactive search params, readable and writable |
| `tableRef` | The raw `NDataTable` instance (`scrollTo`, etc.) |

### Global default fields

Set via `createSmartTableDefaults({...})`; all optional:

| Field | Built-in | Description |
|---|---|---|
| `labels` | English | Component text; accepts a `ref` / `computed` |
| `align` / `titleAlign` | `'center'` | Cell / header alignment |
| `emptyText` | `'—'` | Placeholder for empty values |
| `pageSizes` | `[10, 20, 50]` | Page size options |
| `showSizePicker` | `true` | Show the page size picker |
| `density` | `'comfortable'` | Default density |
| `dateValueFormat` | `'yyyy-MM-dd'` | Value format of date search fields |
| `searchCols` | `'1 s:2 m:3 l:4'` | Search grid columns |
| `fixedFallbackWidth` | `120` | Width for fixed columns without `width` |
| `indexWidth` | `64` | Row number column width |
| `tag` | `{ size: 'small', bordered: false }` | Tag style for `tag: true` columns |
| `activeRowBg` | — | Background of the highlighted row |

### Other exports

- `useSmartTable(fetcher, options)`: the UI-agnostic data core the component uses (loading, pagination, search, race guard) — build your own UI on it
- Helpers: `cleanParams`, `formatDate`, `formatDatetime`, `formatMoney`, `defaultLabels`, ...
- All types: `SmartTableColumn`, `SmartTableFetcher`, `SmartTableInst`, `SmartTableOption`, `SearchConfig`, ...

## Behavior notes

- Search params are cleaned before each request: strings trimmed; empty strings, `null`, `undefined` and empty arrays dropped; `0` and `false` kept
- During fast page flips, stale responses that arrive late are discarded
- Reset restores each field to `defaultValue`, or `null` if none
- A fixed column without `width` gets one automatically (`minWidth` or 120), so Naive's fixed columns stay aligned
- `scroll-x` defaults to the sum of visible column widths; pass your own to override

## Development

```bash
npm install
npm run dev        # start the playground (source of the screenshots above)
npm test           # unit tests
npm run typecheck  # type check
npm run build      # build to dist/
```

**Branches & releases**: day-to-day work happens on `dev` and lands on `main` through a PR. To release, run `npm version patch --no-git-tag-version` (or `minor` / `major`) on `dev` and update the [CHANGELOG](./CHANGELOG.md); once merged into `main`, it is published to npm and a GitHub Release is created automatically.

## License

[Apache-2.0](./LICENSE)
