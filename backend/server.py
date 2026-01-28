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
    OUT_FOR_DELIVERY = "out_for_delivery"
    DELIVERED = "delivered"
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

class DeliveryType(str, Enum):
    PICKUP = "pickup"
    DELIVERY = "delivery"
    BOTH = "both"


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

class BusinessSettings(BaseModel):
    business_name: str = "DryClean POS"
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    country: CountrySettings = CountrySettings()
    tax: TaxSettings = TaxSettings()
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

class ItemResponse(ItemBase):
    id: str
    category_name: Optional[str] = None
    parent_name: Optional[str] = None
    children: Optional[List[dict]] = None
    created_at: str


# Customer Models
class CustomerPreferences(BaseModel):
    starch_level: Optional[str] = "medium"
    fold_style: Optional[str] = "standard"
    special_instructions: Optional[str] = None

class CustomerMeasurements(BaseModel):
    shirt_size: Optional[str] = None
    pant_waist: Optional[str] = None
    pant_length: Optional[str] = None

class CustomerAddress(BaseModel):
    street: str
    city: str
    state: Optional[str] = None
    postal_code: str
    country: str = "US"
    is_default: bool = False
    label: str = "Home"

class CustomerBase(BaseModel):
    name: str
    phone: str
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    addresses: Optional[List[CustomerAddress]] = None
    preferences: Optional[CustomerPreferences] = None
    measurements: Optional[CustomerMeasurements] = None

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    addresses: Optional[List[CustomerAddress]] = None
    preferences: Optional[CustomerPreferences] = None
    measurements: Optional[CustomerMeasurements] = None

class CustomerResponse(CustomerBase):
    id: str
    loyalty_points: int = 0
    total_orders: int = 0
    total_spent: float = 0.0
    created_at: str


# Order Models
class OrderItem(BaseModel):
    item_id: str
    item_name: str
    quantity: int
    service_type: ServiceType
    unit_price: float
    total_price: float
    discount_applied: float = 0.0
    notes: Optional[str] = None

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

class OrderBase(BaseModel):
    customer_id: str
    customer_name: str
    customer_phone: str
    items: List[OrderItem]
    subtotal: float
    tax: float
    tax_details: Optional[Dict[str, float]] = None
    discount: float = 0.0
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


# Delivery Schedule Models
class DeliveryScheduleCreate(BaseModel):
    order_id: str
    type: DeliveryType
    scheduled_date: str
    time_slot: str
    address: CustomerAddress
    driver_id: Optional[str] = None
    notes: Optional[str] = None

class DeliveryScheduleResponse(BaseModel):
    id: str
    order_id: str
    order_number: str
    customer_name: str
    customer_phone: str
    type: DeliveryType
    scheduled_date: str
    time_slot: str
    address: CustomerAddress
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    status: str
    notes: Optional[str] = None
    created_at: str


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
    """Calculate discount based on volume"""
    if not volume_discounts:
        return 0.0
    
    applicable_discount = 0.0
    for vd in sorted(volume_discounts, key=lambda x: x.min_quantity, reverse=True):
        if quantity >= vd.min_quantity:
            applicable_discount = vd.discount_percent
            break
    
    return applicable_discount


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
        # Return default settings
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
    
    # Get max sort_order if not provided
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
    
    # Check if category has items
    items_count = await db.items.count_documents({"category_id": category_id})
    if items_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {items_count} items. Move or delete items first.")
    
    result = await db.categories.delete_one({"id": category_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    return {"message": "Category deleted"}

@api_router.put("/categories/reorder")
async def reorder_categories(category_orders: List[Dict[str, Any]], current_user: dict = Depends(get_current_user)):
    """Update sort order for multiple categories"""
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
    
    # Get category name
    category = await db.categories.find_one({"id": item.category_id}, {"_id": 0})
    category_name = category["name"] if category else None
    
    # Get parent name if exists
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
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category_id:
        query["category_id"] = category_id
    if active_only:
        query["is_active"] = True
    
    items = await db.items.find(query, {"_id": 0}).to_list(1000)
    
    # Build parent-child relationships
    if include_children:
        parent_items = [i for i in items if not i.get("parent_id")]
        child_items = [i for i in items if i.get("parent_id")]
        
        for parent in parent_items:
            parent["children"] = [c for c in child_items if c.get("parent_id") == parent["id"]]
        
        return [ItemResponse(**i) for i in parent_items]
    
    return [ItemResponse(**i) for i in items]

@api_router.get("/items/all")
async def get_all_items(
    active_only: bool = True,
    current_user: dict = Depends(get_current_user)
):
    """Get all items flat (no parent-child grouping)"""
    query = {"is_active": True} if active_only else {}
    items = await db.items.find(query, {"_id": 0}).to_list(1000)
    return [ItemResponse(**i) for i in items]

@api_router.get("/items/{item_id}", response_model=ItemResponse)
async def get_item(item_id: str, current_user: dict = Depends(get_current_user)):
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get children if this is a parent item
    children = await db.items.find({"parent_id": item_id}, {"_id": 0}).to_list(100)
    item["children"] = children
    
    return ItemResponse(**item)

@api_router.put("/items/{item_id}", response_model=ItemResponse)
async def update_item(item_id: str, update: ItemUpdate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    
    # Handle nested models
    if "prices" in update_data and hasattr(update_data["prices"], "model_dump"):
        update_data["prices"] = update_data["prices"].model_dump()
    if "volume_discounts" in update_data and update_data["volume_discounts"]:
        update_data["volume_discounts"] = [vd.model_dump() if hasattr(vd, "model_dump") else vd for vd in update_data["volume_discounts"]]
    
    # Update category name if category changed
    if "category_id" in update_data:
        category = await db.categories.find_one({"id": update_data["category_id"]}, {"_id": 0})
        update_data["category_name"] = category["name"] if category else None
    
    # Update parent name if parent changed
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
    
    # Check if item has children
    children_count = await db.items.count_documents({"parent_id": item_id})
    if children_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete item with {children_count} child items")
    
    result = await db.items.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

@api_router.get("/item-categories")
async def get_item_categories(current_user: dict = Depends(get_current_user)):
    """Legacy endpoint - returns category names from items"""
    categories = await db.items.distinct("category_name")
    return {"categories": [c for c in categories if c]}


# ======================== ORDER ROUTES ========================

@api_router.post("/orders", response_model=OrderResponse)
async def create_order(order: OrderCreate, current_user: dict = Depends(get_current_user)):
    order_id = str(uuid.uuid4())
    order_number = generate_order_number()
    now = datetime.now(timezone.utc).isoformat()
    
    # Convert items to dict
    items_data = [item.model_dump() for item in order.items]
    
    # Convert delivery info if present
    delivery_data = order.delivery_info.model_dump() if order.delivery_info else None
    
    doc = {
        "id": order_id,
        "order_number": order_number,
        "customer_id": order.customer_id,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "items": items_data,
        "subtotal": order.subtotal,
        "tax": order.tax,
        "tax_details": order.tax_details,
        "discount": order.discount,
        "total": order.total,
        "notes": order.notes,
        "estimated_ready": order.estimated_ready,
        "delivery_info": delivery_data,
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


# ======================== DELIVERY ROUTES ========================

@api_router.get("/deliveries")
async def get_deliveries(
    date: Optional[str] = None,
    type: Optional[DeliveryType] = None,
    driver_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all orders with delivery/pickup scheduled"""
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
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    
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
            "created_at": order["created_at"]
        })
    
    return deliveries

@api_router.put("/orders/{order_id}/delivery")
async def update_order_delivery(
    order_id: str,
    delivery_info: DeliveryInfo,
    current_user: dict = Depends(get_current_user)
):
    """Update delivery information for an order"""
    now = datetime.now(timezone.utc).isoformat()
    
    result = await db.orders.update_one(
        {"id": order_id},
        {"$set": {"delivery_info": delivery_info.model_dump(), "updated_at": now}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Order not found")
    
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    return OrderResponse(**order)

@api_router.get("/drivers")
async def get_drivers(current_user: dict = Depends(get_current_user)):
    """Get list of users who can be assigned as drivers"""
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
    
    return PaymentResponse(**payment_doc)

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
    
    # Delivery stats
    delivery_orders = await db.orders.count_documents({
        "delivery_info": {"$ne": None},
        "status": {"$nin": ["delivered", "picked_up", "cancelled"]}
    })
    
    # Total customers
    total_customers = await db.customers.count_documents({})
    
    # Recent orders
    recent_orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(5)
    
    return {
        "today_revenue": today_revenue,
        "today_orders": today_order_count,
        "pending_orders": pending_orders,
        "ready_orders": ready_orders,
        "delivery_orders": delivery_orders,
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
    
    # Default items with parent-child relationships and volume discounts
    default_items = [
        # Men's Suits - Parent
        {
            "name": "Men's Suit", "category_id": category_ids["Men's Suits"], "category_name": "Men's Suits",
            "prices": {"regular": 15.99, "express": 22.99, "delicate": 28.99},
            "description": "Complete men's suit cleaning", "parent_id": None,
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}, {"min_quantity": 5, "discount_percent": 15}]
        },
        # Men's Suits - Children
        {
            "name": "2 Piece Suit", "category_id": category_ids["Men's Suits"], "category_name": "Men's Suits",
            "prices": {"regular": 12.99, "express": 18.99, "delicate": 24.99},
            "description": "Jacket and pants", "parent_id": "mens_suit",
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}]
        },
        {
            "name": "3 Piece Suit", "category_id": category_ids["Men's Suits"], "category_name": "Men's Suits",
            "prices": {"regular": 18.99, "express": 26.99, "delicate": 34.99},
            "description": "Jacket, pants, and vest", "parent_id": "mens_suit",
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}]
        },
        # Shirts
        {
            "name": "Dress Shirt", "category_id": category_ids["Shirts & Tops"], "category_name": "Shirts & Tops",
            "prices": {"regular": 3.99, "express": 5.99, "delicate": 6.99},
            "description": "Standard button-up or dress shirt",
            "volume_discounts": [{"min_quantity": 5, "discount_percent": 10}, {"min_quantity": 10, "discount_percent": 15}]
        },
        {
            "name": "Blouse", "category_id": category_ids["Shirts & Tops"], "category_name": "Shirts & Tops",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99},
            "description": "Women's blouse"
        },
        {
            "name": "Sweater", "category_id": category_ids["Shirts & Tops"], "category_name": "Shirts & Tops",
            "prices": {"regular": 5.99, "express": 8.99, "delicate": 10.99},
            "description": "Pullover or cardigan sweater"
        },
        # Pants
        {
            "name": "Dress Pants", "category_id": category_ids["Pants & Bottoms"], "category_name": "Pants & Bottoms",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 8.99},
            "description": "Dress pants, slacks, trousers",
            "volume_discounts": [{"min_quantity": 5, "discount_percent": 10}]
        },
        {
            "name": "Skirt", "category_id": category_ids["Pants & Bottoms"], "category_name": "Pants & Bottoms",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99},
            "description": "Standard skirt"
        },
        # Women's Wear
        {
            "name": "Dress", "category_id": category_ids["Women's Wear"], "category_name": "Women's Wear",
            "prices": {"regular": 9.99, "express": 14.99, "delicate": 18.99},
            "description": "Standard dress"
        },
        {
            "name": "Evening Gown", "category_id": category_ids["Women's Wear"], "category_name": "Women's Wear",
            "prices": {"regular": 24.99, "express": 34.99, "delicate": 44.99},
            "description": "Formal evening gown"
        },
        # Outerwear
        {
            "name": "Blazer", "category_id": category_ids["Outerwear"], "category_name": "Outerwear",
            "prices": {"regular": 8.99, "express": 12.99, "delicate": 15.99},
            "description": "Business blazer"
        },
        {
            "name": "Coat", "category_id": category_ids["Outerwear"], "category_name": "Outerwear",
            "prices": {"regular": 12.99, "express": 18.99, "delicate": 24.99},
            "description": "Winter coat or overcoat",
            "volume_discounts": [{"min_quantity": 3, "discount_percent": 10}, {"min_quantity": 5, "discount_percent": 15}]
        },
        # Accessories
        {
            "name": "Tie", "category_id": category_ids["Accessories"], "category_name": "Accessories",
            "prices": {"regular": 2.99, "express": 4.49, "delicate": 5.99},
            "description": "Necktie"
        },
        {
            "name": "Scarf", "category_id": category_ids["Accessories"], "category_name": "Accessories",
            "prices": {"regular": 4.99, "express": 7.49, "delicate": 9.99},
            "description": "Scarf or shawl"
        },
        # Household
        {
            "name": "Comforter", "category_id": category_ids["Household"], "category_name": "Household",
            "prices": {"regular": 24.99, "express": 34.99, "delicate": 44.99},
            "description": "Comforter or duvet"
        },
        {
            "name": "Sheet Set", "category_id": category_ids["Household"], "category_name": "Household",
            "prices": {"regular": 14.99, "express": 21.99, "delicate": 29.99},
            "description": "Sheet set"
        },
        {
            "name": "Curtains (per panel)", "category_id": category_ids["Household"], "category_name": "Household",
            "prices": {"regular": 19.99, "express": 29.99, "delicate": 39.99},
            "description": "Per panel"
        },
        # Special Care
        {
            "name": "Wedding Dress", "category_id": category_ids["Special Care"], "category_name": "Special Care",
            "prices": {"regular": 149.99, "express": 199.99, "delicate": 249.99},
            "description": "Wedding gown cleaning and preservation"
        },
        {
            "name": "Leather Jacket", "category_id": category_ids["Special Care"], "category_name": "Special Care",
            "prices": {"regular": 49.99, "express": 69.99, "delicate": 89.99},
            "description": "Leather cleaning and conditioning"
        },
    ]
    
    # Process parent-child relationships
    parent_ids = {}
    for item in default_items:
        item_id = str(uuid.uuid4())
        item["id"] = item_id
        item["is_active"] = True
        item["created_at"] = now
        
        if item["name"] == "Men's Suit":
            parent_ids["mens_suit"] = item_id
        
        if item.get("parent_id") == "mens_suit":
            item["parent_id"] = parent_ids.get("mens_suit")
            item["parent_name"] = "Men's Suit"
        elif item.get("parent_id") is None:
            item["parent_name"] = None
    
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
    return {"message": "DryClean POS API", "version": "2.0.0"}

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
