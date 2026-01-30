import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowUp,
  ArrowDown,
  Building,
  Upload,
  Bell,
  Gift,
  Instagram,
  Facebook,
  Clock,
  Mail,
  Image
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

const DAYS_OF_WEEK = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

const DEFAULT_OPENING_HOURS = DAYS_OF_WEEK.map(day => ({
  day: day.key,
  is_open: day.key !== "sunday",
  open_time: "09:00",
  close_time: "18:00"
}));

const NOTIFICATION_EVENTS = [
  { event: "order_created", label: "Order Created", description: "When a new order is placed" },
  { event: "order_cleaning", label: "Order Cleaning", description: "When order starts cleaning" },
  { event: "order_ready", label: "Order Ready", description: "When order is ready for pickup" },
  { event: "order_out_for_delivery", label: "Out for Delivery", description: "When order is out for delivery" },
  { event: "order_delivered", label: "Order Delivered", description: "When order has been delivered" },
  { event: "order_collected", label: "Order Collected", description: "When order has been collected" },
  { event: "invoice_created", label: "Invoice Created", description: "When invoice is generated" },
  { event: "invoice_overdue", label: "Invoice Overdue", description: "When invoice becomes overdue" },
];

// TikTok icon component
const TikTokIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loyaltySettings, setLoyaltySettings] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState(null);
  
  // File upload
  const fileInputRef = useRef(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  
  // Category modal
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "", sort_order: 0 });
  
  // Tax modal
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [additionalTax, setAdditionalTax] = useState({ name: "", rate: 0 });
  
  // Template edit modal
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  
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
      const [settingsRes, categoriesRes, loyaltyRes, notificationsRes] = await Promise.all([
        api.get("/settings"),
        api.get("/categories?active_only=false"),
        api.get("/settings/loyalty"),
        api.get("/settings/notifications"),
      ]);
      setSettings(settingsRes.data.settings);
      setCategories(categoriesRes.data);
      setLoyaltySettings(loyaltyRes.data.settings);
      setNotificationSettings(notificationsRes.data.notification_settings);
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

  // Logo upload
  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File size exceeds 2MB limit");
      return;
    }

    setUploadingLogo(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/settings/company-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setSettings({
        ...settings,
        company_profile: {
          ...settings.company_profile,
          logo_url: res.data.logo_url
        }
      });
      toast.success("Logo uploaded successfully");
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  // Company profile update
  const handleCompanyProfileUpdate = async () => {
    setSaving(true);
    try {
      await api.put("/settings/company-profile", settings.company_profile || {});
      toast.success("Company profile updated");
    } catch (error) {
      toast.error("Failed to update company profile");
    } finally {
      setSaving(false);
    }
  };

  // Opening hours update
  const updateOpeningHours = (dayKey, field, value) => {
    const currentHours = settings.company_profile?.opening_hours || DEFAULT_OPENING_HOURS;
    const updatedHours = currentHours.map(h => 
      h.day === dayKey ? { ...h, [field]: value } : h
    );
    setSettings({
      ...settings,
      company_profile: {
        ...settings.company_profile,
        opening_hours: updatedHours
      }
    });
  };

  // Social media update
  const updateSocialMedia = (platform, value) => {
    setSettings({
      ...settings,
      company_profile: {
        ...settings.company_profile,
        social_media: {
          ...settings.company_profile?.social_media,
          [platform]: value
        }
      }
    });
  };

  // Loyalty settings update
  const handleLoyaltyUpdate = async () => {
    setSaving(true);
    try {
      await api.put("/settings/loyalty", loyaltySettings);
      toast.success("Loyalty settings updated");
    } catch (error) {
      toast.error("Failed to update loyalty settings");
    } finally {
      setSaving(false);
    }
  };

  // Notification settings update
  const handleNotificationUpdate = async () => {
    setSaving(true);
    try {
      await api.put("/settings/notifications", notificationSettings);
      toast.success("Notification settings updated");
    } catch (error) {
      toast.error("Failed to update notification settings");
    } finally {
      setSaving(false);
    }
  };

  // Update email provider
  const updateEmailProvider = (field, value) => {
    setNotificationSettings({
      ...notificationSettings,
      email_provider: {
        ...notificationSettings?.email_provider,
        [field]: value
      }
    });
  };

  // Toggle notification
  const toggleNotification = (event, field, value) => {
    const templates = notificationSettings?.templates || [];
    const updatedTemplates = templates.map(t => 
      t.event === event ? { ...t, [field]: value } : t
    );
    setNotificationSettings({
      ...notificationSettings,
      templates: updatedTemplates
    });
  };

  // Edit template
  const openTemplateEditor = (template) => {
    setEditingTemplate({ ...template });
    setShowTemplateModal(true);
  };

  const saveTemplate = async () => {
    if (!editingTemplate) return;
    
    try {
      await api.put(`/settings/notifications/template/${editingTemplate.event}`, editingTemplate);
      const templates = notificationSettings?.templates || [];
      const updatedTemplates = templates.map(t => 
        t.event === editingTemplate.event ? editingTemplate : t
      );
      setNotificationSettings({
        ...notificationSettings,
        templates: updatedTemplates
      });
      setShowTemplateModal(false);
      toast.success("Template updated");
    } catch (error) {
      toast.error("Failed to update template");
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

  const openingHours = settings?.company_profile?.opening_hours || DEFAULT_OPENING_HOURS;
  const backendUrl = process.env.REACT_APP_BACKEND_URL || "";

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
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="business" data-testid="tab-business">
            <Building className="w-4 h-4 mr-2" />
            Business
          </TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile">
            <Image className="w-4 h-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="country" data-testid="tab-country">
            <Globe className="w-4 h-4 mr-2" />
            Country
          </TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax">
            <Calculator className="w-4 h-4 mr-2" />
            Tax
          </TabsTrigger>
          <TabsTrigger value="notifications" data-testid="tab-notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="loyalty" data-testid="tab-loyalty">
            <Gift className="w-4 h-4 mr-2" />
            Loyalty
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

        {/* Company Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* Logo Section */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Company Logo
              </CardTitle>
              <CardDescription>Upload your company logo (max 2MB)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-6">
                <div className="w-32 h-32 border-2 border-dashed border-slate-300 rounded-lg flex items-center justify-center overflow-hidden bg-slate-50">
                  {settings?.company_profile?.logo_url ? (
                    <img 
                      src={`${backendUrl}${settings.company_profile.logo_url}`}
                      alt="Company Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Image className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="space-y-3">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleLogoUpload}
                    accept="image/jpeg,image/png,image/gif,image/webp"
                    className="hidden"
                  />
                  <Button 
                    variant="outline" 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingLogo ? "Uploading..." : "Upload Logo"}
                  </Button>
                  <p className="text-sm text-slate-500">Supported: JPEG, PNG, GIF, WebP</p>
                  
                  <div className="flex items-center gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings?.company_profile?.logo_on_receipts}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          company_profile: { ...settings.company_profile, logo_on_receipts: checked }
                        })}
                      />
                      <Label className="text-sm">Show on receipts</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings?.company_profile?.logo_on_labels}
                        onCheckedChange={(checked) => setSettings({
                          ...settings,
                          company_profile: { ...settings.company_profile, logo_on_labels: checked }
                        })}
                      />
                      <Label className="text-sm">Show on labels</Label>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Social Media Links
              </CardTitle>
              <CardDescription>Connect your social media accounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Facebook className="w-4 h-4 text-blue-600" />
                    Facebook
                  </Label>
                  <Input
                    placeholder="https://facebook.com/yourbusiness"
                    value={settings?.company_profile?.social_media?.facebook || ""}
                    onChange={(e) => updateSocialMedia("facebook", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Instagram className="w-4 h-4 text-pink-600" />
                    Instagram
                  </Label>
                  <Input
                    placeholder="https://instagram.com/yourbusiness"
                    value={settings?.company_profile?.social_media?.instagram || ""}
                    onChange={(e) => updateSocialMedia("instagram", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <TikTokIcon />
                    TikTok
                  </Label>
                  <Input
                    placeholder="https://tiktok.com/@yourbusiness"
                    value={settings?.company_profile?.social_media?.tiktok || ""}
                    onChange={(e) => updateSocialMedia("tiktok", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-600" />
                    Website
                  </Label>
                  <Input
                    placeholder="https://yourbusiness.com"
                    value={settings?.company_profile?.social_media?.website || ""}
                    onChange={(e) => updateSocialMedia("website", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Opening Hours */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Clock className="w-5 h-5" />
                Opening Hours
              </CardTitle>
              <CardDescription>Set your business operating hours</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {DAYS_OF_WEEK.map((day) => {
                  const hours = openingHours.find(h => h.day === day.key) || { is_open: true, open_time: "09:00", close_time: "18:00" };
                  return (
                    <div key={day.key} className="flex items-center gap-4 py-2 border-b border-slate-100 last:border-0">
                      <div className="w-28">
                        <span className="font-medium text-slate-700">{day.label}</span>
                      </div>
                      <Switch
                        checked={hours.is_open}
                        onCheckedChange={(checked) => updateOpeningHours(day.key, "is_open", checked)}
                      />
                      {hours.is_open ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="time"
                            className="w-32"
                            value={hours.open_time}
                            onChange={(e) => updateOpeningHours(day.key, "open_time", e.target.value)}
                          />
                          <span className="text-slate-500">to</span>
                          <Input
                            type="time"
                            className="w-32"
                            value={hours.close_time}
                            onChange={(e) => updateOpeningHours(day.key, "close_time", e.target.value)}
                          />
                        </div>
                      ) : (
                        <span className="text-slate-500">Closed</span>
                      )}
                    </div>
                  );
                })}
              </div>
              <Button onClick={handleCompanyProfileUpdate} disabled={saving} className="mt-4">
                {saving ? "Saving..." : "Save Profile Changes"}
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

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          {/* Email Provider */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Mail className="w-5 h-5" />
                Email Provider Configuration
              </CardTitle>
              <CardDescription>Configure your email service provider (optional - can be set up later)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email Provider</Label>
                  <Select
                    value={notificationSettings?.email_provider?.provider || "none"}
                    onValueChange={(value) => updateEmailProvider("provider", value === "none" ? null : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Not Configured</SelectItem>
                      <SelectItem value="sendgrid">SendGrid</SelectItem>
                      <SelectItem value="ses">AWS SES</SelectItem>
                      <SelectItem value="smtp">Custom SMTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    placeholder="Enter API key when ready"
                    value={notificationSettings?.email_provider?.api_key || ""}
                    onChange={(e) => updateEmailProvider("api_key", e.target.value)}
                    disabled={!notificationSettings?.email_provider?.provider}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From Email</Label>
                  <Input
                    type="email"
                    placeholder="noreply@yourbusiness.com"
                    value={notificationSettings?.email_provider?.from_email || ""}
                    onChange={(e) => updateEmailProvider("from_email", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Name</Label>
                  <Input
                    placeholder="Your Business Name"
                    value={notificationSettings?.email_provider?.from_name || ""}
                    onChange={(e) => updateEmailProvider("from_name", e.target.value)}
                  />
                </div>
              </div>
              {!notificationSettings?.email_provider?.provider && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm text-amber-800">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    Email provider not configured. Notifications will not be sent until you set up a provider.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Notification Templates */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Notification Templates
              </CardTitle>
              <CardDescription>Configure which notifications to send and customize their content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {NOTIFICATION_EVENTS.map((event) => {
                  const template = notificationSettings?.templates?.find(t => t.event === event.event) || {
                    event: event.event,
                    enabled: false,
                    subject: "",
                    body: ""
                  };
                  return (
                    <div key={event.event} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <Switch
                          checked={template.enabled}
                          onCheckedChange={(checked) => toggleNotification(event.event, "enabled", checked)}
                        />
                        <div>
                          <p className="font-medium text-slate-800">{event.label}</p>
                          <p className="text-sm text-slate-500">{event.description}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTemplateEditor(template)}
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit Template
                      </Button>
                    </div>
                  );
                })}
              </div>
              <Button onClick={handleNotificationUpdate} disabled={saving} className="mt-4">
                {saving ? "Saving..." : "Save Notification Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Loyalty Tab */}
        <TabsContent value="loyalty" className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2" style={{ fontFamily: 'Manrope, sans-serif' }}>
                <Gift className="w-5 h-5" />
                Loyalty Program Settings
              </CardTitle>
              <CardDescription>Configure your customer loyalty rewards program</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Loyalty Program</Label>
                  <p className="text-sm text-slate-500">Allow customers to earn and redeem points</p>
                </div>
                <Switch
                  checked={loyaltySettings?.enabled}
                  onCheckedChange={(checked) => setLoyaltySettings({ ...loyaltySettings, enabled: checked })}
                />
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Points Per Dollar Spent</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.1"
                    value={loyaltySettings?.points_per_dollar || 1}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, points_per_dollar: parseFloat(e.target.value) || 1 })}
                  />
                  <p className="text-xs text-slate-500">How many points customers earn per $1 spent</p>
                </div>
                <div className="space-y-2">
                  <Label>Redemption Rate ($ per point)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={loyaltySettings?.redemption_rate || 0.01}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, redemption_rate: parseFloat(e.target.value) || 0.01 })}
                  />
                  <p className="text-xs text-slate-500">E.g., 0.01 = 100 points = $1 off</p>
                </div>
                <div className="space-y-2">
                  <Label>Minimum Points to Redeem</Label>
                  <Input
                    type="number"
                    min="0"
                    value={loyaltySettings?.min_redemption_points || 100}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, min_redemption_points: parseInt(e.target.value) || 100 })}
                  />
                  <p className="text-xs text-slate-500">Minimum points required before redemption</p>
                </div>
                <div className="space-y-2">
                  <Label>Max Redemption (% of order)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={loyaltySettings?.max_redemption_percent || 50}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, max_redemption_percent: parseFloat(e.target.value) || 50 })}
                  />
                  <p className="text-xs text-slate-500">Maximum % of order payable with points</p>
                </div>
                <div className="space-y-2">
                  <Label>Points Expiry (days)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={loyaltySettings?.points_expiry_days || 365}
                    onChange={(e) => setLoyaltySettings({ ...loyaltySettings, points_expiry_days: parseInt(e.target.value) || 365 })}
                  />
                  <p className="text-xs text-slate-500">0 = points never expire</p>
                </div>
                <div className="flex items-center gap-4 pt-6">
                  <Switch
                    checked={loyaltySettings?.exclude_business_customers}
                    onCheckedChange={(checked) => setLoyaltySettings({ ...loyaltySettings, exclude_business_customers: checked })}
                  />
                  <div>
                    <Label>Exclude Business Customers</Label>
                    <p className="text-xs text-slate-500">Business accounts won't earn points</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Loyalty Tiers */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Loyalty Tiers</Label>
                {loyaltySettings?.tiers?.map((tier, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-4 gap-3">
                      <Input
                        placeholder="Tier Name"
                        value={tier.name}
                        onChange={(e) => {
                          const tiers = [...loyaltySettings.tiers];
                          tiers[index] = { ...tier, name: e.target.value };
                          setLoyaltySettings({ ...loyaltySettings, tiers });
                        }}
                      />
                      <Input
                        type="number"
                        placeholder="Min Points"
                        value={tier.min_points}
                        onChange={(e) => {
                          const tiers = [...loyaltySettings.tiers];
                          tiers[index] = { ...tier, min_points: parseInt(e.target.value) || 0 };
                          setLoyaltySettings({ ...loyaltySettings, tiers });
                        }}
                      />
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="Multiplier"
                        value={tier.multiplier}
                        onChange={(e) => {
                          const tiers = [...loyaltySettings.tiers];
                          tiers[index] = { ...tier, multiplier: parseFloat(e.target.value) || 1 };
                          setLoyaltySettings({ ...loyaltySettings, tiers });
                        }}
                      />
                      <Input
                        placeholder="Benefits"
                        value={tier.benefits}
                        onChange={(e) => {
                          const tiers = [...loyaltySettings.tiers];
                          tiers[index] = { ...tier, benefits: e.target.value };
                          setLoyaltySettings({ ...loyaltySettings, tiers });
                        }}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => {
                        const tiers = loyaltySettings.tiers.filter((_, i) => i !== index);
                        setLoyaltySettings({ ...loyaltySettings, tiers });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    const tiers = [...(loyaltySettings?.tiers || []), { name: "", min_points: 0, multiplier: 1, benefits: "" }];
                    setLoyaltySettings({ ...loyaltySettings, tiers });
                  }}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Tier
                </Button>
              </div>

              <Button onClick={handleLoyaltyUpdate} disabled={saving}>
                {saving ? "Saving..." : "Save Loyalty Settings"}
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

      {/* Template Edit Modal */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Edit Notification Template
            </DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email Subject</Label>
                <Input
                  value={editingTemplate.subject}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, subject: e.target.value })}
                  placeholder="e.g., Your Order is Ready - {order_number}"
                />
              </div>
              <div className="space-y-2">
                <Label>Email Body</Label>
                <Textarea
                  rows={8}
                  value={editingTemplate.body}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, body: e.target.value })}
                  placeholder="Email content..."
                />
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-slate-700 mb-2">Available Variables:</p>
                <p className="text-xs text-slate-500">
                  {"{customer_name}"}, {"{order_number}"}, {"{total}"}, {"{currency}"}, {"{business_name}"}, {"{estimated_ready}"}, {"{due_date}"}, {"{invoice_number}"}, {"{amount_due}"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={editingTemplate.sms_enabled}
                  onCheckedChange={(checked) => setEditingTemplate({ ...editingTemplate, sms_enabled: checked })}
                />
                <Label>Also send SMS notification</Label>
              </div>
              {editingTemplate.sms_enabled && (
                <div className="space-y-2">
                  <Label>SMS Text (max 160 chars)</Label>
                  <Input
                    maxLength={160}
                    value={editingTemplate.sms_text || ""}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, sms_text: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateModal(false)}>
              Cancel
            </Button>
            <Button onClick={saveTemplate}>Save Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
