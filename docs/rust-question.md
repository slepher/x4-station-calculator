Q1:
我正在看一个关于 Rust 生命周期的教程，这是其中一段演示悬垂指针（Dangling Pointer）的示例代码。

代码里有一行注释解释了为什么这里会报错，但我看着有点晕。你能帮我详细分析一下，为什么 lines 离开作用域后，返回 lines[0] 会导致编译错误吗？

```
fn get_first_line<'a>(text: &'a str) -> &'a str {
    let lines: Vec<&str> = text.lines().collect();
    
    // 错误点：lines 是一个局部变量，函数结束后会被销毁 (Drop)。
    // 这里试图返回 lines 内部元素的引用，
    // 按理说应该报错 "returns a value referencing data owned by the current function"。
    lines[0] 
}
```
请详细解释一下，为什么 Rust 的借用检查器会在这里报错？这个悬垂引用是如何产生的？
Q2:
我记得在 Rust 的早期版本中，下面这段代码是无法编译通过的，因为那时候借用检查器（Borrow Checker）比较笨，认为 lines 离开作用域后，返回的 lines[0] 也会失效。
请问这个问题是在哪个版本修复的？