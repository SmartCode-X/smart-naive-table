import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { isFilterActive } from './filter'
import type { FilterState, FilterValue } from './types'
import { deriveInitFilters, type FilterDef } from './useColumns'

export interface UseFiltersOpts<T> {
  /** 当前过滤项(getter:列定义变化后能补种新列的 defaultValue)。 */
  defs: () => FilterDef<T>[]
  /** 过滤态变化后回调(远程重查 / 对外 emit 都挂这里)。 */
  onChange?: (key: string, value: FilterValue | null, state: FilterState) => void
}

export interface UseFiltersReturn {
  /** 只含「生效」列的过滤态:清空某列即从对象里删键,而不是留个空壳。 */
  state: Ref<FilterState>
  getFilter: (key: string) => FilterValue | null
  /** 传 null 或无生效条件的值 → 清除该列。值没变则不触发 onChange。 */
  setFilter: (key: string, value: FilterValue | null) => void
  /** 全部恢复到各列 defaultValue(没有 defaultValue 的列即清空)。 */
  clearFilters: () => void
  activeKeys: ComputedRef<string[]>
}

/**
 * 表头过滤态(UI 无关):只保存「有生效条件」的列,方便直接序列化进请求参数。
 * 列的 defaultValue 只在该列首次出现时播种一次 —— 用户手动清掉后不会被重新塞回来。
 */
export function useFilters<T>(opts: UseFiltersOpts<T>): UseFiltersReturn {
  const state = ref<FilterState>(deriveInitFilters(opts.defs()))
  const seeded = new Set(opts.defs().map((d) => d.key))

  // 列定义后追加的过滤列:补种一次 defaultValue(已播种过的列不再回填)
  watch(opts.defs, (defs) => {
    let next: FilterState | null = null
    for (const def of defs) {
      if (seeded.has(def.key)) continue
      seeded.add(def.key)
      if (def.defaultValue && isFilterActive(def.defaultValue)) {
        next = next ?? { ...state.value }
        next[def.key] = def.defaultValue
      }
    }
    if (next) state.value = next
  })

  function getFilter(key: string): FilterValue | null {
    return state.value[key] ?? null
  }

  function setFilter(key: string, value: FilterValue | null) {
    const next = { ...state.value }
    const effective = value && isFilterActive(value) ? value : null
    if (effective) next[key] = effective
    else delete next[key]
    // 同值重复提交(面板里点确定但没改动)不该触发一次远程重查
    if (JSON.stringify(next[key] ?? null) === JSON.stringify(state.value[key] ?? null)) return
    state.value = next
    opts.onChange?.(key, effective, next)
  }

  function clearFilters() {
    const next = deriveInitFilters(opts.defs())
    if (JSON.stringify(next) === JSON.stringify(state.value)) return
    state.value = next
    opts.onChange?.('', null, next)
  }

  const activeKeys = computed(() => Object.keys(state.value))

  return { state, getFilter, setFilter, clearFilters, activeKeys }
}
