import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QrCode, Smartphone, CheckCircle, Copy } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SecurityButton } from "@/components/ui/security-button";
import { mfaAPI } from "@/utils/api";
import { authManager } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";

export default function MFASetup() {
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string>("");
  const [totpCode, setTotpCode] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const setupMFA = async () => {
      if (!authManager.isAuthenticated()) {
        navigate('/login');
        return;
      }
      try {
        const data = await mfaAPI.setupMFA(authManager.getAccessToken()!);
        setQrCode(data.qr_code_base64);
        setSecret(data.secret);
      } catch (error: any) {
        console.error('MFA setup error:', error);
        setError(error.message || "Network error. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    setupMFA();
  }, [navigate]);

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      toast({
        title: "Copied to clipboard",
        description: "Secret key copied successfully",
      });
    } catch (error) {
      console.error('Failed to copy:', error);
      toast({
        title: "Copy failed",
        description: "Please copy the secret manually",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setError("Please enter a 6-digit code from your authenticator app");
      return;
    }

    setConfirming(true);
    setError("");
    try {
      // Verify TOTP code and enable MFA
      await mfaAPI.verifyMFA(authManager.getAccessToken()!, totpCode);
      
      toast({
        title: "MFA Setup Complete",
        description: "Your account is now secured with two-factor authentication",
      });
      navigate('/dashboard');
    } catch (error: any) {
      console.error('MFA confirm error:', error);
      setError(error.message || "Invalid code. Please try again.");
      toast({
        title: "Verification failed",
        description: error.message || "Please check your code and try again",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleSkip = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <AuthLayout title="Setting up MFA" subtitle="Please wait...">
        <div className="flex items-center justify-center py-12">
          <div className="loading-spinner" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout 
      title="Setup Two-Factor Authentication" 
      subtitle="Secure your account with an additional layer of protection"
    >
      <div className="space-y-6">
        {error && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Instructions */}
        <div className="space-y-4">
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <Smartphone className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">Step 1: Install an Authenticator App</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Download Google Authenticator, Authy, or any TOTP-compatible app on your mobile device.
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-4 rounded-lg bg-primary/10 border border-primary/20">
            <QrCode className="w-5 h-5 text-primary mt-0.5" />
            <div>
              <h3 className="font-medium text-foreground">Step 2: Scan QR Code</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Open your authenticator app and scan the QR code below, or enter the secret key manually.
              </p>
            </div>
          </div>
        </div>

        {/* QR Code */}
        {qrCode && (
          <div className="text-center">
            <div className="inline-block p-4 bg-white rounded-lg shadow-md">
              <img 
                src={`data:image/png;base64,${qrCode}`} 
                alt="MFA QR Code" 
                className="w-48 h-48 mx-auto"
              />
            </div>
          </div>
        )}

        {/* Secret Key */}
        {secret && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              Manual Entry Key
            </label>
            <div className="flex items-center space-x-2">
              <div className="flex-1 p-3 bg-muted rounded-lg font-mono text-sm text-foreground break-all">
                {secret}
              </div>
              <SecurityButton
                type="button"
                variant="outline"
                size="sm"
                onClick={copySecret}
              >
                <Copy size={16} />
              </SecurityButton>
            </div>
            <p className="text-xs text-muted-foreground">
              Use this key if you can't scan the QR code
            </p>
          </div>
        )}

        {/* TOTP Code Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Enter 6-digit code from your authenticator app
          </label>
          <input
            type="text"
            value={totpCode}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 6);
              setTotpCode(value);
              if (error) setError("");
            }}
            placeholder="123456"
            className="w-full p-3 bg-input border border-border rounded-lg text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary"
            maxLength={6}
            disabled={confirming}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col space-y-3">
          <SecurityButton
            onClick={handleConfirm}
            loading={confirming}
            disabled={confirming || totpCode.length !== 6}
            className="w-full"
          >
            <CheckCircle size={16} className="mr-2" />
            Complete MFA Setup
          </SecurityButton>

          <SecurityButton
            variant="outline"
            onClick={handleSkip}
            disabled={confirming}
            className="w-full"
          >
            Skip for Now
          </SecurityButton>
        </div>

        <div className="text-xs text-muted-foreground text-center space-y-1">
          <p>Make sure to save your backup codes in a secure location.</p>
          <p>You'll need your authenticator app to sign in from now on.</p>
        </div>
      </div>
    </AuthLayout>
  );
}