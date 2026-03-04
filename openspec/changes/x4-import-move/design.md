# x4-import-move 设计说明

## 设计目标
- 不改变用户入口习惯，统一导入体验。
- 最大化复用既有导入逻辑和弹窗链路，降低回归风险。

## 方案
1. 在 `StationWorkbench` 提升导入 modal 状态为共享状态。
2. `StationToolbar` 与 `ContextToolbar` 通过事件触发同一导入 modal。
3. `ImportPlanModal` 升级为 3-tab 容器：
   - logic-flow:
     - 导入目标由当前界面自动判定，不提供手动切换目标 UI。
     - 将 flow 导入主体内容内嵌在当前 Tab 内（不再通过按钮弹出旧 modal）。
     - 通过 `LogicFlowImportBody` 复用旧导入主体逻辑；`LogicFlowImportModal` 保留壳层复用该 body，确保兼容。
   - 游戏蓝图: 改为 XML 文件上传流程，解析后展示模块数量，再确认导入。
     - 帝国界面：自动创建新空间站并导入。
     - 空间站界面：
       - 当前空间站为空：直接导入当前空间站。
     - 当前空间站非空：弹出 `覆盖 / 添加 / 新空间站` 选择。
     - 新空间站命名：XML 名称优先，否则取文件名（去扩展名）前 20 字。
   - x4-station 字符串:
     - 仅支持 x4-game 分享链接/串格式（`l=@$module-...`）。
     - 帝国界面导入时新建空间站并导入；命名使用 `empire.new_station_name`（与“新建空间站”按钮一致）。
     - 空间站界面导入时覆盖当前活动空间站。
   - 3-tab UI：复用 `TopViewSwitch` 视觉风格，放置在标题栏右侧，与标题同一行。
   - 保持 logic-flow 空间站/帝国导入子页面视觉风格不变（沿用既有 `LogicFlowImportModal` 样式）。
4. 抽离 `TopViewSwitch` 组件承载 production/flow/ship-build 切换。

## 兼容性策略
- 入口按钮位置与可见性不变。
- ContextToolbar 逻辑流导入按钮 testid 保持：
  - `logicflow-import-entry-station`
  - `logicflow-import-entry-empire`
- 旧导入 modal 文件名保持不变，降低调用方改动范围。

## 风险与缓解
- 风险：logic-flow 导入流程迁移可能影响确认弹窗链路。
- 缓解：沿用原有实现逻辑与组件，仅改变触发位置和容器组织。
