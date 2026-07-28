from fastapi import FastAPI, APIRouter
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List
import uuid
from datetime import datetime, timezone
import stripe


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
stripe_api_key = os.environ.get('STRIPE_API_KEY')
stripe_price_id = os.environ.get('STRIPE_PRICE_ID')  # recurring price ID for the subscription
if stripe_api_key:
    stripe.api_key = stripe_api_key

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}


# Create a Stripe Checkout session for subscription with a 3-day trial.
class CheckoutCreate(BaseModel):
    email: str


@api_router.post("/create-checkout-session")
async def create_checkout_session(input: CheckoutCreate):
    if not stripe.api_key:
        return {"error": "Stripe not configured"}

    if not stripe_price_id:
        return {"error": "Missing STRIPE_PRICE_ID"}

    # Create or find customer by email
    customers = stripe.Customer.list(email=input.email, limit=1).data
    if customers:
        customer = customers[0]
    else:
        customer = stripe.Customer.create(email=input.email)

    session = stripe.checkout.Session.create(
        customer=customer.id,
        mode='subscription',
        line_items=[{
            'price': stripe_price_id,
            'quantity': 1,
        }],
        subscription_data={
            'trial_period_days': 3
        },
        success_url=os.environ.get('SUBSCRIPTION_SUCCESS_URL', 'https://cbat-academy.com/success'),
        cancel_url=os.environ.get('SUBSCRIPTION_CANCEL_URL', 'https://cbat-academy.com/cancel'),
    )

    return {'url': session.url}


# Webhook endpoint to receive Stripe events (e.g., subscription created)
@api_router.post('/webhook')
async def stripe_webhook(request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')

    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except Exception as e:
            return {"error": str(e)}
    else:
        # If no webhook secret is set, parse unsafely
        event = None

    # Handle relevant events
    if event and event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        # TODO: persist subscription info to DB or update user record

    return {"received": True}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()