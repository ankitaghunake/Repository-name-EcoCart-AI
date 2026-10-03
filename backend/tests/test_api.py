import unittest
from unittest.mock import patch

from app.main import app
from app.models import ProductCreate
from app.repository import read_seed_products
from app.routes import extension as extension_routes
from app.routes import products as product_routes
from app.routes.extension import ExtensionProductRequest, analyze_cart_product
from app.routes.products import create_product, list_products, score_product
from app.routes.recommendations import recommend_for_catalog_product
from app.schemas import EcoScoreRequest


class ApiTests(unittest.TestCase):
    def test_swagger_contains_required_routes(self):
        schema = app.openapi()
        for path in ("/", "/health", "/products", "/products/search/{query}",
                     "/products/category/{category}", "/eco-score", "/recommendations",
                     "/carbon-savings", "/users/register", "/users/login", "/feedback",
                     "/extension/analyze"):
            self.assertIn(path, schema["paths"])

    def test_search_and_recommendation_are_category_dynamic(self):
        response = list_products(search="denim", category="Jeans", limit=100)
        self.assertGreater(response["total"], 0)
        selected = min((item for item in read_seed_products() if item.category == "Jeans"), key=lambda item: item.eco_score)
        recommendations = recommend_for_catalog_product(selected.id, limit=3)
        self.assertTrue(recommendations["alternatives"])
        self.assertTrue(all(item.product.category == "Jeans" for item in recommendations["alternatives"]))

    def test_score_and_product_registration_calculate_score(self):
        payload = read_seed_products()[0].model_dump()
        payload["id"] = "api-test-product"
        payload["eco_score"] = 0
        request = EcoScoreRequest.model_validate(payload)
        result = score_product(request)
        self.assertGreater(result["eco_score"], 0)
        with patch.object(product_routes.repository, "get_product", return_value=None), patch.object(
            product_routes.repository, "add_product", side_effect=lambda product: product
        ):
            registered = create_product(request)
        self.assertGreater(registered.eco_score, 0)

    def test_extension_analysis_matches_existing_products_across_categories(self):
        products = read_seed_products()
        for category in sorted({item.category for item in products}):
            with self.subTest(category=category):
                selected = min(
                    (item for item in products if item.category == category),
                    key=lambda item: item.eco_score,
                )
                request = ExtensionProductRequest(
                    name=f"Men's {selected.name}",
                    category=selected.category,
                    brand=selected.brand,
                    material=selected.material,
                    source="amazon",
                )
                with patch.object(extension_routes.repository, "list_products", return_value=products):
                    result = analyze_cart_product(request)
                self.assertTrue(result["success"])
                self.assertEqual(result["matched_product"]["product_id"], selected.id)
                self.assertGreaterEqual(result["matched_product"]["similarity"], 0.65)
                self.assertTrue(result["alternatives"])
                self.assertNotIn("water_usage", result["sustainability"])
                self.assertNotIn("carbon_offset", result["sustainability"])
                self.assertTrue(all(
                    alternative["product"].category == selected.category
                    and alternative["product"].eco_score > selected.eco_score
                    for alternative in result["alternatives"]
                ))

    def test_extension_analysis_labels_low_confidence_as_closest_match(self):
        products = read_seed_products()
        request = ExtensionProductRequest(
            name="Quantum carbon-neutral titanium lantern",
            category="Jackets",
            source="amazon",
        )
        with patch.object(extension_routes.repository, "list_products", return_value=products):
            result = analyze_cart_product(request)
        self.assertTrue(result["success"])
        self.assertEqual(result["matched_product"]["confidence"], "low")
        self.assertIn("closest matching product", result["message"])


if __name__ == "__main__":
    unittest.main()