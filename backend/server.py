from fastapi import FastAPI, APIRouter, Request, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
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


class SubscriptionInfo(BaseModel):
    subscription_id: str
    customer_id: str
    customer_email: Optional[str] = None
    status: str
    current_period_end: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    price_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

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
        success_url=os.environ.get('SUBSCRIPTION_SUCCESS_URL', 'https://cbat-academy.com/subscription/success'),
        cancel_url=os.environ.get('SUBSCRIPTION_CANCEL_URL', 'https://cbat-academy.com/subscription/cancel'),
    )

    return {'url': session.url}


# Webhook endpoint to receive Stripe events (e.g., subscription created)
@api_router.post('/webhook')
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    webhook_secret = os.environ.get('STRIPE_WEBHOOK_SECRET')

    event = None
    if webhook_secret:
        try:
            event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
        except Exception as e:
            return HTTPException(status_code=400, detail=f"Webhook signature verification failed: {e}")
    else:
        # Try to parse JSON without verification (not recommended for production)
        try:
            event = stripe.Event.construct_from(request.json(), stripe.api_key)
        except Exception:
            event = None

    if not event:
        return {"received": True}

    etype = event.get('type')
    data = event.get('data', {}).get('object', {})

    # Handle checkout.session.completed
    if etype == 'checkout.session.completed':
        session = data
        # session may contain subscription id and customer id
        subscription_id = session.get('subscription')
        customer_id = session.get('customer')
        customer_email = session.get('customer_details', {}).get('email') or session.get('customer_email')

        if customer_id and customer_email:
            await upsert_customer(customer_email, customer_id)

        if subscription_id:
            # Retrieve subscription from Stripe to get details
            try:
                sub = stripe.Subscription.retrieve(subscription_id, expand=['items'])
                await save_subscription_record(sub, customer_email)
            except Exception:
                pass

    # Handle subscription updates
    if etype in ('customer.subscription.updated', 'customer.subscription.created'):
        sub = data
        # Try to get customer email from customer object if present
        customer_email = None
        try:
            cust = stripe.Customer.retrieve(sub.get('customer'))
            customer_email = cust.get('email')
        except Exception:
            pass
        await save_subscription_record(sub, customer_email)

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


async def upsert_customer(email: str, customer_id: str):
    now = datetime.now(timezone.utc)
    await db.customers.update_one(
        {"customer_id": customer_id},
        {"$set": {"email": email, "customer_id": customer_id, "updated_at": now}},
        upsert=True,
    )


async def save_subscription_record(sub: dict, customer_email: Optional[str] = None):
    # Normalize subscription dict fields
    doc = {
        "subscription_id": sub.get("id"),
        "customer_id": sub.get("customer"),
        "customer_email": customer_email,
        "status": sub.get("status"),
        "current_period_end": None,
        "trial_end": None,
        "price_id": None,
        "created_at": datetime.now(timezone.utc),
    }

    # Extract timestamps
    if sub.get("current_period_end"):
        try:
            doc["current_period_end"] = datetime.fromtimestamp(int(sub.get("current_period_end")), timezone.utc)
        except Exception:
            pass
    if sub.get("trial_end"):
        try:
            doc["trial_end"] = datetime.fromtimestamp(int(sub.get("trial_end")), timezone.utc)
        except Exception:
            pass

    # Try to infer price id
    items = sub.get("items") or {}
    try:
        data = items.get("data") if isinstance(items, dict) else []
        if data and isinstance(data, list):
            price = data[0].get("price") or {}
            doc["price_id"] = price.get("id")
    except Exception:
        pass

    await db.subscriptions.update_one({"subscription_id": doc["subscription_id"]}, {"$set": doc}, upsert=True)


@api_router.get('/subscription/{email}')
async def get_subscription(email: str):
    subs = await db.subscriptions.find({"customer_email": email}).sort([("created_at", -1)]).to_list(1)
    if not subs:
        raise HTTPException(status_code=404, detail="No subscription found")
    # convert datetime fields to ISO
    sub = subs[0]
    for k in ("current_period_end", "trial_end", "created_at"):
        if isinstance(sub.get(k), datetime):
            sub[k] = sub[k].isoformat()
    return sub

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