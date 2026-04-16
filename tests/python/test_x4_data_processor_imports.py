import importlib.util
import pathlib
import sys
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "x4_data_processor.py"
SCRIPTS_ROOT = REPO_ROOT / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))


def load_module():
    spec = importlib.util.spec_from_file_location("x4_data_processor", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class X4DataProcessorImportTests(unittest.TestCase):
    def test_uses_step1_map_service(self):
        module = load_module()

        self.assertEqual(module.process_map_for_version.__module__, "processor.step1_map.service")


if __name__ == "__main__":
    unittest.main()
