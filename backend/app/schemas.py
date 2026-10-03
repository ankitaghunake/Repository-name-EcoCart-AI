import re

from pydantic import BaseModel, Field, field_validator, model_validator

from .models import Feedback, Product, ProductCreate, Recommendation


class EcoScoreRequest(ProductCreate):
    pass


class EcoScoreResponse(BaseModel):
    eco_score: int
    carbon_footprint: float
    recyclability_rate: float
    biodegradable_grade: int
    certification: str
    material: str
    packaging: str
    explanation: list[str]


class RecommendationRequest(BaseModel):
    original_product: Product | None = None
    product_id: str | None = None
    limit: int = Field(default=3, ge=1, le=10)

    @model_validator(mode="after")
    def require_product(self):
        if self.original_product is None and not self.product_id:
            raise ValueError("Provide original_product or product_id")
        return self


class ProductRecommendation(BaseModel):
    product: Product
    similarity_score: int
    carbon_savings: float


class RecommendationResponse(BaseModel):
    original_product: Product
    original_eco_score: int
    alternatives: list[ProductRecommendation]
    improvement: int
    estimated_carbon_saving: float
    product: Product
    estimated_carbon_savings: float


class CarbonSavingsRequest(BaseModel):
    original_product: Product
    alternative_product: Product


class CarbonSavingsResponse(BaseModel):
    original_carbon_footprint: float
    alternative_carbon_footprint: float
    estimated_carbon_saving: float
    unit: str = "kg CO2e per item"


class ProductListResponse(BaseModel):
    total: int
    products: list[Product]


class UserRegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=6, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class UserLoginRequest(BaseModel):
    email: str = Field(min_length=6, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized):
            raise ValueError("Enter a valid email address")
        return normalized


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    authenticated: bool = True


class FeedbackRequest(BaseModel):
    product_id: str | None = None
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=500)


class FeedbackResponse(Feedback):
    pass