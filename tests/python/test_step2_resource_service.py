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
from processor.resource import modern_processor as map_modern_processor


class Step2ResourceServiceTests(unittest.TestCase):
    def test_new_90_regionyields_format_builds_definitions_from_yields(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = pathlib.Path(tmpdir)
            regionyields_path = tmp_path / "regionyields.xml"
            regionyields_path.write_text(
                """<?xml version='1.0' encoding='UTF-8'?>
<regionyields>
  <boundaries>
    <boundary id="sphere_large" class="sphere">
      <size r="100000"/>
    </boundary>
  </boundaries>
  <yields>
    <yield id="high" tag="high" scaneffect="scan_fx" scaneffectintensity="1.0">
      <ware id="hydrogen" yield="1000000" respawndelay="120"/>
      <ware id="ore" yield="1000000" respawndelay="120"/>
    </yield>
  </yields>
  <gatherspeeds>
    <gatherspeed id="slow" factor="0.5" rating="6"/>
  </gatherspeeds>
  <definitions>
  </definitions>
</regionyields>
""",
                encoding="utf-8",
            )

            definitions = map_modern_processor.migrate_resourcearea_definitions(regionyields_path)

            hydrogen = definitions["sphere_large_hydrogen_high_slow"]
            ore = definitions["sphere_large_ore_high_slow"]

            self.assertEqual(hydrogen["ware"], "hydrogen")
            self.assertEqual(hydrogen["size"], "large")
            self.assertEqual(hydrogen["tag"], "high")
            self.assertEqual(hydrogen["radius"], 100000.0)
            self.assertEqual(hydrogen["yield"], 1000000.0)
            self.assertEqual(hydrogen["respawnDelay"], 120.0)
            self.assertEqual(hydrogen["rating"], 6.0)
            self.assertEqual(hydrogen["gatherspeedfactor"], 0.5)
            self.assertAlmostEqual(hydrogen["sustainableYieldPerHour"], 500000.0)

            self.assertEqual(ore["ware"], "ore")
            self.assertEqual(ore["objectyieldfactor"], 0.5)
            self.assertNotIn("gatherspeedfactor", ore)

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
            self.assertTrue((tmp_path / "map_resources.json").exists())

            updated_maps = json.loads(maps_path.read_text(encoding="utf-8"))
            sector = updated_maps["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector["regions"], [{"ref": "region_alpha", "amount": 1, "position": {}}])
            self.assertNotIn("resources", sector)

            map_resources = json.loads((tmp_path / "map_resources.json").read_text(encoding="utf-8"))
            sector_resources = map_resources["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector_resources["regions"], [{"ref": "region_alpha", "amount": 1, "position": {}}])
            self.assertEqual(sector_resources["resources"][0]["ware"], "ore")
            self.assertEqual(sector_resources["resources"][0]["replay_reserve"], 120)

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
            self.assertTrue((tmp_path / "map_resources.json").exists())

            updated_maps = json.loads(maps_path.read_text(encoding="utf-8"))
            sector = updated_maps["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector["regions"], [{"ref": "region_alpha", "amount": 1, "position": {}}])
            self.assertNotIn("resources", sector)

            map_resources = json.loads((tmp_path / "map_resources.json").read_text(encoding="utf-8"))
            sector_resources = map_resources["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector_resources["resources"][0]["ware"], "ore")
            self.assertEqual(sector_resources["resources"][0]["replay_reserve"], 120)

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
            self.assertTrue((tmp_path / "map_resources.json").exists())

            updated_maps = json.loads(maps_path.read_text(encoding="utf-8"))
            sector = updated_maps["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector["regions"], [{"ref": "ore_medium", "amount": 2}])
            self.assertNotIn("resources", sector)

            map_resources = json.loads((tmp_path / "map_resources.json").read_text(encoding="utf-8"))
            sector_resources = map_resources["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector_resources["resources"][0]["ware"], "ore")
            self.assertEqual(sector_resources["resources"][0]["reserve"], 200)

    def test_process_resources_for_90_recovers_from_xml_when_json_inputs_are_empty(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = pathlib.Path(tmpdir)
            maps_path = tmp_path / "maps.json"
            definitions_path = tmp_path / "regionyield_definitions.json"
            regionyields_path = tmp_path / "regionyields.xml"
            mapdefaults_path = tmp_path / "mapdefaults.xml"

            maps_data = {
                "sectors": {
                    "cluster_01_sector001_macro": {
                        "id": "cluster_01_sector001_macro",
                        "cluster_id": "cluster_01_macro",
                        "regions": [],
                        "resources": [],
                    }
                }
            }

            maps_path.write_text(json.dumps(maps_data), encoding="utf-8")
            definitions_path.write_text("[]", encoding="utf-8")
            regionyields_path.write_text("<regionyields />", encoding="utf-8")
            mapdefaults_path.write_text("<defaults />", encoding="utf-8")

            definitions = {
                "sphere_large_ore_high_slow": {
                    "id": "sphere_large_ore_high_slow",
                    "ware": "ore",
                    "yield": 100,
                    "respawnDelay": 60,
                    "rating": 3,
                    "objectyieldfactor": 0.5,
                    "sustainableYieldPerHour": 100,
                }
            }
            sector_resource_areas = {
                "cluster_01_sector001_macro": [
                    {"ref": "sphere_large_ore_high_slow", "amount": 2}
                ]
            }

            with mock.patch.object(service, "migrate_resourcearea_definitions", return_value=definitions), \
                 mock.patch.object(service, "migrate_sector_resourceareas", return_value=sector_resource_areas):
                result = service.process_resources_for_version(
                    version="9.0",
                    maps_json_path=maps_path,
                    regionyields_xml_path=regionyields_path,
                    mapdefaults_xml_path=mapdefaults_path,
                )

            self.assertEqual(result["status"], "success")

            updated_maps = json.loads(maps_path.read_text(encoding="utf-8"))
            sector = updated_maps["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector["regions"], [])
            self.assertEqual(sector["resources"], [])

            map_resources = json.loads((tmp_path / "map_resources.json").read_text(encoding="utf-8"))
            sector_resources = map_resources["sectors"]["cluster_01_sector001_macro"]
            self.assertEqual(sector_resources["regions"], [{"ref": "sphere_large_ore_high_slow", "amount": 2}])
            self.assertEqual(sector_resources["resources"][0]["reserve"], 200)

            updated_definitions = json.loads(definitions_path.read_text(encoding="utf-8"))
            self.assertEqual(updated_definitions[0]["id"], "sphere_large_ore_high_slow")


if __name__ == "__main__":
    unittest.main()
