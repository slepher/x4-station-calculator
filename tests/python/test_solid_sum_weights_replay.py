import importlib.util
import pathlib
import sys
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "x4-game" / "solid_sum_weights_replay.py"


def load_module():
    spec = importlib.util.spec_from_file_location("solid_sum_weights_replay", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class SolidSumWeightsReplayTests(unittest.TestCase):
    def test_initialize_sets_runtime_default_resourcepercentage(self):
        module = load_module()
        field = module.FieldState(name="test_field")

        module.initialize_field_from_region_definition_140e842e0(
            field,
            densityfactor=3.0,
            region_density=1.5,
        )

        self.assertEqual(field.resourcepercentage, 1.0)

    def test_groupref_writeback_resets_resourcepercentage_to_zero(self):
        module = load_module()
        field = module.FieldState(name="test_field", resourcepercentage=1.0)
        group = module.RegionObjectGroup(resource="ice", yield_value=400.0, yieldvariation=0.5)

        module.apply_groupref_to_field_140e84940(field, group)

        self.assertEqual(field.resourcepercentage, 0.0)
        self.assertEqual(field.yield_value, 400.0)


if __name__ == "__main__":
    unittest.main()
