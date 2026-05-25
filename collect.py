import os
import sys
import argparse
from pathlib import Path
from typing import Set, List, Iterator

# --- Configuration Constants ---
DEFAULT_EXCLUDES = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", 
    ".next", "dist", "build", ".DS_Store"
}

# Added modern web and data formats
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".mp4", ".mov", ".mp3", ".wav", ".exe", ".zip", ".pdf",
    ".db", ".sqlite", ".pyc", ".woff", ".woff2"
}

class ProjectCollector:
    def __init__(self, root: str, output: str, excludes: Set[str]):
        self.root = Path(root).resolve()
        self.output_path = Path(output).resolve()
        self.excludes = excludes
        self.total_lines = 0
        self.files_indexed = 0

    def is_binary(self, path: Path) -> bool:
        if path.suffix.lower() in BINARY_EXTENSIONS:
            return True
        try:
            with open(path, "rb") as f:
                return b"\x00" in f.read(8192)
        except OSError:
            return True

    def build_tree(self, curr_dir: Path, prefix: str = "") -> Iterator[str]:
        """Generator for a visual tree structure."""
        if curr_dir == self.root:
            yield f"{curr_dir.name}/"

        entries = sorted(
            [e for e in curr_dir.iterdir() if e.name not in self.excludes],
            key=lambda e: (not e.is_dir(), e.name.lower())
        )

        for i, entry in enumerate(entries):
            is_last = i == len(entries) - 1
            connector = "└── " if is_last else "├── "
            yield f"{prefix}{connector}{entry.name}{'/' if entry.is_dir() else ''}"
            
            if entry.is_dir():
                new_prefix = prefix + ("    " if is_last else "│   ")
                yield from self.build_tree(entry, new_prefix)

    def collect(self):
        text_files: List[Path] = []
        all_paths: List[Path] = []

        # Walk through files
        for path in self.root.rglob("*"):
            if any(part in self.excludes for part in path.parts):
                continue
            if path == self.output_path or path.is_dir():
                continue
            
            all_paths.append(path)
            if not self.is_binary(path):
                text_files.append(path)

        with open(self.output_path, "w", encoding="utf-8") as out:
            # 1. Directory Tree
            out.write(f"{'='*60}\n  DIRECTORY TREE\n{'='*60}\n")
            out.write("\n".join(self.build_tree(self.root)) + "\n\n")

            # 2. File Index
            out.write(f"{'='*60}\n  FILE INDEX ({len(all_paths)} files)\n{'='*60}\n")
            for p in sorted(all_paths):
                out.write(f"{p.relative_to(self.root)}\n")
            out.write("\n")

            # 3. Contents
            out.write(f"{'='*60}\n  FILE CONTENTS\n{'='*60}\n")
            for path in text_files:
                try:
                    content = path.read_text(encoding="utf-8", errors="replace")
                    lines = content.count('\n') + 1
                    self.total_lines += lines
                    
                    out.write(f"{'-'*60}\n")
                    out.write(f"File: {path.name} | Lines: {lines}\n")
                    out.write(f"Path: {path.relative_to(self.root)}\n")
                    out.write(f"{'-'*60}\n{content}\n\n")
                except Exception as e:
                    print(f"Error reading {path.name}: {e}")

        self.print_summary(len(all_paths), len(text_files))

    def print_summary(self, total, written):
        print(f"\n✨ Aggregation Complete!")
        print(f"📂 Output:  {self.output_path}")
        print(f"📊 Summary: {total} files found | {written} text files processed")
        print(f"📈 Total lines of code: {self.total_lines}")

def main():
    parser = argparse.ArgumentParser(description="Collect project files into one text file.")
    parser.add_argument("target", nargs="?", default=".", help="Target directory")
    parser.add_argument("-o", "--output", default="all_files.txt", help="Output filename")
    parser.add_argument("-e", "--exclude", nargs="*", help="Additional directories to exclude")
    
    args = parser.parse_args()
    
    excludes = DEFAULT_EXCLUDES
    if args.exclude:
        excludes.update(args.exclude)

    collector = ProjectCollector(args.target, args.output, excludes)
    collector.collect()

if __name__ == "__main__":
    main()