from fastapi import APIRouter, HTTPException, Query

from ..database import get_collection
from ..models import Product
from ..repository import ProductRepository
from ..schemas import EcoScoreRequest, EcoScoreResponse, ProductListResponse
from ..services.eco_score import calculate_eco_score, with_calculated_score
from ml.predict import predict_eco_score

router = APIRouter(tags=["Products"])
repository = ProductRepository()


def _search_products(search: str = "", category: str | None = None, limit: int = 100) -> list[Product]:
    products = repository.list_products()
    if category:
        products = [item for item in products if item.category.casefold() == category.casefold()]
    if search.strip():
        term = search.strip().casefold()
        products = [
            item for item in products
            if term in " ".join((item.name, item.brand, item.category, item.material, item.certification)).casefold()
        ]
    return sorted(products, key=lambda item: item.eco_score, reverse=True)[:limit]


@router.get("/products", response_model=ProductListResponse)
def list_products(
    search: str = Query(default="", max_length=100),
    category: str | None = None,
    limit: int = Query(default=100, ge=1, le=200),
):
    products = _search_products(search, category, limit)
    return {"total": len(products), "products": products}


@router.get("/products/search/{query}", response_model=ProductListResponse)
def search_products(query: str, limit: int = Query(default=100, ge=1, le=200)):
    products = _search_products(query, limit=limit)
    if not products:
        raise HTTPException(status_code=404, detail="No products matched this search")
    return {"total": len(products), "products": products}


@router.get("/products/category/{category}", response_model=ProductListResponse)
def products_by_category(category: str, limit: int = Query(default=100, ge=1, le=200)):
    products = _search_products(category=category, limit=limit)
    if not products:
        raise HTTPException(status_code=404, detail=f"No products found in category '{category}'")
    return {"total": len(products), "products": products}


@router.get("/products/{product_id}", response_model=Product)
def get_product(product_id: str):
    product = repository.get_product(product_id)
    if product is None:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/categories", response_model=list[str])
def get_categories():
    return sorted({product.category for product in repository.list_products()})


@router.get("/dashboard/summary")
def dashboard_summary():
    products = repository.list_products()
    feedback_collection = get_collection("feedback")
    return {
        "product_count": len(products),
        "average_eco_score": round(sum(item.eco_score for item in products) / max(1, len(products))),
        "high_impact_count": sum(item.eco_score >= 75 for item in products),
        "category_count": len({item.category for item in products}),
        "feedback_count": feedback_collection.count_documents({}) if feedback_collection is not None else repository.feedback_count(),
    }


@router.post("/eco-score", response_model=EcoScoreResponse)
@router.post("/products/score", response_model=EcoScoreResponse, include_in_schema=False)
def score_product(payload: EcoScoreRequest):
    return calculate_eco_score(payload)


@router.post("/ml-predict", tags=["Machine learning"])
def predict_product_score(payload: EcoScoreRequest):
    return predict_eco_score(payload)


@router.post("/products", response_model=Product, status_code=201)
def create_product(payload: EcoScoreRequest):
    if repository.get_product(payload.id) is not None:
        raise HTTPException(status_code=409, detail="A product with this id already exists")
    product = with_calculated_score(payload)
    try:
        return repository.add_product(product)
    except Exception as error:
        raise HTTPException(status_code=409, detail="A product with this id already exists") from error