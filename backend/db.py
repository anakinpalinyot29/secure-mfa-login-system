from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.pool import StaticPool
import os
import logging
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)

# Database connection components
DB_USER = "postgres.wcujcwjtbcqsajbmrhrw"
DB_PASSWORD = "Jedi@2911022545"
DB_HOST = "aws-1-ap-southeast-1.pooler.supabase.com"
DB_PORT = "5432"
DB_NAME = "postgres"

# URL encode the password to handle special characters
encoded_password = quote_plus(DB_PASSWORD)

# Build the connection string
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    f"postgresql://{DB_USER}:{encoded_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
)

# Connection pool configuration for security and performance
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before use
    pool_recycle=3600,   # Recycle connections every hour
    echo=False,          # Never log SQL in production
    connect_args={
        "sslmode": "require",
        "connect_timeout": 10
    } if "postgresql" in DATABASE_URL else {}
)

# Enable WAL mode for SQLite (if using SQLite)
if "sqlite" in DATABASE_URL:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency for database sessions with proper cleanup"""
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        db.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        db.close()