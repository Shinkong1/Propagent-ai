from pydantic import BaseModel
from typing import List


class ImportRowError(BaseModel):
    row: int  # 1-indexed, counting the header row as row 1 so it matches what a user sees in a spreadsheet
    reason: str


class ImportResult(BaseModel):
    created: int
    skipped: int
    errors: List[ImportRowError]
