# 实施发现

## 默认可选地图输入被误判为显式覆盖

- 复现：定向 Unit 的完整最小原始输入不含可选 `god.xml`，默认 context 的路径集合使地图构建按显式输入缺失报错。
- 修复：统一流程只将用户显式选择的路径传给地图和派系构建；默认可选输入按原解析规则处理。
- 当前证据：`tests/unit/processor/pipeline.spec.ts` 覆盖空目录全量及独立目标。
- 最终验证：交由 `/x4:verify`。

## 外部地图的默认资源副文件路径未随输出目录切换

- 复现：独立 `map-resources --maps-json <external>` 不传 output-dir 时，资源目录切到外部地图目录，预建的 regions/regionyields 输出路径仍指向配置目录。
- 修复：目录切换时同步更新未被显式覆盖的资源副文件路径。
- 当前证据：`cli.spec.ts` 检查地图所在目录与副文件路径一致。
- 最终验证：交由 `/x4:verify`。
