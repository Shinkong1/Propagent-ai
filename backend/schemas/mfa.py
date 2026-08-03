from pydantic import BaseModel


class MFASetupResponse(BaseModel):
    secret: str
    provisioning_uri: str
    qr_code_base64: str  # data URI — embed directly in an <img src="...">


class MFACodeRequest(BaseModel):
    code: str


class MFADisableRequest(BaseModel):
    password: str
    code: str


class MFAStatusResponse(BaseModel):
    mfa_enabled: bool


class MFAChallengeResponse(BaseModel):
    mfa_required: bool = True
    mfa_token: str


class MFALoginVerifyRequest(BaseModel):
    mfa_token: str
    code: str
