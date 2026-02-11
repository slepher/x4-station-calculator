# Test Tasks: Station Dashboard Views

- [x] **Test 1: Stats Bar 准确性验证**
  - [x] **价格**: 切换 `buildPriceMultiplier`，验证 Stats Bar 的 Total Price 随之变化。
  - [x] **简化显示**: 验证价格显示为 175M/123K 等简化格式。
  - [x] **时间**: 验证 Stats Bar 的 Total Time 是否等于所有工业模块建造时间之和。
  - [x] **总需求**: 验证 Stats Bar 的 Total Needed 显示正确。
  - [x] **效率**: 
    - [x] 调整劳动力管理滑动条，验证 Stats Bar 的 Workers Efficiency 实时更新。
    - [x] 验证上限：当当前工人 >= 总需求时，效率 SHALL 封顶显示为 100%。

- [x] **Test 2: 工人视图 (Workers View) 专项测试**
  - [x] **控制面板**: 验证在工人视图底部可见滑动条、自动计算开关和 PHQ 开关（复刻 StationWorkforce）。
  - [x] **PHQ 联动**: 开启 PHQ 开关，验证 `StationAnalysis` 中 `playerHQNeeded` 为 200，且 `totalNeeded` 同步增加 200。
  - [x] **列表验证**: 验证工人视图列表的“劳动力平衡”组中出现“总部”条目。
  - [x] **展开逻辑**: 验证汇总行展开显示 Total Capacity/Needed，模块行展开显示单体容量/需求，颜色符合绿/红规范。
  - [x] **字体**: 验证明细行字体 SHALL 为 `text-xs`。

- [x] **Test 3: 时间视图 (Time View) 专项测试**
  - [x] **格式化**: 
    - [x] 验证 < 48h 时 HH 可超过 24。
    - [x] 验证 >= 48h 时显示为 `XD HH:MM:SS`。
  - [x] **展开逻辑**: 验证汇总行和模块行均 SHALL 为可展开，显示单体建造时间。

- [x] **Test 4: 数据源一致性验证**
  - [x] **对比**: 开启/关闭“自动补足缺口”，验证仪表盘数据与 WareFlow 的资源需求是否保持步调一致（即均基于 `allIndustryModules`）。

- [x] **Test 5: 劳动力管理集成验证**
  - [x] **控制面板**: 验证在工人视图底部可以看到滑动条、自动计算开关和 PHQ 开关。
  - [x] **滑动条联动**: 调整滑动条，验证 Stats Bar 的效率百分比随之实时更新。

- [x] **Test 6: i18n 专项测试 (New)**
  - [x] **英文模式**: 验证 Stats Bar 标签翻译正确（TOTAL PRICE, TOTAL NEEDED, WORKFORCE EFFICIENCY）。
  - [x] **游戏文本**: 验证 PHQ 正确翻译为“总部”或“Headquarters”。
