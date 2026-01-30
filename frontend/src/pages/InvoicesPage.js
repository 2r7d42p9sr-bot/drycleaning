import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  FileText,
  Plus,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  Search,
  CreditCard,
  Building,
  Calendar
} from "lucide-react";

const STATUS_COLORS = {
  draft: "bg-slate-100 text-slate-800",
  sent: "bg-blue-100 text-blue-800",
  partial: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  overdue: "bg-red-100 text-red-800",
  cancelled: "bg-slate-100 text-slate-800",
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  
  // Create invoice modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [businessCustomers, setBusinessCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [uninvoicedOrders, setUninvoicedOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [dueDate, setDueDate] = useState("");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  
  // Payment modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentNotes, setPaymentNotes] = useState("");
  
  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInvoice, setDetailInvoice] = useState(null);

  const isManager = user?.role === "admin" || user?.role === "manager";

  useEffect(() => {
    fetchData();
  }, [statusFilter]);

  const fetchData = async () => {
    try {
      const [invoicesRes, summaryRes] = await Promise.all([
        api.get(`/invoices${statusFilter !== "all" ? `?status=${statusFilter}` : ""}`),
        api.get("/invoices/summary"),
      ]);
      setInvoices(invoicesRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  };

  const fetchBusinessCustomers = async () => {
    try {
      const res = await api.get("/customers?customer_type=business");
      setBusinessCustomers(res.data);
    } catch (error) {
      toast.error("Failed to load customers");
    }
  };

  const fetchUninvoicedOrders = async (customerId) => {
    try {
      const res = await api.get(`/orders/uninvoiced/${customerId}`);
      setUninvoicedOrders(res.data);
    } catch (error) {
      toast.error("Failed to load orders");
    }
  };

  const openCreateModal = () => {
    fetchBusinessCustomers();
    setSelectedCustomer(null);
    setUninvoicedOrders([]);
    setSelectedOrders([]);
    setDueDate("");
    setInvoiceNotes("");
    setShowCreateModal(true);
  };

  const handleCustomerChange = async (customerId) => {
    const customer = businessCustomers.find(c => c.id === customerId);
    setSelectedCustomer(customer);
    setSelectedOrders([]);
    if (customerId) {
      await fetchUninvoicedOrders(customerId);
      // Set default due date based on payment terms
      const paymentTerms = customer?.business_info?.payment_terms || 30;
      const due = new Date();
      due.setDate(due.getDate() + paymentTerms);
      setDueDate(due.toISOString().split("T")[0]);
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) 
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    );
  };

  const handleCreateInvoice = async () => {
    if (!selectedCustomer || selectedOrders.length === 0 || !dueDate) {
      toast.error("Please select a customer, orders, and due date");
      return;
    }

    try {
      await api.post("/invoices", {
        customer_id: selectedCustomer.id,
        order_ids: selectedOrders,
        due_date: dueDate,
        notes: invoiceNotes
      });
      toast.success("Invoice created");
      setShowCreateModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create invoice");
    }
  };

  const openPaymentModal = (invoice) => {
    setSelectedInvoice(invoice);
    setPaymentAmount(invoice.amount_due);
    setPaymentMethod("bank_transfer");
    setPaymentNotes("");
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async () => {
    if (!paymentAmount || paymentAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await api.post(`/invoices/${selectedInvoice.id}/payment`, {
        amount: paymentAmount,
        payment_method: paymentMethod,
        notes: paymentNotes
      });
      toast.success("Payment recorded");
      setShowPaymentModal(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to record payment");
    }
  };

  const openDetailModal = async (invoice) => {
    try {
      const res = await api.get(`/invoices/${invoice.id}`);
      setDetailInvoice(res.data);
      setShowDetailModal(true);
    } catch (error) {
      toast.error("Failed to load invoice details");
    }
  };

  const selectedTotal = uninvoicedOrders
    .filter(o => selectedOrders.includes(o.id))
    .reduce((sum, o) => sum + o.total, 0);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="invoices-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Invoices
          </h1>
          <p className="text-slate-500 mt-1">Manage invoices for business customers</p>
        </div>
        {isManager && (
          <Button onClick={openCreateModal} className="bg-blue-500 hover:bg-blue-600">
            <Plus className="w-4 h-4 mr-2" />
            Create Invoice
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Invoiced</p>
                  <p className="text-xl font-bold text-slate-800">${summary.total_invoiced.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total Paid</p>
                  <p className="text-xl font-bold text-green-600">${summary.total_paid.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Outstanding</p>
                  <p className="text-xl font-bold text-amber-600">${summary.total_outstanding.toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={`border-slate-200 ${summary.overdue_count > 0 ? 'border-red-300 bg-red-50' : ''}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${summary.overdue_count > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
                  <AlertTriangle className={`w-5 h-5 ${summary.overdue_count > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Overdue</p>
                  <p className={`text-xl font-bold ${summary.overdue_count > 0 ? 'text-red-600' : 'text-slate-800'}`}>
                    {summary.overdue_count} (${summary.overdue_total.toFixed(2)})
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Label className="text-slate-600">Status:</Label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Invoices</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="partial">Partially Paid</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Invoices Table */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Due</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id} className={invoice.status === "overdue" ? "bg-red-50" : ""}>
                  <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{invoice.customer_name}</p>
                      {invoice.company_name && (
                        <p className="text-sm text-slate-500">{invoice.company_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{invoice.orders?.length || 0}</TableCell>
                  <TableCell className="text-right font-medium">${invoice.total.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-green-600">${invoice.amount_paid.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-bold text-slate-800">${invoice.amount_due.toFixed(2)}</TableCell>
                  <TableCell>{invoice.due_date}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[invoice.status]}>
                      {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openDetailModal(invoice)}>
                        View
                      </Button>
                      {invoice.status !== "paid" && isManager && (
                        <Button size="sm" onClick={() => openPaymentModal(invoice)}>
                          <CreditCard className="w-4 h-4 mr-1" />
                          Pay
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No invoices found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invoice Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Create Invoice
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Customer Selection */}
            <div className="space-y-2">
              <Label>Business Customer *</Label>
              <Select
                value={selectedCustomer?.id || ""}
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a business customer" />
                </SelectTrigger>
                <SelectContent>
                  {businessCustomers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4" />
                        {customer.name} - {customer.business_info?.company_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedCustomer && (
              <>
                {/* Customer Info */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-500">Company</p>
                      <p className="font-medium">{selectedCustomer.business_info?.company_name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Payment Terms</p>
                      <p className="font-medium">{selectedCustomer.business_info?.payment_terms || 30} days</p>
                    </div>
                  </div>
                </div>

                {/* Uninvoiced Orders */}
                <div className="space-y-2">
                  <Label>Select Orders to Include *</Label>
                  {uninvoicedOrders.length > 0 ? (
                    <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Order #</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {uninvoicedOrders.map((order) => (
                            <TableRow 
                              key={order.id}
                              className={selectedOrders.includes(order.id) ? "bg-blue-50" : ""}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={selectedOrders.includes(order.id)}
                                  onCheckedChange={() => toggleOrderSelection(order.id)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{order.order_number}</TableCell>
                              <TableCell>{order.timestamps?.created_at?.split("T")[0]}</TableCell>
                              <TableCell>{order.items?.length || 0} items</TableCell>
                              <TableCell className="text-right font-medium">${order.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 border rounded-lg">
                      <p>No uninvoiced orders found for this customer</p>
                    </div>
                  )}
                </div>

                {/* Due Date */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Due Date *</Label>
                    <Input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Selected Total</Label>
                    <div className="h-10 px-3 py-2 border rounded-md bg-slate-50 text-lg font-bold">
                      ${selectedTotal.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input
                    value={invoiceNotes}
                    onChange={(e) => setInvoiceNotes(e.target.value)}
                    placeholder="Add notes to the invoice..."
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateInvoice}
              disabled={!selectedCustomer || selectedOrders.length === 0 || !dueDate}
            >
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Modal */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Record Payment
            </DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500">Invoice</p>
                <p className="font-bold text-lg">{selectedInvoice.invoice_number}</p>
                <p className="text-sm text-slate-500 mt-2">Amount Due</p>
                <p className="font-bold text-xl text-slate-800">${selectedInvoice.amount_due.toFixed(2)}</p>
              </div>

              <div className="space-y-2">
                <Label>Payment Amount *</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={selectedInvoice.amount_due}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Reference number, etc."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment}>
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Invoice Details
            </DialogTitle>
          </DialogHeader>
          {detailInvoice && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Invoice Number</p>
                  <p className="font-bold text-xl">{detailInvoice.invoice_number}</p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Status</p>
                  <Badge className={`${STATUS_COLORS[detailInvoice.status]} mt-1`}>
                    {detailInvoice.status.charAt(0).toUpperCase() + detailInvoice.status.slice(1)}
                  </Badge>
                </div>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">Customer</p>
                <p className="font-medium">{detailInvoice.customer_name}</p>
                {detailInvoice.company_name && (
                  <p className="text-slate-600">{detailInvoice.company_name}</p>
                )}
              </div>

              {/* Orders */}
              <div className="space-y-2">
                <Label>Orders Included</Label>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailInvoice.orders?.map((order) => (
                        <TableRow key={order.order_id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.order_date?.split("T")[0]}</TableCell>
                          <TableCell className="text-right">${order.amount.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-slate-100 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span>${detailInvoice.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tax</span>
                  <span>${detailInvoice.tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total</span>
                  <span>${detailInvoice.total.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Amount Paid</span>
                  <span>${detailInvoice.amount_paid.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold">
                  <span>Amount Due</span>
                  <span>${detailInvoice.amount_due.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment History */}
              {detailInvoice.payments?.length > 0 && (
                <div className="space-y-2">
                  <Label>Payment History</Label>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detailInvoice.payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell>{payment.recorded_at?.split("T")[0]}</TableCell>
                            <TableCell className="capitalize">{payment.payment_method?.replace("_", " ")}</TableCell>
                            <TableCell>{payment.notes || "-"}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">
                              ${payment.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Created</p>
                  <p className="font-medium">{detailInvoice.created_at?.split("T")[0]}</p>
                </div>
                <div>
                  <p className="text-slate-500">Due Date</p>
                  <p className={`font-medium ${detailInvoice.status === "overdue" ? "text-red-600" : ""}`}>
                    {detailInvoice.due_date}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Payment Terms</p>
                  <p className="font-medium">{detailInvoice.payment_terms} days</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailModal(false)}>
              Close
            </Button>
            {detailInvoice && detailInvoice.status !== "paid" && isManager && (
              <Button onClick={() => {
                setShowDetailModal(false);
                openPaymentModal(detailInvoice);
              }}>
                <CreditCard className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
