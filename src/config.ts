// 全局默认值注入:宿主 provide 一次,所有 SmartTable 继承。
// 优先级恒为 实例 prop / 列显式值 > 全局默认 > 内置兜底。
// 不 provide 时全部取内置兜底(BUILTIN_DEFAULTS)。
import { inject, type InjectionKey, type MaybeRefOrGetter } from 'vue'
import type { Density, SmartTableLabels } from './types'

export interface SmartTableDefaults {
  /** 单元格默认对齐;内置兜底 'center'。 */
  align?: 'left' | 'center' | 'right'
  /** 表头默认对齐;内置兜底 'center'。 */
  titleAlign?: 'left' | 'center' | 'right'
  /** 空值(null/undefined)占位;内置兜底 '—'。 */
  emptyText?: string
  /** tag:true 列的 NTag 样式;内置兜底 { size:'small', bordered:false }。 */
  tag?: { size?: 'small' | 'medium' | 'large'; bordered?: boolean }
  /** 分页可选每页条数;内置兜底 [10,20,50]。 */
  pageSizes?: number[]
  /** 是否显示每页条数选择器;内置兜底 true。 */
  showSizePicker?: boolean
  /** 固定列无显式宽度时的兜底宽;内置兜底 120。 */
  fixedFallbackWidth?: number
  /** index 序号列默认宽;内置兜底 64。 */
  indexWidth?: number
  /** 默认密度;内置兜底 'comfortable'。 */
  density?: Density
  /** 搜索日期控件 value-format;内置兜底 'yyyy-MM-dd'。 */
  dateValueFormat?: string
  /** 搜索表单 n-grid cols;内置兜底 '1 s:2 m:3 l:4'。 */
  searchCols?: number | string
  /** activeRowKey 命中行高亮背景;缺省走 CSS 变量默认值。 */
  activeRowBg?: string
  /** 组件 chrome 文案;传 ref/getter 即随 locale 响应(渲染期 toValue 解引用)。 */
  labels?: MaybeRefOrGetter<Partial<SmartTableLabels>>
}

/** provide/inject 键。 */
export const SMART_TABLE_DEFAULTS: InjectionKey<SmartTableDefaults> = Symbol('smart-table-defaults')

/** 解析后的默认值:标量字段全部有值,labels 保持惰性(渲染期解引用)。 */
export type ResolvedSmartTableDefaults = {
  align: 'left' | 'center' | 'right'
  titleAlign: 'left' | 'center' | 'right'
  emptyText: string
  tag: { size: 'small' | 'medium' | 'large'; bordered: boolean }
  pageSizes: number[]
  showSizePicker: boolean
  fixedFallbackWidth: number
  indexWidth: number
  density: Density
  dateValueFormat: string
  searchCols: number | string
  activeRowBg?: string
  labels?: MaybeRefOrGetter<Partial<SmartTableLabels>>
}

/** 内置兜底常量 —— 未注入全局默认、或注入值为 undefined 的字段取这里。 */
export const BUILTIN_DEFAULTS: ResolvedSmartTableDefaults = {
  align: 'center',
  titleAlign: 'center',
  emptyText: '—',
  tag: { size: 'small', bordered: false },
  pageSizes: [10, 20, 50],
  showSizePicker: true,
  fixedFallbackWidth: 120,
  indexWidth: 64,
  density: 'comfortable',
  dateValueFormat: 'yyyy-MM-dd',
  searchCols: '1 s:2 m:3 l:4',
}

/** 宿主 main.ts:app.provide(SMART_TABLE_DEFAULTS, createSmartTableDefaults({...}))。仅为类型/自文档。 */
export function createSmartTableDefaults(d: SmartTableDefaults): SmartTableDefaults {
  return d
}

/** 合并:内置兜底 + 已注入的非 undefined 字段(undefined 键不得覆盖兜底)。 */
export function resolveDefaults(injected?: SmartTableDefaults | null): ResolvedSmartTableDefaults {
  if (!injected) return { ...BUILTIN_DEFAULTS }
  const out: ResolvedSmartTableDefaults = { ...BUILTIN_DEFAULTS }
  for (const [k, v] of Object.entries(injected)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v
  }
  out.tag = { ...BUILTIN_DEFAULTS.tag, ...injected.tag }
  return out
}

/** 组件内取值:inject + 内置兜底合并。必须在 setup 内调用。 */
export function useSmartTableDefaults(): ResolvedSmartTableDefaults {
  return resolveDefaults(inject(SMART_TABLE_DEFAULTS, null))
}
