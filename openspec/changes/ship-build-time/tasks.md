# Ship Build Time 实现任务清单

## 任务分解

### 1. 数据导出链路

- [x] 1.1 在 `scripts/x4_data_processor.py` 中为 ship/equipment/drone/consumable/missile 导出 build time 字段
- [x] 1.2 build time 必须来自 `self.recipes[ware_id][method].time`，不得从宏性能字段推导
- [x] 1.3 保持 ship-build 相关实体的 cost 与 time 来自同一 method 配方

### 2. 类型定义

- [x] 2.1 在 `src/types/x4.ts` 中为 ship-build 相关实体补充建造时间字段
- [x] 2.2 新增统一的 `ShipBlueprintBuildAnalysis` 类型及其 group/item 类型

### 3. 统一蓝图建造分析 logic

- [x] 3.1 新增可复用的 ship blueprint build analysis logic 模块
- [x] 3.2 将 ship/equipment/storage 的材料、金额、时间分析统一收敛到该模块
- [x] 3.3 在该模块中实现 method 解析与 `default` fallback 规则
- [x] 3.4 确保 storage 条目（deployables / countermeasure / drones / missiles）保留在时间视图中，且 build time 固定为 `0`

### 4. Ship Build Store 接入

- [x] 4.1 在 `src/store/useShipBuildStore.ts` 中接入统一 build analysis logic
- [x] 4.2 暴露当前活动 blueprint 的统一建造分析结果
- [x] 4.3 保持后续其他 store 可直接复用同一 logic，不把算法绑死在 ship-build 页面

### 5. Presenter 与材料面板改造

- [x] 5.1 为 ship-build 材料面板新增 presenter 映射，基于统一 analysis 生成 `materials` / `time` tab 展示模型
- [x] 5.2 在 `ShipBuildPanelMaterials.vue` 中移除领域级材料分析 computed
- [x] 5.3 在 `ShipBuildPanelMaterials.vue` 中增加 `materials` 与 `time` tab
- [x] 5.4 时间 tab 复用当前材料面板的平铺聚合条目结构，不新增船体/装备/storage 分区标题
- [x] 5.5 时间 tab 的总计行显示总建造时间，平铺条目主值显示条目总建造时间，展开内容仅显示 `build time`
- [x] 5.6 保持现有材料 tab 行为可用，不因重构退化

### 6. 构建验证

- [x] 6.1 执行 `npm run build`
- [x] 6.2 如构建失败，修复实现代码后重新执行 `npm run build`，直到通过或出现明确 blocker

## 依赖顺序

1. 先完成数据导出链路，否则前端没有时间字段可消费
2. 再完成类型定义与统一 analysis logic
3. 然后接入 `useShipBuildStore`
4. 最后改造 presenter 与 `ShipBuildPanelMaterials.vue`
5. 完成后执行构建验证

## 实现注意事项

1. 时间字段必须取自 ware production 配方，而不是 macro 的性能时间字段
2. 材料与时间必须共享 method 与 fallback 规则
3. storage 组要保留在时间视图结构中，但条目时间固定为 `0`，且容量配置本身不是计时对象
4. 统一 analysis 必须可被 `build-plan` 复用
5. `tasks.md` 不包含测试编写或测试执行任务

## 范围边界

**包含**：
- 代码改造
- build 验证

**不包含**：
- 测试代码编写
- 测试执行与补测流程
- `build-plan` 页面功能实现
