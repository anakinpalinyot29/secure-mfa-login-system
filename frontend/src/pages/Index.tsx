import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authManager } from "@/utils/auth";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect based on authentication status
    if (authManager.isAuthenticated()) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="loading-spinner" />
    </div>
  );
};

export default Index;
