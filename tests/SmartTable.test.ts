// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import ColumnSettings from '../src/ColumnSettings.vue'
import { FILLER_COLUMN_KEY } from '../src/useColumns'
import type { SmartTableColumn } from '../src/types'

// sortablejs 是懒加载的运行时依赖;这里换成假的,只观察「有没有绑、绑到了哪个 tbody」
// (同 tests/useRowDrag.test.ts)。
const sortableCreated: { el: unknown; destroyed: boolean }[] = []
vi.mock('sortablejs', () => ({
  default: {
    create: (el: unknown) => {
      const inst = { el, destroyed: false, destroy: () => (inst.destroyed = true) }
      sortableCreated.push(inst)
      return inst
    },
  },
}))

/** 动态 import('sortablejs') 走的是微任务/宏任务,不是单个 nextTick 能等完的,多 flush 几轮。 */
async function flushSortableLoad() {
  for (let i = 0; i < 5; i++) {
    await nextTick()
    await Promise.resolve()
  }
}

interface Row {
  id: number
  name: string
}

const rows: Row[] = [
  { id: 1, name: 'alice' },
  { id: 2, name: 'bob' },
]

describe('SmartTable 列宽拖拽事件透传', () => {
  it('宿主自己也监听 onUnstableColumnResize 时,不应把两个处理函数合并成数组(否则 Naive 内部按函数调用会直接抛错)', () => {
    const hostCalls: unknown[][] = []
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: rows,
        rowKey: 'id',
      },
      attrs: {
        // 模拟宿主也在模板里写了 :on-unstable-column-resize="myHandler"(Vue 编译器保留字面拼写,
        // 不会把 kebab-case 的绑定键自动转成驼峰,所以这里必须用完全相同的字面 key 才能复现碰撞)。
        'on-unstable-column-resize': (...args: unknown[]) => hostCalls.push(args),
      },
    })

    const dataTable = wrapper.findComponent(NDataTable)
    const merged = dataTable.props('onUnstableColumnResize') as unknown

    expect(typeof merged).toBe('function')
    // 真正的回归点:Naive 内部对这个 prop 是当函数直接调用的(见 Header.mjs 的
    // onUnstableColumnResize(widthAfterResize, limitWidth, column, getColumnWidth)),
    // 数组会在这里直接抛 TypeError。
    expect(() => (merged as (...a: unknown[]) => void)(120, 120, { key: 'name' }, () => undefined)).not.toThrow()

    // 宿主自己的处理函数依然要被调用到(功能没有被吞掉,只是不能靠 Vue 的数组合并)
    expect(hostCalls).toHaveLength(1)
    expect(hostCalls[0]).toEqual([120, 120, { key: 'name' }, expect.any(Function)])

    wrapper.unmount()
  })

  it('拖拽手势松手发生在浏览器窗口之外(window 收不到 mouseup)时,window blur 兜底把宽度落账', () => {
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: rows,
        rowKey: 'id',
      },
    })
    const dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void

    resize(260, 260, { key: 'name' }, (k: string) => (k === 'name' ? 200 : undefined))
    // 不发 mouseup,直接模拟窗口失焦(拖出浏览器视口再松手,常见于把窗口开得不够宽的场景)
    window.dispatchEvent(new Event('blur'))

    const inst = wrapper.vm as unknown as { columnWidths: Record<string, number> }
    expect(inst.columnWidths.name).toBe(260) // blur 已经把这次手势的宽度落账

    // 手势已经结束,后续任何不相关的 mouseup 都不该再把宽度重新落一遍(resizingKey 已清空)
    window.dispatchEvent(new MouseEvent('mouseup'))
    expect(inst.columnWidths.name).toBe(260)

    wrapper.unmount()
  })
})
describe('SmartTable 列宽钉住后填满容器', () => {
  /** jsdom 没有 ResizeObserver,这里替一个能手动触发的桩,用来驱动组件里的容器测量。 */
  class ResizeObserverStub {
    static instances: ResizeObserverStub[] = []
    private cb: () => void
    constructor(cb: () => void) {
      this.cb = cb
      ResizeObserverStub.instances.push(this)
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    emit() {
      this.cb()
    }
  }

  const HOST_WIDTH = 900

  function mountWithHostWidth(columns: SmartTableColumn<unknown>[]) {
    ResizeObserverStub.instances = []
    vi.stubGlobal('ResizeObserver', ResizeObserverStub)
    const wrapper = mount(SmartTable, {
      props: { columns, data: rows, rowKey: 'id' },
      attachTo: document.body,
    })
    // 表格的包含块 = Naive 的横向滚动容器;jsdom 不排版,直接给它一个可见宽度
    const body = wrapper.element.querySelector('.n-data-table-base-table-body') as HTMLElement
    Object.defineProperty(body, 'clientWidth', { value: HOST_WIDTH, configurable: true })
    return wrapper
  }

  function emitResizeObserver() {
    ResizeObserverStub.instances.forEach((i) => i.emit())
  }

  it('列宽之和小于容器时补一列占位:表格总宽正好等于容器宽,右侧不留白,其余列保持拖出来的宽度', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 200, resizable: true },
      { key: 'op', title: 'Op', width: 200, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)

    // 走一遍真实拖拽:Naive 拖动中持续回调,松手落账,此后列宽进入钉住态
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    const actualWidths: Record<string, number> = { name: 200, op: 200 }
    resize(120, 120, { key: 'name' }, (k: string) => actualWidths[k])
    window.dispatchEvent(new MouseEvent('mouseup'))
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Array<{ key: string; width?: number }>
    expect(columns.map((c) => c.key)).toEqual(['name', FILLER_COLUMN_KEY, 'op'])
    // 拖窄后 120 + 操作列 200 = 320,占位列独自吃掉剩下的 580
    expect(columns[1].width).toBe(HOST_WIDTH - 320)
    expect(columns[0].width).toBe(120)
    expect(dataTable.props('scrollX')).toBe(HOST_WIDTH)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('已钉住的表格,拖拽进行中(松手之前)表格总宽也应等于容器宽度,不应中途露出留白', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 200, resizable: true },
      { key: 'op', title: 'Op', width: 200, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    const actualWidths: Record<string, number> = { name: 200, op: 200 }

    // 先走一遍完整拖拽,让表格进入钉住态(name 120 + op 200 + 占位 580 = 900)
    resize(120, 120, { key: 'name' }, (k: string) => actualWidths[k])
    window.dispatchEvent(new MouseEvent('mouseup'))
    emitResizeObserver()
    await nextTick()
    actualWidths.name = 120

    // 再次拖拽 name 列,但还没有松手(onUnstableColumnResize 在鼠标移动时持续触发)
    resize(200, 200, { key: 'name' }, (k: string) => actualWidths[k])
    await nextTick()

    // 拖拽中途,表格总宽仍应等于容器宽度:占位列要跟着 dragDelta 一起让出空间
    expect(dataTable.props('scrollX')).toBe(HOST_WIDTH)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('没拖过列宽(未钉住)时不补占位列 —— 拉伸交给 Naive 自己的 width:100%', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 200 },
      { key: 'op', title: 'Op', width: 200, fixed: 'right' },
    ])
    emitResizeObserver()
    await nextTick()

    const dataTable = wrapper.findComponent(NDataTable)
    const columns = dataTable.props('columns') as Array<{ key: string }>
    expect(columns.map((c) => c.key)).toEqual(['name', 'op'])
    expect(dataTable.props('scrollX')).toBe(400)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })

  it('列宽之和超过容器时不补占位列,照旧横向滚动', async () => {
    const wrapper = mountWithHostWidth([
      { key: 'name', title: 'Name', width: 800, resizable: true },
      { key: 'op', title: 'Op', width: 400, fixed: 'right' },
    ])
    const dataTable = wrapper.findComponent(NDataTable)

    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    const actualWidths: Record<string, number> = { name: 800, op: 400 }
    resize(800, 800, { key: 'name' }, (k: string) => actualWidths[k])
    window.dispatchEvent(new MouseEvent('mouseup'))
    emitResizeObserver()
    await nextTick()

    const columns = dataTable.props('columns') as Array<{ key: string }>
    expect(columns.map((c) => c.key)).toEqual(['name', 'op'])
    expect(dataTable.props('scrollX')).toBe(1200)

    wrapper.unmount()
    vi.unstubAllGlobals()
  })
})
describe('SmartTable 暴露的 filters / columnWidths 是只读快照', () => {
  // wrapper.vm 拿到的是 defineExpose 里那份对象,顶层 ref 会被自动解包 ——
  // inst.filters / inst.columnWidths 读到的就是 readonly() 包过的 FilterState / widths 本身。

  it('直接改 filters 不会生效 —— 绕开 setFilter 会漏发 onChange(远程模式漏一次重查)', () => {
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name', filter: true }], data: rows, rowKey: 'id' },
    })
    const inst = wrapper.vm as unknown as {
      filters: Record<string, unknown>
      setFilter: (key: string, value: unknown) => void
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    ;(inst.filters as Record<string, unknown>).name = { logic: 'and', conditions: [{ action: 'equal', value: 'x' }] }
    expect(inst.filters).toEqual({}) // 直接改被 readonly 挡下,内部过滤态没变

    inst.setFilter('name', { logic: 'and', conditions: [{ action: 'equal', value: 'alice' }] })
    expect(inst.filters.name).toBeTruthy() // 走正规入口(setFilter)才真正生效

    warn.mockRestore()
    wrapper.unmount()
  })

  it('直接改 columnWidths 不会生效 —— 绕开 setWidth 会漏掉 localStorage 持久化', () => {
    const wrapper = mount(SmartTable, {
      props: { columns: [{ key: 'name', title: 'Name', resizable: true }], data: rows, rowKey: 'id' },
    })
    const inst = wrapper.vm as unknown as { columnWidths: Record<string, number> }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    ;(inst.columnWidths as Record<string, number>).name = 999
    expect(inst.columnWidths).toEqual({})

    warn.mockRestore()
    wrapper.unmount()
  })
})
describe('SmartTable「恢复默认」强制重挂表格时,本地分页不该跳回第 1 页', () => {
  it('翻到第 3 页后拖了列宽再点恢复默认,重挂后的分页仍从第 3 页起始', async () => {
    const manyRows = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, name: `row${i + 1}` }))
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: manyRows,
        rowKey: 'id',
        pagination: { pageSize: 10 },
      },
    })

    // 先拖一次列宽(hadWidths 为 true,onResetSettings 才会触发重挂)
    let dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(220, 220, { key: 'name' }, (k: string) => (k === 'name' ? 200 : undefined))
    window.dispatchEvent(new MouseEvent('mouseup'))
    await nextTick()

    // 模拟用户翻到第 3 页(本地分页非受控,靠 onUpdatePage 通知我们)
    dataTable = wrapper.findComponent(NDataTable)
    const pagination = dataTable.props('pagination') as { onUpdatePage: (p: number) => void }
    pagination.onUpdatePage(3)
    await nextTick()

    // 点「恢复默认」:内部会因为 hadWidths 为 true 而 tableKey++ 强制重挂 <n-data-table>
    wrapper.findComponent(ColumnSettings).vm.$emit('reset')
    await nextTick()

    dataTable = wrapper.findComponent(NDataTable)
    const paginationAfter = dataTable.props('pagination') as { defaultPage?: number }
    expect(paginationAfter.defaultPage).toBe(3) // 重挂后的新实例仍从第 3 页起始,不掉回第 1 页

    wrapper.unmount()
  })
})
describe('SmartTable「恢复默认」强制重挂表格时,行拖拽要重新绑定', () => {
  it('tableKey 重挂后 sortable 实例要挂到新的 tbody 上,而不是继续挂着已经卸载的旧 tbody', async () => {
    sortableCreated.length = 0
    const wrapper = mount(SmartTable, {
      props: {
        columns: [{ key: 'name', title: 'Name', resizable: true }],
        data: [...rows],
        rowKey: 'id',
        rowDraggable: true,
      },
      attachTo: document.body,
    })
    await flushSortableLoad()
    expect(sortableCreated).toHaveLength(1)
    const firstTbody = sortableCreated[0].el

    // 拖一次列宽(hadWidths 为 true),再点「恢复默认」触发 tableKey++ 强制重挂
    let dataTable = wrapper.findComponent(NDataTable)
    const resize = dataTable.props('onUnstableColumnResize') as (...a: unknown[]) => void
    resize(220, 220, { key: 'name' }, (k: string) => (k === 'name' ? 200 : undefined))
    window.dispatchEvent(new MouseEvent('mouseup'))
    await flushSortableLoad()

    wrapper.findComponent(ColumnSettings).vm.$emit('reset')
    await flushSortableLoad()

    expect(sortableCreated.length).toBeGreaterThanOrEqual(2) // 重挂后补绑了新的一份
    const latest = sortableCreated[sortableCreated.length - 1]
    expect(latest.el).not.toBe(firstTbody) // 绑到的是新 tbody,不是已经卸载的旧的
    expect(latest.destroyed).toBe(false)

    wrapper.unmount()
  })
})
