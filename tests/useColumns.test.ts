import { describe, expect, it } from 'vitest'
import type { Slots, VNode } from 'vue'
import { useColumns } from '../src/useColumns'
import { resolveDefaults } from '../src/config'
import type { SmartTableColumn, SmartTableOption } from '../src/types'

interface Row {
  name: string
  st: number | null
  amt: number
}

function build(
  columns: SmartTableColumn<Row>[],
  defaultsIn?: Parameters<typeof resolveDefaults>[0],
  slots: Slots = {},
  sortState?: () => { field: string; order: 'ascend' | 'descend' } | null,
) {
  const opts = {
    columns: () => columns,
    defaultDensity: 'comfortable' as const,
    getOptions: (k: string): SmartTableOption[] =>
      k === 'st' ? [{ label: 'A', value: 1, tagType: 'success' as const }] : [],
    slots,
    indexOffset: () => 0,
    defaults: resolveDefaults(defaultsIn),
    sortState,
  }
  return useColumns<Row>(opts)
}

// 按 key 找生成后的 Naive 列
function col(api: ReturnType<typeof build>, key: string) {
  return api.naiveColumns.value.find((c) => (c as { key?: string }).key === key) as Record<string, any>
}

describe('useColumns 消费全局默认', () => {
  it('align/titleAlign 默认取 defaults;列显式值优先', () => {
    const api = build(
      [
        { key: 'name', title: 'N' },
        { key: 'amt', title: 'A', align: 'right' },
      ],
      { align: 'left', titleAlign: 'left' },
    )
    expect(col(api, 'name').align).toBe('left')
    expect(col(api, 'name').titleAlign).toBe('left')
    expect(col(api, 'amt').align).toBe('right') // 列显式胜全局
  })

  it('空值渲染取 defaults.emptyText', () => {
    const api = build([{ key: 'st', title: 'S', format: 'money' }], { emptyText: 'N/A' })
    const render = col(api, 'st').render as (row: Row, i: number) => unknown
    expect(render({ name: 'x', st: null, amt: 0 }, 0)).toBe('N/A')
  })

  it('tag 样式取 defaults.tag', () => {
    const api = build([{ key: 'st', title: 'S', options: [{ label: 'A', value: 1 }], tag: true }], {
      tag: { size: 'medium', bordered: true },
    })
    const render = col(api, 'st').render as (row: Row, i: number) => VNode
    const vnode = render({ name: 'x', st: 1, amt: 0 }, 0)
    expect(vnode.props?.size).toBe('medium')
    expect(vnode.props?.bordered).toBe(true)
  })

  it('index 列宽/对齐取 defaults', () => {
    const api = build([{ type: 'index' }, { key: 'name', title: 'N' }], { indexWidth: 80, align: 'left' })
    const idx = col(api, '__index')
    expect(idx.width).toBe(80)
    expect(idx.align).toBe('left')
  })

  it('sorter 列受控回显:命中列取 sortState.order,其余 sortable 列为 false', () => {
    const state = { field: 'amt', order: 'descend' as const }
    const api = build(
      [
        { key: 'name', title: 'N', sorter: true },
        { key: 'amt', title: 'A', sorter: true },
      ],
      undefined,
      {},
      () => state,
    )
    expect(col(api, 'amt').sortOrder).toBe('descend') // 命中
    expect(col(api, 'name').sortOrder).toBe(false) // 其余 sortable 列受控为 false
  })

  it('无 sortState 时 sorter 列 sortOrder 为 false;非 sorter 列不设 sortOrder', () => {
    const api = build([
      { key: 'name', title: 'N', sorter: true },
      { key: 'amt', title: 'A' },
    ])
    expect(col(api, 'name').sortOrder).toBe(false)
    expect('sortOrder' in col(api, 'amt')).toBe(false)
  })

  it('#header-{key} 插槽覆盖表头(列无函数 title 时)', () => {
    const api = build([{ key: 'name', title: 'N' }], undefined, {
      'header-name': () => 'CUSTOM',
    } as unknown as Slots)
    const title = col(api, 'name').title as () => unknown
    expect(typeof title).toBe('function')
    expect(title()).toBe('CUSTOM')
  })
})
