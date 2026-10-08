"""Export referenced assets with one parse per source file and version."""
from copy import deepcopy
from pathlib import Path
from lxml import etree


def read_index(file, parser):
    root = etree.parse(str(file), parser).getroot()
    return {entry.get('name'): entry.get('value')
            for entry in root.findall('.//entry[@name][@value]')
            if entry.get('name') and entry.get('value')}


def component_refs(root):
    return {node.get('ref') for node in root.findall('.//macro/component[@ref]') if node.get('ref')}


def connection_refs(macros):
    return {node.get('ref') for macro in macros
            for node in macro.findall('./connections/*/macro[@ref]') if node.get('ref')}


def ware_refs(wares):
    return {node.get('ref') for ware in wares
            for node in ware.findall('./component[@ref]') if node.get('ref')}


def transform_ship_component(component):
    return filter_connections(component, equipment=False)


def transform_equipment_component(component):
    return filter_connections(component, equipment=True)


def filter_connections(component, equipment):
    result = etree.Element('component', attrib=dict(component.attrib))
    connections = component.find('connections')
    if connections is None:
        return None
    kept = etree.SubElement(result, 'connections')
    keywords = ('engine', 'shield', 'turret', 'weapon', 'thruster', 'dockingbay', 'dock', 'storage', 'cockpit')
    ship_attributes = ('name', 'group', 'tags', 'value', 'optional', 'parent', 'ref')
    for connection in connections.findall('connection'):
        tags = connection.get('tags', '').lower()
        if equipment:
            include = 'component' in tags.split()
        else:
            include = any(keyword in tags for keyword in keywords)
        if not include:
            continue
        if equipment:
            attributes = dict(connection.attrib)
        else:
            attributes = {name: connection.get(name) for name in ship_attributes if connection.get(name) is not None}
        etree.SubElement(kept, 'connection', attrib=attributes)
    return result if len(kept) else None


class AssetAggregator:
    def __init__(self, source, destination):
        self.source = Path(source)
        self.library = Path(destination) / 'libraries'
        self.parser = etree.XMLParser(remove_blank_text=True)
        self.macros = read_index(Path(destination) / 'index/macros.xml', self.parser)
        self.components = read_index(Path(destination) / 'index/components.xml', self.parser)
        self.wares = etree.parse(str(self.library / 'wares/final.xml'), self.parser)
        # Cached trees are immutable; export copies nodes rather than moving them.
        self.source_trees = {}
        self.warnings = []

    def read_source(self, value):
        relative = value.strip().replace('\\', '/').lstrip('./')
        if not relative:
            return None
        if not relative.lower().endswith('.xml'):
            relative += '.xml'
        file = self.source / relative
        if file not in self.source_trees:
            if not file.is_file():
                self.warnings.append(f'引用文件不存在: {file}')
                print(f'      ⚠️ {self.warnings[-1]}')
                self.source_trees[file] = None
            else:
                self.source_trees[file] = etree.parse(str(file), self.parser)
        return self.source_trees[file]

    def export_ids(self, ids, index, output_name, node_tag='macro', transform=None):
        root = etree.Element(f'{node_tag}s')
        for node_id in sorted(set(ids)):
            value = index.get(node_id)
            if not value:
                self.warnings.append(f'索引中没有引用: {node_id}')
                print(f'      ⚠️ {self.warnings[-1]}')
                continue
            tree = self.read_source(value)
            if tree is None:
                continue
            source_root = tree.getroot()
            if source_root.tag == node_tag:
                node = source_root
            else:
                node = next((candidate for candidate in source_root.iter(node_tag)
                             if candidate.get('name') == node_id), None)
            if node is None:
                self.warnings.append(f'文件中没有引用节点: {node_id} ({value})')
                print(f'      ⚠️ {self.warnings[-1]}')
                continue
            if transform is not None:
                node = transform(node)
                if node is None:
                    continue
            root.append(deepcopy(node))
        etree.ElementTree(root).write(str(self.library / output_name), encoding='utf-8', xml_declaration=True, pretty_print=True)
        print(f'✅ 聚合完成: {output_name}, {len(root)} 个 {node_tag}')
        return root

    def run(self):
        wares = self.wares.findall('.//ware')
        module_wares = [ware for ware in wares if 'module' in ware.get('tags', '')]
        self.export_ids(ware_refs(module_wares), self.macros, 'module_macros.xml')
        ships = self.export_ids((name for name in self.macros if name.startswith('ship_') and name.endswith('_macro')),
                                self.macros, 'ship_macros.xml')
        self.export_ids(component_refs(ships), self.components, 'ship_components.xml', 'component', transform_ship_component)

        equipment_wares = [ware for ware in wares if ware.get('transport') == 'equipment']
        equipment = self.export_ids(ware_refs(equipment_wares), self.macros, 'equipment_macros.xml')
        missiles = ware_refs([ware for ware in wares if ware.get('group') == 'missiles'])
        bullets = set()
        for macro in equipment.findall('.//macro'):
            bullet = macro.find('.//bullet')
            if bullet is not None and bullet.get('class'):
                bullets.add(bullet.get('class'))
        self.export_ids(bullets - missiles, self.macros, 'bullet_macros.xml')
        self.export_ids(component_refs(equipment), self.components, 'equipment_components.xml', 'component', transform_equipment_component)

        refs = connection_refs(ships.findall('macro'))
        files = {self.macros[ref] for ref in refs if ref in self.macros}
        dock_refs = set()
        for value in sorted(files):
            tree = self.read_source(value)
            if tree is not None:
                dock_refs.update(connection_refs(tree.findall("macro[@class='dockarea']")))
        self.export_ids((ref for ref in refs | dock_refs if ref in self.macros), self.macros, 'ship_connection_macros.xml')

        exported = {macro.get('name') for macro in equipment.findall('.//macro[@name]')}
        missing = []
        for ware in equipment_wares:
            component = ware.find('component')
            if ware.get('id') and component is not None:
                ref = component.get('ref')
                if ref and ref not in exported:
                    missing.append({'ware_id': ware.get('id'), 'macro_ref': ref, 'tags': ware.get('tags', '')})
        if missing:
            self.warnings.append(f'{len(missing)} 个未导出的 equipment wares')
            print(f'   ⚠️ {self.warnings[-1]}')
            counts = {}
            for item in missing:
                tags = item['tags'].split()
                tag = tags[0] if tags else 'unknown'
                counts[tag] = counts.get(tag, 0) + 1
            for tag, count in sorted(counts.items(), key=lambda entry: -entry[1]):
                print(f'      - {tag}: {count} 个')
            lines = [f"{item['ware_id']} -> {item['macro_ref']} (tags: {item['tags']})" for item in missing]
            (self.library / 'unexported_equipment_wares.txt').write_text(
                f'# 未导出的 equipment wares (共 {len(missing)} 个)\n\n' + '\n'.join(lines) + '\n', encoding='utf-8')
        else:
            print('   ✅ 所有 equipment wares 都已导出！')
        return self.warnings
