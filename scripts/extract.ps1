# ================= 读取配置 =================
$ConfigPath = "x4config.json"
if (-not (Test-Path $ConfigPath)) {
    Write-Host "!" * 60 -ForegroundColor Red
    Write-Host "❌ 错误: 找不到配置文件 'x4config.json'"
    Write-Host "💡 请根据 'x4config.json.example' 手动创建配置。"
    Write-Host "!" * 60 -ForegroundColor Red
    Pause; exit
}
$Config = Get-Content $ConfigPath | ConvertFrom-Json
$ToolPath = $Config.X4_PATHS.TOOL_PATH
$GameDir  = $Config.X4_PATHS.GAME_DIR
$OutDir   = $Config.X4_PATHS.SOURCE
# ===========================================

# 检查路径
if (-not (Test-Path $ToolPath)) { Write-Error "找不到工具: $ToolPath"; exit }
if (-not (Test-Path $GameDir)) { Write-Error "找不到游戏目录: $GameDir"; exit }
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

Write-Host "=== 开始全量解包 (无过滤模式) ===" -ForegroundColor Cyan
Write-Host "注意：因不进行过滤，这将解压所有文件(包括贴图音频)，体积较大，请耐心等待。" -ForegroundColor Yellow

# --- 步骤 1: 收集所有需要解包的文件 ---
$Tasks = @()

# 1.1 基础游戏文件 (01.cat - 99.cat)
1..99 | ForEach-Object { 
    $name = "{0:D2}.cat" -f $_
    $fullPath = Join-Path $GameDir $name
    if (Test-Path $fullPath) {
        $Tasks += [PSCustomObject]@{ Input = $fullPath; Output = $OutDir }
    }
}

# 1.2 DLC 文件
$ExtensionsDir = Join-Path $GameDir "extensions"
if (Test-Path $ExtensionsDir) {
    $DLCCats = Get-ChildItem -Path $ExtensionsDir -Recurse -Filter "*.cat"
    foreach ($file in $DLCCats) {
        $parentPath = $file.DirectoryName
        $relativePath = $parentPath.Substring($GameDir.Length)
        $targetPath = Join-Path $OutDir $relativePath
        $Tasks += [PSCustomObject]@{ Input = $file.FullName; Output = $targetPath }
    }
}

# --- 步骤 2: 执行解包 ---
foreach ($task in $Tasks) {
    if (-not (Test-Path $task.Output)) { New-Item -ItemType Directory -Force -Path $task.Output | Out-Null }

    Write-Host "正在解包: $(Split-Path $task.Input -Leaf)" -ForegroundColor Green
    
    # 【彻底移除 -include 参数】
    # 仅保留输入输出路径，避免正则引擎介入
    $ArgString = '-in "{0}" -out "{1}"' -f $task.Input, $task.Output

    $Process = Start-Process -FilePath $ToolPath -ArgumentList $ArgString -PassThru -NoNewWindow -Wait
    
    if ($Process.ExitCode -ne 0) {
        Write-Host "  -> [错误] 退出代码: $($Process.ExitCode)" -ForegroundColor Red
    }
}

Write-Host "`n==========================================" -ForegroundColor Green
Write-Host "全部完成！" -ForegroundColor Green
Write-Host "制造业数据在: $OutDir\libraries\wares.xml"
Write-Host "==========================================" -ForegroundColor Green
Pause