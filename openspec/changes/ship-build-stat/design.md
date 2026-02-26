## Context

当前“船只建造”中列属性区需要承接两类信息密度：快速浏览（简略）与完整观察（详细）。
你提供的两张截图已经定义了这两个档位的目标字段集合：截图 2 对应简略、截图 1 对应详细。
项目内已有 XML 抽取产物（`ships.json`、`equipments.json`）可覆盖部分详细字段，但武器/炮塔精确输出仍缺少弹体层参数。

## Decisions

1. **双档位模型**：中列属性区采用 `summary/detail` 两态切换，默认 `summary`。
2. **字段矩阵对齐**：
   - `summary` 字段矩阵对齐截图 2；
   - `detail` 字段矩阵对齐截图 1；
   - `detail` 必须覆盖 `summary`。
3. **分层数据策略**：
   - 船体基础（`hull/crew/storage/physics/slots`）来自 `ships.json`；
   - 装备参数（`engine/shield` 统计项）来自 `equipments.json`；
   - 优先显示可计算真实值，无法计算字段才占位。
4. **高度自适应**：中列属性容器与已选详情容器取消固定高度，避免字段增加时信息被裁切。
5. **可测试设计**：为属性区和两档位按钮提供独立 `data-testid`，保证回归可定位。
6. **i18n 先行**：档位名称、待接入提示与新增字段标签先加入 locale 键，减少后续改动面。
7. **样本回归锚点**：将 Heron Vanguard（`ship_tel_l_trans_container_02_a`）作为数据链路验证样本，确保字段来源可追溯。

## Data Mapping (Key Fields)

- `船体(MJ)`：`ship.hull`
- `船员`：`ship.crew.capacity`
- `单位/导弹`：`ship.storage.unit` / `ship.storage.missile`
- `M/S 泊位数量、M/S 飞船容量`：由 `ship.slots` 中对应连接点统计
- `护盾(MJ)`：按已选护盾聚合 `shield.stats.recharge.max`
- `再充率/再充延迟`：按已选护盾聚合 `shield.stats.recharge.rate/delay`
- `速度/助推/巡航`：基于 `ship.physics` 与已选引擎 `engine.stats.thrust/boost/travel` 计算
- `武器爆发/持续输出、炮塔平均输出`：当前保持占位（缺弹体层参数）

## Non-Goals

- 本 change 不补充新的原始弹体资产包。
- 本 change 不在本轮定义武器/炮塔精确 DPS 公式。

## Risks

- 速度链路存在口径差异风险（游戏内显示值与公式结果可能需校准系数）。
- 武器/炮塔输出字段暂为占位，用户可能预期其为真实值。
- 取消固定高度后，极端字段数量下需要关注小屏阅读性（可后续再加折叠策略）。
