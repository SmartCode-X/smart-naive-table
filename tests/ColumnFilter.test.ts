// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { h, defineComponent } from 'vue'
import ColumnFilter from '../src/ColumnFilter.vue'
import type { FilterDef } from '../src/useColumns'
import type { SmartTableLabels } from '../src/types'

const labels = {
  filter: '过滤',
  filterReset: '重置',
  filterConfirm: '确定',
} as unknown as SmartTableLabels

let mountCount = 0
const TrackedPanel = defineComponent({
  setup() {
    mountCount++
    return () => h('div', { class: 'tracked-panel' }, 'panel')
  },
})

function buildDef(): FilterDef {
  return {
    key: 'deptId',
    field: 'deptId',
    optionsKey: 'deptId',
    mode: 'condition',
    multiple: false,
    type: 'input',
    actions: ['equal'],
    render: () => h(TrackedPanel),
  }
}

describe('ColumnFilter 自定义过滤面板', () => {
  it('拖拽/连续更新 value 时不应重新挂载自定义面板(否则交互中的控件会被打断重建)', async () => {
    mountCount = 0
    const wrapper = mount(ColumnFilter, {
      props: {
        def: buildDef(),
        value: null,
        labels,
        getOptions: () => [],
        isLoadingOptions: () => false,
      },
    })

    await wrapper.find('.smart-table-filter-trigger').trigger('click')
    await wrapper.vm.$nextTick()

    expect(mountCount).toBe(1)

    // 模拟自定义面板内部连续 setValue(如拖动 NSlider 期间父级 value prop 连续更新)
    await wrapper.setProps({ value: { logic: 'and', conditions: [{ action: 'equal', value: 1 }] } })
    await wrapper.setProps({ value: { logic: 'and', conditions: [{ action: 'equal', value: 2 }] } })
    await wrapper.setProps({ value: { logic: 'and', conditions: [{ action: 'equal', value: 3 }] } })

    expect(mountCount).toBe(1)

    wrapper.unmount()
  })
})
