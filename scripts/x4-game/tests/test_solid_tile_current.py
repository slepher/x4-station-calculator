"""Regression tests for solid tile-current Python landing."""

from __future__ import annotations

import unittest
from unittest.mock import patch

from field.resource_object_field import ResourceObjectField
from x4_replay import (
    compute_region_resources,
    find_area_instances,
    format_result,
    RegionResourceResult,
    TileResourceData,
)


class TestSolidFieldTileContribution(unittest.TestCase):
    """Verify field-level local-noise and contribution landing."""

    def test_fast_path_tile_contribution_matches_runtime_floor_formula(self):
        field = ResourceObjectField(
            density_multiplier_0x1150=2.0,
            yield_value_0x1118=10.0,
            resourcepercentage_0x1190=0.5,
            noisescale_0x10d4=5000.0,
            minnoisevalue_0x10e0=0.0,
            maxnoisevalue_0x10e4=1.0,
            ware_key_0x1110="ore",
            groupref_0x1108="ore_fast",
        )

        trace = field.compute_tile_contribution_140e84c30(
            (64000.0, 0.0, 0.0),
            query_weight=0.25,
            clamp_weight=8.0,
        )

        self.assertEqual(trace.noise_trace.path, "fast")
        self.assertAlmostEqual(trace.noise_trace.value, 1.0)
        self.assertAlmostEqual(trace.pre_floor, 20.0)
        self.assertEqual(trace.contribution, 20)

    def test_slow_path_local_noise_is_deterministic_and_normalized(self):
        field = ResourceObjectField(
            density_multiplier_0x1150=1.0,
            yield_value_0x1118=1.0,
            resourcepercentage_0x1190=1.0,
            noisescale_0x10d4=50000.0,
            minnoisevalue_0x10e0=0.2,
            maxnoisevalue_0x10e4=0.8,
            ware_key_0x1110="ore",
            groupref_0x1108="ore_slow",
            seed="666",
        )

        value_a, trace_a = field.compute_local_noise_1414f4840((0.0, 0.0, 0.0))
        value_b, trace_b = field.compute_local_noise_1414f4840((0.0, 0.0, 0.0))

        self.assertEqual(trace_a.path, "slow")
        self.assertLessEqual(trace_a.cell_count, 16)
        self.assertAlmostEqual(value_a, value_b)
        self.assertAlmostEqual(trace_a.value, trace_b.value)
        self.assertGreaterEqual(value_a, 0.0)
        self.assertLessEqual(value_a, 1.0)


class TestSolidTileCurrentReplay(unittest.TestCase):
    """Verify x4_replay diagnostics and integer aggregation formatting."""

    def test_format_result_includes_save_only_tiles(self):
        result = RegionResourceResult(
            sector_id="Sector",
            region_id="Region",
            totals={"ice": 10},
            tile_count=1,
            per_tile=[
                TileResourceData(coord=(0, 0, 0), tile_values={"ice": 10}),
            ],
        )
        save_tiles_by_ware = {
            "ice": {
                (0, 0, 0): {"max": 12},
                (64000, 0, 0): {"max": 8},
            }
        }

        output = format_result(result, save_tiles_by_ware, compare=True)

        self.assertIn("Tile: (0, 0, 0)", output)
        self.assertIn("Tile: (64000, 0, 0)", output)
        self.assertIn("ice: replay=0 save=8", output)

    def test_replay_pipeline_uses_field_build_and_dispatch_replay(self):
        from impl.compile_hit import CompiledRegionRuntime

        compiled = CompiledRegionRuntime(
            sector_id="Sector",
            region_id="Region",
            region=type(
                "RegionStub",
                (),
                {
                    "curve_bank_a_0x390": [],
                    "curve_bank_b_0x3c0": [],
                    "boundary_list": None,
                },
            )(),
            field_list=[],
        )

        with patch("x4_replay.find_region_data", return_value={"id": "Region", "name": "Name", "boundary": {}}), \
             patch("x4_replay.find_region_instances_from_maps", return_value=[{"position": {"x": 0.0, "y": 0.0, "z": 0.0}}]), \
             patch("x4_replay.find_area_instances", return_value=[]), \
             patch("x4_replay.prepare_region_runtime_for_dispatch", return_value=compiled) as prepare_mock, \
             patch("x4_replay.replay_region_runtime_14075BD20", return_value=({}, [])) as replay_mock:
            result = compute_region_resources("Sector", "Region")

        prepare_mock.assert_called_once()
        replay_mock.assert_called_once_with(compiled, ware_filter=None)
        self.assertEqual(result.tile_count, 0)

    def test_find_area_instances_supports_sector_dict_resourceareas_format(self):
        areas_data = {
            "Cluster_Test": [
                {"ref": "region_a", "position": {"x": 1.0, "y": 2.0, "z": 3.0}},
                {"ref": "region_b", "position": {"x": 4.0, "y": 5.0, "z": 6.0}},
            ]
        }

        with patch("x4_replay.load_json_data", return_value=areas_data):
            result = find_area_instances("Cluster_Test", "region_a")

        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["ref"], "region_a")


if __name__ == "__main__":
    unittest.main()
