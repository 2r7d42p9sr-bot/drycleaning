import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  Calendar as CalendarIcon,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  RefreshCw
} from "lucide-react";
import { format, subDays, subMonths } from "date-fns";

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const PAYMENT_METHOD_LABELS = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank Transfer',
  pay_on_collection: 'Pay on Collection',
  invoice: 'Invoice'
};

export default function MetricsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState(subMonths(new Date(), 1));
  const [dateTo, setDateTo] = useState(new Date());
  const [overview, setOverview] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [itemsData, setItemsData] = useState(null);
  const [customersData, setCustomersData] = useState(null);
  const [paymentsData, setPaymentsData] = useState(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAllMetrics();
  }, [period, dateFrom, dateTo]);

  const fetchAllMetrics = async () => {
    setLoading(true);
    try {
      const dateFromStr = format(dateFrom, "yyyy-MM-dd");
      const dateToStr = format(dateTo, "yyyy-MM-dd");
      
      const [overviewRes, revenueRes, itemsRes, customersRes, paymentsRes] = await Promise.all([
        api.get(`/metrics/overview?period=${period}`),
        api.get(`/metrics/revenue?date_from=${dateFromStr}&date_to=${dateToStr}&group_by=day`),
        api.get(`/metrics/items?date_from=${dateFromStr}&date_to=${dateToStr}`),
        api.get(`/metrics/customers?date_from=${dateFromStr}&date_to=${dateToStr}`),
        api.get(`/metrics/payments?date_from=${dateFromStr}&date_to=${dateToStr}`)
      ]);
      
      setOverview(overviewRes.data);
      setRevenueData(revenueRes.data);
      setItemsData(itemsRes.data);
      setCustomersData(customersRes.data);
      setPaymentsData(paymentsRes.data);
    } catch (error) {
      toast.error("Failed to load metrics");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (reportType) => {
    setExporting(true);
    try {
      const dateFromStr = format(dateFrom, "yyyy-MM-dd");
      const dateToStr = format(dateTo, "yyyy-MM-dd");
      
      const response = await api.get(
        `/metrics/export/${reportType}?date_from=${dateFromStr}&date_to=${dateToStr}`,
        { responseType: 'blob' }
      );
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_report_${dateFromStr}_${dateToStr}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`${reportType} report exported successfully`);
    } catch (error) {
      toast.error("Failed to export report");
    } finally {
      setExporting(false);
    }
  };

  const renderChangeIndicator = (change) => {
    if (change > 0) {
      return (
        <div className="flex items-center text-green-600 text-sm font-medium">
          <ArrowUpRight className="w-4 h-4" />
          <span>+{change}%</span>
        </div>
      );
    } else if (change < 0) {
      return (
        <div className="flex items-center text-red-600 text-sm font-medium">
          <ArrowDownRight className="w-4 h-4" />
          <span>{change}%</span>
        </div>
      );
    }
    return (
      <div className="flex items-center text-slate-500 text-sm font-medium">
        <Minus className="w-4 h-4" />
        <span>0%</span>
      </div>
    );
  };

  if (loading && !overview) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="metrics-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Business Metrics
          </h1>
          <p className="text-slate-500 mt-1">Analyze your business performance</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={fetchAllMetrics}
            disabled={loading}
            data-testid="refresh-metrics-btn"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Date Range & Period Selector */}
      <Card className="border-slate-200">
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Label>Period:</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-32" data-testid="period-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2">
              <Label>From:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="date-from-btn">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(dateFrom, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={(date) => date && setDateFrom(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-center gap-2">
              <Label>To:</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="date-to-btn">
                    <CalendarIcon className="w-4 h-4 mr-2" />
                    {format(dateTo, "MMM d, yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={(date) => date && setDateTo(date)}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('orders')}
                disabled={exporting}
                data-testid="export-orders-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Orders
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('customers')}
                disabled={exporting}
                data-testid="export-customers-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Customers
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleExport('items')}
                disabled={exporting}
                data-testid="export-items-btn"
              >
                <Download className="w-4 h-4 mr-2" />
                Items
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-slate-200" data-testid="kpi-revenue">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                </div>
                {renderChangeIndicator(overview.changes?.revenue)}
              </div>
              <p className="text-sm text-slate-500">Revenue</p>
              <p className="text-2xl font-bold text-slate-800">
                ${overview.current_period?.revenue?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                vs ${overview.previous_period?.revenue?.toFixed(2) || '0.00'} last period
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200" data-testid="kpi-orders">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5 text-green-600" />
                </div>
                {renderChangeIndicator(overview.changes?.orders)}
              </div>
              <p className="text-sm text-slate-500">Orders</p>
              <p className="text-2xl font-bold text-slate-800">
                {overview.current_period?.orders || 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                vs {overview.previous_period?.orders || 0} last period
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200" data-testid="kpi-aov">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-amber-600" />
                </div>
                {renderChangeIndicator(overview.changes?.average_order_value)}
              </div>
              <p className="text-sm text-slate-500">Avg. Order Value</p>
              <p className="text-2xl font-bold text-slate-800">
                ${overview.current_period?.average_order_value?.toFixed(2) || '0.00'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                vs ${overview.previous_period?.average_order_value?.toFixed(2) || '0.00'} last period
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200" data-testid="kpi-customers">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-purple-600" />
                </div>
                {renderChangeIndicator(overview.changes?.new_customers)}
              </div>
              <p className="text-sm text-slate-500">New Customers</p>
              <p className="text-2xl font-bold text-slate-800">
                {overview.current_period?.new_customers || 0}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                vs {overview.previous_period?.new_customers || 0} last period
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Charts Tabs */}
      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue" data-testid="tab-revenue">Revenue</TabsTrigger>
          <TabsTrigger value="items" data-testid="tab-items">Items</TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">Customers</TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">Payments</TabsTrigger>
        </TabsList>

        {/* Revenue Tab */}
        <TabsContent value="revenue">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Revenue Over Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {revenueData?.data?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="revenue" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6' }}
                        name="Revenue"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    No revenue data for selected period
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Total Revenue</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ${revenueData?.total_revenue?.toFixed(2) || '0.00'}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Total Orders</p>
                  <p className="text-2xl font-bold text-slate-800">
                    {revenueData?.total_orders || 0}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg p-4">
                  <p className="text-sm text-slate-500">Avg. Daily Revenue</p>
                  <p className="text-2xl font-bold text-green-600">
                    ${revenueData?.data?.length > 0 
                      ? (revenueData.total_revenue / revenueData.data.length).toFixed(2) 
                      : '0.00'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Items Tab */}
        <TabsContent value="items">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Top Selling Items
                </CardTitle>
              </CardHeader>
              <CardContent>
                {itemsData?.items?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={itemsData.items.slice(0, 8)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis type="number" tick={{ fontSize: 12 }} />
                      <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                      <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    No item data for selected period
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Item Statistics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {itemsData?.items?.slice(0, 6).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{item.name}</p>
                          <p className="text-sm text-slate-500">{item.quantity} sold</p>
                        </div>
                      </div>
                      <p className="font-bold text-slate-800">${item.revenue?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {(!itemsData?.items || itemsData.items.length === 0) && (
                  <div className="h-[200px] flex items-center justify-center text-slate-500">
                    No item data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Customer Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                {customersData?.by_type ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Retail', value: customersData.by_type.retail?.count || 0 },
                          { name: 'Business', value: customersData.by_type.business?.count || 0 }
                        ]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label
                      >
                        <Cell fill="#3b82f6" />
                        <Cell fill="#10b981" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-slate-500">
                    No customer data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Top Customers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customersData?.top_customers?.slice(0, 5).map((customer, index) => (
                    <div key={customer.customer_id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-600">
                            {customer.customer_name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{customer.customer_name}</p>
                          <div className="flex items-center gap-2">
                            <Badge className={customer.customer_type === 'business' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'}>
                              {customer.customer_type}
                            </Badge>
                            <span className="text-sm text-slate-500">{customer.orders} orders</span>
                          </div>
                        </div>
                      </div>
                      <p className="font-bold text-slate-800">${customer.revenue?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {(!customersData?.top_customers || customersData.top_customers.length === 0) && (
                  <div className="h-[200px] flex items-center justify-center text-slate-500">
                    No customer data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Payment Methods
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsData?.by_method?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={paymentsData.by_method.map(p => ({
                          name: PAYMENT_METHOD_LABELS[p.method] || p.method,
                          value: p.revenue
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        fill="#8884d8"
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {paymentsData.by_method.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-slate-500">
                    No payment data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  Payment Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentsData?.by_method?.map((payment, index) => (
                    <div key={payment.method} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <p className="font-medium text-slate-800">
                            {PAYMENT_METHOD_LABELS[payment.method] || payment.method}
                          </p>
                          <p className="text-sm text-slate-500">{payment.count} transactions</p>
                        </div>
                      </div>
                      <p className="font-bold text-slate-800">${payment.revenue?.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
                {(!paymentsData?.by_method || paymentsData.by_method.length === 0) && (
                  <div className="h-[200px] flex items-center justify-center text-slate-500">
                    No payment data available
                  </div>
                )}
                
                {paymentsData?.total_revenue > 0 && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-slate-600">Total Revenue</p>
                      <p className="text-xl font-bold text-blue-600">
                        ${paymentsData.total_revenue?.toFixed(2)}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
