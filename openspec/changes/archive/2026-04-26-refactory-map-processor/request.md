# Refactory Map Processor

## 背景

`scripts/x4_data_map_processor.py` 文件已增长到 3662 行，包含以下问题：

1. **单一文件过于复杂**：所有功能（配置、XML 解析、资源计算、地图生成、输出写入）都在一个文件中
2. **难以维护**：函数之间依赖关系不清晰，修改风险高
3. **测试困难**：无法独立测试各个功能模块
4. **版本分支复杂**：8.0- 和 9.0+ 的资源模型处理逻辑混在一起

## 目标

将 `x4_data_map_processor.py` 分拆到 `scripts/processor/` 目录下的模块化结构中：

```
scripts/processor/
├── config.py                # 运行时配置和路径解析
├── utils/                   # 工具函数子包
│   ├── xml_utils.py         # XML 解析工具
│   ├── math_utils.py        # 数学/几何工具
│   ├── data_utils.py        # 数据转换工具
│   └── noise.py             # Perlin 噪声
├── resource/                # 资源处理模块
│   ├── model_detector.py    # 资源模型检测
│   ├── legacy_processor.py  # 8.0- 传统 regions 模型
│   └── modern_processor.py  # 9.0+ resourceareas 模型
├── sector/                  # Sector 处理模块
│   ├── parser.py            # Sector XML 解析
│   ├── resource_summary.py  # Sector 资源汇总
│   └── template.py          # Sector 模板位置计算
└── map/                     # Map 主处理模块
    ├── generator.py         # generate_map_data 主逻辑
    └── writer.py            # 输出写入
```

## 约束

1. **复制而非重写**：函数逻辑保持原样复制，只调整 import 语句
2. **保留原文件**：`x4_data_map_processor.py` 保持不变，用于 diff 对比验证
3. **输出一致性**：新分拆后的处理器必须产生与原文件完全相同的 JSON 输出

## 验收标准

1. 新模块结构可正常执行，产生与原文件相同的输出
2. 所有函数迁移到对应模块，import 路径正确
3. 原文件保留作为对比基准

## 相关变更

- 与 `map-resource-calc` 变更相关，但聚焦于代码重构而非功能修改
