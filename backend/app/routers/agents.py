from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Ticket
from .. import schemas

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[schemas.UserOut])
def list_agents(db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == "agent").all()


@router.get("/me/{role}", response_model=schemas.UserOut)
def me(role: str, db: Session = Depends(get_db)):
    """Demo: returns the canonical user for a given role."""
    user = db.query(User).filter(User.role == role).first()
    if not user:
        # synthesize a placeholder so the frontend never breaks on a fresh DB
        return {
            "id": 0,
            "email": f"{role}@resolveai.app",
            "name": role.title(),
            "role": role,
            "initials": role[:2].upper(),
            "title": role.title(),
        }
    return user
