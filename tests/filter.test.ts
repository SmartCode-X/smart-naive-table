import { describe, expect, it } from 'vitest'
import {
  activeConditions,
  applyFilters,
  defaultFilterSerializer,
  filterValueToOptions,
  isFilterActive,
  matchCondition,
  matchFilterValue,
  optionsToFilterValue,
} from '../src/filter'
import type { FilterAction, FilterValue } from '../src/types'

function cond(action: FilterAction, value: unknown) {
  return { action, value }
}
function val(logic: 'and' | 'or', ...conds: Array<{ action: FilterAction; value: unknown }>): FilterValue {
  return { logic, conditions: conds }
}

describe('matchCondition', () => {
  it('equal / notEqual 跨字符串与数字(表单值常是字符串)', () => {
    expect(matchCondition(cond('equal', '3'), 3)).toBe(true)
    expect(matchCondition(cond('equal', 3), '3')).toBe(true)
    expect(matchCondition(cond('notEqual', 3), 4)).toBe(true)
    expect(matchCondition(cond('equal', false), false)).toBe(true)
    expect(matchCondition(cond('equal', true), false)).toBe(false)
  })

  it('contains / notContains 忽略大小写', () => {
    expect(matchCondition(cond('contains', 'AB'), 'xxabyy')).toBe(true)
    expect(matchCondition(cond('notContains', 'zz'), 'xxabyy')).toBe(true)
    expect(matchCondition(cond('contains', 'a'), 123)).toBe(false)
  })

  it('大小比较:数字按数值,字符串按字典序', () => {
    expect(matchCondition(cond('gt', 10), 11)).toBe(true)
    expect(matchCondition(cond('gt', 10), '9')).toBe(false) // 数值比较,不是 '9' > '10'
    expect(matchCondition(cond('gte', 10), 10)).toBe(true)
    expect(matchCondition(cond('lt', 10), 9)).toBe(true)
    expect(matchCondition(cond('lte', 10), 10)).toBe(true)
    expect(matchCondition(cond('gt', 'b'), 'c')).toBe(true)
  })

  it('空单元格:notEqual / notContains 为真,其余为假', () => {
    expect(matchCondition(cond('equal', 1), null)).toBe(false)
    expect(matchCondition(cond('notEqual', 1), null)).toBe(true)
    expect(matchCondition(cond('contains', 'a'), undefined)).toBe(false)
    expect(matchCondition(cond('notContains', 'a'), undefined)).toBe(true)
    expect(matchCondition(cond('gt', 1), null)).toBe(false)
  })

  it('过滤值是纯日期串时按「整天」比较,而不是时间戳点', () => {
    const cell = '2024-03-05T08:30:00.000Z'
    expect(matchCondition(cond('equal', '2024-03-05'), cell)).toBe(true)
    expect(matchCondition(cond('equal', '2024-03-06'), cell)).toBe(false)
    expect(matchCondition(cond('notEqual', '2024-03-05'), cell)).toBe(false)
    // 大于当天 = 当天结束之后;大于等于当天 = 当天零点起
    expect(matchCondition(cond('gt', '2024-03-05'), cell)).toBe(false)
    expect(matchCondition(cond('gte', '2024-03-05'), cell)).toBe(true)
    expect(matchCondition(cond('lt', '2024-03-05'), cell)).toBe(false)
    expect(matchCondition(cond('lte', '2024-03-05'), cell)).toBe(true)
    expect(matchCondition(cond('gt', '2024-03-04'), cell)).toBe(true)
  })

  it('纯日期过滤在西半球时区(UTC-11)运行时结果不变 —— 整天边界按 UTC 锚定,不随本地时区漂移', () => {
    const originalTZ = process.env.TZ
    try {
      process.env.TZ = 'Etc/GMT+11'
      const cell = '2024-03-05T08:30:00.000Z'
      expect(matchCondition(cond('equal', '2024-03-05'), cell)).toBe(true)
      expect(matchCondition(cond('equal', '2024-03-06'), cell)).toBe(false)
      expect(matchCondition(cond('gte', '2024-03-05'), cell)).toBe(true)
      expect(matchCondition(cond('lt', '2024-03-05'), cell)).toBe(false)
    } finally {
      process.env.TZ = originalTZ
    }
  })

  it('未识别的 action 视为不匹配,而不是放行全部行', () => {
    expect(matchCondition({ action: 'bogus' as FilterAction, value: 1 }, 1)).toBe(false)
    expect(matchCondition({ action: 'bogus' as FilterAction, value: 1 }, 999)).toBe(false)
  })

  it('数组单元格的 contains 按元素匹配,不把整个数组拼接成字符串比较', () => {
    expect(matchCondition(cond('contains', '1,2'), [1, 22, 3])).toBe(false)
    expect(matchCondition(cond('contains', '22'), [1, 22, 3])).toBe(true)
    expect(matchCondition(cond('notContains', '1,2'), [1, 22, 3])).toBe(true)
  })
})

describe('matchFilterValue', () => {
  it('and 全中,or 任一中', () => {
    const v = (logic: 'and' | 'or') => val(logic, cond('gt', 5), cond('lt', 3))
    expect(matchFilterValue(v('and'), 10)).toBe(false)
    expect(matchFilterValue(v('or'), 10)).toBe(true)
    expect(matchFilterValue(v('or'), 4)).toBe(false)
  })

  it('值为空的条件不参与求值;全空 = 未过滤,放行', () => {
    expect(activeConditions(val('and', cond('contains', ''), cond('equal', null)))).toEqual([])
    expect(matchFilterValue(val('and', cond('contains', '')), 'anything')).toBe(true)
    // 0 / false 是有效值,不算空
    expect(activeConditions(val('and', cond('equal', 0), cond('equal', false)))).toHaveLength(2)
  })

  it('isFilterActive 与 activeConditions 口径一致', () => {
    expect(isFilterActive(null)).toBe(false)
    expect(isFilterActive(val('and', cond('equal', '')))).toBe(false)
    expect(isFilterActive(val('and', cond('equal', 1)))).toBe(true)
  })
})

describe('applyFilters', () => {
  interface Row {
    name: string
    status: number
    salary: number
  }
  const rows: Row[] = [
    { name: 'alice', status: 1, salary: 9000 },
    { name: 'bob', status: 2, salary: 5000 },
    { name: 'carol', status: 1, salary: 12000 },
  ]
  const fields = [
    { key: 'name', field: 'name' },
    { key: 'status', field: 'status' },
    { key: 'salary', field: 'salary' },
  ]

  it('无生效过滤时原样返回', () => {
    expect(applyFilters(rows, fields, {})).toBe(rows)
    expect(applyFilters(rows, fields, { name: val('and', cond('contains', '')) })).toBe(rows)
  })

  it('列间恒为「与」,列内按 logic', () => {
    const out = applyFilters(rows, fields, {
      status: val('or', cond('equal', 1)),
      salary: val('and', cond('gt', 10000)),
    })
    expect(out.map((r) => r.name)).toEqual(['carol'])
  })

  it('勾选多个选项 = 若干 equal 取「或」', () => {
    const value = optionsToFilterValue([1, 2])!
    expect(value.logic).toBe('or')
    expect(applyFilters(rows, fields, { status: value })).toHaveLength(3)
    expect(applyFilters(rows, fields, { status: optionsToFilterValue([2])! })).toHaveLength(1)
    expect(optionsToFilterValue([])).toBeNull()
  })

  it('过滤键与数据字段可以不同(filter.key 覆写时)', () => {
    const out = applyFilters(rows, [{ key: 'q', field: 'name' }], { q: val('and', cond('contains', 'car')) })
    expect(out.map((r) => r.name)).toEqual(['carol'])
  })

  it('自定义 filter 接管匹配', () => {
    const out = applyFilters(rows, [{ key: 'name', field: 'name', filter: (_v, row) => row.salary < 6000 }], {
      name: val('and', cond('contains', 'zzz')),
    })
    expect(out.map((r) => r.name)).toEqual(['bob'])
  })
})

describe('filterValueToOptions', () => {
  it('是 optionsToFilterValue 的逆运算,并忽略非 equal 条件', () => {
    expect(filterValueToOptions(optionsToFilterValue([1, 'a']))).toEqual([1, 'a'])
    expect(filterValueToOptions(val('or', cond('equal', 1), cond('gt', 5)))).toEqual([1])
    expect(filterValueToOptions(null)).toEqual([])
  })
})

describe('defaultFilterSerializer', () => {
  it('产出 { filters: [...] },并剔除空条件与空列', () => {
    expect(
      defaultFilterSerializer({
        name: val('and', cond('contains', 'ali'), cond('equal', '')),
        status: val('or'),
      }),
    ).toEqual({
      filters: [{ field: 'name', logic: 'and', conditions: [cond('contains', 'ali')] }],
    })
  })

  it('全空时不产出 filters 键(避免给后端传空数组)', () => {
    expect(defaultFilterSerializer({})).toEqual({})
    expect(defaultFilterSerializer({ name: val('and', cond('equal', null)) })).toEqual({})
  })
})
