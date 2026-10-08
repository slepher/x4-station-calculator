"""Build base/DLC/final XML stacks using lxml and X4 Customizer."""
import glob
import os
import shutil
from copy import deepcopy
from pathlib import Path
from lxml import etree

NAMESPACES = {'xsi': 'http://www.w3.org/2001/XMLSchema-instance'}


class XMLMerger:
    def __init__(self, source, destination, dlc_order, xml_diff):
        self.source = source
        self.destination = destination
        self.dlc_order = dlc_order
        self.xml_diff = xml_diff
        self.parser = etree.XMLParser(remove_blank_text=True)
        self.warnings = []

    def normalize_dlc_name(self, dlc_id):
        return dlc_id[4:] if dlc_id.startswith("ego_") else dlc_id

    def clone_tree(self, tree):
        return etree.ElementTree(deepcopy(tree.getroot()))

    def ns_xpath(self, node, xpath_expr):
        return node.xpath(xpath_expr, namespaces=NAMESPACES)

    def patch_has_if(self, root):
        if root.tag != 'diff':
            return False
        return any(node.get('if') for node in root if isinstance(node.tag, str))

    def should_bypass_if_condition(self, op_node):
        if op_node.tag != 'add':
            return False
        condition = op_node.get('if')
        if condition not in {
            "/wares/production/method[@id='terran']",
            "/wares/production/method[@id='closedloop']",
        }:
            return False
        sel = op_node.get('sel') or ''
        if not (sel.startswith("/wares/ware[@id='") and sel.endswith("']")):
            return False
        children = [child for child in op_node if isinstance(child.tag, str)]
        if not children:
            return False
        return all(child.tag == 'production' for child in children)

    def evaluate_patch_condition(self, temp_tree, op_node):
        condition = op_node.get('if')
        if not condition:
            return True
        if self.should_bypass_if_condition(op_node):
            return True
        # Conditions refer to the actual XML document, not our virtual <root>.
        # ElementTree supplies this document context without copying the XML.
        condition_tree = etree.ElementTree(temp_tree.getroot()[0])
        return bool(self.ns_xpath(condition_tree, condition))

    def resolve_patch_targets(self, temp_tree, op_node):
        xpath_expr = op_node.get('sel')
        if not xpath_expr:
            raise ValueError('missing sel')

        optype = 'node'
        base_xpath = xpath_expr
        for suffix in ['/text()[1]', '/text()']:
            if base_xpath.endswith(suffix):
                optype = 'text'
                base_xpath = base_xpath[: -len(suffix)]
                break

        try:
            if base_xpath.startswith('('):
                rel_xpath = base_xpath.replace('(', '(.', 1)
            else:
                rel_xpath = '.' + base_xpath
            matched = self.ns_xpath(temp_tree, rel_xpath)
        except Exception as e:
            raise ValueError(f'xpath exception: {e}') from e

        if not matched:
            raise ValueError('no xpath match found')
        if len(matched) > 1:
            raise ValueError('multiple xpath matches found')

        target = matched[0]
        if isinstance(target, (str, etree._ElementUnicodeResult)):
            target = target.getparent()
            optype = 'attrib'

        if op_node.get('type'):
            optype = 'attrib'

        return target, optype

    def extract_attrib_name(self, op_node):
        if op_node.tag == 'add':
            attrib_name = op_node.get('type')
            if not attrib_name:
                raise ValueError('attribute add missing type')
            return attrib_name.replace('@', '')

        xpath_expr = op_node.get('sel') or ''
        if '/@' not in xpath_expr:
            raise ValueError('attribute op missing /@ in sel')
        attrib_name = xpath_expr.rsplit('/@', 1)[1]
        if '[' in attrib_name:
            attrib_name = attrib_name.split('[', 1)[0]
        return attrib_name

    def apply_custom_patch_op(self, op_node, target_node, optype):
        def append_near_same_tag(parent_node, child_node):
            insert_at = None
            for idx, existing in enumerate(parent_node):
                if existing.tag == child_node.tag:
                    insert_at = idx + 1
            if insert_at is None:
                parent_node.append(child_node)
            else:
                parent_node.insert(insert_at, child_node)

        if optype == 'text':
            if op_node.tag == 'add':
                raise ValueError('text add not supported')
            if op_node.tag == 'remove':
                target_node.text = None
                return
            if op_node.tag == 'replace':
                target_node.text = op_node.text
                return

        if optype == 'attrib':
            attrib_name = self.extract_attrib_name(op_node)
            if op_node.tag in ('add', 'replace'):
                target_node.set(attrib_name, op_node.text or '')
                return
            if op_node.tag == 'remove':
                if attrib_name in target_node.attrib:
                    target_node.attrib.pop(attrib_name)
                return

        parent = target_node.getparent()
        if parent is None:
            raise ValueError('target node has no parent')

        if op_node.tag == 'add':
            pos = op_node.get('pos')
            children = deepcopy(op_node.getchildren())
            if pos is None:
                for child in children:
                    append_near_same_tag(target_node, child)
                return
            if pos == 'prepend':
                for child in reversed(children):
                    target_node.insert(0, child)
                return
            if pos == 'before':
                for child in children:
                    target_node.addprevious(child)
                return
            if pos == 'after':
                for child in reversed(children):
                    target_tail = target_node.tail
                    child_tail = child.tail
                    target_node.addnext(child)
                    target_node.tail = target_tail
                    child.tail = child_tail
                return
            raise ValueError(f'pos {pos} not understood')

        if op_node.tag == 'remove':
            parent.remove(target_node)
            return

        if op_node.tag == 'replace':
            children = deepcopy(op_node.getchildren())
            for child in children:
                target_node.addprevious(child)
            parent.remove(target_node)
            return

        raise ValueError(f'unsupported op {op_node.tag}')

    def apply_custom_patch(self, target_tree, patch_root, source_path):
        target_root = target_tree.getroot()
        if patch_root.tag != 'diff':
            if patch_root.tag != target_root.tag:
                raise ValueError(f'root tags differ: {target_root.tag} vs {patch_root.tag}')
            target_root.extend(deepcopy(patch_root.getchildren()))
            return

        temp_root = etree.Element('root')
        temp_root.append(target_root)
        temp_tree = etree.ElementTree(temp_root)

        for op_node in patch_root:
            if not isinstance(op_node.tag, str):
                continue
            if op_node.tag not in {'add', 'replace', 'remove'}:
                raise ValueError(f"不支持的 patch 指令 {op_node.tag} ({source_path}:{op_node.sourceline})")
            if not self.evaluate_patch_condition(temp_tree, op_node):
                continue
            try:
                target_node, optype = self.resolve_patch_targets(temp_tree, op_node)
                self.apply_custom_patch_op(op_node, target_node, optype)
            except Exception as e:
                if op_node.get('silent') in {'1', 'true'}:
                    continue
                if str(e) not in {'no xpath match found', 'multiple xpath matches found'}:
                    raise ValueError(f"补丁失败 {source_path}:{op_node.sourceline}: {e}") from e
                self.warn(f"跳过补丁 {source_path}:{op_node.sourceline} {op_node.tag} sel={op_node.get('sel')}: {e}")

        if len(temp_root) != 1 or temp_root[0].tag != target_root.tag:
            raise ValueError('patch must preserve one XML root with the original tag')
        target_tree._setroot(temp_root[0])

    def apply_overlay_to_tree(self, base_tree, source_path):
        if base_tree is None:
            raise ValueError(f"缺少基础树，无法应用补丁: {source_path}")
        source_tree = etree.parse(source_path, self.parser)
        source_root = source_tree.getroot()
        target_tree = self.clone_tree(base_tree)
        if source_root.tag not in {'diff', target_tree.getroot().tag}:
            raise ValueError(f"root tags differ: {target_tree.getroot().tag} vs {source_root.tag}")
        if self.patch_has_if(source_root):
            self.apply_custom_patch(target_tree, source_root, source_path)
            return target_tree, 'patched-custom'

        # Customizer reports skipped operations through its public log hook.
        # Capture them so a partially applied patch cannot look like a clean run.
        logger = self.xml_diff.Plugin_Log
        previous_logger = logger.logging_function
        messages = []
        logger.logging_function = messages.append
        try:
            replacement_root = self.xml_diff.Apply_Patch(target_tree.getroot(), source_root)
        finally:
            logger.logging_function = previous_logger
            for message in messages:
                logger.Print(message)
        for message in messages:
            if 'no xpath match found' in message or 'multiple xpath matches found' in message:
                self.warn(f"{source_path}: {message}")
            else:
                raise ValueError(f"{source_path}: {message}")
        target_tree._setroot(replacement_root)
        return target_tree, 'patched'

    def warn(self, message):
        self.warnings.append(message)
        print(f"      ⚠️ {message}")

    def get_xml_slot_paths(self, relative_path):
        rel = Path(os.path.normpath(relative_path))
        slot_dir = os.path.join(self.destination, str(rel.parent), rel.stem)
        return slot_dir, os.path.join(slot_dir, "base.xml"), os.path.join(slot_dir, "final.xml")

    def copy_related_xsd(self, relative_path, slot_dir):
        rel_path = Path(relative_path)
        xsd_name = f"{rel_path.stem}.xsd"
        base_xsd = os.path.join(self.source, str(rel_path.parent), xsd_name)
        if os.path.exists(base_xsd):
            shutil.copy2(base_xsd, os.path.join(slot_dir, xsd_name))
            return True

        for dlc_id in self.dlc_order:
            dlc_xsd = os.path.join(self.source, "extensions", dlc_id, str(rel_path.parent), xsd_name)
            if os.path.exists(dlc_xsd):
                shutil.copy2(dlc_xsd, os.path.join(slot_dir, xsd_name))
                return True
        return False

    def build_dlc_stack_xml(self, relative_path, overlay_sources_by_dlc):
        slot_dir, base_output_path, final_output_path = self.get_xml_slot_paths(relative_path)
        os.makedirs(slot_dir, exist_ok=True)

        base_src = os.path.join(self.source, relative_path)
        base_tree = None
        if os.path.exists(base_src):
            base_tree = etree.parse(base_src, self.parser)
            base_tree.write(base_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
        else:
            self.warn(f"Base 文件不存在: {base_src}")

        copied_xsd = self.copy_related_xsd(relative_path, slot_dir)
        final_tree = self.clone_tree(base_tree) if base_tree is not None else None
        dlc_written = 0

        for dlc_id in self.dlc_order:
            source_path = overlay_sources_by_dlc.get(dlc_id)
            if not source_path:
                continue

            # 按需求：目录中保留 DLC 原始文件，不写“打过补丁后的单 DLC 版本”。
            dlc_output_path = os.path.join(slot_dir, f"{self.normalize_dlc_name(dlc_id)}.xml")
            shutil.copy2(source_path, dlc_output_path)
            dlc_written += 1

            final_tree, _ = self.apply_overlay_to_tree(final_tree, source_path)

        if final_tree is not None:
            final_tree.write(final_output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)
            final_written = True
        else:
            final_written = False

        return {
            'base': base_tree is not None,
            'final': final_written,
            'dlc_written': dlc_written,
            'xsd': copied_xsd,
        }

    def distill_targeted_map_xml(self, relative_dir, base_names):
        print(f"🗺️ [4/10] 正在蒸馏地图 XML: {relative_dir} ...")
        stats = {
            'base_written': 0,
            'final_written': 0,
            'dlc_versions_written': 0,
            'xsd_copied': 0,
        }

        base_name_set = set(base_names)

        def map_dlc_name_to_base(file_name):
            if file_name in base_name_set:
                return file_name
            for base_name in base_names:
                if file_name.endswith(f"_{base_name}"):
                    return base_name
            return None

        overlay_sources_by_target = {name: {} for name in base_names}
        for dlc_id in self.dlc_order:
            overlay_dir = os.path.join(self.source, "extensions", dlc_id, relative_dir)
            if not os.path.isdir(overlay_dir):
                continue

            selected_by_target = {}
            for path in sorted(glob.glob(os.path.join(overlay_dir, "*.xml"))):
                file_name = os.path.basename(path)
                target_name = map_dlc_name_to_base(file_name)
                if target_name is None:
                    continue
                priority = 2 if file_name == target_name else 1
                current = selected_by_target.get(target_name)
                if current is None or priority > current[0]:
                    selected_by_target[target_name] = (priority, path)

            for target_name, (_, target_path) in selected_by_target.items():
                overlay_sources_by_target[target_name][dlc_id] = target_path

        for file_name in base_names:
            relative_path = os.path.join(relative_dir, file_name)
            overlay_sources_by_dlc = overlay_sources_by_target.get(file_name, {})

            result = self.build_dlc_stack_xml(relative_path, overlay_sources_by_dlc)
            if result['base']:
                stats['base_written'] += 1
            if result['final']:
                stats['final_written'] += 1
            if result['xsd']:
                stats['xsd_copied'] += 1
            stats['dlc_versions_written'] += result['dlc_written']

        print(
            "   ✅ 地图 XML 蒸馏完成: "
            f"base={stats['base_written']}, "
            f"final={stats['final_written']}, "
            f"dlc_versions={stats['dlc_versions_written']}, "
            f"xsd={stats['xsd_copied']}"
        )


