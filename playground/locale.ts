import { computed, ref } from 'vue'
import type { SmartTableLabels } from '../src/index'

/** playground 的极简双语开关:演示 labels prop 与函数型列标题的语言响应。 */
export const locale = ref<'zh' | 'en'>('zh')

/** 函数型文案:渲染期求值,切语言即时生效(与宿主用 vue-i18n 的 () => t() 同机制)。 */
export const tt = (zh: string, en: string) => () => (locale.value === 'zh' ? zh : en)

const zhLabels: SmartTableLabels = {
  search: '查询',
  reset: '重置',
  refresh: '刷新',
  density: '密度',
  densityComfortable: '舒适',
  densityCompact: '紧凑',
  columnSettings: '列设置',
  columnSettingsReset: '恢复默认',
  fixedLeft: '固定到左侧',
  fixedRight: '固定到右侧',
  fixedNone: '取消固定',
  expand: '展开',
  collapse: '收起',
  filter: '过滤',
  filterConfirm: '确定',
  filterReset: '重置',
  filterSelectAll: '全选',
  filterEqual: '等于',
  filterNotEqual: '不等于',
  filterContains: '包含',
  filterNotContains: '不包含',
  filterGt: '大于',
  filterGte: '大于等于',
  filterLt: '小于',
  filterLte: '小于等于',
}

/** zh 传中文包;en 传 undefined 走包内英文默认。 */
export const labels = computed(() => (locale.value === 'zh' ? zhLabels : undefined))
