"""Train a shallow decision tree to explain the catalog's Eco Score factors."""

from pathlib import Path

import joblib
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeRegressor

from app.repository import read_seed_products
from app.services.eco_score import calculate_eco_score

FEATURES = [
    "organic_material", "recycled_material", "sustainable_material", "recyclable_packaging",
    "recyclability_rate", "biodegradable_grade", "certified", "carbon_footprint",
    "shipping_distance", "durability",
]
MODEL_PATH = Path(__file__).with_name("eco_score_model.joblib")


def feature_values(product) -> dict[str, float]:
    material = product.material.lower()
    packaging = product.packaging_type.lower()
    return {
        "organic_material": float(product.organic_material),
        "recycled_material": float(product.recycled_material),
        "sustainable_material": float(any(
            word in material for word in ("organic", "recycled", "linen", "hemp", "lyocell", "tencel")
        )),
        "recyclable_packaging": float(any(
            word in packaging for word in ("recycl", "paper", "cardboard", "compost")
        )),
        "recyclability_rate": float(product.recyclability_rate),
        "biodegradable_grade": float(product.biodegradable_grade),
        "certified": float(product.certification.strip().lower() not in ("", "none", "not certified")),
        "carbon_footprint": float(product.carbon_footprint),
        "shipping_distance": float(product.shipping_distance),
        "durability": float(product.durability),
    }


def train_model(model_path: Path = MODEL_PATH) -> dict:
    products = read_seed_products()
    frame = pd.DataFrame([feature_values(item) for item in products], columns=FEATURES)
    target = pd.Series([calculate_eco_score(item)["eco_score"] for item in products])
    train_x, test_x, train_y, test_y = train_test_split(
        frame, target, test_size=0.2, random_state=42
    )
    model = DecisionTreeRegressor(max_depth=4, min_samples_leaf=2, random_state=42)
    model.fit(train_x, train_y)
    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": model, "features": FEATURES}, model_path)
    predictions = model.predict(test_x)
    return {
        "model_path": str(model_path),
        "mean_absolute_error": round(float(mean_absolute_error(test_y, predictions)), 2),
        "feature_importances": dict(zip(FEATURES, model.feature_importances_.round(3).tolist())),
        "tree_depth": model.get_depth(),
    }


if __name__ == "__main__":
    print(train_model())