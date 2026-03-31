# Rust WASM 流式解析器重构设计

## 背景

当前 Rust WASM 解析器使用 `feed()` API，一次性处理大量数据块，导致：
1. 进度反馈不准确 - `feed()` 统计的是输入字节，不是解析进度
2. 长时间阻塞 - 单次调用可能运行 20 秒，前端无法获取中途进度
3. 假 100% 问题 - 输入完成但解析未完成时显示 100%

## 目标

实现流式解析 + 真实进度反馈：
- 分离输入层和解析层
- 每次解析只处理有限事件数
- 前端能实时获取解析进度

## 设计

### 新 API

```rust
#[wasm_bindgen]
impl SaveParser {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self;

    pub fn set_expected_total_bytes(&mut self, total: usize);
    pub fn push_input(&mut self, input: &[u8]);
    pub fn pump(&mut self, max_events: usize) -> bool;
    pub fn mark_input_complete(&mut self);
    pub fn progress_json(&self) -> String;
    pub fn finish(&mut self, filename: &str) -> Result<String, JsValue>;
}
```

语义：
- `push_input()` - 只追加字节到内部缓冲区，不解析
- `pump(max_events)` - 最多推进 N 个 XML 事件，返回是否有更多工作
- `mark_input_complete()` - 告知 parser 不会再有更多输入
- `progress_json()` - 返回当前进度状态 JSON
- `finish()` - 只在解析完成后调用，产出结果

### 状态跟踪

```rust
struct SaveParser {
    // 输入缓冲
    buffer: Vec<u8>,
    
    // 进度状态
    input_bytes_total: usize,      // 已接收字节
    parsed_bytes_total: usize,     // 已解析字节
    expected_total_bytes: usize,   // 预期总字节
    
    // 生命周期状态
    phase: ParsePhase,             // Receiving/Parsing/Finalizing/Done/Error
    input_complete: bool,
    done: bool,
    error: Option<ParserError>,
    
    // ... 业务字段
}
```

### ParsePhase 枚举

```rust
enum ParsePhase {
    Receiving,    // 仅接收输入，未开始解析
    Parsing,      // 正在解析
    Finalizing,   // 解析完成，准备输出
    Done,         // 完成
    Error,        // 错误
}
```

### ProgressInfo JSON

```json
{
  "phase": "Parsing",
  "inputBytesTotal": 400000000,
  "parsedBytesTotal": 200000000,
  "expectedTotalBytes": 437000000,
  "percent": 46.0,
  "tagCount": 50000,
  "sectorCount": 5,
  "done": false,
  "inputComplete": true,
  "error": null
}
```

### pump() 核心逻辑

```rust
pub fn pump(&mut self, max_events: usize) -> bool {
    if self.done || self.error.is_some() {
        return false;
    }
    
    let mut processed_events = 0usize;
    let mut consumed = 0usize;
    
    while processed_events < max_events {
        let buf = &self.buffer[consumed..];
        if buf.is_empty() {
            break;
        }
        
        let mut reader = quick_xml::Reader::from_reader(buf);
        // ... 处理单个事件
        let pos = reader.buffer_position() as usize;
        
        // 关键：真实进度
        self.parsed_bytes_total += pos;
        consumed += pos;
        processed_events += 1;
    }
    
    // 清理已消费的 buffer
    if consumed > 0 {
        self.buffer.drain(..consumed);
    }
    
    // 返回是否有更多工作
    !self.buffer.is_empty() || !self.input_complete
}
```

### ComponentCtx 改为显式字段

```rust
struct ComponentCtx {
    class: String,
    code: Option<String>,
    macro_field: Option<String>,
    owner: Option<String>,
    known: bool,
    knownto_player: bool,
    own_offset: Vector3,
}
```

移除 `attrs: HashMap<String, String>`，改为显式字段：
- 更高效（避免 HashMap 克隆）
- 更清晰（字段含义明确）

## 前端调用方式

```typescript
const parser = new wasm.SaveParser()
parser.set_expected_total_bytes(xmlBytes.length)

parser.push_input(xmlBytes)
parser.mark_input_complete()

while (true) {
  const hasMore = parser.pump(4000)
  const progress = JSON.parse(parser.progress_json())
  renderProgress(progress)
  if (!hasMore) break
}

const result = parser.finish(filename)
```

## 文件改动

| 文件 | 改动 |
|------|------|
| `rust-parser/src/lib.rs` | 重构核心解析器 |
| `src/workers/saveParserRust.worker.ts` | pump 循环 |
| `src/components/save/SaveUploadPanel.vue` | 进度条更新 |
| `tests/unit/save-import/save-parser.spec.ts` | 单元测试适配 |

## 移除的旧 API

- `feed()` - 替换为 push_input + pump
- `parse_save()` - 替换为 new + push_input + pump + finish
- `tag_count()` - 通过 progress_json 获取
- `sector_count()` - 通过 progress_json 获取