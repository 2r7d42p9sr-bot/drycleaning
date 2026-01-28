# DryClean POS - Product Requirements Document

## Original Problem Statement
Build a complete web based dry cleaning business app that is modern, based on best practices and workflow. Must have POS and be able to link to a garment label printer, a receipt printer and cash drawer.

## User Personas
1. **Store Owner/Manager** - Needs comprehensive reports, staff management, full system access
2. **Cashier/Staff** - Day-to-day POS operations, order processing, customer management
3. **Customers** - Receive order tracking, receipts, loyalty points

## Core Requirements
- Extended customer profiles with preferences, measurements, loyalty points
- Advanced workflow with status tracking (Received → Processing → Ready → Picked Up)
- Variable pricing with service types (Regular, Express, Delicate)
- Multi-payment support: Cash, Card (Stripe), Bank Transfer
- Direct thermal printer integration via WebUSB API (ESC/POS)
- Comprehensive reports and analytics
- JWT-based authentication with role-based access

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
- [x] Customer CRUD with preferences, measurements, loyalty points
- [x] Items/Services with variable pricing (regular/express/delicate)
- [x] Order Management with status workflow
- [x] Payment Processing (cash, card via Stripe, bank transfer)
- [x] Reports API (sales, trends, payment breakdown)
- [x] Stripe webhook handling
- [x] Data seeding endpoint

### Frontend Pages
- [x] Login Page with demo account
- [x] Dashboard with stats and quick actions
- [x] POS Terminal with cart, customer selection, checkout
- [x] Customers Page with CRUD and detailed profiles
- [x] Orders Page with status workflow management
- [x] Items/Services Page with pricing management
- [x] Reports Page with charts (Recharts)
- [x] Staff Page with team management
- [x] Settings Page with printer configuration
- [x] Payment Success Page

### Hardware Integration
- [x] WebUSB printer library (/app/frontend/src/lib/printer.js)
- [x] ESC/POS command support
- [x] Receipt formatting helpers
- [x] Label formatting helpers
- [x] Cash drawer kick command
- [x] Browser print fallback for non-WebUSB browsers

## Default Credentials
- Email: admin@dryclean.com
- Password: admin123

## API Endpoints
- POST /api/auth/register, /api/auth/login, GET /api/auth/me
- CRUD /api/customers
- CRUD /api/items
- CRUD /api/orders, PUT /api/orders/{id}/status
- POST /api/payments, GET /api/payments/status/{session_id}
- POST /api/webhook/stripe
- GET /api/reports/sales, /api/reports/dashboard
- GET /api/users
- POST /api/seed

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] POS cart functionality
- [x] Order creation and payment
- [x] Customer management
- [x] Basic reporting

### P1 (High Priority)
- [ ] SMS/Email notifications for order status changes
- [ ] Barcode/QR code generation for garment labels
- [ ] Real thermal printer testing and refinement
- [ ] Order history for customers

### P2 (Medium Priority)
- [ ] Inventory management for supplies
- [ ] Loyalty program rewards redemption
- [ ] Multi-location support
- [ ] Employee time tracking
- [ ] Customer portal for order tracking

### P3 (Nice to Have)
- [ ] Mobile app version
- [ ] Advanced analytics with AI insights
- [ ] Integration with accounting software
- [ ] Customer notifications preferences

## Next Tasks
1. Test Stripe card payment flow end-to-end
2. Add SMS notification integration (Twilio)
3. Implement barcode generation for labels
4. Add order search by order number
5. Implement customer loyalty redemption flow
