# T016-A3 定向 owner 分析

- Role: planner；当前 runtime/profile 已匹配 `gpt-6-astra / high`。
- Assignment: generation-6，T016 contract Revision 4，A3 placement 红例定向分析。
- Publication: T016-A3-owner/1；仅新增本结果，不改源码、测试、共享文件或 runtime status。
- Decision: `test-oracle-correction`；责任仍为 T016 implementation owner，Owned paths 仍只有 `tests/e2e/map/x4-import-move.spec.ts`。
- Returns to: dispatcher 换发以下精确修正指令 → T016 下一空闲 attempt → independent reviewer → dispatcher → T025。

## 结论

这两项失败来自测试把“小数屏幕落点”当作精确 raw center 的 oracle 前提。8.0 fixture 与静态中心 `{x:192000,z:-128000}` 正确；当前缩放下 mouse 坐标的不足一像素偏差会放大成约六万原始单位。现有证据不成立产品 source 缺陷，应在 T016 spec 内修正整数 pointer 落点及其独立几何 expected，保留 6000 容差、原六项 import、两项 placement 和保存恢复验收。

无需新增产品 owner 或扩大 T016 ownership。当前磁盘总计划实际为 Revision 5；其 D15 只补 T014 current Unit 消费者，T016 仍是 Revision 4。本结果不回退该修订，也不宣称已改 canonical plan/task 文件。

## 证据与坐标语义

1. [T016 合同](../tasks/T016.md) Acceptance 2 要求固定版本、storage key、pointer 落点和独立几何 expected；并没有规定任意接近中心的 pointer 都应吸附到中心。[map-station 规范](../../../../../openspec/specs/map-station/spec.md) 的 `Drag To Map Sector And Save Raw Position` 要求保存实际原始 `{x,z}`；`x4-import-move` 规范不另行定义坐标转换。binding 自动中转站的“默认中心”场景不适用于此处 blueprint station/sector 的拖放。
2. `src/assets/x4_game_data/8.0-Diplomacy/data/maps.json:3914` 的 `cluster_01_sector001_macro` 属于 `cluster_01_macro`；`:3937` raw center 为上述中心，`:3950` 附近 `normalized.scale_per_radius = 1.4073989167353207e-6`，sunlight 为 `1.23`。静态 zones/gates 相对中心的最大半径独立算得 `492270.04141416756`，与数据中的 `scale_basis.max_extent` 相同，因此此处静态 scale 与运行转换所需尺度一致。
3. `src/composables/useMapSvgSectors.ts:215-301` 从同一组 `sector.sx/sy/radius` 生成 polygon 与公开 sector layout。`src/components/map/MapWorkbenchView.vue:1155-1205` 将 client 坐标逆变换到 SVG，再按该 layout 计算比例。`src/components/map/utils/coordinates.ts:85-101` 用 `raw.x = center.x + ratio.x / scale`、`raw.z = center.z - ratio.y / scale` 还原原始位置，随后取整。因此几何中心对应 raw center，但偏离几何中心的 pointer 应保存偏移位置。
4. blueprint 路径为 `onMouseMove → resolveLocationAtPointer → placementPreview → stopDrag → applyLocationToItem`，分别调用 `blueprintStore.setStationLocation / setSectorLocation`（`MapWorkbenchView.vue:1308-1357,1917-1939,1990-1995`）。`useBlueprintProductionStore.ts:571-576` 委托 `useEmpireDataStore.ts:258-265,304-310` 按实体 id 深拷贝 location，无后续坐标变换。`useMapStationPresenter.ts` 的对象列表区分 station/sector；该 Vue 实际写入仍是直接访问 store 的历史路径，本次不扩大为架构整改。

### 最终 trace 的数值闭合

直接读取 A3 `playwright-results-final` 两份 trace，而非用 debug trace 替代：

- [station final trace](../evidence/T016-A3/playwright-results-final/map-x4-import-move-x4-impo-420a8-erves-full-spatial-identity-chromium/trace.zip)：`0-trace.trace` 的 `call@493/499` 确认定位 `.sector-polygon`；`call@507` 的真实 mouseMove 目标为 `(719.9898376464844,645.5841979980469)`，`steps:4`；`call@509` mouseUp。
- [sector final trace](../evidence/T016-A3/playwright-results-final/map-x4-import-move-x4-impo-a3ab1--preserves-station-contrast-chromium/trace.zip)：`call@43/49` 同为 `.sector-polygon`，`call@57` 使用同一目标；`call@65` 读回 sector location `{x:130965,z:-91980}`，station location 仍 undefined。
- station snapshot `after@call@493`：SVG `width=1246,height=606,viewBox="0.0 0.0 6480.0 3151.6"`；polygon 横向极值 `3596.1,3715.9`。由此屏幕半径约 `11.517808641975325px`，每屏幕像素约 `61689.738421395356` raw units。6000 容差只覆盖 `0.09726090843528473px`。

按已知小数目标落到整数 `(719,645)`，仅用上述渲染几何与静态数据计算：

```text
dx = 719 - 719.9898376464844 = -0.989837646484375 px
dy = 645 - 645.5841979980469 = -0.584197998046875 px
x = round(192000 + dx * 61689.738421395356) = 130937
z = round(-128000 - dy * 61689.738421395356) = -91961
actual = {x:130965,z:-91980}
absolute residual = {x:28,z:19} < 6000
```

同一个不足一像素的偏差同时解释两个坐标及两个实体路线。整数 mouse client 坐标量化是与 trace/source 数值一致的归因；trace 没有直接记录 DOM MouseEvent.clientX/Y，不能把上述整数值冒称为已捕获的 DOM event。修正时直接发送整数 pointer，消除对隐含取整方式的依赖。SVG 顶点 `toFixed(1)`（`utils/geometry.ts:5-15`）及几何半径精度可解释几十单位残差，远小于原容差。

debug trace 使用整个 `<g>`，最终 trace 已使用 polygon，二者本次落点相同；因此最终失败不能再归因为“尚未切换 polygon”或资源徽标扩大包围盒。版本也已修复：trace 初始化最终选择 `8.0-Diplomacy`，结果读回 `x4_empire_data`。

## 给 T016 owner 的精确修正

只改 Owned spec。保留 `expectedPlacement.pos` 作为静态 raw center 参考值，新增固定尺度常量，令拖拽 helper 在动作前用 polygon 几何和整数 pointer 计算 expected，返回给两个调用者。不要把实际 `{130965,-91980}` 写成 expected，也不要调用/导入被测 coordinates、presenter 或 store 转换函数。

将局部 `dragPanelItemToSector` 替换为以下形状（沿用文件现有 `page/item` 类型即可）：

```ts
// Fixed 8.0 maps.json, cluster_01_sector001_macro.normalized.scale_per_radius.
const PLACEMENT_SCALE_PER_RADIUS = 1.4073989167353207e-6

const dragPanelItemToSector = async (page: any, item: any) => {
  const sector = page.locator(`[data-map-sector-id="${placementSectorMacro}"] .sector-polygon`).first()
  await expect(sector).toBeVisible()
  const source = await item.boundingBox()
  const target = await sector.boundingBox()
  expect(source).not.toBeNull()
  expect(target).not.toBeNull()
  const center = {
    x: target!.x + target!.width / 2,
    y: target!.y + target!.height / 2
  }
  // Freeze an integer screen input; expected describes this point, not the ideal center.
  const pointer = { x: Math.floor(center.x), y: Math.floor(center.y) }
  const screenRadius = target!.width / 2 // flat-top regular hexagon
  expect(screenRadius).toBeGreaterThan(0)
  const rawPerPixel = 1 / (screenRadius * PLACEMENT_SCALE_PER_RADIUS)
  const expectedPos = {
    x: Math.round(expectedPlacement.pos.x + (pointer.x - center.x) * rawPerPixel),
    z: Math.round(expectedPlacement.pos.z - (pointer.y - center.y) * rawPerPixel)
  }
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2)
  await page.mouse.down()
  await page.mouse.move(pointer.x, pointer.y, { steps: 4 })
  await page.mouse.up()
  return expectedPos
}
```

同步三个局部修改：

1. `expectPlacement(location)` 改成 `expectPlacement(location, expectedPos: { x: number; z: number })`。只将最后两项坐标比较的 `expectedPlacement.pos.x/z` 改成 `expectedPos.x/z`；cluster、sector、sunlight、五项 resources 断言原样保留，`POSITION_TOLERANCE = 6000` 原样保留。
2. 两个 placement case 分别写 `const expectedPos = await dragPanelItemToSector(page, stationItem)` 或 `sectorItem`；拖放后与 reload 后各调用一次 `expectPlacement(...location, expectedPos)`。共四处，始终复用拖放前建立的 expected，reload 后不得重新按画面布局生成 expected。
3. 在旧七项 → 八项场景映射/注释里明确：6 import 保留；station 加强、sector 新增；pointer 是 polygon 中心附近确定的整数屏幕像素，独立 raw expected 使用固定 8.0 数据和动作前 DOM 几何。无需新增 fixture/helper/config。

该修正验证真实落点。若产品错误地将落点吸附为中心或持久化归一化坐标，仍会失败；测试也仍会在身份错误、另一实体被误改、保存丢失或 reload 错配时失败。6000 的含义不变，不以放大容差掩盖偏差。

## 合同勘误与交接边界

T016 Revision 4 Acceptance 3 的 `position {x,y,z}` 与既有规范及 `src/types/x4.ts:448-457` 的 EntityLocation 不一致。[A2 review F3](T016-A2-review.md) 已指出这一点；A3 删除合成 y 的处理正确。planner 在此确定唯一语义勘误：该项应读作 `position 原始 {x,z}（EntityLocation）`，不得重新合成 y，也不要求新增持久化字段。下次正式合同同步仅替换这段形状文字，其余验收保持；本结果只发布该精确文本，不声称 canonical T016 已被改写。

本次 oracle 修正在现有 Acceptance 2 和 Owned paths 内，不需要产品 revision amendment。dispatcher 将本结果作为显式补充输入交给原 T016 owner；所有 source/helper/config/fixture 继续只读。T025 保持对 T016 修正、独立 review 和完整 spec 结果的依赖，无关任务继续；本结果不记录任何任务 accepted。

## 保留结果与后续验证

- 保留 A1、A2、A3 及全部失败 trace，不覆盖、不拼接为绿色结果。[A3](T016-A3.md) 的 fresh build、8 执行/6 passed/2 failed 保留。上述计算是本轮只读分析，不是一次新 E2E 或候选修正后的 pass。
- A3 原始 readback 已含正确 station/sector 身份、sunlight 123、完整 resources、dirty true 及未误改对照；当前 `expectPlacement` 的 metadata 断言在 position 之前。A3 结果末段将资源断言一并称为“position 下游未执行”过于宽泛。UI Save → dirty false → reload 身份/位置/环境断言才是两项失败后尚未执行的验收，仍必须补证。
- 由 dispatcher 预留下一空闲 attempt（A4 仅在路径确实空闲时使用），按原合同独占 `shared-dist-build`、`chromium-runtime`、`preview-port-23116`，使用默认 fresh build → preview，仅执行完整 `tests/e2e/map/x4-import-move.spec.ts` 的 Chromium、workers=1、retries=0、trace=on 命令及 scoped diff check。要求最新单次 8 passed、0 failed/skipped/flaky/retried，并绑定新候选与日志/trace。
- independent reviewer 核对 expected 在动作前生成、无被测函数反推、容差未放宽及两种 Save/reload 实际到达。若仍失败，先报告整数 pointer、polygon bounds、独立 expected 与实际值，禁止据此自行改 source；新的超出量化误差的证据再回 planner。
- 无待用户裁决的产品语义。剩余是 T016 spec 实施及运行验证；T025 的 full E2E 属于原有后续合同，本次未运行 build 或 E2E。

Stop That Shit 技能用于限制本次为指定结果文件与定向只读分析；未引入额外审计或 source 修复任务。该结论与修正属于测试合同，不应用产品 implementation-simplicity 标准。
