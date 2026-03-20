# Tasks: dlc-tag

## 1. DLC 判定模块
- [x] 1.1 新增独立的 DLC 判定模块，并定义统一导出接口。
- [x] 1.2 在模块中实现 XML 根节点识别，区分 patch XML 与非 patch XML。
- [x] 1.3 为模块定义可复用的实体规格输入，至少覆盖容器路径、实体标签与主键字段。

## 2. `ware.dlc_tag` 生成
- [x] 2.1 在 `processor` 中接入 DLC 判定模块，扫描 `wares/base.xml`。
- [x] 2.2 为 `base.xml` 中的 `/wares/ware[@id]` 输出 `dlc_tag = "base"`。
- [x] 2.3 支持对非 patch DLC `wares` 文件识别顶层新增 `ware`。
- [x] 2.4 支持对 patch DLC `wares` 文件识别 `add sel="/wares"` 下新增的 `ware`。
- [x] 2.5 将打到 `/wares/...` 下级路径的 patch 统一按修改处理，不改写已有 `dlc_tag`。

## 3. `cluster.dlc_tag` 生成
- [x] 3.1 在 `processor` 中为 `cluster` 接入 DLC 判定模块或等价来源层扫描逻辑。
- [x] 3.2 复用现有 map processor 的 cluster 稳定主键。
- [x] 3.3 为 `base.xml` 中的 cluster 输出 `dlc_tag = "base"`。
- [x] 3.4 为各 `<dlc-name>.xml` 中直接新增的 cluster 输出对应 `dlc_tag`。

## 4. 迁移传播
- [x] 4.1 在迁移阶段将 `ware.dlc_tag` 传递到 `module`。
- [x] 4.2 在迁移阶段将 `ware.dlc_tag` 传递到 `ship`。
- [x] 4.3 在迁移阶段将 `ware.dlc_tag` 传递到 `equipment`。
- [x] 4.4 在迁移阶段将 `ware.dlc_tag` 传递到 `drone`。
- [x] 4.5 在迁移阶段将 `ware.dlc_tag` 传递到 `consumable`。
- [x] 4.6 在迁移阶段将 `ware.dlc_tag` 传递到 `missile`。
- [x] 4.7 确保迁移阶段不重新执行 DLC 归属判断。

## 5. 输出 JSON 范围
- [x] 5.1 为 `wares.json` 中的 `ware` 增加 `dlc_tag`。
- [x] 5.2 为 `maps.json` 的 `clusters` 节点增加 `dlc_tag`。
- [x] 5.3 为 `modules.json`、`ships.json`、`equipments.json`、`drones.json`、`consumables.json`、`missiles.json` 增加继承后的 `dlc_tag`。
- [x] 5.4 确认 `bullets.json`、`module_groups.json`、`ship_types.json`、`ship_races.json`、`equipment_types.json`、`slot_tags.json`、`ship_slots.json`、`default_maxes.json` 不新增 `dlc_tag`。

## 6. 构建验证
- [x] 6.1 完成实现后执行 `npm run build`。
- [x] 6.2 确认处理输出中 `wares.json` 与 `maps.json` 的 `clusters` 已包含稳定的 `dlc_tag: string`。
- [x] 6.3 确认迁移后的 `modules.json`、`ships.json`、`equipments.json`、`drones.json`、`consumables.json`、`missiles.json` 已继承对应 `ware.dlc_tag`。
