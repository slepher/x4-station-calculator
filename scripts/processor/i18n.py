import os
import re
import xml.etree.ElementTree as ET
from collections import defaultdict
from typing import Dict, Iterable, Optional, Set


class I18nRegistry:
    def __init__(self) -> None:
        self._raw_path: Optional[str] = None
        self._lang_config: Dict[str, Dict[str, str]] = {}
        self._lang_id_by_iso: Dict[str, str] = {}
        self._lookup_cache: Dict[str, Dict[str, Dict[str, str]]] = {}
        self._resolved_cache: Dict[str, Dict[str, str]] = defaultdict(dict)
        self._collected_name_ids: Set[str] = set()
        self._missing_by_lang: Dict[str, Set[str]] = defaultdict(set)

    def configure(self, raw_path: str, lang_config: Dict[str, Dict[str, str]]) -> None:
        if self._raw_path == raw_path and self._lang_config == lang_config:
            return
        self._raw_path = raw_path
        self._lang_config = lang_config
        self._lang_id_by_iso = {
            conf.get("iso", ""): lang_id
            for lang_id, conf in lang_config.items()
            if conf.get("iso")
        }
        self._lookup_cache.clear()
        self._resolved_cache.clear()
        self._missing_by_lang.clear()
        self._collected_name_ids.clear()

    def collect(self, name_id: str) -> None:
        if name_id:
            self._collected_name_ids.add(name_id)

    def collect_many(self, name_ids: Iterable[str]) -> None:
        for name_id in name_ids:
            self.collect(name_id)

    def get_name(self, name_id: str, lang: str = "en") -> str:
        self.collect(name_id)
        return self._resolve_text(name_id, lang)

    def export_collected(self, lang: str) -> Dict[str, str]:
        result: Dict[str, str] = {}
        for name_id in sorted(self._collected_name_ids):
            resolved = self._resolve_text(name_id, lang)
            if resolved:
                result[name_id] = resolved
        return result

    def missing_keys(self, lang: str) -> Set[str]:
        return set(self._missing_by_lang.get(lang, set()))

    def _load_lookup(self, lang: str) -> Dict[str, Dict[str, str]]:
        if lang in self._lookup_cache:
            return self._lookup_cache[lang]
        if not self._raw_path:
            self._lookup_cache[lang] = {}
            return {}
        lang_id = self._lang_id_by_iso.get(lang)
        if not lang_id:
            self._lookup_cache[lang] = {}
            return {}

        t_dir = os.path.join(self._raw_path, "t")
        candidates = [
            os.path.join(t_dir, f"0001-L{lang_id}.xml"),
            os.path.join(t_dir, f"0001-l{lang_id}.xml"),
        ]

        lookup: Dict[str, Dict[str, str]] = {}
        for path in candidates:
            if not os.path.exists(path):
                continue
            lookup = self._parse_lookup(path)
            if lookup:
                break
        self._lookup_cache[lang] = lookup
        return lookup

    def _parse_lookup(self, path: str) -> Dict[str, Dict[str, str]]:
        current_lang_db: Dict[str, Dict[str, str]] = {}
        try:
            tree = ET.parse(path)
            root = tree.getroot()
            for page in root.findall("page"):
                p_id = page.get("id")
                if not p_id:
                    continue
                page_map = current_lang_db.setdefault(p_id, {})
                for t in page.findall("t"):
                    t_id = t.get("id")
                    if not t_id:
                        continue
                    page_map[t_id] = "".join(t.itertext())
        except Exception:
            return {}
        return current_lang_db

    def _resolve_text(self, text: str, lang: str, depth: int = 0, visiting: Optional[Set[str]] = None) -> str:
        if not text:
            return ""
        if depth > 10:
            return text

        cache = self._resolved_cache[lang]
        if text in cache:
            return cache[text]

        lang_db = self._load_lookup(lang)
        if not lang_db:
            cache[text] = text
            return text

        token = text.strip()
        visiting = visiting or set()
        if token in visiting:
            return text
        visiting = set(visiting)
        visiting.add(token)

        strip_parenthetical = re.search(r"\{\s*\d+\s*,\s*\d+\s*\}", text) is not None
        current = text.replace("\\(", "(").replace("\\)", ")")

        def replace_callback(match: re.Match[str]) -> str:
            page, tid = match.group(1), match.group(2)
            raw = lang_db.get(page, {}).get(tid)
            if raw is None:
                self._missing_by_lang[lang].add(f"{{{page},{tid}}}")
                return match.group(0)
            return self._resolve_text(raw, lang, depth + 1, visiting)

        current = re.sub(r"\{\s*(\d+)\s*,\s*(\d+)\s*\}", replace_callback, current)
        current = re.sub(r"\\033#[^#]*#", "", current)
        current = re.sub(r"\\033.", "", current)
        current = current.replace("\\n", " ")
        if strip_parenthetical:
            current = _strip_parenthetical_text(current)
        current = current.replace("\\", " ")
        if strip_parenthetical:
            current = _strip_leading_duplicate_parenthetical(current)
        current = re.sub(r"\s+", " ", current).strip()
        if lang in {"zh-CN", "zh-TW"}:
            current = _keep_right_of_pipe(current)

        cache[text] = current
        return current


_REGISTRY: Optional[I18nRegistry] = None


def get_i18n_registry() -> I18nRegistry:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = I18nRegistry()
    return _REGISTRY


def _strip_parenthetical_text(text: str) -> str:
    if not text:
        return text
    depth = 0
    out = []
    for ch in text:
        if ch == "(":
            depth += 1
            continue
        if ch == ")":
            if depth > 0:
                depth -= 1
            continue
        if depth == 0:
            out.append(ch)
    return "".join(out)


def _strip_leading_duplicate_parenthetical(text: str) -> str:
    if not text:
        return text
    text = text.strip()
    if not (text.startswith("(") or text.startswith("（")):
        return text
    open_ch = "(" if text.startswith("(") else "（"
    close_ch = ")" if open_ch == "(" else "）"
    depth = 0
    end_idx = None
    for idx, ch in enumerate(text):
        if ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                end_idx = idx
                break
    if end_idx is None:
        return text
    inner = text[1:end_idx].strip()
    rest = text[end_idx + 1:].strip()
    if not rest:
        return text

    def normalize(value: str) -> str:
        return re.sub(r"\s+", " ", value).strip()

    if normalize(inner) == normalize(rest):
        return rest
    if re.search(r"[A-Za-z]", inner) and re.search(r"[\u4e00-\u9fff]", rest):
        return rest
    if re.search(r"[A-Za-z0-9\u4e00-\u9fff]", rest):
        return rest
    return text


def _keep_right_of_pipe(text: str) -> str:
    if not text:
        return text
    if "｜" in text:
        return text.split("｜", 1)[1].strip()
    if "|" in text:
        return text.split("|", 1)[1].strip()
    return text
