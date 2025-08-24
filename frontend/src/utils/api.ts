// src/utils/api.ts
// src/utils/api.ts
// src/utils/api.ts
const getApiUrl = () => {
  // ตรวจสอบว่ามี VITE_API_URL หรือไม่
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // ถ้าไม่มี ให้ใช้ตาม environment
  if (import.meta.env.MODE === 'production') {
    return 'https://secure-mfa-api.onrender.com';
  }
  
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiUrl();

// Debug: แสดงค่า API_BASE_URL เพื่อตรวจสอบ
console.log('🔍 API_BASE_URL:', API_BASE_URL);
console.log('🔍 All env vars:', import.meta.env);

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
  
  // Debug: แสดง URL ที่จะเรียก
  console.log('🌐 API Call URL:', url);
  
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
    console.error('❌ API call failed:', error);
    console.error('❌ Failed URL:', url);
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