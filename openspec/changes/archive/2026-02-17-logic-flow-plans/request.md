# Request: Logic Flow Plans

## 功能描述

将逻辑组网功能扩展为一个独立的方案系统，与空间站设计方案类似。用户可以在不同的逻辑组网方案之间保存、加载、切换。

## 业务背景

- 逻辑组网功能目前仅支持单一工作区，无法保存多个方案
- 用户在规划复杂产业链时，需要能够管理多个不同的逻辑组网方案
- 需要与空间站设计方案的管理体验保持一致

## 用户场景

### 场景 1: 创建并保存逻辑组网方案
1. 用户切换到逻辑组网视图（紫色主题）
2. 拖拽商品创建产线组
3. 点击保存按钮，输入方案名称
4. 方案保存到本地存储

### 场景 2: 加载已有方案
1. 用户点击加载按钮
2. 查看已保存的方案列表
3. 选择一个方案加载
4. 系统恢复产线组数据，自动重建 auto 节点

### 场景 3: 视图切换
1. 用户在生产视图和逻辑组网视图之间切换
2. 标题栏主题色随之变化（蓝色 ↔ 紫色）
3. 功能按钮行为对应各自的 Store

## 验收标准

### 功能验收
- [ ] 可以创建新的逻辑组网方案
- [ ] 可以保存当前方案（含脏检查）
- [ ] 可以另存为新方案
- [ ] 可以加载已保存的方案
- [ ] 可以删除方案
- [ ] 标题栏主题色根据视图正确切换
- [ ] 标题编辑功能正常工作
- [ ] 方案数据仅保存 manual 和 isolated 节点
- [ ] 加载方案时 auto 节点正确重建

### 技术验收
- [ ] 使用独立的 localStorage keys
- [ ] SmartSaveDialog 组件复用
- [ ] LoadFlowPlanModal 独立组件
- [ ] 两个 Store 数据完全隔离

## 技术约束

### 存储设计
- 方案列表: `x4_logic_flow_plans`
- 现有数据: `x4_logic_flow_data` 保持不变

### 数据结构
```typescript
interface LogicFlowPlan {
  id: string;
  name: string;
  groups: SavedFlowGroup[];
  settings: LogicFlowSettings;  // 方案级设置
  lastUpdated: number;
}

interface SavedFlowGroup {
  id: string;
  name: string;
  customName?: string;
  category: 'industrial' | 'agricultural';
  subCategory: string;
  isLocked: boolean;
  lockedLineage: string;
  nodes: SavedFlowNode[];  // 仅 manual 和 isolated
}

interface LogicFlowSettings {
  isDefaultLocked: boolean;  // 候选区锁定按钮状态
}
```

### 主题色映射
| 元素 | 生产视图 | 逻辑组网视图 |
|------|---------|-------------|
| 标题文字 | `text-sky-400` | `text-purple-400` |
| 新建按钮 | `btn-cyan` | `btn-fuchsia` |
| 保存按钮 | `btn-blue` | `btn-purple` |
| 加载按钮 | `btn-cyan` | `btn-fuchsia` |

## 讨论决策

### 决策 1: 组件复用策略
- **新建、保存、另存按钮**: 复用 SmartSaveDialog，通过 `storeType` prop 区分
- **加载对话框**: 创建独立的 LoadFlowPlanModal

### 决策 2: 存储位置
- 使用独立的 localStorage keys（选项 A）
- 与 `x4_logic_flow_data` 分离

### 决策 3: 方案数据格式
- 仅保存 manual 和 isolated 节点
- auto 节点在载入时通过 `expandUpstream` 重建

### 决策 4: 新建按钮行为
- 如果方案有修改，显示 SmartSaveDialog
- 与空间站方案行为一致

## 后续功能（不在本次范围）

- 从逻辑组网选择产线载入到空间站方案
- 导入功能实现
- 分享功能实现

## 依赖关系

- 依赖现有的 `useLogicFlowStore`
- 依赖现有的 `useStationStore`（视图切换）
- 依赖现有的 `SmartSaveDialog` 组件
