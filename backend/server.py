from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Query, UploadFile, File, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import StreamingResponse, FileResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import csv
import io
import base64
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
from enum import Enum
import qrcode
from io import BytesIO

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
    CLEANING = "cleaning"
    READY = "ready"
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
    COLLECTED = "collected"
    CANCELLED = "cancelled"

class ServiceType(str, Enum):
    REGULAR = "regular"
    EXPRESS = "express"
    DELICATE = "delicate"

class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    PAY_ON_COLLECTION = "pay_on_collection"
    INVOICE = "invoice"

class PaymentStatus(str, Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"

class DeliveryType(str, Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"
    BOTH = "both"

class CustomerType(str, Enum):
    RETAIL = "retail"
    BUSINESS = "business"

class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    PARTIAL = "partial"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class NotificationEvent(str, Enum):
    ORDER_CREATED = "order_created"
    ORDER_CLEANING = "order_cleaning"
    ORDER_READY = "order_ready"
    ORDER_OUT_FOR_DELIVERY = "order_out_for_delivery"
    ORDER_DELIVERED = "order_delivered"
    ORDER_COLLECTED = "order_collected"
    INVOICE_CREATED = "invoice_created"
    INVOICE_OVERDUE = "invoice_overdue"


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


# Settings Models
class TaxSettings(BaseModel):
    tax_name: str = "VAT"
    tax_rate: float = 0.0
    tax_number: Optional[str] = None
    is_inclusive: bool = False
    additional_taxes: Optional[List[Dict[str, Any]]] = None

class CountrySettings(BaseModel):
    country_code: str = "US"
    country_name: str = "United States"
    currency_code: str = "USD"
    currency_symbol: str = "$"
    date_format: str = "MM/DD/YYYY"
    phone_format: Optional[str] = None

class OpeningHours(BaseModel):
    day: str  # "monday", "tuesday", etc.
    is_open: bool = True
    open_time: str = "09:00"
    close_time: str = "18:00"

class SocialMediaLinks(BaseModel):
    facebook: Optional[str] = None
    instagram: Optional[str] = None
    tiktok: Optional[str] = None
    twitter: Optional[str] = None
    website: Optional[str] = None

class CompanyProfile(BaseModel):
    logo_url: Optional[str] = None
    logo_on_receipts: bool = False
    logo_on_labels: bool = False
    social_media: Optional[SocialMediaLinks] = None
    opening_hours: Optional[List[OpeningHours]] = None

class EmailProviderConfig(BaseModel):
    provider: Optional[str] = None  # "sendgrid", "ses", "smtp", or None for not configured
    api_key: Optional[str] = None
    from_email: Optional[str] = None
    from_name: Optional[str] = None
    is_configured: bool = False

class NotificationTemplate(BaseModel):
    event: NotificationEvent
    enabled: bool = True
    subject: str
    body: str
    sms_enabled: bool = False
    sms_text: Optional[str] = None

class NotificationSettings(BaseModel):
    email_provider: Optional[EmailProviderConfig] = None
    templates: Optional[List[NotificationTemplate]] = None

class BusinessSettings(BaseModel):
    business_name: str = "DryClean POS"
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    country: CountrySettings = CountrySettings()
    tax: TaxSettings = TaxSettings()
    company_profile: Optional[CompanyProfile] = None
    notification_settings: Optional[NotificationSettings] = None
    auto_print_receipt: bool = True
    auto_print_labels: bool = True
    open_drawer_on_payment: bool = True

class SettingsResponse(BaseModel):
    id: str
    settings: BusinessSettings
    updated_at: str


# Category Models
class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None

class CategoryResponse(CategoryBase):
    id: str
    created_at: str


# Volume Discount Models
class VolumeDiscount(BaseModel):
    min_quantity: int
    discount_percent: float

class PriceByService(BaseModel):
    regular: float
    express: float
    delicate: float


# Item Models (with parent-child support)
class ItemBase(BaseModel):
    name: str
    category_id: str
    prices: PriceByService
    description: Optional[str] = None
    is_active: bool = True
    parent_id: Optional[str] = None
    volume_discounts: Optional[List[VolumeDiscount]] = None
    pieces: int = 1  # Number of pieces (e.g., 2-piece suit = 2 garment tags)

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[str] = None
    prices: Optional[PriceByService] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
    parent_id: Optional[str] = None
    volume_discounts: Optional[List[VolumeDiscount]] = None
    pieces: Optional[int] = None

class ItemResponse(ItemBase):
    id: str
    category_name: Optional[str] = None
    parent_name: Optional[str] = None
    children: Optional[List[dict]] = None
    has_children: bool = False
    created_at: str


# Customer Models - Updated with business support
class CustomerAddress(BaseModel):
    street: str
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str = "US"
    is_default: bool = False
    label: str = "Home"
    lat: Optional[float] = None
    lng: Optional[float] = None

class BusinessInfo(BaseModel):
    company_name: str
    registration_number: Optional[str] = None
    vat_number: Optional[str] = None
    contact_person: Optional[str] = None
    billing_email: Optional[str] = None
    payment_terms: int = 30  # Days

class CustomerPreferences(BaseModel):
    fold_style: Optional[str] = "standard"
    special_instructions: Optional[str] = None

class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    customer_type: CustomerType = CustomerType.RETAIL
    discount_percent: float = 0.0
    addresses: Optional[List[CustomerAddress]] = None
    preferences: Optional[CustomerPreferences] = None
    business_info: Optional[BusinessInfo] = None
    require_advance_payment: bool = False
    is_blacklisted: bool = False
    blacklist_reason: Optional[str] = None
    loyalty_excluded: bool = False  # Exclude from loyalty program

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    customer_type: Optional[CustomerType] = None
    discount_percent: Optional[float] = None
    addresses: Optional[List[CustomerAddress]] = None
    preferences: Optional[CustomerPreferences] = None
    business_info: Optional[BusinessInfo] = None
    require_advance_payment: Optional[bool] = None
    is_blacklisted: Optional[bool] = None
    blacklist_reason: Optional[str] = None
    loyalty_excluded: Optional[bool] = None

class CustomerResponse(CustomerBase):
    id: str
    loyalty_points: int = 0
    total_orders: int = 0
    total_spent: float = 0.0
    average_order_value: float = 0.0
    last_order_date: Optional[str] = None
    created_at: str


# Order Models - Updated with timestamps
class GarmentTag(BaseModel):
    garment_id: str
    item_id: str
    item_name: str
    piece_number: int
    total_pieces: int
    qr_code_data: str  # The data encoded in QR code

class OrderItem(BaseModel):
    item_id: str
    item_name: str
    quantity: int
    service_type: ServiceType
    unit_price: float
    total_price: float
    discount_applied: float = 0.0
    volume_discount_percent: float = 0.0
    notes: Optional[str] = None
    pieces: int = 1  # Number of pieces per item (for garment tags)
    garment_tags: Optional[List[GarmentTag]] = None

class DeliveryInfo(BaseModel):
    type: DeliveryType
    pickup_address: Optional[CustomerAddress] = None
    delivery_address: Optional[CustomerAddress] = None
    pickup_date: Optional[str] = None
    pickup_time_slot: Optional[str] = None
    delivery_date: Optional[str] = None
    delivery_time_slot: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    delivery_notes: Optional[str] = None
    delivery_fee: float = 0.0

class OrderTimestamps(BaseModel):
    created_at: str
    cleaning_at: Optional[str] = None
    ready_at: Optional[str] = None
    collected_at: Optional[str] = None
    delivered_at: Optional[str] = None
    cancelled_at: Optional[str] = None

class OrderBase(BaseModel):
    customer_id: str
    customer_name: str
    customer_phone: str
    customer_type: CustomerType = CustomerType.RETAIL
    items: List[OrderItem]
    subtotal: float
    tax: float
    tax_details: Optional[Dict[str, float]] = None
    customer_discount_percent: float = 0.0
    customer_discount_amount: float = 0.0
    volume_discount_amount: float = 0.0
    manual_discount: float = 0.0
    loyalty_points_redeemed: int = 0
    loyalty_discount_amount: float = 0.0
    total: float
    notes: Optional[str] = None
    estimated_ready: Optional[str] = None
    delivery_info: Optional[DeliveryInfo] = None

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
    timestamps: OrderTimestamps
    created_by: str
    loyalty_points_earned: int = 0


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


# Metrics Models
class MetricsPeriod(BaseModel):
    start_date: str
    end_date: str
    total_revenue: float
    total_orders: int
    average_order_value: float
    new_customers: int
    repeat_customers: int


# Loyalty Program Models
class LoyaltyTier(BaseModel):
    name: str
    min_points: int
    benefits: str
    multiplier: float = 1.0  # Points earning multiplier

class LoyaltySettings(BaseModel):
    enabled: bool = True
    points_per_dollar: float = 1.0  # Points earned per dollar spent
    redemption_rate: float = 0.05  # Dollar value per point (e.g., 0.05 = 100 points = $5)
    min_redemption_points: int = 100  # Minimum points to redeem
    max_redemption_percent: float = 50.0  # Max % of order that can be paid with points
    points_expiry_days: int = 365  # Points expire after X days (0 = never)
    exclude_business_customers: bool = True
    tiers: List[LoyaltyTier] = []

class LoyaltySettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    points_per_dollar: Optional[float] = None
    redemption_rate: Optional[float] = None
    min_redemption_points: Optional[int] = None
    max_redemption_percent: Optional[float] = None
    points_expiry_days: Optional[int] = None
    exclude_business_customers: Optional[bool] = None
    tiers: Optional[List[LoyaltyTier]] = None

class LoyaltyTransaction(BaseModel):
    id: str
    customer_id: str
    order_id: Optional[str] = None
    type: str  # "earned", "redeemed", "expired", "adjustment"
    points: int
    description: str
    balance_after: int
    created_at: str

class LoyaltyRedemption(BaseModel):
    points_to_redeem: int


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

def calculate_volume_discount(item_id: str, quantity: int, volume_discounts: List[VolumeDiscount]) -> float:
    if not volume_discounts:
        return 0.0
    
    applicable_discount = 0.0
    for vd in sorted(volume_discounts, key=lambda x: x.min_quantity, reverse=True):
        if quantity >= vd.min_quantity:
            applicable_discount = vd.discount_percent
            break
    
    return applicable_discount


async def award_loyalty_points(customer_id: str, order_id: str, amount: float, order_number: str):
    """Award loyalty points to customer after successful payment"""
    # Get customer
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        return
    
    # Check if customer is excluded
    if customer.get("loyalty_excluded", False):
        return
    
    # Get loyalty settings
    loyalty_doc = await db.loyalty_settings.find_one({"id": "default"}, {"_id": 0})
    settings = loyalty_doc.get("settings", {}) if loyalty_doc else {}
    
    # Check if program is enabled
    if not settings.get("enabled", True):
        return
    
    # Business customers excluded by default
    if customer.get("customer_type") == "business" and settings.get("exclude_business_customers", True):
        return
    
    # Calculate points to award
    points_per_dollar = settings.get("points_per_dollar", 1.0)
    
    # Apply tier multiplier
    current_points = customer.get("loyalty_points", 0)
    multiplier = 1.0
    tiers = settings.get("tiers", [])
    for tier in sorted(tiers, key=lambda x: x.get("min_points", 0), reverse=True):
        if current_points >= tier.get("min_points", 0):
            multiplier = tier.get("multiplier", 1.0)
            break
    
    points_earned = int(amount * points_per_dollar * multiplier)
    
    if points_earned <= 0:
        return
    
    # Award points
    new_balance = current_points + points_earned
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"loyalty_points": new_balance}}
    )
    
    # Update order with points earned
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"loyalty_points_earned": points_earned}}
    )
    
    # Record transaction
    now = datetime.now(timezone.utc).isoformat()
    transaction = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "order_id": order_id,
        "type": "earned",
        "points": points_earned,
        "description": f"Earned from order {order_number}",
        "balance_after": new_balance,
        "created_at": now
    }
    await db.loyalty_transactions.insert_one(transaction)


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


# ======================== SETTINGS ROUTES ========================

@api_router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user)):
    settings = await db.settings.find_one({}, {"_id": 0})
    if not settings:
        return {
            "id": "default",
            "settings": BusinessSettings().model_dump(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
    return settings

@api_router.put("/settings")
async def update_settings(settings: BusinessSettings, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": "default",
        "settings": settings.model_dump(),
        "updated_at": now
    }
    
    await db.settings.update_one(
        {"id": "default"},
        {"$set": doc},
        upsert=True
    )
    
    return doc

@api_router.put("/settings/country")
async def update_country_settings(country: CountrySettings, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"id": "default"},
        {"$set": {"settings.country": country.model_dump(), "updated_at": now}},
        upsert=True
    )
    
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0})
    return settings

@api_router.put("/settings/tax")
async def update_tax_settings(tax: TaxSettings, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc).isoformat()
    await db.settings.update_one(
        {"id": "default"},
        {"$set": {"settings.tax": tax.model_dump(), "updated_at": now}},
        upsert=True
    )
    
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0})
    return settings


# ======================== LOYALTY PROGRAM ROUTES ========================

@api_router.get("/settings/loyalty")
async def get_loyalty_settings(current_user: dict = Depends(get_current_user)):
    """Get loyalty program settings"""
    loyalty = await db.loyalty_settings.find_one({"id": "default"}, {"_id": 0})
    if not loyalty:
        # Return default settings
        default_settings = LoyaltySettings(
            enabled=True,
            points_per_dollar=1.0,
            redemption_rate=0.05,
            min_redemption_points=100,
            max_redemption_percent=50.0,
            points_expiry_days=365,
            exclude_business_customers=True,
            tiers=[
                LoyaltyTier(name="Bronze", min_points=0, benefits="Earn 1x points", multiplier=1.0),
                LoyaltyTier(name="Silver", min_points=500, benefits="Earn 1.25x points", multiplier=1.25),
                LoyaltyTier(name="Gold", min_points=1000, benefits="Earn 1.5x points + priority service", multiplier=1.5),
                LoyaltyTier(name="Platinum", min_points=2500, benefits="Earn 2x points + free delivery", multiplier=2.0),
            ]
        )
        return {"id": "default", "settings": default_settings.model_dump()}
    return loyalty

@api_router.put("/settings/loyalty")
async def update_loyalty_settings(settings: LoyaltySettingsUpdate, current_user: dict = Depends(get_current_user)):
    """Update loyalty program settings"""
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Get existing settings
    existing = await db.loyalty_settings.find_one({"id": "default"})
    if existing:
        current_settings = existing.get("settings", {})
    else:
        current_settings = LoyaltySettings().model_dump()
    
    # Update only provided fields
    update_data = settings.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            current_settings[key] = value
    
    doc = {
        "id": "default",
        "settings": current_settings,
        "updated_at": now
    }
    
    await db.loyalty_settings.update_one(
        {"id": "default"},
        {"$set": doc},
        upsert=True
    )
    
    return doc

@api_router.get("/customers/{customer_id}/loyalty")
async def get_customer_loyalty(customer_id: str, current_user: dict = Depends(get_current_user)):
    """Get customer loyalty information including points history"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get loyalty settings
    loyalty_settings = await db.loyalty_settings.find_one({"id": "default"}, {"_id": 0})
    settings = loyalty_settings.get("settings", LoyaltySettings().model_dump()) if loyalty_settings else LoyaltySettings().model_dump()
    
    # Check if customer is excluded
    is_excluded = customer.get("loyalty_excluded", False)
    is_business = customer.get("customer_type") == "business"
    excluded_reason = None
    
    if is_excluded:
        excluded_reason = "manually_excluded"
    elif is_business and settings.get("exclude_business_customers", True):
        excluded_reason = "business_customer"
    
    # Get points history
    transactions = await db.loyalty_transactions.find(
        {"customer_id": customer_id}
    ).sort("created_at", -1).limit(50).to_list(50)
    
    for t in transactions:
        t.pop("_id", None)
    
    # Calculate tier
    points = customer.get("loyalty_points", 0)
    current_tier = None
    next_tier = None
    tiers = settings.get("tiers", [])
    
    for i, tier in enumerate(sorted(tiers, key=lambda x: x.get("min_points", 0), reverse=True)):
        if points >= tier.get("min_points", 0):
            current_tier = tier
            break
    
    # Find next tier
    for tier in sorted(tiers, key=lambda x: x.get("min_points", 0)):
        if tier.get("min_points", 0) > points:
            next_tier = tier
            break
    
    return {
        "customer_id": customer_id,
        "points": points,
        "is_excluded": is_excluded or (is_business and settings.get("exclude_business_customers", True)),
        "excluded_reason": excluded_reason,
        "current_tier": current_tier,
        "next_tier": next_tier,
        "points_to_next_tier": next_tier.get("min_points", 0) - points if next_tier else 0,
        "redemption_value": points * settings.get("redemption_rate", 0.05),
        "can_redeem": points >= settings.get("min_redemption_points", 100),
        "min_redemption_points": settings.get("min_redemption_points", 100),
        "transactions": transactions
    }

@api_router.post("/customers/{customer_id}/loyalty/adjust")
async def adjust_loyalty_points(
    customer_id: str,
    adjustment: int = Query(..., description="Points to add (positive) or remove (negative)"),
    reason: str = Query(..., description="Reason for adjustment"),
    current_user: dict = Depends(get_current_user)
):
    """Manually adjust customer loyalty points"""
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    customer = await db.customers.find_one({"id": customer_id})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    current_points = customer.get("loyalty_points", 0)
    new_points = max(0, current_points + adjustment)
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Update customer points
    await db.customers.update_one(
        {"id": customer_id},
        {"$set": {"loyalty_points": new_points}}
    )
    
    # Record transaction
    transaction = {
        "id": str(uuid.uuid4()),
        "customer_id": customer_id,
        "order_id": None,
        "type": "adjustment",
        "points": adjustment,
        "description": f"Manual adjustment: {reason}",
        "balance_after": new_points,
        "created_at": now,
        "adjusted_by": current_user["id"]
    }
    await db.loyalty_transactions.insert_one(transaction)
    
    return {
        "customer_id": customer_id,
        "previous_points": current_points,
        "adjustment": adjustment,
        "new_points": new_points,
        "reason": reason
    }

@api_router.post("/loyalty/calculate-redemption")
async def calculate_loyalty_redemption(
    customer_id: str,
    order_total: float,
    points_to_redeem: int,
    current_user: dict = Depends(get_current_user)
):
    """Calculate how much discount a customer can get by redeeming points"""
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get loyalty settings
    loyalty_doc = await db.loyalty_settings.find_one({"id": "default"}, {"_id": 0})
    settings = loyalty_doc.get("settings", LoyaltySettings().model_dump()) if loyalty_doc else LoyaltySettings().model_dump()
    
    # Check if program is enabled
    if not settings.get("enabled", True):
        raise HTTPException(status_code=400, detail="Loyalty program is not enabled")
    
    # Check if customer is excluded
    is_excluded = customer.get("loyalty_excluded", False)
    is_business = customer.get("customer_type") == "business"
    
    if is_excluded or (is_business and settings.get("exclude_business_customers", True)):
        raise HTTPException(status_code=400, detail="Customer is excluded from loyalty program")
    
    available_points = customer.get("loyalty_points", 0)
    min_points = settings.get("min_redemption_points", 100)
    redemption_rate = settings.get("redemption_rate", 0.05)
    max_percent = settings.get("max_redemption_percent", 50.0)
    
    # Validate points
    if points_to_redeem > available_points:
        raise HTTPException(status_code=400, detail=f"Insufficient points. Available: {available_points}")
    
    if points_to_redeem < min_points:
        raise HTTPException(status_code=400, detail=f"Minimum {min_points} points required for redemption")
    
    # Calculate discount
    discount_value = points_to_redeem * redemption_rate
    max_discount = order_total * (max_percent / 100)
    
    actual_discount = min(discount_value, max_discount)
    actual_points_used = int(actual_discount / redemption_rate)
    
    return {
        "points_available": available_points,
        "points_requested": points_to_redeem,
        "points_to_use": actual_points_used,
        "discount_value": round(actual_discount, 2),
        "max_discount_allowed": round(max_discount, 2),
        "order_total": order_total,
        "new_total": round(order_total - actual_discount, 2),
        "remaining_points": available_points - actual_points_used
    }


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


# ======================== CATEGORY ROUTES ========================

@api_router.post("/categories", response_model=CategoryResponse)
async def create_category(category: CategoryCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    category_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    if category.sort_order == 0:
        max_order = await db.categories.find_one(sort=[("sort_order", -1)])
        category.sort_order = (max_order["sort_order"] + 1) if max_order else 1
    
    doc = {"id": category_id, **category.model_dump(), "created_at": now}
    await db.categories.insert_one(doc)
    doc.pop("_id", None)
    return CategoryResponse(**doc)

@api_router.get("/categories", response_model=List[CategoryResponse])
async def get_categories(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    query = {"is_active": True} if active_only else {}
    categories = await db.categories.find(query, {"_id": 0}).sort("sort_order", 1).to_list(1000)
    return [CategoryResponse(**c) for c in categories]

@api_router.get("/categories/{category_id}", response_model=CategoryResponse)
async def get_category(category_id: str, current_user: dict = Depends(get_current_user)):
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    return CategoryResponse(**category)

@api_router.put("/categories/{category_id}", response_model=CategoryResponse)
async def update_category(category_id: str, update: CategoryUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    result = await db.categories.update_one({"id": category_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category = await db.categories.find_one({"id": category_id}, {"_id": 0})
    return CategoryResponse(**category)

@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    items_count = await db.items.count_documents({"category_id": category_id})
    if items_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {items_count} items")
    
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

@api_router.put("/categories/reorder")
async def reorder_categories(category_orders: List[Dict[str, Any]], current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    for item in category_orders:
        await db.categories.update_one(
            {"id": item["id"]},
            {"$set": {"sort_order": item["sort_order"]}}
        )
    
    categories = await db.categories.find({}, {"_id": 0}).sort("sort_order", 1).to_list(1000)
    return [CategoryResponse(**c) for c in categories]


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
        "average_order_value": 0.0,
        "last_order_date": None,
        "created_at": now
    }
    await db.customers.insert_one(doc)
    doc.pop("_id", None)
    return CustomerResponse(**doc)

@api_router.get("/customers", response_model=List[CustomerResponse])
async def get_customers(
    search: Optional[str] = None,
    customer_type: Optional[CustomerType] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"phone": {"$regex": search, "$options": "i"}},
            {"email": {"$regex": search, "$options": "i"}},
            {"business_info.company_name": {"$regex": search, "$options": "i"}}
        ]
    if customer_type:
        query["customer_type"] = customer_type.value
    
    customers = await db.customers.find(query, {"_id": 0}).to_list(1000)
    return [CustomerResponse(**c) for c in customers]

@api_router.get("/customers/{customer_id}", response_model=CustomerResponse)
async def get_customer(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    return CustomerResponse(**customer)

@api_router.get("/customers/{customer_id}/orders")
async def get_customer_orders(
    customer_id: str,
    active_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    query = {"customer_id": customer_id}
    if active_only:
        query["status"] = {"$in": ["cleaning", "ready"]}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("timestamps.created_at", -1).to_list(100)
    return orders

@api_router.get("/customers/{customer_id}/stats")
async def get_customer_stats(customer_id: str, current_user: dict = Depends(get_current_user)):
    customer = await db.customers.find_one({"id": customer_id}, {"_id": 0})
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get order statistics
    orders = await db.orders.find({"customer_id": customer_id}, {"_id": 0}).to_list(1000)
    
    active_orders = [o for o in orders if o.get("status") in ["cleaning", "ready"]]
    completed_orders = [o for o in orders if o.get("status") in ["collected", "delivered"]]
    
    # Calculate stats
    total_items = sum(sum(i["quantity"] for i in o.get("items", [])) for o in orders)
    
    # Most ordered items
    item_counts = {}
    for order in orders:
        for item in order.get("items", []):
            name = item["item_name"]
            if name not in item_counts:
                item_counts[name] = 0
            item_counts[name] += item["quantity"]
    
    top_items = sorted(item_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    
    # Monthly spending (last 6 months)
    from collections import defaultdict
    monthly_spending = defaultdict(float)
    for order in completed_orders:
        date = order.get("timestamps", {}).get("created_at", "")[:7]  # YYYY-MM
        if date:
            monthly_spending[date] += order.get("total", 0)
    
    return {
        "total_orders": len(orders),
        "active_orders": len(active_orders),
        "completed_orders": len(completed_orders),
        "total_spent": customer.get("total_spent", 0),
        "average_order_value": customer.get("average_order_value", 0),
        "loyalty_points": customer.get("loyalty_points", 0),
        "total_items_cleaned": total_items,
        "top_items": [{"name": n, "quantity": q} for n, q in top_items],
        "monthly_spending": [{"month": m, "amount": a} for m, a in sorted(monthly_spending.items())[-6:]],
        "last_order_date": customer.get("last_order_date"),
        "member_since": customer.get("created_at")
    }

@api_router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(customer_id: str, update: CustomerUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {}
    for k, v in update.model_dump().items():
        if v is not None:
            if hasattr(v, "model_dump"):
                update_data[k] = v.model_dump()
            elif isinstance(v, list) and len(v) > 0 and hasattr(v[0], "model_dump"):
                update_data[k] = [item.model_dump() if hasattr(item, "model_dump") else item for item in v]
            elif isinstance(v, Enum):
                update_data[k] = v.value
            else:
                update_data[k] = v
    
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
    
    category = await db.categories.find_one({"id": item.category_id}, {"_id": 0})
    category_name = category["name"] if category else None
    
    parent_name = None
    if item.parent_id:
        parent = await db.items.find_one({"id": item.parent_id}, {"_id": 0})
        parent_name = parent["name"] if parent else None
    
    doc = {
        "id": item_id,
        **item.model_dump(),
        "category_name": category_name,
        "parent_name": parent_name,
        "created_at": now
    }
    await db.items.insert_one(doc)
    doc.pop("_id", None)
    return ItemResponse(**doc)

@api_router.get("/items", response_model=List[ItemResponse])
async def get_items(
    category_id: Optional[str] = None,
    active_only: bool = True,
    include_children: bool = True,
    parents_only: bool = False,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category_id:
        query["category_id"] = category_id
    if active_only:
        query["is_active"] = True
    if parents_only:
        query["parent_id"] = None
    
    items = await db.items.find(query, {"_id": 0}).to_list(1000)
    
    if include_children and not parents_only:
        parent_items = [i for i in items if not i.get("parent_id")]
        child_items = [i for i in items if i.get("parent_id")]
        
        for parent in parent_items:
            parent["children"] = [c for c in child_items if c.get("parent_id") == parent["id"]]
        
        return [ItemResponse(**i) for i in parent_items]
    
    return [ItemResponse(**i) for i in items]

@api_router.get("/items/children/{parent_id}")
async def get_item_children(parent_id: str, current_user: dict = Depends(get_current_user)):
    """Get child items for a parent item"""
    children = await db.items.find({"parent_id": parent_id, "is_active": True}, {"_id": 0}).to_list(100)
    return children

@api_router.get("/items/all")
async def get_all_items(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    query = {"is_active": True} if active_only else {}
    items = await db.items.find(query, {"_id": 0}).to_list(1000)
    return [ItemResponse(**i) for i in items]

@api_router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    children = await db.items.find({"parent_id": item_id}, {"_id": 0}).to_list(100)
    item["children"] = children
    
    return ItemResponse(**item)

@api_router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, update: ItemUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    if "prices" in update_data and hasattr(update_data["prices"], "model_dump"):
        update_data["prices"] = update_data["prices"].model_dump()
    if "volume_discounts" in update_data and update_data["volume_discounts"]:
        update_data["volume_discounts"] = [vd.model_dump() if hasattr(vd, "model_dump") else vd for vd in update_data["volume_discounts"]]
    
    if "category_id" in update_data:
        category = await db.categories.find_one({"id": update_data["category_id"]}, {"_id": 0})
        update_data["category_name"] = category["name"] if category else None
    
    if "parent_id" in update_data:
        if update_data["parent_id"]:
            parent = await db.items.find_one({"id": update_data["parent_id"]}, {"_id": 0})
            update_data["parent_name"] = parent["name"] if parent else None
        else:
            update_data["parent_name"] = None
    
    result = await db.items.update_one({"id": item_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    return ItemResponse(**item)

@api_router.delete("/items/{item_id}")
async def delete_item(item_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    children_count = await db.items.count_documents({"parent_id": item_id})
    if children_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete item with {children_count} child items")
    
    result = await db.items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

@api_router.get("/item-categories")
async def get_item_categories(current_user: dict = Depends(get_current_user)):
    categories = await db.items.distinct("category_name")
    return {"categories": [c for c in categories if c]}


# ======================== ORDER ROUTES ========================

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order: OrderCreate, current_user: dict = Depends(get_current_user)):
    # Check if customer is blacklisted
    customer = await db.customers.find_one({"id": order.customer_id}, {"_id": 0})
    if customer and customer.get("is_blacklisted"):
        raise HTTPException(status_code=400, detail="Customer is blacklisted and cannot place orders")
    
    order_id = str(uuid.uuid4())
    order_number = generate_order_number()
    now = datetime.now(timezone.utc).isoformat()
    
    items_data = [item.model_dump() for item in order.items]
    delivery_data = order.delivery_info.model_dump() if order.delivery_info else None
    
    # Handle loyalty point redemption
    loyalty_points_redeemed = order.loyalty_points_redeemed or 0
    loyalty_discount_amount = order.loyalty_discount_amount or 0.0
    
    if loyalty_points_redeemed > 0:
        # Validate redemption
        current_points = customer.get("loyalty_points", 0) if customer else 0
        if loyalty_points_redeemed > current_points:
            raise HTTPException(status_code=400, detail="Insufficient loyalty points")
        
        # Deduct points from customer
        await db.customers.update_one(
            {"id": order.customer_id},
            {"$inc": {"loyalty_points": -loyalty_points_redeemed}}
        )
        
        # Record redemption transaction
        transaction = {
            "id": str(uuid.uuid4()),
            "customer_id": order.customer_id,
            "order_id": order_id,
            "type": "redeemed",
            "points": -loyalty_points_redeemed,
            "description": f"Redeemed for order {order_number}",
            "balance_after": current_points - loyalty_points_redeemed,
            "created_at": now
        }
        await db.loyalty_transactions.insert_one(transaction)
    
    timestamps = {
        "created_at": now,
        "cleaning_at": now,  # Order starts in cleaning
        "ready_at": None,
        "collected_at": None,
        "delivered_at": None,
        "cancelled_at": None
    }
    
    doc = {
        "id": order_id,
        "order_number": order_number,
        "customer_id": order.customer_id,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "customer_type": order.customer_type.value if isinstance(order.customer_type, Enum) else order.customer_type,
        "items": items_data,
        "subtotal": order.subtotal,
        "tax": order.tax,
        "tax_details": order.tax_details,
        "customer_discount_percent": order.customer_discount_percent,
        "customer_discount_amount": order.customer_discount_amount,
        "volume_discount_amount": order.volume_discount_amount,
        "manual_discount": order.manual_discount,
        "loyalty_points_redeemed": loyalty_points_redeemed,
        "loyalty_discount_amount": loyalty_discount_amount,
        "loyalty_points_earned": 0,  # Will be updated on payment
        "total": order.total,
        "notes": order.notes,
        "estimated_ready": order.estimated_ready,
        "delivery_info": delivery_data,
        "status": OrderStatus.CLEANING.value,
        "payment_status": PaymentStatus.PENDING.value,
        "payment_method": None,
        "timestamps": timestamps,
        "created_by": current_user["id"]
    }
    await db.orders.insert_one(doc)
    
    # Update customer stats
    new_total_spent = (customer.get("total_spent", 0) if customer else 0) + order.total
    new_total_orders = (customer.get("total_orders", 0) if customer else 0) + 1
    new_avg = new_total_spent / new_total_orders if new_total_orders > 0 else 0
    
    await db.customers.update_one(
        {"id": order.customer_id},
        {"$set": {
            "total_orders": new_total_orders,
            "total_spent": new_total_spent,
            "average_order_value": round(new_avg, 2),
            "last_order_date": now
        }}
    )
    
    doc.pop("_id", None)
    doc.pop("timestamps", None)  # Remove timestamps from doc to avoid duplicate
    return OrderResponse(**doc, timestamps=OrderTimestamps(**timestamps))

@api_router.get("/orders", response_model=List[OrderResponse])
async def get_orders(
    status: Optional[OrderStatus] = None,
    payment_status: Optional[PaymentStatus] = None,
    customer_id: Optional[str] = None,
    has_delivery: Optional[bool] = None,
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
    if has_delivery is not None:
        if has_delivery:
            query["delivery_info"] = {"$ne": None}
        else:
            query["delivery_info"] = None
    if date_from:
        query["timestamps.created_at"] = {"$gte": date_from}
    if date_to:
        if "timestamps.created_at" in query:
            query["timestamps.created_at"]["$lte"] = date_to
        else:
            query["timestamps.created_at"] = {"$lte": date_to}
    
    orders = await db.orders.find(query, {"_id": 0}).sort("timestamps.created_at", -1).to_list(limit)
    return [OrderResponse(**o, timestamps=OrderTimestamps(**o.get("timestamps", {}))) for o in orders]

@api_router.get("/orders/by-status")
async def get_orders_by_status(current_user: dict = Depends(get_current_user)):
    """Get orders grouped by status for POS tabs"""
    cleaning_orders = await db.orders.find({"status": "cleaning"}, {"_id": 0}).sort("timestamps.created_at", -1).to_list(500)
    ready_orders = await db.orders.find({"status": "ready"}, {"_id": 0}).sort("timestamps.ready_at", -1).to_list(500)
    
    return {
        "cleaning": cleaning_orders,
        "ready": ready_orders
    }

@api_router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse(**order, timestamps=OrderTimestamps(**order.get("timestamps", {})))

@api_router.put("/orders/{order_id}/status", response_model=OrderResponse)
async def update_order_status(order_id: str, update: OrderStatusUpdate, current_user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    
    # Determine timestamp field to update
    timestamp_field = None
    if update.status == OrderStatus.CLEANING:
        timestamp_field = "timestamps.cleaning_at"
    elif update.status == OrderStatus.READY:
        timestamp_field = "timestamps.ready_at"
    elif update.status == OrderStatus.COLLECTED:
        timestamp_field = "timestamps.collected_at"
    elif update.status == OrderStatus.DELIVERED:
        timestamp_field = "timestamps.delivered_at"
    elif update.status == OrderStatus.CANCELLED:
        timestamp_field = "timestamps.cancelled_at"
    
    update_data = {"status": update.status.value}
    if timestamp_field:
        update_data[timestamp_field] = now
    if update.notes:
        update_data["notes"] = update.notes
    
    result = await db.orders.update_one({"id": order_id}, {"$set": update_data})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(**order, timestamps=OrderTimestamps(**order.get("timestamps", {})))


# ======================== DELIVERY ROUTES ========================

@api_router.get("/deliveries")
async def get_deliveries(
    date: Optional[str] = None,
    type: Optional[DeliveryType] = None,
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"delivery_info": {"$ne": None}}
    
    if date:
        query["$or"] = [
            {"delivery_info.pickup_date": date},
            {"delivery_info.delivery_date": date}
        ]
    
    if type:
        query["delivery_info.type"] = type.value
    
    if driver_id:
        query["delivery_info.driver_id"] = driver_id
    
    orders = await db.orders.find(query, {"_id": 0}).sort("timestamps.created_at", -1).to_list(500)
    
    deliveries = []
    for order in orders:
        delivery_info = order.get("delivery_info", {})
        deliveries.append({
            "order_id": order["id"],
            "order_number": order["order_number"],
            "customer_name": order["customer_name"],
            "customer_phone": order["customer_phone"],
            "status": order["status"],
            "delivery_info": delivery_info,
            "total": order["total"],
            "timestamps": order.get("timestamps", {})
        })
    
    return deliveries

@api_router.put("/orders/{order_id}/delivery")
async def update_order_delivery(
    order_id: str,
    delivery_info: DeliveryInfo,
    current_user: dict = Depends(get_current_user)
):
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"delivery_info": delivery_info.model_dump()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(**order, timestamps=OrderTimestamps(**order.get("timestamps", {})))

@api_router.get("/drivers")
async def get_drivers(current_user: dict = Depends(get_current_user)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    return [{"id": u["id"], "name": u["name"]} for u in users]


# ======================== PAYMENT ROUTES ========================

@api_router.post("/payments", response_model=PaymentResponse)
async def create_payment(payment: PaymentCreate, request: Request, current_user: dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": payment.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order["payment_status"] == PaymentStatus.COMPLETED.value:
        raise HTTPException(status_code=400, detail="Order already paid")
    
    # Invoice only for business customers
    if payment.payment_method == PaymentMethod.INVOICE:
        if order.get("customer_type") != "business":
            raise HTTPException(status_code=400, detail="Invoice payment only available for business customers")
    
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
        payment_doc["status"] = PaymentStatus.COMPLETED.value
        
        await db.orders.update_one(
            {"id": payment.order_id},
            {"$set": {
                "payment_status": PaymentStatus.COMPLETED.value,
                "payment_method": payment.payment_method.value
            }}
        )
        
        # Award loyalty points if customer is eligible
        await award_loyalty_points(order["customer_id"], payment.order_id, float(payment.amount), order.get("order_number", ""))
    
    elif payment.payment_method == PaymentMethod.PAY_ON_COLLECTION:
        # Payment pending until collection
        payment_doc["status"] = PaymentStatus.PENDING.value
        
        await db.orders.update_one(
            {"id": payment.order_id},
            {"$set": {
                "payment_method": payment.payment_method.value
            }}
        )
    
    elif payment.payment_method == PaymentMethod.INVOICE:
        # Invoice - mark as pending, payment tracked separately
        payment_doc["status"] = PaymentStatus.PENDING.value
        
        await db.orders.update_one(
            {"id": payment.order_id},
            {"$set": {
                "payment_method": payment.payment_method.value
            }}
        )
    
    await db.payment_transactions.insert_one(payment_doc)
    payment_doc.pop("_id", None)
    
    return PaymentResponse(**payment_doc)

@api_router.get("/payments/status/{session_id}")
async def get_payment_status(session_id: str, current_user: dict = Depends(get_current_user)):
    from emergentintegrations.payments.stripe.checkout import StripeCheckout
    
    api_key = os.environ.get("STRIPE_API_KEY")
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url="")
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
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
                    "payment_method": PaymentMethod.CARD.value
                }}
            )
            
            order = await db.orders.find_one({"id": payment["order_id"]}, {"_id": 0})
            if order:
                # Award loyalty points
                await award_loyalty_points(order["customer_id"], payment["order_id"], float(payment["amount"]), order.get("order_number", ""))
    
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
                        "payment_method": PaymentMethod.CARD.value
                    }}
                )
        
        return {"received": True}
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        return {"received": True}


# ======================== METRICS ROUTES ========================

@api_router.get("/metrics/overview")
async def get_metrics_overview(
    period: str = "month",  # day, week, month, year
    current_user: dict = Depends(get_current_user)
):
    """Get key metrics with comparison to previous period"""
    now = datetime.now(timezone.utc)
    
    # Define periods
    if period == "day":
        current_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        previous_start = current_start - timedelta(days=1)
    elif period == "week":
        current_start = now - timedelta(days=now.weekday())
        current_start = current_start.replace(hour=0, minute=0, second=0, microsecond=0)
        previous_start = current_start - timedelta(weeks=1)
    elif period == "month":
        current_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        previous_start = (current_start - timedelta(days=1)).replace(day=1)
    else:  # year
        current_start = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        previous_start = current_start.replace(year=current_start.year - 1)
    
    current_start_str = current_start.isoformat()
    previous_start_str = previous_start.isoformat()
    previous_end_str = current_start.isoformat()
    
    # Current period orders
    current_orders = await db.orders.find({
        "timestamps.created_at": {"$gte": current_start_str},
        "payment_status": "completed"
    }, {"_id": 0}).to_list(10000)
    
    # Previous period orders
    previous_orders = await db.orders.find({
        "timestamps.created_at": {"$gte": previous_start_str, "$lt": previous_end_str},
        "payment_status": "completed"
    }, {"_id": 0}).to_list(10000)
    
    # Calculate metrics
    current_revenue = sum(o["total"] for o in current_orders)
    previous_revenue = sum(o["total"] for o in previous_orders)
    
    current_count = len(current_orders)
    previous_count = len(previous_orders)
    
    current_avg = current_revenue / current_count if current_count > 0 else 0
    previous_avg = previous_revenue / previous_count if previous_count > 0 else 0
    
    # New customers
    current_new_customers = await db.customers.count_documents({
        "created_at": {"$gte": current_start_str}
    })
    previous_new_customers = await db.customers.count_documents({
        "created_at": {"$gte": previous_start_str, "$lt": previous_end_str}
    })
    
    def calc_change(current, previous):
        if previous == 0:
            return 100 if current > 0 else 0
        return round(((current - previous) / previous) * 100, 1)
    
    return {
        "period": period,
        "current_period": {
            "start": current_start_str,
            "revenue": round(current_revenue, 2),
            "orders": current_count,
            "average_order_value": round(current_avg, 2),
            "new_customers": current_new_customers
        },
        "previous_period": {
            "start": previous_start_str,
            "revenue": round(previous_revenue, 2),
            "orders": previous_count,
            "average_order_value": round(previous_avg, 2),
            "new_customers": previous_new_customers
        },
        "changes": {
            "revenue": calc_change(current_revenue, previous_revenue),
            "orders": calc_change(current_count, previous_count),
            "average_order_value": calc_change(current_avg, previous_avg),
            "new_customers": calc_change(current_new_customers, previous_new_customers)
        }
    }

@api_router.get("/metrics/revenue")
async def get_revenue_metrics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    group_by: str = "day",  # day, week, month
    current_user: dict = Depends(get_current_user)
):
    """Get revenue breakdown over time"""
    query = {"payment_status": "completed"}
    
    if date_from:
        query["timestamps.created_at"] = {"$gte": date_from}
    if date_to:
        if "timestamps.created_at" in query:
            query["timestamps.created_at"]["$lte"] = date_to
        else:
            query["timestamps.created_at"] = {"$lte": date_to}
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
    
    from collections import defaultdict
    revenue_data = defaultdict(lambda: {"revenue": 0, "orders": 0, "items": 0})
    
    for order in orders:
        created_at = order.get("timestamps", {}).get("created_at", "")
        if not created_at:
            continue
        
        if group_by == "day":
            key = created_at[:10]
        elif group_by == "week":
            from datetime import datetime as dt
            date = dt.fromisoformat(created_at.replace("Z", "+00:00"))
            key = f"{date.year}-W{date.isocalendar()[1]:02d}"
        else:  # month
            key = created_at[:7]
        
        revenue_data[key]["revenue"] += order["total"]
        revenue_data[key]["orders"] += 1
        revenue_data[key]["items"] += sum(i["quantity"] for i in order.get("items", []))
    
    result = [{"period": k, **v} for k, v in sorted(revenue_data.items())]
    
    return {
        "group_by": group_by,
        "data": result,
        "total_revenue": sum(d["revenue"] for d in result),
        "total_orders": sum(d["orders"] for d in result)
    }

@api_router.get("/metrics/items")
async def get_item_metrics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get item/service performance metrics"""
    query = {"payment_status": "completed"}
    
    if date_from:
        query["timestamps.created_at"] = {"$gte": date_from}
    if date_to:
        if "timestamps.created_at" in query:
            query["timestamps.created_at"]["$lte"] = date_to
        else:
            query["timestamps.created_at"] = {"$lte": date_to}
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
    
    item_stats = {}
    for order in orders:
        for item in order.get("items", []):
            name = item["item_name"]
            if name not in item_stats:
                item_stats[name] = {
                    "name": name,
                    "quantity": 0,
                    "revenue": 0,
                    "orders": 0,
                    "by_service_type": {"regular": 0, "express": 0, "delicate": 0}
                }
            item_stats[name]["quantity"] += item["quantity"]
            item_stats[name]["revenue"] += item["total_price"] - item.get("discount_applied", 0)
            item_stats[name]["orders"] += 1
            service_type = item.get("service_type", "regular")
            item_stats[name]["by_service_type"][service_type] += item["quantity"]
    
    sorted_items = sorted(item_stats.values(), key=lambda x: x["revenue"], reverse=True)
    
    return {
        "items": sorted_items,
        "total_items": sum(i["quantity"] for i in sorted_items),
        "total_revenue": sum(i["revenue"] for i in sorted_items)
    }

@api_router.get("/metrics/customers")
async def get_customer_metrics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get customer analytics"""
    query = {"payment_status": "completed"}
    
    if date_from:
        query["timestamps.created_at"] = {"$gte": date_from}
    if date_to:
        if "timestamps.created_at" in query:
            query["timestamps.created_at"]["$lte"] = date_to
        else:
            query["timestamps.created_at"] = {"$lte": date_to}
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
    
    customer_stats = {}
    for order in orders:
        cid = order["customer_id"]
        if cid not in customer_stats:
            customer_stats[cid] = {
                "customer_id": cid,
                "customer_name": order["customer_name"],
                "customer_type": order.get("customer_type", "retail"),
                "orders": 0,
                "revenue": 0
            }
        customer_stats[cid]["orders"] += 1
        customer_stats[cid]["revenue"] += order["total"]
    
    sorted_customers = sorted(customer_stats.values(), key=lambda x: x["revenue"], reverse=True)
    
    # Customer type breakdown
    retail_count = sum(1 for c in sorted_customers if c["customer_type"] == "retail")
    business_count = sum(1 for c in sorted_customers if c["customer_type"] == "business")
    retail_revenue = sum(c["revenue"] for c in sorted_customers if c["customer_type"] == "retail")
    business_revenue = sum(c["revenue"] for c in sorted_customers if c["customer_type"] == "business")
    
    return {
        "top_customers": sorted_customers[:20],
        "total_customers": len(sorted_customers),
        "by_type": {
            "retail": {"count": retail_count, "revenue": retail_revenue},
            "business": {"count": business_count, "revenue": business_revenue}
        },
        "average_customer_value": sum(c["revenue"] for c in sorted_customers) / len(sorted_customers) if sorted_customers else 0
    }

@api_router.get("/metrics/payments")
async def get_payment_metrics(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get payment method breakdown"""
    query = {"payment_status": "completed"}
    
    if date_from:
        query["timestamps.created_at"] = {"$gte": date_from}
    if date_to:
        if "timestamps.created_at" in query:
            query["timestamps.created_at"]["$lte"] = date_to
        else:
            query["timestamps.created_at"] = {"$lte": date_to}
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
    
    payment_stats = {}
    for order in orders:
        method = order.get("payment_method", "unknown")
        if method not in payment_stats:
            payment_stats[method] = {"method": method, "count": 0, "revenue": 0}
        payment_stats[method]["count"] += 1
        payment_stats[method]["revenue"] += order["total"]
    
    return {
        "by_method": list(payment_stats.values()),
        "total_revenue": sum(p["revenue"] for p in payment_stats.values())
    }

@api_router.get("/metrics/export/{report_type}")
async def export_metrics(
    report_type: str,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Export metrics as CSV"""
    query = {}
    if date_from:
        query["timestamps.created_at"] = {"$gte": date_from}
    if date_to:
        if "timestamps.created_at" in query:
            query["timestamps.created_at"]["$lte"] = date_to
        else:
            query["timestamps.created_at"] = {"$lte": date_to}
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    if report_type == "orders":
        writer.writerow(["Order Number", "Date", "Customer", "Items", "Subtotal", "Tax", "Discount", "Total", "Status", "Payment"])
        orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
        for o in orders:
            writer.writerow([
                o["order_number"],
                o.get("timestamps", {}).get("created_at", "")[:10],
                o["customer_name"],
                sum(i["quantity"] for i in o.get("items", [])),
                o["subtotal"],
                o["tax"],
                o.get("customer_discount_amount", 0) + o.get("volume_discount_amount", 0) + o.get("manual_discount", 0),
                o["total"],
                o["status"],
                o.get("payment_method", "")
            ])
    
    elif report_type == "customers":
        writer.writerow(["Name", "Type", "Phone", "Email", "Total Orders", "Total Spent", "Avg Order", "Discount %", "Status"])
        customers = await db.customers.find({}, {"_id": 0}).to_list(10000)
        for c in customers:
            status = "Blacklisted" if c.get("is_blacklisted") else "Active"
            writer.writerow([
                c["name"],
                c.get("customer_type", "retail"),
                c["phone"],
                c.get("email", ""),
                c.get("total_orders", 0),
                c.get("total_spent", 0),
                c.get("average_order_value", 0),
                c.get("discount_percent", 0),
                status
            ])
    
    elif report_type == "items":
        query["payment_status"] = "completed"
        orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
        
        item_stats = {}
        for order in orders:
            for item in order.get("items", []):
                name = item["item_name"]
                if name not in item_stats:
                    item_stats[name] = {"quantity": 0, "revenue": 0}
                item_stats[name]["quantity"] += item["quantity"]
                item_stats[name]["revenue"] += item["total_price"]
        
        writer.writerow(["Item Name", "Quantity Sold", "Revenue"])
        for name, stats in sorted(item_stats.items(), key=lambda x: x[1]["revenue"], reverse=True):
            writer.writerow([name, stats["quantity"], stats["revenue"]])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={report_type}_report.csv"}
    )


# ======================== REPORTS ROUTES (Legacy) ========================

@api_router.get("/reports/sales")
async def get_sales_report(
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {"payment_status": PaymentStatus.COMPLETED.value}
    
    if date_from or date_to:
        query["timestamps.created_at"] = {}
        if date_from:
            query["timestamps.created_at"]["$gte"] = date_from
        if date_to:
            query["timestamps.created_at"]["$lte"] = date_to
    
    orders = await db.orders.find(query, {"_id": 0}).to_list(10000)
    
    total_sales = sum(o["total"] for o in orders)
    total_orders = len(orders)
    avg_order_value = total_sales / total_orders if total_orders > 0 else 0
    
    payment_breakdown = {"cash": 0, "card": 0, "bank_transfer": 0, "pay_on_collection": 0, "invoice": 0}
    for o in orders:
        method = o.get("payment_method", "cash")
        payment_breakdown[method] = payment_breakdown.get(method, 0) + o["total"]
    
    item_counts = {}
    for o in orders:
        for item in o.get("items", []):
            name = item["item_name"]
            if name not in item_counts:
                item_counts[name] = {"name": name, "quantity": 0, "revenue": 0}
            item_counts[name]["quantity"] += item["quantity"]
            item_counts[name]["revenue"] += item["total_price"]
    
    top_items = sorted(item_counts.values(), key=lambda x: x["revenue"], reverse=True)[:10]
    
    daily_sales = {}
    for o in orders:
        date = o.get("timestamps", {}).get("created_at", "")[:10]
        if date:
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
    
    today_orders = await db.orders.find(
        {"timestamps.created_at": {"$gte": today}},
        {"_id": 0}
    ).to_list(1000)
    
    today_revenue = sum(o["total"] for o in today_orders if o["payment_status"] == "completed")
    today_order_count = len(today_orders)
    
    cleaning_orders = await db.orders.count_documents({"status": "cleaning"})
    ready_orders = await db.orders.count_documents({"status": "ready"})
    
    delivery_orders = await db.orders.count_documents({
        "delivery_info": {"$ne": None},
        "status": {"$nin": ["delivered", "collected", "cancelled"]}
    })
    
    total_customers = await db.customers.count_documents({})
    
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("timestamps.created_at", -1).to_list(5)
    
    return {
        "today_revenue": today_revenue,
        "today_orders": today_order_count,
        "cleaning_orders": cleaning_orders,
        "ready_orders": ready_orders,
        "delivery_orders": delivery_orders,
        "total_customers": total_customers,
        "recent_orders": recent_orders
    }


# ======================== SEED DATA ========================

@api_router.post("/seed")
async def seed_data():
    items_count = await db.items.count_documents({})
    if items_count > 0:
        return {"message": "Data already seeded"}
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Default categories
    default_categories = [
        {"name": "Men's Suits", "description": "Business and formal suits", "sort_order": 1},
        {"name": "Women's Wear", "description": "Dresses, blouses, and formal wear", "sort_order": 2},
        {"name": "Shirts & Tops", "description": "Shirts, blouses, and tops", "sort_order": 3},
        {"name": "Pants & Bottoms", "description": "Pants, skirts, and trousers", "sort_order": 4},
        {"name": "Outerwear", "description": "Coats, jackets, and blazers", "sort_order": 5},
        {"name": "Accessories", "description": "Ties, scarves, and accessories", "sort_order": 6},
        {"name": "Household", "description": "Bedding, curtains, and linens", "sort_order": 7},
        {"name": "Special Care", "description": "Wedding, leather, and delicate items", "sort_order": 8},
    ]
    
    category_ids = {}
    for cat in default_categories:
        cat_id = str(uuid.uuid4())
        category_ids[cat["name"]] = cat_id
        cat["id"] = cat_id
        cat["is_active"] = True
        cat["created_at"] = now
    
    await db.categories.insert_many(default_categories)
    
    # Parent item for Men's Suit
    mens_suit_id = str(uuid.uuid4())
    
    default_items = [
        # Men's Suits - Parent
        {
            "id": mens_suit_id,
            "name": "Men's Suit", "category_id": category_ids["Men's Suits"], "category_name": "Men's Suits",
            "prices": {"regular": 15.99, "express": 22.99, "delicate": 28.99},
            "description": "Complete men's suit cleaning", "parent_id": None, "parent_name": None,
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}, {"min_quantity": 5, "discount_percent": 15}]
        },
        # Men's Suits - Children
        {
            "name": "2 Piece Suit", "category_id": category_ids["Men's Suits"], "category_name": "Men's Suits",
            "prices": {"regular": 12.99, "express": 18.99, "delicate": 24.99},
            "description": "Jacket and pants", "parent_id": mens_suit_id, "parent_name": "Men's Suit",
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}]
        },
        {
            "name": "3 Piece Suit", "category_id": category_ids["Men's Suits"], "category_name": "Men's Suits",
            "prices": {"regular": 18.99, "express": 26.99, "delicate": 34.99},
            "description": "Jacket, pants, and vest", "parent_id": mens_suit_id, "parent_name": "Men's Suit",
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}]
        },
        # Shirts
        {
            "name": "Dress Shirt", "category_id": category_ids["Shirts & Tops"], "category_name": "Shirts & Tops",
            "prices": {"regular": 3.99, "express": 5.99, "delicate": 6.99},
            "description": "Standard button-up shirt", "parent_id": None, "parent_name": None,
            "volume_discounts": [{"min_quantity": 5, "discount_percent": 10}, {"min_quantity": 10, "discount_percent": 15}]
        },
        {
            "name": "Blouse", "category_id": category_ids["Shirts & Tops"], "category_name": "Shirts & Tops",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99},
            "description": "Women's blouse", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        {
            "name": "Sweater", "category_id": category_ids["Shirts & Tops"], "category_name": "Shirts & Tops",
            "prices": {"regular": 5.99, "express": 8.99, "delicate": 10.99},
            "description": "Pullover or cardigan", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        # Pants
        {
            "name": "Dress Pants", "category_id": category_ids["Pants & Bottoms"], "category_name": "Pants & Bottoms",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 8.99},
            "description": "Dress pants, slacks", "parent_id": None, "parent_name": None,
            "volume_discounts": [{"min_quantity": 5, "discount_percent": 10}]
        },
        {
            "name": "Skirt", "category_id": category_ids["Pants & Bottoms"], "category_name": "Pants & Bottoms",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99},
            "description": "Standard skirt", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        # Women's Wear
        {
            "name": "Dress", "category_id": category_ids["Women's Wear"], "category_name": "Women's Wear",
            "prices": {"regular": 9.99, "express": 14.99, "delicate": 18.99},
            "description": "Standard dress", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        {
            "name": "Evening Gown", "category_id": category_ids["Women's Wear"], "category_name": "Women's Wear",
            "prices": {"regular": 24.99, "express": 34.99, "delicate": 44.99},
            "description": "Formal evening gown", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        # Outerwear
        {
            "name": "Blazer", "category_id": category_ids["Outerwear"], "category_name": "Outerwear",
            "prices": {"regular": 8.99, "express": 12.99, "delicate": 15.99},
            "description": "Business blazer", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        {
            "name": "Coat", "category_id": category_ids["Outerwear"], "category_name": "Outerwear",
            "prices": {"regular": 12.99, "express": 18.99, "delicate": 24.99},
            "description": "Winter coat", "parent_id": None, "parent_name": None,
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}, {"min_quantity": 5, "discount_percent": 15}]
        },
        # Accessories
        {
            "name": "Tie", "category_id": category_ids["Accessories"], "category_name": "Accessories",
            "prices": {"regular": 2.99, "express": 4.49, "delicate": 5.99},
            "description": "Necktie", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        {
            "name": "Scarf", "category_id": category_ids["Accessories"], "category_name": "Accessories",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99},
            "description": "Scarf or shawl", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        # Household
        {
            "name": "Comforter", "category_id": category_ids["Household"], "category_name": "Household",
            "prices": {"regular": 24.99, "express": 34.99, "delicate": 44.99},
            "description": "Comforter or duvet", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        {
            "name": "Sheet Set", "category_id": category_ids["Household"], "category_name": "Household",
            "prices": {"regular": 14.99, "express": 21.99, "delicate": 29.99},
            "description": "Sheet set", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        # Special Care
        {
            "name": "Wedding Dress", "category_id": category_ids["Special Care"], "category_name": "Special Care",
            "prices": {"regular": 149.99, "express": 199.99, "delicate": 249.99},
            "description": "Wedding gown cleaning", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
        {
            "name": "Leather Jacket", "category_id": category_ids["Special Care"], "category_name": "Special Care",
            "prices": {"regular": 49.99, "express": 69.99, "delicate": 89.99},
            "description": "Leather cleaning", "parent_id": None, "parent_name": None,
            "volume_discounts": None
        },
    ]
    
    for item in default_items:
        if "id" not in item:
            item["id"] = str(uuid.uuid4())
        item["is_active"] = True
        item["created_at"] = now
    
    await db.items.insert_many(default_items)
    
    # Create default admin
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
    
    # Create default settings
    settings_exist = await db.settings.find_one({"id": "default"})
    if not settings_exist:
        default_settings = {
            "id": "default",
            "settings": BusinessSettings().model_dump(),
            "updated_at": now
        }
        await db.settings.insert_one(default_settings)
    
    return {"message": "Data seeded successfully", "items_created": len(default_items), "categories_created": len(default_categories)}


# ======================== ROOT ========================

@api_router.get("/")
async def root():
    return {"message": "DryClean POS API", "version": "3.0.0"}

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
