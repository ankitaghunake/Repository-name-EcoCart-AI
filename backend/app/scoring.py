"""Backward-compatible imports for the reusable score service."""

from .services.eco_score import calculate_eco_score, with_calculated_score

__all__ = ["calculate_eco_score", "with_calculated_score"]