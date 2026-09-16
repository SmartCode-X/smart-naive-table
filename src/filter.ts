// 过滤内核(UI 无关、可单测):条件求值 + 本地过滤 + 远程参数序列化。
// 条件模型对齐 Bootstrap Blazor 的 FilterAction/FilterLogic(等于/包含/大于… + 且/或),
// 选项勾选模式(Arco 风格)只是「若干 equal 条件 + or」的一层语法糖,两者共用同一份求值逻辑。
import type { FilterAction, FilterCondition, FilterLogic, FilterState, FilterValue } from './types'

const DAY = 86_400_000
/** 纯日期串(无时分秒)—— 命中后按「整天区间」比较,而非时间戳点比较。 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

/** 空值:null / undefined / 空串 / 空数组。false 与 0 不算空。 */
export function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim() === ''
  if (Array.isArray(v)) return v.length === 0
  return false
}

/** 值非空的条件才参与求值 —— 用户只填了动作没填值时视为没写。 */
export function activeConditions(value: FilterValue | null | undefined): FilterCondition[] {
  if (!value || !Array.isArray(value.conditions)) return []
  return value.conditions.filter((c) => c && !isBlank(c.value))
}

/** 该列是否处于生效的过滤态(表头漏斗图标高亮、是否进请求参数都看它)。 */
export function isFilterActive(value: FilterValue | null | undefined): boolean {
  return activeConditions(value).length > 0
}

/** 统一成可比较标量:布尔/数字串 → number,Date/日期串 → 时间戳,其余 → 原字符串。 */
function toComparable(v: unknown): number | string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return Number(v)
  if (typeof v === 'number') return Number.isNaN(v) ? null : v
  if (v instanceof Date) {
    const t = v.getTime()
    return Number.isNaN(t) ? null : t
  }
  const s = String(v)
  if (s.trim() === '') return null
  const n = Number(s)
  if (!Number.isNaN(n)) return n
  const t = Date.parse(s)
  return Number.isNaN(t) ? s : t
}

/** a<b → -1,a>b → 1,相等 → 0;任一侧不可比较 → null(调用方按「不匹配」处理)。 */
function compareValues(a: unknown, b: unknown): number | null {
  const ca = toComparable(a)
  const cb = toComparable(b)
  if (ca === null || cb === null) return null
  if (typeof ca === 'number' && typeof cb === 'number') return ca < cb ? -1 : ca > cb ? 1 : 0
  const sa = String(ca)
  const sb = String(cb)
  return sa < sb ? -1 : sa > sb ? 1 : 0
}

/**
 * 过滤值是纯日期串、单元格是可解析时间时,返回当天的 [起, 止) 时间戳。
 * 否则返回 null,走普通标量比较。
 * —— 让「创建时间 等于 2024-03-05」能命中当天任意时刻,而不是要求毫秒级相等。
 */
function dayRange(cell: unknown, value: unknown): { cellTs: number; start: number; end: number } | null {
  if (typeof value !== 'string' || !DATE_ONLY.test(value.trim())) return null
  // 显式 UTC 锚定(带 Z):不加 Z 时 Date.parse 按运行环境本地时区解析,
  // 会让「整天」边界随浏览器/服务端时区漂移,与单元格的绝对时间戳产生时区依赖的偏差。
  const start = Date.parse(`${value.trim()}T00:00:00Z`)
  if (Number.isNaN(start)) return null
  const cellTs = cell instanceof Date ? cell.getTime() : typeof cell === 'string' ? Date.parse(cell) : NaN
  if (Number.isNaN(cellTs)) return null
  return { cellTs, start, end: start + DAY }
}

function matchEqual(cell: unknown, value: unknown): boolean {
  if (cell === value) return true
  const day = dayRange(cell, value)
  if (day) return day.cellTs >= day.start && day.cellTs < day.end
  return compareValues(cell, value) === 0
}

function matchContains(cell: unknown, value: unknown): boolean {
  if (cell === null || cell === undefined) return false
  const needle = String(value).toLowerCase()
  // 数组单元格逐元素匹配 —— 整体 join 成字符串比较会在元素边界上产生假阳性(如 [1,22,3] 误中 '1,2')
  if (Array.isArray(cell)) return cell.some((v) => String(v).toLowerCase().includes(needle))
  return String(cell).toLowerCase().includes(needle)
}

/** 单条件求值。单元格为空时:notEqual/notContains 为真,其余为假。 */
export function matchCondition(cond: FilterCondition, cell: unknown): boolean {
  const { action, value } = cond
  switch (action) {
    case 'equal':
      return matchEqual(cell, value)
    case 'notEqual':
      return !matchEqual(cell, value)
    case 'contains':
      return matchContains(cell, value)
    case 'notContains':
      return !matchContains(cell, value)
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const day = dayRange(cell, value)
      if (day) {
        // 日期粒度:> 某天 = 该天结束之后;<= 某天 = 该天结束之前
        if (action === 'gt') return day.cellTs >= day.end
        if (action === 'gte') return day.cellTs >= day.start
        if (action === 'lt') return day.cellTs < day.start
        return day.cellTs < day.end
      }
      const c = compareValues(cell, value)
      if (c === null) return false
      if (action === 'gt') return c > 0
      if (action === 'gte') return c >= 0
      if (action === 'lt') return c < 0
      return c <= 0
    }
    default:
      // 未识别的 action(如反序列化/编程式构造出的脏数据)按不匹配处理 ——
      // fail-open(默认放行)会让 or 逻辑下整列过滤被一条脏条件悄悄短路成「放行全部」。
      return false
  }
}

/** 一列的过滤值对单个单元格求值;无生效条件 → 放行。 */
export function matchFilterValue(value: FilterValue | null | undefined, cell: unknown): boolean {
  const conds = activeConditions(value)
  if (conds.length === 0) return true
  const logic: FilterLogic = value?.logic === 'or' ? 'or' : 'and'
  return logic === 'or' ? conds.some((c) => matchCondition(c, cell)) : conds.every((c) => matchCondition(c, cell))
}

/** applyFilters 需要的最小列信息(由 FilterDef 满足)。 */
export interface FilterableField<T = any> {
  /** 过滤态的键(filter.key ?? 列 key)。 */
  key: string
  /** 行数据字段名(始终是列 key)。 */
  field: string
  /** 自定义匹配,优先于内置条件求值。 */
  filter?: (value: FilterValue, row: T) => boolean
}

/** 本地(静态 data)过滤:各列之间恒为「与」,列内部由 logic 决定。 */
export function applyFilters<T>(rows: T[], fields: FilterableField<T>[], state: FilterState): T[] {
  const active = fields.filter((f) => isFilterActive(state[f.key]))
  if (active.length === 0) return rows
  return rows.filter((row) =>
    active.every((f) => {
      const value = state[f.key]!
      if (f.filter) return f.filter(value, row)
      return matchFilterValue(value, (row as Record<string, unknown>)[f.field])
    }),
  )
}

/** 序列化后的单列过滤(默认序列化器的产物形状)。 */
export interface SerializedFilter {
  field: string
  logic: FilterLogic
  conditions: FilterCondition[]
}

/** 过滤态 → 请求参数。默认实现产出 `{ filters: [...] }`,后端形状不同就自己传一个。 */
export type FilterSerializer = (state: FilterState) => Record<string, any>

export const defaultFilterSerializer: FilterSerializer = (state) => {
  const filters: SerializedFilter[] = []
  for (const [field, value] of Object.entries(state)) {
    const conditions = activeConditions(value)
    if (conditions.length) filters.push({ field, logic: value.logic === 'or' ? 'or' : 'and', conditions })
  }
  return filters.length ? { filters } : {}
}

/** 勾选若干选项 → 过滤值(若干 equal 条件取「或」);空选择返回 null。 */
export function optionsToFilterValue(values: unknown[]): FilterValue | null {
  if (!values.length) return null
  return { logic: 'or', conditions: values.map((value) => ({ action: 'equal' as FilterAction, value })) }
}

/** 过滤值 → 已勾选的选项值(optionsToFilterValue 的逆运算,用于回显)。 */
export function filterValueToOptions(value: FilterValue | null | undefined): unknown[] {
  return activeConditions(value)
    .filter((c) => c.action === 'equal')
    .map((c) => c.value)
}
