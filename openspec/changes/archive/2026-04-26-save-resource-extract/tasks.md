# Tasks: save-resource-extract

## 实施任务

- [x] 将核心提取与聚合逻辑实现到 `src/utils/saveResourceExtract.ts`
- [x] 新增 `scripts/extract_resources.tsx` 作为命令行入口
- [x] 保持 sector JSON 的中间结构为 `ware -> yield_name -> resources[]`
- [x] 在聚合阶段接入 `resourceareas.json` 的 region 候选匹配
- [x] 在 region 判定中接入 `regions.json` 提供的边界几何
- [x] 实现基于 `ware + yield_name + 64km x 64km x 64km` 空间重叠的 region 判定
- [x] 实现单 region 命中与多 region 重叠命中的分支处理
- [x] 在 sector 内构建 region overlap graph，并折叠为 connected components
- [x] 将 `total.json` 输出调整为 `sector -> ware -> [{ max, regions[] }]`
- [x] 在 `regions[]` 中输出重叠组内的 `ref`
- [x] 删除实现中与旧 `yields[]` / `ware + yields数组` 模型相关的冲突逻辑与输出约定
- [x] 将 XML 解析库作为运行时依赖加入 `package.json dependencies`
