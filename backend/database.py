import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# DATABASE_URL lets a real deployment point at a persistent-disk SQLite file
# (e.g. sqlite:////var/data/gradicai.db on Render) or a hosted Postgres
# instance instead — falls back to the local dev file with no .env changes.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./gradicai.db")

_connect_args = {"check_same_thread": False} if SQLALCHEMY_DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args=_connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

