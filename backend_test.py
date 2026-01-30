#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class DryCleanPOSAPITester:
    def __init__(self, base_url="https://fresh-garments-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_customer_id = None
        self.created_order_id = None

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

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if not success:
                details += f" (Expected {expected_status})"
                try:
                    error_data = response.json()
                    details += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    details += f" - {response.text[:100]}"

            self.log_test(name, success, details)
            
            if success:
                try:
                    return response.json()
                except:
                    return {}
            return None

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return None

    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n🔍 Testing Health Endpoints...")
        self.run_test("API Root", "GET", "", 200)
        self.run_test("Health Check", "GET", "health", 200)

    def test_seed_data(self):
        """Test data seeding"""
        print("\n🔍 Testing Data Seeding...")
        result = self.run_test("Seed Data", "POST", "seed", 200)
        return result is not None

    def test_authentication(self):
        """Test authentication endpoints"""
        print("\n🔍 Testing Authentication...")
        
        # Test login with demo credentials
        login_data = {
            "email": "admin@dryclean.com",
            "password": "admin123"
        }
        
        result = self.run_test("Demo Login", "POST", "auth/login", 200, login_data)
        if result and 'access_token' in result:
            self.token = result['access_token']
            print(f"   Token obtained: {self.token[:20]}...")
            
            # Test get current user
            self.run_test("Get Current User", "GET", "auth/me", 200)
            return True
        
        return False

    def test_items_api(self):
        """Test items/services API"""
        print("\n🔍 Testing Items API...")
        
        # Get all items
        items = self.run_test("Get All Items", "GET", "items", 200)
        if items:
            print(f"   Found {len(items)} items")
            
            # Test get categories
            self.run_test("Get Item Categories", "GET", "item-categories", 200)
            
            # Test get specific item if available
            if len(items) > 0:
                item_id = items[0]['id']
                self.run_test("Get Specific Item", "GET", f"items/{item_id}", 200)
                
            return True
        return False

    def test_customers_api(self):
        """Test customers API"""
        print("\n🔍 Testing Customers API...")
        
        # Create a test customer
        customer_data = {
            "name": f"Test Customer {datetime.now().strftime('%H%M%S')}",
            "phone": "555-0123",
            "email": "test@example.com"
        }
        
        result = self.run_test("Create Customer", "POST", "customers", 200, customer_data)
        if result and 'id' in result:
            self.created_customer_id = result['id']
            print(f"   Created customer ID: {self.created_customer_id}")
            
            # Get all customers
            self.run_test("Get All Customers", "GET", "customers", 200)
            
            # Get specific customer
            self.run_test("Get Specific Customer", "GET", f"customers/{self.created_customer_id}", 200)
            
            # Search customers
            self.run_test("Search Customers", "GET", f"customers?search=Test", 200)
            
            return True
        return False

    def test_orders_api(self):
        """Test orders API"""
        print("\n🔍 Testing Orders API...")
        
        if not self.created_customer_id:
            print("   Skipping orders test - no customer created")
            return False
            
        # Get items first
        items = self.run_test("Get Items for Order", "GET", "items", 200)
        if not items or len(items) == 0:
            print("   Skipping orders test - no items available")
            return False
            
        # Create test order
        item = items[0]
        order_data = {
            "customer_id": self.created_customer_id,
            "customer_name": "Test Customer",
            "customer_phone": "555-0123",
            "items": [{
                "item_id": item['id'],
                "item_name": item['name'],
                "quantity": 2,
                "service_type": "regular",
                "unit_price": item['prices']['regular'],
                "total_price": item['prices']['regular'] * 2
            }],
            "subtotal": item['prices']['regular'] * 2,
            "tax": item['prices']['regular'] * 2 * 0.08,
            "discount": 0.0,
            "total": item['prices']['regular'] * 2 * 1.08,
            "estimated_ready": "2024-12-20 10:00"
        }
        
        result = self.run_test("Create Order", "POST", "orders", 200, order_data)
        if result and 'id' in result:
            self.created_order_id = result['id']
            print(f"   Created order ID: {self.created_order_id}")
            
            # Get all orders
            self.run_test("Get All Orders", "GET", "orders", 200)
            
            # Get specific order
            self.run_test("Get Specific Order", "GET", f"orders/{self.created_order_id}", 200)
            
            # Update order status
            status_update = {"status": "processing"}
            self.run_test("Update Order Status", "PUT", f"orders/{self.created_order_id}/status", 200, status_update)
            
            return True
        return False

    def test_payments_api(self):
        """Test payments API"""
        print("\n🔍 Testing Payments API...")
        
        if not self.created_order_id:
            print("   Skipping payments test - no order created")
            return False
            
        # Test cash payment
        payment_data = {
            "order_id": self.created_order_id,
            "amount": 25.00,
            "payment_method": "cash"
        }
        
        result = self.run_test("Process Cash Payment", "POST", "payments", 200, payment_data)
        return result is not None

    def test_reports_api(self):
        """Test reports API"""
        print("\n🔍 Testing Reports API...")
        
        # Test dashboard stats
        self.run_test("Get Dashboard Stats", "GET", "reports/dashboard", 200)
        
        # Test sales report
        self.run_test("Get Sales Report", "GET", "reports/sales", 200)
        
        return True

    def test_users_api(self):
        """Test users API (admin only)"""
        print("\n🔍 Testing Users API...")
        
        # Get all users (admin only)
        result = self.run_test("Get All Users", "GET", "users", 200)
        return result is not None

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting DryClean POS API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            ("Health Check", self.test_health_check),
            ("Data Seeding", self.test_seed_data),
            ("Authentication", self.test_authentication),
            ("Items API", self.test_items_api),
            ("Customers API", self.test_customers_api),
            ("Orders API", self.test_orders_api),
            ("Payments API", self.test_payments_api),
            ("Reports API", self.test_reports_api),
            ("Users API", self.test_users_api),
        ]
        
        for test_name, test_func in tests:
            try:
                test_func()
            except Exception as e:
                print(f"❌ {test_name} - Exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Some tests failed. Check the details above.")
            return 1
        else:
            print("\n✅ All tests passed!")
            return 0

def main():
    tester = DryCleanPOSAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())