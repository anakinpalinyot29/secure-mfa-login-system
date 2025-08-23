import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from db import Base
import secrets

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, unique=True, index=True)
    email = Column(String(320), unique=True, index=True, nullable=False)  # RFC 5321 max length
    password_hash = Column(String(255), nullable=False)
    
    # MFA fields with encryption
    mfa_enabled = Column(Boolean, default=False, nullable=False)
    mfa_secret_encrypted = Column(Text, nullable=True)  # Encrypted TOTP secret
    mfa_backup_codes_hash = Column(Text, nullable=True)  # Hashed backup codes
    
    # Security tracking
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    account_locked_until = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_totp_used_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Email verification
    email_verified = Column(Boolean, default=False, nullable=False)
    email_verification_token = Column(String(255), nullable=True)

class SecurityEvent(Base):
    """Audit log for security events"""
    __tablename__ = "security_events"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), nullable=True)  # Can be null for failed attempts on non-existent users
    event_type = Column(String(50), nullable=False)  # login_success, login_failed, mfa_enabled, etc.
    ip_address = Column(String(45), nullable=True)  # IPv6 compatible
    user_agent = Column(Text, nullable=True)
    details = Column(Text, nullable=True)  # JSON string with additional details
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)