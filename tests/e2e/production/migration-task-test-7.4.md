# M7.4 帝国导入导出迁移

24项原标题/顺序保留；原11skip全部活跃。状态与完整证据见 direct-migration/results/M7.4.md，报告交主agent验收。

规范：import-export、x4-import-move，补充module-id、simplify-flow；当前正式schema为Empire5/Flow3/Ship5（storageVersions.ts），旧标题里的V3/V2是原编号，当前expected按最新结构迁移。

普通beforeEach注入db.json除vsn、显式8.0（测试旧版兼容及固定canonical存储键）、reload与UI语言。Flow Simplify使用明确legacy-flow-v2种子：原db本已V3，所以将第一plan真实展开为moduleId/wareId/isIsolated加id/race/lineage/column/isRoot/order/source，再初始化空帝国；没有业务store写入。所有导入、导出、保存均由UI，evaluate仅fixture及读取。

导入完成由主frame导航事件确认；业务结果读取前明确等待activeEmpire完成初始化，避免page.reload返回而异步store仍为null。无force点击、事件注入、重试fallback、吞异常、恒真断言或条件通过。

独立节点oracle：E1-S1=[{module:claytronics},{module:hullparts},{isolated:quantumtubes}]；E1-S2=[{module:quantumtubes}]；E1-S3=[{module:foodrations},{module:medicalsupplies}]。模块使用完整module_gen/module_arg canonical ID。导入站点期望来自这些显式手动节点，不调用生产迁移/导入算法计算expected。

| 原顺序/标题 | 当前行 | 用户动作 | 独立expected |
|---|---|---|
| 1. 2.1 状态: 导出按钮触发下载 | import-export.spec.ts:177 | 点击导出并读取实际下载文件 | 8.0文件名；format/version/game_vsn/beta；Empire5/Flow3/Ship5；原3帝国ID |
| 2. 2.2 状态: 导入文件并进入配置面板 | import-export.spec.ts:183 | 上传原full文件进入配置 | 覆盖/增量可见，原3模块checkbox均选中 |
| 3. 2.3 状态: 覆盖模式默认全选 | import-export.spec.ts:189 | 上传后查看默认勾选 | Empire/Flow/Ship全部checked |
| 4. 2.4 状态: 覆盖模式取消flow后导入 | import-export.spec.ts:190 | 取消Flow后覆盖，等待导入触发刷新 | 帝国imp-empire-1且船体模块1；整个Flow对象不变 |
| 5. 3.1 Case: 导入导出主路径编排 | import-export.spec.ts:191 | 编辑导出名、下载→覆盖取消Flow→再次下载 | 自动补.json；最新版本；帝国模块内容已变，Flow整个payload不变 |
| 6. 4.1 BUG-1: 增量导入 activeId 误覆盖回归 [bug原始] | import-export.spec.ts:201 | 增量上传同ID Flow | 旧activeId与旧plan全部内容不变，新增对象与group重生ID，energycells isolated内容保留 |
| 7. 4.1 BUGFIX: 增量导入 activeId 误覆盖回归 [bugfix修复] | import-export.spec.ts:213 | 增量上传同ID Empire/Flow | 两模块activeId均保持，list均4且ID唯一，新站ID重生，claytronics模块1 |
| 8. 2.1 状态: empire-v2-macro | import-export.spec.ts:229 | 上传Empire V2宏ID文件 | 确认V2前置与帝国勾选，取消不导入 |
| 9. 2.2 切换: empire-v2-macro -> empire-v3-module | import-export.spec.ts:235 | 覆盖Empire V2并等待reload | version5；帝国/站ID和名称保留；HULL+ENERGY canonical各1 |
| 10. 2.3 状态: flow-v1-macro | import-export.spec.ts:236 | 上传Flow V1展开节点文件 | 确认V1前置与Flow勾选，取消不导入 |
| 11. 2.4 切换: flow-v1-macro -> flow-v2-module | import-export.spec.ts:242 | 覆盖Flow V1并等待reload | version3、imp-flow-1；nodes精确[{module:HULL}] |
| 12. 3.1 Case: 导入 Empire 旧版本后自动迁移到最新 | import-export.spec.ts:243 | 覆盖Empire V2→额外reload | 最新结构与内容全部等于导入完成时快照 |
| 13. 3.2 Case: 导入 Flow 旧版本后自动迁移到最新 | import-export.spec.ts:248 | 覆盖Flow V1→额外reload | 最新极简结构与内容全部等于导入完成时快照 |
| 14. 3.3 Case: 导出总是输出最新版本 | import-export.spec.ts:253 | 导入旧Empire再真实下载 | 导出schema5/3/5、game8.0；HULL+ENERGY各1 |
| 15. 3.4 Case: XML 与 x4-game 输入统一归一 module id | import-export.spec.ts:259 | overview分别上传XML宏ID及x4-game canonical分享串；UI保存reload | 新增2个独立站；XML名称；两站ENERGY+REFINED各1；reload完整身份/内容不变 |
| 16. 4.1 BUG-001: 导入旧版本 JSON 后 Empire 版本未升级 [bug原始] | import-export.spec.ts:280 | 执行旧Empire导入（原bug场景） | 精确最新version5与两个canonical模块，移除旧>=2弱断言 |
| 17. 4.1 BUGFIX: 导入旧版本 JSON 后 Empire 版本未升级 [bugfix修复] | import-export.spec.ts:281 | 旧Empire导入再下载（修复场景） | 导出也精确version5 |
| 18. 2.1 状态: flow-v2-storage-loaded | import-export.spec.ts:322 | 加载真实展开字段V2 fixture | 动态升级V3；3组nodes与下文固定列表完全一致 |
| 19. 2.2 状态: flow-import-empire-modal-ready | import-export.spec.ts:323 | overview打开逻辑组网导入 | plan list、logic-flow-1直接导入按钮可见 |
| 20. 2.3 切换: flow-v2-storage-loaded -> flow-import-empire-modal-ready | import-export.spec.ts:324 | 先验证V2→V3，再进入导入 | 精确极简nodes以及可达导入列表 |
| 21. 3.1 Case: V2 flow 数据加载后自动迁移为 V3 极简节点结构 | import-export.spec.ts:325 | V2加载后验证所有nodes与预览 | 精确module/isolated节点列表，无运行字段；预览3组 |
| 22. 3.2 Case: Empire 导入 flow 时最小节点结构仍可直接导入 | import-export.spec.ts:329 | 直接导入逻辑组网 | 3站E1-S1/2/3；精确手动模块配置与锁定货物映射，无warning |
| 23. 4.1 BUG-001: V2 节点加载后仍保留旧字段导致 V3 迁移不完整 | import-export.spec.ts:330 | V2加载→reload→真实导出 | 两次加载与下载均保持同一精确极简nodes |
| 24. 4.2 BUG-002: Empire 导入 flow 时忽略 isolated 节点的锁定货物映射 | import-export.spec.ts:336 | 导入含quantumtubes isolated的plan→UI命名保存→reload | 3站按名称对应；仅E1-S1 lockedWares=[quantumtubes]，另两站[] |
