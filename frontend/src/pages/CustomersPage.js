import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  X
} from "lucide-react";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    preferences: {
      starch_level: "medium",
      fold_style: "standard",
      special_instructions: "",
    },
    measurements: {
      shirt_size: "",
      pant_waist: "",
      pant_length: "",
    },
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async (search = "") => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const response = await api.get(`/customers${params}`);
      setCustomers(response.data);
    } catch (error) {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
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
      address: "",
      preferences: {
        starch_level: "medium",
        fold_style: "standard",
        special_instructions: "",
      },
      measurements: {
        shirt_size: "",
        pant_waist: "",
        pant_length: "",
      },
    });
    setShowModal(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone,
      email: customer.email || "",
      address: customer.address || "",
      preferences: customer.preferences || {
        starch_level: "medium",
        fold_style: "standard",
        special_instructions: "",
      },
      measurements: customer.measurements || {
        shirt_size: "",
        pant_waist: "",
        pant_length: "",
      },
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.phone) {
      toast.error("Name and phone are required");
      return;
    }

    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
        toast.success("Customer updated");
      } else {
        await api.post("/customers", formData);
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
      }
    } catch (error) {
      toast.error("Failed to delete customer");
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by name, phone, or email..."
                  value={searchQuery}
                  onChange={handleSearch}
                  className="pl-10"
                  data-testid="customer-search"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Loyalty</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.length > 0 ? (
                    customers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedCustomer(customer)}
                        data-testid={`customer-row-${customer.id}`}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-semibold text-blue-600">
                                {customer.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{customer.name}</p>
                              <p className="text-sm text-slate-500">{customer.total_orders} orders</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-slate-800">{customer.phone}</p>
                          {customer.email && (
                            <p className="text-sm text-slate-500">{customer.email}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge className="bg-amber-100 text-amber-800">
                            <Award className="w-3 h-3 mr-1" />
                            {customer.loyalty_points}
                          </Badge>
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
                      <TableCell colSpan={4} className="text-center py-8 text-slate-500">
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
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedCustomer ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">
                        {selectedCustomer.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-slate-800">{selectedCustomer.name}</p>
                      <Badge className="bg-amber-100 text-amber-800">
                        <Award className="w-3 h-3 mr-1" />
                        {selectedCustomer.loyalty_points} points
                      </Badge>
                    </div>
                  </div>

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
                    {selectedCustomer.address && (
                      <div className="flex items-center gap-3 text-slate-600">
                        <MapPin className="w-4 h-4" />
                        <span>{selectedCustomer.address}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <ShoppingBag className="w-4 h-4" />
                        Total Orders
                      </div>
                      <p className="text-xl font-bold text-slate-800 mt-1">
                        {selectedCustomer.total_orders}
                      </p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-slate-500 text-sm">
                        <DollarSign className="w-4 h-4" />
                        Total Spent
                      </div>
                      <p className="text-xl font-bold text-slate-800 mt-1">
                        ${selectedCustomer.total_spent.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {selectedCustomer.preferences && (
                    <div className="pt-4 border-t border-slate-200">
                      <p className="font-medium text-slate-800 mb-2">Preferences</p>
                      <div className="space-y-2 text-sm text-slate-600">
                        <p>Starch: {selectedCustomer.preferences.starch_level}</p>
                        <p>Fold: {selectedCustomer.preferences.fold_style}</p>
                        {selectedCustomer.preferences.special_instructions && (
                          <p>Notes: {selectedCustomer.preferences.special_instructions}</p>
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              {editingCustomer ? "Edit Customer" : "New Customer"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
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
              <Label htmlFor="address">Address</Label>
              <Textarea
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                data-testid="customer-address-input"
              />
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="font-medium text-slate-800 mb-3">Preferences</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Starch Level</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-slate-300"
                    value={formData.preferences.starch_level}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, starch_level: e.target.value },
                      })
                    }
                    data-testid="starch-select"
                  >
                    <option value="none">None</option>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="heavy">Heavy</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Fold Style</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-slate-300"
                    value={formData.preferences.fold_style}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        preferences: { ...formData.preferences, fold_style: e.target.value },
                      })
                    }
                    data-testid="fold-select"
                  >
                    <option value="standard">Standard</option>
                    <option value="hanger">On Hanger</option>
                    <option value="box">Box Fold</option>
                  </select>
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

            <div className="pt-4 border-t border-slate-200">
              <p className="font-medium text-slate-800 mb-3">Measurements</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Shirt Size</Label>
                  <Input
                    value={formData.measurements.shirt_size}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        measurements: { ...formData.measurements, shirt_size: e.target.value },
                      })
                    }
                    placeholder="e.g., M, L"
                    data-testid="shirt-size-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pant Waist</Label>
                  <Input
                    value={formData.measurements.pant_waist}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        measurements: { ...formData.measurements, pant_waist: e.target.value },
                      })
                    }
                    placeholder="e.g., 32"
                    data-testid="pant-waist-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Pant Length</Label>
                  <Input
                    value={formData.measurements.pant_length}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        measurements: { ...formData.measurements, pant_length: e.target.value },
                      })
                    }
                    placeholder="e.g., 30"
                    data-testid="pant-length-input"
                  />
                </div>
              </div>
            </div>
          </div>
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
