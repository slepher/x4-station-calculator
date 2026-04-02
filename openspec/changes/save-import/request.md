# Save Import - request.md

## 目标

新增"存档同步"Tab，支持上传X4存档文件或导入已提取JSON，解析并展示空间站、vault、弃船等信息，支持导出提取结果为JSON文件。

## 已确认方案（审核重点）

### 入口与布局
- 新增Tab：存档同步，位于 TopViewSwitch 组件中，排在 `production/maps/flow/ship-build` 之后
- Tab key: `save-import`
- 左侧面板：上传界面 + 存档列表（按guid分组显示）
- 右侧面板：存档详情（选中存档后展示）

### 上传与导入
- 支持两种上传方式：
  1. 原始存档文件（.xml 或 .xml.gz）：需要解析
  2. 已提取JSON文件：直接加载（跳过解析步骤）
- 上传控件：拖拽区域 + 文件选择按钮
- 原始存档上传使用浏览器 `File.stream()` 按块读取，不在主线程一次性读入完整文件
- 上传链路采用三段式 worker 协议：
  - `parse_start`：发送 `filename/currentVersion/expectedTotalBytes`
  - `parse_chunk`：逐块发送原始文件字节
  - `parse_end`：通知输入结束
- gzip 文件的解压由 Rust/WASM 端完成，前端只转发原始 `.xml.gz` 字节，不再使用浏览器 `DecompressionStream` 预解压

### 存档分组逻辑
| 字段 | 来源 | 作用 |
|------|------|------|
| `game.guid` | `<game guid="...">` | 存档归属（同一局游戏） |
| `game.seed` | `<game seed="...">` | 存档独特性标识 |
| `game.time` | `<game time="...">` | 时间排序（大→小，最新在前） |
| `game.version` | `<game version="...">` | 版本校验（800 = 8.0） |
| `player.name` | `<player name="...">` | 分组命名 |

### 版本校验规则
- 存档 `version` 字段（如 `800`）必须匹配 `useGameDataStore.currentVersion`
- 版本映射：`800` → `8.0`
- 不匹配时：显示警告提示，禁止加载或标记为不兼容
- JSON导入时同样校验 `meta.version`

### 存档解析目标
从存档XML提取以下对象（按sector组织）：

1. **Sector元信息**：`component class="sector"`
   - 提取字段：`name, is_known, owner`
   
2. **所有空间站**：`component class="station"`（不限owner）
   - 按 `owner` 分类输出：
     - `playerStations`
     - `xenonStations`
     - `khaakStations`
     - `npcStations`
   - 基础字段：`code, macro, owner, x/y/z, is_wreck, is_headquarter`
   - `owner="player"` 的 station 继续保留玩家站明细模块提取
   - `owner!="player"` 的 station 中：
     - `npcStations`
     - `xenonStations`
     - `khaakStations`
     都提取所有 module 的聚合结果：
     - `modules: [{ ref, amount }]`
    - `npcStations` 与 `xenonStations` 额外根据聚合 modules / station macro 计算：
      - `isShipyard`
      - `isWharf`
      - `isEquipmentdock`
      - `isTradestation`
      - `isFactory`
      - `isPiratebase`
      - `isDefence`
    - `khaakStations` 额外根据聚合 modules / station macro 计算：
      - `isShipyard`
      - `isWharf`
      - `isEquipmentdock`
      - `isTradestation`
      - `isFactory`
      - `isPiratebase`
      - `isDefence`
    - `khaakStations` 额外根据 station `macro` 计算：
      - `landmarks_kha_nest_` → `isNest`
      - `landmarks_kha_hive_` → `isHive`
    - `playerStations` 额外根据聚合 modules / station macro 计算：
      - `isShipyard`
      - `isWharf`
      - `isEquipmentdock`
      - `isFactory`
      - `isPiratebase`
      - `isDefence`
    - 所有 station 根据 `is*` 布尔值按优先级打上 `tag` 字段（位于 `StationBaseEntry`）：
      - **npc/xenon** 优先级：`piratebase > shipyard > wharf > equipmentdock > tradestation > factory > defence` → 无匹配则 `factory`
      - **khaak** 优先级：`hive > nest` → 无匹配则 `weaponplatform`
      - **player** 优先级：`piratebase > shipyard > wharf > equipmentdock > factory > tradestation > defence` → 无匹配则 `factory`
    - 上述 `npc/xenon/khaak/player` 的派生判定放在 `src/workers/saveParserRust.worker.ts` 层处理，不下沉到 `rust-parser/src/core.rs`
   
3. **Datavault**：`component class="datavault"`（单独类型）
   - 提取字段：`code, macro, owner, x/y/z, has_blueprints, has_wares, has_signalleak`
   - 额外提取：
     - `unlocked`: 来自 `<unlock state="unlocked"/>`
       - tag 不存在或 `state!="unlocked"` 时，固定输出 `false`
     - `wares: [{ ware, amount }]`
       - 从其下 `class="collectablewares"` 子组件的 `<wares><ware .../></wares>` 聚合
       - 同名 `ware` 合并
       - `amount` 缺失按 `1` 处理
   
4. **Erlking Vault**：`macro` 含 `erlking_vault`（单独类型）
   - 提取字段：`code, macro, owner, x/y/z, has_blueprints, has_wares, has_signalleak`
   - 额外提取：
     - `unlocked`
     - `wares: [{ ware, amount }]`
   - `unlocked` 与 `wares` 的提取/聚合规则与 datavault 相同
   
5. **弃船**：`component class="ship_*" owner="ownerless"`
   - 提取字段：`code, macro, class, x/y/z`

### 导出JSON格式
```json
{
  "meta": {
    "guid": "...",
    "seed": 123,
    "time": 770722.838,
    "playerName": "slepher",
    "version": "800",
    "source": "original"
  },
  "sectors": {
    "sector_macro": {
      "name": "翻译后名称",
      "is_known": true,
      "owner": "argon",
      "playerStations": [
        { "code", "macro", "owner", "x", "y", "z", "is_wreck", "is_headquarter", "modules": [] }
      ],
      "xenonStations": [
        { "code", "macro", "owner", "x", "y", "z", "is_wreck", "is_headquarter", "modules": [{ "ref": "buildmodule_xen_ships_xl", "amount": 1 }], "isShipyard": true }
      ],
      "khaakStations": [
        { "code", "macro", "owner", "x", "y", "z", "is_wreck", "is_headquarter", "modules": [{ "ref": "module_khaak_special", "amount": 2 }], "isHive": true }
      ],
      "npcStations": [
        { "code", "macro", "owner", "x", "y", "z", "is_wreck", "is_headquarter", "modules": [{ "ref": "buildmodule_arg_ships_m", "amount": 2 }], "isWharf": true }
      ],
      "datavaults": [
        { "code", "macro", "owner", "x", "y", "z", "has_blueprints", "has_wares", "has_signalleak", "unlocked": false, "wares": [{ "ware": "inv_spaceflyeggs", "amount": 4 }] }
      ],
      "erlkingVaults": [
        { "code", "macro", "owner", "x", "y", "z", "has_blueprints", "has_wares", "has_signalleak", "unlocked": true, "wares": [{ "ware": "modpart_highenergycatalyst", "amount": 1 }] }
      ],
      "abandonedShips": [
        { "code", "macro", "class", "x", "y", "z" }
      ]
    }
  }
}
```

- 所有同类数组字段在结果为空时不输出对应 key，包括：
  - `playerStations`
  - `xenonStations`
  - `khaakStations`
  - `npcStations`
  - `datavaults`
  - `erlkingVaults`
  - `abandonedShips`
  - 以及条目内部的 `modules`、`wares`

### 异常/告警处理
- 版本不匹配：显示警告，用户可选择继续加载或拒绝
- 解析失败：显示错误信息，允许重新上传
- 重复guid+seed：视为同一存档，替换旧数据

### 技术约束
- 存档可达100MB+，必须使用流式解析（SAX Worker）
- 坐标系统：游戏内米级，需累加component层级offset
- 名称翻译：`{page,id}` 格式需查找strings表翻译为可读名称
- JSON导入/导出使用浏览器原生下载API
- `src/workers/saveParser.worker.ts` 进入冻结状态，仅保留兼容/备用用途，不再添加新的业务提取功能
- 后续新增业务字段、分类逻辑、结构调整只进入 Rust/WASM 解析链
- Rust 解析路径需要同时承担：
  - 原始 XML 流式解析
  - `.xml.gz` 的增量 gunzip
  - 真实解析进度输出
- CLI `scripts/extract_save.tsx --wasm` 的进度输出必须完全依赖 Rust/WASM 侧返回，不在脚本层二次推断或补充节流语义
- 上传面板进度条宽度必须直接映射 worker 返回的 `percent`，不能仅显示文本状态

## 边界

### In Scope
- Tab新增与切换逻辑
- 上传界面（原始存档 + JSON）
- 上传流转发模块（原始字节 → worker）
- 存档列表（按guid分组，按time降序）
- 存档详情面板（空间站/vault/弃船列表）
- JSON导出功能
- 版本校验
- 新增Store：`useSaveStore`
- Vue组件目录：`src/components/save/`
- SAX解析Worker
- Rust WASM 解析Worker 会话层
- Rust 端 gunzip 与 CLI progress 控制
- sector owner 提取
- station 按 `player/xenon/khaak/npc` 四组分类
- `npcStations/xenonStations/khaakStations` 的聚合 modules 提取（`modules: [{ ref, amount }]`）
- `npcStations/xenonStations` 的 `isShipyard/isWharf/isEquipmentdock/isTradestation/isFactory/isPiratebase/isDefence` 判定
- `khaakStations` 的 `isNest/isHive` 宏判定
- `playerStations` 的 `isShipyard/isWharf/isEquipmentdock/isFactory/isPiratebase/isDefence` 判定
- 所有 station 的 `tag` 字段判定（按优先级）
- datavault / erlking_vault 的 `unlocked` 与聚合 `wares`

### Out of Scope
- 持久化到localStorage/IndexedDB（暂不实现）
- 显示其他存档内容（船只、资源区、 gates等）
- 与现有规划数据联动（如导入空间站到帝国管理）
- 提取玩家位置
- 存档修改功能

## 验收标准（DoD）

1. TopViewSwitch组件显示第5个Tab"存档同步"
2. 点击Tab切换到存档同步视图
3. 上传原始存档文件后正确解析并分组显示
4. 上传已提取JSON后直接加载显示（跳过解析）
5. 版本不匹配时显示明确警告提示
6. 同guid存档按time降序排列
7. 点击存档项右侧显示详情
8. 详情正确显示空间站/datavault/erlking_vault/弃船列表（含坐标和owner）
9. 存档名称使用player.name显示
10. 每个存档项提供"下载JSON"按钮
11. 点击下载按钮生成并下载JSON文件（包含完整meta和sectors数据）
12. 解析大文件（100MB+）不阻塞UI
13. 上传 `.xml.gz` 时浏览器端不再执行 JS gunzip，仍能正确完成导入
14. 上传解析时进度文本与进度条宽度都随 worker 返回的 percent 正常更新
15. `scripts/extract_save.tsx --wasm` 输出的进度频率与内容由 Rust 侧控制，脚本不再自行补充判断
16. 每个 sector 额外输出 `owner`
17. station 按 `playerStations/xenonStations/khaakStations/npcStations` 分组输出
18. `npcStations/xenonStations/khaakStations` 中的每个 station 额外输出聚合模块列表 `modules: [{ ref, amount }]`
19. `src/workers/saveParser.worker.ts` 不再承担新的业务提取演进
20. 每个 datavault / erlking_vault 额外输出 `unlocked`
21. 每个 datavault / erlking_vault 额外输出聚合后的 `wares: [{ ware, amount }]`
22. `<unlock>` 缺失或 `state!="unlocked"` 时，`unlocked=false`
23. 所有空数组字段不输出对应 key
24. `npcStations/xenonStations` 额外输出 `isShipyard/isWharf/isEquipmentdock/isTradestation/isFactory/isPiratebase/isDefence`
25. `khaakStations` 额外输出 `isNest/isHive`
26. `playerStations` 额外输出 `isShipyard/isWharf/isEquipmentdock/isFactory/isPiratebase/isDefence`
27. 所有 station 输出 `tag` 字段，判定优先级：
    - npc/xenon: `piratebase > shipyard > wharf > equipmentdock > tradestation > factory > defence` → 默认 `factory`
    - khaak: `hive > nest` → 默认 `weaponplatform`
    - player: `piratebase > shipyard > wharf > equipmentdock > factory > tradestation > defence` → 默认 `factory`

## 未决项

无
