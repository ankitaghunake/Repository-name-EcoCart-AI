"""Same-category greener alternatives ranked by text and sustainability similarity."""

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ..models import Product, Recommendation
from .carbon import calculate_carbon_saving


def _description(product: Product) -> str:
    return " ".join((
        product.name, product.brand, product.category, product.material,
        product.packaging_type, product.certification,
    )).lower()


def find_recommendations(
    selected: Product,
    products: list[Product],
    limit: int = 3,
) -> list[Recommendation]:
    same_category = [item for item in products if item.category.casefold() == selected.category.casefold()]
    greener = [item for item in same_category if item.id != selected.id and item.eco_score > selected.eco_score]
    if not greener:
        return []

    comparisons = [selected, *same_category]
    matrix = TfidfVectorizer(ngram_range=(1, 2)).fit_transform([_description(item) for item in comparisons])
    selected_vector = matrix[0]
    fields = ("price", "carbon_footprint", "shipping_distance", "durability", "recyclability_rate")
    ranked: list[Recommendation] = []
    for candidate in greener:
        candidate_index = comparisons.index(candidate)
        text_similarity = float(cosine_similarity(selected_vector, matrix[candidate_index])[0, 0])
        differences = []
        for field in fields:
            selected_value = float(getattr(selected, field))
            candidate_value = float(getattr(candidate, field))
            differences.append(abs(selected_value - candidate_value) / max(selected_value, candidate_value, 1))
        numeric_similarity = max(0.0, 1 - sum(differences) / len(differences))
        sustainability_score = candidate.eco_score / 100
        similarity = max(0, min(100, round(100 * (0.55 * text_similarity + 0.25 * numeric_similarity + 0.20 * sustainability_score))))
        ranked.append(Recommendation(
            product=candidate,
            similarity_score=similarity,
            carbon_savings=calculate_carbon_saving(selected, candidate),
        ))
    return sorted(
        ranked,
        key=lambda result: (0.6 * result.product.eco_score + 0.4 * result.similarity_score),
        reverse=True,
    )[:limit]