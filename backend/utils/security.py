import bcrypt
import jwt
import pyotp
import qrcode
import io
import base64
import os
import secrets
import hashlib
import hmac
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from cryptography.fernet import Fernet
from db import get_db
from models import User, SecurityEvent
import logging
from collections import defaultdict
import time
from dotenv import load_dotenv
import os

load_dotenv()  # โหลดตัวแปรจาก .env
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
if not JWT_SECRET_KEY or len(JWT_SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be set and at least 32 characters long")

logger = logging.getLogger(__name__)

# Configuration from environment variables
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY or len(SECRET_KEY) < 32:
    raise ValueError("JWT_SECRET_KEY must be set and at least 32 characters long")

TOTP_ENCRYPTION_KEY = os.environ.get("TOTP_ENCRYPTION_KEY")
if not TOTP_ENCRYPTION_KEY:
    raise ValueError("TOTP_ENCRYPTION_KEY must be set")

fernet = Fernet(TOTP_ENCRYPTION_KEY.encode())

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7"))

# Rate limiting storage (use Redis in production)
failed_attempts = defaultdict(list)
totp_attempts = defaultdict(list)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

class PasswordValidator:
    """Secure password validation"""
    
    @staticmethod
    def validate_password(password: str) -> Dict[str, Any]:
        errors = []
        
        if len(password) < 12:
            errors.append("Password must be at least 12 characters long")
        
        if not any(c.isupper() for c in password):
            errors.append("Password must contain at least one uppercase letter")
        
        if not any(c.islower() for c in password):
            errors.append("Password must contain at least one lowercase letter")
        
        if not any(c.isdigit() for c in password):
            errors.append("Password must contain at least one digit")
        
        if not any(c in "!@#$%^&*()_+-=[]{}|;:,.<>?" for c in password):
            errors.append("Password must contain at least one special character")
        
        # Check for common passwords (implement your own list)
        common_passwords = ["password123", "123456789", "qwerty123"]
        if password.lower() in common_passwords:
            errors.append("Password is too common")
        
        return {"valid": len(errors) == 0, "errors": errors}

class SecureHasher:
    """Secure password hashing with bcrypt"""
    
    @staticmethod
    def hash_password(password: str) -> str:
        # Use cost factor of 12 (2^12 = 4096 rounds)
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')
    
    @staticmethod
    def verify_password(plain_password: str, hashed_password: str) -> bool:
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except Exception as e:
            logger.error(f"Password verification error: {e}")
            return False

class TOTPManager:
    """Secure TOTP management with encryption"""
    
    def __init__(self):
        self.fernet = Fernet(TOTP_ENCRYPTION_KEY.encode())
    
    def generate_secret(self) -> str:
        """Generate cryptographically secure TOTP secret"""
        return pyotp.random_base32()
    
    def encrypt_secret(self, secret: str) -> str:
        """Encrypt TOTP secret for storage"""
        return self.fernet.encrypt(secret.encode()).decode()
    
    def decrypt_secret(self, encrypted_secret: str) -> str:
        """Decrypt TOTP secret"""
        try:
            return self.fernet.decrypt(encrypted_secret.encode()).decode()
        except Exception as e:
            logger.error(f"TOTP secret decryption error: {e}")
            raise HTTPException(status_code=500, detail="Internal server error")
    
    def verify_totp(self, encrypted_secret: str, code: str, user_id: str, last_used: Optional[datetime] = None) -> bool:
        """Verify TOTP with replay attack prevention"""
        if not code.isdigit() or len(code) != 6:
            return False
        
        # Rate limiting for TOTP attempts
        now = time.time()
        user_attempts = totp_attempts[user_id]
        # Remove attempts older than 5 minutes
        user_attempts[:] = [attempt for attempt in user_attempts if now - attempt < 300]
        
        if len(user_attempts) >= 5:  # Max 5 attempts per 5 minutes
            logger.warning(f"TOTP rate limit exceeded for user {user_id}")
            return False
        
        user_attempts.append(now)
        
        try:
            secret = self.decrypt_secret(encrypted_secret)
            totp = pyotp.TOTP(secret)
            
            # Check for replay attacks
            if last_used and self._is_recent_use(last_used):
                logger.warning(f"Potential TOTP replay attack for user {user_id}")
                return False
            
            # Verify with 1 window tolerance (30 seconds before/after)
            return totp.verify(code, valid_window=1)
        
        except Exception as e:
            logger.error(f"TOTP verification error: {e}")
            return False
    
    def _is_recent_use(self, last_used: datetime) -> bool:
        """Check if TOTP was used recently (replay attack prevention)"""
        if not last_used:
            return False
        
        time_diff = datetime.now(timezone.utc) - last_used.replace(tzinfo=timezone.utc)
        return time_diff < timedelta(seconds=90)  # 90 second window
    
    def generate_qr_code(self, email: str, secret: str, issuer: str = "SecureApp") -> str:
        """Generate QR code for TOTP setup"""
        uri = pyotp.totp.TOTP(secret).provisioning_uri(
            name=email,
            issuer_name=issuer
        )
        
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(uri)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        
        return base64.b64encode(buf.getvalue()).decode()
    
    def generate_backup_codes(self, count: int = 10) -> List[str]:
        """Generate backup recovery codes"""
        return [secrets.token_hex(4).upper() for _ in range(count)]
    
    def hash_backup_codes(self, codes: List[str]) -> str:
        """Hash backup codes for secure storage"""
        codes_string = ",".join(sorted(codes))
        return hashlib.sha256(codes_string.encode()).hexdigest()

class JWTManager:
    """Secure JWT token management"""
    
    @staticmethod
    def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.now(timezone.utc) + expires_delta
        else:
            expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "access"
        })
        
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def create_refresh_token(data: Dict[str, Any]) -> str:
        to_encode = data.copy()
        expire = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
        
        to_encode.update({
            "exp": expire,
            "iat": datetime.now(timezone.utc),
            "type": "refresh"
        })
        
        return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    @staticmethod
    def decode_token(token: str) -> Dict[str, Any]:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=401, detail="Token expired")
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")

class RateLimiter:
    """Rate limiting for authentication attempts"""
    
    @staticmethod
    def is_rate_limited(identifier: str, max_attempts: int = 5, window_minutes: int = 15) -> bool:
        now = time.time()
        attempts = failed_attempts[identifier]
        
        # Clean old attempts
        window_seconds = window_minutes * 60
        attempts[:] = [attempt for attempt in attempts if now - attempt < window_seconds]
        
        return len(attempts) >= max_attempts
    
    @staticmethod
    def record_failed_attempt(identifier: str):
        failed_attempts[identifier].append(time.time())

class SecurityLogger:
    """Security event logging"""
    
    @staticmethod
    def log_security_event(
        db: Session,
        user_id: Optional[str],
        event_type: str,
        request: Request,
        details: Optional[str] = None
    ):
        try:
            event = SecurityEvent(
                user_id=user_id,
                event_type=event_type,
                ip_address=SecurityLogger._get_client_ip(request),
                user_agent=request.headers.get("User-Agent"),
                details=details
            )
            db.add(event)
            db.commit()
        except Exception as e:
            logger.error(f"Failed to log security event: {e}")
    
    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """Extract real client IP considering proxies"""
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        return request.client.host if request.client else "unknown"

# Dependency instances
password_validator = PasswordValidator()
secure_hasher = SecureHasher()
totp_manager = TOTPManager()
jwt_manager = JWTManager()
rate_limiter = RateLimiter()
security_logger = SecurityLogger()

def get_current_user(
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
) -> User:
    """Get current authenticated user with comprehensive validation"""
    try:
        payload = jwt_manager.decode_token(token)
        
        # Validate token type
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        # Check if account is locked
        if user.account_locked_until and user.account_locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=423, detail="Account is temporarily locked")
        
        return user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token validation error: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")