import importlib.util
import pathlib
import sys
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
MODULE_PATH = REPO_ROOT / "scripts" / "x4-game" / "gas_sum_weights_replay.py"


def load_module():
    spec = importlib.util.spec_from_file_location("gas_sum_weights_replay", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class GasSumWeightsReplayTests(unittest.TestCase):
    def test_methane_cylinder_example_matches_existing_reverse_sample(self):
        module = load_module()
        field = module.build_nebula_field_from_sector_area_json_140e860c0(
            sector_id="Cluster_06_Sector001_macro",
            field_ref="p1_40km_methane_field",
        )

        result = module.replay_gas_area_values_for_field_1407603F0(field)

        self.assertEqual(result["boundary_class"], "cylinder")
        self.assertEqual(result["tile_count"], 4)
        self.assertEqual(result["ware_totals"]["methane"], 69296)
        self.assertEqual(
            result["tile_coords"],
            [(0, 0, -64000), (0, 0, 0), (64000, 0, -64000), (64000, 0, 0)],
        )

    def test_region2_raw_spline_bezier_rebuild_matches_region_sample_points(self):
        module = load_module()
        field = module.build_nebula_field_from_sector_area_json_140e860c0(
            sector_id="Cluster_713_Sector001_macro",
            field_ref="region_cluster_713_sector_001_nebula_2",
        )

        rebuilt = module.build_sampled_spline_points_from_region_bezier_closure_14093E5C0(field)
        regions = module.index_regions_by_id()
        sampled = regions["region_cluster_713_sector_001_nebula_2"]["boundary"]["_sampled_spline"]

        self.assertEqual(len(rebuilt), len(sampled))
        for actual, expected in zip(rebuilt, sampled):
            self.assertAlmostEqual(actual[0], expected["x"], places=6)
            self.assertAlmostEqual(actual[1], expected["y"], places=6)
            self.assertAlmostEqual(actual[2], expected["z"], places=6)

    def test_region2_splinetube_planar_reverse_closure_outputs_expected_totals(self):
        module = load_module()
        field = module.build_nebula_field_from_sector_area_json_140e860c0(
            sector_id="Cluster_713_Sector001_macro",
            field_ref="region_cluster_713_sector_001_nebula_2",
        )

        result = module.replay_gas_area_values_for_field_1407603F0(field)

        self.assertEqual(result["boundary_class"], "splinetube")
        self.assertEqual(result["tile_count"], 26)
        self.assertEqual(result["sampled_point_count"], 33)
        self.assertEqual(result["sampled_segment_count"], 32)
        self.assertEqual(result["ware_totals"]["hydrogen"], 497254)
        self.assertEqual(result["ware_totals"]["helium"], 310780)
        self.assertEqual(result["ware_totals"]["methane"], 1087756)
        self.assertIn((-64000, 0, -384000), result["tile_coords"])
        self.assertIn((320000, 0, 128000), result["tile_coords"])

    def test_box_region_replay_runs_via_json_lookup(self):
        module = load_module()
        field = module.build_nebula_field_from_sector_area_json_140e860c0(
            sector_id="Cluster_112_Sector002_macro",
            field_ref="cluster112_s2_region01",
        )

        result = module.replay_gas_area_values_for_field_1407603F0(field)

        self.assertEqual(result["boundary_class"], "box")
        self.assertEqual(result["tile_count"], 484)
        self.assertEqual(result["ware_totals"]["hydrogen"], 23958000)
        self.assertEqual(result["ware_totals"]["helium"], 24200000)
        self.assertEqual(result["ware_totals"]["methane"], 12100000)

    def test_sphere_shape_algorithm_runs_on_minimal_runtime_state(self):
        module = load_module()
        field = module.NebulaFieldState(
            name="sphere-test",
            boundary_class="sphere",
            position_x=0.0,
            position_y=0.0,
            position_z=0.0,
            radius=250000.0,
            linear=0.0,
            falloff=module.FalloffProfiles(lateral=[], radial=[]),
            resources=[module.GasResourceEntry("hydrogen", 49500.0, 600.0, 1.0)],
            universe_yield_density_by_ware={"hydrogen": 1.0},
        )

        result = module.replay_gas_area_values_for_field_1407603F0(field)

        self.assertEqual(result["boundary_class"], "sphere")
        self.assertEqual(result["tile_count"], 69)
        self.assertEqual(result["ware_totals"]["hydrogen"], 3415500)


if __name__ == "__main__":
    unittest.main()
