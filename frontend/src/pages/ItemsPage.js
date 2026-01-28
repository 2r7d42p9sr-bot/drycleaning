import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useAuth } from "@/context/AuthContext";
import {
  Plus,
  Edit,
  Trash2,
  Package,
  DollarSign
} from "lucide-react";

export default function ItemsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [formData, setFormData] = useState({
    name: "",
    category: "",
    description: "",
    prices: {
      regular: 0,
      express: 0,
      delicate: 0,
    },
    is_active: true,
  });

  const isManager = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const [itemsRes, categoriesRes] = await Promise.all([
        api.get("/items?active_only=false"),
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

  const filteredItems = items.filter((item) => {
    return selectedCategory === "all" || item.category === selectedCategory;
  });

  const openCreateModal = () => {
    setEditingItem(null);
    setFormData({
      name: "",
      category: "",
      description: "",
      prices: {
        regular: 0,
        express: 0,
        delicate: 0,
      },
      is_active: true,
    });
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      description: item.description || "",
      prices: item.prices,
      is_active: item.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.category) {
      toast.error("Name and category are required");
      return;
    }
    if (formData.prices.regular <= 0) {
      toast.error("Regular price must be greater than 0");
      return;
    }

    try {
      if (editingItem) {
        await api.put(`/items/${editingItem.id}`, formData);
        toast.success("Item updated");
      } else {
        await api.post("/items", formData);
        toast.success("Item created");
      }
      setShowModal(false);
      fetchItems();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to save item");
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete ${item.name}?`)) return;

    try {
      await api.delete(`/items/${item.id}`);
      toast.success("Item deleted");
      fetchItems();
    } catch (error) {
      toast.error("Failed to delete item");
    }
  };

  const toggleItemActive = async (item) => {
    try {
      await api.put(`/items/${item.id}`, { is_active: !item.is_active });
      toast.success(`Item ${item.is_active ? "deactivated" : "activated"}`);
      fetchItems();
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
          <p className="text-slate-500 mt-1">Manage your service catalog and pricing</p>
        </div>
        {isManager && (
          <Button onClick={openCreateModal} className="bg-blue-500 hover:bg-blue-600" data-testid="add-item-btn">
            <Plus className="w-4 h-4 mr-2" />
            Add Service
          </Button>
        )}
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {categories.map((category) => (
          <Button
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className={`flex-shrink-0 ${selectedCategory === category ? "bg-blue-500 hover:bg-blue-600" : ""}`}
            data-testid={`filter-category-${category}`}
          >
            {category === "all" ? "All Categories" : category}
          </Button>
        ))}
      </div>

      {/* Items Table */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-center">Regular</TableHead>
                <TableHead className="text-center">Express</TableHead>
                <TableHead className="text-center">Delicate</TableHead>
                <TableHead className="text-center">Status</TableHead>
                {isManager && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length > 0 ? (
                filteredItems.map((item) => (
                  <TableRow key={item.id} data-testid={`item-row-${item.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-slate-800">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-slate-500 line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      ${item.prices.regular.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center font-medium text-amber-600">
                      ${item.prices.express.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center font-medium text-purple-600">
                      ${item.prices.delicate.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={item.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleItemActive(item)}
                            data-testid={`toggle-item-${item.id}`}
                          >
                            <Switch checked={item.is_active} className="pointer-events-none" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(item)}
                            data-testid={`edit-item-${item.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleDelete(item)}
                            data-testid={`delete-item-${item.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={isManager ? 7 : 6} className="text-center py-8 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No items found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              {editingItem ? "Edit Service" : "New Service"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-name">Name *</Label>
                <Input
                  id="item-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Shirt"
                  data-testid="item-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="item-category">Category *</Label>
                <Input
                  id="item-category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Tops"
                  data-testid="item-category-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description</Label>
              <Input
                id="item-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description"
                data-testid="item-description-input"
              />
            </div>

            <div className="pt-4 border-t border-slate-200">
              <p className="font-medium text-slate-800 mb-3">Pricing</p>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Regular</Label>
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

            <div className="flex items-center justify-between pt-4 border-t border-slate-200">
              <Label htmlFor="item-active">Active</Label>
              <Switch
                id="item-active"
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
