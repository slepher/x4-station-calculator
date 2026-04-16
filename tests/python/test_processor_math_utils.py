import pathlib
import sys
import unittest
import xml.etree.ElementTree as ET


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPTS_ROOT = REPO_ROOT / "scripts"
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

from processor.utils import math_utils


class ProcessorMathUtilsTests(unittest.TestCase):
    def test_compact_number_returns_int_for_whole_number_float(self):
        self.assertEqual(math_utils.compact_number(128000.0), 128000)
        self.assertIsInstance(math_utils.compact_number(128000.0), int)

    def test_pos_from_returns_int_for_whole_number_coordinates(self):
        node = ET.fromstring(
            '<connection><offset><position x="-150000000" z="34640000" /></offset></connection>'
        )

        result = math_utils.pos_from(node)

        self.assertEqual(result, {"x": -150000000, "z": 34640000})
        self.assertIsInstance(result["x"], int)
        self.assertIsInstance(result["z"], int)

    def test_pos3d_from_keeps_float_for_fractional_coordinates(self):
        node = ET.fromstring(
            '<connection><offset><position x="-1.5" y="0" z="2.25" /></offset></connection>'
        )

        result = math_utils.pos3d_from(node)

        self.assertEqual(result, {"x": -1.5, "y": 0, "z": 2.25})
        self.assertIsInstance(result["x"], float)
        self.assertIsInstance(result["y"], int)
        self.assertIsInstance(result["z"], float)

    def test_vec_add_returns_int_for_whole_number_sum(self):
        result = math_utils.vec_add({"x": -150000000.0, "z": 34640000.0}, {"x": 0.0, "z": 0.0})

        self.assertEqual(result, {"x": -150000000, "z": 34640000})
        self.assertIsInstance(result["x"], int)
        self.assertIsInstance(result["z"], int)

    def test_axial_to_pixel_flat_returns_int_for_whole_number_result(self):
        result = math_utils.axial_to_pixel_flat(0, 0, 1.0)

        self.assertEqual(result, {"x": 0, "y": 0})
        self.assertIsInstance(result["x"], int)
        self.assertIsInstance(result["y"], int)


if __name__ == "__main__":
    unittest.main()
