# PropAgent AI 🏢⚡

**AI-powered property management SaaS platform**

Automates tenant communication, maintenance dispatch, leasing, tenant screening, landlord lead generation, and voice call handling — using LangGraph autonomous agents, OpenAI, Twilio, and Stripe.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (Next.js · Tailwind · Vercel)                     │
│  Login / Dashboard / Properties / Tenants / Maintenance /   │
│  Leads CRM / Analytics / Voice AI / Pricing                 │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API
┌────────────────────▼────────────────────────────────────────┐
│  Backend (FastAPI · Python 3.11 · AWS ECS)                  │
│  Auth · Properties · Tenants · Maintenance · Leads ·        │
│  Billing (Stripe) · Voice (Twilio) · Screening              │
└────┬─────────────────────────────────────┬──────────────────┘
     │ LangGraph                           │ Celery
┌────▼──────────────────┐   ┌─────────────▼──────────────────┐
│  AI Agent Pipeline     │   │  Background Workers             │
│  MasterAgent           │   │  Lead scraping (daily)          │
│  MaintenanceAgent      │   │  Email campaigns                │
│  VendorDispatchAgent   │   │  Maintenance dispatch           │
│  LeasingAgent          │   │  Outreach sequences             │
│  ScreeningAgent        │   └────────────────────────────────┘
│  TenantSupportAgent    │
│  SalesAgent            │
└────────────────────────┘
     │
┌────▼──────────────────────────────────────────────────────┐
│  Infrastructure                                            │
│  PostgreSQL (AWS RDS) · Redis (Elasticache) · S3           │
└───────────────────────────────────────────────────────────┘
```

---

## Quick Start (Local Dev)

### Prerequisites
- Docker + Docker Compose
- Node.js 20+
- Python 3.11+

### 1. Clone and configure
```bash
git clone https://github.com/your-org/propagent-ai
cd propagent-ai
cp .env.example .env
# Edit .env — at minimum set OPENAI_API_KEY
```

### 2. Start all services
```bash
docker-compose up -d
```

### 3. Seed demo data
```bash
docker-compose exec backend python /app/scripts/seed_database.py
```

### 4. Access the app
- **Frontend:** http://localhost:3000
- **API Docs:** http://localhost:8000/docs
- **Demo Login:** `demo@propagent.ai` / `demo1234`

---

## Manual Setup (Without Docker)

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Start PostgreSQL and Redis, then:
uvicorn main:app --reload --port 8000
```

### Seed database
```bash
python scripts/seed_database.py
```

### Celery workers
```bash
celery -A workers.celery_app worker --loglevel=info
celery -A workers.celery_app beat --loglevel=info   # Scheduler
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # http://localhost:3000
```

---

## API Examples

### Authentication
```bash
# Signup
curl -X POST http://localhost:8000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@company.com","password":"secret123","first_name":"Jane","last_name":"Doe","organization_name":"My Properties LLC"}'

# Login
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@propagent.ai","password":"demo1234"}'
```

### AI Tenant Chat
```bash
curl -X POST http://localhost:8000/maintenance/ai-chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"My toilet is overflowing","channel":"chat"}'

# Response:
# {
#   "response": "I've created a maintenance ticket for toilet overflow...",
#   "intent": "maintenance",
#   "ticket_id": "uuid...",
#   "vendor_assigned": true,
#   "agent": "maintenance"
# }
```

### Property Management
```bash
# Create property
curl -X POST http://localhost:8000/properties/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Oak Street Apartments","address":"123 Oak St","city":"Austin","state":"TX","zip_code":"78701","property_type":"apartment","total_units":12}'

# Portfolio stats
curl http://localhost:8000/properties/stats/overview \
  -H "Authorization: Bearer $TOKEN"
```

### Tenant Screening
```bash
curl -X POST http://localhost:8000/screening/evaluate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"uuid...","annual_income":72000,"credit_score":700,"employment_status":"employed","employer":"Austin Tech"}'
```

### Lead Generation
```bash
# Trigger lead scrape
curl -X POST http://localhost:8000/leads/scrape \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"source":"google_maps","location":"Austin, TX"}'

# Queue outreach email for a lead
curl -X POST http://localhost:8000/leads/{lead_id}/outreach \
  -H "Authorization: Bearer $TOKEN"
```

---

## AI Agent Workflow

### Maintenance Example
```
Tenant message: "My heater is broken"
         ↓
MasterAgent  →  detects intent: "maintenance" (0.94 confidence)
         ↓
MaintenanceAgent  →  classifies: category=hvac, priority=high
                  →  creates MaintenanceTicket in DB
                  →  generates tenant-facing response
         ↓
VendorDispatchAgent  →  finds preferred HVAC vendor
                     →  assigns vendor to ticket
                     →  sets vendor_notified=True
         ↓
Response: "I've created a maintenance ticket for your HVAC issue.
          This is flagged as high priority. An HVAC specialist
          has been assigned and will contact you shortly."
```

### Voice Call Flow
```
Tenant calls Twilio number
         ↓
POST /voice/incoming  →  TwiML: "Please describe your request..."
         ↓
Tenant speaks  →  POST /voice/gather
         ↓
Speech-to-text (Twilio Enhanced)
         ↓
process_voice_input()  →  agents/graph.py
         ↓
Same LangGraph pipeline as chat
         ↓
Text-to-speech via Twilio Polly.Joanna voice
         ↓
"I've created a maintenance ticket and notified a plumber."
```

---

## Deployment

### Frontend → Vercel
```bash
cd frontend
npx vercel --prod
# Set env: NEXT_PUBLIC_API_URL=https://api.propagent.ai
```

### Backend → AWS ECS
```bash
# Build and push Docker image
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_URI
docker build -f infra/docker/backend.Dockerfile -t $ECR_URI:latest .
docker push $ECR_URI:latest

# Deploy via Terraform
cd infra/terraform
terraform init
terraform plan -var="db_password=$DB_PASS" -var="openai_key=$OPENAI_KEY"
terraform apply
```

### Twilio Voice Setup
1. Buy a Twilio phone number
2. Set webhook: `https://api.propagent.ai/voice/incoming` (HTTP POST)
3. Status callback: `https://api.propagent.ai/voice/status`

### Stripe Setup
1. Create 3 Products (Starter $49, Professional $149, Enterprise $499)
2. Copy Price IDs to `.env`
3. Set webhook endpoint: `https://api.propagent.ai/billing/webhook`
4. Enable event: `checkout.session.completed`

---

## SaaS Plans

| Feature              | Starter ($49) | Professional ($149) | Enterprise ($499) |
|---------------------|:---:|:---:|:---:|
| Properties          | 3   | 15  | ∞   |
| Units               | 25  | 150 | ∞   |
| AI Chat             | ✅  | ✅  | ✅  |
| Voice AI            | ❌  | ✅  | ✅  |
| Lead Generation     | ❌  | ✅  | ✅  |
| Automated Outreach  | ❌  | ✅  | ✅  |
| AI Calls/mo         | 100 | 1,000 | ∞ |
| Support             | Email | Priority | Dedicated CSM |

---

## Running Tests
```bash
# Backend + agent tests
pip install pytest pytest-asyncio
pytest tests/ -v

# Frontend type-check
cd frontend && npx tsc --noEmit
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, Recharts |
| Backend | FastAPI, Python 3.11, SQLAlchemy, Alembic |
| AI Agents | LangGraph, LangChain, OpenAI GPT-4o |
| Voice | Twilio Voice API, Polly TTS, Enhanced STT |
| Workers | Celery, Redis |
| Database | PostgreSQL 15 (AWS RDS) |
| Cache | Redis 7 (AWS Elasticache) |
| Payments | Stripe Subscriptions |
| Infra | Docker, AWS ECS Fargate, Terraform |
| Deploy | Vercel (frontend), AWS (backend) |

---

Built with ❤️ by Morningstar · PropAgent AI © 2024
