// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'
import { FILLER_COLUMN_KEY } from '../src/useColumns'
import type { SmartTableColumn } from '../src/types'

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
