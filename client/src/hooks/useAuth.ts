import { create } from 'zustand';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  isVerified: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; requiresVerification?: boolean; userData?: any }>;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string; userData?: any }>;
  logout: () => void;
  clearError: () => void;
  setToken: (token: string) => void;
  getToken: () => string | null;
  checkAuth: () => Promise<boolean>;
  requiresVerification: boolean;
  isAuthenticated: boolean;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Get cookie value
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;
  
  const cookieValue = document.cookie
    .split('; ')
    .find(row => row.startsWith(`${name}=`))
    ?.split('=')[1];
    
  return cookieValue || null;
};

// Initialize state from localStorage (if available)
const getInitialState = () => {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }
  
  try {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token') || getCookie('token');
    
    // If token exists in cookie but not in localStorage, store it
    if (getCookie('token') && !localStorage.getItem('token')) {
      localStorage.setItem('token', getCookie('token') || '');
    }
    
    return { 
      user: storedUser ? JSON.parse(storedUser) : null,
      token: storedToken
    };
  } catch (e) {
    console.error('Failed to parse stored authentication data:', e);
    return { user: null, token: null };
  }
};

// Setup axios interceptors
const setupAxiosInterceptors = (token: string | null) => {
  // Set default auth header if token exists
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
  
  // Response interceptor for handling auth errors
  axios.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        // Clear auth data on 401 Unauthorized errors
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        
        // Force refresh the page to reset the app state
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );
};

// Set cookie with expiration date
const setCookie = (name: string, value: string, days = 7) => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${date.toUTCString()};path=/`;
};

// Create the auth store
export const useAuthStore = create<AuthState>((set, get) => {
  // Initialize state from localStorage if available
  const storedUser = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
  const storedToken = typeof localStorage !== 'undefined' ? localStorage.getItem('token') : null;
  
  const user = storedUser ? JSON.parse(storedUser) : null;
  const token = storedToken || null;
  
  // Setup axios with the token
  setupAxiosInterceptors(token);
  
  return {
    user,
    token,
    isLoading: false,
    error: null,
    requiresVerification: false,
    isAuthenticated: !!user && !!token,
    
    setToken: (newToken: string) => {
      // Store token in localStorage
      localStorage.setItem('token', newToken);
      
      // Also store as cookie for middleware access
      setCookie('token', newToken, 7); // Store for 7 days
      
      // Update axios headers
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      // Update state
      set({ token: newToken });
    },
    
    getToken: () => {
      return get().token;
    },
    
    login: async (email: string, password: string) => {
      set({ isLoading: true, error: null });
      console.log("Login attempt for:", email);
      
      try {
        const response = await axios.post(`${API_URL}/auth/login`, { email, password });
        console.log("Login response:", response.data);
        
        // If the login is successful
        if (response.data.success) {
          const userData = response.data;
          
          // Check if email is verified
          if (!userData.isVerified) {
            set({ 
              isLoading: false, 
              error: 'Please verify your email before logging in',
              requiresVerification: true 
            });
            return { 
              success: false, 
              error: 'Please verify your email before logging in',
              requiresVerification: true
            };
          }
          
          // Store token and user data
          localStorage.setItem('token', userData.token);
          localStorage.setItem('user', JSON.stringify(userData));
          
          // Set auth header for all future requests
          axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
          
          set({ 
            user: userData, 
            token: userData.token, 
            isLoading: false,
            isAuthenticated: true,
            error: null
          });
          
          // Set cookie for SSR
          setCookie('token', userData.token);
          
          return { success: true, userData };
        } else {
          const errorMsg = response.data.message || 'Login failed';
          set({ isLoading: false, error: errorMsg });
          return { success: false, error: errorMsg };
        }
      } catch (err: any) {
        console.error("Login error:", err);
        
        let errorMessage = 'Failed to login';
        
        // Handle different types of errors
        if (err.response) {
          // Server responded with an error
          if (err.response.data && err.response.data.message) {
            errorMessage = err.response.data.message;
          } else if (err.response.status === 401) {
            errorMessage = 'Invalid email or password';
          } else if (err.response.status === 403) {
            // Check if it's due to email verification
            if (err.response.data && !err.response.data.isVerified) {
              set({ 
                isLoading: false, 
                error: 'Please verify your email before logging in',
                requiresVerification: true 
              });
              return { 
                success: false, 
                error: 'Please verify your email before logging in',
                requiresVerification: true
              };
            }
            errorMessage = 'Access denied';
          }
        } else if (err.request) {
          // No response received
          errorMessage = 'No response from server. Please check your internet connection.';
        }
        
        set({ isLoading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }
    },
    
    register: async (name: string, email: string, password: string) => {
      try {
        set({ isLoading: true, error: null });
        
        console.log('Attempting registration for:', email);
        
        // Make registration request
        const response = await axios.post(`${API_URL}/auth/register`, { 
          name, 
          email, 
          password 
        });
        
        console.log('Registration API response:', response.data);
        
        const { success, error, message, ...userData } = response.data;
        
        if (!success) {
          const errorMsg = message || 'Registration failed';
          console.error('Registration failed:', errorMsg);
          set({ error: errorMsg, isLoading: false });
          return { success: false, error: errorMsg };
        }
        
        // Store user data and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userData.token);
        
        // Set cookie for middleware
        setCookie('token', userData.token, 7);
        
        // Set auth header
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
        
        console.log('Registration successful');
        
        // Update state
        set({ 
          user: userData, 
          token: userData.token,
          isLoading: false 
        });
        
        return { success: true, userData };
      } catch (error: any) {
        console.error('Registration error:', error);
        
        // Check if it's a network error
        if (error.code === 'ERR_NETWORK') {
          set({ 
            error: 'Cannot connect to the server. Please check your internet connection.', 
            isLoading: false 
          });
          return { 
            success: false, 
            error: 'Cannot connect to the server. Please check your internet connection.' 
          };
        }
        
        const message = error.response?.data?.message
          || error.response?.data?.error 
          || 'An error occurred during registration';
          
        set({ error: message, isLoading: false });
        return { success: false, error: message };
      }
    },
    
    checkAuth: async () => {
      const currentToken = get().token;
      
      if (!currentToken) {
        return false;
      }
      
      try {
        set({ isLoading: true });
        const response = await axios.get(`${API_URL}/auth/me`);
        const { success, ...userData } = response.data;
        
        if (!success) {
          set({ user: null, isLoading: false });
          return false;
        }
        
        // Update user data
        localStorage.setItem('user', JSON.stringify(userData));
        set({ user: userData, isLoading: false });
        return true;
      } catch (error) {
        console.error('Auth check error:', error);
        set({ user: null, token: null, isLoading: false });
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
        return false;
      }
    },
    
    logout: () => {
      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      // Clear cookie
      document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      
      // Clear auth header
      delete axios.defaults.headers.common['Authorization'];
      
      // Update state
      set({ user: null, token: null });
    },
    
    clearError: () => set({ error: null, requiresVerification: false })
  };
});

// Custom hook to use the auth store
export const useAuth = () => {
  const { 
    user, 
    token, 
    isLoading, 
    error, 
    login, 
    register, 
    logout, 
    clearError, 
    setToken, 
    getToken,
    checkAuth,
    requiresVerification,
    isAuthenticated
  } = useAuthStore();

  return { 
    user, 
    token, 
    isLoading, 
    error, 
    login, 
    register, 
    logout, 
    clearError, 
    setToken, 
    getToken,
    checkAuth,
    requiresVerification,
    isAuthenticated
  };
};

// Create a hook for protection in client components
export function useAuthProtection(requireVerification = true) {
  const router = useRouter();
  const { isAuthenticated, isLoading, user, requiresVerification } = useAuth();
  
  useEffect(() => {
    // Don't do anything while loading
    if (isLoading) return;

    // If not authenticated, redirect to login
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    
    // If verification is required and user is not verified, redirect to verification page
    if (requireVerification && user && !user.isVerified) {
      router.push('/verification-required');
    }
  }, [isAuthenticated, isLoading, router, user, requireVerification]);
  
  return { isAuthenticated, isLoading, user, requiresVerification };
}