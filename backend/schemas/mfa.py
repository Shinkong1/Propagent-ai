from typing import List
from pydantic import BaseModel


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str  # data URI — embed directly in an <img src="...">


class MFACodeRequest(BaseModel):
    code: str


class MFAVerifyResponse(BaseModel):
    mfa_enabled: bool
    backup_codes: List[str] = []  # shown once, at the moment MFA is confirmed enabled -- never retrievable again


class MFADisableRequest(BaseModel):
    password: str
    code: str


class MFARegenerateBackupCodesRequest(BaseModel):
    password: str


class MFAStatusResponse(BaseModel):
    mfa_enabled: bool
    backup_codes_remaining: int = 0


class MFAChallengeResponse(BaseModel):
    mfa_required: bool = True
    mfa_token: str


class MFALoginVerifyRequest(BaseModel):
    mfa_token: str
    code: str
