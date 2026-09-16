// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { NDataTable } from 'naive-ui'
import SmartTable from '../src/SmartTable.vue'

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
