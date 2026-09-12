<script setup lang="ts">
// 主 demo:列驱动搜索表单、远程分页、字典/tag/格式化渲染、工具栏、列设置持久化。
import { h } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { SmartTable, type SmartTableColumn } from '../src/index'
import { fetchDeptOptions, mockPage, type DemoRow } from './mock'
import { labels, tt } from './locale'

const message = useMessage()

const statusOptions = [
  { label: tt('在职', 'Active'), value: 1, tagType: 'success' as const },
  { label: tt('休假', 'On leave'), value: 2, tagType: 'warning' as const },
  { label: tt('离职', 'Resigned'), value: 3, tagType: 'error' as const },
]

const enabledOptions = [
  { label: tt('启用', 'Enabled'), value: true, tagType: 'success' as const },
  { label: tt('禁用', 'Disabled'), value: false, tagType: 'default' as const },
]

const columns: SmartTableColumn<DemoRow>[] = [
  { type: 'index', fixed: 'left' },
  { key: 'account', title: tt('账号', 'Account'), width: 120, search: true },
  { key: 'name', title: tt('姓名', 'Name'), width: 110, search: true },
  { key: 'deptId', title: tt('部门', 'Department'), width: 110, options: fetchDeptOptions, search: true },
  { key: 'status', title: tt('状态', 'Status'), width: 100, options: statusOptions, tag: true, search: true },
  { key: 'enabled', title: tt('启用', 'Enabled'), width: 100, options: enabledOptions, tag: true, search: true },
  { key: 'salary', title: tt('薪资', 'Salary'), width: 110, align: 'right', format: 'money' },
  {
    key: 'createTime',
    title: tt('创建时间', 'Created'),
    width: 180,
    format: 'datetime',
    search: { type: 'daterange', key: 'createRange' },
  },
  { key: 'email', title: 'Email', minWidth: 200, hide: true },
  {
    key: 'actions',
    title: tt('操作', 'Actions'),
    width: 100,
    fixed: 'right',
    hideInSetting: true,
    render: (row) =>
      h(
        NButton,
        { size: 'small', quaternary: true, type: 'primary', onClick: () => message.info(`row #${row.id}`) },
        () => (tt('详情', 'View')())
      ),
  },
]
</script>

<template>
  <SmartTable
    :columns="columns"
    :fetcher="mockPage"
    :title="tt('人员列表', 'Staff')()"
    :labels="labels"
    storage-key="demo-basic"
    @error="(e) => message.error(String(e))"
  />
</template>
