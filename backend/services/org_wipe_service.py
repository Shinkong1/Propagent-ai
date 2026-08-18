"""Permanently erase an organization's operational data -- built for
one-time cleanup of test/demo orgs and test records left over from
building this platform, and kept as a real admin capability afterward
(e.g. resetting a test org between QA passes).

Deletes in dependency order (children before parents) so it works
against plain Postgres foreign keys with no ON DELETE CASCADE configured
-- getting this order wrong throws an IntegrityError, which aborts the
whole transaction cleanly (nothing partially deleted) rather than
corrupting data.
"""
import logging
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def wipe_organization_data(db: Session, org_id) -> dict:
    """Delete every row belonging to this organization EXCEPT the
    Organization row and its User accounts. Caller commits (or rolls
    back on exception) -- this function only stages deletes on `db`."""
    from models.inspection import Inspection, InspectionPhoto
    from models.collections import CollectionsAction
    from models.accounting import RentPayment, Expense
    from models.tenant import Lease, Tenant
    from models.lead import Lead, Conversation, OutreachEmail
    from models.voice_call import VoiceCall
    from models.communication import CommunicationLog
    from models.maintenance import MaintenanceTicket, Vendor
    from models.compliance import ComplianceItem
    from models.document import Document
    from models.inquiry import RentalInquiry
    from models.workflow import WorkflowRule
    from models.owner_message import OwnerMessage
    from models.platform import AICallLog, OrganizationEvent
    from models.property import Property, Unit
    from models.social_connection import SocialConnection, SocialPost, SocialPostDraft

    property_ids = [r[0] for r in db.query(Property.id).filter(Property.organization_id == org_id).all()]
    unit_ids = [r[0] for r in db.query(Unit.id).join(Property).filter(Property.organization_id == org_id).all()]
    tenant_ids = [r[0] for r in db.query(Tenant.id).filter(Tenant.organization_id == org_id).all()]
    lease_ids = [r[0] for r in db.query(Lease.id).filter(Lease.tenant_id.in_(tenant_ids)).all()] if tenant_ids else []
    inspection_ids = [r[0] for r in db.query(Inspection.id).filter(Inspection.organization_id == org_id).all()]
    lead_ids = [r[0] for r in db.query(Lead.id).filter(Lead.organization_id == org_id).all()]
    rent_payment_ids = [r[0] for r in db.query(RentPayment.id).filter(RentPayment.lease_id.in_(lease_ids)).all()] if lease_ids else []

    counts = {}

    def _del(label, query):
        counts[label] = query.delete(synchronize_session=False)

    # Leaves
    if inspection_ids:
        _del('inspection_photos', db.query(InspectionPhoto).filter(InspectionPhoto.inspection_id.in_(inspection_ids)))
    if rent_payment_ids:
        _del('collections_actions', db.query(CollectionsAction).filter(CollectionsAction.rent_payment_id.in_(rent_payment_ids)))
    if lead_ids:
        _del('outreach_emails', db.query(OutreachEmail).filter(OutreachEmail.lead_id.in_(lead_ids)))
    # social_posts references both social_connections and properties -- must
    # go before either. Added when the social-posting feature (and later the
    # draft queue) landed after this file was written; missing this was a
    # real regression -- any org that had connected a social account or
    # saved a draft would hit an IntegrityError on wipe/delete, breaking
    # POST /admin/demo-org/seed the moment the demo org touched Social.
    _del('social_posts', db.query(SocialPost).filter(SocialPost.organization_id == org_id))
    _del('social_post_drafts', db.query(SocialPostDraft).filter(SocialPostDraft.organization_id == org_id))

    # Depend only on leaves / org id
    _del('inspections', db.query(Inspection).filter(Inspection.organization_id == org_id))
    if lease_ids:
        _del('rent_payments', db.query(RentPayment).filter(RentPayment.lease_id.in_(lease_ids)))
    if tenant_ids:
        _del('conversations', db.query(Conversation).filter(Conversation.tenant_id.in_(tenant_ids)))
    _del('voice_calls', db.query(VoiceCall).filter(VoiceCall.organization_id == org_id))
    _del('communication_logs', db.query(CommunicationLog).filter(CommunicationLog.organization_id == org_id))
    _del('ai_call_logs', db.query(AICallLog).filter(AICallLog.organization_id == org_id))
    _del('owner_messages', db.query(OwnerMessage).filter(OwnerMessage.organization_id == org_id))
    _del('org_events', db.query(OrganizationEvent).filter(OrganizationEvent.organization_id == org_id))
    _del('workflow_rules', db.query(WorkflowRule).filter(WorkflowRule.organization_id == org_id))
    # Safe now: social_posts (the only referencer) is already gone.
    _del('social_connections', db.query(SocialConnection).filter(SocialConnection.organization_id == org_id))

    # Depend on the above
    if lease_ids:
        _del('leases', db.query(Lease).filter(Lease.id.in_(lease_ids)))
    _del('leads', db.query(Lead).filter(Lead.organization_id == org_id))
    if property_ids:
        _del('maintenance_tickets', db.query(MaintenanceTicket).filter(MaintenanceTicket.property_id.in_(property_ids)))
    _del('compliance_items', db.query(ComplianceItem).filter(ComplianceItem.organization_id == org_id))
    _del('documents', db.query(Document).filter(Document.organization_id == org_id))
    if property_ids:
        _del('expenses', db.query(Expense).filter(Expense.property_id.in_(property_ids)))
    _del('rental_inquiries', db.query(RentalInquiry).filter(RentalInquiry.organization_id == org_id))

    # Now safe: nothing above still references tenants/vendors
    _del('tenants', db.query(Tenant).filter(Tenant.organization_id == org_id))
    _del('vendors', db.query(Vendor).filter(Vendor.organization_id == org_id))

    # Now safe: nothing above still references units
    if unit_ids:
        _del('units', db.query(Unit).filter(Unit.id.in_(unit_ids)))

    # Now safe: nothing above still references properties
    _del('properties', db.query(Property).filter(Property.organization_id == org_id))

    logger.info(f"Wiped organization {org_id} data: {counts}")
    return counts


def delete_organization(db: Session, org_id) -> dict:
    """Full teardown: wipe all data, then delete the org's User accounts
    and the Organization row itself. Irreversible."""
    from models.user import User, Organization

    counts = wipe_organization_data(db, org_id)

    # Clear inbound self-references (other orgs that list this one as
    # their referrer) before deleting the row, or the FK rejects it.
    db.query(Organization).filter(Organization.referred_by_org_id == org_id).update(
        {Organization.referred_by_org_id: None}, synchronize_session=False
    )

    counts['users'] = db.query(User).filter(User.organization_id == org_id).delete(synchronize_session=False)
    counts['organization'] = db.query(Organization).filter(Organization.id == org_id).delete(synchronize_session=False)

    logger.info(f"Deleted organization {org_id}: {counts}")
    return counts
