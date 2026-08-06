"""Public, unauthenticated serving of site-verification files uploaded via
the Owner Admin (see the /admin/verification-files endpoints in routes/admin.py).
Separate router from admin.py on purpose: this one has no require_master gate --
Google/Bing/etc. need to fetch these anonymously to confirm domain ownership."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from fastapi import Depends

from database.session import get_db
from models.platform import SiteVerificationFile

router = APIRouter(tags=["verification"])


@router.get("/public/verification/{filename}", response_class=PlainTextResponse)
async def get_verification_file(filename: str, db: Session = Depends(get_db)):
    record = db.query(SiteVerificationFile).filter(SiteVerificationFile.filename == filename).first()
    if not record:
        raise HTTPException(status_code=404, detail="Not found")
    return PlainTextResponse(content=record.content, media_type="text/html")
