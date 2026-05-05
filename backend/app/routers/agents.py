from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..auth import get_current_user, require_staff
from ..database import get_db
from ..models import User
from .. import schemas

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.get("", response_model=list[schemas.UserOut])
def list_agents(
    db: Session = Depends(get_db),
    _: User = Depends(require_staff),
):
    return db.query(User).filter(User.role == "agent").all()


@router.get("/me", response_model=schemas.UserOut)
def me(user: User = Depends(get_current_user)):
    """Return the currently authenticated user."""
    return user
