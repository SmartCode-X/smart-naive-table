import type { SmartTableLabels } from './types'

/** 英文默认文案;宿主经 labels prop 部分覆盖(传 computed 即随 locale 响应)。 */
export const defaultLabels: SmartTableLabels = {
  search: 'Search',
  reset: 'Reset',
  refresh: 'Refresh',
  density: 'Density',
  densityComfortable: 'Comfortable',
  densityCompact: 'Compact',
  columnSettings: 'Columns',
  columnSettingsReset: 'Restore defaults',
  fixedLeft: 'Pin left',
  fixedRight: 'Pin right',
  fixedNone: 'Unpin',
  expand: 'Expand',
  collapse: 'Collapse',
  filter: 'Filter',
  filterConfirm: 'OK',
  filterReset: 'Reset',
  filterSelectAll: 'Select all',
  filterEqual: 'Equals',
  filterNotEqual: 'Not equals',
  filterContains: 'Contains',
  filterNotContains: 'Not contains',
  filterGt: 'Greater than',
  filterGte: 'Greater or equal',
  filterLt: 'Less than',
  filterLte: 'Less or equal',
}

/** 三层合并:内置英文 < 全局默认(global)< 实例 prop(partial)。 */
export function mergeLabels(
  partial?: Partial<SmartTableLabels>,
  global?: Partial<SmartTableLabels>,
): SmartTableLabels {
  return { ...defaultLabels, ...global, ...partial }
}
