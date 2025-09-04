// src/utils/api.ts

// 🔥 บังคับใช้ production URL - แก้ปัญหาทันที
const API_BASE_URL = 'https://secure-mfa-api.onrender.com';

// Debug: แสดงให้เห็นว่าใช้ URL อะไร
console.log('🔥 FORCED API_BASE_URL:', API_BASE_URL);
console.log('🔍 Original env VITE_API_URL:', import.meta.env.VITE_API_URL);
console.log('🔍 Environment MODE:', import.meta.env.MODE);

// แสดงทุก env vars เพื่อ debug
console.log('🔍 All env vars:', import.meta.env);

// ===== Type Definitions =====
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
  full_name?: string;
}

interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  access_token?: string;
  refresh_token?: string;
  user?: any;
  mfa_enabled?: boolean;
  requires_mfa?: boolean;
}

interface MFASetupResponse {
  qr_code_base64: string;
  backup_codes: string[];
  secret: string;
}

interface MFAVerifyRequest {
  totp_code: string;
}

// ===== Custom Error Class =====
class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ===== Core API Function =====
export const apiCall = async <T = any>(
  endpoint: string, 
  options: ApiOptions = {}
): Promise<T> => {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;
  
  // Debug: แสดง URL ที่จะเรียกจริง
  console.log('🌐 API Call URL:', url);
  console.log('🌐 Method:', options.method || 'GET');
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    credentials: 'include',
  };

  const finalOptions: RequestInit = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    console.log('🚀 Making request to:', url);
    const response = await fetch(url, finalOptions);
    
    console.log('📡 Response status:', response.status);
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));
    
    // อ่าน response body
    let responseData: any = {};
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      console.log('📄 Response text:', text);
      responseData = { message: text };
    }
    
    if (!response.ok) {
      const errorMessage = responseData?.detail || 
                          responseData?.message || 
                          `HTTP ${response.status}: ${response.statusText}`;
      
      console.error('❌ API Error:', {
        url,
        status: response.status,
        statusText: response.statusText,
        error: responseData
      });
      
      throw new ApiError(errorMessage, response.status, responseData);
    }
    
    console.log('✅ API Success:', responseData);
    return responseData as T;
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error('❌ Network Error:', {
      url,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error occurred',
      0,
      null
    );
  }
};

// ===== Auth API =====
export const authAPI = {
  login: (credentials: LoginRequest): Promise<ApiResponse> => {
    console.log('🔐 Login attempt with:', { email: credentials.email });
    return apiCall<ApiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  register: (userData: RegisterRequest): Promise<ApiResponse> => {
    console.log('📝 Register attempt with:', { email: userData.email });
    return apiCall<ApiResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  logout: (token?: string): Promise<ApiResponse> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    
    return apiCall<ApiResponse>('/auth/logout', {
      method: 'POST',
      headers,
    });
  },

  getProfile: (token: string): Promise<ApiResponse> =>
    apiCall<ApiResponse>('/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),

  forgotPassword: (email: string): Promise<ApiResponse> => {
    return apiCall<ApiResponse>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

// ===== MFA API =====
export const mfaAPI = {
  setupMFA: (token: string): Promise<MFASetupResponse> =>
    apiCall<MFASetupResponse>('/mfa/setup', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),

  verifyMFA: (token: string, totpCode: string): Promise<ApiResponse> =>
    apiCall<ApiResponse>('/mfa/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ totp_code: totpCode } as MFAVerifyRequest),
    }),

  disableMFA: (token: string, totpCode: string): Promise<ApiResponse> =>
    apiCall<ApiResponse>('/mfa/disable', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ totp_code: totpCode } as MFAVerifyRequest),
    }),
};

// ===== Utility Functions =====
export const isApiError = (error: unknown): error is ApiError => {
  return error instanceof ApiError;
};

export const getErrorMessage = (error: unknown): string => {
  if (isApiError(error)) {
    return error.message;
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  return 'An unexpected error occurred';
};

export default { apiCall, authAPI, mfaAPI, isApiError, getErrorMessage };