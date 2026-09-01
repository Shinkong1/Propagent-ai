from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
from config import settings

# connect_timeout: without this, a database that's unreachable/unresponsive
# (network issue, provider-side outage, connection-limit stall) leaves
# psycopg2 waiting with NO timeout and NO log output -- a real incident this
# caused: every boot attempt hung silently at the migration step (see
# alembic/env.py's matching fix) until Render's own port-scan gave up and
# killed the instance, with nothing in the logs to diagnose from. 10s is
# generous for a normal connection (including Neon's cold-start wake-up)
# but turns a genuine outage into a fast, loud, logged failure instead of an
# indefinite silent hang.
engine = create_engine(
    settings.DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20,
    connect_args={"connect_timeout": 10},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
