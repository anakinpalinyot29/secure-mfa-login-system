// src/utils/api.ts
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiOptions extends RequestInit {
  headers?: Record<string, string>;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  access_token?: string;
  user?: any;
}

interface MFASetupResponse {
  qr_code: string;
  secret: string;
}

// Helper function สำหรับ API calls
export const apiCall = async <T = any>(
  endpoint: string, 
  options: ApiOptions = {}
): Promise<T> => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: ApiOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
  };

  const finalOptions: ApiOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, finalOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// Auth API functions
export const authAPI = {
  login: async (credentials: LoginRequest): Promise<ApiResponse> => {
    return apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: async (userData: RegisterRequest): Promise<ApiResponse> => {
    return apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  logout: async (): Promise<ApiResponse> => {
    return apiCall('/auth/logout', {
      method: 'POST',
    });
  },

  getProfile: async (token: string): Promise<ApiResponse> => {
    return apiCall('/auth/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },
};

// MFA API functions
export const mfaAPI = {
  setupMFA: async (token: string): Promise<MFASetupResponse> => {
    return apiCall('/mfa/setup', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
  },

  verifyMFA: async (token: string, totpCode: string): Promise<ApiResponse> => {
    return apiCall('/mfa/verify', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ totp_code: totpCode }),
    });
  },

  disableMFA: async (token: string, totpCode: string): Promise<ApiResponse> => {
    return apiCall('/mfa/disable', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ totp_code: totpCode }),
    });
  },
};

export default { apiCall, authAPI, mfaAPI };