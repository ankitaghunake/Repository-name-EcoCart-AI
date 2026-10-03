"""Per-item carbon savings estimates for product comparisons."""

from ..models import Product


def calculate_carbon_saving(original: Product | float, alternative: Product | float) -> float:
    original_footprint = original.carbon_footprint if isinstance(original, Product) else float(original)
    alternative_footprint = alternative.carbon_footprint if isinstance(alternative, Product) else float(alternative)
    return round(max(0.0, original_footprint - alternative_footprint), 2)