## 1. 类型定义与数据模型

- [x] 1.1 在 `src/types/x4.ts` 中新增 `StationType` 类型定义
- [x] 1.2 在 `src/types/x4.ts` 中新增 `EmpirePlan` 接口定义
- [x] 1.3 在 `src/types/x4.ts` 中新增 `V2StorageState` 接口定义
- [x] 1.4 更新 `StationPlan` 接口，添加 `type` 字段

## 2. Empire Store 实现

- [x] 2.1 创建 `src/store/useEmpireStore.ts` 文件
- [x] 2.2 实现 V2 数据结构状态管理（version, activeEmpireId, activeStationId, empires）
- [x] 2.3 实现 `activeEmpire` 计算属性
- [x] 2.4 实现 `activeStation` 计算属性
- [x] 2.5 实现 V1 → V2 数据迁移逻辑 `migrateFromV1()`
- [x] 2.6 实现分站 CRUD 操作（createStation, deleteStation, duplicateStation）
- [x] 2.7 实现帝国总工人需求计算 `totalWorkforceNeeded`
- [x] 2.8 实现 localStorage 持久化与恢复

## 3. Station Store 重构

- [x] 3.1 重构 `useStationStore.ts`，移除持久化逻辑
- [x] 3.2 修改 `useStationStore.ts` 接收外部数据源（通过 provide/inject 或 props）
- [x] 3.3 确保计算逻辑与数据源解耦

## 4. 标签栏模块实现

### 4.1 StationTabBar 组件 (当前实现)
- [x] 4.1.1 创建 `src/components/StationTabBar.vue` 组件
- [x] 4.1.2 实现固定"帝国总览"标签
- [x] 4.1.3 实现动态分站标签列表
- [x] 4.1.4 实现 [+] 新建分站按钮
- [x] 4.1.5 实现标签选中状态样式
- [x] 4.1.6 实现分站右键菜单（重命名、复制、导入、删除）
- [x] 4.1.7 实现删除分站确认对话框

### 4.2 模块化重构 (规划中)
- [ ] 4.2.1 创建 `src/components/StationTabBar/` 目录
- [ ] 4.2.2 拆分 `StationTab.vue` 单标签组件
- [ ] 4.2.3 拆分 `StationContextMenu.vue` 右键菜单组件
- [ ] 4.2.4 创建 `types.ts` 类型定义
- [ ] 4.2.5 重构主组件使用子组件

## 5. 动态工具栏组件实现

- [x] 5.1 创建 `src/components/ContextToolbar.vue` 组件
- [x] 5.2 实现帝国总览工具栏（方案名称输入框）
- [x] 5.3 实现分站工具栏第一组：身份定义（导入、名称、类型徽章、数量）
- [x] 5.4 实现分站工具栏第二组：环境参数（星区矿物、日光强度）
- [x] 5.5 实现分站工具栏第三组：技术与运营（种族、工人运算、站内补给）
- [x] 5.6 实现工人运算开关与 `considerWorkforceForAutoFill` 绑定
- [x] 5.7 实现站内补给开关与 `supplyWorkforceBonus` 绑定
- [x] 5.8 实现星区矿物多选菜单（从 useGameDataStore 获取 tier=0 矿物）

## 6. 工作台架构重构

- [x] 6.1 重构 `StationWorkbench.vue` 布局结构
- [x] 6.2 集成 StationTabBar 组件
- [x] 6.3 集成 ContextToolbar 组件
- [x] 6.4 实现内容区域切换逻辑（总览 vs 分站）
- [x] 6.5 创建帝国总览占位视图组件
- [x] 6.6 实现分站视图数据绑定到当前选中分站
- [x] 6.7 修改 `LoadPlanModal.vue`，模块列表预览改为空间站计划预览

## 7. 补给站计算逻辑

- [x] 7.1 实现补给站类型判断逻辑
- [x] 7.2 实现补给站根据帝国总工人需求生成补给模块
- [x] 7.3 实现工业站 `supplyWorkforceBonus=false` 时不生成补给区

## 8. 国际化支持

- [x] 8.1 在 `src/locales/zh-CN.json` 添加多站相关翻译键
- [x] 8.2 在 `src/locales/en.json` 添加多站相关翻译键
- [x] 8.3 添加分站类型翻译（工业站、补给站等）

## 9. 数据迁移与兼容性

- [x] 9.1 实现启动时自动检测 V1 数据
- [x] 9.2 实现 V1 数据迁移到 V2 格式
- [x] 9.3 迁移后清理旧的 localStorage 键
- [x] 9.4 添加迁移失败回滚逻辑

## 10. 测试与验证

- [x] 10.1 验证 V1 数据迁移正确性
- [x] 10.2 验证分站 CRUD 操作
- [x] 10.3 验证标签切换功能
- [x] 10.4 验证工具栏动态切换
- [x] 10.5 验证补给站计算逻辑
- [x] 10.6 验证站内补给开关功能
