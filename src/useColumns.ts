import { computed, h, ref, type ComputedRef, type Ref, type Slots, type VNodeChild } from 'vue'
import { NTag } from 'naive-ui'
import type { DataTableBaseColumn, DataTableColumn } from 'naive-ui'
import type {
  Density,
  OptionsSource,
  SmartTableColumn,
  SmartTableDataColumn,
  SmartTableOption,
  SmartTableSpecialColumn,
  SearchConfig,
  SearchFieldType,
  SearchRenderCtx,
} from './types'
import { applyFormat } from './format'
import { findOption, optionLabel } from './useOptions'
import { clearState, loadState, mergeCols, saveState, type DeclaredCol } from './storage'
import type { ResolvedSmartTableDefaults } from './config'

export function isSpecialColumn<T>(c: SmartTableColumn<T>): c is SmartTableSpecialColumn<T> {
  return 'type' in c && typeof (c as SmartTableSpecialColumn<T>).type === 'string'
}

/* ======================== 搜索项派生 ======================== */

export interface SearchDef {
  /** 搜索参数名(search.key ?? 列 key)。 */
  key: string
  /** 字典查找键(始终是列 key,options 挂在列上)。 */
  optionsKey: string
  label?: string | (() => VNodeChild)
  type: SearchFieldType
  placeholder?: string
  defaultValue?: unknown
  span: number
  props?: Record<string, unknown>
  render?: (ctx: SearchRenderCtx) => VNodeChild
}

/** 从列定义派生搜索项:带 search 的数据列(含 hideInTable/hide 的)。 */
export function deriveSearchDefs<T>(columns: SmartTableColumn<T>[]): SearchDef[] {
  const defs: Array<SearchDef & { sortKey: number }> = []
  columns.forEach((col, idx) => {
    if (isSpecialColumn(col) || !col.search) return
    const cfg: SearchConfig = col.search === true ? {} : col.search
    defs.push({
      key: cfg.key ?? col.key,
      optionsKey: col.key,
      label: cfg.label ?? col.title,
      type: cfg.type ?? (col.options ? 'select' : 'input'),
      placeholder: cfg.placeholder,
      defaultValue: cfg.defaultValue,
      span: cfg.span ?? 1,
      props: cfg.props,
      render: cfg.render,
      // 显式 order 排前段(小的在前),未指定的按声明顺序排后段
      sortKey: cfg.order ?? 1_000_000 + idx,
    })
  })
  return defs.sort((a, b) => a.sortKey - b.sortKey).map(({ sortKey: _sortKey, ...d }) => d)
}

/** 搜索参数初值:defaultValue ?? null(null 保证 Naive 控件受控)。 */
export function deriveInitParams(defs: SearchDef[]): Record<string, any> {
  const out: Record<string, any> = {}
  for (const d of defs) out[d.key] = d.defaultValue ?? null
  return out
}

/** 收集列上的字典源(列 key → OptionsSource)。 */
export function deriveOptionsSources<T>(columns: SmartTableColumn<T>[]): Record<string, OptionsSource> {
  const out: Record<string, OptionsSource> = {}
  for (const col of columns) {
    if (!isSpecialColumn(col) && col.options) out[col.key] = col.options
  }
  return out
}

/* ======================== 列派生中枢 ======================== */

export interface SettingItem {
  key: string
  title?: string | (() => VNodeChild)
  show: boolean
  fixed?: 'left' | 'right'
}

export interface UseColumnsOpts<T> {
  columns: () => SmartTableColumn<T>[]
  storageKey?: string
  defaultDensity: Density
  getOptions: (key: string) => SmartTableOption[]
  slots: Slots
  /** index 特殊列的序号偏移(远程分页 = (page-1)*pageSize)。 */
  indexOffset: () => number
  /** 全局默认值(align/emptyText/tag/宽度兜底等),已含内置兜底。 */
  defaults: ResolvedSmartTableDefaults
  /** 当前受控排序态(sorter 列箭头回显);getter 保证 computed 内追踪。 */
  sortState?: () => { field: string; order: 'ascend' | 'descend' } | null
}

export interface UseColumnsReturn<T> {
  density: Ref<Density>
  setDensity: (d: Density) => void
  settingItems: ComputedRef<SettingItem[]>
  toggleShow: (key: string, show: boolean) => void
  moveCheck: (from: number, to: number) => void
  setFixed: (key: string, fixed?: 'left' | 'right') => void
  resetSettings: () => void
  naiveColumns: ComputedRef<DataTableColumn<T>[]>
  scrollX: ComputedRef<number>
}

export function useColumns<T>(opts: UseColumnsOpts<T>): UseColumnsReturn<T> {
  const d = opts.defaults
  const stored = opts.storageKey ? loadState(opts.storageKey) : null
  // 用户改过的列状态(可能落后于最新列声明,effectiveChecks 里始终重新 merge)
  const checks = ref<DeclaredCol[]>(stored?.cols ?? [])
  const density = ref<Density>(stored?.density ?? opts.defaultDensity)

  const dataCols = computed(() =>
    opts.columns().filter((c): c is SmartTableDataColumn<T> => !isSpecialColumn(c) && !c.hideInTable),
  )
  const specialCols = computed(() => opts.columns().filter(isSpecialColumn))
  const managedCols = computed(() => dataCols.value.filter((c) => !c.hideInSetting))

  const declaredChecks = computed<DeclaredCol[]>(() =>
    managedCols.value.map((c) => ({
      key: c.key,
      show: !c.hide,
      fixed: c.fixed === 'left' || c.fixed === 'right' ? c.fixed : undefined,
    })),
  )

  // 声明与存储/用户态的合并结果 —— 列增删后依然一致
  const effectiveChecks = computed(() => mergeCols(declaredChecks.value, checks.value))

  function persist(next: DeclaredCol[]) {
    checks.value = next
    if (opts.storageKey) saveState(opts.storageKey, density.value, next)
  }

  function setDensity(d: Density) {
    density.value = d
    if (opts.storageKey) saveState(opts.storageKey, d, effectiveChecks.value)
  }

  function toggleShow(key: string, show: boolean) {
    persist(effectiveChecks.value.map((c) => (c.key === key ? { ...c, show } : c)))
  }

  function moveCheck(from: number, to: number) {
    const next = [...effectiveChecks.value]
    const [moved] = next.splice(from, 1)
    if (!moved) return
    next.splice(to, 0, moved)
    persist(next)
  }

  function setFixed(key: string, fixed?: 'left' | 'right') {
    persist(effectiveChecks.value.map((c) => (c.key === key ? { ...c, fixed } : c)))
  }

  function resetSettings() {
    checks.value = []
    if (opts.storageKey) clearState(opts.storageKey)
  }

  const settingItems = computed<SettingItem[]>(() => {
    const titleByKey = new Map(managedCols.value.map((c) => [c.key, c.title]))
    return effectiveChecks.value.map((c) => ({ ...c, title: titleByKey.get(c.key) }))
  })

  /* ---- 数据列 → Naive 列 ---- */

  function toNaive(col: SmartTableDataColumn<T>, override?: { fixed?: 'left' | 'right' }): DataTableColumn<T> {
    const {
      key,
      title,
      render,
      format,
      options,
      tag,
      hide: _hide,
      hideInTable: _hideInTable,
      hideInSetting: _hideInSetting,
      search: _search,
      children,
      ...naiveRest
    } = col

    const result: Record<string, any> = {
      ...naiveRest,
      key,
      title: title as DataTableBaseColumn<T>['title'],
      titleAlign: naiveRest.titleAlign ?? d.titleAlign, // 表头默认对齐,用户显式值优先
      align: naiveRest.align ?? d.align, // 单元格默认对齐,用户显式值优先
    }

    // 列表头自定义:#header-{key} 插槽(列已声明函数 title 时不覆盖)
    const headerSlot = opts.slots[`header-${key}`]
    if (headerSlot && typeof title !== 'function') {
      result.title = () => headerSlot({ column: col })
    }

    // 受控排序:sorter 列的箭头由 sortState 决定(远程模式非受控箭头会漂)
    if (naiveRest.sorter != null && (naiveRest.sorter as unknown) !== false) {
      const s = opts.sortState?.()
      result.sortOrder = s && s.field === key ? s.order : false
    }

    if (children?.length) {
      result.children = children.map((c) => toNaive(c))
      return result as DataTableColumn<T>
    }

    const fixed = override && 'fixed' in override ? override.fixed : col.fixed
    result.fixed = fixed
    // 固定列必须有具体宽度,否则 Naive 固定列错位
    if (fixed && col.width === undefined) result.width = col.minWidth ?? d.fixedFallbackWidth

    const slot = opts.slots[`cell-${key}`]
    if (render || slot || options || format) {
      result.render = (row: T, rowIndex: number): VNodeChild => {
        if (render) return render(row, rowIndex)
        if (slot) return slot({ row, index: rowIndex })
        const value = (row as Record<string, unknown>)[key]
        if (options) {
          if (value === null || value === undefined) return d.emptyText
          const hit = findOption(opts.getOptions(key), value as SmartTableOption['value'])
          if (!hit) return String(value)
          const label = optionLabel(hit)
          return tag
            ? h(NTag, { type: hit.tagType ?? 'default', size: d.tag.size, bordered: d.tag.bordered }, () => label)
            : label
        }
        // 此处必有 format
        if (value === null || value === undefined) return d.emptyText
        return applyFormat(format!, value, row)
      }
    }
    return result as DataTableColumn<T>
  }

  function specialToNaive(col: SmartTableSpecialColumn<T>): DataTableColumn<T> {
    const { type, title, renderExpand, ...rest } = col
    if (type === 'index') {
      return {
        ...rest,
        key: '__index',
        title: (title ?? '#') as DataTableBaseColumn<T>['title'],
        width: col.width ?? d.indexWidth,
        align: (rest.align as 'left' | 'center' | 'right' | undefined) ?? d.align,
        render: (_row: T, rowIndex: number) => opts.indexOffset() + rowIndex + 1,
      } as DataTableColumn<T>
    }
    if (type === 'expand') {
      return { ...rest, type: 'expand', renderExpand } as DataTableColumn<T>
    }
    return { ...rest, type: 'selection' } as DataTableColumn<T>
  }

  /** 最终列:特殊列(声明序,恒在前)+ 数据列(managed 按设置排序,hideInSetting 保持声明位)。 */
  const orderedVisibleData = computed<Array<{ col: SmartTableDataColumn<T>; fixed?: 'left' | 'right'; managed: boolean }>>(() => {
    const cols = dataCols.value
    const eff = effectiveChecks.value
    const colByKey = new Map(cols.map((c) => [c.key, c]))
    const managedSlots: number[] = []
    cols.forEach((c, i) => {
      if (!c.hideInSetting) managedSlots.push(i)
    })
    const result: Array<{ col: SmartTableDataColumn<T>; fixed?: 'left' | 'right'; managed: boolean } | undefined> = new Array(
      cols.length,
    )
    cols.forEach((c, i) => {
      if (c.hideInSetting) result[i] = { col: c, fixed: c.fixed === 'left' || c.fixed === 'right' ? c.fixed : undefined, managed: false }
    })
    eff.forEach((chk, orderIdx) => {
      const slot = managedSlots[orderIdx]
      const col = colByKey.get(chk.key)
      if (slot === undefined || !col) return
      result[slot] = chk.show ? { col, fixed: chk.fixed, managed: true } : undefined
    })
    return result.filter((r): r is NonNullable<typeof r> => r !== undefined)
  })

  const naiveColumns = computed<DataTableColumn<T>[]>(() => [
    ...specialCols.value.map(specialToNaive),
    ...orderedVisibleData.value.map(({ col, fixed, managed }) => toNaive(col, managed ? { fixed } : undefined)),
  ])

  /** auto scrollX = Σ可见叶子列 (width ?? minWidth ?? 兜底宽);特殊列缺省按 indexWidth。 */
  const scrollX = computed(() => {
    let sum = 0
    for (const col of specialCols.value) sum += Number(col.width ?? d.indexWidth)
    const walk = (cols: SmartTableDataColumn<T>[]) => {
      for (const c of cols) {
        if (c.children?.length) walk(c.children)
        else sum += Number(c.width ?? c.minWidth ?? d.fixedFallbackWidth)
      }
    }
    walk(orderedVisibleData.value.map((r) => r.col))
    return sum
  })

  return {
    density,
    setDensity,
    settingItems,
    toggleShow,
    moveCheck,
    setFixed,
    resetSettings,
    naiveColumns,
    scrollX,
  }
}
