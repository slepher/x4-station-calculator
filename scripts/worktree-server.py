#!/usr/bin/env python3
import subprocess
import re
import sys
import os

def get_worktrees():
    """获取并解析 git worktree list 的结果"""
    try:
        result = subprocess.run(
            ['git', 'worktree', 'list'], 
            capture_output=True, 
            text=True, 
            check=True
        )
    except subprocess.CalledProcessError as e:
        print(f"执行 git worktree list 失败: {e}")
        sys.exit(1)

    lines = result.stdout.strip().split('\n')
    worktrees = []
    
    # 解析: 路径、哈希值和方括号内的分支名
    pattern = re.compile(r'^(.*?)\s+[0-9a-f]+\s+\[(.*?)\]$')
    
    for line in lines:
        match = pattern.match(line)
        if match:
            path = match.group(1).strip()
            branch = match.group(2).strip()
            worktrees.append({'path': path, 'branch': branch})
            
    return worktrees

def main():
    worktrees = get_worktrees()
    
    if not worktrees:
        print("没有找到任何 worktree 分支，或解析失败。")
        return

    print(f"找到 {len(worktrees)} 个 Worktree，准备执行检查和启动...\n")

    for wt in worktrees:
        path = wt['path']
        branch = wt['branch']
        domain = re.sub(r'[^a-zA-Z0-9]', '-', branch).lower()
        dist_path = os.path.join(path, 'dist')
        
        print("-" * 50)
        print(f"🚀 正在处理分支: [{branch}]")
        print(f"📁 路径: {path}")

        # 2. 启动 portless
        print(f"🌐 目标域名: {domain}") 
        try:
            # 运行: portless ${domain} npm run dev
            cmd = ['portless', domain, 'npm', 'run', 'dev']
            process = subprocess.Popen(
                cmd, 
                cwd=path,
                stdout=subprocess.DEVNULL, 
                stderr=subprocess.DEVNULL
            )
            print(f"✅ 服务已在后台启动 (PID: {process.pid})")
            print(f"命令: {' '.join(cmd)}")
        except FileNotFoundError:
            print("❌ 错误: 未找到 portless 或 npm 命令。请确保它们已在 PATH 中。")
            sys.exit(1)
        except Exception as e:
            print(f"❌ 启动失败: {e}")

    print("\n🎉 所有可用 worktree 的处理流程已结束！")

if __name__ == '__main__':
    main()