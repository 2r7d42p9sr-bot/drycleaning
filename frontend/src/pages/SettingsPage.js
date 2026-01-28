import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ThermalPrinter, CashDrawer, isWebUSBSupported } from "@/lib/printer";
import {
  Printer,
  Receipt,
  Tag,
  DollarSign,
  Usb,
  Check,
  X,
  AlertCircle
} from "lucide-react";

export default function SettingsPage() {
  const [receiptPrinter, setReceiptPrinter] = useState(null);
  const [labelPrinter, setLabelPrinter] = useState(null);
  const [connecting, setConnecting] = useState({ receipt: false, label: false });

  // Business settings (would be persisted in real app)
  const [settings, setSettings] = useState({
    businessName: "DryClean POS",
    address: "",
    phone: "",
    taxRate: 8,
    autoPrintReceipt: true,
    autoPrintLabels: true,
    openDrawerOnPayment: true,
  });

  const webUSBSupported = isWebUSBSupported();

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
      console.error(error);
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
      console.error(error);
    } finally {
      setConnecting({ ...connecting, label: false });
    }
  };

  const disconnectPrinter = async (type) => {
    try {
      if (type === "receipt" && receiptPrinter) {
        await receiptPrinter.disconnect();
        setReceiptPrinter(null);
        toast.success("Receipt printer disconnected");
      } else if (type === "label" && labelPrinter) {
        await labelPrinter.disconnect();
        setLabelPrinter(null);
        toast.success("Label printer disconnected");
      }
    } catch (error) {
      toast.error("Failed to disconnect printer");
    }
  };

  const testPrint = async (type) => {
    try {
      const printer = type === "receipt" ? receiptPrinter : labelPrinter;
      if (!printer) {
        toast.error("Printer not connected");
        return;
      }

      await printer.init();
      await printer.centerAlign();
      await printer.setDoubleSize(true);
      await printer.print("TEST PRINT");
      await printer.setDoubleSize(false);
      await printer.leftAlign();
      await printer.print("--------------------------------");
      await printer.print("DryClean POS System");
      await printer.print(`Date: ${new Date().toLocaleString()}`);
      await printer.print("--------------------------------");
      await printer.print("If you can read this,");
      await printer.print("your printer is working!");
      await printer.cut();

      toast.success("Test print sent");
    } catch (error) {
      toast.error("Failed to print test page");
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

  const handleSaveSettings = () => {
    // In a real app, this would save to backend
    localStorage.setItem("posSettings", JSON.stringify(settings));
    toast.success("Settings saved");
  };

  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
          Settings
        </h1>
        <p className="text-slate-500 mt-1">Configure your POS system and hardware</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hardware Settings */}
        <div className="space-y-6">
          {/* WebUSB Support Notice */}
          {!webUSBSupported && (
            <Card className="border-amber-200 bg-amber-50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-800">WebUSB Not Supported</p>
                    <p className="text-sm text-amber-700 mt-1">
                      Your browser doesn't support WebUSB. Use Chrome or Edge for direct printer connection.
                      Browser print dialogs will be used instead.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Receipt Printer */}
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Receipt className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Receipt Printer
                    </CardTitle>
                    <CardDescription>Thermal receipt printer for transactions</CardDescription>
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
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {!receiptPrinter ? (
                  <Button
                    onClick={connectReceiptPrinter}
                    disabled={!webUSBSupported || connecting.receipt}
                    className="flex-1"
                    data-testid="connect-receipt-printer"
                  >
                    <Usb className="w-4 h-4 mr-2" />
                    {connecting.receipt ? "Connecting..." : "Connect Printer"}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => testPrint("receipt")}
                      className="flex-1"
                      data-testid="test-receipt-printer"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Test Print
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => disconnectPrinter("receipt")}
                      className="text-red-500 hover:text-red-600"
                      data-testid="disconnect-receipt-printer"
                    >
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
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
                    <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                      Label Printer
                    </CardTitle>
                    <CardDescription>Garment tag printer for tracking</CardDescription>
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
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                {!labelPrinter ? (
                  <Button
                    onClick={connectLabelPrinter}
                    disabled={!webUSBSupported || connecting.label}
                    className="flex-1"
                    data-testid="connect-label-printer"
                  >
                    <Usb className="w-4 h-4 mr-2" />
                    {connecting.label ? "Connecting..." : "Connect Printer"}
                  </Button>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => testPrint("label")}
                      className="flex-1"
                      data-testid="test-label-printer"
                    >
                      <Printer className="w-4 h-4 mr-2" />
                      Test Print
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => disconnectPrinter("label")}
                      className="text-red-500 hover:text-red-600"
                      data-testid="disconnect-label-printer"
                    >
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Cash Drawer */}
          <Card className="border-slate-200">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                    Cash Drawer
                  </CardTitle>
                  <CardDescription>Connected via receipt printer</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                onClick={openCashDrawer}
                disabled={!receiptPrinter}
                className="w-full"
                data-testid="open-cash-drawer"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                Open Cash Drawer
              </Button>
              <p className="text-xs text-slate-500 mt-2 text-center">
                Cash drawer opens via receipt printer's kick connector
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Business Settings */}
        <div className="space-y-6">
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Business Information
              </CardTitle>
              <CardDescription>Details shown on receipts and labels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="business-name">Business Name</Label>
                <Input
                  id="business-name"
                  value={settings.businessName}
                  onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                  data-testid="business-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-address">Address</Label>
                <Input
                  id="business-address"
                  value={settings.address}
                  onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                  placeholder="123 Main St, City, State"
                  data-testid="business-address-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="business-phone">Phone</Label>
                <Input
                  id="business-phone"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  placeholder="(555) 123-4567"
                  data-testid="business-phone-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                <Input
                  id="tax-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={settings.taxRate}
                  onChange={(e) => setSettings({ ...settings, taxRate: parseFloat(e.target.value) || 0 })}
                  data-testid="tax-rate-input"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                Automation
              </CardTitle>
              <CardDescription>Configure automatic actions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-print receipts</Label>
                  <p className="text-sm text-slate-500">Print receipt after each sale</p>
                </div>
                <Switch
                  checked={settings.autoPrintReceipt}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoPrintReceipt: checked })}
                  data-testid="auto-receipt-switch"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-print labels</Label>
                  <p className="text-sm text-slate-500">Print garment labels after order</p>
                </div>
                <Switch
                  checked={settings.autoPrintLabels}
                  onCheckedChange={(checked) => setSettings({ ...settings, autoPrintLabels: checked })}
                  data-testid="auto-labels-switch"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>Open drawer on payment</Label>
                  <p className="text-sm text-slate-500">Open cash drawer for cash payments</p>
                </div>
                <Switch
                  checked={settings.openDrawerOnPayment}
                  onCheckedChange={(checked) => setSettings({ ...settings, openDrawerOnPayment: checked })}
                  data-testid="auto-drawer-switch"
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveSettings} className="w-full" data-testid="save-settings-btn">
            Save Settings
          </Button>
        </div>
      </div>
    </div>
  );
}
