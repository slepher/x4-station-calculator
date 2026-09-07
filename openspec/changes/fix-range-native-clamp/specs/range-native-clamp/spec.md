## ADDED Requirements

### Requirement: 原生值与规范化值同步
双阶段滑块SHALL在input和commit规范化时同步原生input.value与输出值；重复越界事件且父prop未改变也SHALL生效。

#### Scenario: 剩余容量220而全量250
- **WHEN** 原生滑块连续请求250且dragMax为220
- **THEN** 原生值、update和commit值为220，HTML max仍250且控件不禁用。

#### Scenario: 保留调用者事件语义
- **WHEN** 鼠标或触摸结束后出现change
- **THEN** 保持现有单次commit及卸载清理；无dragMax的Fit数量预演/提交与step不变。
