<div align="center">

# smart-naive-table

基于 **Vue 3 + Naive UI** 的列驱动表格组件<br>
写好 `columns`、接上 `fetcher`，搜索表单、分页、字典翻译、列设置全部自动生成

[![npm](https://img.shields.io/npm/v/smart-naive-table?color=18a058)](https://www.npmjs.com/package/smart-naive-table)
[![license](https://img.shields.io/github/license/SmartCode-X/smart-naive-table?color=18a058)](./LICENSE)

简体中文 | [English](./README.en.md)

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-dark.png">
  <img alt="smart-naive-table 效果图" src="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-light.png">
</picture>

<p align="center">
  <a href="#快速上手">快速上手</a> ·
  <a href="#常用写法">常用写法</a> ·
  <a href="#全局配置与中文文案">中文文案</a> ·
  <a href="#api">API</a>
</p>

## 特性

- **列驱动**：列上加 `search` 就是搜索项，加 `options` 就能翻译单元格、生成下拉框，一处配置多处生效
- **一个函数对接后端**：`fetcher` 入参 `{ page, pageSize, ...搜索条件 }`，返回 `{ items, total }`
- **开箱即用的工具栏**：刷新、密度切换、列设置（显隐 / 拖拽排序 / 左右固定），可记住用户的设置
- **跟随 Naive 主题**：亮色 / 暗色、语言都跟随 `<n-config-provider>`
- **细节到位**：请求防竞态、空参数自动剔除、固定列宽度兜底、异步字典去重
- **轻量**：唯一运行时依赖 `sortablejs`（只在开启行拖拽时加载），ESM，自带 TypeScript 类型

## 安装

```bash
npm i smart-naive-table
```

项目中需已安装 `vue >= 3.3` 和 `naive-ui >= 2.34`。

## 快速上手

```vue
<script setup lang="ts">
import { SmartTable, type SmartTableColumn, type SmartTableFetcher } from 'smart-naive-table'

interface User {
  id: number
  account: string
  name: string
  status: number
  createTime: string
}

// ① 定义列：search 生成搜索项；options + tag 把状态值翻译成彩色标签
const columns: SmartTableColumn<User>[] = [
  { type: 'index' },
  { key: 'account', title: '账号', search: true },
  { key: 'name', title: '姓名', search: true },
  {
    key: 'status',
    title: '状态',
    search: true,
    tag: true,
    options: [
      { label: '在职', value: 1, tagType: 'success' },
      { label: '离职', value: 2, tagType: 'error' },
    ],
  },
  { key: 'createTime', title: '创建时间', format: 'datetime' },
]

// ② 对接后端：把接口返回值转换成 { items, total }
const fetcher: SmartTableFetcher<User> = async ({ page, pageSize, ...query }) => {
  const res = await getUserPage({ current: page, size: pageSize, ...query }) // 换成你的接口
  return { items: res.records, total: res.total }
}
</script>

<template>
  <!-- ③ 渲染；storage-key 用来记住用户的列设置 -->
  <SmartTable :columns="columns" :fetcher="fetcher" storage-key="user-list" />
</template>
```

这样就得到一个完整的列表页：

- **搜索区**：「账号」「姓名」输入框、「状态」下拉框（选项来自 `options`），以及查询 / 重置按钮
- **表格**：序号、状态标签、格式化后的时间，底部带分页
- **工具栏**：刷新、密度切换、列设置

点击「查询」时，`fetcher` 收到的参数（空值已自动剔除）：

```js
{ page: 1, pageSize: 10, account: 'user01', status: 1 }
```

> **提示**：把 SmartTable 放在 `<n-config-provider>` 内，主题和语言都跟随它。组件自带文案默认是英文，中文项目请看 [全局配置与中文文案](#全局配置与中文文案)。上图的完整代码见 [playground/DemoBasic.vue](./playground/DemoBasic.vue)。

## 常用写法

### 搜索项

```ts
{ key: 'name', title: '姓名', search: true }                           // 输入框
{ key: 'status', title: '状态', options: statusOptions, search: true } // 有 options 时自动用下拉框
{ key: 'age', title: '年龄', search: { type: 'number' } }              // 指定控件类型
{ key: 'keyword', title: '关键字', hideInTable: true, search: true }   // 只做搜索项，不显示成列

// 日期范围，并把参数名改为 createRange → fetcher 收到 createRange: ['2024-01-01', '2024-01-31']
{ key: 'createTime', title: '创建时间', search: { type: 'daterange', key: 'createRange' } }
```

控件类型：`input`（默认）、`number`、`select`、`date`、`daterange`、`switch`；需要完全自定义时用 `search.render`。全部字段见 [SearchConfig](#searchconfig)。

搜索区布局：

```vue
<SmartTable :search="{ collapsible: true, collapsedRows: 1 }" /> <!-- 超过 1 行时折叠，带展开 / 收起 -->
<SmartTable :search="{ layout: 'inline' }" />                    <!-- 无卡片、单行排列，适合窄栏 -->
<SmartTable :search="false" />                                   <!-- 不显示搜索区 -->
```

### 字典、标签与格式化

```ts
import type { SmartTableOption } from 'smart-naive-table'

const statusOptions: SmartTableOption[] = [
  { label: '在职', value: 1, tagType: 'success' },
  { label: '休假', value: 2, tagType: 'warning' },
  { label: '离职', value: 3, tagType: 'error' },
]

{ key: 'status', title: '状态', options: statusOptions, tag: true }   // 显示为彩色标签
{ key: 'deptId', title: '部门', options: () => api.getDeptOptions() } // 异步字典：自动 loading、并发去重
{ key: 'salary', title: '薪资', format: 'money' }                     // 6,000.00
{ key: 'birthday', title: '生日', format: 'date' }                    // 2024-01-01
{ key: 'score', title: '得分', format: (v) => `${v} 分` }             // 自定义格式
```

`options` 支持静态数组、`ref`、异步函数三种写法；异步字典可调用实例方法 `reloadOptions()` 重新拉取。

### 操作列与自定义单元格

```ts
import { h } from 'vue'
import { NButton } from 'naive-ui'

{
  key: 'actions',
  title: '操作',
  width: 120,
  fixed: 'right',
  hideInSetting: true, // 不出现在列设置面板里
  render: (row) => h(NButton, { text: true, type: 'primary', onClick: () => edit(row) }, () => '编辑'),
}
```

不想写 `render` 函数，也可以用插槽：

```vue
<SmartTable :columns="columns" :fetcher="fetcher">
  <template #cell-name="{ row }">
    <a @click="open(row)">{{ row.name }}</a>
  </template>
</SmartTable>
```

单元格渲染优先级：`render` → `#cell-{key}` 插槽 → `options` 翻译 → `format` → 原始值。

### 列设置

![列设置](https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/column-settings.png)

点击工具栏最右侧的图标打开，可以勾选显隐、拖拽排序、固定到左 / 右侧。

- 传了 `storage-key` 就会保存到 localStorage，刷新页面不丢失
- 列定义改动后自动合并：删掉的列被剔除，新增的列插到声明位置
- `hide: true` 初始隐藏（可在面板中勾回）；`hideInSetting: true` 不进面板

### 更多场景

| 场景 | 写法 |
|---|---|
| 服务端排序 | 列上写 `sorter: true`，`fetcher` 会收到 `sortField` 和 `sortOrder`（`'asc'` / `'desc'`） |
| 外部条件联动 | `:params="{ deptId }"`，值变化后自动回到第 1 页重新查询（如左侧部门树） |
| 静态数据 | 传 `:data="list"`、不传 `fetcher`，前端分页；监听 `@search` 自行过滤 |
| 树形表格 | 静态数据的行带 `children` 字段，并设置 `row-key` |
| 展开行 | 特殊列 `{ type: 'expand', renderExpand: (row) => ... }` |
| 多选 | 特殊列 `{ type: 'selection' }` + `v-model:checked-row-keys` |
| 主从表高亮 | `:active-row-key="currentId"` + `@row-click` |
| 行拖拽排序 | `row-draggable` + `@row-drag-sort`，组件只调整顺序，保存由你调用接口 |
| 列宽拖拽 | 列上写 `resizable: true` |
| 虚拟滚动 | `virtual-scroll` + `max-height` |
| 合计行 | `:summary="(pageData) => ..."` |
| 其它表格属性 | 直接写在 SmartTable 上，原样传给 `n-data-table`（如 `striped`、`bordered`） |

### 调用表格方法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { SmartTableInst } from 'smart-naive-table'

const tableRef = ref<SmartTableInst<User>>()

// 在需要的地方调用：
// tableRef.value?.refresh()  保持当前页刷新（如编辑之后）
// tableRef.value?.search()   回到第 1 页查询（如新增之后）
// tableRef.value?.reset()    清空搜索条件并查询
</script>

<template>
  <SmartTable ref="tableRef" :columns="columns" :fetcher="fetcher" />
</template>
```

### 增删改弹窗

`useTableCrud` 管理弹窗的打开、提交、删除状态，弹窗和表单用你自己的 `n-modal` + `n-form`：

```ts
import { useTableCrud } from 'smart-naive-table'

const crud = useTableCrud({
  form: () => ({ name: '', email: '' }), // 新增时的空表单
  create: (form) => api.create(form),
  update: (form, row: User) => api.update(row.id, form),
  remove: (row: User) => api.remove(row.id),
  onSuccess: () => tableRef.value?.refresh(),
})
```

```vue
<!-- 打开：crud.openCreate() 新增、crud.openEdit(row) 编辑；删除：crud.removeRow(row) -->
<n-modal v-model:show="crud.visible.value" preset="card" :title="crud.mode.value === 'create' ? '新增' : '编辑'">
  <n-form :model="crud.model.value">
    <n-form-item label="姓名"><n-input v-model:value="crud.model.value.name" /></n-form-item>
  </n-form>
  <template #footer>
    <n-button type="primary" :loading="crud.submitting.value" @click="crud.submit()">保存</n-button>
  </template>
</n-modal>
```

`crud.submit()` 成功后自动关闭弹窗并触发 `onSuccess`。完整示例见 [playground/DemoCrud.vue](./playground/DemoCrud.vue)。

## 全局配置与中文文案

组件自带的按钮文案（查询、重置、列设置等）默认是英文。在入口文件 `provide` 一次，所有表格都会生效：

```ts
// main.ts
import { createApp } from 'vue'
import { SMART_TABLE_DEFAULTS, createSmartTableDefaults } from 'smart-naive-table'
import App from './App.vue'

const app = createApp(App)

app.provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    labels: {
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
    },
    pageSizes: [10, 20, 50, 100],
  }),
)

app.mount('#app')
```

输入框占位符（"请输入"）和日期面板来自 Naive UI 自己的语言包，给 `<n-config-provider>` 配上即可：

```vue
<script setup lang="ts">
import { NConfigProvider, zhCN, dateZhCN } from 'naive-ui'
</script>

<template>
  <n-config-provider :locale="zhCN" :date-locale="dateZhCN">
    <!-- 你的页面 -->
  </n-config-provider>
</template>
```

- **多语言切换**：`labels` 传 `computed`，列 `title`、选项 `label` 写成函数 `() => t('xxx')`，切换语言立即生效
- **优先级**：表格上的属性 / 列上的值 > 全局默认 > 内置默认
- 全部可配置字段见 [全局默认字段](#全局默认字段)

## API

### 列配置

数据列支持 Naive UI 列的全部属性（`width`、`minWidth`、`fixed`、`align`、`ellipsis`、`sorter`、`resizable` 等），另外增加：

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | `string` | **必填**。行数据字段名，同时是搜索参数名、插槽名 |
| `title` | `string \| () => VNodeChild` | 列标题；写成函数可随语言切换 |
| `search` | `boolean \| SearchConfig` | 生成搜索项；`true` 时有 `options` 用下拉框，否则用输入框 |
| `options` | `Option[] \| Ref<Option[]> \| () => Promise<Option[]>` | 字典：翻译单元格，同时作为搜索下拉选项 |
| `tag` | `boolean` | 翻译结果显示为 `NTag`，颜色取选项的 `tagType` |
| `format` | `'date' \| 'datetime' \| 'money' \| (value, row) => string` | 格式化显示 |
| `render` | `(row, index) => VNodeChild` | 自定义单元格，优先级最高 |
| `hide` | `boolean` | 初始隐藏，可在列设置中勾回 |
| `hideInTable` | `boolean` | 只作为搜索项，不显示成列 |
| `hideInSetting` | `boolean` | 显示在表格中，但不出现在列设置里（常用于操作列） |
| `children` | `SmartTableDataColumn[]` | 多级表头 |

- **Option**：`{ label, value, tagType?, disabled?, children? }`，`tagType` 可选 `default` / `primary` / `info` / `success` / `warning` / `error`
- **特殊列**：`{ type: 'index' }` 序号（跨页连续）、`{ type: 'selection' }` 多选、`{ type: 'expand', renderExpand }` 展开行

### SearchConfig

| 字段 | 类型 | 说明 |
|---|---|---|
| `type` | `'input' \| 'number' \| 'select' \| 'date' \| 'daterange' \| 'switch'` | 控件类型 |
| `key` | `string` | 请求参数名，默认同列 `key` |
| `label` | `string \| () => string` | 表单标签，默认取列标题 |
| `placeholder` | `string` | 占位文字，默认用 Naive 语言包 |
| `defaultValue` | `any` | 初始值，也是重置后的值 |
| `order` | `number` | 排序，越小越靠前，默认按列顺序 |
| `span` | `number` | 占几格，默认 1 |
| `props` | `object` | 透传给对应的 Naive 控件 |
| `render` | `(ctx) => VNodeChild` | 完全自定义控件；`ctx` 含 `value`、`setValue`、`params`、`search` |

### Props

| 属性 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `columns` | `SmartTableColumn[]` | — | **必填**。列配置 |
| `fetcher` | `(params) => Promise<{ items, total }>` | — | 远程数据来源 |
| `data` | `T[]` | — | 静态数据（前端分页），与 `fetcher` 二选一 |
| `row-key` | `string \| (row) => key` | `'id'` | 行唯一标识 |
| `params` | `object` | — | 附加请求参数，变化后回到第 1 页重查 |
| `immediate` | `boolean` | `true` | 挂载后立即请求 |
| `default-page-size` | `number` | `10` | 默认每页条数 |
| `pagination` | `false \| PaginationProps` | — | `false` 隐藏分页；传对象与内置配置合并 |
| `search` | `false \| SearchFormConfig` | — | 搜索区配置（见下表）；`false` 隐藏 |
| `toolbar` | `false \| { refresh, density, columnSettings }` | 全部开启 | 工具栏按钮开关 |
| `title` | `string` | — | 表格标题，也可用 `#title` 插槽 |
| `storage-key` | `string` | — | 设置后，列设置和密度保存到 localStorage |
| `default-density` | `'comfortable' \| 'compact'` | `'comfortable'` | 默认密度 |
| `labels` | `Partial<SmartTableLabels>` | 英文 | 覆盖组件文案，传 `computed` 可随语言切换 |
| `active-row-key` | `string \| number \| null` | — | 高亮对应的行 |
| `row-draggable` | `boolean` | `false` | 开启行拖拽排序 |
| `drag-handle` | `string` | — | 拖拽手柄的 CSS 选择器，不传则整行可拖 |

其它未列出的属性（如 `striped`、`max-height`、`checked-row-keys`、`virtual-scroll`）会原样传给 `n-data-table`。

**SearchFormConfig**（`search` 属性的对象形式）：

| 字段 | 默认值 | 说明 |
|---|---|---|
| `layout` | `'grid'` | `'grid'` 卡片网格；`'inline'` 无卡片单行排列 |
| `cols` | `'1 s:2 m:3 l:4'` | 网格列数（按屏幕宽度响应） |
| `labelPlacement` | `'left'` | 标签位置：`'left'` / `'top'` |
| `labelWidth` | — | 标签宽度 |
| `collapsible` | `false` | 搜索项较多时折叠（仅 grid 布局） |
| `collapsedRows` | `1` | 折叠时保留的行数 |

### 事件

| 事件 | 参数 | 触发时机 |
|---|---|---|
| `search` | `params` | 点击查询（参数已清洗） |
| `reset` | — | 点击重置 |
| `loaded` | `rows, total` | 远程数据加载成功 |
| `error` | `err` | 请求失败（组件不弹提示，由你处理） |
| `row-click` | `row, index` | 点击行 |
| `row-drag-sort` | `{ from, to, reordered }` | 行拖拽结束 |

### 插槽

| 插槽 | 参数 | 说明 |
|---|---|---|
| `title` | — | 表格标题 |
| `toolbar` | — | 工具栏左侧，适合放新增、批量操作按钮 |
| `toolbar-right` | — | 工具栏右侧，位于内置按钮之前 |
| `cell-{key}` | `{ row, index }` | 自定义某列的单元格 |
| `header-{key}` | `{ column }` | 自定义某列的表头 |
| `empty` | — | 无数据时显示的内容 |
| `pagination-prefix` | Naive 分页信息 | 分页栏左侧，如"已选 3 项" |

### 实例方法

| 名称 | 说明 |
|---|---|
| `refresh()` | 保持当前页和查询条件，重新请求 |
| `search()` | 回到第 1 页查询 |
| `reset()` | 重置搜索条件并查询 |
| `reloadOptions(key?)` | 重新加载异步字典；不传 `key` 则全部重新加载 |
| `loading` / `rows` / `pagination` | 加载状态、当前行数据、分页状态 |
| `params` | 响应式搜索参数，可直接读写 |
| `tableRef` | 原生 `NDataTable` 实例（可调用 `scrollTo` 等） |

### 全局默认字段

通过 `createSmartTableDefaults({...})` 设置，均为可选：

| 字段 | 内置默认 | 说明 |
|---|---|---|
| `labels` | 英文 | 组件文案，可传 `ref` / `computed` |
| `align` / `titleAlign` | `'center'` | 单元格 / 表头对齐方式 |
| `emptyText` | `'—'` | 空值占位符 |
| `pageSizes` | `[10, 20, 50]` | 每页条数选项 |
| `showSizePicker` | `true` | 是否显示每页条数选择器 |
| `density` | `'comfortable'` | 默认密度 |
| `dateValueFormat` | `'yyyy-MM-dd'` | 日期搜索项的值格式 |
| `searchCols` | `'1 s:2 m:3 l:4'` | 搜索区网格列数 |
| `fixedFallbackWidth` | `120` | 固定列未写宽度时的兜底宽度 |
| `indexWidth` | `64` | 序号列宽度 |
| `tag` | `{ size: 'small', bordered: false }` | `tag: true` 列的标签样式 |
| `activeRowBg` | — | 高亮行的背景色 |

### 其它导出

- `useSmartTable(fetcher, options)`：组件内部使用的数据核心（加载、分页、搜索、防竞态），不依赖 UI，可自己搭界面
- `cleanParams`、`formatDate`、`formatDatetime`、`formatMoney`、`defaultLabels` 等工具函数
- 全部类型：`SmartTableColumn`、`SmartTableFetcher`、`SmartTableInst`、`SmartTableOption`、`SearchConfig` 等

## 行为说明

- 请求前自动清洗搜索参数：字符串去掉首尾空格；空串、`null`、`undefined`、空数组不传；`0` 和 `false` 保留
- 快速翻页时，先发出、后返回的旧响应会被丢弃，不会覆盖新数据
- 重置时搜索项恢复为 `defaultValue`，没有则为 `null`
- 固定列未写 `width` 时自动补上宽度（`minWidth` 或 120），避免 Naive 固定列错位
- `scroll-x` 默认等于可见列的宽度之和，手动传入则以你的为准

## 本地开发

```bash
npm install
npm run dev        # 启动 playground（本页截图即来自这里）
npm test           # 单元测试
npm run typecheck  # 类型检查
npm run build      # 构建到 dist/
```

**分支与发布**：日常开发在 `dev` 分支，通过 PR 合并到 `main`。发布新版本时，先在 `dev` 上执行 `npm version patch --no-git-tag-version`（或 `minor` / `major`）并更新 [CHANGELOG](./CHANGELOG.md)，合并到 `main` 后会自动发布到 npm 并创建 GitHub Release。

## License

[Apache-2.0](./LICENSE)
