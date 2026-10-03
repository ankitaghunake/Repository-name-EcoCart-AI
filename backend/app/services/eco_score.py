"""Explainable 0–100 sustainability scoring for clothing products."""

from ..models import Product


def calculate_eco_score(product: Product | dict) -> dict:
    item = product if isinstance(product, Product) else Product.model_validate(product)
    material_name = item.material.lower()
    sustainable_material = any(
        word in material_name for word in ("organic", "recycled", "linen", "hemp", "lyocell", "tencel")
    )
    recyclable_packaging = any(
        word in item.packaging_type.lower() for word in ("recycl", "paper", "cardboard", "compost")
    )

    material_points = 18 if sustainable_material else 7
    organic_points = 12 if item.organic_material else 0
    recycled_points = 6 if item.recycled_material else 0
    packaging_points = 8 if recyclable_packaging else 2
    recyclability_points = round(item.recyclability_rate * 0.12)
    biodegradability_points = item.biodegradable_grade * 2
    certification_points = 12 if item.certification.strip().lower() not in ("", "none", "not certified") else 0
    carbon_points = round(max(0, 10 - min(item.carbon_footprint, 10)))
    shipping_points = round(max(0, 5 - min(item.shipping_distance / 2000, 5)))
    durability_points = round(item.durability * 0.7)
    score = max(0, min(100, sum((
        material_points, organic_points, recycled_points, packaging_points,
        recyclability_points, biodegradability_points, certification_points,
        carbon_points, shipping_points, durability_points,
    ))))

    explanation = [
        f"Material choice contributes {material_points} points.",
        f"Organic and recycled content contribute {organic_points + recycled_points} points.",
        f"Packaging and recyclability contribute {packaging_points + recyclability_points} points.",
        f"Biodegradability and certification contribute {biodegradability_points + certification_points} points.",
        f"Carbon, shipping distance and durability contribute {carbon_points + shipping_points + durability_points} points.",
    ]
    return {
        "eco_score": score,
        "carbon_footprint": item.carbon_footprint,
        "recyclability_rate": item.recyclability_rate,
        "biodegradable_grade": item.biodegradable_grade,
        "certification": item.certification,
        "material": item.material,
        "packaging": item.packaging_type,
        "explanation": explanation,
    }


def with_calculated_score(product: Product | dict) -> Product:
    item = product if isinstance(product, Product) else Product.model_validate(product)
    result = calculate_eco_score(item)
    return item.model_copy(update={"eco_score": result["eco_score"]})