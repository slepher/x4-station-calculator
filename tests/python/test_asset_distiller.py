import contextlib
import io
import sys
import tempfile
import unittest
from copy import deepcopy
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from lxml import etree

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / 'scripts'))

from x4_asset_distiller import get_target_versions, merge_version_config, validate_version_config
from distiller.aggregate import AssetAggregator
from distiller.index import process_index_file
from distiller.service import LIBRARY_FILES, MAP_FILES, MD_FILES, publish_assets, run_distillation_for_version
from distiller.xml_merge import XMLMerger


class RecordingLog:
    def __init__(self):
        self.logging_function = None
        self.messages = []

    def Print(self, message):
        if self.logging_function is not None:
            self.logging_function(message)
        else:
            self.messages.append(message)


def fake_diff(apply=None):
    def append(root, overlay):
        root.extend(deepcopy(list(overlay)))
        return root
    return SimpleNamespace(Apply_Patch=append if apply is None else apply, Plugin_Log=RecordingLog())


class DistillerTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(dir=REPO_ROOT / 'tests/python')
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / 'source'
        self.output = self.root / 'output'
        self.source.mkdir()
        self.output.mkdir()
        self.capture = io.StringIO()
        self.redirect = contextlib.redirect_stdout(self.capture)
        self.redirect.__enter__()
        self.addCleanup(self.redirect.__exit__, None, None, None)
        self.merger = XMLMerger(self.source, self.output, [], fake_diff())

    def write(self, relative, content, directory=None):
        directory = self.source if directory is None else directory
        file = directory / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content, encoding='utf-8')
        return file

    def fixture(self):
        self.write('t/0001.xml', '<language/>')
        ids = ('module_m', 'ship_test_macro', 'equip_m', 'missile_m', 'bullet_m', 'dock_m', 'storage_m')
        self.write('index/macros.xml', '<index>' + ''.join(f'<entry name="{name}" value="assets/all"/>' for name in ids) + '</index>')
        self.write('index/components.xml', '<index><entry name="ship_c" value="assets/components"/><entry name="equip_c" value="assets/components"/></index>')
        for name in MAP_FILES:
            self.write(f'maps/xu_ep2_universe/{name}', '<macros/>')
        for name in LIBRARY_FILES:
            self.write(f'libraries/{name}.xml', f'<{name}/>')
        for name in MD_FILES:
            self.write(f'md/{name}.xml', '<mdscript/>')
        self.write('libraries/wares.xml', '''<wares>
          <ware id="module" tags="module"><component ref="module_m"/></ware>
          <ware id="equipment" transport="equipment" tags="engine"><component ref="equip_m"/></ware>
          <ware id="missile" transport="equipment" group="missiles"><component ref="missile_m"/></ware>
        </wares>''')
        self.write('assets/all.xml', '''<macros>
          <macro name="module_m"/>
          <macro name="ship_test_macro"><component ref="ship_c"/><connections><connection><macro ref="dock_m"/></connection></connections></macro>
          <macro name="equip_m"><component ref="equip_c"/><properties><bullet class="bullet_m"/></properties></macro>
          <macro name="missile_m"><properties><bullet class="missile_m"/></properties></macro>
          <macro name="bullet_m"/>
          <macro name="dock_m" class="dockarea"><connections><connection><macro ref="storage_m"/></connection></connections></macro>
          <macro name="storage_m"/>
        </macros>''')
        self.write('assets/components.xml', '''<components>
          <component name="ship_c"><connections>
            <connection name="engine" tags="ENGINE" custom="remove"><offset/></connection>
            <connection name="detail" tags="detail"/>
          </connections></component>
          <component name="equip_c"><connections>
            <connection name="part" tags="component" custom="keep"><offset/></connection>
            <connection name="detail" tags="components"/>
          </connections></component>
        </components>''')

    def run_fixture(self, dlcs=()):
        machine = {'X4_PATHS': {'SOURCE': str(self.source.parent)}}
        config = {'folder_name': self.source.name, 'raw_assets_dir': str(self.output), 'dlc_order': list(dlcs)}
        run_distillation_for_version(machine, config, self.root, fake_diff())
        return self.output / self.source.name

    def test_conditions_use_document_root_and_preserve_false_results(self):
        tree = etree.ElementTree(etree.fromstring('<wares><production><method id="default"/></production></wares>'))
        overlay = etree.fromstring('''<diff>
          <add sel="/wares" if="/wares/production/method[@id='default']"><ware id="absolute"/></add>
          <add sel="/wares" if="(/wares/ware)[1]"><ware id="parentheses"/></add>
          <add sel="/wares" if="count(/wares/ware) = 2"><ware id="boolean"/></add>
          <add sel="/wares" if="/wares/ware[@id='absent']"><ware id="skipped"/></add>
        </diff>''')
        self.merger.apply_custom_patch(tree, overlay, 'test.xml')
        self.assertEqual(tree.xpath('/wares/ware/@id'), ['absolute', 'parentheses', 'boolean'])

    def test_existing_production_condition_exception_remains(self):
        tree = etree.ElementTree(etree.fromstring('<wares><ware id="test"/></wares>'))
        overlay = etree.fromstring('''<diff><add sel="/wares/ware[@id='test']" if="/wares/production/method[@id='terran']"><production method="terran"/></add></diff>''')
        self.merger.apply_custom_patch(tree, overlay, 'test.xml')
        self.assertEqual(tree.xpath('/wares/ware/production/@method'), ['terran'])

    def test_custom_root_replacement_updates_following_condition_context(self):
        tree = etree.ElementTree(etree.fromstring('<wares/>'))
        overlay = etree.fromstring('''<diff>
          <replace sel="/wares" if="/wares"><wares changed="yes"/></replace>
          <add sel="/wares" if="/wares[@changed='yes']"><ware id="new"/></add>
        </diff>''')
        self.merger.apply_custom_patch(tree, overlay, 'test.xml')
        self.assertEqual(tree.getroot().get('changed'), 'yes')
        self.assertEqual(tree.xpath('/wares/ware/@id'), ['new'])

    def test_customizer_returned_root_is_used_without_mutating_input(self):
        overlay = self.write('root-patch.xml', '<diff><replace sel="/wares"><wares changed="yes"/></replace></diff>')
        original = etree.ElementTree(etree.fromstring('<wares changed="no"/>'))
        self.merger.xml_diff = fake_diff(lambda root, patch: deepcopy(patch[0][0]))
        result, status = self.merger.apply_overlay_to_tree(original, overlay)
        self.assertEqual(status, 'patched')
        self.assertEqual(result.getroot().get('changed'), 'yes')
        self.assertEqual(original.getroot().get('changed'), 'no')

    def test_condition_syntax_errors_are_not_treated_as_false(self):
        tree = etree.ElementTree(etree.fromstring('<wares/>'))
        overlay = etree.fromstring('<diff><add sel="/wares" if="//*["> <ware/></add></diff>')
        with self.assertRaises(etree.XPathError):
            self.merger.apply_custom_patch(tree, overlay, 'broken.xml')

    def test_missing_target_is_reported_and_silent_operation_is_ignored(self):
        tree = etree.ElementTree(etree.fromstring('<wares/>'))
        overlay = etree.fromstring('''<diff>
          <remove sel="/wares/missing" if="/wares"/>
          <remove sel="/wares/also_missing" silent="true"/>
        </diff>''')
        self.merger.apply_custom_patch(tree, overlay, 'test.xml')
        self.assertEqual(len(self.merger.warnings), 1)
        self.assertIn('no xpath match found', self.merger.warnings[0])

    def test_customizer_diagnostics_are_reported_and_logger_is_restored(self):
        overlay = self.write('patch.xml', '<diff/>')
        engine = fake_diff()
        def apply(root, patch):
            engine.Plugin_Log.Print('Error: no xpath match found')
            return root
        engine.Apply_Patch = apply
        self.merger.xml_diff = engine
        self.merger.apply_overlay_to_tree(etree.ElementTree(etree.Element('wares')), overlay)
        self.assertEqual(len(self.merger.warnings), 1)
        self.assertIsNone(engine.Plugin_Log.logging_function)
        self.assertEqual(engine.Plugin_Log.messages, ['Error: no xpath match found'])

    def test_customizer_invalid_patch_fails_and_restores_logger(self):
        overlay = self.write('patch.xml', '<diff/>')
        engine = fake_diff()
        def apply(root, patch):
            engine.Plugin_Log.Print('Error: xpath exception: invalid syntax')
            return root
        engine.Apply_Patch = apply
        self.merger.xml_diff = engine
        with self.assertRaisesRegex(ValueError, 'invalid syntax'):
            self.merger.apply_overlay_to_tree(etree.ElementTree(etree.Element('wares')), overlay)
        self.assertIsNone(engine.Plugin_Log.logging_function)

    def test_stack_keeps_raw_overlays_xsd_and_dlc_order(self):
        self.write('libraries/wares.xml', '<wares><ware id="base"/></wares>')
        self.write('libraries/wares.xsd', '<schema/>')
        first = self.write('first.xml', '<wares><ware id="first"/></wares>')
        second = self.write('second.xml', '<wares><ware id="second"/></wares>')
        self.merger.dlc_order = ['ego_first', 'ego_second']
        self.merger.build_dlc_stack_xml('libraries/wares.xml', {'ego_second': second, 'ego_first': first})
        slot = self.output / 'libraries/wares'
        self.assertEqual((slot / 'first.xml').read_bytes(), first.read_bytes())
        self.assertEqual((slot / 'second.xml').read_bytes(), second.read_bytes())
        self.assertTrue((slot / 'base.xml').is_file())
        self.assertTrue((slot / 'wares.xsd').is_file())
        self.assertEqual(etree.parse(str(slot / 'final.xml')).xpath('/wares/ware/@id'), ['base', 'first', 'second'])

    def test_map_prefers_exact_overlay_name_over_prefixed_name(self):
        self.write('maps/universe/zones.xml', '<macros/>')
        self.write('extensions/ego_test/maps/universe/aaa_zones.xml', '<macros><macro name="wrong"/></macros>')
        self.write('extensions/ego_test/maps/universe/zones.xml', '<macros><macro name="exact"/></macros>')
        self.merger.dlc_order = ['ego_test']
        self.merger.distill_targeted_map_xml('maps/universe', ['zones.xml'])
        result = etree.parse(str(self.output / 'maps/universe/zones/final.xml'))
        self.assertEqual(result.xpath('/macros/macro/@name'), ['exact'])

    def test_indexes_normalize_deduplicate_and_preserve_last_distinct_entry(self):
        self.write('index/macros.xml', '<index><entry name="same" value="assets\\\\same"/><entry name="conflict" value="old"/></index>')
        self.write('extensions/ego_test/index/macros.xml', '<index><entry value="assets\\same" name="same"></entry><entry name="conflict" value="new"/></index>')
        output, warnings = process_index_file(self.source, 'macros.xml', 'macros', ['ego_test'], self.output, etree.XMLParser(remove_blank_text=True))
        result = etree.parse(output)
        self.assertEqual(result.xpath('/index/entry/@name'), ['same', 'conflict'])
        self.assertEqual(result.xpath('/index/entry/@value'), ['assets\\same', 'new'])
        self.assertEqual(len(warnings), 1)

    def test_full_export_reuses_source_trees_without_moving_cached_nodes(self):
        self.fixture()
        destination = self.run_fixture()
        aggregator = AssetAggregator(self.source, destination)
        with patch('distiller.aggregate.etree.parse', wraps=etree.parse) as parse:
            warnings = aggregator.run()
        self.assertEqual(warnings, [])
        self.assertEqual(parse.call_count, 2)
        cached = aggregator.read_source('assets/all')
        self.assertEqual(len(cached.findall('macro')), 7)
        library = destination / 'libraries'
        self.assertEqual(etree.parse(str(library / 'bullet_macros.xml')).xpath('/macros/macro/@name'), ['bullet_m'])
        self.assertEqual(etree.parse(str(library / 'ship_connection_macros.xml')).xpath('/macros/macro/@name'), ['dock_m', 'storage_m'])
        ship = etree.parse(str(library / 'ship_components.xml')).find('.//connection')
        equip = etree.parse(str(library / 'equipment_components.xml')).find('.//connection')
        self.assertEqual(dict(ship.attrib), {'name': 'engine', 'tags': 'ENGINE'})
        self.assertEqual(dict(equip.attrib), {'name': 'part', 'tags': 'component', 'custom': 'keep'})
        self.assertEqual(len(ship), 0)
        self.assertEqual(len(equip), 0)

    def test_invalid_xml_preserves_previous_output_and_cleans_staging(self):
        self.fixture()
        destination = self.run_fixture()
        previous = {file.relative_to(destination): file.read_bytes() for file in destination.rglob('*') if file.is_file()}
        self.write('libraries/wares.xml', '<wares>')
        with self.assertRaises(etree.XMLSyntaxError):
            self.run_fixture()
        current = {file.relative_to(destination): file.read_bytes() for file in destination.rglob('*') if file.is_file()}
        self.assertEqual(current, previous)
        self.assertEqual(list(self.output.iterdir()), [destination])

    def test_late_aggregation_failure_preserves_previous_output(self):
        self.fixture()
        destination = self.run_fixture()
        marker = destination / 'keep.txt'
        marker.write_text('previous', encoding='utf-8')
        self.write('assets/all.xml', '<macros>')
        with self.assertRaises(etree.XMLSyntaxError):
            self.run_fixture()
        self.assertEqual(marker.read_text(encoding='utf-8'), 'previous')

    def test_publication_failure_restores_previous_output(self):
        staged = self.root / 'staged'
        destination = self.root / 'published'
        staged.mkdir()
        destination.mkdir()
        (destination / 'previous.txt').write_text('previous', encoding='utf-8')
        rename = Path.rename
        def fail_publish(file, target):
            if file == staged:
                raise OSError('publish failed')
            return rename(file, target)
        with patch.object(Path, 'rename', fail_publish):
            with self.assertRaisesRegex(OSError, 'publish failed'):
                publish_assets(staged, destination)
        self.assertEqual((destination / 'previous.txt').read_text(encoding='utf-8'), 'previous')
        self.assertEqual(list(self.root.glob('.published.previous-*')), [])

    def test_failed_rollback_keeps_previous_output_in_reported_backup(self):
        staged = self.root / 'staged'
        destination = self.root / 'published'
        staged.mkdir()
        destination.mkdir()
        (destination / 'previous.txt').write_text('previous', encoding='utf-8')
        rename = Path.rename
        def fail_publish_and_rollback(file, target):
            if target == destination:
                raise OSError('destination unavailable')
            return rename(file, target)
        with patch.object(Path, 'rename', fail_publish_and_rollback):
            with self.assertRaisesRegex(RuntimeError, '旧产物保留在') as error:
                publish_assets(staged, destination)
        backups = list(self.root.glob('.published.previous-*'))
        self.assertEqual(len(backups), 1)
        self.assertIn(str(backups[0]), str(error.exception))
        self.assertEqual((backups[0] / 'previous.txt').read_text(encoding='utf-8'), 'previous')

    def test_invalid_dlc_index_preserves_previous_output(self):
        self.fixture()
        destination = self.run_fixture()
        previous = (destination / 'index/macros.xml').read_bytes()
        self.write('extensions/ego_test/index/macros.xml', '<index>')
        with self.assertRaises(etree.XMLSyntaxError):
            self.run_fixture(['ego_test'])
        self.assertEqual((destination / 'index/macros.xml').read_bytes(), previous)

    def test_missing_optional_asset_is_visible_in_completion_summary(self):
        self.fixture()
        (self.source / 'assets/all.xml').unlink()
        self.run_fixture()
        self.assertIn('引用文件不存在', self.capture.getvalue())
        self.assertIn('项警告', self.capture.getvalue())

    def test_source_and_output_overlap_is_rejected_without_modifying_source(self):
        self.fixture()
        machine = {'X4_PATHS': {'SOURCE': str(self.source.parent)}}
        config = {'folder_name': self.source.name, 'raw_assets_dir': str(self.source.parent)}
        with self.assertRaisesRegex(ValueError, '互相包含'):
            run_distillation_for_version(machine, config, self.root, fake_diff())
        self.assertTrue((self.source / 'libraries/wares.xml').is_file())


class VersionTests(unittest.TestCase):
    def setUp(self):
        self.config = {'versions': [
            {'version': '8.0', 'folder_name': '8.0', 'beta': False},
            {'version': '9.0', 'folder_name': '9.0-stable', 'beta': False},
            {'version': '9.0', 'folder_name': '9.0-beta', 'beta': True}],
            'current_version': '9.0', 'beta': False, 'raw_assets_dir': 'raw',
            'processed_assets_dir': 'processed', 'dlc_order': []}

    def select(self, **overrides):
        args = {'all_versions': False, 'version': None, 'beta': False, 'stable': False}
        args.update(overrides)
        return get_target_versions(self.config, SimpleNamespace(**args))

    def test_selection_preserves_current_explicit_and_all_version_rules(self):
        self.assertEqual(self.select()[0]['folder_name'], '9.0-stable')
        self.assertEqual(self.select(beta=True)[0]['folder_name'], '9.0-beta')
        self.assertEqual(self.select(version='8.0')[0]['folder_name'], '8.0')
        self.assertEqual(self.select(version='9.0', stable=True)[0]['folder_name'], '9.0-stable')
        self.assertEqual(self.select(all_versions=True, beta=True), self.config['versions'])
        with self.assertRaisesRegex(ValueError, '多个候选'):
            self.select(version='9.0')
        with self.assertRaisesRegex(ValueError, '未找到'):
            self.select(version='8.0', beta=True)

    def test_default_duplicate_candidates_are_rejected_like_ts_processor(self):
        self.config['versions'].append(deepcopy(self.config['versions'][1]))
        with self.assertRaisesRegex(ValueError, '多个候选'):
            self.select()

    def test_config_validation_matches_ts_processor_types(self):
        validate_version_config(self.config)
        cases = [(None, '无效版本配置'), ({**self.config, 'versions': []}, 'versions'),
                 ({**self.config, 'beta': 'false'}, 'beta/dlc_order'),
                 ({**self.config, 'dlc_order': [1]}, 'beta/dlc_order'),
                 ({**self.config, 'raw_assets_dir': ''}, 'raw_assets_dir'),
                 ({**self.config, 'versions': [{'version': '9.0', 'folder_name': '9', 'beta': 'false'}]}, 'boolean')]
        for config, message in cases:
            with self.subTest(config=config):
                with self.assertRaisesRegex(ValueError, message):
                    validate_version_config(config)

    def test_version_merge_copies_nested_config(self):
        merged = merge_version_config(self.config, self.config['versions'][1])
        merged['dlc_order'].append('test')
        self.assertEqual(self.config['dlc_order'], [])


if __name__ == '__main__':
    unittest.main()
