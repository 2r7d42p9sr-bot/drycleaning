#!/usr/bin/env python3

import requests
import sys
import json
from datetime import datetime

class DryCleanBugFixTester:
    def __init__(self, base_url="https://fresh-garments-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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

    def authenticate(self):
        """Authenticate with admin credentials"""
        print("\n🔐 Authenticating...")
        
        login_data = {
            "email": "admin@dryclean.com",
            "password": "admin123"
        }
        
        url = f"{self.base_url}/api/auth/login"
        try:
            response = requests.post(url, json=login_data, timeout=10)
            if response.status_code == 200:
                result = response.json()
                if 'access_token' in result:
                    self.token = result['access_token']
                    print(f"   ✅ Authentication successful")
                    return True
            
            print(f"   ❌ Authentication failed: {response.status_code}")
            return False
            
        except Exception as e:
            print(f"   ❌ Authentication error: {str(e)}")
            return False

    def test_orders_endpoint(self):
        """Test GET /api/orders endpoint - Bug Fix #1"""
        print("\n🔍 Testing Orders Endpoint Bug Fix...")
        
        url = f"{self.base_url}/api/orders"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                orders = response.json()
                self.log_test("Orders endpoint returns 200", True, f"Found {len(orders)} orders")
                
                # Check if orders have proper structure
                if isinstance(orders, list):
                    self.log_test("Orders endpoint returns list", True)
                    
                    if len(orders) > 0:
                        order = orders[0]
                        required_fields = ['id', 'order_number', 'customer_name', 'status', 'total']
                        missing_fields = [field for field in required_fields if field not in order]
                        
                        if not missing_fields:
                            self.log_test("Orders have required fields", True)
                        else:
                            self.log_test("Orders have required fields", False, f"Missing: {missing_fields}")
                    else:
                        self.log_test("Orders endpoint structure", True, "No orders to validate structure")
                else:
                    self.log_test("Orders endpoint returns list", False, f"Got {type(orders)}")
                    
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    error_msg += f" - {response.text[:100]}"
                
                self.log_test("Orders endpoint returns 200", False, error_msg)
                
        except Exception as e:
            self.log_test("Orders endpoint", False, f"Exception: {str(e)}")

    def test_customer_loyalty_excluded(self):
        """Test creating customer with loyalty_excluded field - Bug Fix #2"""
        print("\n🔍 Testing Customer loyalty_excluded Field Bug Fix...")
        
        # Create customer with loyalty_excluded: true
        customer_data = {
            "name": f"Loyalty Test Customer {datetime.now().strftime('%H%M%S')}",
            "phone": "555-9999",
            "email": f"loyalty_test_{datetime.now().strftime('%H%M%S')}@example.com",
            "loyalty_excluded": True
        }
        
        url = f"{self.base_url}/api/customers"
        headers = {
            'Authorization': f'Bearer {self.token}',
            'Content-Type': 'application/json'
        }
        
        try:
            response = requests.post(url, json=customer_data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                customer = response.json()
                self.log_test("Create customer with loyalty_excluded", True, f"Customer ID: {customer.get('id')}")
                
                # Check if loyalty_excluded field is preserved
                if 'loyalty_excluded' in customer and customer['loyalty_excluded'] == True:
                    self.log_test("loyalty_excluded field preserved", True)
                else:
                    self.log_test("loyalty_excluded field preserved", False, 
                                f"Expected True, got {customer.get('loyalty_excluded')}")
                
                # Test retrieving the customer to ensure field persists
                customer_id = customer.get('id')
                if customer_id:
                    get_url = f"{self.base_url}/api/customers/{customer_id}"
                    get_response = requests.get(get_url, headers=headers, timeout=10)
                    
                    if get_response.status_code == 200:
                        retrieved_customer = get_response.json()
                        if retrieved_customer.get('loyalty_excluded') == True:
                            self.log_test("loyalty_excluded persists in database", True)
                        else:
                            self.log_test("loyalty_excluded persists in database", False,
                                        f"Expected True, got {retrieved_customer.get('loyalty_excluded')}")
                    else:
                        self.log_test("Retrieve customer for verification", False, 
                                    f"Status: {get_response.status_code}")
                        
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    error_msg += f" - {response.text[:100]}"
                
                self.log_test("Create customer with loyalty_excluded", False, error_msg)
                
        except Exception as e:
            self.log_test("Customer loyalty_excluded test", False, f"Exception: {str(e)}")

    def test_settings_currency(self):
        """Test GET /api/settings for country/currency settings - Bug Fix #3"""
        print("\n🔍 Testing Settings Currency Bug Fix...")
        
        url = f"{self.base_url}/api/settings"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                settings = response.json()
                self.log_test("Settings endpoint returns 200", True)
                
                # Check if settings have proper structure
                if 'settings' in settings:
                    business_settings = settings['settings']
                    self.log_test("Settings has 'settings' field", True)
                    
                    # Check for country/currency settings
                    if 'country' in business_settings:
                        country_settings = business_settings['country']
                        self.log_test("Settings has country field", True)
                        
                        # Check required currency fields
                        required_fields = ['country_code', 'country_name', 'currency_code', 'currency_symbol']
                        missing_fields = [field for field in required_fields if field not in country_settings]
                        
                        if not missing_fields:
                            self.log_test("Country settings have required fields", True, 
                                        f"Currency: {country_settings.get('currency_code')} ({country_settings.get('currency_symbol')})")
                        else:
                            self.log_test("Country settings have required fields", False, 
                                        f"Missing: {missing_fields}")
                    else:
                        self.log_test("Settings has country field", False, "Country field not found")
                else:
                    self.log_test("Settings has 'settings' field", False, f"Available keys: {list(settings.keys())}")
                    
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    error_msg += f" - {response.text[:100]}"
                
                self.log_test("Settings endpoint returns 200", False, error_msg)
                
        except Exception as e:
            self.log_test("Settings currency test", False, f"Exception: {str(e)}")

    def test_items_has_children(self):
        """Test GET /api/items for has_children field - Bug Fix #4"""
        print("\n🔍 Testing Items has_children Field Bug Fix...")
        
        url = f"{self.base_url}/api/items"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            
            if response.status_code == 200:
                items = response.json()
                self.log_test("Items endpoint returns 200", True, f"Found {len(items)} items")
                
                if isinstance(items, list) and len(items) > 0:
                    self.log_test("Items endpoint returns list", True)
                    
                    # Check if all items have has_children field
                    items_with_has_children = [item for item in items if 'has_children' in item]
                    
                    if len(items_with_has_children) == len(items):
                        self.log_test("All items have has_children field", True)
                        
                        # Check if has_children is boolean
                        boolean_check = all(isinstance(item.get('has_children'), bool) for item in items)
                        if boolean_check:
                            self.log_test("has_children field is boolean", True)
                            
                            # Count items with/without children
                            with_children = len([item for item in items if item.get('has_children')])
                            without_children = len(items) - with_children
                            self.log_test("has_children field values", True, 
                                        f"{with_children} with children, {without_children} without")
                        else:
                            self.log_test("has_children field is boolean", False, 
                                        "Some has_children values are not boolean")
                    else:
                        missing_count = len(items) - len(items_with_has_children)
                        self.log_test("All items have has_children field", False, 
                                    f"{missing_count} items missing has_children field")
                        
                elif isinstance(items, list):
                    self.log_test("Items has_children test", True, "No items to test (empty list)")
                else:
                    self.log_test("Items endpoint returns list", False, f"Got {type(items)}")
                    
            else:
                error_msg = f"Status: {response.status_code}"
                try:
                    error_data = response.json()
                    error_msg += f" - {error_data.get('detail', 'Unknown error')}"
                except:
                    error_msg += f" - {response.text[:100]}"
                
                self.log_test("Items endpoint returns 200", False, error_msg)
                
        except Exception as e:
            self.log_test("Items has_children test", False, f"Exception: {str(e)}")

    def run_bug_fix_tests(self):
        """Run all bug fix tests"""
        print("🐛 Starting DryClean POS Bug Fix Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        # Authenticate first
        if not self.authenticate():
            print("❌ Authentication failed. Cannot proceed with tests.")
            return 1
        
        # Run bug fix tests
        bug_fix_tests = [
            ("Orders Endpoint Bug Fix", self.test_orders_endpoint),
            ("Customer loyalty_excluded Field Bug Fix", self.test_customer_loyalty_excluded),
            ("Settings Currency Bug Fix", self.test_settings_currency),
            ("Items has_children Field Bug Fix", self.test_items_has_children),
        ]
        
        for test_name, test_func in bug_fix_tests:
            try:
                test_func()
            except Exception as e:
                print(f"❌ {test_name} - Exception: {str(e)}")
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Bug Fix Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.tests_passed < self.tests_run:
            print("\n❌ Some bug fix tests failed. Check the details above.")
            return 1
        else:
            print("\n✅ All bug fix tests passed!")
            return 0

def main():
    tester = DryCleanBugFixTester()
    return tester.run_bug_fix_tests()

if __name__ == "__main__":
    sys.exit(main())