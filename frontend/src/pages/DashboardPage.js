import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import api from "@/lib/api";
import { useSettings } from "@/context/SettingsContext";
import {
  DollarSign,
  ShoppingCart,
  Clock,
  CheckCircle,
  Users,
  ArrowRight,
  TrendingUp,
  Package
} from "lucide-react";

const statusColors = {
  cleaning: "bg-blue-100 text-blue-800",
  ready: "bg-green-100 text-green-800",
  out_for_delivery: "bg-amber-100 text-amber-800",
  delivered: "bg-purple-100 text-purple-800",
  collected: "bg-slate-100 text-slate-800",
  cancelled: "bg-red-100 text-red-800"
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const { formatCurrency } = useSettings();

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await api.get("/reports/dashboard");
      setStats(response.data);
    } catch (error) {
      console.error("Error fetching dashboard:", error);
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

  return (
    <div className="p-6 space-y-6" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Overview of your business performance</p>
        </div>
        <Link to="/pos">
          <Button className="bg-blue-500 hover:bg-blue-600" data-testid="new-order-btn">
            <ShoppingCart className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200" data-testid="stat-today-revenue">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Today's Revenue</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {formatCurrency(stats?.today_revenue || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="stat-today-orders">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Today's Orders</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {stats?.today_orders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="stat-pending-orders">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Pending Orders</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {stats?.pending_orders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200" data-testid="stat-ready-orders">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500 font-medium">Ready for Pickup</p>
                <p className="text-3xl font-bold text-slate-800 mt-1" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {stats?.ready_orders || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link to="/pos" className="block">
              <Button variant="outline" className="w-full justify-start h-12" data-testid="quick-new-order">
                <ShoppingCart className="w-4 h-4 mr-3 text-blue-500" />
                Create New Order
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/customers" className="block">
              <Button variant="outline" className="w-full justify-start h-12" data-testid="quick-customers">
                <Users className="w-4 h-4 mr-3 text-green-500" />
                Manage Customers
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/orders" className="block">
              <Button variant="outline" className="w-full justify-start h-12" data-testid="quick-orders">
                <Package className="w-4 h-4 mr-3 text-amber-500" />
                View All Orders
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
            <Link to="/reports" className="block">
              <Button variant="outline" className="w-full justify-start h-12" data-testid="quick-reports">
                <TrendingUp className="w-4 h-4 mr-3 text-purple-500" />
                View Reports
                <ArrowRight className="w-4 h-4 ml-auto" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="border-slate-200 lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
              Recent Orders
            </CardTitle>
            <Link to="/orders">
              <Button variant="ghost" size="sm" data-testid="view-all-orders">
                View All
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {stats?.recent_orders?.length > 0 ? (
              <div className="space-y-3">
                {stats.recent_orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
                    data-testid={`recent-order-${order.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 font-mono text-sm">
                          {order.order_number}
                        </p>
                        <p className="text-sm text-slate-500">{order.customer_name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={statusColors[order.status]}>
                        {order.status.replace("_", " ")}
                      </Badge>
                      <p className="text-sm font-semibold text-slate-800 mt-1">
                        ${order.total.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                <p>No recent orders</p>
                <Link to="/pos">
                  <Button variant="link" className="mt-2">
                    Create your first order
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customers Summary */}
      <Card className="border-slate-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium">Total Customers</p>
                <p className="text-2xl font-bold text-slate-800" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {stats?.total_customers || 0}
                </p>
              </div>
            </div>
            <Link to="/customers">
              <Button variant="outline" data-testid="manage-customers-btn">
                Manage Customers
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
