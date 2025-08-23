import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, AlertTriangle, CheckCircle } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SecurityButton } from "@/components/ui/security-button";
import { SecurityInput } from "@/components/ui/security-input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authFetch, authManager } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";

export default function MFADisable() {
  const [password, setPassword] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const user = authManager.getUser();

  if (!user?.mfaEnabled) {
    navigate('/dashboard');
    return null;
  }

  const handleDisable = () => {
    if (!password) {
      setError("Please enter your password to confirm");
      return;
    }
    setShowConfirmDialog(true);
  };

  const confirmDisable = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await authFetch('/mfa/disable', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update user MFA status
        if (user) {
          authManager.setUser({ ...user, mfaEnabled: false });
        }

        toast({
          title: "MFA Disabled",
          description: "Two-factor authentication has been disabled for your account",
        });

        navigate('/dashboard');
      } else {
        setError(data.message || "Failed to disable MFA");
        toast({
          title: "Disable failed",
          description: data.message || "Please check your password and try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('MFA disable error:', error);
      setError("Network error. Please try again.");
      toast({
        title: "Connection error",
        description: "Please check your internet connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setShowConfirmDialog(false);
    }
  };

  return (
    <>
      <AuthLayout 
        title="Disable Two-Factor Authentication" 
        subtitle="Remove the additional security layer from your account"
      >
        <div className="space-y-6">
          {error && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Warning */}
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <h3 className="font-medium text-foreground">Security Warning</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Disabling two-factor authentication will make your account less secure. 
                  Anyone with access to your email and password will be able to sign in.
                </p>
              </div>
            </div>
          </div>

          {/* Current Status */}
          <div className="p-4 rounded-lg bg-success/10 border border-success/20">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-5 h-5 text-success" />
              <div>
                <h3 className="font-medium text-foreground">Current Status</h3>
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication is currently <strong>enabled</strong> on your account
                </p>
              </div>
            </div>
          </div>

          {/* Password Confirmation */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Confirm Your Password
              </label>
              <SecurityInput
                type="password"
                name="password"
                placeholder="Enter your current password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                icon={<Shield size={16} />}
                autoComplete="current-password"
                required
              />
              <p className="text-xs text-muted-foreground mt-2">
                We need to verify your identity before disabling MFA
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-3">
            <SecurityButton
              variant="destructive"
              onClick={handleDisable}
              disabled={!password || loading}
              className="w-full"
            >
              <AlertTriangle size={16} className="mr-2" />
              Disable Two-Factor Authentication
            </SecurityButton>

            <SecurityButton
              variant="outline"
              onClick={() => navigate('/dashboard')}
              disabled={loading}
              className="w-full"
            >
              Cancel
            </SecurityButton>
          </div>
        </div>
      </AuthLayout>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="auth-card border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center text-destructive">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Confirm MFA Disable
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Are you absolutely sure you want to disable two-factor authentication? 
              This action will make your account significantly less secure.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive font-medium">
                After disabling MFA:
              </p>
              <ul className="text-xs text-destructive/80 mt-1 space-y-1 list-disc list-inside">
                <li>Only your email and password will be required to sign in</li>
                <li>Your account will be more vulnerable to unauthorized access</li>
                <li>You can re-enable MFA anytime from your security settings</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="flex space-x-2">
            <SecurityButton
              variant="outline"
              onClick={() => setShowConfirmDialog(false)}
              disabled={loading}
            >
              Cancel
            </SecurityButton>
            <SecurityButton
              variant="destructive"
              onClick={confirmDisable}
              loading={loading}
              disabled={loading}
            >
              Yes, Disable MFA
            </SecurityButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}