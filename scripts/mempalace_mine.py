#!/usr/bin/env python3

from __future__ import annotations

import argparse
import os
import sys
from collections import defaultdict
from pathlib import Path

import yaml

try:
    from mempalace.config import MempalaceConfig
    from mempalace.miner import (
        MIN_CHUNK_SIZE,
        READABLE_EXTENSIONS,
        SKIP_DIRS,
        add_drawer,
        chunk_text,
        detect_room,
        file_already_mined,
        get_collection,
    )
except ModuleNotFoundError as exc:
    print("ERROR: mempalace package is not available in this Python environment.", file=sys.stderr)
    print("Run this script with your mempalace venv, for example:", file=sys.stderr)
    print("  $HOME/.venvs/mempalace/bin/python scripts/mempalace_mine.py --help", file=sys.stderr)
    raise SystemExit(1) from exc


def load_project_config(config_path: Path) -> dict:
    with config_path.open("r", encoding="utf-8") as handle:
        config = yaml.safe_load(handle) or {}
    if not isinstance(config, dict):
        raise SystemExit(f"Invalid config file: {config_path}")
    rooms = config.get("rooms")
    if not isinstance(rooms, list) or not rooms:
        raise SystemExit(f"Config has no rooms: {config_path}")
    if not config.get("wing"):
        raise SystemExit(f"Config has no wing: {config_path}")
    return config


def normalize_rel_path(value: str) -> str:
    return value.replace("\\", "/").strip().strip("/")


def is_excluded(relative_path: str, exclude_paths: list[str]) -> bool:
    for exclude_path in exclude_paths:
        if relative_path == exclude_path or relative_path.startswith(f"{exclude_path}/"):
            return True
    return False


def collect_selected_files(
    project_root: Path,
    rooms: list[dict],
    only_room: str | None,
    exclude_paths: list[str],
) -> tuple[list[Path], list[tuple[str, str]]]:
    selected: dict[str, Path] = {}
    room_paths: list[tuple[str, str]] = []

    for room in rooms:
        room_name = room["name"]
        if only_room and room_name != only_room:
            continue

        paths = room.get("paths", [])
        if not isinstance(paths, list):
            continue

        for rel_value in paths:
            if not isinstance(rel_value, str) or not rel_value.strip():
                continue
            rel_path = normalize_rel_path(rel_value)
            target = project_root / rel_path
            room_paths.append((room_name, rel_path))

            if not target.exists():
                print(f"  ! Missing path for room {room_name}: {rel_path}")
                continue

            if target.is_file():
                relative = target.relative_to(project_root).as_posix()
                if target.suffix.lower() in READABLE_EXTENSIONS and not is_excluded(relative, exclude_paths):
                    selected[str(target)] = target
                continue

            for root, dirs, filenames in os.walk(target):
                dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
                for filename in filenames:
                    filepath = Path(root) / filename
                    relative = filepath.relative_to(project_root).as_posix()
                    if is_excluded(relative, exclude_paths):
                        continue
                    if filepath.suffix.lower() not in READABLE_EXTENSIONS:
                        continue
                    if filename in (
                        "mempalace.yaml",
                        "mempalace.yml",
                        "mempal.yaml",
                        "mempal.yml",
                        ".gitignore",
                        "package-lock.json",
                    ):
                        continue
                    selected[str(filepath)] = filepath

    files = sorted(selected.values(), key=lambda item: str(item))
    room_paths.sort(key=lambda item: len(item[1]), reverse=True)
    return files, room_paths


def resolve_room(filepath: Path, project_root: Path, room_paths: list[tuple[str, str]], rooms: list[dict]) -> str:
    relative = filepath.relative_to(project_root).as_posix()
    for room_name, rel_path in room_paths:
        if relative == rel_path or relative.startswith(f"{rel_path}/"):
            return room_name

    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except Exception:
        content = ""
    return detect_room(filepath, content, rooms, project_root)


def process_selected_file(
    filepath: Path,
    project_root: Path,
    collection,
    wing: str,
    rooms: list[dict],
    room_paths: list[tuple[str, str]],
    agent: str,
    dry_run: bool,
) -> tuple[int, str]:
    source_file = str(filepath)
    if not dry_run and file_already_mined(collection, source_file):
        return 0, ""

    try:
        content = filepath.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return 0, ""

    content = content.strip()
    if len(content) < MIN_CHUNK_SIZE:
        return 0, ""

    room = resolve_room(filepath, project_root, room_paths, rooms)
    chunks = chunk_text(content, source_file)

    if dry_run:
        print(f"    [DRY RUN] {filepath.relative_to(project_root).as_posix()} -> room:{room} ({len(chunks)} drawers)")
        return len(chunks), room

    drawers_added = 0
    for chunk in chunks:
        added = add_drawer(
            collection=collection,
            wing=wing,
            room=room,
            content=chunk["content"],
            source_file=source_file,
            chunk_index=chunk["chunk_index"],
            agent=agent,
        )
        if added:
            drawers_added += 1

    return drawers_added, room


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Mine only the directories declared in mempalace.yaml room paths."
    )
    parser.add_argument("--config", default="mempalace.yaml", help="Path to mempalace.yaml")
    parser.add_argument("--palace", default=None, help="Override palace path")
    parser.add_argument("--wing", default=None, help="Override wing name")
    parser.add_argument("--agent", default="mempalace", help="Recorded on each drawer")
    parser.add_argument("--limit", type=int, default=0, help="Max files to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview only")
    parser.add_argument("--room", default=None, help="Only mine one configured room")
    args = parser.parse_args()

    config_path = Path(args.config).expanduser().resolve()
    project_root = config_path.parent
    config = load_project_config(config_path)
    wing = args.wing or config["wing"]
    palace_path = args.palace or MempalaceConfig().palace_path
    rooms = config["rooms"]
    exclude_paths = [
        normalize_rel_path(value)
        for value in config.get("exclude_paths", [])
        if isinstance(value, str) and value.strip()
    ]

    files, room_paths = collect_selected_files(project_root, rooms, args.room, exclude_paths)
    if args.limit > 0:
        files = files[: args.limit]

    room_names = [room["name"] for room in rooms if not args.room or room["name"] == args.room]

    print(f"\n{'=' * 55}")
    print("  Scoped MemPalace Mine")
    print(f"{'=' * 55}")
    print(f"  Wing:    {wing}")
    print(f"  Rooms:   {', '.join(room_names)}")
    print(f"  Files:   {len(files)}")
    print(f"  Palace:  {palace_path}")
    print(f"  Config:  {config_path}")
    if args.dry_run:
        print("  DRY RUN — nothing will be filed")
    print(f"{'─' * 55}\n")

    collection = None if args.dry_run else get_collection(palace_path)
    total_drawers = 0
    files_skipped = 0
    room_counts: dict[str, int] = defaultdict(int)

    for index, filepath in enumerate(files, 1):
        drawers, room = process_selected_file(
            filepath=filepath,
            project_root=project_root,
            collection=collection,
            wing=wing,
            rooms=rooms,
            room_paths=room_paths,
            agent=args.agent,
            dry_run=args.dry_run,
        )
        if drawers == 0 and not args.dry_run:
            files_skipped += 1
            continue

        total_drawers += drawers
        if room:
            room_counts[room] += 1
        if not args.dry_run:
            label = filepath.relative_to(project_root).as_posix()
            print(f"  ✓ [{index:4}/{len(files)}] {label[:50]:50} +{drawers}")

    print(f"\n{'=' * 55}")
    print("  Done.")
    print(f"  Files processed: {len(files) - files_skipped}")
    print(f"  Files skipped (already filed): {files_skipped}")
    print(f"  Drawers filed: {total_drawers}")
    print("\n  By room:")
    for room_name, count in sorted(room_counts.items(), key=lambda item: item[1], reverse=True):
        print(f"    {room_name:20} {count} files")
    print('\n  Next: mempalace search "what you\'re looking for"')
    print(f"{'=' * 55}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
