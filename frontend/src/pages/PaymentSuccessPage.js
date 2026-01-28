import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import api from "@/lib/api";
import { CheckCircle, XCircle, Loader2, Home } from "lucide-react";

export default function PaymentSuccessPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("checking"); // checking, success, failed
  const [paymentData, setPaymentData] = useState(null);

  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (sessionId) {
      pollPaymentStatus();
    } else {
      setStatus("failed");
    }
  }, [sessionId]);

  const pollPaymentStatus = async (attempts = 0) => {
    const maxAttempts = 5;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setStatus("failed");
      toast.error("Payment verification timed out");
      return;
    }

    try {
      // Check if we have a token
      const token = localStorage.getItem("token");
      if (token) {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      }

      const response = await api.get(`/payments/status/${sessionId}`);
      setPaymentData(response.data);

      if (response.data.payment_status === "paid") {
        setStatus("success");
        toast.success("Payment successful!");
        return;
      } else if (response.data.status === "expired") {
        setStatus("failed");
        toast.error("Payment session expired");
        return;
      }

      // Continue polling
      setTimeout(() => pollPaymentStatus(attempts + 1), pollInterval);
    } catch (error) {
      console.error("Error checking payment status:", error);
      if (attempts < maxAttempts - 1) {
        setTimeout(() => pollPaymentStatus(attempts + 1), pollInterval);
      } else {
        setStatus("failed");
        toast.error("Failed to verify payment");
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" data-testid="payment-success-page">
      <Card className="w-full max-w-md border-slate-200">
        <CardContent className="p-8 text-center">
          {status === "checking" && (
            <>
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <h1
                className="text-2xl font-bold text-slate-800 mb-2"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Processing Payment
              </h1>
              <p className="text-slate-500 mb-6">
                Please wait while we confirm your payment...
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h1
                className="text-2xl font-bold text-slate-800 mb-2"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Payment Successful!
              </h1>
              <p className="text-slate-500 mb-2">
                Your payment has been processed successfully.
              </p>
              {paymentData && (
                <p className="text-lg font-bold text-green-600 mb-6">
                  ${(paymentData.amount_total / 100).toFixed(2)} {paymentData.currency?.toUpperCase()}
                </p>
              )}
              <Button
                onClick={() => navigate("/orders")}
                className="bg-green-600 hover:bg-green-700"
                data-testid="view-orders-btn"
              >
                View Orders
              </Button>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1
                className="text-2xl font-bold text-slate-800 mb-2"
                style={{ fontFamily: "Manrope, sans-serif" }}
              >
                Payment Failed
              </h1>
              <p className="text-slate-500 mb-6">
                We couldn't verify your payment. Please try again or contact support.
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/pos")} data-testid="retry-btn">
                  Try Again
                </Button>
                <Button onClick={() => navigate("/dashboard")} data-testid="go-home-btn">
                  <Home className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
