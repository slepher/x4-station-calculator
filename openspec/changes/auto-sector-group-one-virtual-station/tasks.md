# auto-sector-group-one-virtual-station Tasks

## 1. Store draft 状态

- [ ] 在 `useLiveProductionStore` 中新增 virtual station draft 状态
- [ ] 在生成 `autoGroupResult.groups` 时初始化 virtual station draft
- [ ] 初始化时从现有 binding 读取无 `saveStationCode` 的 `BindingStationPlan`
- [ ] 组件挂载或打开 Virtual Station tab 不得覆盖已有 draft
- [ ] [计算] / [快速计算] 后保留当前 virtual station draft
- [ ] groups 变化后重算 virtual station 的 group 归属
- [ ] 支持未分组 virtual station draft 状态

## 2. Virtual Station tab

- [ ] Map `AutoSectorGroupPanel layout="tabs"` 增加 `virtualStation` tab
- [ ] Live `layout="columns"` 不显示 Virtual Station tab
- [ ] Virtual Station tab 不受 Hub edit/result 或其他 tab 激活状态限制
- [ ] Virtual Station tab 顶部复用 binding `blueprintEmpireId` 选择 blueprint empire
- [ ] Blueprint station 列表参照 Step 3 样式
- [ ] Blueprint station 列表增加“空白空间站”项
- [ ] 虚拟空间站列表按当前 groups 顺序分组
- [ ] item 显示“虚拟空间站”、sector 名、坐标和 `×`
- [ ] item 不显示 group 名
- [ ] 未分组区域显示提交时移除说明

## 3. Virtual Station 拖拽与删除

- [ ] 从 blueprint station 拖拽创建 virtual station draft
- [ ] 从 blueprint station 复制 `name/type/modules/settings/lockedWares/warePriority`
- [ ] 不复制 source station 的 `id`、`sectorId` 或持续同步引用
- [ ] 空白空间站拖拽创建默认 industrial 空 module draft
- [ ] 已存在 virtual station 拖拽时携带 draft id
- [ ] 已存在 virtual station 拖拽只更新当前 draft，不创建重复 plan
- [ ] drop 到无 group 覆盖 sector 时拒绝并保持原位置
- [ ] 异常多 group 命中时拒绝，不做 fallback 决胜
- [ ] `×` 删除只删除 draft，不直接写 binding

## 4. 地图 overlay 数据流

- [ ] Map binding overlay 从 virtual station draft 渲染虚拟生产空间站
- [ ] Map binding 打开后即可拖动 virtual station overlay，不要求 Virtual Station tab 激活
- [ ] Overlay 视觉沿用现状，不新增视觉区分设计
- [ ] 拖拽结束时通过 presenter/store 更新 draft
- [ ] 不再由 virtual station 拖拽直接调用 `saveBindingStore.upsertStationPlan`

## 5. 应用到 binding

- [ ] auto group 提交时先应用 groups，再应用 virtual station drafts
- [ ] 应用时只同步无 `saveStationCode` 的 station plans
- [ ] draft 中新增的 virtual station 创建到 binding
- [ ] draft 中已有的 virtual station 更新到 binding
- [ ] draft 中删除或仍未分组的 virtual station 从 binding 删除
- [ ] 带 `saveStationCode` 的 station plans 不被本流程修改

## 6. Virtual Trade Station draft 拖动

- [ ] virtual trade station 地图拖动改为更新 group draft position
- [ ] Map binding 打开后即可拖动 virtual trade station，不要求 Trade Station tab 激活
- [ ] virtual trade station drop 必须限制在 group hub sector
- [ ] 拖动不得修改 `TradeStationBinding.sectorMacro`
- [ ] 拖动不得修改 group `sectorMacro`、coverage 或 station plan
- [ ] Trade Station tab 中 virtual 选项显示当前坐标
- [ ] virtual trade station overlay 视觉沿用现状

## 7. Step 3 边界清理

- [ ] Virtual Station tab 替代 Step 3 的虚拟生产空间站创建/移动/删除入口
- [ ] 不迁入 save station 列表
- [ ] 不迁入 save station 绑定 blueprint station
- [ ] 不迁入 save station 导入模块规划
- [ ] 不迁入 save station 解绑后转 virtual station
- [ ] 不迁入 trade station / 中转站绑定
- [ ] 不迁入 station plan 详细模块/settings 编辑
- [ ] 不迁入 lockedWares / warePriority 编辑 UI

## 8. 构建验证

- [ ] 实现完成后运行 `npm run build`
