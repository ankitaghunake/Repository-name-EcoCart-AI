"""Import the CSV clothing catalog into MongoDB's ecocart.products collection."""

import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient, ReplaceOne

from app.database import DATABASE_NAME
from app.repository import read_seed_products

load_dotenv(Path(__file__).resolve().parent / ".env")


def seed_database() -> int:
    uri = os.getenv("MONGODB_URI", "").strip()
    if not uri:
        raise RuntimeError("Set MONGODB_URI in backend/.env before seeding MongoDB")
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    try:
        client.admin.command("ping")
        collection = client[DATABASE_NAME]["products"]
        collection.create_index("id", unique=True)
        products = read_seed_products()
        operations = [
            ReplaceOne({"id": product.id}, product.model_dump(), upsert=True)
            for product in products
        ]
        if operations:
            collection.bulk_write(operations, ordered=False)
        return len(products)
    finally:
        client.close()


if __name__ == "__main__":
    print(f"Seeded {seed_database()} clothing products into ecocart.products")