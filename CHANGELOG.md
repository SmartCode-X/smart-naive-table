# Changelog

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
