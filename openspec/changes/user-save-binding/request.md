# user-save-binding Change Request

## 目标

为 empire 与存档之间建立独立 `SaveBinding` 关系层，并在 `savePanel` 中提供完整的 binding 工作流：从首页 binding 入口图标开始，进入 Step 2 的星区组编辑，再进入 Step 3 的空间站绑定与地图交互。

## 已确认方案（审核重点）

### 1. Binding 数据层

- binding 作为独立关系层，不污染 `EmpirePlan` / `StationPlan` 本体。
- `SaveBindingPlan` 以 `empireId + gameGuid` 为稳定唯一键。
- `selectedArchiveTime` 只代表当前 binding 视角，不属于 binding 身份。
- group binding、station binding、binding position、连接星区都保存在独立 binding 层。

### 2. Step 1 绑定入口

- binding Step 1 并入 `savePanel` 首页。
- 首页中的绑定图标既是状态指示，也是绑定操作入口。
- 若 binding 落在 `guid`：
  - 标题与最新 time 显示绑定图标
- 若 binding 落在具体 `time`：
  - 仅该 time 显示绑定图标
- 点击标题绑定图标：绑定到最新 time，并进入 Step 2。
- 点击 time 绑定图标：绑定到该 time，并进入 Step 2。
- binding 的激活仅影响绑定图标，不参与首页容器或 time 条目的 active 高亮。
- `savePanel` 内部独占管理 `activeArchiveId`；地图层只接收“显示哪份 archive”的事件，不再反写 active。

### 3. Step 2 星区组编辑

- Step 2 整合进 `savePanel` 面包屑，标题显示 `存档名 绑定`。
- 上方显示 empire sector 列表，下方显示存档星区列表。
- 收缩态标题行为“手柄 + 名称 | 详情图标 + 编辑”。
- 收缩态正文直接显示定位星区药丸与按跳数分组的结果。
- 展开态只编辑单个 empire sector：
  - 名称输入框
  - `绑定星区>` 菜单
  - 定位星区药丸 + 跳数控件
  - 覆盖星区 / 候选星区 / 连接星区
  - 底部删除 / 取消 / 确认
- 连接星区基于定位星区 5 跳内其他已定位 empire sector 自动计算，并双向保存到 `groupBinding`。
- 若某个 map sector 已被其他 empire sector 用作定位星区或 coverage：
  - 不能进入当前 empire sector 的 coverage
  - 但仍显示在 candidate 列表中
  - 且不显示 `+`，只作为锁定候选展示

### 4. Step 3 空间站绑定

- Step 3 继续以 `map sector` 为分组轴。
- save station 为主显示对象。
- 正常绑定且当前 time 可解析的 empire station 不再重复独立显示。
- `StationSaveBinding` 与虚拟中转站 binding 统一使用相同的 binding 结构；不存在记录即视为自由站点。
- 仅两类 empire station 作为补位项显示：
  - 有 `position`、无 `saveStationCode`
  - 有 `position`、有 `saveStationCode`，但当前 time 失效
- 失效绑定对象只能解绑，不能拖拽重定位。
- `解绑` 与 `转绑` 都清理旧 binding 数据，旧对象直接回归自由，不再保留“已放置未绑定”的过渡状态。
- 绑定菜单区分：
  - 自由站点
  - 已放置未绑定站点
  - 已绑定到其他 save station 的置灰站点
- 已拖拽到地图但未绑定的自由站点在菜单中也视为不可绑定候选，仅用背景色和置灰区分，不再显示“已设置位置 / 虚拟中转站”等备注文字。
- Step 3 绑定菜单与对应 `station-item` 做 Y 轴对齐；当向下空间不足时改为向上弹出，并保持菜单底边与触发条目底边齐平。
- Step 3 菜单滚动条样式与 Step 2 绑定菜单保持一致。
- 从 save station 导入新建 empire station 时，只使用 save parser 提供的 `module_id` 导入全部模块，不回退到 `ref`。
- 若 save station 当前指向的 `stationBinding` 对应 empire station 已不存在，则按钮显示红色 `绑定异常`，仍允许重新绑定。
- 异常绑定菜单中额外显示一条“异常空间站”，并提供 `x` 清理这条坏 binding。
- 从异常绑定状态导入/重绑到新 empire station 时，旧的坏 binding 必须先释放，再落入新 binding。
- Step 3 导入模块的顺序应与模块搜索面板默认顺序一致，但应通过共享排序规则实现，而不是拍平搜索面板结果复用。

### 5. Binding POI 与地图行为

- binding POI 与 save POI 共用类型、owner 与尺寸语义，仅额外增加虚线六边形外框。
- binding POI 常驻显示，受 `playerStation` 可见性控制。
- 只有在对应 `sectorGroup` 的 Step 3 上下文中允许拖拽；否则只显示并支持 tooltip。

## 边界

### In Scope

- 独立 `SaveBinding` 数据模型与 action
- 首页 binding 图标入口与状态投影
- Step 2 星区组编辑
- Step 3 空间站绑定与 binding POI

### Out of Scope

- POI 分类页、坐标列表与右上角可见性控件
- `savePanel` 首页的通用分组容器交互与非 binding 高亮规则

## 验收标准（DoD）

1. binding 数据层独立于 `EmpirePlan` / `StationPlan` 保存。
2. 首页 binding 图标可创建/切换 guid 级或 time 级 binding，并进入 Step 2。
3. binding 图标状态投影正确；binding 本身不影响首页容器 active。
4. Step 2 提供星区组编辑、连接星区与删除清理能力。
5. Step 3 去除重复 UI，并按 save station 主显示 + 异常补位项组织空间站。
6. binding POI 常驻显示，但拖拽权限受当前 Step 3 上下文限制。

## 未决项

无
