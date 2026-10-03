"""CSV catalog and MongoDB/local persistence helpers."""

import csv
import json
from pathlib import Path
from threading import Lock

from . import database
from .models import Feedback, Product, ProductCreate
from .services.eco_score import with_calculated_score

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
PRODUCTS_CSV = DATA_DIR / "products.csv"
LOCAL_PRODUCTS = DATA_DIR / "products.local.json"


def _boolean(value: str | bool) -> bool:
    return value if isinstance(value, bool) else value.strip().lower() in {"true", "1", "yes"}


def read_seed_products() -> list[Product]:
    with PRODUCTS_CSV.open(encoding="utf-8-sig", newline="") as file:
        records = csv.DictReader(file)
        products = []
        for row in records:
            row["organic_material"] = _boolean(row["organic_material"])
            row["recycled_material"] = _boolean(row["recycled_material"])
            for field in ("price", "recyclability_rate", "carbon_footprint", "shipping_distance"):
                row[field] = float(row[field])
            for field in ("biodegradable_grade", "durability", "eco_score"):
                row[field] = int(row[field])
            products.append(with_calculated_score(ProductCreate.model_validate(row)))
    return products


class ProductRepository:
    def __init__(self) -> None:
        self._products: dict[str, Product] = {}
        self._lock = Lock()

    def connect(self) -> None:
        if database.connect_to_mongodb():
            collection = database.get_collection("products")
            if collection.count_documents({}) == 0:
                collection.insert_many([item.model_dump() for item in read_seed_products()])
        else:
            self._load_local_catalog()

    def close(self) -> None:
        database.close_database()

    def _load_local_catalog(self) -> None:
        self._products = {item.id: item for item in read_seed_products()}
        if LOCAL_PRODUCTS.exists():
            with LOCAL_PRODUCTS.open(encoding="utf-8") as file:
                for record in json.load(file):
                    product = Product.model_validate(record)
                    self._products[product.id] = product

    def list_products(self) -> list[Product]:
        collection = database.get_collection("products")
        if collection is not None:
            return [Product.model_validate(record) for record in collection.find({}, {"_id": 0})]
        if not self._products:
            self._load_local_catalog()
        return list(self._products.values())

    def get_product(self, product_id: str) -> Product | None:
        collection = database.get_collection("products")
        if collection is not None:
            record = collection.find_one({"id": product_id}, {"_id": 0})
            return Product.model_validate(record) if record else None
        if not self._products:
            self._load_local_catalog()
        return self._products.get(product_id)

    def add_product(self, product: Product) -> Product:
        collection = database.get_collection("products")
        if collection is not None:
            collection.insert_one(product.model_dump())
            return product
        with self._lock:
            self._products[product.id] = product
            with LOCAL_PRODUCTS.open("w", encoding="utf-8") as file:
                json.dump([item.model_dump() for item in self._products.values()], file, indent=2)
        return product

    def add_feedback(self, feedback: Feedback) -> Feedback:
        collection = database.get_collection("feedback")
        if collection is not None:
            collection.insert_one(feedback.model_dump())
            return feedback
        with self._lock:
            path = DATA_DIR / "feedback.json"
            existing = []
            if path.exists():
                with path.open(encoding="utf-8") as file:
                    existing = json.load(file)
            existing.append(feedback.model_dump())
            with path.open("w", encoding="utf-8") as file:
                json.dump(existing, file, indent=2)
        return feedback

    def feedback_count(self) -> int:
        collection = database.get_collection("feedback")
        if collection is not None:
            return collection.count_documents({})
        path = DATA_DIR / "feedback.json"
        if not path.exists():
            return 0
        with path.open(encoding="utf-8") as file:
            return len(json.load(file))