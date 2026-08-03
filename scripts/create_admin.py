"""Create an admin/owner user for an existing organization"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from database.base import SessionLocal, Base, engine
from models.user import User, Organization, PlanType
from middleware.auth import hash_password

def create_admin(email: str, password: str, first_name: str, last_name: str, org_name: str):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == email).first():
            print(f"User {email} already exists")
            return

        import re
        slug = re.sub(r'[^a-z0-9]+', '-', org_name.lower()).strip('-')
        while db.query(Organization).filter(Organization.slug == slug).first():
            slug += "-1"

        org = Organization(name=org_name, slug=slug, plan=PlanType.professional)
        db.add(org); db.flush()

        user = User(
            organization_id=org.id, email=email,
            hashed_password=hash_password(password),
            first_name=first_name, last_name=last_name,
            role="owner", is_active=True, is_verified=True,
        )
        db.add(user)
        db.commit()
        print(f"✅ Admin created: {email} / {password}")
        print(f"   Org: {org_name} (slug: {slug})")
    except Exception as e:
        db.rollback()
        print(f"❌ Failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--email", required=True)
    p.add_argument("--password", required=True)
    p.add_argument("--first-name", default="Admin")
    p.add_argument("--last-name", default="User")
    p.add_argument("--org", default="My Property Company")
    args = p.parse_args()
    create_admin(args.email, args.password, args.first_name, args.last_name, args.org)
