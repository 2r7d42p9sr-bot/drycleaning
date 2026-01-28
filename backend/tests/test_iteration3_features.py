"""
Backend API Tests for Iteration 3 Features:
- POS 3-tab workflow (orders by status)
- Customer profile enhancements (stats, orders, business info, flags)
- Metrics API endpoints
- New payment methods (pay_on_collection, invoice)
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestAuth:
    """Authentication tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        return data["access_token"]
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == "admin@dryclean.com"


class TestPOSOrdersByStatus:
    """Test POS 3-tab workflow - orders by status endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_orders_by_status_endpoint(self, auth_headers):
        """Test /api/orders/by-status returns cleaning and ready orders"""
        response = requests.get(f"{BASE_URL}/api/orders/by-status", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "cleaning" in data, "Response should have 'cleaning' key"
        assert "ready" in data, "Response should have 'ready' key"
        assert isinstance(data["cleaning"], list), "cleaning should be a list"
        assert isinstance(data["ready"], list), "ready should be a list"
        
        print(f"Orders by status: cleaning={len(data['cleaning'])}, ready={len(data['ready'])}")


class TestCustomerEnhancements:
    """Test enhanced customer profile features"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def test_customer(self, auth_headers):
        """Create a test customer for testing"""
        customer_data = {
            "name": "TEST_Business Customer",
            "phone": "555-TEST-001",
            "email": "test_business@example.com",
            "customer_type": "business",
            "discount_percent": 10.0,
            "require_advance_payment": False,
            "is_blacklisted": False,
            "business_info": {
                "company_name": "Test Corp",
                "registration_number": "REG123",
                "vat_number": "VAT456",
                "contact_person": "John Doe",
                "billing_email": "billing@testcorp.com",
                "payment_terms": 30
            }
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data, headers=auth_headers)
        assert response.status_code == 200
        return response.json()
    
    def test_customer_type_filter_retail(self, auth_headers):
        """Test filtering customers by retail type"""
        response = requests.get(f"{BASE_URL}/api/customers?customer_type=retail", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned customers should be retail type
        for customer in data:
            assert customer.get("customer_type", "retail") == "retail"
        print(f"Found {len(data)} retail customers")
    
    def test_customer_type_filter_business(self, auth_headers, test_customer):
        """Test filtering customers by business type"""
        response = requests.get(f"{BASE_URL}/api/customers?customer_type=business", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # All returned customers should be business type
        for customer in data:
            assert customer.get("customer_type") == "business"
        print(f"Found {len(data)} business customers")
    
    def test_customer_stats_endpoint(self, auth_headers, test_customer):
        """Test /api/customers/{id}/stats endpoint"""
        customer_id = test_customer["id"]
        response = requests.get(f"{BASE_URL}/api/customers/{customer_id}/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify stats structure
        assert "total_orders" in data
        assert "active_orders" in data
        assert "total_spent" in data
        assert "average_order_value" in data
        assert "loyalty_points" in data
        assert "total_items_cleaned" in data
        assert "member_since" in data
        print(f"Customer stats: orders={data['total_orders']}, spent=${data['total_spent']}")
    
    def test_customer_orders_endpoint(self, auth_headers, test_customer):
        """Test /api/customers/{id}/orders endpoint"""
        customer_id = test_customer["id"]
        response = requests.get(f"{BASE_URL}/api/customers/{customer_id}/orders", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Customer has {len(data)} orders")
    
    def test_customer_business_info(self, auth_headers, test_customer):
        """Test business customer has business_info fields"""
        customer_id = test_customer["id"]
        response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["customer_type"] == "business"
        assert data["business_info"] is not None
        assert data["business_info"]["company_name"] == "Test Corp"
        assert data["business_info"]["vat_number"] == "VAT456"
        print(f"Business info verified: {data['business_info']['company_name']}")
    
    def test_customer_discount_percent(self, auth_headers, test_customer):
        """Test customer discount percent field"""
        customer_id = test_customer["id"]
        response = requests.get(f"{BASE_URL}/api/customers/{customer_id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "discount_percent" in data
        assert data["discount_percent"] == 10.0
        print(f"Customer discount: {data['discount_percent']}%")
    
    def test_customer_blacklist_flag(self, auth_headers):
        """Test blacklist flag functionality"""
        # Create a blacklisted customer
        customer_data = {
            "name": "TEST_Blacklisted Customer",
            "phone": "555-TEST-002",
            "is_blacklisted": True,
            "blacklist_reason": "Test blacklist reason"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["is_blacklisted"] == True
        assert data["blacklist_reason"] == "Test blacklist reason"
        print(f"Blacklisted customer created: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/customers/{data['id']}", headers=auth_headers)
    
    def test_customer_advance_payment_flag(self, auth_headers):
        """Test require_advance_payment flag"""
        customer_data = {
            "name": "TEST_Advance Payment Customer",
            "phone": "555-TEST-003",
            "require_advance_payment": True
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert data["require_advance_payment"] == True
        print(f"Advance payment customer created: {data['name']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/customers/{data['id']}", headers=auth_headers)


class TestMetricsAPI:
    """Test new Metrics API endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_metrics_overview(self, auth_headers):
        """Test /api/metrics/overview endpoint"""
        response = requests.get(f"{BASE_URL}/api/metrics/overview?period=month", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "period" in data
        assert "current_period" in data
        assert "previous_period" in data
        assert "changes" in data
        
        # Verify current_period fields
        current = data["current_period"]
        assert "revenue" in current
        assert "orders" in current
        assert "average_order_value" in current
        assert "new_customers" in current
        
        # Verify changes fields
        changes = data["changes"]
        assert "revenue" in changes
        assert "orders" in changes
        
        print(f"Metrics overview: revenue=${current['revenue']}, orders={current['orders']}")
    
    def test_metrics_overview_periods(self, auth_headers):
        """Test metrics overview with different periods"""
        for period in ["day", "week", "month", "year"]:
            response = requests.get(f"{BASE_URL}/api/metrics/overview?period={period}", headers=auth_headers)
            assert response.status_code == 200, f"Failed for period={period}"
            data = response.json()
            assert data["period"] == period
        print("All period types work correctly")
    
    def test_metrics_revenue(self, auth_headers):
        """Test /api/metrics/revenue endpoint"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/metrics/revenue?date_from={date_from}&date_to={date_to}&group_by=day",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "group_by" in data
        assert "data" in data
        assert "total_revenue" in data
        assert "total_orders" in data
        assert isinstance(data["data"], list)
        
        print(f"Revenue metrics: total=${data['total_revenue']}, orders={data['total_orders']}")
    
    def test_metrics_items(self, auth_headers):
        """Test /api/metrics/items endpoint"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/metrics/items?date_from={date_from}&date_to={date_to}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "items" in data
        assert "total_items" in data
        assert "total_revenue" in data
        assert isinstance(data["items"], list)
        
        print(f"Items metrics: {len(data['items'])} items, total={data['total_items']}")
    
    def test_metrics_customers(self, auth_headers):
        """Test /api/metrics/customers endpoint"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/metrics/customers?date_from={date_from}&date_to={date_to}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "top_customers" in data
        assert "total_customers" in data
        assert "by_type" in data
        assert "average_customer_value" in data
        
        # Verify by_type structure
        by_type = data["by_type"]
        assert "retail" in by_type
        assert "business" in by_type
        
        print(f"Customer metrics: {data['total_customers']} customers, retail={by_type['retail']['count']}, business={by_type['business']['count']}")
    
    def test_metrics_payments(self, auth_headers):
        """Test /api/metrics/payments endpoint"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/metrics/payments?date_from={date_from}&date_to={date_to}",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify structure
        assert "by_method" in data
        assert "total_revenue" in data
        assert isinstance(data["by_method"], list)
        
        print(f"Payment metrics: {len(data['by_method'])} methods, total=${data['total_revenue']}")
    
    def test_metrics_export_orders(self, auth_headers):
        """Test /api/metrics/export/orders endpoint"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/metrics/export/orders?date_from={date_from}&date_to={date_to}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        print("Orders export works correctly")
    
    def test_metrics_export_customers(self, auth_headers):
        """Test /api/metrics/export/customers endpoint"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/metrics/export/customers?date_from={date_from}&date_to={date_to}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        print("Customers export works correctly")
    
    def test_metrics_export_items(self, auth_headers):
        """Test /api/metrics/export/items endpoint"""
        date_from = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        date_to = datetime.now().strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{BASE_URL}/api/metrics/export/items?date_from={date_from}&date_to={date_to}",
            headers=auth_headers
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        print("Items export works correctly")


class TestNewPaymentMethods:
    """Test new payment methods: pay_on_collection and invoice"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    @pytest.fixture(scope="class")
    def retail_customer(self, auth_headers):
        """Create a retail customer"""
        customer_data = {
            "name": "TEST_Retail Payment Customer",
            "phone": "555-TEST-PAY-001",
            "customer_type": "retail"
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data, headers=auth_headers)
        return response.json()
    
    @pytest.fixture(scope="class")
    def business_customer(self, auth_headers):
        """Create a business customer"""
        customer_data = {
            "name": "TEST_Business Payment Customer",
            "phone": "555-TEST-PAY-002",
            "customer_type": "business",
            "business_info": {
                "company_name": "Payment Test Corp",
                "payment_terms": 30
            }
        }
        response = requests.post(f"{BASE_URL}/api/customers", json=customer_data, headers=auth_headers)
        return response.json()
    
    def test_pay_on_collection_payment(self, auth_headers, retail_customer):
        """Test pay_on_collection payment method"""
        # Create an order
        order_data = {
            "customer_id": retail_customer["id"],
            "customer_name": retail_customer["name"],
            "customer_phone": retail_customer["phone"],
            "customer_type": "retail",
            "items": [{
                "item_id": "test-item",
                "item_name": "Test Item",
                "quantity": 1,
                "service_type": "regular",
                "unit_price": 10.0,
                "total_price": 10.0
            }],
            "subtotal": 10.0,
            "tax": 0.8,
            "total": 10.8
        }
        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        assert order_response.status_code == 200
        order = order_response.json()
        
        # Create payment with pay_on_collection
        payment_data = {
            "order_id": order["id"],
            "amount": 10.8,
            "payment_method": "pay_on_collection"
        }
        payment_response = requests.post(f"{BASE_URL}/api/payments", json=payment_data, headers=auth_headers)
        assert payment_response.status_code == 200
        payment = payment_response.json()
        
        assert payment["payment_method"] == "pay_on_collection"
        assert payment["status"] == "pending"  # Should be pending until collection
        print(f"Pay on collection payment created: {payment['id']}")
    
    def test_invoice_payment_business_customer(self, auth_headers, business_customer):
        """Test invoice payment method for business customer"""
        # Create an order for business customer
        order_data = {
            "customer_id": business_customer["id"],
            "customer_name": business_customer["name"],
            "customer_phone": business_customer["phone"],
            "customer_type": "business",
            "items": [{
                "item_id": "test-item",
                "item_name": "Test Item",
                "quantity": 1,
                "service_type": "regular",
                "unit_price": 50.0,
                "total_price": 50.0
            }],
            "subtotal": 50.0,
            "tax": 4.0,
            "total": 54.0
        }
        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        assert order_response.status_code == 200
        order = order_response.json()
        
        # Create payment with invoice
        payment_data = {
            "order_id": order["id"],
            "amount": 54.0,
            "payment_method": "invoice"
        }
        payment_response = requests.post(f"{BASE_URL}/api/payments", json=payment_data, headers=auth_headers)
        assert payment_response.status_code == 200
        payment = payment_response.json()
        
        assert payment["payment_method"] == "invoice"
        assert payment["status"] == "pending"  # Invoice payments are pending
        print(f"Invoice payment created for business customer: {payment['id']}")
    
    def test_invoice_payment_rejected_for_retail(self, auth_headers, retail_customer):
        """Test that invoice payment is rejected for retail customers"""
        # Create an order for retail customer
        order_data = {
            "customer_id": retail_customer["id"],
            "customer_name": retail_customer["name"],
            "customer_phone": retail_customer["phone"],
            "customer_type": "retail",
            "items": [{
                "item_id": "test-item",
                "item_name": "Test Item",
                "quantity": 1,
                "service_type": "regular",
                "unit_price": 20.0,
                "total_price": 20.0
            }],
            "subtotal": 20.0,
            "tax": 1.6,
            "total": 21.6
        }
        order_response = requests.post(f"{BASE_URL}/api/orders", json=order_data, headers=auth_headers)
        assert order_response.status_code == 200
        order = order_response.json()
        
        # Try to create invoice payment for retail customer - should fail
        payment_data = {
            "order_id": order["id"],
            "amount": 21.6,
            "payment_method": "invoice"
        }
        payment_response = requests.post(f"{BASE_URL}/api/payments", json=payment_data, headers=auth_headers)
        assert payment_response.status_code == 400, "Invoice payment should be rejected for retail customers"
        print("Invoice payment correctly rejected for retail customer")


class TestParentChildItems:
    """Test parent-child item selection"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_parent_items_only(self, auth_headers):
        """Test getting only parent items (no children)"""
        response = requests.get(f"{BASE_URL}/api/items?parents_only=true", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # All items should have no parent_id
        for item in data:
            assert item.get("parent_id") is None, f"Item {item['name']} should not have parent_id"
        
        print(f"Found {len(data)} parent items")
    
    def test_get_item_children(self, auth_headers):
        """Test getting children for a parent item"""
        # First get parent items
        response = requests.get(f"{BASE_URL}/api/items?parents_only=true", headers=auth_headers)
        assert response.status_code == 200
        parent_items = response.json()
        
        # Find a parent with children
        for parent in parent_items:
            if parent.get("children") and len(parent["children"]) > 0:
                parent_id = parent["id"]
                
                # Get children via dedicated endpoint
                children_response = requests.get(f"{BASE_URL}/api/items/children/{parent_id}", headers=auth_headers)
                assert children_response.status_code == 200
                children = children_response.json()
                
                print(f"Parent '{parent['name']}' has {len(children)} children")
                return
        
        print("No parent items with children found - this may be expected if no child items exist")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@dryclean.com",
            "password": "admin123"
        })
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_cleanup_test_customers(self, auth_headers):
        """Clean up TEST_ prefixed customers"""
        response = requests.get(f"{BASE_URL}/api/customers?search=TEST_", headers=auth_headers)
        if response.status_code == 200:
            customers = response.json()
            deleted = 0
            for customer in customers:
                if customer["name"].startswith("TEST_"):
                    del_response = requests.delete(f"{BASE_URL}/api/customers/{customer['id']}", headers=auth_headers)
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"Cleaned up {deleted} test customers")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
