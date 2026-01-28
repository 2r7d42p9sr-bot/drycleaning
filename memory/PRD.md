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
- Multi-payment support: Cash, Card (Stripe), Bank Transfer, Pay on Collection, Invoice (Business)
- Direct thermal printer integration via WebUSB API (ESC/POS)
- Comprehensive reports and analytics
- JWT-based authentication with role-based access
- Country/Region settings with currency and date format
- Tax management (VAT/GST/Sales Tax) with multiple tax support
- Category management with add/edit/delete and sort order
- Parent-child item relationships (e.g., Men's Suits > 2 Piece, 3 Piece)
- Volume discounts (e.g., 3 coats = 10% off, 5 coats = 15% off)
- Pickup & Delivery module with scheduling
- Business Metrics with exportable reports

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Payments**: Stripe (via emergentintegrations)
- **Hardware**: WebUSB API for ESC/POS printers

## What's Been Implemented (Jan 2026)

### Iteration 1 - Core MVP
- [x] JWT Authentication (register, login, token validation)
- [x] User Management (admin, manager, staff roles)
- [x] Customer CRUD with preferences, measurements, loyalty points
- [x] Items/Services with pricing by service type
- [x] Order Management with status workflow
- [x] Payment Processing (cash, card via Stripe, bank transfer)
- [x] Reports with sales charts

### Iteration 2 - Enhanced Features
- [x] Category Management (CRUD, sort order, reordering)
- [x] Parent-child item relationships
- [x] Volume discounts on items
- [x] Country/Tax settings
- [x] Pickup & Delivery module
- [x] WebUSB printer library with browser fallback

### Iteration 3 - Advanced Features (Current)
- [x] **POS 3-Tab Workflow**: New Order, Cleaning, Ready tabs for order management
- [x] **Parent-Child Item Selection**: Clicking parent item shows child options modal
- [x] **Volume Discount Visibility**: Shows "Add X more for Y% off" hints in cart
- [x] **Customer Discount Display**: Customer-specific discounts visible in cart
- [x] **New Payment Methods**: 
  - Pay on Collection (deferred payment)
  - Invoice for Business Customers
- [x] **Enhanced Customer Profiles**:
  - Overview, Stats, Orders tabs
  - Business/Retail customer type
  - Company info for business customers
  - Customer-specific discount percentage
  - Blacklist flag (blocks orders)
  - Force advance payment flag
- [x] **Business Metrics Page**:
  - KPI cards with period comparison
  - Revenue over time charts
  - Top items performance
  - Customer analytics
  - Payment method breakdown
  - CSV export for Orders, Customers, Items

### Frontend Pages
- [x] Login Page with demo account
- [x] Dashboard with stats and quick actions
- [x] POS Terminal with 3-tab workflow
- [x] Customers Page with enhanced profiles
- [x] Orders Page with status workflow management
- [x] Items/Services Page with parent-child accordion
- [x] Delivery Page - Pickup & Delivery schedule
- [x] **Metrics Page** - Business analytics dashboard
- [x] Reports Page with charts
- [x] Staff Page with team management
- [x] Settings Page with 5 tabs

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

### Authentication
- POST /api/auth/register, /api/auth/login
- GET /api/auth/me

### Settings
- GET/PUT /api/settings
- PUT /api/settings/country, /api/settings/tax

### Categories
- CRUD /api/categories
- PUT /api/categories/reorder

### Customers
- CRUD /api/customers
- GET /api/customers/{id}/stats
- GET /api/customers/{id}/orders

### Items
- CRUD /api/items
- GET /api/items/all
- GET /api/items/children/{parent_id}

### Orders
- CRUD /api/orders
- PUT /api/orders/{id}/status
- PUT /api/orders/{id}/delivery
- GET /api/orders/by-status (for POS tabs)

### Payments
- POST /api/payments
- GET /api/payments/status/{session_id}

### Metrics (NEW)
- GET /api/metrics/overview
- GET /api/metrics/revenue
- GET /api/metrics/items
- GET /api/metrics/customers
- GET /api/metrics/payments
- GET /api/metrics/export/{report_type}

### Deliveries
- GET /api/deliveries
- GET /api/drivers

### Reports (Legacy)
- GET /api/reports/sales
- GET /api/reports/dashboard

### Other
- GET /api/users
- POST /api/seed

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] POS cart with volume discounts
- [x] Country/Tax settings
- [x] Category management with sort order
- [x] Parent-child items
- [x] Pickup & Delivery module
- [x] POS 3-tab workflow
- [x] Enhanced customer profiles
- [x] Business Metrics page

### P1 (High Priority)
- [ ] SMS/Email notifications for order status changes
- [ ] Barcode/QR code generation for garment labels
- [ ] Real thermal printer testing and refinement
- [ ] Hardware integration (printers, cash drawer) - WebUSB ready, needs testing

### P2 (Medium Priority)
- [ ] Route optimization for deliveries
- [ ] Inventory management for supplies
- [ ] Loyalty program rewards redemption
- [ ] Multi-location support
- [ ] Employee time tracking
- [ ] Google Maps integration for address lookup

### P3 (Nice to Have)
- [ ] Customer portal for order tracking
- [ ] Mobile app version
- [ ] Advanced analytics with AI insights
- [ ] Integration with accounting software

## Test Reports
- /app/test_reports/iteration_1.json
- /app/test_reports/iteration_2.json
- /app/test_reports/iteration_3.json (Latest - All tests passed)

## Bug Fixes Applied
- Fixed order creation duplicate timestamps parameter (server.py line 973)
- Fixed date formatting in CustomersPage.js for null timestamps
