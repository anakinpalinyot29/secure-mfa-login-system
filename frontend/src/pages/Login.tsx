import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { AuthLayout } from "@/components/auth/auth-layout";
import { SecurityInput } from "@/components/ui/security-input";
import { SecurityButton } from "@/components/ui/security-button";
import { authManager } from "@/utils/auth";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const response = await fetch('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        authManager.setTokens(data.tokens);
        authManager.setUser(data.user);
        
        toast({
          title: "Login successful",
          description: "Welcome back!",
        });

        // Check if MFA is required
        if (data.requiresMFA) {
          navigate('/mfa/verify');
        } else {
          navigate('/dashboard');
        }
      } else {
        setErrors({ general: data.message || "Login failed" });
        toast({
          title: "Login failed", 
          description: data.message || "Please check your credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Login error:', error);
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
      title="Welcome Back" 
      subtitle="Sign in to your secure account"
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
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                icon={<Lock size={16} />}
                autoComplete="current-password"
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
        </div>

        <SecurityButton
          type="submit"
          className="w-full"
          loading={loading}
          disabled={loading}
        >
          Sign In
        </SecurityButton>

        <div className="text-center space-y-4">
          <Link 
            to="/forgot-password" 
            className="text-sm text-primary hover:text-primary-hover transition-colors"
          >
            Forgot your password?
          </Link>
          
          <div className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link 
              to="/signup" 
              className="text-primary hover:text-primary-hover transition-colors font-medium"
            >
              Sign up here
            </Link>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}