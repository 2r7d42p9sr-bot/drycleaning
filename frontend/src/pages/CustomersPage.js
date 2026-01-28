import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  User,
  Phone,
  Mail,
  MapPin,
  Award,
  ShoppingBag,
  DollarSign,
  X,
  Building2,
  AlertTriangle,
  Ban,
  CreditCard,
  Clock,
  TrendingUp,
  Package,
  Calendar
} from "lucide-react";
import { format } from "date-fns";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerStats, setCustomerStats] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    customer_type: "retail",
    discount_percent: 0,
    require_advance_payment: false,
    is_blacklisted: false,
    blacklist_reason: "",
    business_info: {
      company_name: "",
      registration_number: "",
      vat_number: "",
      contact_person: "",
      billing_email: "",
      payment_terms: 30,
    },
    preferences: {
      fold_style: "standard",
      special_instructions: "",
    },
    addresses: [],
  });

  const [newAddress, setNewAddress] = useState({
    street: "",
    city: "",
    postal_code: "",
    country: "US",
    label: "Home",
    is_default: false,
  });

  useEffect(() => {
    fetchCustomers();
  }, [filterType]);

  useEffect(() => {
    if (selectedCustomer) {
      fetchCustomerDetails(selectedCustomer.id);
    }
  }, [selectedCustomer]);

  const fetchCustomers = async (search = "") => {
    try {
      let params = search ? `?search=${encodeURIComponent(search)}` : "";
      if (filterType !== "all") {
        params += params ? `&customer_type=${filterType}` : `?customer_type=${filterType}`;
      }
      const response = await api.get(`/customers${params}`);
      setCustomers(response.data);
    } catch (error) {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerDetails = async (customerId) => {
    setLoadingDetails(true);
    try {
      const [statsRes, ordersRes] = await Promise.all([
        api.get(`/customers/${customerId}/stats`),
        api.get(`/customers/${customerId}/orders`)
      ]);
      setCustomerStats(statsRes.data);
      setCustomerOrders(ordersRes.data);
    } catch (error) {
      console.error("Failed to load customer details:", error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.length >= 2 || query.length === 0) {
      fetchCustomers(query);
    }
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({
      name: "",
      phone: "",
      email: "",
      customer_type: "retail",
      discount_percent: 0,
      require_advance_payment: false,
      is_blacklisted: false,
      blacklist_reason: "",
      business_info: {
        company_name: "",
        registration_number: "",
        vat_number: "",
        contact_person: "",
        billing_email: "",
        payment_terms: 30,
      },
      preferences: {
        fold_style: "standard",
        special_instructions: "",
      },
      addresses: [],
    });
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      customer_type: customer.customer_type || "retail",
      discount_percent: customer.discount_percent || 0,
      require_advance_payment: customer.require_advance_payment || false,
      is_blacklisted: customer.is_blacklisted || false,
      blacklist_reason: customer.blacklist_reason || "",
      business_info: customer.business_info || {
        company_name: "",
        registration_number: "",
        vat_number: "",
        contact_person: "",
        billing_email: "",
        payment_terms: 30,
      },
      preferences: customer.preferences || {
        fold_style: "standard",
        special_instructions: "",
      },
      addresses: customer.addresses || [],
    });
    setShowModal(true);
  };

  const handleAddAddress = () => {
    if (!newAddress.street || !newAddress.city || !newAddress.postal_code) {
      toast.error("Please fill in street, city, and postal code");
      return;
    }
    setFormData({
      ...formData,
      addresses: [...formData.addresses, { ...newAddress }],
    });
    setNewAddress({
      street: "",
      city: "",
      postal_code: "",
      country: "US",
      label: "Home",
      is_default: false,
    });
  };

  const handleRemoveAddress = (index) => {
    const updated = [...formData.addresses];
    updated.splice(index, 1);
    setFormData({ ...formData, addresses: updated });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      toast.error("Name and phone are required");
      return;
    }

    // Validate business info if customer type is business
    if (formData.customer_type === "business" && !formData.business_info.company_name) {
      toast.error("Company name is required for business customers");
      return;
    }

    try {
      const payload = {
        ...formData,
        business_info: formData.customer_type === "business" ? formData.business_info : null,
      };

      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, payload);
        toast.success("Customer updated");
      } else {
        await api.post("/customers", payload);
        toast.success("Customer created");
      }
      setShowModal(false);
      fetchCustomers(searchQuery);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save customer");
    }
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}?`)) return;

    try {
      await api.delete(`/customers/${customer.id}`);
      toast.success("Customer deleted");
      fetchCustomers(searchQuery);
      if (selectedCustomer?.id === customer.id) {
        setSelectedCustomer(null);
        setCustomerStats(null);
        setCustomerOrders([]);
      }
    } catch (error) {
      toast.error("Failed to delete customer");
    }
  };

  const getStatusBadge = (customer) => {
    if (customer.is_blacklisted) {
      return <Badge className="bg-red-100 text-red-800"><Ban className="w-3 h-3 mr-1" />Blacklisted</Badge>;
    }
    if (customer.require_advance_payment) {
      return <Badge className="bg-amber-100 text-amber-800"><CreditCard className="w-3 h-3 mr-1" />Advance Required</Badge>;
    }
    return null;
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="customers-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Customers
          </h1>
          <p className="text-slate-500 mt-1">Manage your customer database</p>
        </div>
        <Button onClick={openCreateModal} className="bg-blue-500 hover:bg-blue-600" data-testid="add-customer-btn">
          <Plus className="w-4 h-4 mr-2" />
          Add Customer
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="lg:col-span-2">
          <Card className="border-slate-200">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name, phone, email, or company..."
                    value={searchQuery}
                    onChange={handleSearch}
                    className="pl-10"
                    data-testid="customer-search"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40" data-testid="customer-type-filter">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length > 0 ? (
                    customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className={`cursor-pointer ${selectedCustomer?.id === customer.id ? 'bg-blue-50' : ''}`}
                        onClick={() => setSelectedCustomer(customer)}
                        data-testid={`customer-row-${customer.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              customer.customer_type === 'business' ? 'bg-green-100' : 'bg-blue-100'
                            }`}>
                              {customer.customer_type === 'business' ? (
                                <Building2 className="w-5 h-5 text-green-600" />
                              ) : (
                                <span className="text-sm font-semibold text-blue-600">
                                  {customer.name.charAt(0).toUpperCase()}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{customer.name}</p>
                              {customer.business_info?.company_name && (
                                <p className="text-sm text-slate-500">{customer.business_info.company_name}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={customer.customer_type === 'business' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                            {customer.customer_type || 'retail'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <p className="text-slate-800">{customer.phone}</p>
                          {customer.email && (
                            <p className="text-sm text-slate-500">{customer.email}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col items-end gap-1">
                            {getStatusBadge(customer)}
                            {customer.discount_percent > 0 && (
                              <Badge className="bg-purple-100 text-purple-800">
                                {customer.discount_percent}% discount
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditModal(customer);
                              }}
                              data-testid={`edit-customer-${customer.id}`}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-red-500 hover:text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(customer);
                              }}
                              data-testid={`delete-customer-${customer.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        No customers found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Customer Details */}
        <div>
          <Card className="border-slate-200 sticky top-24">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Customer Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <Tabs defaultValue="overview" className="space-y-4">
                  <TabsList className="grid grid-cols-3 w-full">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="stats">Stats</TabsTrigger>
                    <TabsTrigger value="orders">Orders</TabsTrigger>
                  </TabsList>

                  {/* Overview Tab */}
                  <TabsContent value="overview">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                          selectedCustomer.customer_type === 'business' ? 'bg-green-100' : 'bg-blue-100'
                        }`}>
                          {selectedCustomer.customer_type === 'business' ? (
                            <Building2 className="w-8 h-8 text-green-600" />
                          ) : (
                            <span className="text-2xl font-bold text-blue-600">
                              {selectedCustomer.name.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-lg font-bold text-slate-800">{selectedCustomer.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={selectedCustomer.customer_type === 'business' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                              {selectedCustomer.customer_type || 'retail'}
                            </Badge>
                            {getStatusBadge(selectedCustomer)}
                          </div>
                        </div>
                      </div>

                      {selectedCustomer.is_blacklisted && selectedCustomer.blacklist_reason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-red-800">
                            <AlertTriangle className="w-4 h-4" />
                            <span className="font-medium">Blacklist Reason:</span>
                          </div>
                          <p className="text-sm text-red-700 mt-1">{selectedCustomer.blacklist_reason}</p>
                        </div>
                      )}

                      <div className="space-y-3 pt-4 border-t border-slate-200">
                        <div className="flex items-center gap-3 text-slate-600">
                          <Phone className="w-4 h-4" />
                          <span>{selectedCustomer.phone}</span>
                        </div>
                        {selectedCustomer.email && (
                          <div className="flex items-center gap-3 text-slate-600">
                            <Mail className="w-4 h-4" />
                            <span>{selectedCustomer.email}</span>
                          </div>
                        )}
                        {selectedCustomer.discount_percent > 0 && (
                          <div className="flex items-center gap-3 text-purple-600">
                            <DollarSign className="w-4 h-4" />
                            <span>{selectedCustomer.discount_percent}% customer discount</span>
                          </div>
                        )}
                      </div>

                      {selectedCustomer.customer_type === 'business' && selectedCustomer.business_info && (
                        <div className="pt-4 border-t border-slate-200">
                          <p className="font-medium text-slate-800 mb-2 flex items-center gap-2">
                            <Building2 className="w-4 h-4" />
                            Business Information
                          </p>
                          <div className="space-y-2 text-sm text-slate-600">
                            <p><span className="font-medium">Company:</span> {selectedCustomer.business_info.company_name}</p>
                            {selectedCustomer.business_info.registration_number && (
                              <p><span className="font-medium">Reg #:</span> {selectedCustomer.business_info.registration_number}</p>
                            )}
                            {selectedCustomer.business_info.vat_number && (
                              <p><span className="font-medium">VAT #:</span> {selectedCustomer.business_info.vat_number}</p>
                            )}
                            {selectedCustomer.business_info.payment_terms && (
                              <p><span className="font-medium">Payment Terms:</span> {selectedCustomer.business_info.payment_terms} days</p>
                            )}
                          </div>
                        </div>
                      )}

                      <Button
                        variant="outline"
                        className="w-full mt-4"
                        onClick={() => openEditModal(selectedCustomer)}
                        data-testid="edit-selected-customer"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Customer
                      </Button>
                    </div>
                  </TabsContent>

                  {/* Stats Tab */}
                  <TabsContent value="stats">
                    {loadingDetails ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="spinner w-6 h-6"></div>
                      </div>
                    ) : customerStats ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <ShoppingBag className="w-4 h-4" />
                              Total Orders
                            </div>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                              {customerStats.total_orders}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <DollarSign className="w-4 h-4" />
                              Total Spent
                            </div>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                              ${customerStats.total_spent?.toFixed(2)}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <TrendingUp className="w-4 h-4" />
                              Avg. Order
                            </div>
                            <p className="text-xl font-bold text-slate-800 mt-1">
                              ${customerStats.average_order_value?.toFixed(2)}
                            </p>
                          </div>
                          <div className="bg-slate-50 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-slate-500 text-sm">
                              <Award className="w-4 h-4" />
                              Loyalty Points
                            </div>
                            <p className="text-xl font-bold text-amber-600 mt-1">
                              {customerStats.loyalty_points}
                            </p>
                          </div>
                        </div>

                        <div className="bg-blue-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                            <Clock className="w-4 h-4" />
                            Active Orders
                          </div>
                          <p className="text-2xl font-bold text-blue-800">
                            {customerStats.active_orders}
                          </p>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-slate-500 text-sm mb-1">
                            <Package className="w-4 h-4" />
                            Items Cleaned
                          </div>
                          <p className="text-xl font-bold text-slate-800">
                            {customerStats.total_items_cleaned}
                          </p>
                        </div>

                        {customerStats.top_items?.length > 0 && (
                          <div className="pt-4 border-t border-slate-200">
                            <p className="font-medium text-slate-800 mb-2">Most Ordered Items</p>
                            <div className="space-y-2">
                              {customerStats.top_items.map((item, index) => (
                                <div key={index} className="flex justify-between text-sm">
                                  <span className="text-slate-600">{item.name}</span>
                                  <span className="font-medium text-slate-800">{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {customerStats.last_order_date && (
                          <div className="pt-4 border-t border-slate-200">
                            <p className="text-sm text-slate-500">
                              Last Order: {customerStats.last_order_date 
                                ? format(new Date(customerStats.last_order_date), "MMM d, yyyy")
                                : 'N/A'}
                            </p>
                            <p className="text-sm text-slate-500">
                              Member Since: {customerStats.member_since
                                ? format(new Date(customerStats.member_since), "MMM d, yyyy")
                                : 'N/A'}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        No statistics available
                      </div>
                    )}
                  </TabsContent>

                  {/* Orders Tab */}
                  <TabsContent value="orders">
                    {loadingDetails ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="spinner w-6 h-6"></div>
                      </div>
                    ) : customerOrders.length > 0 ? (
                      <ScrollArea className="h-[400px]">
                        <div className="space-y-3">
                          {customerOrders.map((order) => (
                            <div key={order.id} className="bg-slate-50 rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-medium text-slate-800">{order.order_number}</span>
                                <Badge className={
                                  order.status === 'ready' ? 'bg-green-100 text-green-800' :
                                  order.status === 'cleaning' ? 'bg-blue-100 text-blue-800' :
                                  order.status === 'collected' ? 'bg-slate-100 text-slate-800' :
                                  'bg-amber-100 text-amber-800'
                                }>
                                  {order.status}
                                </Badge>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">
                                  {order.items?.length || 0} items
                                </span>
                                <span className="font-bold text-slate-800">${order.total?.toFixed(2)}</span>
                              </div>
                              <p className="text-xs text-slate-400 mt-1">
                                {order.timestamps?.created_at 
                                  ? format(new Date(order.timestamps.created_at), "MMM d, yyyy h:mm a")
                                  : 'Unknown date'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    ) : (
                      <div className="text-center py-8 text-slate-500">
                        No orders found
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  <p>Select a customer to view details</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              {editingCustomer ? "Edit Customer" : "New Customer"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      data-testid="customer-name-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      data-testid="customer-phone-input"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      data-testid="customer-email-input"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Type</Label>
                    <Select
                      value={formData.customer_type}
                      onValueChange={(value) => setFormData({ ...formData, customer_type: value })}
                    >
                      <SelectTrigger data-testid="customer-type-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="business">Business</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Customer Discount */}
                <div className="space-y-2">
                  <Label>Customer Discount (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: parseFloat(e.target.value) || 0 })}
                    data-testid="customer-discount-input"
                  />
                </div>
              </div>

              {/* Business Info */}
              {formData.customer_type === "business" && (
                <div className="pt-4 border-t border-slate-200">
                  <p className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Business Information
                  </p>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Company Name *</Label>
                        <Input
                          value={formData.business_info.company_name}
                          onChange={(e) => setFormData({
                            ...formData,
                            business_info: { ...formData.business_info, company_name: e.target.value }
                          })}
                          data-testid="company-name-input"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Registration Number</Label>
                        <Input
                          value={formData.business_info.registration_number}
                          onChange={(e) => setFormData({
                            ...formData,
                            business_info: { ...formData.business_info, registration_number: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>VAT Number</Label>
                        <Input
                          value={formData.business_info.vat_number}
                          onChange={(e) => setFormData({
                            ...formData,
                            business_info: { ...formData.business_info, vat_number: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Contact Person</Label>
                        <Input
                          value={formData.business_info.contact_person}
                          onChange={(e) => setFormData({
                            ...formData,
                            business_info: { ...formData.business_info, contact_person: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Billing Email</Label>
                        <Input
                          type="email"
                          value={formData.business_info.billing_email}
                          onChange={(e) => setFormData({
                            ...formData,
                            business_info: { ...formData.business_info, billing_email: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Payment Terms (Days)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={formData.business_info.payment_terms}
                          onChange={(e) => setFormData({
                            ...formData,
                            business_info: { ...formData.business_info, payment_terms: parseInt(e.target.value) || 30 }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Flags */}
              <div className="pt-4 border-t border-slate-200">
                <p className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Customer Flags
                </p>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">Force Advance Payment</p>
                      <p className="text-sm text-slate-500">Require payment before order processing</p>
                    </div>
                    <Switch
                      checked={formData.require_advance_payment}
                      onCheckedChange={(checked) => setFormData({ ...formData, require_advance_payment: checked })}
                      data-testid="advance-payment-switch"
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="font-medium text-slate-800">Blacklist Customer</p>
                      <p className="text-sm text-slate-500">Block customer from placing orders</p>
                    </div>
                    <Switch
                      checked={formData.is_blacklisted}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_blacklisted: checked })}
                      data-testid="blacklist-switch"
                    />
                  </div>
                  {formData.is_blacklisted && (
                    <div className="space-y-2">
                      <Label>Blacklist Reason</Label>
                      <Textarea
                        value={formData.blacklist_reason}
                        onChange={(e) => setFormData({ ...formData, blacklist_reason: e.target.value })}
                        placeholder="Enter reason for blacklisting..."
                        data-testid="blacklist-reason-input"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Preferences */}
              <div className="pt-4 border-t border-slate-200">
                <p className="font-medium text-slate-800 mb-3">Preferences</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fold Style</Label>
                    <Select
                      value={formData.preferences.fold_style}
                      onValueChange={(value) => setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, fold_style: value }
                      })}
                    >
                      <SelectTrigger data-testid="fold-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="hanger">On Hanger</SelectItem>
                        <SelectItem value="box">Box Fold</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <Label>Special Instructions</Label>
                  <Textarea
                    value={formData.preferences.special_instructions}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, special_instructions: e.target.value },
                      })
                    }
                    placeholder="Any special care instructions..."
                    data-testid="special-instructions-input"
                  />
                </div>
              </div>

              {/* Addresses */}
              <div className="pt-4 border-t border-slate-200">
                <p className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Addresses
                </p>
                
                {formData.addresses.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formData.addresses.map((address, index) => (
                      <div key={index} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <Badge className="mb-1">{address.label}</Badge>
                          <p className="text-sm text-slate-800">{address.street}</p>
                          <p className="text-sm text-slate-600">{address.city}, {address.postal_code}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500"
                          onClick={() => handleRemoveAddress(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 p-3 bg-slate-50 rounded-lg">
                  <p className="text-sm font-medium text-slate-600">Add New Address</p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      placeholder="Street"
                      value={newAddress.street}
                      onChange={(e) => setNewAddress({ ...newAddress, street: e.target.value })}
                    />
                    <Input
                      placeholder="City"
                      value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                    />
                    <Input
                      placeholder="Postal Code"
                      value={newAddress.postal_code}
                      onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                    />
                    <Select
                      value={newAddress.label}
                      onValueChange={(value) => setNewAddress({ ...newAddress, label: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Home">Home</SelectItem>
                        <SelectItem value="Work">Work</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleAddAddress}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Address
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="save-customer-btn">
              {editingCustomer ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
