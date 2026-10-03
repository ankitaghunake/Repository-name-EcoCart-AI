"""Match retailer listings to products in the existing EcoCart catalog."""

import re

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..models import Product


def _tokens(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", value.casefold()))


def _description(product: Product) -> str:
    return " ".join((
        product.name, product.brand, product.category, product.material,
        product.certification,
    ))


def match_catalog_product(
    name: str,
    products: list[Product],
    *,
    brand: str = "",
    category: str = "",
    material: str = "",
) -> tuple[Product | None, float]:
    """Return the closest catalog product and a 0-1 similarity estimate."""
    if not name.strip() or not products:
        return None, 0.0

    query = " ".join(part for part in (name, brand, category, material) if part.strip())
    documents = [query, *(_description(product) for product in products)]
    try:
        matrix = TfidfVectorizer(ngram_range=(1, 2), stop_words="english").fit_transform(documents)
        text_scores = cosine_similarity(matrix[0:1], matrix[1:]).ravel()
    except ValueError:
        text_scores = [0.0] * len(products)

    name_tokens = _tokens(name)
    query_material_tokens = _tokens(material)
    ranked: list[tuple[float, Product]] = []
    for index, product in enumerate(products):
        candidate_name_tokens = _tokens(product.name)
        union = name_tokens | candidate_name_tokens
        name_similarity = len(name_tokens & candidate_name_tokens) / len(union) if union else 0.0
        category_similarity = float(
            bool(category) and category.casefold().strip() == product.category.casefold().strip()
        )
        material_tokens = query_material_tokens & _tokens(product.material)
        material_similarity = (
            len(material_tokens) / len(query_material_tokens)
            if query_material_tokens else 0.0
        )

        weights = [(float(text_scores[index]), 0.65), (name_similarity, 0.25)]
        if category:
            weights.append((category_similarity, 0.07))
        if material:
            weights.append((material_similarity, 0.03))
        total_weight = sum(weight for _, weight in weights)
        score = sum(value * weight for value, weight in weights) / total_weight
        ranked.append((score, product))

    score, product = max(ranked, key=lambda item: item[0])
    return product, round(max(0.0, min(1.0, score)), 4)