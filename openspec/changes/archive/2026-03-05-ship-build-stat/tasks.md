# Tasks: ship-build-stat

## 1. 数据源接入与字段映射

- [x] 1.1 在 ship-build stat 计算层引入 `ships.json` 与 `equipments.json` 的字段映射。
- [x] 1.2 落地可计算字段真实值：船体、船员、仓储、泊位/容量、护盾聚合、速度链路。
- [x] 1.3 无法计算字段（武器爆发/持续输出、炮塔平均输出）保留占位并显示待接入提示。
- [x] 1.4 使用 Heron Vanguard（`ship_tel_l_trans_container_02_a`）建立回归样本断言。

## 2. 中列属性双档位

- [x] 2.1 在中列属性区增加 `简略/详细` 档位切换控件。
- [x] 2.2 默认进入 `简略` 档位并展示截图 2 对齐字段。
- [x] 2.3 切换到 `详细` 档位时展示截图 1 对齐字段（真实值 + 占位混合）。
- [x] 2.4 保证 `详细` 字段集合覆盖 `简略` 字段集合。

## 3. 高度策略调整

- [x] 3.1 移除中列属性区固定高度限制。
- [x] 3.2 移除已选详情区固定高度限制。
- [x] 3.3 检查取消固定高度后桌面与移动端布局可读性。

## 4. 文案与定位

- [x] 4.1 补充双档位与占位提示的 i18n 键（zh-CN/en）。
- [x] 4.2 按截图字段补充中英文 label 键与单位文案。
- [x] 4.3 为属性面板与档位按钮提供稳定 `data-testid`。

## 5. 修正占位字段

- [x] 5.1 修正雷达范围(radar_range)：从 `ship.radarRange` 获取
- [x] 5.2 修正可投放设备(deployable)：从 `ship.storage.deployable` 获取
- [x] 5.3 修正干扰弹(countermeasure)：从 `ship.storage.countermeasure` 获取
- [x] 5.4 实现武器爆发输出值：从 blueprint.connections + bullets.json 计算
- [x] 5.5 实现武器持续输出值：从 blueprint.connections + bullets.json 计算
- [x] 5.6 实现炮塔平均输出值：从 blueprint.connections + bullets.json 计算

## 6. Blueprint 数据源重构

- [x] 6.1 将 getShieldStats() 改为从 blueprint.connections 获取已选护盾设备
- [x] 6.2 将 getEngineStats() 改为从 blueprint.connections 获取已选引擎设备
- [x] 6.3 移除对 selectedByConnection ref 的属性计算依赖

## 7. 构建验证

- [x] 7.1 完成改动后执行 `npm run build` 并通过。
