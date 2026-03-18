#!/usr/bin/env python3
"""运行新处理器脚本。"""

import sys
from pathlib import Path

# 添加 scripts 目录到 Python 路径
script_dir = Path(__file__).resolve().parent / "scripts"
if str(script_dir) not in sys.path:
    sys.path.insert(0, str(script_dir))

from processor.map import main

if __name__ == "__main__":
    main()
