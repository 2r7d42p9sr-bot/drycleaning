#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime, timedelta
import uuid

class DryCleanNewFeaturesTester:
    def __init__(self, base_url="https://fresh-garments-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.business_customer_id = None
        self.order_id = None
        self.invoice_id = None
        self.item_id = None
        self.garment_id = None

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details
        })

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None, files=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)
        
        # Only add Content-Type for JSON requests
        if not files and data is not None:
            test_headers['Content-Type'] = 'application/json'

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=15)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, data=data, headers=test_headers, timeout=15)
                else:
                    response = requests.post(url, json=data, headers=test_headers, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=15)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=15)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected {expected_status})"
                try:
                    error_data = response.json()
                    details += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" - {response.text[:200]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {"status": "success"}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_authentication(self):
        """Test authentication with provided credentials"""
        print("\n🔍 Testing Authentication...")
        
        login_data = {
            "email": "admin@dryclean.com",
            "password": "admin123"
        }
        
        result = self.run_test("Login with admin credentials", "POST", "auth/login", 200, login_data)
        if result and 'access_token' in result:
            self.token = result['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            return True
        
        return False

    def test_company_profile_settings(self):
        """Test Company Profile Settings endpoints"""
        print("\n🔍 Testing Company Profile Settings...")
        
        # Test GET company profile
        profile_result = self.run_test("GET Company Profile", "GET", "settings/company-profile", 200)
        
        # Test PUT company profile with sample data
        profile_data = {
            "logo_on_receipts": True,
            "logo_on_labels": False,
            "social_media": {
                "facebook": "https://facebook.com/test",
                "instagram": "https://instagram.com/test",
                "tiktok": "https://tiktok.com/@test"
            },
            "opening_hours": [
                {
                    "day": "monday",
                    "is_open": True,
                    "open_time": "09:00",
                    "close_time": "18:00"
                },
                {
                    "day": "tuesday",
                    "is_open": True,
                    "open_time": "09:00",
                    "close_time": "18:00"
                }
            ]
        }
        
        update_result = self.run_test("PUT Company Profile", "PUT", "settings/company-profile", 200, profile_data)
        
        # Verify the update worked
        if update_result:
            verify_result = self.run_test("Verify Company Profile Update", "GET", "settings/company-profile", 200)
            if verify_result:
                company_profile = verify_result.get("company_profile", {})
                if (company_profile.get("logo_on_receipts") == True and 
                    company_profile.get("social_media", {}).get("facebook") == "https://facebook.com/test"):
                    print("   ✅ Company profile data verified")
                else:
                    print("   ❌ Company profile data not saved correctly")
        
        return profile_result is not None and update_result is not None

    def test_notification_settings(self):
        """Test Notification Settings endpoints"""
        print("\n🔍 Testing Notification Settings...")
        
        # Test GET notification settings
        settings_result = self.run_test("GET Notification Settings", "GET", "settings/notifications", 200)
        
        # Test PUT notification settings
        notification_data = {
            "email_provider": {
                "provider": "sendgrid",
                "api_key": "test_api_key",
                "from_email": "noreply@dryclean.com",
                "from_name": "DryClean POS",
                "is_configured": True
            },
            "templates": [
                {
                    "event": "order_created",
                    "enabled": True,
                    "subject": "Order Confirmation - {order_number}",
                    "body": "Dear {customer_name}, your order has been received.",
                    "sms_enabled": False,
                    "sms_text": None
                }
            ]
        }
        
        update_result = self.run_test("PUT Notification Settings", "PUT", "settings/notifications", 200, notification_data)
        
        return settings_result is not None and update_result is not None

    def test_items_with_pieces(self):
        """Test Items with pieces field"""
        print("\n🔍 Testing Items with Pieces Field...")
        
        # First get categories to use in item creation
        categories_result = self.run_test("GET Categories for Item", "GET", "categories", 200)
        if not categories_result or len(categories_result) == 0:
            print("   No categories found, skipping item creation")
            return False
        
        category_id = categories_result[0]['id']
        
        # Test POST item with pieces field
        item_data = {
            "name": f"Test Suit {datetime.now().strftime('%H%M%S')}",
            "category_id": category_id,
            "prices": {
                "regular": 25.00,
                "express": 35.00,
                "delicate": 30.00
            },
            "description": "Test item with multiple pieces",
            "pieces": 2,
            "is_active": True
        }
        
        create_result = self.run_test("POST Item with Pieces", "POST", "items", 200, item_data)
        if create_result and 'id' in create_result:
            self.item_id = create_result['id']
            print(f"   Created item ID: {self.item_id}")
            
            # Test GET items to verify has_children field
            items_result = self.run_test("GET Items with has_children", "GET", "items", 200)
            if items_result:
                # Find our created item
                our_item = next((item for item in items_result if item['id'] == self.item_id), None)
                if our_item and 'has_children' in our_item:
                    print("   ✅ has_children field present in items response")
                else:
                    print("   ❌ has_children field missing in items response")
            
            # Test check-has-children endpoint
            check_result = self.run_test("GET Check Has Children", "GET", f"items/check-has-children/{self.item_id}", 200)
            if check_result and 'has_children' in check_result:
                print(f"   ✅ Item has_children: {check_result['has_children']}")
            
            return True
        
        return False

    def test_invoice_system(self):
        """Test Invoice System endpoints"""
        print("\n🔍 Testing Invoice System...")
        
        # First create a business customer
        business_customer_data = {
            "name": f"Business Customer {datetime.now().strftime('%H%M%S')}",
            "phone": "555-0199",
            "email": "business@example.com",
            "customer_type": "business",
            "business_info": {
                "company_name": "Test Business Corp",
                "contact_person": "John Doe",
                "billing_email": "billing@testbusiness.com",
                "payment_terms": 30
            }
        }
        
        customer_result = self.run_test("Create Business Customer", "POST", "customers", 200, business_customer_data)
        if not customer_result or 'id' not in customer_result:
            print("   Failed to create business customer, skipping invoice tests")
            return False
        
        self.business_customer_id = customer_result['id']
        print(f"   Created business customer ID: {self.business_customer_id}")
        
        # Create an order with invoice payment method
        if not self.item_id:
            print("   No item available, skipping order creation")
            return False
        
        order_data = {
            "customer_id": self.business_customer_id,
            "customer_name": business_customer_data["name"],
            "customer_phone": business_customer_data["phone"],
            "customer_type": "business",
            "items": [{
                "item_id": self.item_id,
                "item_name": "Test Suit",
                "quantity": 1,
                "service_type": "regular",
                "unit_price": 25.00,
                "total_price": 25.00,
                "pieces": 2
            }],
            "subtotal": 25.00,
            "tax": 2.00,
            "total": 27.00,
            "payment_method": "invoice"
        }
        
        order_result = self.run_test("Create Order with Invoice Payment", "POST", "orders", 200, order_data)
        if order_result and 'id' in order_result:
            self.order_id = order_result['id']
            print(f"   Created order ID: {self.order_id}")
        
        # Test GET uninvoiced orders
        uninvoiced_result = self.run_test("GET Uninvoiced Orders", "GET", f"orders/uninvoiced/{self.business_customer_id}", 200)
        
        # Test POST create invoice
        if uninvoiced_result and len(uninvoiced_result) > 0:
            invoice_data = {
                "customer_id": self.business_customer_id,
                "order_ids": [self.order_id],
                "due_date": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
                "notes": "Test invoice"
            }
            
            invoice_result = self.run_test("POST Create Invoice", "POST", "invoices", 200, invoice_data)
            if invoice_result and 'id' in invoice_result:
                self.invoice_id = invoice_result['id']
                print(f"   Created invoice ID: {self.invoice_id}")
        
        # Test GET invoices list
        invoices_result = self.run_test("GET Invoices List", "GET", "invoices", 200)
        
        # Test GET invoice summary
        summary_result = self.run_test("GET Invoice Summary", "GET", "invoices/summary", 200)
        
        # Test POST invoice payment
        if self.invoice_id:
            payment_data = {
                "amount": 27.00,
                "payment_method": "bank_transfer",
                "notes": "Test payment"
            }
            
            payment_result = self.run_test("POST Invoice Payment", "POST", f"invoices/{self.invoice_id}/payment", 200, payment_data)
        
        return True

    def test_garment_tags_qr_codes(self):
        """Test Garment Tags / QR Codes endpoints"""
        print("\n🔍 Testing Garment Tags / QR Codes...")
        
        if not self.order_id:
            print("   No order available, skipping garment tags tests")
            return False
        
        # Test GET garment tags for order
        tags_result = self.run_test("GET Order Garment Tags", "GET", f"orders/{self.order_id}/garment-tags", 200)
        if tags_result and len(tags_result) > 0:
            self.garment_id = tags_result[0].get('garment_id')
            print(f"   Found {len(tags_result)} garment tags")
            if self.garment_id:
                print(f"   First garment ID: {self.garment_id}")
        
        # Test GET printable labels
        labels_result = self.run_test("GET Order Labels", "GET", f"orders/{self.order_id}/labels", 200)
        
        # Test GET garment lookup by ID
        if self.garment_id:
            garment_result = self.run_test("GET Garment by ID", "GET", f"garment/{self.garment_id}", 200)
            if garment_result:
                print(f"   ✅ Garment lookup successful")
        
        return tags_result is not None

    def run_all_tests(self):
        """Run all new feature tests"""
        print("🚀 Starting DryClean POS New Features API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 70)
        
        # Test sequence
        tests = [
            ("Authentication", self.test_authentication),
            ("Company Profile Settings", self.test_company_profile_settings),
            ("Notification Settings", self.test_notification_settings),
            ("Items with Pieces Field", self.test_items_with_pieces),
            ("Invoice System", self.test_invoice_system),
            ("Garment Tags / QR Codes", self.test_garment_tags_qr_codes),
        ]
        
        for test_name, test_func in tests:
            try:
                success = test_func()
                if not success and test_name == "Authentication":
                    print("❌ Authentication failed - stopping tests")
                    break
            except Exception as e:
                print(f"❌ {test_name} - Exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 70)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        # Print failed tests
        failed_tests = [t for t in self.test_results if not t['success']]
        if failed_tests:
            print(f"\n❌ Failed Tests ({len(failed_tests)}):")
            for test in failed_tests:
                print(f"   • {test['test']}: {test['details']}")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Some tests failed. Check the details above.")
            return 1
        else:
            print("\n✅ All tests passed!")
            return 0

def main():
    tester = DryCleanNewFeaturesTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())