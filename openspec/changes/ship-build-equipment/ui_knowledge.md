# UI Knowledge: ship-build-equipment

## 本轮测试执行备注（2026-02-25）

- 本轮已补齐并执行本 change 专属目录：
  - `tests/unit/ship-build-equipment`
  - `tests/e2e/ship-build-equipment`
- E2E 实际可用定位器（当前实现）：
  - 模式切换：`.mode-tabs .mode-tab`
  - 左侧槽位标签：`.left-rail .slot-type-btn`（炮塔为 `T`）
  - 分组标签：`.group-tabs .group-tab`
  - 候选卡片：`.option-wall .option-card`
- 本轮修复结果（本轮执行确认）：
  - 标签匹配规则已迁移为统一 `ALL` 匹配：`equipment.slotTags` 全量包含于 `connection.tags`，无 `hittable/unhittable` 等特判。
  - 兼容性标签展示规则已迁移为 6 标签白名单：`standard`、`advanced`、`xenon`、`mining`、`missile`、`highpower`。
  - 复杂塔位相关测试（`3.1/3.5/3.7`）统一使用大阪路径并通过。
  - `3.12` 通过 store 精确断言 `turret_xen_m_beam_02_mk1` 不在候选中，排除文本误判。
  - `3.14` 通过测试环境注入 `mockTagPatch` 验证 `M1/M2` 拆分标签。

## 页面区域与交互实体

- 上游入口：`ship-build` 视图内已选船状态。
- 配装区主体：建议新增独立容器 testid，例如 `ship-build-fit-panel`。
- 模式切换控件：建议 `ship-build-fit-mode-toggle`。
- 左侧 `slotType` 切换：建议 `ship-build-slot-type-tab-*`（仅渲染当前船存在类型）。
- group 标签：建议 `ship-build-group-tab-*`（不使用 `ALL`，显示 `L` 或 `M1/M2...`）。
- 标准模式行：建议 `ship-build-connection-row-*`（行内含主槽位区 + 护盾区）。
- 简化模式行：建议 `ship-build-group-row-*`（标签内含主槽位区 + 护盾区）。
- 候选下拉：建议 `ship-build-equipment-select-*`。
- 切换禁用提示：建议 `ship-build-fit-mode-disabled-reason`。

## 状态语义（供自动化与调试）

- `mode=connection`：按 connection group 展示与赋值。
- `mode=group`：按 group 聚合展示与批量赋值。
- 候选区域：固定为标准配装组件实现，不存在候选组件切换状态。
- `selectedByConnection`：单一真实状态源。
- `hasTypeConflict=true`：同一 `slot.type` 存在多装备分配，简化切换应禁用。

## 标准测试状态（新增）

- 状态 ID：`状态：标准测试状态-大太刀`。
  - 建立动作（state-switch actions）：
    - 切换到 `ship-build` 视图。
    - 若当前已选中其他飞船，先点击“更换飞船”回到选船列表。
    - 在筛选区选择：`class=M`、`race=terran`、`type=轻型护卫舰`。
    - 在结果列表选择“大太刀”。
  - 到位探针（state probes）：
    - 已发生“更换飞船”分支时，选船列表容器重新可见后再执行筛选。
    - 配装区容器 `ship-build-fit-panel` 可见。
    - 引擎/护盾/武器/炮塔四类分区可见且可操作。
    - 模式切换控件 `ship-build-fit-mode-toggle` 可见并可读取可用性状态。

- 状态 ID：`状态：标准测试状态-大阪`。
  - 建立动作（state-switch actions）：
    - 切换到 `ship-build` 视图。
    - 若当前已选中其他飞船，先点击“更换飞船”回到选船列表。
    - 在筛选区选择：`class=L`、`race=terran`、`type=驱逐舰`。
    - 在结果列表选择“大阪”。
  - 到位探针（state probes）：
    - 配装区容器可见。
    - `group_back_down_mid`、`group_back_mid_up`、`group_down_mid_left`、`group_down_mid_right` 的炮塔分组与计数区域可见。
    - 复杂塔位带盾相关测试默认入口为 `group_back_down_mid`。

- 状态 ID：`状态：标准测试状态-苍鹭`。
  - 建立动作（state-switch actions）：
    - 切换到 `ship-build` 视图。
    - 若当前已选中其他飞船，先点击“更换飞船”回到选船列表。
    - 在筛选区选择：`class=L`、`race=teladi`、`type=货船`。
    - 在结果列表选择“苍鹭”。
  - 到位探针（state probes）：
    - 配装区容器可见。
    - `group_front_top_center` 候选列表可正常展开。

- 切换终态 ID：`切换：标准模式->简化模式`。
  - 建立动作：从“状态：标准测试状态-大太刀”进入后执行模式切换。
  - 到位探针：group 聚合展示可见，且既有分配结果不变。

- 状态 ID：`状态：标准测试状态-大太刀-简化模式`。
  - 建立动作：从“状态：标准测试状态-大太刀”进入后执行模式切换。
  - 到位探针：group 聚合展示可见，且既有分配结果不变。

- 状态 ID：`状态：标准测试状态-大太刀-炮塔标签`。
  - 建立动作：从“状态：标准测试状态-大太刀”进入后，点击 `slotType=turret` 并选择 `con_turret_m_01` 标签。
  - 到位探针：当前分组标签为 `con_turret_m_01`，炮塔候选区可见。

- 状态 ID：`状态：冲突置灰-同 slot.type 多装备`。
  - 建立动作：从“状态：标准测试状态-大太刀”进入后，在同一 `slot.type` 下分配两种不同装备。
  - 到位探针：简化模式切换控件为禁用状态，且禁用原因提示可见。

- 状态 ID：`状态：标准测试状态-mock-同size不同tags拆分`。
  - 建立动作：
    - 先进入“状态：标准测试状态-大太刀”。
    - 向 `shipBuild` store 写入“基于大太刀格式”的 mock patch（见下方具体数据）。
    - 应用 patch 后切换到简化模式。
  - mock 数据约束：
    - `turret` 下存在两个 `medium` 连接组。
    - 组 A tags=`advanced+unhittable`。
    - 组 B tags=`advanced+missile`。
  - 到位探针：简化模式显示 `M1`、`M2` 两个标签，并分别映射到组 A / 组 B。

## 样本船语义映射（新增）

- `大太刀`：
  - 用途：advanced 配装基线样本（引擎/护盾/武器/炮塔）。
  - 推荐断言：四类分区均可展开候选，且存在可选 advanced 条目。
- `大阪`：
  - 用途：terran `L` 级驱逐舰高炮塔数量样本。
  - 推荐断言：炮塔相关 group 在高连接点数量下分组与计数稳定，无跨组误合并；复杂塔位相关测试（`3.1/3.5/3.7`）统一使用大阪。
- `苍鹭`：
  - 用途：teladi `L` 级货船筛选链路样本。
  - 推荐断言：按种族与类型筛选后可稳定进入配装区，候选列表正常可见。

## 标准状态数据化样本（用于标签规则用例）

- 状态：`状态：标准测试状态-大太刀`
  - connection group：`con_turret_m_01`
  - connection tags：`advanced+unhittable`
  - 断言要点（ALL 匹配）：
    - 仅当候选 `slotTags` 全量包含于 connection tags 时入选。
    - `hittable/unhittable` 不存在额外特判，仅作为普通标签参与 ALL 匹配。

- 状态：`状态：标准测试状态-大阪`
  - connection group：`group_back_down_mid`
  - connection tags：`hittable+missile+standard`（medium turret）
  - 反样本候选（用于 `noplayerblueprint=true` 过滤校验，应不出现）：
    - `turret_xen_m_beam_02_mk1`（`component+hittable+medium+standard+turret`，`noplayerblueprint=true`）
  - 兼容性标签断言要点：
    - 候选卡片兼容性标签栏仅显示 6 标签白名单。
    - 白名单过滤后无标签的候选卡片隐藏兼容性标签栏。

- 状态：`状态：标准测试状态-苍鹭`
  - connection group：`group_front_top_center`
  - connection tags：`hittable+missile+standard`（medium turret）
  - 用途：固定“候选列表可见性”验证入口，避免“任意候选列表”占位描述。

- 状态：`状态：标准测试状态-mock-同size不同tags拆分`
  - 数据来源：基于“大太刀”当前已选船数据进行 store patch，不依赖额外 seed。
  - store 写入目标（建议）：
    - `shipBuild.selectedShipId = "ship_ter_m_corvette_02_a"`
    - `shipBuild.mockTagPatch = { ... }`（如下）
  - 具体 patch payload（示例）：
    ```json
    {
      "targetShipId": "ship_ter_m_corvette_02_a",
      "slotType": "turret",
      "connections": {
        "ship_ter_m_corvette_02_a::turret::4::0": {
          "groupName": "con_turret_m_01",
          "size": "medium",
          "tags": ["advanced", "unhittable"]
        },
        "ship_ter_m_corvette_02_a::turret::4::1": {
          "groupName": "con_turret_m_02",
          "size": "medium",
          "tags": ["advanced", "missile"]
        }
      }
    }
    ```
  - 核心验证目标：同 `size=medium` 且不同 tags 的 `turret` 连接组必须拆分为 `M1` / `M2`。

## 聚合语义（关键）

- 主槽位聚合键：`slotType | size | tags`。
- 同 `slotType + size` 但 `tags` 不同必须拆分为不同聚合标签（如 `M1/M2`）。
- 护盾从属于父主槽位，不是独立顶层分组。
- 护盾聚合键：`slotType | slot.size | slot.tags | shield.size | shield.tags`。
- 护盾聚合输入范围：仅来自当前主槽位标签对应的 connection keys 派生 shield keys，不可跨标签全量收集。

## 候选过滤语义

- 数据源：`equipments.json` 全量。
- 必选约束：`type`、`size` 精确匹配。
- 排除规则：`noplayerblueprint=true` 的装备不参与候选。
- 标签规则：`equipment.slotTags` 必须全量包含于 `connection.tags`（ALL）。
- 特判规则：不允许 `hittable/unhittable`、`integrated` 等标签特判，全部按统一 ALL 规则处理。
- 例外：`connection.tags` 为空时，不做标签约束。
- 名称规则：候选装备名称通过 `equipment.nameId` i18n 翻译生成。

## 兼容性标签展示语义

- 白名单仅包含 6 标签：`standard`、`advanced`、`xenon`、`mining`、`missile`、`highpower`。
- 其他非白名单标签不展示。
- 某候选经过白名单过滤后无可显示标签时，隐藏整条兼容性标签栏。
- 文本来源：`slot_tags.json` 的 `nameId` i18n，不直接显示 tag id。
- 类型来源：`x4.ts` 中的 slot tag 类型定义，页面通过类型化映射读取 `slot_tags.json`。
- 翻译入口：`UseX4I18n.ts` 增加 slot tag 翻译方法，兼容性标签统一通过该入口输出。

## Web 断言建议

- 模式切换前后断言：
  - 列表形态变化（connection 行 <-> group 行）。
  - 同一 connection 的已配装备值不变。
- 标签断言：
  - 标准模式校验 `L`/`M1...` 标签命名。
  - 简化模式校验同 size 不同 tags 拆分标签。
- 护盾从属断言：
  - 在同一标签内同时可见主槽位区与护盾区。
  - `L`/`M` 标签的护盾计数互不污染（例如 `1` vs `6`）。
- 冲突灰态断言：
  - 在构造冲突后断言 toggle disabled。
  - 断言禁用提示文案可见。
  - BUG-001 复现语义：同组内“主槽位 + 从属护盾”各自已选时，不应触发冲突禁用；复杂塔位带盾用例使用大阪路径（`group_back_down_mid`）。
- 候选过滤断言：
  - 读取候选项并验证 type/size/slotTags 规则。
  - 验证 `noplayerblueprint=true` 的装备被排除。
  - 验证 `hittable/unhittable` 不存在特判，仅按 ALL 规则处理。
  - 验证兼容性标签栏仅显示 6 标签白名单。
  - 验证白名单过滤后无标签时兼容性标签栏隐藏。
  - 验证兼容性标签文本与 `slot_tags.json.nameId` 翻译一致，不回退为原始 tag id。
- 计数断言：
  - 各区显示真实 `selected/total`，不得固定 `0/1`。
- 卡片结构断言：
  - 候选卡片不含图片占位，仅包含名称与元信息文本。

## 与 test_tasks 对齐说明

- `test_tasks.md` 的状态项与切换项使用本文件的模式语义。
- `test_tasks.md` 的聚合与计数场景基于本文件“聚合语义（关键）”章节实现。
- `test_tasks.md` 的 `BUG-001` 复现场景对应本文件冲突灰态断言中的“主槽位+从属护盾不应误冲突”规则。
- 本次变更未涉及 `tests/fixtures/ware_fixtures.yaml` 与 `module_fixtures.yaml` 的产品/模块映射要求。
