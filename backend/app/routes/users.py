import hashlib
import hmac
import secrets
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status

from ..database import get_collection, load_local_records, save_local_record
from ..models import User
from ..schemas import UserLoginRequest, UserRegisterRequest, UserResponse

router = APIRouter(prefix="/users", tags=["Users"])
ITERATIONS = 310_000


def _hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        algorithm, iterations, salt, expected = stored.split("$")
        if algorithm != "pbkdf2_sha256":
            return False
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), int(iterations))
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, TypeError):
        return False


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(payload: UserRegisterRequest):
    email = str(payload.email).lower()
    collection = get_collection("users")
    existing = collection.find_one({"email": email}) if collection is not None else next(
        (item for item in load_local_records("users") if item["email"] == email), None
    )
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    user = User(id=str(uuid4()), name=payload.name.strip(), email=email, password_hash=_hash_password(payload.password))
    if collection is not None:
        try:
            collection.insert_one(user.model_dump())
        except Exception as error:
            raise HTTPException(status_code=409, detail="An account with this email already exists") from error
    else:
        try:
            save_local_record("users", user.model_dump(), unique_field="email")
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error
    return UserResponse(id=user.id, name=user.name, email=user.email)


@router.post("/login", response_model=UserResponse)
def login_user(payload: UserLoginRequest):
    email = str(payload.email).lower()
    collection = get_collection("users")
    record = collection.find_one({"email": email}) if collection is not None else next(
        (item for item in load_local_records("users") if item["email"] == email), None
    )
    if not record or not _verify_password(payload.password, record.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    return UserResponse(id=record["id"], name=record["name"], email=record["email"])