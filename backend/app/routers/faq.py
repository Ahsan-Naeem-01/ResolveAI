from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import FAQ
from ..schemas import FAQOut

router = APIRouter(prefix="/api/faq", tags=["faq"])


@router.get("", response_model=list[FAQOut])
def list_faqs(intent: str | None = Query(None), db: Session = Depends(get_db)):
    q = db.query(FAQ)
    if intent:
        q = q.filter(FAQ.intent == intent)
    return q.all()
