from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'dryclean_pos_secret')
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', 24))

# Create the main app
app = FastAPI(title="DryClean POS API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ======================== ENUMS ========================
class UserRole(str, Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"

class OrderStatus(str, Enum):
    RECEIVED = "received"
    PROCESSING = "processing"
    READY = "ready"
    PICKED_UP = "picked_up"
    CANCELLED = "cancelled"

class ServiceType(str, Enum):
    REGULAR = "regular"
    EXPRESS = "express"
    DELICATE = "delicate"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


# ======================== MODELS ========================

# User Models
class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: UserRole = UserRole.STAFF

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    role: UserRole
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Customer Models
class CustomerPreferences(BaseModel):
    starch_level: Optional[str] = "medium"
    fold_style: Optional[str] = "standard"
    special_instructions: Optional[str] = None

class CustomerMeasurements(BaseModel):
    shirt_size: Optional[str] = None
    pant_waist: Optional[str] = None
    pant_length: Optional[str] = None

class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    preferences: Optional[CustomerPreferences] = None
    measurements: Optional[CustomerMeasurements] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    preferences: Optional[CustomerPreferences] = None
    measurements: Optional[CustomerMeasurements] = None

class CustomerResponse(CustomerBase):
    id: str
    loyalty_points: int = 0
    total_orders: int = 0
    total_spent: float = 0.0
    created_at: str


# Item/Service Models
class PriceByService(BaseModel):
    regular: float
    express: float
    delicate: float

class ItemBase(BaseModel):
    name: str
    category: str
    prices: PriceByService
    description: Optional[str] = None
    is_active: bool = True

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    prices: Optional[PriceByService] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class ItemResponse(ItemBase):
    id: str
    created_at: str


# Order Models
class OrderItem(BaseModel):
    item_id: str
    item_name: str
    quantity: int
    service_type: ServiceType
    unit_price: float
    total_price: float
    notes: Optional[str] = None

class OrderBase(BaseModel):
    customer_id: str
    customer_name: str
    customer_phone: str
    items: List[OrderItem]
    subtotal: float
    tax: float
    discount: float = 0.0
    total: float
    notes: Optional[str] = None
    estimated_ready: Optional[str] = None

class OrderCreate(OrderBase):
    pass

class OrderStatusUpdate(BaseModel):
    status: OrderStatus
    notes: Optional[str] = None

class OrderResponse(OrderBase):
    id: str
    order_number: str
    status: OrderStatus
    payment_status: PaymentStatus
    payment_method: Optional[PaymentMethod] = None
    created_at: str
    updated_at: str
    created_by: str


# Payment Models
class PaymentCreate(BaseModel):
    order_id: str
    amount: float
    payment_method: PaymentMethod
    origin_url: Optional[str] = None

class PaymentResponse(BaseModel):
    id: str
    order_id: str
    amount: float
    payment_method: PaymentMethod
    status: PaymentStatus
    stripe_session_id: Optional[str] = None
    checkout_url: Optional[str] = None
    created_at: str


# Report Models
class SalesReport(BaseModel):
    total_sales: float
    total_orders: int
    average_order_value: float
    payment_breakdown: Dict[str, float]
    top_items: List[Dict[str, Any]]
    daily_sales: List[Dict[str, Any]]


# ======================== HELPERS ========================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def generate_order_number() -> str:
    now = datetime.now(timezone.utc)
    return f"DC{now.strftime('%y%m%d')}{str(uuid.uuid4())[:4].upper()}"


# ======================== AUTH ROUTES ========================

@api_router.post("/auth/register", response_model=TokenResponse)
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    user_doc = {
        "id": user_id,
        "email": user.email,
        "name": user.name,
        "role": user.role.value,
        "password_hash": hash_password(user.password),
        "created_at": now
    }
    await db.users.insert_one(user_doc)
    
    token = create_token(user_id, user.email, user.role.value)
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, email=user.email, name=user.name, role=user.role, created_at=now)
    )

@api_router.post("/auth/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user["id"], user["email"], user["role"])
    return TokenResponse(
        access_token=token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            name=user["name"],
            role=UserRole(user["role"]),
            created_at=user["created_at"]
        )
    )

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        name=current_user["name"],
        role=UserRole(current_user["role"]),
        created_at=current_user["created_at"]
    )


# ======================== USERS ROUTES ========================

@api_router.get("/users", response_model=List[UserResponse])
async def get_users(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return [UserResponse(
        id=u["id"], email=u["email"], name=u["name"],
        role=UserRole(u["role"]), created_at=u["created_at"]
    ) for u in users]


# ======================== CUSTOMER ROUTES ========================

@api_router.post("/customers", response_model=CustomerResponse)
async def create_customer(customer: CustomerCreate, current_user: dict = Depends(get_current_user)):
    customer_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {
        "id": customer_id,
        **customer.model_dump(),
        "loyalty_points": 0,
        "total_orders": 0,
        "total_spent": 0.0,
        "created_at": now
    }
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return CustomerResponse(**doc)

@api_router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query = {"$or": [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}}
        ]}
    customers = await db.customers.find(query, {"_id": 0}).to_list(1000)
    return [CustomerResponse(**c) for c in customers]

@api_router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse(**customer)

@api_router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, update: CustomerUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.customers.update_one({"id": customer_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    return CustomerResponse(**customer)

@api_router.delete("/customers/{customer_id}")
async def delete_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.customers.delete_one({"id": customer_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer deleted"}


# ======================== ITEM ROUTES ========================

@api_router.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    item_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    doc = {"id": item_id, **item.model_dump(), "created_at": now}
    await db.items.insert_one(doc)
    doc.pop("_id", None)
    return ItemResponse(**doc)

@api_router.get("/items", response_model=List[ItemResponse])
async def get_items(
    category: Optional[str] = None,
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category"] = category
    if active_only:
        query["is_active"] = True
    
    items = await db.items.find(query, {"_id": 0}).to_list(1000)
    return [ItemResponse(**i) for i in items]

@api_router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return ItemResponse(**item)

@api_router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, update: ItemUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if "prices" in update_data:
        update_data["prices"] = update_data["prices"].model_dump() if hasattr(update_data["prices"], "model_dump") else update_data["prices"]
    
    result = await db.items.update_one({"id": item_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    return ItemResponse(**item)

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    result = await db.items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

@api_router.get("/item-categories")
async def get_item_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.items.distinct("category")
    return {"categories": categories}


# ======================== ORDER ROUTES ========================

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order: OrderCreate, current_user: dict = Depends(get_current_user)):
    order_id = str(uuid.uuid4())
    order_number = generate_order_number()
    now = datetime.now(timezone.utc).isoformat()
    
    # Convert items to dict
    items_data = [item.model_dump() for item in order.items]
    
    doc = {
        "id": order_id,
        "order_number": order_number,
        "customer_id": order.customer_id,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "items": items_data,
        "subtotal": order.subtotal,
        "tax": order.tax,
        "discount": order.discount,
        "total": order.total,
        "notes": order.notes,
        "estimated_ready": order.estimated_ready,
        "status": OrderStatus.RECEIVED.value,
        "payment_status": PaymentStatus.PENDING.value,
        "payment_method": None,
        "created_at": now,
        "updated_at": now,
        "created_by": current_user["id"]
    }
    await db.orders.insert_one(doc)
    
    # Update customer stats
    await db.customers.update_one(
        {"id": order.customer_id},
        {"$inc": {"total_orders": 1, "total_spent": order.total}}
    )
    
    doc.pop("_id", None)
    return OrderResponse(**doc)

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    status: Optional[OrderStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    customer_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(default=100, le=1000),
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if status:
        query["status"] = status.value
    if payment_status:
        query["payment_status"] = payment_status.value
    if customer_id:
        query["customer_id"] = customer_id
    if date_from:
        query["created_at"] = {"$gte": date_from}
    if date_to:
        if "created_at" in query:
            query["created_at"]["$lte"] = date_to
        else:
            query["created_at"] = {"$lte": date_to}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [OrderResponse(**o) for o in orders]

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse(**order)

@api_router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, update: OrderStatusUpdate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    update_data = {"status": update.status.value, "updated_at": now}
    if update.notes:
        update_data["notes"] = update.notes
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(**order)


# ======================== PAYMENT ROUTES ========================

@api_router.post("/payments", response_model=PaymentResponse)
async def create_payment(payment: PaymentCreate, request: Request, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": payment.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["payment_status"] == PaymentStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Order already paid")
    
    payment_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    payment_doc = {
        "id": payment_id,
        "order_id": payment.order_id,
        "amount": float(payment.amount),
        "payment_method": payment.payment_method.value,
        "status": PaymentStatus.PENDING.value,
        "stripe_session_id": None,
        "checkout_url": None,
        "created_at": now
    }
    
    if payment.payment_method == PaymentMethod.CARD:
        # Stripe payment
        from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
        
        api_key = os.environ.get("STRIPE_API_KEY")
        host_url = payment.origin_url or str(request.base_url).rstrip("/")
        webhook_url = f"{host_url}/api/webhook/stripe"
        
        stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
        
        success_url = f"{host_url}/payment-success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{host_url}/pos"
        
        checkout_request = CheckoutSessionRequest(
            amount=float(payment.amount),
            currency="usd",
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={"order_id": payment.order_id, "payment_id": payment_id}
        )
        
        session = await stripe_checkout.create_checkout_session(checkout_request)
        payment_doc["stripe_session_id"] = session.session_id
        payment_doc["checkout_url"] = session.url
    
    elif payment.payment_method in [PaymentMethod.CASH, PaymentMethod.BANK_TRANSFER]:
        # Direct payment - mark as completed
        payment_doc["status"] = PaymentStatus.COMPLETED.value
        
        # Update order payment status
        await db.orders.update_one(
            {"id": payment.order_id},
            {"$set": {
                "payment_status": PaymentStatus.COMPLETED.value,
                "payment_method": payment.payment_method.value,
                "updated_at": now
            }}
        )
        
        # Add loyalty points (1 point per dollar)
        await db.customers.update_one(
            {"id": order["customer_id"]},
            {"$inc": {"loyalty_points": int(payment.amount)}}
        )
    
    await db.payment_transactions.insert_one(payment_doc)
    payment_doc.pop("_id", None)
    
    return PaymentResponse(**payment_doc, status=PaymentStatus(payment_doc["status"]), payment_method=PaymentMethod(payment_doc["payment_method"]))

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    # Update payment if completed
    if status.payment_status == "paid":
        payment = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
        if payment and payment["status"] != PaymentStatus.COMPLETED.value:
            now = datetime.now(timezone.utc).isoformat()
            
            await db.payment_transactions.update_one(
                {"stripe_session_id": session_id},
                {"$set": {"status": PaymentStatus.COMPLETED.value}}
            )
            
            await db.orders.update_one(
                {"id": payment["order_id"]},
                {"$set": {
                    "payment_status": PaymentStatus.COMPLETED.value,
                    "payment_method": PaymentMethod.CARD.value,
                    "updated_at": now
                }}
            )
            
            # Add loyalty points
            order = await db.orders.find_one({"id": payment["order_id"]}, {"_id": 0})
            if order:
                await db.customers.update_one(
                    {"id": order["customer_id"]},
                    {"$inc": {"loyalty_points": int(payment["amount"])}}
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            session_id = webhook_response.session_id
            payment = await db.payment_transactions.find_one({"stripe_session_id": session_id}, {"_id": 0})
            
            if payment and payment["status"] != PaymentStatus.COMPLETED.value:
                now = datetime.now(timezone.utc).isoformat()
                
                await db.payment_transactions.update_one(
                    {"stripe_session_id": session_id},
                    {"$set": {"status": PaymentStatus.COMPLETED.value}}
                )
                
                await db.orders.update_one(
                    {"id": payment["order_id"]},
                    {"$set": {
                        "payment_status": PaymentStatus.COMPLETED.value,
                        "payment_method": PaymentMethod.CARD.value,
                        "updated_at": now
                    }}
                )
        
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}


# ======================== REPORTS ROUTES ========================

@api_router.get("/reports/sales")
async def get_sales_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"payment_status": PaymentStatus.COMPLETED.value}
    
    if date_from or date_to:
        query["created_at"] = {}
        if date_from:
            query["created_at"]["$gte"] = date_from
        if date_to:
            query["created_at"]["$lte"] = date_to
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
    
    total_sales = sum(o["total"] for o in orders)
    total_orders = len(orders)
    avg_order_value = total_sales / total_orders if total_orders > 0 else 0
    
    # Payment breakdown
    payment_breakdown = {"cash": 0, "card": 0, "bank_transfer": 0}
    for o in orders:
        method = o.get("payment_method", "cash")
        payment_breakdown[method] = payment_breakdown.get(method, 0) + o["total"]
    
    # Top items
    item_counts = {}
    for o in orders:
        for item in o.get("items", []):
            name = item["item_name"]
            if name not in item_counts:
                item_counts[name] = {"name": name, "quantity": 0, "revenue": 0}
            item_counts[name]["quantity"] += item["quantity"]
            item_counts[name]["revenue"] += item["total_price"]
    
    top_items = sorted(item_counts.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    # Daily sales (last 30 days)
    daily_sales = {}
    for o in orders:
        date = o["created_at"][:10]
        if date not in daily_sales:
            daily_sales[date] = {"date": date, "sales": 0, "orders": 0}
        daily_sales[date]["sales"] += o["total"]
        daily_sales[date]["orders"] += 1
    
    daily_sales_list = sorted(daily_sales.values(), key=lambda x: x["date"])[-30:]
    
    return {
        "total_sales": total_sales,
        "total_orders": total_orders,
        "average_order_value": round(avg_order_value, 2),
        "payment_breakdown": payment_breakdown,
        "top_items": top_items,
        "daily_sales": daily_sales_list
    }

@api_router.get("/reports/dashboard")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Today's stats
    today_orders = await db.orders.find(
        {"created_at": {"$gte": today}},
        {"_id": 0}
    ).to_list(1000)
    
    today_revenue = sum(o["total"] for o in today_orders if o["payment_status"] == "completed")
    today_order_count = len(today_orders)
    
    # Pending orders
    pending_orders = await db.orders.count_documents({"status": {"$in": ["received", "processing"]}})
    ready_orders = await db.orders.count_documents({"status": "ready"})
    
    # Total customers
    total_customers = await db.customers.count_documents({})
    
    # Recent orders
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    
    return {
        "today_revenue": today_revenue,
        "today_orders": today_order_count,
        "pending_orders": pending_orders,
        "ready_orders": ready_orders,
        "total_customers": total_customers,
        "recent_orders": recent_orders
    }


# ======================== SEED DATA ========================

@api_router.post("/seed")
async def seed_data():
    """Seed initial data for the application"""
    
    # Check if already seeded
    items_count = await db.items.count_documents({})
    if items_count > 0:
        return {"message": "Data already seeded"}
    
    # Default items/services
    default_items = [
        {"name": "Shirt", "category": "Tops", "prices": {"regular": 3.99, "express": 5.99, "delicate": 6.99}, "description": "Standard button-up or dress shirt"},
        {"name": "Pants", "category": "Bottoms", "prices": {"regular": 4.99, "express": 7.49, "delicate": 8.99}, "description": "Dress pants, slacks, trousers"},
        {"name": "Suit Jacket", "category": "Tops", "prices": {"regular": 8.99, "express": 12.99, "delicate": 15.99}, "description": "Business suit jacket or blazer"},
        {"name": "Dress", "category": "Dresses", "prices": {"regular": 9.99, "express": 14.99, "delicate": 18.99}, "description": "Standard dress"},
        {"name": "Coat", "category": "Outerwear", "prices": {"regular": 12.99, "express": 18.99, "delicate": 24.99}, "description": "Winter coat or overcoat"},
        {"name": "Sweater", "category": "Tops", "prices": {"regular": 5.99, "express": 8.99, "delicate": 10.99}, "description": "Pullover or cardigan sweater"},
        {"name": "Blouse", "category": "Tops", "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99}, "description": "Women's blouse"},
        {"name": "Skirt", "category": "Bottoms", "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99}, "description": "Standard skirt"},
        {"name": "Tie", "category": "Accessories", "prices": {"regular": 2.99, "express": 4.49, "delicate": 5.99}, "description": "Necktie"},
        {"name": "Scarf", "category": "Accessories", "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99}, "description": "Scarf or shawl"},
        {"name": "Bedding - Comforter", "category": "Household", "prices": {"regular": 24.99, "express": 34.99, "delicate": 44.99}, "description": "Comforter or duvet"},
        {"name": "Bedding - Sheets", "category": "Household", "prices": {"regular": 14.99, "express": 21.99, "delicate": 29.99}, "description": "Sheet set"},
        {"name": "Curtains", "category": "Household", "prices": {"regular": 19.99, "express": 29.99, "delicate": 39.99}, "description": "Per panel"},
        {"name": "Wedding Dress", "category": "Special", "prices": {"regular": 149.99, "express": 199.99, "delicate": 249.99}, "description": "Wedding gown cleaning"},
        {"name": "Leather Jacket", "category": "Special", "prices": {"regular": 49.99, "express": 69.99, "delicate": 89.99}, "description": "Leather cleaning and conditioning"},
    ]
    
    now = datetime.now(timezone.utc).isoformat()
    for item in default_items:
        item["id"] = str(uuid.uuid4())
        item["is_active"] = True
        item["created_at"] = now
    
    await db.items.insert_many(default_items)
    
    # Create default admin user
    admin_exists = await db.users.find_one({"email": "admin@dryclean.com"})
    if not admin_exists:
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": "admin@dryclean.com",
            "name": "Admin User",
            "role": "admin",
            "password_hash": hash_password("admin123"),
            "created_at": now
        }
        await db.users.insert_one(admin_doc)
    
    return {"message": "Data seeded successfully", "items_created": len(default_items)}


# ======================== ROOT ========================

@api_router.get("/")
async def root():
    return {"message": "DryClean POS API", "version": "1.0.0"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}


# Include router and middleware
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
