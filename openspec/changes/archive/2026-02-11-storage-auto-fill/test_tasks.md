# Verification Tasks

## Unit Tests

- [x] **验证 Python 数据处理** <!-- id: 0 -->
    - [x] 运行 `scripts/x4_data_processor.py` (如果环境允许) 或检查代码逻辑
    - [x] 检查 `src/assets/x4_game_data/.../data/modules.json` (模拟或实际) 确认仓储模块包含 `cargo: { capacity: ..., type: ... }`

- [x] **验证仓储自动填充算法 (Logic)** <!-- id: 1 -->
    - [x] **Case 1: 基础填充**
        - 设置一个简单的工厂（如 Energy Cells 生产），设定 Buffer 时间。
        - 确认自动填充了正确的 Container 仓储。
    - [x] **Case 2: 种族偏好**
        - 切换 Station Settings 的 Race Preference。
        - 确认自动填充的仓储模块变为对应种族的 L 级仓储。
    - [x] **Case 3: 增量填充**
        - 模拟手动添加仓储。
        - 确认自动填充的数量减少（仅补齐缺口）。
    - [x] **Case 4: 优先级与缓冲响应**
        - 模拟副产物优先级调整和缓冲时间变化。
        - 确认计算结果响应正确。
    - [x] **Case 5: AutoSupply 独立仓储**
        - 开启 "Auto Workforce" 和 "Internal Supply"。
        - 确认系统生成了 AutoSupply 仓储。

- [x] **验证类型兼容性** <!-- id: 2 -->
    - [x] 确保前端应用无 TypeScript 错误。

## Web Integration Tests

- [x] **验证仓储自动填充 UI (E2E)** <!-- id: 3 -->
    - [x] **Case 1: 基础填充**
        - 添加生产模块。
        - 确认自动工业区出现 L 级仓储。
    - [x] **Case 2: 种族偏好**
        - 切换种族设置。
        - 确认仓储模块变为对应种族。
    - [x] **Case 3: 增量填充**
        - 手动添加 L 级仓储到规划区。
        - 确认自动工业区的仓储数量减少或消失。
    - [x] **Case 4: 优先级与缓冲响应**
        - **场景 A: 副产物优先级**
            - 调整副产物优先级为忽略。
            - 确认自动仓储需求减少。
        - **场景 B: 缓冲时间**
            - 调整缓冲时间滑动条。
            - 确认自动仓储数量实时变化。
    - [x] **Case 5: AutoSupply 独立仓储**
        - 开启 自动工业区的"考虑工人效率加成"选项。
        - 确认自动补给区出现集装仓储和固体仓储。
