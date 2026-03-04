# Test Tasks: import-export

## 1 单元测试

- [✓] 1.1 解析导入包并统计模块
  - [✓] 1.1.1 normalize payload 后统计三模块条目数 #期望: [3]

- [✓] 1.2 覆盖导入写入三模块
  - [✓] 1.2.1 overwrite 模式写入 empire/flow/ship 并刷新对应 store #期望: ["imp-empire"]

- [✓] 1.3 增量导入 activeId 脏数据保护
  - [✓] 1.3.1 incremental 且 flow isDirty=true 时保持现有 activeId #期望: ["flow-a"]

- [✓] 1.4 增量导入重生 id
  - [✓] 1.4.1 incremental 导入 ship 时冲突 id 重生且无冲突 #期望: ["bp-a",2]

- [✓] 1.5 导出包格式
  - [✓] 1.5.1 export payload 包含 format/version 与三模块数据 #期望: ["x4-import-export",1]

## 2 E2E 标准状态与状态迁移

- [✓] 2.1 状态: 导出按钮触发下载
  - [✓] 2.1.1 点击导出按钮并收到 `.json` 下载 #期望: ["x4-export-"]

- [✓] 2.2 状态: 导入文件并进入配置面板
  - [✓] 2.2.1 上传 `import-full.json` 后显示导入配置 #期望: ["storage-import-config"]

- [✓] 2.3 状态: 覆盖模式默认全选
  - [✓] 2.3.1 上传后保持 overwrite 并断言三模块默认选中 #期望: [true]

- [✓] 2.4 状态: 覆盖模式取消flow后导入
  - [✓] 2.4.1 取消 flow 模块后执行导入并保持 flow 基线数据 #期望: ["imp-empire-1","logic-flow-1"]

## 3 E2E 测试场景

- [✓] 3.1 Case: 导入导出主路径编排
  - [✓] 3.1.1 状态: 导出按钮触发下载
  - [✓] 3.1.2 状态: 导入文件并进入配置面板
  - [✓] 3.1.3 状态: 覆盖模式默认全选
  - [✓] 3.1.4 状态: 覆盖模式取消flow后导入
    - [✓] 3.1.4.1 导入后保持 flow activeId 不变 #期望: ["logic-flow-1"]

## 4 Bug 测试

- [✓] 4.1 BUG-1: 增量导入 activeId 误覆盖回归
  - [✓] 4.1.1 问题复现步骤: 设置 flow 基线并执行增量导入
  - [✓] 4.1.2 修复前断言: 脏 flow 上下文下增量导入保持 activeId #期望: ["logic-flow-1-pre"]
  - [✓] 4.1.2 修复后断言: 脏 flow 上下文下增量导入保持 activeId #期望: ["logic-flow-1-post"]
