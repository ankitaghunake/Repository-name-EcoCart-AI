"""MongoDB connection management for the ecocart database."""

import os
import json
from pathlib import Path
from threading import Lock

from pymongo import MongoClient
from pymongo.database import Database

DATABASE_NAME = "ecocart"
COLLECTION_NAMES = ("products", "users", "feedback")

_client: MongoClient | None = None
_database: Database | None = None
_local_data = Path(__file__).resolve().parents[1] / "data"
_local_lock = Lock()


def connect_to_mongodb() -> bool:
    global _client, _database
    uri = os.getenv("MONGODB_URI", "").strip()
    if not uri:
        return False
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=2500)
        client.admin.command("ping")
        _client = client
        _database = client[DATABASE_NAME]
        for collection_name, field in (("products", "id"), ("users", "email")):
            _database[collection_name].create_index(field, unique=True)
        return True
    except Exception as error:
        print(f"MongoDB unavailable ({type(error).__name__}); using local storage.")
        return False


def get_database() -> Database | None:
    return _database


def get_collection(name: str):
    if name not in COLLECTION_NAMES:
        raise ValueError(f"Unknown Eco-Cart collection: {name}")
    if _database is None:
        return None
    return _database[name]


def load_local_records(collection_name: str) -> list[dict]:
    if collection_name not in COLLECTION_NAMES:
        raise ValueError(f"Unknown Eco-Cart collection: {collection_name}")
    path = _local_data / f"{collection_name}.json"
    if not path.exists():
        return []
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def save_local_record(collection_name: str, record: dict, unique_field: str = "id") -> None:
    if collection_name not in COLLECTION_NAMES:
        raise ValueError(f"Unknown Eco-Cart collection: {collection_name}")
    path = _local_data / f"{collection_name}.json"
    with _local_lock:
        records = load_local_records(collection_name)
        if any(item.get(unique_field) == record.get(unique_field) for item in records):
            raise ValueError("A record with this value already exists")
        records.append(record)
        with path.open("w", encoding="utf-8") as file:
            json.dump(records, file, indent=2)


def close_database() -> None:
    global _client, _database
    if _client is not None:
        _client.close()
    _client = None
    _database = None