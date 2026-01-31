import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import api from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import { browserPrintReceipt, browserPrintLabel } from "@/lib/printer";
import {
  Search,
  Filter,
  Package,
  Clock,
  CheckCircle,
  Truck,
  XCircle,
  Printer,
  Tag,
  ChevronRight,
  RefreshCcw
} from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  cleaning: { label: "Cleaning", color: "bg-blue-100 text-blue-800", icon: Package },
  ready: { label: "Ready", color: "bg-green-100 text-green-800", icon: CheckCircle },
  out_for_delivery: { label: "Out for Delivery", color: "bg-amber-100 text-amber-800", icon: Truck },
  delivered: { label: "Delivered", color: "bg-purple-100 text-purple-800", icon: Truck },
  collected: { label: "Collected", color: "bg-slate-100 text-slate-800", icon: CheckCircle },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-800", icon: XCircle },
};

const STATUS_FLOW = ["cleaning", "ready", "collected"];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { formatCurrency } = useSettings();
  const [showOrderModal, setShowOrderModal] = useState(false);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter]);

  const fetchOrders = async () => {
    try {
      const params = statusFilter !== "all" ? `?status=${statusFilter}` : "";
      const response = await api.get(`/orders${params}`);
      setOrders(response.data);
    } catch (error) {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      order.order_number.toLowerCase().includes(query) ||
      order.customer_name.toLowerCase().includes(query) ||
      order.customer_phone.includes(query)
    );
  });

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      toast.success(`Order status updated to ${STATUS_CONFIG[newStatus].label}`);
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getNextStatus = (currentStatus) => {
    const currentIndex = STATUS_FLOW.indexOf(currentStatus);
    if (currentIndex < STATUS_FLOW.length - 1) {
      return STATUS_FLOW[currentIndex + 1];
    }
    return null;
  };

  const handlePrintReceipt = (order) => {
    browserPrintReceipt(order, { name: "DryClean POS", taxRate: 0.08 });
  };

  const handlePrintLabels = (order) => {
    order.items.forEach((item, index) => {
      browserPrintLabel(order, item, index);
    });
  };

  const openOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="orders-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Orders
          </h1>
          <p className="text-slate-500 mt-1">Track and manage customer orders</p>
        </div>
        <Button onClick={fetchOrders} variant="outline" data-testid="refresh-orders-btn">
          <RefreshCcw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search orders, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="order-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            <SelectItem value="cleaning">Cleaning</SelectItem>
            <SelectItem value="ready">Ready</SelectItem>
            <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="collected">Collected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUS_FLOW.map((status) => {
          const config = STATUS_CONFIG[status];
          const count = orders.filter((o) => o.status === status).length;
          return (
            <Card
              key={status}
              className={`border-slate-200 cursor-pointer ${statusFilter === status ? "ring-2 ring-blue-500" : ""}`}
              onClick={() => setStatusFilter(status === statusFilter ? "all" : status)}
              data-testid={`status-card-${status}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500">{config.label}</p>
                    <p className="text-2xl font-bold text-slate-800">{count}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${config.color}`}>
                    <config.icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Orders Table */}
      <Card className="border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredOrders.length > 0 ? (
                filteredOrders.map((order) => {
                  const statusConfig = STATUS_CONFIG[order.status] || { label: order.status, color: "bg-slate-100 text-slate-800" };
                  const nextStatus = getNextStatus(order.status);
                  const createdAt = order.timestamps?.created_at || order.created_at;
                  return (
                    <TableRow key={order.id} data-testid={`order-row-${order.id}`}>
                      <TableCell>
                        <div>
                          <p className="font-mono font-medium text-slate-800">{order.order_number}</p>
                          <p className="text-xs text-slate-500">
                            {createdAt ? format(new Date(createdAt), "MMM d, h:mm a") : "N/A"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-slate-800">{order.customer_name}</p>
                        <p className="text-sm text-slate-500">{order.customer_phone}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-slate-800">{order.items.length} items</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-bold text-slate-800">{formatCurrency(order.total)}</p>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>{statusConfig.label}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            order.payment_status === "completed"
                              ? "bg-green-100 text-green-800"
                              : "bg-amber-100 text-amber-800"
                          }
                        >
                          {order.payment_status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {nextStatus && order.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateOrderStatus(order.id, nextStatus)}
                              data-testid={`advance-status-${order.id}`}
                            >
                              {STATUS_CONFIG[nextStatus].label}
                              <ChevronRight className="w-4 h-4 ml-1" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openOrderDetails(order)}
                            data-testid={`view-order-${order.id}`}
                          >
                            View
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p>No orders found</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <Dialog open={showOrderModal} onOpenChange={setShowOrderModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Order {selectedOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-6">
              {/* Status and Payment */}
              <div className="flex gap-4">
                <Badge className={STATUS_CONFIG[selectedOrder.status].color + " text-sm px-3 py-1"}>
                  {STATUS_CONFIG[selectedOrder.status].label}
                </Badge>
                <Badge
                  className={
                    (selectedOrder.payment_status === "completed"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800") + " text-sm px-3 py-1"
                  }
                >
                  {selectedOrder.payment_status}
                </Badge>
              </div>

              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <p className="text-sm text-slate-500 mb-1">Customer</p>
                <p className="font-medium text-slate-800">{selectedOrder.customer_name}</p>
                <p className="text-slate-600">{selectedOrder.customer_phone}</p>
              </div>

              {/* Items */}
              <div>
                <p className="font-medium text-slate-800 mb-3">Items</p>
                <div className="space-y-2">
                  {selectedOrder.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            item.service_type === "express"
                              ? "bg-amber-100 text-amber-800"
                              : item.service_type === "delicate"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-slate-100 text-slate-800"
                          }
                        >
                          {item.service_type}
                        </Badge>
                        <span className="text-slate-800">{item.item_name}</span>
                        <span className="text-slate-500">x{item.quantity}</span>
                      </div>
                      <span className="font-medium text-slate-800">
                        ${item.total_price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>${selectedOrder.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Tax</span>
                  <span>${selectedOrder.tax.toFixed(2)}</span>
                </div>
                {selectedOrder.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-${selectedOrder.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-slate-800 pt-2 border-t border-slate-200">
                  <span>Total</span>
                  <span>${selectedOrder.total.toFixed(2)}</span>
                </div>
              </div>

              {/* Estimated Ready */}
              {selectedOrder.estimated_ready && (
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600">
                    Estimated Ready: {selectedOrder.estimated_ready}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-slate-200">
                <Button
                  variant="outline"
                  onClick={() => handlePrintReceipt(selectedOrder)}
                  className="flex-1"
                  data-testid="print-receipt-btn"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Print Receipt
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handlePrintLabels(selectedOrder)}
                  className="flex-1"
                  data-testid="print-labels-btn"
                >
                  <Tag className="w-4 h-4 mr-2" />
                  Print Labels
                </Button>
              </div>

              {/* Status Actions */}
              {getNextStatus(selectedOrder.status) && selectedOrder.status !== "cancelled" && (
                <Button
                  className="w-full bg-blue-500 hover:bg-blue-600"
                  onClick={() => {
                    updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status));
                    setShowOrderModal(false);
                  }}
                  data-testid="advance-status-modal-btn"
                >
                  Mark as {STATUS_CONFIG[getNextStatus(selectedOrder.status)].label}
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
