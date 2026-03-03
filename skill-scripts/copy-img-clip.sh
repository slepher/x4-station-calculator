#!/bin/bash

# 定义图片保存在 Windows 侧和 WSL 侧的路径
WIN_PATH="C:\\temp\\clipboard.png"
WSL_PATH="/mnt/c/temp/clipboard.png"

# 确保 Windows 下有 temp 文件夹
mkdir -p /mnt/c/temp

# 清理旧文件，避免误判
rm -f "$WSL_PATH"

# 调用 PowerShell 从剪贴板获取图片并保存
powershell.exe -NoProfile -STA -command "
Add-Type -AssemblyName System.Windows.Forms;
\$image = [System.Windows.Forms.Clipboard]::GetImage();
if (\$image -ne \$null) {
    \$image.Save('${WIN_PATH}', [System.Drawing.Imaging.ImageFormat]::Png);
    exit 0;
} else {
    exit 1;
}
" > /dev/null 2>&1 || exit 1

# 检查图片是否成功生成
if [ -f "$WSL_PATH" ]; then
    echo "$WSL_PATH"
    exit 0
fi

exit 1
