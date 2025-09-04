import { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SecurityInput } from "@/components/ui/security-input";
import { SecurityButton } from "@/components/ui/security-button";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/utils/api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>("");
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError("Email is required");
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError("Please enter a valid email");
      return;
    }

    setLoading(true);
    setError("");
    
    try {
      const data = await authAPI.forgotPassword(email);

      if (data) {
        setSent(true);
        toast({
          title: "Reset link sent",
          description: "Check your email for password reset instructions",
        });
      } else {
        setError(data.message || "Failed to send reset email");
        toast({
          title: "Request failed",
          description: data.message || "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError("Network error. Please try again.");
      toast({
        title: "Connection error",
        description: "Please check your internet connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout 
        title="Check Your Email" 
        subtitle="We've sent password reset instructions"
      >
        <div className="space-y-6 text-center">
          <div className="p-6 rounded-lg bg-success/10 border border-success/20">
            <Mail className="w-12 h-12 text-success mx-auto mb-4" />
            <h3 className="font-medium text-foreground mb-2">Email Sent</h3>
            <p className="text-sm text-muted-foreground">
              We've sent a password reset link to <strong>{email}</strong>. 
              Click the link in the email to reset your password.
            </p>
          </div>

          <div className="text-sm text-muted-foreground space-y-2">
            <p>Didn't receive the email? Check your spam folder.</p>
            <SecurityButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setSent(false);
                setEmail("");
              }}
            >
              Try with a different email
            </SecurityButton>
          </div>

          <Link to="/login">
            <SecurityButton variant="outline" className="w-full">
              <ArrowLeft size={16} className="mr-2" />
              Back to Login
            </SecurityButton>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Forgot Password?" 
      subtitle="Enter your email to receive reset instructions"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Email Address
            </label>
            <SecurityInput
              type="email"
              name="email"
              placeholder="Enter your email address"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
              error={error}
              icon={<Mail size={16} />}
              autoComplete="email"
              required
            />
          </div>
        </div>

        <SecurityButton
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading}
        >
          Send Reset Link
        </SecurityButton>

        <div className="text-center">
          <Link to="/login">
            <SecurityButton variant="ghost">
              <ArrowLeft size={16} className="mr-2" />
              Back to Login
            </SecurityButton>
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}