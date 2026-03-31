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

1. **所有空间站**：`component class="station"`（不限owner）
   - 提取字段：`code, macro, owner, x/y/z, is_wreck, is_headquarter`
   
2. **Datavault**：`component class="datavault"`（单独类型）
   - 提取字段：`code, macro, owner, x/y/z, has_blueprints, has_wares, has_signalleak`
   
3. **Erlking Vault**：`macro` 含 `erlking_vault`（单独类型）
   - 提取字段：`code, macro, owner, x/y/z, has_blueprints, has_wares, has_signalleak`
   
4. **弃船**：`component class="ship_*" owner="ownerless"`
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
      "stations": [
        { "code", "macro", "owner", "x", "y", "z", "is_wreck", "is_headquarter" }
      ],
      "datavaults": [
        { "code", "macro", "owner", "x", "y", "z", "has_blueprints", "has_wares", "has_signalleak" }
      ],
      "erlkingVaults": [
        { "code", "macro", "owner", "x", "y", "z", "has_blueprints", "has_wares", "has_signalleak" }
      ],
      "abandonedShips": [
        { "code", "macro", "class", "x", "y", "z" }
      ]
    }
  }
}
```

### 异常/告警处理
- 版本不匹配：显示警告，用户可选择继续加载或拒绝
- 解析失败：显示错误信息，允许重新上传
- 重复guid+seed：视为同一存档，替换旧数据

### 技术约束
- 存档可达100MB+，必须使用流式解析（SAX Worker）
- 坐标系统：游戏内米级，需累加component层级offset
- 名称翻译：`{page,id}` 格式需查找strings表翻译为可读名称
- JSON导入/导出使用浏览器原生下载API

## 边界

### In Scope
- Tab新增与切换逻辑
- 上传界面（原始存档 + JSON）
- 存档列表（按guid分组，按time降序）
- 存档详情面板（空间站/vault/弃船列表）
- JSON导出功能
- 版本校验
- 新增Store：`useSaveStore`
- Vue组件目录：`src/components/save/`
- SAX解析Worker

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

## 未决项

无