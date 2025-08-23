import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SecurityInput } from "@/components/ui/security-input";
import { SecurityButton } from "@/components/ui/security-button";
import { Checkbox } from "@/components/ui/checkbox";
import { authManager } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";

export default function Signup() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    enableMFA: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 8) {
      newErrors.password = "Password must be at least 8 characters";
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          enableMFA: formData.enableMFA,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast({
          title: "Account created successfully",
          description: "Please sign in with your new credentials",
        });

        // If MFA is enabled, redirect to MFA setup
        if (formData.enableMFA && data.requiresMFASetup) {
          authManager.setTokens(data.tokens);
          authManager.setUser(data.user);
          navigate('/mfa/setup');
        } else {
          navigate('/login');
        }
      } else {
        setErrors({ general: data.message || "Signup failed" });
        toast({
          title: "Signup failed",
          description: data.message || "Please try again",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Signup error:', error);
      setErrors({ general: "Network error. Please try again." });
      toast({
        title: "Connection error",
        description: "Please check your internet connection",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout 
      title="Create Account" 
      subtitle="Join our secure platform"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {errors.general && (
          <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-sm text-destructive">{errors.general}</p>
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
              placeholder="Enter your email"
              value={formData.email}
              onChange={handleChange}
              error={errors.email}
              icon={<Mail size={16} />}
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <div className="relative">
              <SecurityInput
                type={showPassword ? "text" : "password"}
                name="password"
                placeholder="Create a secure password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                icon={<Lock size={16} />}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <SecurityInput
                type={showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                icon={<Lock size={16} />}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-3 p-4 rounded-lg bg-muted/30 border border-border">
            <Checkbox
              id="enableMFA"
              name="enableMFA"
              checked={formData.enableMFA}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, enableMFA: !!checked }))
              }
            />
            <div className="flex-1">
              <label htmlFor="enableMFA" className="text-sm font-medium text-foreground cursor-pointer flex items-center">
                <Shield size={16} className="mr-2 text-primary" />
                Enable Multi-Factor Authentication (MFA)
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                Add an extra layer of security to your account
              </p>
            </div>
          </div>
        </div>

        <SecurityButton
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading}
        >
          Create Account
        </SecurityButton>

        <div className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link 
            to="/login" 
            className="text-primary hover:text-primary-hover transition-colors font-medium"
          >
            Sign in here
          </Link>
        </div>
      </form>
    </AuthLayout>
  );
}