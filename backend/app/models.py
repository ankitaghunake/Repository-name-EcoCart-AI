from pydantic import BaseModel, Field


PRODUCT_CATEGORIES = (
    "T-Shirts", "Shirts", "Jeans", "Hoodies", "Jackets", "Dresses", "Trousers",
)


class Product(BaseModel):
    id: str
    name: str
    brand: str
    category: str
    price: float = Field(ge=0)
    material: str
    organic_material: bool
    recycled_material: bool
    packaging_type: str
    recyclability_rate: float = Field(ge=0, le=100)
    biodegradable_grade: int = Field(ge=0, le=5)
    carbon_footprint: float = Field(ge=0)
    certification: str
    shipping_distance: float = Field(ge=0)
    durability: int = Field(ge=1, le=10)
    eco_score: int = Field(ge=0, le=100)
    image: str
    product_url: str


class ProductCreate(Product):
    eco_score: int = Field(default=0, ge=0, le=100)


class FeedbackCreate(BaseModel):
    product_id: str | None = None
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=500)


class Feedback(FeedbackCreate):
    id: str
    created_at: str


class Recommendation(BaseModel):
    product: Product
    similarity_score: int
    carbon_savings: float


class User(BaseModel):
    id: str
    name: str
    email: str
    password_hash: str