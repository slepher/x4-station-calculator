# logical-flow-planner Specification

## Purpose
落实已有的同 ware 不同 moduleId 节点独立显示要求。

## MODIFIED Requirements
### Requirement: 基于 Module ID 的物理隔离
同组中不同 moduleId 的生产节点 SHALL 保持各自身份；普通与紧凑视图 SHALL 显示节点自身模块名称。不得通过 wareId 首次匹配代替节点身份。

#### Scenario: 同产物不同种族模块显示各自名称
- **前提** 同组包含 module_gen_prod_hullparts_01 与 module_tel_prod_hullparts_01 两个 manual 节点
- **当** 用户拖动合法产物进入紧凑视图
- **那么** 两个节点分别显示通用与 Teladi 模块名称
- **并且** 释放后的节点身份与各自连接保持正确
