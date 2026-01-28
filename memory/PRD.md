# DryClean POS - Product Requirements Document

## Original Problem Statement
Build a complete web based dry cleaning business app that is modern, based on best practices and workflow. Must have POS and be able to link to a garment label printer, a receipt printer and cash drawer.

## User Personas
1. **Store Owner/Manager** - Needs comprehensive reports, staff management, full system access
2. **Cashier/Staff** - Day-to-day POS operations, order processing, customer management
3. **Delivery Driver** - Pickup and delivery schedule management
4. **Customers** - Receive order tracking, receipts, loyalty points

## Core Requirements
- Extended customer profiles with preferences, measurements, loyalty points
- Advanced workflow with status tracking (Received → Processing → Ready → Out for Delivery → Delivered/Picked Up)
- Variable pricing with service types (Regular, Express, Delicate)
- Multi-payment support: Cash, Card (Stripe), Bank Transfer
- Direct thermal printer integration via WebUSB API (ESC/POS)
- Comprehensive reports and analytics
- JWT-based authentication with role-based access
- **Country/Region settings with currency and date format**
- **Tax management (VAT/GST/Sales Tax) with multiple tax support**
- **Category management with add/edit/delete and sort order**
- **Parent-child item relationships (e.g., Men's Suits > 2 Piece, 3 Piece)**
- **Volume discounts (e.g., 3 coats = 10% off, 5 coats = 15% off)**
- **Pickup & Delivery module with scheduling**

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe (via emergentintegrations)
- **Hardware**: WebUSB API for ESC/POS printers

## What's Been Implemented (Dec 2025)

### Backend (/app/backend/server.py)
- [x] JWT Authentication (register, login, token validation)
- [x] User Management (admin, manager, staff roles)
- [x] Customer CRUD with preferences, measurements, loyalty points, multiple addresses
- [x] Category Management (CRUD, sort order, reordering)
- [x] Items/Services with parent-child relationships and volume discounts
- [x] Order Management with delivery support
- [x] Payment Processing (cash, card via Stripe, bank transfer)
- [x] Delivery Management endpoints
- [x] Settings API (business, country, tax)
- [x] Reports API (sales, trends, payment breakdown)
- [x] Data seeding with 8 categories and 19 items

### Frontend Pages
- [x] Login Page with demo account
- [x] Dashboard with stats and quick actions
- [x] POS Terminal with cart, volume discounts, delivery toggle
- [x] Customers Page with CRUD and detailed profiles
- [x] Orders Page with status workflow management
- [x] Items/Services Page with parent-child accordion and volume discounts
- [x] **Delivery Page** - Pickup & Delivery schedule management
- [x] Reports Page with charts (Recharts)
- [x] Staff Page with team management
- [x] **Settings Page** with 5 tabs:
  - Business (name, address, phone, email, automation)
  - Country (dropdown with 10 countries, auto-updates currency/format)
  - Tax (name, rate, registration number, inclusive toggle, additional taxes)
  - Categories (CRUD, sort order arrows, active status)
  - Hardware (printer connections, cash drawer)
- [x] Payment Success Page

### Hardware Integration
- [x] WebUSB printer library
- [x] ESC/POS command support
- [x] Receipt/Label formatting
- [x] Cash drawer kick command
- [x] Browser print fallback

## Default Credentials
- Email: admin@dryclean.com
- Password: admin123

## API Endpoints
- Authentication: POST /api/auth/register, /api/auth/login, GET /api/auth/me
- Settings: GET/PUT /api/settings, PUT /api/settings/country, PUT /api/settings/tax
- Categories: CRUD /api/categories, PUT /api/categories/reorder
- Customers: CRUD /api/customers
- Items: CRUD /api/items, GET /api/items/all
- Orders: CRUD /api/orders, PUT /api/orders/{id}/status, PUT /api/orders/{id}/delivery
- Deliveries: GET /api/deliveries, GET /api/drivers
- Payments: POST /api/payments, GET /api/payments/status/{session_id}
- Reports: GET /api/reports/sales, GET /api/reports/dashboard
- Users: GET /api/users
- Seed: POST /api/seed

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] POS cart with volume discounts
- [x] Country/Tax settings
- [x] Category management with sort order
- [x] Parent-child items
- [x] Pickup & Delivery module

### P1 (High Priority)
- [ ] SMS/Email notifications for order status changes
- [ ] Barcode/QR code generation for garment labels
- [ ] Real thermal printer testing and refinement
- [ ] Customer address management in POS

### P2 (Medium Priority)
- [ ] Route optimization for deliveries
- [ ] Inventory management for supplies
- [ ] Loyalty program rewards redemption
- [ ] Multi-location support
- [ ] Employee time tracking

### P3 (Nice to Have)
- [ ] Customer portal for order tracking
- [ ] Mobile app version
- [ ] Advanced analytics with AI insights
- [ ] Integration with accounting software

## Next Tasks
1. Add SMS notification integration (Twilio) for order status updates
2. Implement barcode generation for labels
3. Add map integration for delivery routing
4. Customer self-service portal
