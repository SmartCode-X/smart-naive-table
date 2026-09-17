# Changelog

## 2.1.1 - 2026-09-16

### 修复：列宽钉住后表格右侧留白

- 列宽之和小于容器时补一列占位列，把富余宽度独自吃掉：表格重新填满容器，表头与行的底色、边框铺到右缘，而每一列仍是拖出来的精确宽度（此前富余宽度就空在表格右侧）
- 占位列插在右固定列之前，操作列这类右固定列仍贴容器右缘；它不进列设置，也不参与排序、过滤与拖拽
- 列宽之和超过容器时行为不变，照旧横向滚动；没拖过列宽（未钉住）的表格仍由 Naive 自己按容器拉伸

## 2.1.0 - 2026-09-15

### 新增：表头过滤

列上加 `filter` 即可（参考 [Bootstrap Blazor Table](https://www.blazor.zone/table/filter) 的条件过滤与 [Arco Design Vue Table](https://arco.design/vue/component/table) 的勾选过滤）：

- 两种面板，按列自动选：列有 `options` 出勾选列表（`multiple: false` 变单选），否则出一行「动作 + 值」条件
- 动作集合 `equal` / `notEqual` / `contains` / `notContains` / `gt` / `gte` / `lt` / `lte`，按值类型给默认集合
- 远程模式把过滤态序列化进请求（默认 `{ filters: [{ field, logic, conditions }] }`，可用 `filter-serializer` 或全局 `filterSerializer` 换形状），静态 `data` 模式在前端过滤
- 新增 `@filter-change` 事件与 `filters` / `setFilter()` / `clearFilters()` 实例方法
- 表级开关 `:filter="false"` 一键关掉全部表头过滤（与 `:search="false"` 对称），全局默认 `filterable`
- 新增导出：`matchFilterValue`、`applyFilters`、`defaultFilterSerializer`、`isFilterActive`、`useFilters` 等，以及 `FilterConfig`、`FilterValue`、`FilterState` 等类型

### 新增：列宽拖拽

- 表格上加 `resizable` 即可整表开启（列上的 `resizable` 优先，参考 Arco 的 `column-resizable`）
- 新增 `@column-resize` 事件（`key`、`width`）与 `columnWidths` 实例属性
- 传了 `storage-key` 时列宽随列设置一起持久化；可拖拽列自动补 `minWidth`（默认 60）避免被拖成 0 宽
- 拖某一列只改这一列：首次拖动把所有列（含序号 / 勾选列）钉成实际宽度，并把表格切到 `table-layout: fixed`、宽度写死成列宽之和，左侧的列不再被牵动
- 列宽钉住后表格不再按容器拉伸（收窄留白 / 加宽滚动）；「恢复默认」可回到自适应
- 列设置里的「恢复默认」会一并还原列宽

### 全局默认值

新增 `resizable`、`filterable`、`resizeMinWidth`、`filterSerializer`；`SmartTableLabels` 新增过滤相关文案（未覆盖时取英文默认）。

### 注意

- 列上的 `filter` 现在由本包接管，不再透传 Naive 原生的 `filter` / `filterOptions` 等列过滤属性
- localStorage 存储结构升到 `v2`（新增 `widths`）。`v1` 数据自动升级，已存的列显隐、顺序、固定与密度不受影响

## 2.0.0 - 2026-09-12

**破坏性变更：导出名统一改为 `SmartTable` 前缀，行为不变。升级时按下表替换导入、类型与样式覆盖。**

| 1.x | 2.0 |
|---|---|
| `ProTable` | `SmartTable` |
| `useProTable`、`UseProTableOptions`、`UseProTableReturn` | `useSmartTable`、`UseSmartTableOptions`、`UseSmartTableReturn` |
| `PRO_TABLE_DEFAULTS`、`createProTableDefaults`、`useProTableDefaults`、`ProTableDefaults` | `SMART_TABLE_DEFAULTS`、`createSmartTableDefaults`、`useSmartTableDefaults`、`SmartTableDefaults` |
| `ProTableParams`、`ProTableFetcher`、`ProTableOption`、`ProTableDataColumn`、`ProTableSpecialColumn`、`ProTableColumn`、`ProTableProps`、`ProTableInst`、`ProTableLabels` | `SmartTable` 前缀、同后缀 |
| CSS 类 `.pro-table`、`.pro-table-*`，CSS 变量 `--pro-table-active-row-bg` | `.smart-table`、`.smart-table-*`，`--smart-table-active-row-bg` |

列设置在 localStorage 里的键前缀 `protable:` 保持不变，用户已存的列显隐、顺序、固定与密度升级后照常生效。

## 1.0.0

首次发布。功能与用法见 [README](./README.md)。
