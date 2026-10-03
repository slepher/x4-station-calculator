import importlib.util
import io
import json
from pathlib import Path
import signal
import tempfile
import unittest
from unittest.mock import Mock, patch

SCRIPT = Path(__file__).resolve().parents[2] / 'scripts' / 'worktree-server.py'
spec = importlib.util.spec_from_file_location('worktree_server', SCRIPT)
server = importlib.util.module_from_spec(spec)
spec.loader.exec_module(server)


class WorktreeServerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.wt = {'path': str(self.root), 'branch': 'develop'}
        self.state_dir = self.root / 'state'
        self.state_dir.mkdir()
        self.routes_path = self.state_dir / 'routes.json'
        self.route = {'hostname': 'develop.localhost', 'port': 4762, 'pid': 1001}
        self.output = io.StringIO()
        output_patch = patch('sys.stdout', self.output)
        output_patch.start()
        self.addCleanup(output_patch.stop)

    def write_routes(self, routes):
        self.routes_path.write_text(json.dumps(routes))

    def test_repeated_start_reuses_healthy_route_without_spawning_or_signalling(self):
        self.write_routes([self.route])
        with patch.object(server, 'is_process_alive', return_value=True), \
                patch.object(server, 'proxy_ready', return_value=True), \
                patch.object(server.subprocess, 'Popen') as spawn, \
                patch.object(server.os, 'kill') as kill:
            server.start_worktree(self.wt, self.state_dir, True)
        spawn.assert_not_called()
        kill.assert_not_called()
        self.assertIn('https://develop.localhost:1355/', self.output.getvalue())
        self.assertIn('复用', self.output.getvalue())

    def test_restart_waits_for_old_route_cleanup_before_new_registration(self):
        self.write_routes([self.route])
        events = []
        old_alive = True
        child = Mock(pid=1002)
        child.poll.return_value = None

        def alive(pid):
            return old_alive if pid == 1001 else True

        def kill(pid, sig):
            self.assertEqual((pid, sig), (1001, signal.SIGTERM))
            events.append('signal')

        def cleanup(_seconds):
            nonlocal old_alive
            # Portless removes by hostname during old-wrapper exit cleanup.
            self.write_routes([])
            old_alive = False
            events.append('old cleanup')

        def spawn(command, **kwargs):
            self.assertFalse(old_alive)
            self.assertEqual(server.read_routes(self.state_dir), [])
            self.assertNotIn('--force', command)
            self.assertTrue(kwargs['start_new_session'])
            self.assertEqual(kwargs['env']['PORTLESS_PORT'], '1355')
            self.assertEqual(kwargs['env']['PORTLESS_STATE_DIR'], str(self.state_dir))
            events.append('new registration')
            self.write_routes([{**self.route, 'pid': child.pid}])
            return child

        def ready(_hostname, _tls):
            return server.read_routes(self.state_dir)[0]['pid'] == child.pid

        with patch.object(server, 'is_process_alive', side_effect=alive), \
                patch.object(server.os, 'kill', side_effect=kill), \
                patch.object(server.time, 'sleep', side_effect=cleanup), \
                patch.object(server.subprocess, 'Popen', side_effect=spawn), \
                patch.object(server, 'proxy_ready', side_effect=ready):
            server.start_worktree(self.wt, self.state_dir, True)
        self.assertEqual(events, ['signal', 'old cleanup', 'new registration'])
        self.assertEqual(server.read_routes(self.state_dir)[0]['pid'], child.pid)
        self.assertIn('服务已就绪', self.output.getvalue())

    def test_child_failure_is_reported_instead_of_success(self):
        child = Mock(pid=1002)
        child.poll.return_value = 1
        with patch.object(server.subprocess, 'Popen', return_value=child), \
                patch.object(server, 'proxy_ready', return_value=True):
            with self.assertRaisesRegex(RuntimeError, '退出码: 1'):
                server.start_worktree(self.wt, self.state_dir, True)
        self.assertNotIn('服务已就绪', self.output.getvalue())

    def test_timeout_reaps_spawned_child_without_waiting_for_zombie_pid(self):
        child = Mock(pid=1002)
        with patch.object(server.subprocess, 'Popen', return_value=child), \
                patch.object(server.time, 'monotonic', side_effect=[0, 31]):
            with self.assertRaisesRegex(RuntimeError, '就绪超时'):
                server.start_worktree(self.wt, self.state_dir, True)
        child.terminate.assert_called_once()
        child.wait.assert_called_once_with(timeout=10)
        self.assertNotIn('服务已就绪', self.output.getvalue())

    def test_non_exiting_old_process_blocks_new_registration(self):
        with patch.object(server, 'is_process_alive', return_value=True), \
                patch.object(server.os, 'kill') as kill, \
                patch.object(server.time, 'monotonic', side_effect=[0, 11]):
            with self.assertRaisesRegex(RuntimeError, '未退出'):
                server.stop_route(self.route)
        kill.assert_called_once_with(1001, signal.SIGTERM)

    def test_proxy_probe_requires_portless_200_and_uses_hostname_header(self):
        connection = Mock()
        response = connection.getresponse.return_value
        response.status = 404
        response.getheader.return_value = '1'
        with patch.object(server.http.client, 'HTTPSConnection', return_value=connection):
            self.assertFalse(server.proxy_ready('develop.localhost', True))
            response.status = 200
            self.assertTrue(server.proxy_ready('develop.localhost', True))
            response.getheader.return_value = None
            self.assertFalse(server.proxy_ready('develop.localhost', True))
        connection.request.assert_called_with(
            'GET', '/', headers={'Host': 'develop.localhost:1355'}
        )
        self.assertEqual(connection.close.call_count, 3)

    def test_main_returns_failure_when_worktree_start_fails(self):
        (self.state_dir / 'proxy.port').write_text('1355')
        with patch.dict(server.os.environ, {'PORTLESS_STATE_DIR': str(self.state_dir)}), \
                patch.object(server, 'get_worktrees', return_value=[self.wt]), \
                patch.object(server, 'start_worktree', side_effect=RuntimeError('failed')), \
                patch('sys.stderr', new=io.StringIO()):
            self.assertEqual(server.main(), 1)
        self.assertNotIn('所有 Worktree 服务已就绪', self.output.getvalue())


if __name__ == '__main__':
    unittest.main()
