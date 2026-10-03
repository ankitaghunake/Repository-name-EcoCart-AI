import unittest

from app.models import Product, PRODUCT_CATEGORIES
from app.recommendations import find_recommendations
from app.scoring import calculate_eco_score, with_calculated_score
from app.repository import read_seed_products


class SustainabilityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.products = read_seed_products()

    def test_score_is_bounded_and_rewards_sustainable_inputs(self):
        scores = [calculate_eco_score(item)["eco_score"] for item in self.products]
        self.assertTrue(all(0 <= score <= 100 for score in scores))
        organic = next(item for item in self.products if item.id == "tee-organic-01")
        conventional = next(item for item in self.products if item.id == "tee-classic-02")
        self.assertGreater(organic.eco_score, conventional.eco_score)

    def test_every_clothing_category_has_a_greener_recommendation(self):
        for category in PRODUCT_CATEGORIES:
            with self.subTest(category=category):
                selected = min(
                    (item for item in self.products if item.category == category),
                    key=lambda item: item.eco_score,
                )
                alternatives = find_recommendations(selected, self.products)
                self.assertTrue(alternatives)
                self.assertTrue(all(item.product.category == category for item in alternatives))
                self.assertTrue(all(item.product.eco_score > selected.eco_score for item in alternatives))

    def test_recyclability_and_eco_score_ranges_are_valid(self):
        for item in self.products:
            validated = Product.model_validate(item.model_dump())
            self.assertGreaterEqual(validated.recyclability_rate, 0)
            self.assertLessEqual(validated.eco_score, 100)


if __name__ == "__main__":
    unittest.main()