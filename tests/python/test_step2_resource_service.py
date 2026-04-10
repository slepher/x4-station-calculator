import json
import pathlib
import sys
import tempfile
import unittest
from unittest import mock


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPTS_ROOT = REPO_ROOT / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from processor.step2_resource import service


class Step2ResourceServiceTests(unittest.TestCase):
    def test_process_resources_for_80_uses_top_level_sectors_map(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = pathlib.Path(tmpdir)
            maps_path = tmp_path / "maps.json"
            regions_path = tmp_path / "regions.json"

            maps_data = {
                "clusters": {
                    "cluster_01_macro": {
                        "id": "cluster_01_macro",
                        "sectors": ["cluster_01_sector001_macro"],
                    }
                },
                "sectors": {
                    "cluster_01_sector001_macro": {
                        "id": "cluster_01_sector001_macro",
                        "cluster_id": "cluster_01_macro",
                        "regions": [{"ref": "region_alpha", "amount": 1, "position": {}}],
                    }
                },
            }
            regions_data = [
                {
                    "id": "region_alpha",
                    "boundary": {},
                    "resources": [
                        {
                            "ware": "ore",
                            "resourcedensity": 1.0,
                            "delay": 60.0,
                            "gatherfactor": 1.0,
                        }
                    ],
                    "falloff": {},
                }
            ]

            maps_path.write_text(json.dumps(maps_data), encoding="utf-8")
            regions_path.write_text(json.dumps(regions_data), encoding="utf-8")

            aggregate_output = {
                "cluster_01_sector001_macro": [
                    {
                        "ware": "ore",
                        "reserve": 0,
                        "respawn": 0,
                        "replay_reserve": 120,
                        "replay_respawn": 120,
                        "rating": 0,
                        "theoretical_reserve": 100,
                        "theoretical_respawn": 100,
                    }
                ]
            }

            with mock.patch.object(service, "calculate_falloff_factors", return_value=(1.0, 1.0, 1.0)), \
                 mock.patch.object(service, "calculate_solid_volume_km3", return_value=42.0), \
                 mock.patch.object(service, "estimate_solid_yield", return_value=(100.0, 100.0)), \
                 mock.patch.object(service, "_calculate_blocks_for_resourceareas", return_value={
                     ("cluster_01_sector001_macro", "region_alpha"): {
                         "ref": "region_alpha",
                         "sector_id": "cluster_01_sector001_macro",
                         "total": {"ore": 120},
                         "tiles": {},
                     }
                 }), \
                 mock.patch.object(
                     service,
                     "aggregate_sector_resources_from_resourceareas",
                     side_effect=[aggregate_output, aggregate_output],
                 ):
                result = service.process_resources_for_version(
                    version="8.0",
                    maps_json_path=maps_path,
                    regions_json_path=regions_path,
                )

            self.assertEqual(result["status"], "success")

            updated_maps = json.loads(maps_path.read_text(encoding="utf-8"))
            sector = updated_maps["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector["resources"][0]["ware"], "ore")
            self.assertEqual(sector["resources"][0]["replay_reserve"], 120)

    def test_process_resources_for_80_matches_cache_case_insensitively(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = pathlib.Path(tmpdir)
            maps_path = tmp_path / "maps.json"
            regions_path = tmp_path / "regions.json"
            analysis_dir = tmp_path / "analysis_resources"
            analysis_dir.mkdir()

            maps_data = {
                "clusters": {
                    "cluster_01_macro": {
                        "id": "cluster_01_macro",
                        "sectors": ["cluster_01_sector001_macro"],
                    }
                },
                "sectors": {
                    "cluster_01_sector001_macro": {
                        "id": "cluster_01_sector001_macro",
                        "cluster_id": "cluster_01_macro",
                        "regions": [{"ref": "region_alpha", "amount": 1, "position": {}}],
                    }
                },
            }
            regions_data = [
                {
                    "id": "region_alpha",
                    "boundary": {},
                    "resources": [
                        {
                            "ware": "ore",
                            "resourcedensity": 1.0,
                            "delay": 60.0,
                            "gatherfactor": 1.0,
                        }
                    ],
                    "falloff": {},
                }
            ]
            blocks_cache = {
                "Cluster_01_Sector001_macro": [
                    {
                        "ref": "region_alpha",
                        "total": {"ore": 120},
                        "tiles": [],
                    }
                ]
            }

            maps_path.write_text(json.dumps(maps_data), encoding="utf-8")
            regions_path.write_text(json.dumps(regions_data), encoding="utf-8")
            (analysis_dir / "resourcearea_blocks.json").write_text(
                json.dumps(blocks_cache),
                encoding="utf-8",
            )

            aggregate_output = {
                "cluster_01_sector001_macro": [
                    {
                        "ware": "ore",
                        "reserve": 0,
                        "respawn": 0,
                        "replay_reserve": 120,
                        "replay_respawn": 120,
                        "rating": 0,
                        "theoretical_reserve": 100,
                        "theoretical_respawn": 100,
                    }
                ]
            }

            with mock.patch.object(service, "ANALYSIS_RESOURCES_DIR", analysis_dir), \
                 mock.patch.object(service, "calculate_falloff_factors", return_value=(1.0, 1.0, 1.0)), \
                 mock.patch.object(service, "calculate_solid_volume_km3", return_value=42.0), \
                 mock.patch.object(service, "estimate_solid_yield", return_value=(100.0, 100.0)), \
                 mock.patch.object(
                     service,
                     "aggregate_sector_resources_from_resourceareas",
                     side_effect=[aggregate_output, aggregate_output],
                 ), \
                 mock.patch.object(service, "_calculate_blocks_for_resourceareas") as calculate_blocks:
                result = service.process_resources_for_version(
                    version="8.0",
                    maps_json_path=maps_path,
                    regions_json_path=regions_path,
                )

            self.assertEqual(result["status"], "success")
            calculate_blocks.assert_not_called()

            updated_maps = json.loads(maps_path.read_text(encoding="utf-8"))
            sector = updated_maps["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector["resources"][0]["ware"], "ore")
            self.assertEqual(sector["resources"][0]["replay_reserve"], 120)

    def test_process_resources_for_90_uses_top_level_sectors_map(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = pathlib.Path(tmpdir)
            maps_path = tmp_path / "maps.json"
            definitions_path = tmp_path / "regionyield_definitions.json"

            maps_data = {
                "clusters": {
                    "cluster_01_macro": {
                        "id": "cluster_01_macro",
                        "sectors": ["cluster_01_sector001_macro"],
                    }
                },
                "sectors": {
                    "cluster_01_sector001_macro": {
                        "id": "cluster_01_sector001_macro",
                        "cluster_id": "cluster_01_macro",
                        "regions": [{"ref": "ore_medium", "amount": 2}],
                    }
                },
            }
            definitions_data = [
                {
                    "id": "ore_medium",
                    "ware": "ore",
                    "yield": 100,
                    "respawnDelay": 60,
                    "rating": 3,
                    "sustainableYieldPerHour": 100,
                }
            ]

            maps_path.write_text(json.dumps(maps_data), encoding="utf-8")
            definitions_path.write_text(json.dumps(definitions_data), encoding="utf-8")

            result = service.process_resources_for_version(
                version="9.0",
                maps_json_path=maps_path,
            )

            self.assertEqual(result["status"], "success")

            updated_maps = json.loads(maps_path.read_text(encoding="utf-8"))
            sector = updated_maps["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector["resources"][0]["ware"], "ore")
            self.assertEqual(sector["resources"][0]["reserve"], 200)


if __name__ == "__main__":
    unittest.main()
