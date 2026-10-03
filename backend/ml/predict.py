"""Predict an Eco Score with the trained decision tree or transparent rules."""

import joblib

from app.models import Product
from app.services.eco_score import calculate_eco_score
from ml.train_model import FEATURES, MODEL_PATH, feature_values


def predict_eco_score(product: Product | dict) -> dict:
    item = product if isinstance(product, Product) else Product.model_validate(product)
    if not MODEL_PATH.exists():
        result = calculate_eco_score(item)
        return {"eco_score": result["eco_score"], "source": "transparent rules"}
    bundle = joblib.load(MODEL_PATH)
    features = feature_values(item)
    values = [[features[feature] for feature in bundle.get("features", FEATURES)]]
    score = max(0, min(100, round(float(bundle["model"].predict(values)[0]))))
    return {"eco_score": score, "source": "trained decision tree"}