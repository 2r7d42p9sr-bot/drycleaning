import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import api from "@/lib/api";
import { browserPrintReceipt, browserPrintLabel } from "@/lib/printer";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  User,
  CreditCard,
  Banknote,
  Building2,
  CalendarIcon,
  Printer,
  Tag,
  DollarSign,
  Loader2,
  ShoppingCart,
  X
} from "lucide-react";
import { format, addDays } from "date-fns";

const SERVICE_TYPES = [
  { value: "regular", label: "Regular", color: "bg-slate-100 text-slate-800" },
  { value: "express", label: "Express", color: "bg-amber-100 text-amber-800" },
  { value: "delicate", label: "Delicate", color: "bg-purple-100 text-purple-800" },
];

export default function POSPage() {
  // State
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [serviceType, setServiceType] = useState("regular");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [estimatedReady, setEstimatedReady] = useState(addDays(new Date(), 2));
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  
  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Discount
  const [discountAmount, setDiscountAmount] = useState(0);

  // Tax rate (8%)
  const TAX_RATE = 0.08;

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, categoriesRes] = await Promise.all([
          api.get("/items"),
          api.get("/item-categories"),
        ]);
        setItems(itemsRes.data);
        setCategories(["all", ...categoriesRes.data.categories]);
      } catch (error) {
        toast.error("Failed to load items");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Search customers
  const searchCustomers = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setCustomers([]);
      return;
    }
    try {
      const response = await api.get(`/customers?search=${encodeURIComponent(query)}`);
      setCustomers(response.data);
    } catch (error) {
      console.error("Error searching customers:", error);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      searchCustomers(customerSearch);
    }, 300);
    return () => clearTimeout(debounce);
  }, [customerSearch, searchCustomers]);

  // Filter items
  const filteredItems = items.filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Cart calculations
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const tax = subtotal * TAX_RATE;
  const total = subtotal + tax - discountAmount;

  // Add item to cart
  const addToCart = (item) => {
    const price = item.prices[serviceType];
    const existingIndex = cart.findIndex(
      (c) => c.item_id === item.id && c.service_type === serviceType
    );

    if (existingIndex >= 0) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      updated[existingIndex].total_price = updated[existingIndex].quantity * updated[existingIndex].unit_price;
      setCart(updated);
    } else {
      setCart([
        ...cart,
        {
          item_id: item.id,
          item_name: item.name,
          quantity: 1,
          service_type: serviceType,
          unit_price: price,
          total_price: price,
          notes: "",
        },
      ]);
    }
    toast.success(`Added ${item.name}`);
  };

  // Update cart item quantity
  const updateQuantity = (index, delta) => {
    const updated = [...cart];
    updated[index].quantity += delta;
    if (updated[index].quantity <= 0) {
      updated.splice(index, 1);
    } else {
      updated[index].total_price = updated[index].quantity * updated[index].unit_price;
    }
    setCart(updated);
  };

  // Remove item from cart
  const removeFromCart = (index) => {
    const updated = [...cart];
    updated.splice(index, 1);
    setCart(updated);
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setDiscountAmount(0);
    setEstimatedReady(addDays(new Date(), 2));
  };

  // Create new customer
  const handleCreateCustomer = async () => {
    if (!newCustomer.name || !newCustomer.phone) {
      toast.error("Name and phone are required");
      return;
    }
    try {
      const response = await api.post("/customers", newCustomer);
      setSelectedCustomer(response.data);
      setShowNewCustomerModal(false);
      setShowCustomerModal(false);
      setNewCustomer({ name: "", phone: "", email: "" });
      toast.success("Customer created");
    } catch (error) {
      toast.error("Failed to create customer");
    }
  };

  // Process payment
  const processPayment = async (method) => {
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return;
    }
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setProcessing(true);
    try {
      // Create order
      const orderData = {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone,
        items: cart,
        subtotal,
        tax,
        discount: discountAmount,
        total,
        estimated_ready: format(estimatedReady, "yyyy-MM-dd HH:mm"),
      };

      const orderRes = await api.post("/orders", orderData);
      const order = orderRes.data;

      // Process payment
      const paymentData = {
        order_id: order.id,
        amount: total,
        payment_method: method,
        origin_url: window.location.origin,
      };

      const paymentRes = await api.post("/payments", paymentData);

      if (method === "card" && paymentRes.data.checkout_url) {
        // Redirect to Stripe
        window.location.href = paymentRes.data.checkout_url;
        return;
      }

      // For cash/bank transfer - payment complete
      toast.success("Order created successfully!");
      
      // Print receipt
      browserPrintReceipt(order, { name: "DryClean POS", taxRate: TAX_RATE });
      
      // Clear and close
      clearCart();
      setShowPaymentModal(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to process order");
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="pos-layout" data-testid="pos-page">
      {/* Left Side - Items */}
      <div className="flex flex-col gap-4">
        {/* Service Type & Search */}
        <div className="flex gap-3 items-center">
          <div className="flex gap-2">
            {SERVICE_TYPES.map((type) => (
              <Button
                key={type.value}
                variant={serviceType === type.value ? "default" : "outline"}
                size="sm"
                onClick={() => setServiceType(type.value)}
                className={serviceType === type.value ? "bg-slate-800" : ""}
                data-testid={`service-type-${type.value}`}
              >
                {type.label}
              </Button>
            ))}
          </div>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="item-search-input"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
              className={`flex-shrink-0 ${selectedCategory === category ? "bg-blue-500 hover:bg-blue-600" : ""}`}
              data-testid={`category-${category}`}
            >
              {category === "all" ? "All Items" : category}
            </Button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4 overflow-y-auto">
          <div className="item-grid">
            {filteredItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="text-left cursor-pointer card-hover border border-slate-200 rounded-xl bg-white p-4 hover:border-blue-300 transition-colors active:scale-95"
                onClick={() => addToCart(item)}
                data-testid={`item-${item.id}`}
              >
                <p className="font-medium text-slate-800 text-sm mb-1 line-clamp-2">
                  {item.name}
                </p>
                <p className="text-xs text-slate-500 mb-2">{item.category}</p>
                <p className="font-bold text-blue-600">
                  ${item.prices[serviceType].toFixed(2)}
                </p>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Cart */}
      <div className="cart-container">
        {/* Customer Selection */}
        <div className="p-4 border-b border-slate-200">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-800">{selectedCustomer.name}</p>
                  <p className="text-sm text-slate-500">{selectedCustomer.phone}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedCustomer(null)}
                data-testid="clear-customer-btn"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => setShowCustomerModal(true)}
              data-testid="select-customer-btn"
            >
              <User className="w-4 h-4 mr-2" />
              Select Customer
            </Button>
          )}
        </div>

        {/* Cart Items */}
        <ScrollArea className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-state">
              <ShoppingCart className="empty-state-icon" />
              <p className="text-slate-500">Cart is empty</p>
              <p className="text-sm text-slate-400 mt-1">Click items to add them</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div
                  key={`${item.item_id}-${item.service_type}`}
                  className="bg-slate-50 rounded-lg p-3"
                  data-testid={`cart-item-${index}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-slate-800">{item.item_name}</p>
                      <Badge className={SERVICE_TYPES.find(t => t.value === item.service_type)?.color}>
                        {item.service_type}
                      </Badge>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-500"
                      onClick={() => removeFromCart(index)}
                      data-testid={`remove-item-${index}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(index, -1)}
                        data-testid={`decrease-qty-${index}`}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => updateQuantity(index, 1)}
                        data-testid={`increase-qty-${index}`}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <p className="font-bold text-slate-800">${item.total_price.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Cart Footer */}
        <div className="cart-footer space-y-4">
          {/* Estimated Ready Date */}
          <div className="flex items-center justify-between">
            <Label className="text-slate-600">Ready Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" data-testid="ready-date-btn">
                  <CalendarIcon className="w-4 h-4" />
                  {format(estimatedReady, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={estimatedReady}
                  onSelect={(date) => date && setEstimatedReady(date)}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Discount */}
          <div className="flex items-center justify-between">
            <Label className="text-slate-600">Discount</Label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">$</span>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                className="w-20 h-8 text-right"
                data-testid="discount-input"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 pt-2 border-t border-slate-200">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="text-slate-800">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tax (8%)</span>
              <span className="text-slate-800">${tax.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Discount</span>
                <span className="text-green-600">-${discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
              <span className="text-slate-800">Total</span>
              <span className="text-blue-600">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={clearCart}
              disabled={cart.length === 0}
              className="flex-1"
              data-testid="clear-cart-btn"
            >
              Clear
            </Button>
            <Button
              onClick={() => setShowPaymentModal(true)}
              disabled={cart.length === 0 || !selectedCustomer}
              className="flex-1 bg-blue-500 hover:bg-blue-600"
              data-testid="checkout-btn"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Checkout
            </Button>
          </div>
        </div>
      </div>

      {/* Customer Selection Modal */}
      <Dialog open={showCustomerModal} onOpenChange={setShowCustomerModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Select Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, phone, or email..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="pl-10"
                data-testid="customer-search-input"
              />
            </div>
            
            <ScrollArea className="h-[300px]">
              {customers.length > 0 ? (
                <div className="space-y-2">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className="p-3 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => {
                        setSelectedCustomer(customer);
                        setShowCustomerModal(false);
                        setCustomerSearch("");
                      }}
                      data-testid={`customer-option-${customer.id}`}
                    >
                      <p className="font-medium text-slate-800">{customer.name}</p>
                      <p className="text-sm text-slate-500">{customer.phone}</p>
                      {customer.loyalty_points > 0 && (
                        <Badge className="mt-1 bg-amber-100 text-amber-800">
                          {customer.loyalty_points} points
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              ) : customerSearch.length >= 2 ? (
                <div className="text-center py-8 text-slate-500">
                  <p>No customers found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <p>Type to search customers</p>
                </div>
              )}
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCustomerModal(false);
                setShowNewCustomerModal(true);
              }}
              data-testid="new-customer-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Modal */}
      <Dialog open={showNewCustomerModal} onOpenChange={setShowNewCustomerModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">Name *</Label>
              <Input
                id="customer-name"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                placeholder="Full name"
                data-testid="new-customer-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-phone">Phone *</Label>
              <Input
                id="customer-phone"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                placeholder="Phone number"
                data-testid="new-customer-phone"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">Email</Label>
              <Input
                id="customer-email"
                type="email"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                placeholder="Email address (optional)"
                data-testid="new-customer-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCustomerModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCustomer} data-testid="save-customer-btn">
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount</span>
                <span className="text-blue-600">${total.toFixed(2)}</span>
              </div>
            </div>
            
            <p className="text-sm text-slate-600 font-medium">Select Payment Method</p>
            
            <div className="grid grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => processPayment("cash")}
                disabled={processing}
                data-testid="pay-cash-btn"
              >
                <Banknote className="w-8 h-8 text-green-600" />
                <span>Cash</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => processPayment("card")}
                disabled={processing}
                data-testid="pay-card-btn"
              >
                <CreditCard className="w-8 h-8 text-blue-600" />
                <span>Card</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => processPayment("bank_transfer")}
                disabled={processing}
                data-testid="pay-bank-btn"
              >
                <Building2 className="w-8 h-8 text-purple-600" />
                <span>Bank</span>
              </Button>
            </div>

            {processing && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                <span className="ml-2 text-slate-600">Processing...</span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
