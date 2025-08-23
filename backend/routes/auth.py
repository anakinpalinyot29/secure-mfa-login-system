from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from db import get_db
from typing import Optional
from models import User
from utils.security import (
    password_validator, secure_hasher, jwt_manager, rate_limiter, 
    security_logger, totp_manager, get_current_user
)
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime, timezone, timedelta
import re

router = APIRouter()

ACCESS_TOKEN_EXPIRE_MINUTES = 15  # set your expiry here

# ---------------------------
# Request / Response Schemas
# ---------------------------

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    
    @validator('email')
    def validate_email(cls, v):
        if len(v) > 320:  # RFC 5321 limit
            raise ValueError('Email address too long')
        return v.lower()
    
    @validator('password')
    def validate_password(cls, v):
        validation = password_validator.validate_password(v)
        if not validation['valid']:
            raise ValueError('; '.join(validation['errors']))
        return v

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None
    
    @validator('email')
    def validate_email(cls, v):
        return v.lower()

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    mfa_enabled: bool
    requires_mfa: bool = False


# ---------------------------
# Routes
# ---------------------------

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    data: SignupRequest, 
    request: Request,
    db: Session = Depends(get_db)
):
    """Secure user registration with validation"""
    
    client_ip = security_logger._get_client_ip(request)
    if rate_limiter.is_rate_limited(f"signup_{client_ip}", max_attempts=3, window_minutes=60):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many registration attempts. Try again later."
        )
    
    existing_user = db.query(User).filter(User.email == data.email).first()
    if existing_user:
        security_logger.log_security_event(db, None, "signup_existing_email", request, data.email)
        rate_limiter.record_failed_attempt(f"signup_{client_ip}")
        raise HTTPException(status_code=400, detail="Registration failed")
    
    try:
        user = User(
            email=data.email,
            password_hash=secure_hasher.hash_password(data.password),
            email_verified=False
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        security_logger.log_security_event(db, str(user.id), "user_registered", request)
        
        return {"message": "Registration successful. Please verify your email."}
        
    except Exception as e:
        db.rollback()
        security_logger.logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed")

@router.post("/login", response_model=TokenResponse)
async def login(
    data: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Login with MFA support"""
    
    client_ip = security_logger._get_client_ip(request)
    
    if rate_limiter.is_rate_limited(f"login_{client_ip}", max_attempts=10, window_minutes=15):
        raise HTTPException(status_code=429, detail="Too many login attempts from this IP. Try again later.")
    
    if rate_limiter.is_rate_limited(f"login_email_{data.email}", max_attempts=5, window_minutes=15):
        raise HTTPException(status_code=429, detail="Too many login attempts for this account. Try again later.")
    
    user = db.query(User).filter(User.email == data.email).first()
    
    password_valid = False
    if user:
        password_valid = secure_hasher.verify_password(data.password, user.password_hash)
    else:
        secure_hasher.verify_password(data.password, "$2b$12$dummy.hash.to.prevent.timing.attacks")
    
    if user and user.account_locked_until and user.account_locked_until > datetime.now(timezone.utc):
        security_logger.log_security_event(db, str(user.id), "login_attempt_locked_account", request)
        raise HTTPException(status_code=423, detail="Account is temporarily locked")
    
    if not user or not password_valid:
        rate_limiter.record_failed_attempt(f"login_{client_ip}")
        rate_limiter.record_failed_attempt(f"login_email_{data.email}")
        
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.account_locked_until = datetime.now(timezone.utc) + timedelta(hours=1)
                security_logger.log_security_event(db, str(user.id), "account_locked_failed_attempts", request)
            db.commit()
            security_logger.log_security_event(db, str(user.id), "login_failed_invalid_credentials", request)
        else:
            security_logger.log_security_event(db, None, "login_failed_user_not_found", request, data.email)
        
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # ---------------------------
    # MFA Check
    # ---------------------------
    if user.mfa_enabled:
        if not data.totp_code:
            return TokenResponse(
                access_token="",
                refresh_token="",
                expires_in=0,
                mfa_enabled=True,
                requires_mfa=True
            )
        
        # Validate format
        if not data.totp_code.isdigit() or len(data.totp_code) != 6:
            raise HTTPException(status_code=422, detail="TOTP code must be 6 digits")
        
        # Verify TOTP
        if not totp_manager.verify_totp(
            user.mfa_secret_encrypted, 
            data.totp_code, 
            str(user.id),
            user.last_totp_used_at
        ):
            rate_limiter.record_failed_attempt(f"totp_{user.id}")
            security_logger.log_security_event(db, str(user.id), "login_failed_invalid_totp", request)
            raise HTTPException(status_code=401, detail="Invalid TOTP code")
        
        user.last_totp_used_at = datetime.now(timezone.utc)
    
    # ---------------------------
    # Success
    # ---------------------------
    user.failed_login_attempts = 0
    user.account_locked_until = None
    user.last_login = datetime.now(timezone.utc)
    db.commit()
    
    token_data = {"sub": str(user.id)}
    access_token = jwt_manager.create_access_token(token_data)
    refresh_token = jwt_manager.create_refresh_token(token_data)
    
    security_logger.log_security_event(db, str(user.id), "login_successful", request)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        mfa_enabled=user.mfa_enabled
    )

@router.post("/refresh")
async def refresh_token(
    refresh_token: str,
    request: Request,
    db: Session = Depends(get_db)
):
    """Refresh access token"""
    try:
        payload = jwt_manager.decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        token_data = {"sub": str(user.id)}
        new_access_token = jwt_manager.create_access_token(token_data)
        
        security_logger.log_security_event(db, str(user.id), "token_refreshed", request)
        
        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60
        }
    except Exception as e:
        security_logger.logger.error(f"Token refresh error: {e}")
        raise HTTPException(status_code=401, detail="Invalid refresh token")

@router.post("/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Logout with event logging"""
    security_logger.log_security_event(db, str(current_user.id), "user_logout", request)
    return {"message": "Successfully logged out"}
