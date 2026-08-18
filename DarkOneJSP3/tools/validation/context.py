from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ValidationContext:
    """Shared paths, state and reporting helpers for release validation."""

    root: Path
    errors: list[str] = field(default_factory=list)
    version: str = ""
    _text_cache: dict[Path, str] = field(default_factory=dict, init=False, repr=False)

    def __post_init__(self) -> None:
        self.root = self.root.resolve()
        self.project = self.root / "DarkOneJSP3"
        self.samples = (
            self.root / "user-components-x64" / "foo_jscript_panel3" / "samples"
        )
        self.docs = self.project / "docs"

    def rel(self, path: Path) -> str:
        try:
            return str(path.relative_to(self.root))
        except ValueError:
            return str(path)

    def text(self, path: Path) -> str:
        resolved = path.resolve()
        if resolved not in self._text_cache:
            self._text_cache[resolved] = resolved.read_text(encoding="utf-8-sig")
        return self._text_cache[resolved]

    def require(self, path: Path) -> None:
        if not path.exists():
            self.errors.append("Missing: " + self.rel(path))
