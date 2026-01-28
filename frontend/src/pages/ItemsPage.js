import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  DollarSign,
  ChevronRight,
  Percent,
  FolderTree
} from "lucide-react";

export default function ItemsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    description: "",
    parent_id: "",
    prices: {
      regular: 0,
      express: 0,
      delicate: 0,
    },
    volume_discounts: [],
    is_active: true,
  });

  const [newDiscount, setNewDiscount] = useState({ min_quantity: 0, discount_percent: 0 });

  const isManager = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsRes, allItemsRes, categoriesRes] = await Promise.all([
        api.get("/items?include_children=true&active_only=false"),
        api.get("/items/all?active_only=false"),
        api.get("/categories"),
      ]);
      setItems(itemsRes.data);
      setAllItems(allItemsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      toast.error("Failed to load items");
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    return selectedCategory === "all" || item.category_id === selectedCategory;
  });

  // Get parent items for dropdown (items without a parent)
  const parentItems = allItems.filter(item => !item.parent_id);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category_id: categories[0]?.id || "",
      description: "",
      parent_id: "",
      prices: {
        regular: 0,
        express: 0,
        delicate: 0,
      },
      volume_discounts: [],
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category_id: item.category_id,
      description: item.description || "",
      parent_id: item.parent_id || "",
      prices: item.prices,
      volume_discounts: item.volume_discounts || [],
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const addVolumeDiscount = () => {
    if (newDiscount.min_quantity <= 0 || newDiscount.discount_percent <= 0) {
      toast.error("Please enter valid quantity and discount");
      return;
    }
    setFormData({
      ...formData,
      volume_discounts: [...formData.volume_discounts, { ...newDiscount }],
    });
    setNewDiscount({ min_quantity: 0, discount_percent: 0 });
  };

  const removeVolumeDiscount = (index) => {
    setFormData({
      ...formData,
      volume_discounts: formData.volume_discounts.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category_id) {
      toast.error("Name and category are required");
      return;
    }
    if (formData.prices.regular <= 0) {
      toast.error("Regular price must be greater than 0");
      return;
    }

    try {
      const payload = {
        ...formData,
        parent_id: formData.parent_id || null,
      };

      if (editingItem) {
        await api.put(`/items/${editingItem.id}`, payload);
        toast.success("Item updated");
      } else {
        await api.post("/items", payload);
        toast.success("Item created");
      }
      setShowModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save item");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;

    try {
      await api.delete(`/items/${item.id}`);
      toast.success("Item deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete item");
    }
  };

  const toggleItemActive = async (item) => {
    try {
      await api.put(`/items/${item.id}`, { is_active: !item.is_active });
      toast.success(`Item ${item.is_active ? "deactivated" : "activated"}`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update item");
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
    <div className="p-6 space-y-6" data-testid="items-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Services & Items
          </h1>
          <p className="text-slate-500 mt-1">Manage your service catalog with categories and pricing</p>
        </div>
        {isManager && (
          <Button onClick={openCreateModal} className="bg-blue-500 hover:bg-blue-600" data-testid="add-item-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-4 items-center">
        <Label className="text-slate-600">Filter by Category:</Label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-[250px]" data-testid="category-filter">
            <SelectValue placeholder="Select category" />
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

      {/* Items List with Parent-Child */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <Accordion type="multiple" className="w-full">
            {filteredItems.map((item) => (
              <AccordionItem key={item.id} value={item.id}>
                <div className="flex items-center px-4 py-3 border-b border-slate-100 hover:bg-slate-50">
                  {item.children?.length > 0 ? (
                    <AccordionTrigger className="flex-1 hover:no-underline p-0">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2">
                            <FolderTree className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-800">{item.name}</span>
                            <Badge variant="outline" className="text-xs">{item.children.length} variants</Badge>
                          </div>
                          <p className="text-sm text-slate-500">{item.category_name}</p>
                        </div>
                        <div className="flex gap-6 text-sm">
                          <div className="text-center">
                            <p className="text-slate-500">Regular</p>
                            <p className="font-medium">${item.prices.regular.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-amber-600">Express</p>
                            <p className="font-medium">${item.prices.express.toFixed(2)}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-purple-600">Delicate</p>
                            <p className="font-medium">${item.prices.delicate.toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                  ) : (
                    <div className="flex items-center gap-4 flex-1 py-2">
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{item.name}</span>
                          {item.volume_discounts?.length > 0 && (
                            <Badge className="bg-green-100 text-green-800 text-xs">
                              <Percent className="w-3 h-3 mr-1" />
                              Volume Discount
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{item.category_name}</p>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <p className="text-slate-500">Regular</p>
                          <p className="font-medium">${item.prices.regular.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-amber-600">Express</p>
                          <p className="font-medium">${item.prices.express.toFixed(2)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-purple-600">Delicate</p>
                          <p className="font-medium">${item.prices.delicate.toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-2 ml-4">
                    <Badge className={item.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}>
                      {item.is_active ? "Active" : "Inactive"}
                    </Badge>
                    {isManager && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => toggleItemActive(item)}>
                          <Switch checked={item.is_active} className="pointer-events-none" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEditModal(item)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(item)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Child Items */}
                {item.children?.length > 0 && (
                  <AccordionContent className="p-0">
                    <div className="bg-slate-50">
                      {item.children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center px-4 py-3 border-b border-slate-100 pl-12"
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-700">{child.name}</span>
                                {child.volume_discounts?.length > 0 && (
                                  <Badge className="bg-green-100 text-green-800 text-xs">
                                    <Percent className="w-3 h-3 mr-1" />
                                    Discount
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-500">{child.description}</p>
                            </div>
                            <div className="flex gap-6 text-sm">
                              <div className="text-center">
                                <p className="font-medium">${child.prices.regular.toFixed(2)}</p>
                              </div>
                              <div className="text-center">
                                <p className="font-medium text-amber-600">${child.prices.express.toFixed(2)}</p>
                              </div>
                              <div className="text-center">
                                <p className="font-medium text-purple-600">${child.prices.delicate.toFixed(2)}</p>
                              </div>
                            </div>
                          </div>
                          {isManager && (
                            <div className="flex items-center gap-2 ml-4">
                              <Button variant="ghost" size="icon" onClick={() => openEditModal(child)}>
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-600"
                                onClick={() => handleDelete(child)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                )}
              </AccordionItem>
            ))}
          </Accordion>

          {filteredItems.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No items found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              {editingItem ? "Edit Service" : "New Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., 2 Piece Suit"
                  data-testid="item-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                >
                  <SelectTrigger data-testid="item-category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Parent Item (optional)</Label>
              <Select
                value={formData.parent_id || "none"}
                onValueChange={(value) => setFormData({ ...formData, parent_id: value === "none" ? "" : value })}
              >
                <SelectTrigger data-testid="item-parent-select">
                  <SelectValue placeholder="None (standalone item)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (standalone item)</SelectItem>
                  {parentItems
                    .filter(p => p.id !== editingItem?.id)
                    .map((parent) => (
                      <SelectItem key={parent.id} value={parent.id}>
                        {parent.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Child items appear under the parent (e.g., "2 Piece Suit" under "Men's Suit")
              </p>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
                data-testid="item-description-input"
              />
            </div>

            <div className="pt-4 border-t border-slate-200">
              <Label className="text-base font-semibold">Pricing</Label>
              <div className="grid grid-cols-3 gap-4 mt-3">
                <div className="space-y-2">
                  <Label className="text-slate-600">Regular</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.prices.regular}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          prices: { ...formData.prices, regular: parseFloat(e.target.value) || 0 },
                        })
                      }
                      className="pl-8"
                      data-testid="price-regular-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-amber-600">Express</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.prices.express}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          prices: { ...formData.prices, express: parseFloat(e.target.value) || 0 },
                        })
                      }
                      className="pl-8"
                      data-testid="price-express-input"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-purple-600">Delicate</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.prices.delicate}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          prices: { ...formData.prices, delicate: parseFloat(e.target.value) || 0 },
                        })
                      }
                      className="pl-8"
                      data-testid="price-delicate-input"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Volume Discounts */}
            <div className="pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">Volume Discounts</Label>
              </div>
              <p className="text-sm text-slate-500 mb-3">
                Offer discounts when customers bring multiple items (e.g., 3 coats = 10% off)
              </p>

              {formData.volume_discounts.length > 0 && (
                <div className="space-y-2 mb-4">
                  {formData.volume_discounts
                    .sort((a, b) => a.min_quantity - b.min_quantity)
                    .map((discount, index) => (
                      <div key={index} className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <Percent className="w-4 h-4 text-green-600" />
                          <span className="text-green-800">
                            {discount.min_quantity}+ items = <strong>{discount.discount_percent}% off</strong>
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeVolumeDiscount(index)}
                          className="h-8 w-8 text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              )}

              <div className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-slate-500">Min Quantity</Label>
                  <Input
                    type="number"
                    min="2"
                    value={newDiscount.min_quantity || ""}
                    onChange={(e) => setNewDiscount({ ...newDiscount, min_quantity: parseInt(e.target.value) || 0 })}
                    placeholder="e.g., 3"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs text-slate-500">Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={newDiscount.discount_percent || ""}
                    onChange={(e) => setNewDiscount({ ...newDiscount, discount_percent: parseFloat(e.target.value) || 0 })}
                    placeholder="e.g., 10"
                  />
                </div>
                <Button variant="outline" onClick={addVolumeDiscount}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Label>Active</Label>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                data-testid="item-active-switch"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} data-testid="save-item-btn">
              {editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
