# request.md — faction-binding

## 目标

在 rust parser 中新增 `faction.rs` 模块，从存档 XML 中提取玩家与各 faction 的声望关系以及已解锁的证书列表，与现有 `blueprints` 提取模式一致。同时在 TypeScript 类型和 IndexedDB 存储层中新增对应字段。

## 已确认方案（审核重点）

### 1. 数据来源与位置

存档 XML 中 `<universe><factions><faction id="player">` 包含：

#### 1.1 faction 声望

```xml
<faction id="player">
  <relations>
    <relation faction="argon" relation="0.1"/>
    <relation faction="xenon" relation="-1"/>
  </relations>
  ...
</faction>
```

- `faction` 属性：faction ID
- `relation` 属性：关系值，范围 `[-1, 1]`

#### 1.2 已解锁证书

```xml
<faction id="player">
  <licences>
    <licence type="station_gen_basic" factions="antigone argon teladi"/>
    <licence type="capitalship" factions="terran split"/>
  </licences>
</faction>
```

- `type` 属性：证书类型
- `factions` 属性：空格分隔的 faction ID 列表

### 2. 解析策略

仿 `blueprints.rs` 模式：

- 在 `core.rs` 的 `open()` 中识别 `<faction id="player">` 进入玩家 faction 上下文
- 处于玩家 faction 内时，识别 `<relation>` 和 `<licence>` 元素收集数据
- `</faction>` 关闭时退出玩家 faction 上下文
- 复用现有流式解析架构，不新增读取路径

### 3. Archive 输出结构

```ts
archive.player_relations: Record<string, number>  // faction → relation value
archive.player_licences: Record<string, string[]>  // licence type → faction ids
```

### 4. IndexedDB 持久化

- `PlayerStationsRecord.data.player_relations: Record<string, number>`
- `PlayerStationsRecord.data.player_licences: Record<string, string[]>`
- strip/extract/merge 与 `player_blueprints` 相同模式
- 旧记录缺失 → 空值（`{}`）

### 5. 模块结构

- `rust-parser/src/faction.rs`: `FactionParser` 结构体，含 `open()` / `close()` 方法
- `rust-parser/src/model.rs`: `SaveArchive` 新增 `player_relations` / `player_licences` 字段
- `rust-parser/src/core.rs`: 集成 `FactionParser`，在 `open()` / `close()` / `finish_archive()` 中调用
- `rust-parser/src/lib.rs`: 注册 `mod faction;`
- `src/types/saveArchive.ts`: 新增 TS 类型
- `src/db/saveArchiveDB.ts`: strip/extract/merge 对齐

## 边界

### In Scope

- rust parser 提取玩家 faction 声望和证书
- Archive JSON 输出 `player_relations` 和 `player_licences`
- IndexedDB strip/extract/merge
- TS 类型定义

### Out of Scope

- 前端 UI 展示
- 声望/证书与蓝图解锁的联动计算
- 测试代码

## 验收标准（DoD）

1. `npm run build` 成功（含 rust parser WASM 编译）
2. 解析 `save_009.xml` 后 archive JSON 包含 `playerRelations: { argon: 0.1, xenon: -1, ... }`
3. 解析 `save_009.xml` 后 archive JSON 包含 `playerLicences: { station_gen_basic: ["antigone", "argon", "teladi"], ... }`
4. IndexedDB 中 `player_stations.data.player_relations` / `player_licences` 与同级字段一致
5. 旧 IndexedDB 记录缺失该字段不报错

## 未决项

无
