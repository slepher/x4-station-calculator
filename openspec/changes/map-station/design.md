# map-station 设计说明

## 设计目标
在现有 `MapWorkbenchView` / `MapSvgCanvas` 地图工作台中引入一套与资源过滤工作面板并行的“空间站放置”能力，覆盖三类问题：
- 在地图上暴露当前 empire 的可放置对象（`station` 与 `sector` 中转点）
- 在目标 sector 内完成可视放置与原始坐标保存
- 将 `location` 作为 empire 输入的一部分持久化，并纳入 dirty 判断

## 1. UI 与交互设计

### 1.1 入口与布局切换
- 在 `MapWorkbenchView` 左下角增加 `station entry button`，样式与现有资源入口一致，保持文字 + 图标。
- 页面只允许一个地图工作面板处于打开态；当空间站面板打开时，地图进入“左侧栏 + 右地图”的工作态。
- 左侧栏作为 `map-layout` 的 sibling sidebar 存在，结构与资源过滤面板保持一致的布局等级，但内容换成“对象列表 + 放置操作区”。
- 为避免与最新地图布局冲突，空间站栏不得占用右侧搜索框/缩放面板区域。

### 1.2 面板信息组织
- 面板中的对象数据来自 `activeEmpire`：
  - `sectors` 列表作为“中转点对象”
  - `stations` 列表作为“空间站对象”
- 面板按 empire 结构分组，而不是按放置状态分组：
  - 分组顺序遵循 `activeEmpire.sectors` 的排序
  - 每个分组标题使用对应 `SectorPlan.name`
  - 组内先显示该 `sector` 自身的 transit 对象，再显示 `station.sectorId === sector.id` 的 stations
  - `station.sectorId` 为空的对象进入单独“未分配”分组
- 每个对象显示最小必要信息：
  - 名称
  - 图标（与星图 overlay 使用同源 SVG）
  - 拖动手柄
  - 已放置时提供内嵌在目标星区 tag 中的清除位置入口
- 已放置对象再次从面板拖出时，语义为“重新放置 / 移动”，不是复制。
- 面板内部拥有独立搜索框，仅过滤当前面板中的 `station / sector transit` 对象。
- 搜索框需要提供清空入口，不影响地图右上角星区搜索框。
- “未放置 / 已放置”两个区块共享同一个滚动容器；滚动条样式需与面板整体视觉一致。
- 已放置区块中的对象卡片不显示 `sector_id` 与坐标，而是显示目标地图星区的本地化名称。
- 目标地图星区名称采用 tag/pill 样式，清除按钮以小图标形式嵌入该 tag 内。
- 点击已放置对象卡片时，地图应聚焦到该对象自身 overlay，而不是额外选中目标星区。

### 1.3 地图放置与微调
- 当用户从面板拖出对象进入地图时，地图进入放置态：
  - 命中的目标 sector 高亮
  - 松手时计算目标 sector 内原始坐标
  - 更新目标对象的 `location`
- 已有 `location` 的对象在面板打开时会显示为地图 overlay 节点。
- overlay 节点支持再次拖动，以便在同一 sector 内微调，或拖到另一 sector。
- 面板关闭后，overlay 节点和拖放辅助态一起隐藏。
- 列表项右侧不再显示“拖到地图”文案，而是以 drag handle 形式作为拖拽入口提示。
- 拖拽 ghost、拖拽预览与已放置 overlay 共用一套图标映射：
  - 普通 `station` 使用 `factory.svg`
  - `station.type === shipyard` 使用 `shipyard.svg`
  - `sector transit` 使用 `tradestation.svg`
- 图标视觉尺寸保持接近原占位 marker，不扩大交互热点。

## 2. 数据模型设计

### 2.1 新增 location 结构
- 为 `StationPlan` 增加可选 `location` 字段。
- 为 `SectorPlan` 增加可选 `location` 字段。
- 共用结构：
  - `cluster_id: string`
  - `sector_id: string`
  - `pos: { x: number; z: number }`
  - `sunlight: number`
  - `resources: string[]`

### 2.2 location 来源规则
- `cluster_id` / `sector_id` 来自当前落点命中的地图 sector。
- `sunlight` 来自目标地图 sector 的 `area.sunlight`。
- `resources` 由目标地图 sector 的 `resources[].ware` 去重后生成。
- `pos` 以目标 sector 的原始坐标系保存，不参与 normalized ratio 序列化。

### 2.3 Empire 存储与兼容
- `location` 是 empire 可编辑输入，应进入 `x4_empire_data` 的存档结构。
- `serializeEmpireForDirtyCheck()` 需要把 `station.location` 与 `sector.location` 计入快照比较。
- empire 迁移逻辑需要兼容旧档缺少 `location` 的情况：
  - 缺少时保持 `undefined`
  - 若存在 `location` 但目标字段无效，需要做保守归一或回退清理

## 3. 地图坐标与放置计算

### 3.1 目标 sector 命中
- `MapSvgCanvas` 已掌握 cluster/sector 的几何布局与原始锚点数据。
- 放置态需要从 SVG 层返回：
  - 当前命中的目标 `clusterId`
  - 当前命中的目标 `sectorId`
  - 鼠标在该 sector 内对应的原始 `{x, z}` 坐标
- 这套数据不能只返回归一化偏移；需要提供面向持久化的原始坐标映射。

### 3.2 overlay 渲染
- 打开左侧面板时，`MapWorkbenchView` 将当前 empire 中带 `location` 的对象转换为地图 overlay 数据并下发给 `MapSvgCanvas`。
- `MapSvgCanvas` 根据对象的 `cluster_id + sector_id + pos{x,z}` 计算屏幕落点并绘制 marker。
- overlay marker 需要区分：
  - `station`
  - `sector transit`
  - 当前被拖动对象
  - 当前命中预览对象

### 3.3 再次拖动与清除
- 再次拖动 overlay marker 时，流程与首次放置相同，只是最终更新原对象 `location`。
- 清除位置操作直接移除对象的 `location` 字段。
- 点击已放置对象列表项时，不修改 `location`，仅触发镜头 focus 到其自身 overlay 落点。
- focus 高亮只作用于 overlay 自身，不向目标地图星区写入额外选中态。

## 4. Store 与 dirty 设计

### 4.1 EmpireStore 扩展
- `useEmpireStore` 需要提供：
  - 更新 `station.location`
  - 更新 `sector.location`
  - 清除 `station.location`
  - 清除 `sector.location`
- 这些操作属于 empire 输入层修改，不应触发 station 运行态重算，除非未来有额外依赖接入。

### 4.2 dirty 判定
- 当前 dirty 依赖 `serializeEmpireForDirtyCheck()` 对 `activeEmpire` 的 JSON 快照。
- 只要 `location` 存在于 `activeEmpire` 序列化结果中，且更新操作会同步写回 `activeEmpire`，dirty 即可自然生效。
- 因此关键不是新增单独 dirty flag，而是确保：
  - `location` 在类型与迁移后稳定存在于内存结构
  - 更新操作直接修改 `activeEmpire`
  - `saveEmpire()` 能完整保存 `location`

## 5. 风险与对策

### 5.1 风险：原始坐标到屏幕坐标映射不对称
- 对策：复用 `maps.json` 里已有的 `raw_sector_pos` / `raw_local_pos` 与 normalized 布局计算，建立双向映射函数，而不是从屏幕坐标反推近似比例。

### 5.2 风险：sector 中转点与目标地图 sector 命名冲突
- 对策：文档与代码中严格区分：
  - `SectorPlan`：empire 里的中转点对象
  - `map sector`：地图上的目标星区
  - `location.sector_id`：目标 map sector id

### 5.3 风险：面板关闭后残留 overlay/hover 状态
- 对策：将 station overlay、拖动态、命中预览态全部绑定到“空间站面板打开”条件；关闭时统一回收。
- 面板内搜索框与滚动状态保持局部，不影响地图右上角搜索框的内容与高亮状态。

### 5.4 风险：最新地图布局已固定三处控件位置
- 对策：保持现有布局不变量不变：
  - 资源按钮在左上
  - 搜索框在右上
  - 缩放面板在右下
  - 空间站入口独立放在左下，并从左侧弹出
### 5.5 风险：旧存档结构不含 location
- 对策：迁移逻辑保持向后兼容，不要求强制补默认 `location`；仅在新编辑后写入。
