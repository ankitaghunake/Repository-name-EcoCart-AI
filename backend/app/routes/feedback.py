from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from ..database import get_collection, save_local_record
from ..models import Feedback
from ..repository import ProductRepository
from ..schemas import FeedbackRequest, FeedbackResponse

router = APIRouter(prefix="/feedback", tags=["Feedback"])
repository = ProductRepository()


@router.post("", response_model=FeedbackResponse, status_code=201)
def create_feedback(payload: FeedbackRequest):
    if payload.product_id and repository.get_product(payload.product_id) is None:
        raise HTTPException(status_code=404, detail="Product not found")
    feedback = Feedback(
        **payload.model_dump(),
        id=str(uuid4()),
        created_at=datetime.now(timezone.utc).isoformat(),
    )
    collection = get_collection("feedback")
    if collection is not None:
        collection.insert_one(feedback.model_dump())
    else:
        save_local_record("feedback", feedback.model_dump())
    return feedback