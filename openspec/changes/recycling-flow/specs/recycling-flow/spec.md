# Recycling Flow Specification

## Purpose

规定 Scrap Processor 与 Scrap Recycler 在权威数据、Logic Flow、Station 和 Build Plan 中的一致行为，并确保 recycling 产线不参与 Build Flow 建筑产线。

## ADDED Requirements

### Requirement: Processing Module Authoritative Rates

系统 SHALL 从 `processingmodule` 的 `<products>` 批量和对应 Ware 的 processing recipe 生成模块小时率；模块产物批量 SHALL 按 recipe 基础产量同比例放大所有输入。

#### Scenario: Generic Scrap Processor hourly rates

**前提** Generic Scrap Processor 的 `<products>` 声明每周期处理 150 Scrap Metal，Scrap Metal recipe 为 60 秒、基础产量 1、消耗 1 Raw Scrap 与 10 Energy Cells
**当** 生成 `module_gen_proc_scrapworks` 数据
**那么** `cycleTime` SHALL 为 60 秒
**并且** outputs SHALL 包含 `scrapmetal: 9000`
**并且** inputs SHALL 包含 `rawscrap: 9000` 与 `energycells: 90000`

#### Scenario: Kha'ak Scrap Processor hourly rates

**前提** Kha'ak Scrap Processor 的 `<products>` 声明每周期处理 50 Kha'ak Scrap Metal，对应 recipe 为 60 秒、基础产量 1、消耗 1 Raw Kha'ak Scrap 与 10 Energy Cells
**当** 生成 `module_gen_proc_scrapworkskhaak_01` 数据
**那么** `cycleTime` SHALL 为 60 秒
**并且** outputs SHALL 包含 `khaakscrapmetal: 3000`
**并且** inputs SHALL 包含 `rawkhaakscrap: 3000` 与 `energycells: 30000`

#### Scenario: Processing module workforce behavior

**前提** processing module 没有 workforce 配置
**当** 计算其基础产率
**那么** 系统 SHALL 使用生成数据中的固定小时率
**并且** SHALL NOT 应用普通生产模块的 workforce bonus

### Requirement: Explicit Standard And Recycling Producer Selection

系统 SHALL 区分普通生产者选择与 recycling 根模块选择，不得让同一个隐式 lineage fallback 同时决定 race 和 production method。

#### Scenario: Standard Hull Parts selection

**前提** Hull Parts 同时存在普通生产模块与 Scrap Recycler
**当** 普通工业产线按 Hull Parts 查找生产者
**那么** 系统 SHALL 选择普通 Hull Parts 生产模块
**并且** SHALL NOT 选择 `method="recycling"` 的模块

#### Scenario: Processing module is a standard upstream producer

**前提** Scrap Processor 以 `type="processingmodule"` 产出 Scrap Metal
**当** 普通上游选择器查找 Scrap Metal 生产者
**那么** 系统 SHALL 返回对应 Scrap Processor
**并且** SHALL NOT 因 Ware transport 为 `solid` 而拒绝该模块

#### Scenario: Recycling root selection

**前提** 用户在 recycling 子类型中选择 Recycler 的任意 output
**当** 创建手动根节点
**那么** 系统 SHALL 按 `method="recycling" + output wareId` 定位唯一 Recycler
**并且** SHALL NOT 要求额外 module selector 或 recipe 信息

### Requirement: Recycling Logic Flow Expansion

工业候选区 SHALL 提供 `recycling` 子类型，并从 recycling 模块全部 outputs 及其普通上游链建立候选；Recycler 的自动上游 SHALL 使用普通生产者规则。

#### Scenario: Recycling upstream candidates

**前提** recycling 候选链包含 Scrap Processor 与其 Tier 0 输入
**当** 用户查看或操作 recycling 子类型
**那么** Tier 1 SHALL 显示 Scrap Metal，并允许添加对应 Scrap Processor
**并且** Tier 0 SHALL 显示 Energy Cells 与 Raw Scrap 类输入，但不可添加

#### Scenario: Generic recycler expansion

**前提** 用户通过 Hull Parts 或 Claytronics 添加 Generic Scrap Recycler
**当** Logic Flow 展开全部上游
**那么** SHALL 创建一个 `module_gen_prod_scrap_recycler` 节点
**并且** SHALL 创建 `module_gen_proc_scrapworks` 作为 Scrap Metal 上游
**并且** SHALL 为 Energy Cells 添加普通能源模块
**并且** Raw Scrap SHALL 停在无模块资源边界

#### Scenario: Terran recycler expansion

**前提** 用户通过 Computronic Substrate 或 Silicon Carbide 添加 Terran Scrap Recycler
**当** Logic Flow 展开全部上游
**那么** SHALL 创建一个 `module_ter_prod_scrap_recycler` 节点
**并且** Scrap Metal SHALL 由 `module_gen_proc_scrapworks` 供应

#### Scenario: Kha'ak recycler expansion

**前提** 用户通过 Kha'ak Alloy 添加 Kha'ak Scrap Recycler
**当** Logic Flow 展开全部上游
**那么** SHALL 创建 `module_gen_prod_scrap_recyclerkhaak`
**并且** Kha'ak Scrap Metal SHALL 由 `module_gen_proc_scrapworkskhaak_01` 供应
**并且** Raw Kha'ak Scrap 与 Nividium SHALL 停在资源边界

#### Scenario: Multi-output recycler deduplication and highlighting

**前提** 同一 Recycler 具有多个 outputs
**当** 用户通过任意 output 添加该模块或高亮其产物
**那么** Logic Flow SHALL 按 moduleId 只保留一个模块节点
**并且** 产物高亮 SHALL 覆盖该模块的全部 outputs
**并且** SHALL NOT 因 output 数量重复计算模块数量

### Requirement: Module-Centric Persistence And Import

系统 SHALL 保持现有 module-centric 保存格式，不新增 recipe snapshot 或 selected-output 字段。

#### Scenario: Save a recycling flow

**前提** recycling 组包含一个手动 Recycler 和自动生成的 Processor
**当** 保存 Logic Flow
**那么** SHALL 保存手动 Recycler 的 moduleId
**并且** SHALL NOT 保存自动 Processor 节点

#### Scenario: Import a recycling flow into Station

**前提** 已保存组包含 Recycler moduleId
**当** 导入 Station
**那么** SHALL 按 moduleId 聚合 planned modules
**并且** SHALL 从当前版本 `modulesMap` 读取该 Recycler 的全部 outputs/inputs
**并且** SHALL NOT 根据单个 output wareId 重新选择模块

#### Scenario: Promoted processor is persisted

**前提** 用户把自动 Processor 提升为手动节点
**当** 保存并导入 Logic Flow
**那么** Processor moduleId SHALL 与 Recycler moduleId 一同进入导入 payload

### Requirement: Station Processing Auto-Fill

Station 自动补全 SHALL 以是否存在合格生产模块判断 Ware 是否可自产；合格普通生产者 SHALL 包含非 recycling 的 `production` 与 `processingmodule`。

#### Scenario: Scrap Metal deficit adds processor

**前提** Station planned modules 包含一个消耗 Scrap Metal 的 Recycler
**当** 自动补全发现 Scrap Metal 净缺口
**那么** SHALL 添加对应 Scrap Processor
**并且** SHALL NOT 因 Scrap Metal transport 为 `solid` 而停止

#### Scenario: Raw scrap remains external

**前提** 自动补全已经添加 Scrap Processor
**当** 处理 Raw Scrap 净缺口
**那么** 因不存在合格生产模块，SHALL 不添加模块

#### Scenario: Normal material deficit excludes recycler

**前提** Station 存在 Hull Parts、Claytronics、Computronic Substrate 或 Silicon Carbide 缺口
**当** 自动选择生产模块
**那么** SHALL 排除所有 `method="recycling"` 模块

#### Scenario: Multi-output station accounting

**前提** Station 包含一个多产出 Recycler
**当** 计算生产流
**那么** SHALL 遍历该模块完整 outputs 与 inputs
**并且** SHALL 只计算一次模块数量
**并且** SHALL NOT 使用 `cycleTime` 对小时率二次换算

### Requirement: Build Plan Processing Dependencies

Build Plan 所有 Ware 生产者查找和依赖递归 SHALL 使用与 Station 相同的合格生产者规则。

#### Scenario: Recycler dependency expansion

**前提** Build Plan 包含 Recycler 或其明确 moduleId
**当** 展开生产依赖
**那么** SHALL 展开 `Recycler -> Scrap Processor -> Energy Cells`
**并且** SHALL 在 Raw Scrap 等无生产者 Ware 处停止

#### Scenario: Explicit module selection is preserved

**前提** Logic Flow 或 Build Goal 已提供明确 Recycler moduleId
**当** Build Plan 生成模块计划
**那么** SHALL 保留该 moduleId
**并且** SHALL NOT 按单个 output Ware 将其替换为普通生产模块

#### Scenario: Ware-based build plan selection excludes recycler

**前提** Build Plan 只有普通 Hull Parts 等 Ware 目标，没有明确 Recycler moduleId
**当** 自动选择生产者
**那么** SHALL 选择普通生产模块
**并且** SHALL NOT 选择 Recycler

#### Scenario: Processor participates in reference floor

**前提** 参考模块方案包含 Scrap Processor
**当** 生成推荐生产模块基线
**那么** SHALL 保留非 recycling 的 processing module

### Requirement: Recycling Groups Excluded From Build Flow

`subCategory="recycling"` 的 Logic Flow 组 SHALL NOT 作为 Build Flow 建筑材料供应产线。

#### Scenario: Recycling group produces building materials

**前提** recycling 组中的 Recycler 产出 Hull Parts、Claytronics 或其他建筑材料
**当** 派生 Build Flow 建筑产线视图
**那么** 该组 SHALL NOT 生成建筑产线卡片
**并且** SHALL NOT 生成产物连接
**并且** SHALL NOT 获得建筑产线责任归属

#### Scenario: Recycler remains a build target

**前提** Build Plan 包含显式 Recycler `build-module` 目标
**当** 计算建造成本和步骤
**那么** 系统 SHALL 正常计算 Recycler
**并且** SHALL NOT 因 recycling 组不进入 Build Flow 而删除该目标

### Requirement: Recycling Candidate UI Layering

新增 recycling 候选入口 SHALL 遵守 `store -> presenter -> vue` 三层结构。

#### Scenario: Candidate UI consumes recycling data

**前提** presenter 已从 store 取得 recycling 候选和交互能力
**当** Vue 渲染 recycling 子类型并处理用户操作
**那么** Vue SHALL 只通过 presenter 取数和触发行为
**并且** SHALL NOT 新增对 store 或其他业务组装逻辑的直接访问

### Requirement: Processing Modules In Auto Industry Display

自动工业区 SHALL 显示自动补全结果中的非 recycling `processingmodule`，不得只显示 `production` 类型。

#### Scenario: Scrap processor is auto-filled

**前提** Recycler 的 Scrap Metal 缺口已使自动补全生成 Scrap Processor
**当** 生产界面渲染自动工业区
**那么** 自动工业区 SHALL 显示对应 Scrap Processor 及数量
