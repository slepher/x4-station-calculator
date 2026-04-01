# Rust Save Parser

X4 存档解析器的 Rust WASM 实现，用于高性能解析大型存档文件。

## 构建

### 前置要求

- Rust 1.70+
- wasm-bindgen: `cargo install wasm-bindgen-cli`
- wasm-pack（可选）: `cargo install wasm-pack`

### 方式一：使用 wasm-pack（推荐）

```bash
# 进入 rust-parser 目录
cd rust-parser

# 编译为 Web 目标
wasm-pack build --target web --out-dir pkg

# 复制到 src/wasm/ (项目使用)
cp pkg/*.{js,wasm,d.ts} ../src/wasm/
```

### 方式二：使用 wasm-bindgen

```bash
# 进入 rust-parser 目录
cd rust-parser

# 编译 Rust 到 WASM
cargo build --release --target wasm32-unknown-unknown

# 生成 JS 绑定
wasm-bindgen target/wasm32-unknown-unknown/release/save_parser.wasm \
  --target web \
  --out-dir pkg \
  --out-name save_parser

# 复制到 src/wasm/
cp pkg/*.{js,wasm,d.ts} ../src/wasm/
```

## 项目结构

```
rust-parser/
├── Cargo.toml          # Rust 项目配置
├── src/
│   └── lib.rs          # 解析器实现
├── pkg/                # 编译输出（wasm-pack 生成）
│   ├── save_parser.js          # JS 绑定
│   ├── save_parser_bg.wasm     # WASM 二进制
│   ├── save_parser.d.ts        # TypeScript 类型定义
│   └── save_parser_bg.wasm.d.ts
└── examples/
    └── node_demo.rs    # Node.js 示例
```

## API

### SaveParser 类

```typescript
import initWasm, { SaveParser } from '@/wasm/save_parser'

// 初始化 WASM
await initWasm()

// 创建解析器
const parser = new SaveParser()

// 设置期望版本（可选，用于早期版本校验）
parser.set_expected_version('8.0')

// 设置预期总字节数（可选，用于进度计算）
parser.set_expected_total_bytes(totalBytes)

// 输入数据
parser.push_chunk(uint8Array)

// 标记输入完成
parser.finish_input()

// 处理解析事件
while (parser.pump(50000)) {
  const progress = JSON.parse(parser.progress_json())
  console.log(progress.percent, progress.sector_count)
  
  // 检查错误
  if (progress.error) {
    console.error(progress.error)
    break
  }
}

// 获取结果
const json = parser.finish(filename)
const archive = JSON.parse(json)
```

### ProgressInfo 结构

```typescript
interface ProgressInfo {
  phase: 'Receiving' | 'Parsing' | 'Finalizing' | 'Done' | 'Error'
  input_bytes_total: number
  parsed_bytes_total: number
  buffered_bytes: number
  expected_total_bytes: number
  percent: number
  tag_count: number
  sector_count: number
  done: boolean
  input_complete: boolean
  error: string | null
}
```

## 性能

- SAX 解析器 (sax-js): ~15-30 MB/s
- Rust WASM 解析器: ~50-100 MB/s (约 3.25x 更快)

## 版本校验

解析器支持早期版本校验：

1. 调用 `set_expected_version(version)` 设置期望版本
2. 解析到 `<game>` 标签时自动校验
3. 版本不匹配时设置错误状态，停止解析

错误消息格式：
```
Version mismatch: save version 700 (7.0) does not match current game version 8.0 (8.0)
```

## 依赖

- `wasm-bindgen` - Rust/WASM 互操作
- `quick-xml` - XML 解析
- `serde` / `serde_json` - JSON 序列化