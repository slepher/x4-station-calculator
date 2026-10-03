#!/usr/bin/env python3
import http.client
import json
import os
from pathlib import Path
import re
import signal
import ssl
import subprocess
import sys
import time

PROXY_PORT = 1355
STARTUP_TIMEOUT = 30


def get_worktrees():
    """获取并解析 git worktree list 的结果。"""
    result = subprocess.run(
        ['git', 'worktree', 'list'], capture_output=True, text=True, check=True
    )
    worktrees = []
    pattern = re.compile(r'^(.*?)\s+[0-9a-f]+\s+\[(.*?)\]$')
    for line in result.stdout.splitlines():
        match = pattern.match(line)
        if match:
            worktrees.append({
                'path': match.group(1).strip(),
                'branch': match.group(2).strip(),
            })
    return worktrees


def read_routes(state_dir):
    routes_path = state_dir / 'routes.json'
    if not routes_path.exists():
        return []
    return json.loads(routes_path.read_text())


def is_process_alive(pid):
    try:
        os.kill(pid, 0)
        return True
    except ProcessLookupError:
        return False
    except PermissionError:
        return True


def proxy_ready(hostname, tls):
    """直接连接本机代理，使用 Host 选择路由，不依赖系统解析 .localhost。"""
    if tls:
        # 仅探测 loopback 上的本地代理；浏览器仍使用 Portless 的 CA 验证。
        connection = http.client.HTTPSConnection(
            '127.0.0.1', PROXY_PORT, timeout=1,
            context=ssl._create_unverified_context(),
        )
    else:
        connection = http.client.HTTPConnection('127.0.0.1', PROXY_PORT, timeout=1)
    try:
        connection.request('GET', '/', headers={'Host': f'{hostname}:{PROXY_PORT}'})
        response = connection.getresponse()
        return response.status == 200 and response.getheader('x-portless') == '1'
    except (OSError, http.client.HTTPException):
        return False
    finally:
        connection.close()


def stop_route(route):
    """等待旧 wrapper 完成同步路由清理，再允许新 wrapper 注册。"""
    pid = route['pid']
    if pid == 0:
        raise RuntimeError('现有路由是静态 alias，无法自动重启，请先检查 portless list。')
    if not is_process_alive(pid):
        return
    print(f'⏳ 正在停止旧服务 (PID: {pid})，等待路由清理...')
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    deadline = time.monotonic() + 10
    while is_process_alive(pid):
        if time.monotonic() >= deadline:
            raise RuntimeError(f'旧服务 {pid} 未退出，取消启动以避免路由清理竞态。')
        time.sleep(0.1)


def start_worktree(wt, state_dir, tls):
    path = wt['path']
    branch = wt['branch']
    domain = re.sub(r'[^a-zA-Z0-9]', '-', branch).lower()
    hostname = f'{domain}.localhost'
    scheme = 'https' if tls else 'http'
    url = f'{scheme}://{hostname}:{PROXY_PORT}/'
    log_path = Path(path) / f'server-{domain}.log'
    print(f'🚀 分支: [{branch}]\n📁 路径: {path}\n🌐 地址: {url}')

    route = next((r for r in read_routes(state_dir) if r['hostname'] == hostname), None)
    if route is not None:
        if (route['pid'] == 0 or is_process_alive(route['pid'])) and proxy_ready(hostname, tls):
            print(f'✅ 复用已运行的服务 (PID: {route["pid"]})')
            return
        stop_route(route)

    env = os.environ.copy()
    env['PORTLESS_PORT'] = str(PROXY_PORT)
    env['PORTLESS_STATE_DIR'] = str(state_dir)
    # 不使用 --force：旧 wrapper 的退出清理会误删新 wrapper 的同名路由。
    cmd = ['portless', domain, 'npx', 'vite', '--base', '/', '--host', '127.0.0.1']
    with log_path.open('a') as log_file:
        process = subprocess.Popen(
            cmd, cwd=path, env=env, stdin=subprocess.DEVNULL,
            stdout=log_file, stderr=subprocess.STDOUT, start_new_session=True,
        )

    deadline = time.monotonic() + STARTUP_TIMEOUT
    while time.monotonic() < deadline:
        exit_code = process.poll()
        if exit_code is not None:
            raise RuntimeError(f'服务启动失败 (退出码: {exit_code})，请查看 {log_path}')
        route = next((r for r in read_routes(state_dir) if r['hostname'] == hostname), None)
        if route is not None and route['pid'] == process.pid and proxy_ready(hostname, tls):
            print(f'✅ 服务已就绪 (PID: {process.pid})，日志: {log_path}')
            return
        time.sleep(0.2)
    process.terminate()
    process.wait(timeout=10)
    raise RuntimeError(f'等待代理就绪超时，请查看 {log_path}')


def main():
    if 'PORTLESS_STATE_DIR' in os.environ:
        state_dir = Path(os.environ['PORTLESS_STATE_DIR']).expanduser()
    else:
        state_dir = Path.home() / '.portless'
    try:
        worktrees = get_worktrees()
        if not worktrees:
            raise RuntimeError('没有找到任何 worktree 分支，或解析失败。')
        actual_port = int((state_dir / 'proxy.port').read_text())
        if actual_port != PROXY_PORT:
            raise RuntimeError(f'代理端口是 {actual_port}，预期为 {PROXY_PORT}。')
        tls = (state_dir / 'proxy.tls').exists()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f'❌ {error}', file=sys.stderr)
        return 1

    print(f'找到 {len(worktrees)} 个 Worktree，准备检查和启动...\n')
    failures = 0
    for wt in worktrees:
        try:
            start_worktree(wt, state_dir, tls)
        except (OSError, ValueError, RuntimeError, subprocess.SubprocessError) as error:
            failures += 1
            print(f'❌ [{wt["branch"]}] {error}', file=sys.stderr)
    if failures:
        print(f'❌ {failures} 个 Worktree 启动失败。', file=sys.stderr)
        return 1
    print('\n🎉 所有 Worktree 服务已就绪！')
    return 0


if __name__ == '__main__':
    sys.exit(main())
