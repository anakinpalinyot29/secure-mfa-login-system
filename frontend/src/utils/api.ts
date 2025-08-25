// src/utils/api.ts

// ปรับปรุงการตั้งค่า API URL ให้ปลอดภัยและชัดเจนขึ้น
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_URL;
  
  // ตรวจสอบว่ามี env var และไม่ใช่ string ว่าง
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/$/, ''); // ลบ slash ท้าย
  }
  
  // Fallback ตาม environment
  const baseUrl = import.meta.env.MODE === 'production' 
    ? 'https://secure-mfa-api.onrender.com'
    : 'http://localhost:8000';
    
  return baseUrl.replace(/\/$/, ''); // ลบ slash ท้ายเสมอ
};

const API_BASE_URL = getApiBaseUrl();

// Debug logging (เฉพาะ development)
if (import.meta.env.DEV) {
  console.log('🔍 API_BASE_URL:', API_BASE_URL);
  console.log('🔍 Environment:', import.meta.env.MODE);
  console.log('🔍 VITE_API_URL:', import.meta.env.VITE_API_URL);
}

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
  full_name?: string; // Optional field
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

// ✅ แก้ interface ให้ตรงกับ backend response
interface MFASetupResponse {
  qr_code_base64: string;  // Backend ส่งมาเป็น qr_code_base64
  backup_codes: string[];  // Backend ส่ง backup codes มาด้วย
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
  // ปรับปรุงการสร้าง URL ให้ปลอดภัยขึ้น
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${normalizedEndpoint}`;
  
  if (import.meta.env.DEV) {
    console.log('🌐 API Call:', options.method || 'GET', url);
  }
  
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
    const response = await fetch(url, finalOptions);
    
    // อ่าน response body ก่อนตรวจสอบ status
    let responseData: any = {};
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      responseData = { message: text };
    }
    
    if (!response.ok) {
      const errorMessage = responseData?.detail || 
                          responseData?.message || 
                          `HTTP ${response.status}: ${response.statusText}`;
      
      if (import.meta.env.DEV) {
        console.error('❌ API Error:', {
          url,
          status: response.status,
          statusText: response.statusText,
          error: responseData
        });
      }
      
      throw new ApiError(errorMessage, response.status, responseData);
    }
    
    return responseData as T;
    
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (import.meta.env.DEV) {
      console.error('❌ Network Error:', {
        url,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    // Network หรือ parsing errors
    throw new ApiError(
      error instanceof Error ? error.message : 'Network error occurred',
      0,
      null
    );
  }
};

// ===== Auth API =====
export const authAPI = {
  login: (credentials: LoginRequest): Promise<ApiResponse> =>
    apiCall<ApiResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  // ✅ แก้เป็น /auth/signup ให้ตรงกับ backend
  register: (userData: RegisterRequest): Promise<ApiResponse> =>
    apiCall<ApiResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

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

  // เพิ่ม error handling สำหรับกรณีที่ backend ยังไม่มี endpoint นี้
  getProfile: (token: string): Promise<ApiResponse> =>
    apiCall<ApiResponse>('/auth/me', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
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

// Export default
export default { apiCall, authAPI, mfaAPI, isApiError, getErrorMessage };