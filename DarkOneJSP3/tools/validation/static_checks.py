from __future__ import annotations

from .context import ValidationContext
from . import (
    documentation_checks,
    package_checks,
    performance_checks,
    source_contract_checks,
)


def run(ctx: ValidationContext) -> None:
    """Run the focused static validation modules in dependency order."""

    package_checks.run(ctx)
    source_contract_checks.run(ctx)
    documentation_checks.run(ctx)
    performance_checks.run(ctx)
