import { describe, expect, it } from 'vitest'
import { createApp, ref } from 'vue'
import {
  BUILTIN_DEFAULTS,
  SMART_TABLE_DEFAULTS,
  resolveDefaults,
  useSmartTableDefaults,
} from '../src/config'
import { mergeLabels } from '../src/labels'

describe('resolveDefaults 优先级', () => {
  it('不注入 → 全部用内置兜底', () => {
    expect(resolveDefaults()).toEqual(BUILTIN_DEFAULTS)
    expect(resolveDefaults(null)).toEqual(BUILTIN_DEFAULTS)
  })

  it('注入的字段覆盖兜底,未给的字段保持兜底', () => {
    const r = resolveDefaults({ align: 'left', indexWidth: 80 })
    expect(r.align).toBe('left')
    expect(r.indexWidth).toBe(80)
    expect(r.titleAlign).toBe('center') // 未给 → 兜底
    expect(r.pageSizes).toEqual([10, 20, 50])
  })

  it('undefined 字段不得覆盖兜底', () => {
    const r = resolveDefaults({ align: undefined, emptyText: 'N/A' })
    expect(r.align).toBe('center')
    expect(r.emptyText).toBe('N/A')
  })

  it('tag 部分合并:只给 size,bordered 仍兜底', () => {
    const r = resolveDefaults({ tag: { size: 'medium' } })
    expect(r.tag).toEqual({ size: 'medium', bordered: false })
  })
})

describe('useSmartTableDefaults 注入接线', () => {
  function withProvide<T>(provide: unknown, fn: () => T): T {
    const app = createApp({})
    if (provide) app.provide(SMART_TABLE_DEFAULTS, provide as never)
    return app.runWithContext(fn)
  }

  it('无 provide → 兜底', () => {
    expect(withProvide(null, () => useSmartTableDefaults()).align).toBe('center')
  })

  it('有 provide → 生效', () => {
    const r = withProvide({ align: 'left' }, () => useSmartTableDefaults())
    expect(r.align).toBe('left')
  })
})

describe('mergeLabels 三层合并', () => {
  it('内置 < 全局 < 实例', () => {
    const merged = mergeLabels({ search: 'S-inst' }, { search: 'S-global', reset: 'R-global' })
    expect(merged.search).toBe('S-inst') // 实例胜
    expect(merged.reset).toBe('R-global') // 全局胜内置
    expect(merged.refresh).toBe('Refresh') // 内置兜底
  })

  it('全局 labels 可来自 ref(渲染期 toValue,此处直接解引用后传入)', () => {
    const global = ref({ search: '搜索' })
    const merged = mergeLabels(undefined, global.value)
    expect(merged.search).toBe('搜索')
  })
})
