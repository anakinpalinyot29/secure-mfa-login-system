import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, RefreshCw } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SecurityButton } from "@/components/ui/security-button";
import { mfaAPI, authAPI } from "@/utils/api";
import { authManager } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";

export default function MFAVerify() {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(30);
  const navigate = useNavigate();
  const { toast } = useToast();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();

    // Countdown timer
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!authManager.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit
    if (!/^\d*$/.test(value)) return; // Only allow numbers

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all fields are filled
    if (newOtp.every(digit => digit !== "") && value) {
      handleVerify(newOtp.join(""));
    }

    // Clear error when user starts typing
    if (error) {
      setError("");
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
    
    if (pastedData.length === 6) {
      const newOtp = pastedData.split('').slice(0, 6);
      setOtp(newOtp);
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (code?: string) => {
    const verificationCode = code || otp.join("");
    
    if (verificationCode.length !== 6) {
      setError("Please enter a complete 6-digit code");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Check if we have stored login credentials (from login flow)
      const storedEmail = sessionStorage.getItem('tempLoginEmail');
      const storedPassword = sessionStorage.getItem('tempLoginPassword');
      
      if (storedEmail && storedPassword) {
        // This is a login flow - attempt login with TOTP code
        const loginData = await authAPI.login({
          email: storedEmail,
          password: storedPassword,
          totp_code: verificationCode
        });
        
        if (loginData && loginData.access_token) {
          // Clear stored credentials
          sessionStorage.removeItem('tempLoginEmail');
          sessionStorage.removeItem('tempLoginPassword');
          
          // Set tokens and navigate to dashboard
          authManager.setTokens({
            accessToken: loginData.access_token,
            refreshToken: loginData.refresh_token,
            tokenType: loginData.token_type,
            expiresIn: loginData.expires_in,
          });
          
          toast({
            title: "Login successful",
            description: "Welcome back!",
          });
          navigate('/dashboard');
        } else {
          throw new Error("Login failed");
        }
      } else {
        // This is a regular MFA verification (not from login)
        await mfaAPI.verifyMFA(authManager.getAccessToken()!, verificationCode);
        toast({
          title: "Verification successful",
          description: "Access granted to your account",
        });
        navigate('/dashboard');
      }
    } catch (error: any) {
      setError(error.message || "Invalid verification code");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
      
      toast({
        title: "Verification failed",
        description: error.message || "Please check your code and try again",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      const response = await authManager.refreshMFA();
      if (response.ok) {
        setTimeLeft(30);
        toast({
          title: "Code refreshed",
          description: "Please check your authenticator app for the latest code",
        });
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast({
        title: "Refresh failed",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <AuthLayout 
      title="Verify Your Identity" 
      subtitle="Enter the 6-digit code from your authenticator app"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="flex items-center justify-center space-x-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <Shield className="w-5 h-5 text-primary" />
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">
              Open your authenticator app
            </p>
            <p className="text-xs text-muted-foreground">
              Enter the current 6-digit code
            </p>
          </div>
        </div>

        {/* OTP Input */}
        <div className="space-y-4">
          <div className="flex justify-center space-x-3">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={el => inputRefs.current[index] = el}
                type="text"
                inputMode="numeric"
                pattern="\d{1}"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-lg font-semibold bg-input border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-all"
                disabled={loading}
              />
            ))}
          </div>
        </div>

        {/* Timer and Resend */}
        <div className="text-center space-y-3">
          <div className="text-sm text-muted-foreground">
            Code expires in: <span className="font-mono font-semibold">{timeLeft}s</span>
          </div>
          
          <SecurityButton
            variant="ghost"
            size="sm"
            onClick={handleResend}
            disabled={timeLeft > 0}
          >
            <RefreshCw size={16} className="mr-2" />
            Get New Code
          </SecurityButton>
        </div>

        {/* Manual Submit */}
        <SecurityButton
          onClick={() => handleVerify()}
          loading={loading}
          disabled={loading || otp.some(digit => digit === "")}
          className="w-full"
        >
          Verify Code
        </SecurityButton>

        <div className="text-center">
          <SecurityButton
            variant="ghost"
            onClick={() => {
              authManager.clearAuth();
              navigate('/login');
            }}
          >
            Sign in with different account
          </SecurityButton>
        </div>
      </div>
    </AuthLayout>
  );
}