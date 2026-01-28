import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  Truck,
  Package,
  MapPin,
  Clock,
  CalendarIcon,
  Phone,
  User,
  CheckCircle,
  Navigation,
  Plus
} from "lucide-react";
import { format, addDays } from "date-fns";

const TIME_SLOTS = [
  "8:00 AM - 10:00 AM",
  "10:00 AM - 12:00 PM",
  "12:00 PM - 2:00 PM",
  "2:00 PM - 4:00 PM",
  "4:00 PM - 6:00 PM",
  "6:00 PM - 8:00 PM",
];

const DELIVERY_STATUS = {
  received: { label: "Pending Pickup", color: "bg-blue-100 text-blue-800" },
  processing: { label: "Processing", color: "bg-amber-100 text-amber-800" },
  ready: { label: "Ready", color: "bg-green-100 text-green-800" },
  out_for_delivery: { label: "Out for Delivery", color: "bg-purple-100 text-purple-800" },
  delivered: { label: "Delivered", color: "bg-slate-100 text-slate-800" },
  picked_up: { label: "Picked Up", color: "bg-slate-100 text-slate-800" },
};

export default function DeliveryPage() {
  const [deliveries, setDeliveries] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState("all");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);

  // Schedule form
  const [scheduleForm, setScheduleForm] = useState({
    pickup_date: null,
    pickup_time_slot: "",
    delivery_date: null,
    delivery_time_slot: "",
    driver_id: "",
    delivery_notes: "",
    delivery_fee: 0,
  });

  useEffect(() => {
    fetchData();
  }, [selectedDate]);

  const fetchData = async () => {
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const [deliveriesRes, driversRes] = await Promise.all([
        api.get(`/deliveries?date=${dateStr}`),
        api.get("/drivers"),
      ]);
      setDeliveries(deliveriesRes.data);
      setDrivers(driversRes.data);
    } catch (error) {
      toast.error("Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  };

  const filteredDeliveries = deliveries.filter((d) => {
    if (activeTab === "all") return true;
    if (activeTab === "pickup") return d.delivery_info?.type === "pickup" || d.delivery_info?.type === "both";
    if (activeTab === "delivery") return d.delivery_info?.type === "delivery" || d.delivery_info?.type === "both";
    return true;
  });

  const openScheduleModal = (delivery) => {
    setSelectedDelivery(delivery);
    const info = delivery.delivery_info || {};
    setScheduleForm({
      pickup_date: info.pickup_date ? new Date(info.pickup_date) : null,
      pickup_time_slot: info.pickup_time_slot || "",
      delivery_date: info.delivery_date ? new Date(info.delivery_date) : null,
      delivery_time_slot: info.delivery_time_slot || "",
      driver_id: info.driver_id || "",
      delivery_notes: info.delivery_notes || "",
      delivery_fee: info.delivery_fee || 0,
    });
    setShowScheduleModal(true);
  };

  const handleScheduleSave = async () => {
    if (!selectedDelivery) return;

    try {
      const deliveryInfo = {
        type: selectedDelivery.delivery_info?.type || "both",
        pickup_date: scheduleForm.pickup_date ? format(scheduleForm.pickup_date, "yyyy-MM-dd") : null,
        pickup_time_slot: scheduleForm.pickup_time_slot || null,
        delivery_date: scheduleForm.delivery_date ? format(scheduleForm.delivery_date, "yyyy-MM-dd") : null,
        delivery_time_slot: scheduleForm.delivery_time_slot || null,
        driver_id: scheduleForm.driver_id || null,
        driver_name: drivers.find(d => d.id === scheduleForm.driver_id)?.name || null,
        delivery_notes: scheduleForm.delivery_notes || null,
        delivery_fee: scheduleForm.delivery_fee || 0,
        pickup_address: selectedDelivery.delivery_info?.pickup_address || null,
        delivery_address: selectedDelivery.delivery_info?.delivery_address || null,
      };

      await api.put(`/orders/${selectedDelivery.order_id}/delivery`, deliveryInfo);
      toast.success("Delivery schedule updated");
      setShowScheduleModal(false);
      fetchData();
    } catch (error) {
      toast.error("Failed to update delivery schedule");
    }
  };

  const updateOrderStatus = async (orderId, newStatus) => {
    try {
      await api.put(`/orders/${orderId}/status`, { status: newStatus });
      toast.success("Status updated");
      fetchData();
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Stats
  const pickupCount = deliveries.filter(d => 
    (d.delivery_info?.type === "pickup" || d.delivery_info?.type === "both") &&
    d.status !== "delivered" && d.status !== "picked_up"
  ).length;

  const deliveryCount = deliveries.filter(d => 
    (d.delivery_info?.type === "delivery" || d.delivery_info?.type === "both") &&
    d.status !== "delivered" && d.status !== "picked_up"
  ).length;

  const outForDelivery = deliveries.filter(d => d.status === "out_for_delivery").length;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="delivery-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Pickup & Delivery
          </h1>
          <p className="text-slate-500 mt-1">Manage pickups and deliveries</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="date-picker">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, "MMM d, yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Pickups Today</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{pickupCount}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Deliveries Today</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{deliveryCount}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Truck className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Out for Delivery</p>
                <p className="text-3xl font-bold text-slate-800 mt-1">{outForDelivery}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Navigation className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & List */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({deliveries.length})</TabsTrigger>
          <TabsTrigger value="pickup">Pickups</TabsTrigger>
          <TabsTrigger value="delivery">Deliveries</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card className="border-slate-200">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Time Slot</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDeliveries.length > 0 ? (
                    filteredDeliveries.map((delivery) => {
                      const info = delivery.delivery_info || {};
                      const statusConfig = DELIVERY_STATUS[delivery.status] || DELIVERY_STATUS.received;
                      
                      return (
                        <TableRow key={delivery.order_id} data-testid={`delivery-row-${delivery.order_id}`}>
                          <TableCell>
                            <p className="font-mono font-medium text-slate-800">{delivery.order_number}</p>
                            <p className="text-sm text-slate-500">${delivery.total?.toFixed(2)}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-slate-400" />
                              <div>
                                <p className="font-medium text-slate-800">{delivery.customer_name}</p>
                                <p className="text-sm text-slate-500">{delivery.customer_phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                info.type === "pickup"
                                  ? "bg-blue-100 text-blue-800"
                                  : info.type === "delivery"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-purple-100 text-purple-800"
                              }
                            >
                              {info.type === "both" ? "Pickup & Delivery" : info.type || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {info.pickup_time_slot || info.delivery_time_slot ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {info.pickup_time_slot || info.delivery_time_slot}
                              </div>
                            ) : (
                              <span className="text-slate-400">Not scheduled</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {info.driver_name || (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig.color}>
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openScheduleModal(delivery)}
                                data-testid={`schedule-btn-${delivery.order_id}`}
                              >
                                Schedule
                              </Button>
                              {delivery.status === "ready" && (
                                <Button
                                  size="sm"
                                  onClick={() => updateOrderStatus(delivery.order_id, "out_for_delivery")}
                                >
                                  <Truck className="w-4 h-4 mr-1" />
                                  Out
                                </Button>
                              )}
                              {delivery.status === "out_for_delivery" && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700"
                                  onClick={() => updateOrderStatus(delivery.order_id, "delivered")}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  Delivered
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-slate-500">
                        <Truck className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p>No deliveries scheduled for this date</p>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Schedule Modal */}
      <Dialog open={showScheduleModal} onOpenChange={setShowScheduleModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Manrope, sans-serif' }}>
              Schedule Delivery - {selectedDelivery?.order_number}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Pickup Section */}
            <div className="space-y-3">
              <Label className="text-base font-semibold">Pickup</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-500">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {scheduleForm.pickup_date
                          ? format(scheduleForm.pickup_date, "MMM d, yyyy")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduleForm.pickup_date}
                        onSelect={(date) => setScheduleForm({ ...scheduleForm, pickup_date: date })}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-500">Time Slot</Label>
                  <Select
                    value={scheduleForm.pickup_time_slot}
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, pickup_time_slot: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Delivery Section */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <Label className="text-base font-semibold">Delivery</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm text-slate-500">Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {scheduleForm.delivery_date
                          ? format(scheduleForm.delivery_date, "MMM d, yyyy")
                          : "Select date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={scheduleForm.delivery_date}
                        onSelect={(date) => setScheduleForm({ ...scheduleForm, delivery_date: date })}
                        disabled={(date) => scheduleForm.pickup_date && date < scheduleForm.pickup_date}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm text-slate-500">Time Slot</Label>
                  <Select
                    value={scheduleForm.delivery_time_slot}
                    onValueChange={(value) => setScheduleForm({ ...scheduleForm, delivery_time_slot: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Driver & Fee */}
            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-200">
              <div className="space-y-2">
                <Label>Assign Driver</Label>
                <Select
                  value={scheduleForm.driver_id}
                  onValueChange={(value) => setScheduleForm({ ...scheduleForm, driver_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select driver" />
                  </SelectTrigger>
                  <SelectContent>
                    {drivers.map((driver) => (
                      <SelectItem key={driver.id} value={driver.id}>
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Delivery Fee ($)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={scheduleForm.delivery_fee}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, delivery_fee: parseFloat(e.target.value) || 0 })}
                />
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Delivery Notes</Label>
              <Textarea
                value={scheduleForm.delivery_notes}
                onChange={(e) => setScheduleForm({ ...scheduleForm, delivery_notes: e.target.value })}
                placeholder="Special instructions, gate codes, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleScheduleSave}>
              Save Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
