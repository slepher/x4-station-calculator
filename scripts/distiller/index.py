"""Merge macro/component indexes in DLC order."""
import os
from copy import deepcopy
from lxml import etree


def node_signature(node):
    # 忽略纯空白 text/tail，避免 <entry></entry> 与 <entry/> 被视为不同。
    attrs = tuple(sorted((k, v) for k, v in node.attrib.items()))
    text = (node.text or '').strip()
    children = tuple(node_signature(child) for child in list(node))
    return (node.tag, attrs, text, children)


def process_index_file(src, index_name, root_element_name, dlc_order, dest_dir, parser):
    """
    处理 index 文件：读取 base、叠加 DLC、去重、写出
    :param src: 源数据根目录
    :param index_name: index 文件名（如 "macros.xml"）
    :param root_element_name: 根元素名（如 "macros" / "components"）
    :param dlc_order: DLC 顺序列表
    :param dest_dir: 输出目录
    :param parser: XML 解析器
    :return: 输出文件路径和索引冲突警告
    """
    base_path = os.path.join(src, "index", index_name)
    output_path = os.path.join(dest_dir, index_name)

    tree = etree.parse(base_path, parser)
    if tree.getroot().tag != 'index':
        raise ValueError(f"索引根节点无效: {base_path}")

    root = tree.getroot()

    # 构建所有来源：先处理 base
    all_entry_sources = {}
    for node in root:
        name = node.get("name")
        value = node.get("value") or ""
        if name:
            if name not in all_entry_sources:
                all_entry_sources[name] = []
            all_entry_sources[name].append(('base', value))

    # 叠加 DLC，并在 all_entry_sources 中记录来源
    for dlc_id in dlc_order:
        patch_path = os.path.join(src, "extensions", dlc_id, "index", index_name)
        if not os.path.exists(patch_path):
            continue
        print(f"      [+] 叠加节点 ({dlc_id})")
        patch_root = etree.parse(patch_path, parser).getroot()
        if patch_root.tag != 'index':
            raise ValueError(f"索引根节点无效: {patch_path}")
        for node in patch_root:
            name = node.get("name")
            value = node.get("value") or ""
            if name:
                if name not in all_entry_sources:
                    all_entry_sources[name] = []
                all_entry_sources[name].append((dlc_id, value))
            root.append(deepcopy(node))

    # 规范 value 中的双反斜杠（始终执行，避免路径格式差异导致去重失败）
    normalized_double_slash = 0
    for entry in root.findall(".//entry[@value]"):
        value = entry.get("value") or ""
        normalized = value
        while "\\\\" in normalized:
            normalized = normalized.replace("\\\\", "\\")
        if normalized != value:
            entry.set("value", normalized)
            normalized_double_slash += 1
    if normalized_double_slash:
        print(f"   🔧 已规范 {normalized_double_slash} 个 entry.value 双反斜杠。")

    # name 相同且内容完全一致的节点自动去重合并
    merged_same_content = 0
    seen_name_and_content = set()
    for node in list(root):
        name = node.get("name")
        if not name:
            continue
        signature = node_signature(node)
        key = (name, signature)
        if key in seen_name_and_content:
            root.remove(node)
            merged_same_content += 1
        else:
            seen_name_and_content.add(key)
    if merged_same_content:
        print(f"   ♻️ 已合并 {merged_same_content} 个同名同内容节点。")

    # 处理重复 name（不同内容）：保留最后一条，警告并列出历史路径
    name_to_entries = {}
    for node in list(root):
        name = node.get("name")
        if not name:
            continue
        if name not in name_to_entries:
            name_to_entries[name] = []
        name_to_entries[name].append(node)

    dup_entries = []
    for name, entries in name_to_entries.items():
        if len(entries) <= 1:
            continue
        # 有重复，保留最后一个，删除前面的
        # 使用 all_entry_sources 显示所有冲突来源
        sources = all_entry_sources.get(name, [])

        for old_node in entries[:-1]:
            root.remove(old_node)
        # 记录重复信息用于表格输出（显示所有来源）
        dup_entries.append((name, sources))

    if dup_entries:
        print(f"   ⚠️ 发现 {len(dup_entries)} 个同名不同内容节点，已保留最后一条:")
        # 计算列宽
        name_width = max(len(name) for name, _ in dup_entries)
        src_width = max(len(src) for _, srcs in dup_entries for src, _ in srcs) if any(srcs for _, srcs in dup_entries) else 6
        # 表头
        print(f"      {'Name':<{name_width}} | {'Source':<{src_width}} | Value")
        print(f"      {'-' * name_width}-+-{'-' * src_width}-+--------------------------------")
        # 表格内容
        for name, sources in dup_entries:
            for i, (dlc_id, val) in enumerate(sources):
                name_col = name if i == 0 else ""
                print(f"      {name_col:<{name_width}} | {dlc_id:<{src_width}} | {val}")

    # 写出文件
    tree.write(output_path, encoding='utf-8', xml_declaration=True, pretty_print=True)

    # 最终统计
    final_names = [node.get("name") for node in root if node.get("name")]
    print(f"   ✨ 生成: index/{index_name}")
    print(f"   ✅ {root_element_name} 处理完成，共 {len(final_names)} 个具名元素。")

    warnings = [f'index/{index_name}: {len(dup_entries)} 个同名不同内容节点，已保留最后一条'] if dup_entries else []
    return output_path, warnings

