# terraforming-view Tasks

## 当前实现清单

### 左列

- [x] 星区名称通过 presenter 提供的 i18n 映射显示
- [x] 当前星区 tag 已接入
- [x] objective 文本与完成状态已接入
- [x] accordion 为单展开模式

### 中列：任务树

- [x] 按 `projectGroups` 顺序分组显示
- [x] `events` 与普通项目分开显示
- [x] 同组强制前置形成父子树
- [x] 跨组前置保留在原 group，只作为依赖信息展示
- [x] 一次性项目支持 toggle
- [x] 可重复项目支持次数输入
- [x] 可重复输入不再依赖 `projectMaxCounts` 预演

### 中列：条件区

- [x] stat 条件和项目前置条件已收敛到同一个 `condition-list`
- [x] 项目前置条件已使用与 stat 条件一致的容器风格
- [x] 可用态与阻塞态前置条件已统一为 `需要: ...` 文案
- [x] stat 条件已改为完整状态图，而不是裁切命中区
- [x] 命中区已改为连续外框表达
- [x] 无 `ranges` 的 stat 已改用数字显示
- [x] 条件区视觉微调当前集中在 `TerraformingStatScale.vue` 与 `TerraformingTaskList.vue`

### 右列：执行序列

- [x] execution timeline 已取代原三 tab 聚合视图
- [x] 每次执行记录为独立 entry
- [x] 单条 entry 支持展开查看消耗、交付、前后状态
- [x] 单条 entry 支持取消
- [x] 单条取消预演改为按需计算
- [x] 同组关系仅作视觉标记，不折叠、不合并

### Presenter 与性能边界

- [x] task tree 构造已与显示翻译解耦
- [x] presenter 承担 UI 组装职责
- [x] `cancelValidation` 已改为惰性计算
- [x] `projectMaxCounts` 已移除

## 当前待验证项

### 运行时与特殊星区

- [ ] 回归验证 `AtiyasMisfortune` 的 runtime stats、warming 事件和动态项目显示
- [ ] 回归验证 `OceanOfFantasy` 的 ignore stat 隐藏语义

### 执行序列

- [ ] 回归验证 execution timeline 在跨组插入后的同组标记断开行为
- [ ] 回归验证单条取消后后续记录的失效提示是否稳定

### 效果区

- [x] 统一 effect-list：stat effects + rebates + sideEffects 收敛为同类视觉卡片
- [x] effect-list-item 沿用 condition-dependency 布局（`rounded border px-2 py-1.5` + `flex gap`），配色区分
- [x] sideEffect 显示完整信息（概率、触发项目、stat 变化、回退）
- [x] 项目已完成时 sideEffect 概率显示为 100%
- [x] effect-list 对所有节点生效（events + 普通 + 子节点），不再仅 events 展示 sideEffects
- [x] rebate 名称通过 `module_groups.json` 或 `wares.json` 的 `nameId` 经 i18n 解析

### 视觉一致性

- [ ] 回归检查条件方块在深色背景下的可读性
- [ ] 回归检查实心/空心条件方块与命中外框的贴合感
- [ ] 回归检查容器高度、外框留白和文字间距在不同 stat 上是否一致

## 当前维护约束

- [ ] 后续继续调样式时，只调整 `TerraformingStatScale.vue` 和 `TerraformingTaskList.vue`，不要重新引入第二套条件语义
- [ ] 若继续优化性能，优先检查 presenter 边界和 timeline 惰性计算，不要恢复整树预翻译
- [ ] 不要重新引入未来总上限预测逻辑
- [ ] 不要把 execution timeline 回退为聚合资源表
