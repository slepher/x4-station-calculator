# x4-import-move Bugs

## Bug: x4-station 导入页切换后触发运行时 SyntaxError，导致导入输入区不可用
- **ID**: BUG-001
- **Description**: 在帝国总览进入统一导入 modal 并切换到 `x4-station` tab 后，页面抛出 `SyntaxError: 10`，随后输入框不可交互，无法完成 x4-game 串导入。
- **Steps to Reproduce**:
  1. 进入帝国总览页面。
  2. 点击 `logicflow-import-entry-empire` 打开统一导入 modal。
  3. 切换到 `top-view-btn-import-view-x4-station`。
  4. 尝试在 `import-x4-station-input` 输入 `l=@$module-prod_gen_energycells_macro,count:1`。
- **Expected Behavior**: 能正常输入并导入，导入后新建空间站名称为 `新建空间站`。
- **Actual Behavior**: 控制台出现 `SyntaxError: 10`，并被测试环境捕获为 JS 运行时异常，后续输入步骤超时。
- **Status**: New
- **Related Test**: 3.4
