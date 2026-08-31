# Show Transit Hub in Sector List Specification

## Purpose

本规格修改星区列表中 transit hub station 的可见性。

## MODIFIED Requirements

### Requirement: Transit hub stations SHALL appear in sector station list

transit hub station SHALL 照常出现在星区列表的 station 项中，不再被隐藏。

#### Scenario: Transit hub station visible in sidebar

- **前提** 当前 binding 存在 transit hub station
- **当** 用户查看侧边栏星区列表
- **那么** transit hub station SHALL 作为普通 station tab 出现在其所属 sector group 下
- **并且** transit hub station 的 `transit` tab SHALL 同时存在（不受影响）
