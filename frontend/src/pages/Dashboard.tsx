import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, User, Settings, LogOut, ShieldCheck, ShieldX } from "lucide-react";
import { SecurityButton } from "@/components/ui/security-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authManager } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";
import { authAPI } from "@/utils/api";

export default function Dashboard() {
  const [user, setUser] = useState(authManager.getUser());
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authManager.isAuthenticated()) {
      navigate('/login');
    }
  }, [navigate]);

  const handleLogout = async () => {
    setLoading(true);

    try {
      await authAPI.logout(authManager.getAccessToken());
    } catch (error) {
      console.error('Logout error:', error);
    }

    authManager.clearAuth();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out",
    });
    navigate('/login');
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Security Dashboard</h1>
                <p className="text-sm text-muted-foreground">Manage your account security</p>
              </div>
            </div>
            
            <SecurityButton
              variant="outline"
              onClick={handleLogout}
              loading={loading}
              disabled={loading}
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </SecurityButton>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* User Info Card */}
          <Card className="auth-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2 text-primary" />
                Account Information
              </CardTitle>
              <CardDescription>Your account details and status</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-foreground">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Account ID</label>
                <p className="text-foreground font-mono text-sm">{user.id}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-success"></div>
                  <span className="text-success text-sm font-medium">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* MFA Status Card */}
          <Card className="auth-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                {user.mfaEnabled ? (
                  <ShieldCheck className="w-5 h-5 mr-2 text-success" />
                ) : (
                  <ShieldX className="w-5 h-5 mr-2 text-warning" />
                )}
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                {user.mfaEnabled 
                  ? "Your account is protected with 2FA" 
                  : "Add an extra layer of security"
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${user.mfaEnabled ? 'bg-success' : 'bg-warning'}`}></div>
                <span className={`text-sm font-medium ${user.mfaEnabled ? 'text-success' : 'text-warning'}`}>
                  {user.mfaEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              <div className="space-y-2">
                {user.mfaEnabled ? (
                  <SecurityButton
                    variant="destructive"
                    size="sm"
                    onClick={() => navigate('/mfa/disable')}
                    className="w-full"
                  >
                    Disable MFA
                  </SecurityButton>
                ) : (
                  <SecurityButton
                    variant="primary"
                    size="sm"
                    onClick={() => navigate('/mfa/setup')}
                    className="w-full"
                  >
                    Enable MFA
                  </SecurityButton>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Security Settings Card */}
          <Card className="auth-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Settings className="w-5 h-5 mr-2 text-primary" />
                Security Settings
              </CardTitle>
              <CardDescription>Manage your security preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <SecurityButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Feature coming soon",
                      description: "Password change functionality will be available soon",
                    });
                  }}
                  className="w-full"
                >
                  Change Password
                </SecurityButton>
                
                <SecurityButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Feature coming soon",
                      description: "Activity log will be available soon",
                    });
                  }}
                  className="w-full"
                >
                  View Login History
                </SecurityButton>
                
                <SecurityButton
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    toast({
                      title: "Feature coming soon",
                      description: "Session management will be available soon",
                    });
                  }}
                  className="w-full"
                >
                  Manage Sessions
                </SecurityButton>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security Tips */}
        <div className="mt-8">
          <Card className="auth-card">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="w-5 h-5 mr-2 text-primary" />
                Security Recommendations
              </CardTitle>
              <CardDescription>Keep your account secure with these tips</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Enable Two-Factor Authentication</h4>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security with TOTP-based authentication.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Use a Strong Password</h4>
                  <p className="text-sm text-muted-foreground">
                    Choose a unique, complex password that's not used elsewhere.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Monitor Account Activity</h4>
                  <p className="text-sm text-muted-foreground">
                    Regularly check your login history for suspicious activity.
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <h4 className="font-medium text-foreground mb-2">Keep Software Updated</h4>
                  <p className="text-sm text-muted-foreground">
                    Always use the latest version of your authenticator app.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}