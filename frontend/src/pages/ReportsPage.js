import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import api from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  CalendarIcon,
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Package,
  CreditCard,
  Banknote,
  Building2
} from "lucide-react";
import { format, subDays } from "date-fns";

const COLORS = ["#3B82F6", "#10B981", "#8B5CF6", "#F59E0B", "#EF4444"];

export default function ReportsPage() {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  useEffect(() => {
    fetchReport();
  }, [dateRange]);

  const fetchReport = async () => {
    try {
      const params = new URLSearchParams();
      if (dateRange.from) params.append("date_from", format(dateRange.from, "yyyy-MM-dd"));
      if (dateRange.to) params.append("date_to", format(dateRange.to, "yyyy-MM-dd"));

      const response = await api.get(`/reports/sales?${params.toString()}`);
      setReport(response.data);
    } catch (error) {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="spinner w-8 h-8"></div>
      </div>
    );
  }

  const paymentChartData = report
    ? [
        { name: "Cash", value: report.payment_breakdown.cash || 0, color: "#10B981" },
        { name: "Card", value: report.payment_breakdown.card || 0, color: "#3B82F6" },
        { name: "Bank", value: report.payment_breakdown.bank_transfer || 0, color: "#8B5CF6" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="p-6 space-y-6" data-testid="reports-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Reports & Analytics
          </h1>
          <p className="text-slate-500 mt-1">Track your business performance</p>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2" data-testid="date-range-btn">
              <CalendarIcon className="w-4 h-4" />
              {dateRange.from && dateRange.to
                ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
                : "Select date range"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => range && setDateRange(range)}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200" data-testid="stat-total-sales">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Sales</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  ${report?.total_sales?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="stat-total-orders">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Orders</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {report?.total_orders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="stat-avg-order">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Avg Order Value</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  ${report?.average_order_value?.toFixed(2) || "0.00"}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="stat-top-items">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Top Items</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {report?.top_items?.length || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Chart */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Daily Sales Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {report?.daily_sales?.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={report.daily_sales}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => format(new Date(value), "MMM d")}
                  />
                  <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => `$${value}`} />
                  <Tooltip
                    formatter={(value) => [`$${value.toFixed(2)}`, "Sales"]}
                    labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                  />
                  <Line
                    type="monotone"
                    dataKey="sales"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    dot={{ fill: "#3B82F6", strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-slate-500">
                No sales data for selected period
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Chart */}
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Payment Methods
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentChartData.length > 0 ? (
              <div className="flex items-center gap-8">
                <ResponsiveContainer width="50%" height={250}>
                  <PieChart>
                    <Pie
                      data={paymentChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {paymentChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `$${value.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-4">
                  {paymentChartData.map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{item.name}</p>
                        <p className="text-sm text-slate-500">${item.value.toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-slate-500">
                No payment data for selected period
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Items */}
      <Card className="border-slate-200">
        <CardHeader>
          <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Top Selling Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report?.top_items?.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={report.top_items} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tickFormatter={(value) => `$${value}`} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [`$${value.toFixed(2)}`, "Revenue"]} />
                <Bar dataKey="revenue" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-slate-500">
              No items data for selected period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Breakdown Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Banknote className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Cash Payments</p>
                <p className="text-xl font-bold text-slate-800">
                  ${report?.payment_breakdown?.cash?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Card Payments</p>
                <p className="text-xl font-bold text-slate-800">
                  ${report?.payment_breakdown?.card?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Building2 className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Bank Transfers</p>
                <p className="text-xl font-bold text-slate-800">
                  ${report?.payment_breakdown?.bank_transfer?.toFixed(2) || "0.00"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
