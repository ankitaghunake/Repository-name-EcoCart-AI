from pydantic import BaseModel, Field
from fastapi import APIRouter

from ..models import Product
from ..repository import ProductRepository
from ..services.product_matching import match_catalog_product
from ..services.recommender import find_recommendations

router = APIRouter(prefix="/extension", tags=["Browser extension"])
repository = ProductRepository()


class ExtensionProductRequest(BaseModel):
    name: str = Field(min_length=1, max_length=300)
    url: str = Field(default="", max_length=2000)
    price: str = Field(default="", max_length=80)
    quantity: int = Field(default=1, ge=1, le=999)
    image: str = Field(default="", max_length=2000)
    product_id: str = Field(default="", max_length=200)
    category: str = Field(default="", max_length=120)
    brand: str = Field(default="", max_length=120)
    material: str = Field(default="", max_length=200)
    source: str = Field(default="unknown", max_length=80)


def _grade(score: int) -> str:
    if score >= 85:
        return "Excellent"
    if score >= 70:
        return "Very Good"
    if score >= 55:
        return "Good"
    return "Needs Improvement"


@router.post("/analyze")
def analyze_cart_product(payload: ExtensionProductRequest) -> dict:
    products = repository.list_products()
    if not products:
        return {
            "success": False,
            "source": payload.source,
            "input_product": payload.model_dump(),
            "matched_product": None,
            "alternatives": [],
            "message": "The EcoCart product dataset is empty.",
        }

    matched, similarity = match_catalog_product(
        payload.name,
        products,
        brand=payload.brand,
        category=payload.category,
        material=payload.material,
    )
    if matched is None:
        return {
            "success": False,
            "source": payload.source,
            "input_product": payload.model_dump(),
            "matched_product": None,
            "alternatives": [],
            "message": "No matching product was found in the EcoCart dataset.",
        }

    confidence = "high" if similarity >= 0.65 else "medium" if similarity >= 0.35 else "low"
    alternatives = find_recommendations(matched, products, limit=10)
    alternative_rows = []
    for recommendation in alternatives:
        product = recommendation.product
        saving = max(0.0, round(matched.carbon_footprint - product.carbon_footprint, 2))
        reduction = round(100 * saving / matched.carbon_footprint, 1) if matched.carbon_footprint else 0.0
        alternative_rows.append({
            "product": product,
            "eco_grade": _grade(product.eco_score),
            "similarity": recommendation.similarity_score,
            "improvement": product.eco_score - matched.eco_score,
            "carbon_saving": saving,
            "carbon_reduction_percentage": reduction,
        })

    return {
        "success": True,
        "source": payload.source,
        "input_product": payload.model_dump(),
        "matched_product": {
            "product_id": matched.id,
            "product": matched,
            "similarity": similarity,
            "confidence": confidence,
        },
        "eco_score": {"score": matched.eco_score, "grade": _grade(matched.eco_score)},
        "sustainability": {
            "material": matched.material,
            "certification": matched.certification,
            "manufacturing_emission": matched.carbon_footprint,
            "recyclability_rate": matched.recyclability_rate,
            "recycled_material": matched.recycled_material,
            "packaging": matched.packaging_type,
            "shipping_distance": matched.shipping_distance,
            "durability": matched.durability,
            "data_source": "EcoCart catalog match; retailer attributes are not assumed",
        },
        "alternatives": alternative_rows,
        "message": (
            "Catalog match found."
            if confidence == "high"
            else "Exact product not found. Showing the closest matching product from the EcoCart dataset."
        ),
    }