import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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
import { ThermalPrinter, CashDrawer, isWebUSBSupported } from "@/lib/printer";
import {
  Printer,
  Receipt,
  Tag,
  DollarSign,
  Usb,
  Check,
  X,
  AlertCircle,
  Globe,
  Calculator,
  FolderTree,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Building
} from "lucide-react";

// Country configurations
const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", symbol: "$", taxName: "Sales Tax", dateFormat: "MM/DD/YYYY" },
  { code: "GB", name: "United Kingdom", currency: "GBP", symbol: "£", taxName: "VAT", dateFormat: "DD/MM/YYYY" },
  { code: "EU", name: "European Union", currency: "EUR", symbol: "€", taxName: "VAT", dateFormat: "DD/MM/YYYY" },
  { code: "CA", name: "Canada", currency: "CAD", symbol: "$", taxName: "GST/HST", dateFormat: "DD/MM/YYYY" },
  { code: "AU", name: "Australia", currency: "AUD", symbol: "$", taxName: "GST", dateFormat: "DD/MM/YYYY" },
  { code: "NZ", name: "New Zealand", currency: "NZD", symbol: "$", taxName: "GST", dateFormat: "DD/MM/YYYY" },
  { code: "IN", name: "India", currency: "INR", symbol: "₹", taxName: "GST", dateFormat: "DD/MM/YYYY" },
  { code: "AE", name: "UAE", currency: "AED", symbol: "د.إ", taxName: "VAT", dateFormat: "DD/MM/YYYY" },
  { code: "SG", name: "Singapore", currency: "SGD", symbol: "$", taxName: "GST", dateFormat: "DD/MM/YYYY" },
  { code: "ZA", name: "South Africa", currency: "ZAR", symbol: "R", taxName: "VAT", dateFormat: "DD/MM/YYYY" },
];

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", sort_order: 0 });
  
  // Tax modal
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [additionalTax, setAdditionalTax] = useState({ name: "", rate: 0 });
  
  // Printer states
  const [receiptPrinter, setReceiptPrinter] = useState(null);
  const [labelPrinter, setLabelPrinter] = useState(null);
  const [connecting, setConnecting] = useState({ receipt: false, label: false });

  const webUSBSupported = isWebUSBSupported();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [settingsRes, categoriesRes] = await Promise.all([
        api.get("/settings"),
        api.get("/categories?active_only=false"),
      ]);
      setSettings(settingsRes.data.settings);
      setCategories(categoriesRes.data);
    } catch (error) {
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleCountryChange = async (countryCode) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    if (!country) return;

    const updatedCountry = {
      country_code: country.code,
      country_name: country.name,
      currency_code: country.currency,
      currency_symbol: country.symbol,
      date_format: country.dateFormat,
    };

    const updatedTax = {
      ...settings.tax,
      tax_name: country.taxName,
    };

    try {
      await api.put("/settings/country", updatedCountry);
      await api.put("/settings/tax", updatedTax);
      setSettings({
        ...settings,
        country: updatedCountry,
        tax: updatedTax,
      });
      toast.success(`Country changed to ${country.name}`);
    } catch (error) {
      toast.error("Failed to update country settings");
    }
  };

  const handleTaxUpdate = async () => {
    setSaving(true);
    try {
      await api.put("/settings/tax", settings.tax);
      toast.success("Tax settings updated");
    } catch (error) {
      toast.error("Failed to update tax settings");
    } finally {
      setSaving(false);
    }
  };

  const addAdditionalTax = () => {
    if (!additionalTax.name || additionalTax.rate <= 0) {
      toast.error("Please enter tax name and rate");
      return;
    }
    
    const updatedTaxes = [...(settings.tax.additional_taxes || []), additionalTax];
    setSettings({
      ...settings,
      tax: { ...settings.tax, additional_taxes: updatedTaxes }
    });
    setAdditionalTax({ name: "", rate: 0 });
    setShowTaxModal(false);
  };

  const removeAdditionalTax = (index) => {
    const updatedTaxes = settings.tax.additional_taxes.filter((_, i) => i !== index);
    setSettings({
      ...settings,
      tax: { ...settings.tax, additional_taxes: updatedTaxes }
    });
  };

  const handleBusinessUpdate = async () => {
    setSaving(true);
    try {
      await api.put("/settings", settings);
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Category management
  const openCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({
        name: category.name,
        description: category.description || "",
        sort_order: category.sort_order,
      });
    } else {
      setEditingCategory(null);
      setCategoryForm({ name: "", description: "", sort_order: categories.length + 1 });
    }
    setShowCategoryModal(true);
  };

  const handleCategorySave = async () => {
    if (!categoryForm.name) {
      toast.error("Category name is required");
      return;
    }

    try {
      if (editingCategory) {
        await api.put(`/categories/${editingCategory.id}`, categoryForm);
        toast.success("Category updated");
      } else {
        await api.post("/categories", categoryForm);
        toast.success("Category created");
      }
      setShowCategoryModal(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to save category");
    }
  };

  const handleCategoryDelete = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? This cannot be undone.`)) return;

    try {
      await api.delete(`/categories/${category.id}`);
      toast.success("Category deleted");
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to delete category");
    }
  };

  const moveCategoryOrder = async (category, direction) => {
    const currentIndex = categories.findIndex(c => c.id === category.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    
    if (targetIndex < 0 || targetIndex >= categories.length) return;

    const newCategories = [...categories];
    const targetCategory = newCategories[targetIndex];
    
    // Swap sort orders
    const tempOrder = category.sort_order;
    newCategories[currentIndex].sort_order = targetCategory.sort_order;
    newCategories[targetIndex].sort_order = tempOrder;

    try {
      await api.put("/categories/reorder", [
        { id: category.id, sort_order: targetCategory.sort_order },
        { id: targetCategory.id, sort_order: tempOrder },
      ]);
      fetchData();
    } catch (error) {
      toast.error("Failed to reorder categories");
    }
  };

  // Printer functions
  const connectReceiptPrinter = async () => {
    if (!webUSBSupported) {
      toast.error("WebUSB is not supported in this browser");
      return;
    }
    setConnecting({ ...connecting, receipt: true });
    try {
      const printer = new ThermalPrinter();
      await printer.connect();
      setReceiptPrinter(printer);
      toast.success("Receipt printer connected");
    } catch (error) {
      toast.error("Failed to connect receipt printer");
    } finally {
      setConnecting({ ...connecting, receipt: false });
    }
  };

  const connectLabelPrinter = async () => {
    if (!webUSBSupported) {
      toast.error("WebUSB is not supported in this browser");
      return;
    }
    setConnecting({ ...connecting, label: true });
    try {
      const printer = new ThermalPrinter();
      await printer.connect();
      setLabelPrinter(printer);
      toast.success("Label printer connected");
    } catch (error) {
      toast.error("Failed to connect label printer");
    } finally {
      setConnecting({ ...connecting, label: false });
    }
  };

  const openCashDrawer = async () => {
    if (!receiptPrinter) {
      toast.error("Connect receipt printer first");
      return;
    }
    try {
      const drawer = new CashDrawer(receiptPrinter);
      await drawer.open();
      toast.success("Cash drawer opened");
    } catch (error) {
      toast.error("Failed to open cash drawer");
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
    <div className="p-6 space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Configure your POS system</p>
      </div>

      <Tabs defaultValue="business" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="business" data-testid="tab-business">
            <Building className="w-4 h-4 mr-2" />
            Business
          </TabsTrigger>
          <TabsTrigger value="country" data-testid="tab-country">
            <Globe className="w-4 h-4 mr-2" />
            Country
          </TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax">
            <Calculator className="w-4 h-4 mr-2" />
            Tax
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            <FolderTree className="w-4 h-4 mr-2" />
            Categories
          </TabsTrigger>
          <TabsTrigger value="hardware" data-testid="tab-hardware">
            <Printer className="w-4 h-4 mr-2" />
            Hardware
          </TabsTrigger>
        </TabsList>

        {/* Business Tab */}
        <TabsContent value="business" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Business Information
              </CardTitle>
              <CardDescription>Details shown on receipts and labels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Business Name</Label>
                  <Input
                    value={settings?.business_name || ""}
                    onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
                    data-testid="business-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={settings?.phone || ""}
                    onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                    data-testid="business-phone-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={settings?.address || ""}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  data-testid="business-address-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={settings?.email || ""}
                  onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                  data-testid="business-email-input"
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <p className="font-medium text-slate-800">Automation</p>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-print receipts</Label>
                    <p className="text-sm text-slate-500">Print receipt after each sale</p>
                  </div>
                  <Switch
                    checked={settings?.auto_print_receipt}
                    onCheckedChange={(checked) => setSettings({ ...settings, auto_print_receipt: checked })}
                    data-testid="auto-receipt-switch"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-print labels</Label>
                    <p className="text-sm text-slate-500">Print garment labels after order</p>
                  </div>
                  <Switch
                    checked={settings?.auto_print_labels}
                    onCheckedChange={(checked) => setSettings({ ...settings, auto_print_labels: checked })}
                    data-testid="auto-labels-switch"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Open drawer on payment</Label>
                    <p className="text-sm text-slate-500">Open cash drawer for cash payments</p>
                  </div>
                  <Switch
                    checked={settings?.open_drawer_on_payment}
                    onCheckedChange={(checked) => setSettings({ ...settings, open_drawer_on_payment: checked })}
                    data-testid="auto-drawer-switch"
                  />
                </div>
              </div>

              <Button onClick={handleBusinessUpdate} disabled={saving} data-testid="save-business-btn">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Country Tab */}
        <TabsContent value="country" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Country & Currency
              </CardTitle>
              <CardDescription>Regional settings for your business</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Country</Label>
                <Select
                  value={settings?.country?.country_code || "US"}
                  onValueChange={handleCountryChange}
                >
                  <SelectTrigger data-testid="country-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRIES.map((country) => (
                      <SelectItem key={country.code} value={country.code}>
                        {country.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <Label className="text-slate-500">Currency</Label>
                  <p className="text-lg font-bold text-slate-800">
                    {settings?.country?.currency_symbol} {settings?.country?.currency_code}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <Label className="text-slate-500">Date Format</Label>
                  <p className="text-lg font-bold text-slate-800">
                    {settings?.country?.date_format}
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  Changing country will update currency, date format, and tax name to match regional standards.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tax Tab */}
        <TabsContent value="tax" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Tax Settings
              </CardTitle>
              <CardDescription>Configure VAT, GST, or sales tax</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tax Name</Label>
                  <Input
                    value={settings?.tax?.tax_name || ""}
                    onChange={(e) => setSettings({
                      ...settings,
                      tax: { ...settings.tax, tax_name: e.target.value }
                    })}
                    data-testid="tax-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={settings?.tax?.tax_rate || 0}
                    onChange={(e) => setSettings({
                      ...settings,
                      tax: { ...settings.tax, tax_rate: parseFloat(e.target.value) || 0 }
                    })}
                    data-testid="tax-rate-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Tax Registration Number</Label>
                <Input
                  value={settings?.tax?.tax_number || ""}
                  onChange={(e) => setSettings({
                    ...settings,
                    tax: { ...settings.tax, tax_number: e.target.value }
                  })}
                  placeholder="e.g., VAT123456789"
                  data-testid="tax-number-input"
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Tax Inclusive Pricing</Label>
                  <p className="text-sm text-slate-500">Prices already include tax</p>
                </div>
                <Switch
                  checked={settings?.tax?.is_inclusive}
                  onCheckedChange={(checked) => setSettings({
                    ...settings,
                    tax: { ...settings.tax, is_inclusive: checked }
                  })}
                  data-testid="tax-inclusive-switch"
                />
              </div>

              <Separator />

              {/* Additional Taxes */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Additional Taxes</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTaxModal(true)}
                    data-testid="add-tax-btn"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Tax
                  </Button>
                </div>
                
                {settings?.tax?.additional_taxes?.length > 0 ? (
                  <div className="space-y-2">
                    {settings.tax.additional_taxes.map((tax, index) => (
                      <div key={index} className="flex items-center justify-between bg-slate-50 rounded-lg p-3">
                        <div>
                          <p className="font-medium text-slate-800">{tax.name}</p>
                          <p className="text-sm text-slate-500">{tax.rate}%</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAdditionalTax(index)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No additional taxes configured</p>
                )}
              </div>

              <Button onClick={handleTaxUpdate} disabled={saving} data-testid="save-tax-btn">
                {saving ? "Saving..." : "Save Tax Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Service Categories
                </CardTitle>
                <CardDescription>Manage and organize your service categories</CardDescription>
              </div>
              <Button onClick={() => openCategoryModal()} data-testid="add-category-btn">
                <Plus className="w-4 h-4 mr-2" />
                Add Category
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((category, index) => (
                    <TableRow key={category.id} data-testid={`category-row-${category.id}`}>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === 0}
                            onClick={() => moveCategoryOrder(category, "up")}
                          >
                            <ArrowUp className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            disabled={index === categories.length - 1}
                            onClick={() => moveCategoryOrder(category, "down")}
                          >
                            <ArrowDown className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{category.name}</TableCell>
                      <TableCell className="text-slate-500">{category.description || "-"}</TableCell>
                      <TableCell className="text-center">
                        <Badge className={category.is_active ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-800"}>
                          {category.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openCategoryModal(category)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-600"
                            onClick={() => handleCategoryDelete(category)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {categories.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                        No categories yet. Create your first category.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hardware Tab */}
        <TabsContent value="hardware" className="space-y-6">
          {!webUSBSupported && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">WebUSB Not Supported</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Your browser doesn't support WebUSB. Use Chrome or Edge for direct printer connection.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Receipt Printer */}
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Receipt className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Receipt Printer</CardTitle>
                      <CardDescription>Thermal receipt printer</CardDescription>
                    </div>
                  </div>
                  {receiptPrinter ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm">Not connected</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!receiptPrinter ? (
                  <Button
                    onClick={connectReceiptPrinter}
                    disabled={!webUSBSupported || connecting.receipt}
                    className="w-full"
                    data-testid="connect-receipt-printer"
                  >
                    <Usb className="w-4 h-4 mr-2" />
                    {connecting.receipt ? "Connecting..." : "Connect Printer"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">Test Print</Button>
                    <Button variant="outline" className="text-red-500">Disconnect</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Label Printer */}
            <Card className="border-slate-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Tag className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Label Printer</CardTitle>
                      <CardDescription>Garment tag printer</CardDescription>
                    </div>
                  </div>
                  {labelPrinter ? (
                    <div className="flex items-center gap-2 text-green-600">
                      <Check className="w-4 h-4" />
                      <span className="text-sm font-medium">Connected</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-slate-400">
                      <X className="w-4 h-4" />
                      <span className="text-sm">Not connected</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!labelPrinter ? (
                  <Button
                    onClick={connectLabelPrinter}
                    disabled={!webUSBSupported || connecting.label}
                    className="w-full"
                    data-testid="connect-label-printer"
                  >
                    <Usb className="w-4 h-4 mr-2" />
                    {connecting.label ? "Connecting..." : "Connect Printer"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1">Test Print</Button>
                    <Button variant="outline" className="text-red-500">Disconnect</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Cash Drawer */}
            <Card className="border-slate-200 lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Cash Drawer</CardTitle>
                    <CardDescription>Connected via receipt printer</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  onClick={openCashDrawer}
                  disabled={!receiptPrinter}
                  data-testid="open-cash-drawer"
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Open Cash Drawer
                </Button>
                <p className="text-xs text-slate-500 mt-2">
                  Cash drawer opens via receipt printer's kick connector
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Category Modal */}
      <Dialog open={showCategoryModal} onOpenChange={setShowCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              {editingCategory ? "Edit Category" : "New Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Men's Suits"
                data-testid="category-name-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Optional description"
                data-testid="category-description-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCategoryModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleCategorySave} data-testid="save-category-btn">
              {editingCategory ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Additional Tax Modal */}
      <Dialog open={showTaxModal} onOpenChange={setShowTaxModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>Add Additional Tax</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tax Name</Label>
              <Input
                value={additionalTax.name}
                onChange={(e) => setAdditionalTax({ ...additionalTax, name: e.target.value })}
                placeholder="e.g., Local Tax, Service Tax"
              />
            </div>
            <div className="space-y-2">
              <Label>Rate (%)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={additionalTax.rate}
                onChange={(e) => setAdditionalTax({ ...additionalTax, rate: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaxModal(false)}>
              Cancel
            </Button>
            <Button onClick={addAdditionalTax}>Add Tax</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
