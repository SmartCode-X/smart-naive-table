import type { Density, StoredTableState } from './types'

/** 列的声明态(由 useColumns 从 props.columns 派生,persist/restore 的输入)。 */
export interface DeclaredCol {
  key: string
  show: boolean
  fixed?: 'left' | 'right'
}

// 存储键前缀是持久化格式:改动会丢掉用户已存的列设置。
const PREFIX = 'protable:'

export function loadState(storageKey: string): StoredTableState | null {
  try {
    const raw = localStorage.getItem(PREFIX + storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as StoredTableState
    // 版本不匹配或结构不对 → 整体丢弃,回声明态
    if (parsed?.v !== 1 || !Array.isArray(parsed.cols)) return null
    return parsed
  } catch {
    return null
  }
}

export function saveState(storageKey: string, density: Density, cols: DeclaredCol[]): void {
  try {
    const state: StoredTableState = { v: 1, density, cols }
    localStorage.setItem(PREFIX + storageKey, JSON.stringify(state))
  } catch {
    // 存储满/隐私模式等,静默失败(功能退化为内存态)
  }
}

export function clearState(storageKey: string): void {
  try {
    localStorage.removeItem(PREFIX + storageKey)
  } catch {
    // 同上
  }
}

/**
 * 恢复合并:存储里已不存在于当前声明的 key → 剔除;
 * 新增列(声明有、存储无)按声明下标插入,show 取声明值;
 * 其余列顺序/显隐/固定以存储为准。
 */
export function mergeCols(declared: DeclaredCol[], stored: StoredTableState['cols']): DeclaredCol[] {
  const declaredByKey = new Map(declared.map((c) => [c.key, c]))
  const merged: DeclaredCol[] = stored
    .filter((s) => declaredByKey.has(s.key))
    .map((s) => ({ key: s.key, show: s.show, fixed: s.fixed }))
  const mergedKeys = new Set(merged.map((c) => c.key))
  declared.forEach((c, idx) => {
    if (mergedKeys.has(c.key)) return
    merged.splice(Math.min(idx, merged.length), 0, { ...c })
  })
  return merged
}
