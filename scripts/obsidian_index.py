#!/usr/bin/env python3
"""產生 Obsidian vault 的 TOON 格式索引"""

import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import TypedDict

from toon_py import encode as toon_encode


class FileInfo(TypedDict):
    path: str
    modified: str
    tags: list[str]


class FolderInfo(TypedDict):
    name: str
    count: int


class TagInfo(TypedDict):
    tag: str
    count: int


class VaultData(TypedDict):
    updated_at: str
    total_files: int
    folders: list[FolderInfo]
    top_tags: list[TagInfo]
    recent_files: list[FileInfo]


def extract_tags(content: str) -> list[str]:
    """從 markdown 內容提取 tags"""
    tags = set()

    # Frontmatter tags (tags: [a, b] 或 tags: a, b)
    frontmatter_match = re.search(r"^---\n(.*?)\n---", content, re.DOTALL)
    if frontmatter_match:
        fm = frontmatter_match.group(1)
        # tags: [a, b, c]
        list_match = re.search(r"tags:\s*\[(.*?)\]", fm)
        if list_match:
            for tag in list_match.group(1).split(","):
                tag = tag.strip().strip("\"'")
                if tag:
                    tags.add(tag)
        # YAML list format: tags:\n  - a\n  - b
        yaml_list = re.search(r"tags:\s*\n((?:\s+-\s*.+\n?)+)", fm)
        if yaml_list:
            for tag in re.findall(r"-\s*(.+)", yaml_list.group(1)):
                tag = tag.strip().strip("\"'")
                if tag:
                    tags.add(tag)
        # Inline format: tags: a, b, c (只在沒有換行的情況)
        if not list_match and not yaml_list:
            line_match = re.search(r"tags:\s*([^\n]+)$", fm, re.MULTILINE)
            if line_match:
                val = line_match.group(1).strip()
                if val and not val.startswith("-"):
                    for tag in val.split(","):
                        tag = tag.strip().strip("\"'")
                        if tag:
                            tags.add(tag)

    # Inline #tags (排除 markdown headers)
    inline_tags = re.findall(r"(?<!\S)#([a-zA-Z\u4e00-\u9fff][\w\u4e00-\u9fff/-]*)", content)
    tags.update(inline_tags)

    return [t for t in tags if t]


def scan_vault(vault_path: Path) -> VaultData:
    """掃描 vault 並收集資訊"""
    files: list[FileInfo] = []
    all_tags: Counter[str] = Counter()
    folders: Counter[str] = Counter()

    for md_file in vault_path.rglob("*.md"):
        # 跳過隱藏資料夾
        if any(part.startswith(".") for part in md_file.parts):
            continue

        rel_path = md_file.relative_to(vault_path)
        mtime = datetime.fromtimestamp(md_file.stat().st_mtime, tz=UTC)

        # 提取 tags
        try:
            content = md_file.read_text(encoding="utf-8")
            tags = extract_tags(content)
        except Exception:
            tags = []

        files.append(
            FileInfo(
                path=str(rel_path),
                modified=mtime.isoformat(),
                tags=tags,
            )
        )

        all_tags.update(tags)

        # 記錄頂層資料夾
        if len(rel_path.parts) > 1:
            folders[rel_path.parts[0]] += 1

    # 排序：最近修改的在前
    files.sort(key=lambda x: x["modified"], reverse=True)

    # 轉換為 TOON 友善的陣列格式（更省 token）
    folders_list: list[FolderInfo] = [FolderInfo(name=k, count=v) for k, v in folders.most_common()]
    tags_list: list[TagInfo] = [TagInfo(tag=k, count=v) for k, v in all_tags.most_common(30)]

    # 簡化 recent_files 的 modified 欄位（只保留日期）
    recent = [
        FileInfo(path=f["path"], modified=f["modified"][:10], tags=f["tags"]) for f in files[:50]
    ]

    return {
        "updated_at": datetime.now(tz=UTC).isoformat(),
        "total_files": len(files),
        "folders": folders_list,
        "top_tags": tags_list,
        "recent_files": recent,
    }


def generate_index(vault_path: str | Path, output_path: str | Path | None = None) -> str:
    """產生索引檔"""
    vault_path = Path(vault_path).expanduser()
    if not vault_path.exists():
        raise FileNotFoundError(f"Vault not found: {vault_path}")

    data = scan_vault(vault_path)
    toon_content = toon_encode(data)

    if output_path is None:
        output_path = vault_path / "index.toon"
    else:
        output_path = Path(output_path).expanduser()

    output_path.write_text(toon_content, encoding="utf-8")
    return str(output_path)


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python obsidian_index.py <vault_path> [output_path]")
        sys.exit(1)

    vault = sys.argv[1]
    output = sys.argv[2] if len(sys.argv) > 2 else None

    try:
        result = generate_index(vault, output)
        print(f"Index generated: {result}")
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)
