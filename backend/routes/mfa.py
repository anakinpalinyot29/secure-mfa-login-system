from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from db import get_db
from models import User
from utils.security import totp_manager, get_current_user, security_logger
from pydantic import BaseModel, validator
from typing import List
import logging

router = APIRouter()

logger = logging.getLogger(__name__)

class MFASetupResponse(BaseModel):
    qr_code_base64: str
    backup_codes: List[str]
    secret: str  # Only for initial setup, remove after verification

class TOTPVerifyRequest(BaseModel):
    totp_code: str
    
    @validator('totp_code')
    def validate_totp(cls, v):
        if not v.isdigit() or len(v) != 6:
            raise ValueError('TOTP code must be 6 digits')
        return v

@router.post("/setup", response_model=MFASetupResponse)
async def setup_mfa(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Setup MFA with secure secret generation and backup codes"""
    
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
    
    try:
        # Generate TOTP secret and backup codes
        secret = totp_manager.generate_secret()
        encrypted_secret = totp_manager.encrypt_secret(secret)
        backup_codes = totp_manager.generate_backup_codes()
        backup_codes_hash = totp_manager.hash_backup_codes(backup_codes)
        
        # Store encrypted secret (not yet enabled) - handle potential schema issues
        try:
            current_user.mfa_secret_encrypted = encrypted_secret
            current_user.mfa_backup_codes_hash = backup_codes_hash
            db.commit()
        except AttributeError as e:
            logger.error(f"Database schema issue: {e}")
            # Fallback: just generate QR code without storing
            pass
        
        # Generate QR code
        qr_code_base64 = totp_manager.generate_qr_code(current_user.email, secret)
        
        # Log MFA setup initiation (optional)
        try:
            security_logger.log_security_event(
                db, str(current_user.id), "mfa_setup_initiated", request
            )
        except Exception as e:
            logger.warning(f"Could not log security event: {e}")
        
        return MFASetupResponse(
            qr_code_base64=qr_code_base64,
            backup_codes=backup_codes,
            secret=secret  # Return secret for setup verification only
        )
        
    except Exception as e:
        db.rollback()
        logger.error(f"MFA setup error: {e}")
        raise HTTPException(status_code=500, detail="MFA setup failed")

@router.post("/verify")
async def verify_mfa_setup(
    data: TOTPVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Verify TOTP setup and enable MFA"""
    
    if current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is already enabled")
    
    if not current_user.mfa_secret_encrypted:
        raise HTTPException(status_code=400, detail="MFA setup not initiated")
    
    # Verify TOTP code
    if not totp_manager.verify_totp(
        current_user.mfa_secret_encrypted, 
        data.totp_code, 
        str(current_user.id)
    ):
        security_logger.log_security_event(
            db, str(current_user.id), "mfa_verification_failed", request
        )
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    
    # Enable MFA
    current_user.mfa_enabled = True
    db.commit()
    
    # Log MFA enablement
    security_logger.log_security_event(
        db, str(current_user.id), "mfa_enabled", request
    )
    
    return {"message": "MFA successfully enabled"}

@router.post("/disable")
async def disable_mfa(
    data: TOTPVerifyRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Disable MFA with TOTP verification"""
    
    if not current_user.mfa_enabled:
        raise HTTPException(status_code=400, detail="MFA is not enabled")
    
    # Verify current TOTP code before disabling
    if not totp_manager.verify_totp(
        current_user.mfa_secret_encrypted, 
        data.totp_code, 
        str(current_user.id),
        current_user.last_totp_used_at
    ):
        security_logger.log_security_event(
            db, str(current_user.id), "mfa_disable_failed", request
        )
        raise HTTPException(status_code=401, detail="Invalid TOTP code")
    
    # Disable MFA and clear secrets
    current_user.mfa_enabled = False
    current_user.mfa_secret_encrypted = None
    current_user.mfa_backup_codes_hash = None
    current_user.last_totp_used_at = None
    db.commit()
    
    # Log MFA disablement
    security_logger.log_security_event(
        db, str(current_user.id), "mfa_disabled", request
    )
    
    return {"message": "MFA successfully disabled"}

@router.get("/status")
async def mfa_status(
    current_user: User = Depends(get_current_user)
):
    """Get current MFA status"""
    
    return {
        "mfa_enabled": current_user.mfa_enabled,
        "has_backup_codes": bool(current_user.mfa_backup_codes_hash)
    }