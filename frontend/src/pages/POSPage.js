import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import api from "@/lib/api";
import { browserPrintReceipt } from "@/lib/printer";
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
  DollarSign,
  Loader2,
  ShoppingCart,
  X,
  Truck,
  MapPin,
  Percent
} from "lucide-react";
import { format, addDays } from "date-fns";

const SERVICE_TYPES = [
  { value: "regular", label: "Regular", color: "bg-slate-100 text-slate-800" },
  { value: "express", label: "Express", color: "bg-amber-100 text-amber-800" },
  { value: "delicate", label: "Delicate", color: "bg-purple-100 text-purple-800" },
];

const TIME_SLOTS = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 2:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
  "6:00 PM - 8:00 PM",
];

export default function POSPage() {
  // State
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [settings, setSettings] = useState(null);
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
  
  // Delivery state
  const [enableDelivery, setEnableDelivery] = useState(false);
  const [deliveryType, setDeliveryType] = useState("both");
  const [pickupDate, setPickupDate] = useState(null);
  const [pickupTimeSlot, setPickupTimeSlot] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(null);
  const [deliveryTimeSlot, setDeliveryTimeSlot] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryFee, setDeliveryFee] = useState(0);
  
  // Modals
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  
  // New customer form
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
  });

  // Discount
  const [discountAmount, setDiscountAmount] = useState(0);

  // Fetch data on mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [itemsRes, allItemsRes, categoriesRes, settingsRes] = await Promise.all([
          api.get("/items?include_children=true"),
          api.get("/items/all"),
          api.get("/categories"),
          api.get("/settings"),
        ]);
        setItems(itemsRes.data);
        setAllItems(allItemsRes.data);
        setCategories(categoriesRes.data);
        setSettings(settingsRes.data.settings);
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Get tax rate from settings
  const TAX_RATE = (settings?.tax?.tax_rate || 8) / 100;
  const currencySymbol = settings?.country?.currency_symbol || "$";

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

  // Flatten items for display (include children)
  const getDisplayItems = () => {
    const displayItems = [];
    items.forEach((item) => {
      displayItems.push(item);
      if (item.children?.length > 0) {
        item.children.forEach((child) => {
          displayItems.push({ ...child, isChild: true });
        });
      }
    });
    return displayItems;
  };

  // Filter items
  const filteredItems = getDisplayItems().filter((item) => {
    const matchesCategory = selectedCategory === "all" || item.category_id === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Calculate volume discount for an item in cart
  const calculateVolumeDiscount = (item, quantity) => {
    const fullItem = allItems.find(i => i.id === item.item_id);
    if (!fullItem?.volume_discounts?.length) return 0;
    
    let applicableDiscount = 0;
    for (const vd of fullItem.volume_discounts.sort((a, b) => b.min_quantity - a.min_quantity)) {
      if (quantity >= vd.min_quantity) {
        applicableDiscount = vd.discount_percent;
        break;
      }
    }
    return applicableDiscount;
  };

  // Cart calculations with volume discounts
  const calculateCartTotals = () => {
    let subtotal = 0;
    let totalDiscount = 0;
    
    cart.forEach((item) => {
      const volumeDiscountPercent = calculateVolumeDiscount(item, item.quantity);
      const itemTotal = item.quantity * item.unit_price;
      const volumeDiscountAmount = itemTotal * (volumeDiscountPercent / 100);
      
      subtotal += itemTotal;
      totalDiscount += volumeDiscountAmount;
    });
    
    const tax = (subtotal - totalDiscount) * TAX_RATE;
    const deliveryTotal = enableDelivery ? deliveryFee : 0;
    const total = subtotal - totalDiscount + tax - discountAmount + deliveryTotal;
    
    return { subtotal, volumeDiscount: totalDiscount, tax, deliveryFee: deliveryTotal, total };
  };

  const { subtotal, volumeDiscount, tax, deliveryFee: deliveryTotal, total } = calculateCartTotals();

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
    setEnableDelivery(false);
    setDeliveryType("both");
    setPickupDate(null);
    setPickupTimeSlot("");
    setDeliveryDate(null);
    setDeliveryTimeSlot("");
    setDeliveryAddress("");
    setDeliveryFee(0);
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
      // Prepare cart items with volume discounts applied
      const cartItems = cart.map((item) => {
        const volumeDiscountPercent = calculateVolumeDiscount(item, item.quantity);
        const discountApplied = item.total_price * (volumeDiscountPercent / 100);
        return {
          ...item,
          discount_applied: discountApplied,
        };
      });

      // Prepare delivery info if enabled
      let deliveryInfo = null;
      if (enableDelivery) {
        deliveryInfo = {
          type: deliveryType,
          pickup_date: pickupDate ? format(pickupDate, "yyyy-MM-dd") : null,
          pickup_time_slot: pickupTimeSlot || null,
          delivery_date: deliveryDate ? format(deliveryDate, "yyyy-MM-dd") : null,
          delivery_time_slot: deliveryTimeSlot || null,
          delivery_address: deliveryAddress ? { street: deliveryAddress, city: "", postal_code: "", country: settings?.country?.country_code || "US" } : null,
          delivery_fee: deliveryFee,
        };
      }

      // Create order
      const orderData = {
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_phone: selectedCustomer.phone,
        items: cartItems,
        subtotal,
        tax,
        tax_details: { [settings?.tax?.tax_name || "Tax"]: tax },
        discount: discountAmount + volumeDiscount,
        total,
        estimated_ready: format(estimatedReady, "yyyy-MM-dd HH:mm"),
        delivery_info: deliveryInfo,
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
        window.location.href = paymentRes.data.checkout_url;
        return;
      }

      toast.success("Order created successfully!");
      browserPrintReceipt(order, { 
        name: settings?.business_name || "DryClean POS", 
        taxRate: TAX_RATE,
        address: settings?.address,
        phone: settings?.phone,
      });
      
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

        {/* Category Dropdown */}
        <div className="flex items-center gap-2">
          <Label className="text-slate-600 whitespace-nowrap">Category:</Label>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[200px]" data-testid="pos-category-filter">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Items Grid */}
        <div className="flex-1 bg-white rounded-lg border border-slate-200 p-4 overflow-y-auto">
          <div className="item-grid">
            {filteredItems.map((item) => {
              const hasVolumeDiscount = allItems.find(i => i.id === item.id)?.volume_discounts?.length > 0;
              return (
                <button
                  key={`${item.id}-${item.isChild}`}
                  type="button"
                  className={`text-left cursor-pointer card-hover border rounded-xl bg-white p-4 hover:border-blue-300 transition-colors active:scale-95 ${
                    item.isChild ? "border-slate-100 bg-slate-50" : "border-slate-200"
                  }`}
                  onClick={() => addToCart(item)}
                  data-testid={`pos-item-${item.id}`}
                >
                  <div className="flex items-start justify-between">
                    <p className={`font-medium text-sm mb-1 line-clamp-2 ${item.isChild ? "text-slate-700" : "text-slate-800"}`}>
                      {item.isChild && "└ "}{item.name}
                    </p>
                    {hasVolumeDiscount && (
                      <Percent className="w-3 h-3 text-green-600 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mb-2">{item.category_name}</p>
                  <p className="font-bold text-blue-600">
                    {currencySymbol}{item.prices[serviceType].toFixed(2)}
                  </p>
                </button>
              );
            })}
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

        {/* Delivery Toggle */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-500" />
              <Label>Pickup & Delivery</Label>
            </div>
            <Switch
              checked={enableDelivery}
              onCheckedChange={setEnableDelivery}
              data-testid="enable-delivery-switch"
            />
          </div>
          {enableDelivery && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => setShowDeliveryModal(true)}
              data-testid="configure-delivery-btn"
            >
              <MapPin className="w-4 h-4 mr-2" />
              Configure Delivery
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
              {cart.map((item, index) => {
                const volumeDiscountPercent = calculateVolumeDiscount(item, item.quantity);
                return (
                  <div
                    key={`${item.item_id}-${item.service_type}`}
                    className="bg-slate-50 rounded-lg p-3"
                    data-testid={`cart-item-${index}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-slate-800">{item.item_name}</p>
                        <div className="flex items-center gap-2">
                          <Badge className={SERVICE_TYPES.find(t => t.value === item.service_type)?.color}>
                            {item.service_type}
                          </Badge>
                          {volumeDiscountPercent > 0 && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              -{volumeDiscountPercent}%
                            </Badge>
                          )}
                        </div>
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
                      <p className="font-bold text-slate-800">{currencySymbol}{item.total_price.toFixed(2)}</p>
                    </div>
                  </div>
                );
              })}
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
            <Label className="text-slate-600">Manual Discount</Label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{currencySymbol}</span>
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
              <span className="text-slate-800">{currencySymbol}{subtotal.toFixed(2)}</span>
            </div>
            {volumeDiscount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-green-600">Volume Discount</span>
                <span className="text-green-600">-{currencySymbol}{volumeDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">{settings?.tax?.tax_name || "Tax"} ({(TAX_RATE * 100).toFixed(1)}%)</span>
              <span className="text-slate-800">{currencySymbol}{tax.toFixed(2)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Manual Discount</span>
                <span className="text-green-600">-{currencySymbol}{discountAmount.toFixed(2)}</span>
              </div>
            )}
            {enableDelivery && deliveryTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Delivery Fee</span>
                <span className="text-slate-800">{currencySymbol}{deliveryTotal.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
              <span className="text-slate-800">Total</span>
              <span className="text-blue-600">{currencySymbol}{total.toFixed(2)}</span>
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

      {/* Delivery Modal */}
      <Dialog open={showDeliveryModal} onOpenChange={setShowDeliveryModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Pickup & Delivery</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Service Type</Label>
              <Select value={deliveryType} onValueChange={setDeliveryType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pickup">Pickup Only</SelectItem>
                  <SelectItem value="delivery">Delivery Only</SelectItem>
                  <SelectItem value="both">Pickup & Delivery</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(deliveryType === "pickup" || deliveryType === "both") && (
              <div className="space-y-3 p-3 bg-blue-50 rounded-lg">
                <Label className="text-blue-800">Pickup</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-sm">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {pickupDate ? format(pickupDate, "MMM d") : "Select"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={pickupDate}
                          onSelect={setPickupDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Time</Label>
                    <Select value={pickupTimeSlot} onValueChange={setPickupTimeSlot}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {(deliveryType === "delivery" || deliveryType === "both") && (
              <div className="space-y-3 p-3 bg-green-50 rounded-lg">
                <Label className="text-green-800">Delivery</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-green-600">Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-sm">
                          <CalendarIcon className="w-4 h-4 mr-2" />
                          {deliveryDate ? format(deliveryDate, "MMM d") : "Select"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={deliveryDate}
                          onSelect={setDeliveryDate}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-green-600">Time</Label>
                    <Select value={deliveryTimeSlot} onValueChange={setDeliveryTimeSlot}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Time slot" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_SLOTS.map((slot) => (
                          <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-green-600">Address</Label>
                  <Textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Enter delivery address"
                    className="text-sm"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Delivery Fee</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeliveryModal(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowDeliveryModal(false)}>
              Save
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
                <span className="text-blue-600">{currencySymbol}{total.toFixed(2)}</span>
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
