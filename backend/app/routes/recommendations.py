from fastapi import APIRouter, HTTPException, Query

from ..models import Product
from ..repository import ProductRepository
from ..schemas import (
    CarbonSavingsRequest,
    CarbonSavingsResponse,
    RecommendationRequest,
    RecommendationResponse,
)
from ..services.carbon import calculate_carbon_saving
from ..services.recommender import find_recommendations

router = APIRouter(tags=["Recommendations and carbon"])
repository = ProductRepository()


def _build_response(selected: Product, limit: int = 3):
    alternatives = find_recommendations(selected, repository.list_products(), limit=limit)
    best_score = max((item.product.eco_score for item in alternatives), default=selected.eco_score)
    carbon_saving = max((item.carbon_savings for item in alternatives), default=0.0)
    return {
        "original_product": selected,
        "original_eco_score": selected.eco_score,
        "alternatives": alternatives,
        "improvement": max(0, best_score - selected.eco_score),
        "estimated_carbon_saving": carbon_saving,
        "product": selected,
        "estimated_carbon_savings": carbon_saving,
    }


@router.post("/recommendations", response_model=RecommendationResponse)
def recommend_products(payload: RecommendationRequest):
    selected = payload.original_product
    if selected is None and payload.product_id:
        selected = repository.get_product(payload.product_id)
    if selected is None:
        raise HTTPException(status_code=404, detail="Original product not found")
    return _build_response(selected, payload.limit)


@router.get("/products/{product_id}/recommendations", response_model=RecommendationResponse)
def recommend_for_catalog_product(product_id: str, limit: int = Query(default=3, ge=1, le=10)):
    selected = repository.get_product(product_id)
    if selected is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return _build_response(selected, limit)


@router.post("/carbon-savings", response_model=CarbonSavingsResponse)
def carbon_savings(payload: CarbonSavingsRequest):
    original = payload.original_product.carbon_footprint
    alternative = payload.alternative_product.carbon_footprint
    return {
        "original_carbon_footprint": original,
        "alternative_carbon_footprint": alternative,
        "estimated_carbon_saving": calculate_carbon_saving(original, alternative),
    }