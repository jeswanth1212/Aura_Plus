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
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  setToken: (token: string) => void;
  getToken: () => string | null;
  checkAuth: () => Promise<boolean>;
  requiresVerification: boolean;
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

// Helper function to set cookies
const setCookie = (name: string, value: string, days: number) => {
  if (typeof document === 'undefined') return;
  
  const expires = new Date();
  expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

// Create the auth store
export const useAuthStore = create<AuthState>((set, get) => {
  // Get initial state from localStorage
  const { user, token } = getInitialState();
  
  // Setup axios with the token
  setupAxiosInterceptors(token);
  
  return {
    user,
    token,
    isLoading: false,
    error: null,
    requiresVerification: false,
    
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
      try {
        set({ isLoading: true, error: null, requiresVerification: false });
        
        // Make login request - updating URL to match server route definition
        const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
        const { success, error, message, ...userData } = response.data;
        
        if (!success) {
          set({ error: message || 'Login failed', isLoading: false });
          return;
        }
        
        // Store user data and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userData.token);
        
        // Set cookie for middleware
        setCookie('token', userData.token, 7);
        
        // Update axios auth header
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
        
        // Update state
        set({ 
          user: userData, 
          token: userData.token,
          isLoading: false 
        });
      } catch (error: any) {
        console.error('Login error:', error);
        
        // Check if verification is required
        if (error.response?.data?.requiresVerification) {
          set({ 
            requiresVerification: true,
            error: 'Email verification required. Please check your inbox.', 
            isLoading: false 
          });
          return;
        }
        
        const message = error.response?.data?.message
          || error.response?.data?.error 
          || 'An error occurred during login';
          
        set({ error: message, isLoading: false });
      }
    },
    
    register: async (name: string, email: string, password: string) => {
      try {
        set({ isLoading: true, error: null });
        
        // Make registration request - updating URL to match server route definition
        const response = await axios.post(`${API_URL}/api/auth/register`, { 
          name, 
          email, 
          password 
        });
        
        const { success, error, message, ...userData } = response.data;
        
        if (!success) {
          set({ error: message || 'Registration failed', isLoading: false });
          return;
        }
        
        // Store user data and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userData.token);
        
        // Set cookie for middleware
        setCookie('token', userData.token, 7);
        
        // Set auth header
        axios.defaults.headers.common['Authorization'] = `Bearer ${userData.token}`;
        
        // Update state
        set({ 
          user: userData, 
          token: userData.token,
          isLoading: false 
        });
      } catch (error: any) {
        console.error('Registration error:', error);
        const message = error.response?.data?.message
          || error.response?.data?.error 
          || 'An error occurred during registration';
          
        set({ error: message, isLoading: false });
      }
    },
    
    checkAuth: async () => {
      const currentToken = get().token;
      
      if (!currentToken) {
        return false;
      }
      
      try {
        set({ isLoading: true });
        // Update URL to match server route definition
        const response = await axios.get(`${API_URL}/api/auth/me`);
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

// Create a hook for using the auth store with navigation
export function useAuth() {
  const router = useRouter();
  const { 
    user, 
    token,
    isLoading, 
    error, 
    login, 
    register, 
    logout, 
    clearError,
    getToken,
    checkAuth,
    requiresVerification
  } = useAuthStore();

  // Handle logout with navigation
  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  // Check if user is authenticated
  const isAuthenticated = !!user && !!token;

  return {
    user,
    isLoading,
    error,
    login,
    register,
    logout: handleLogout,
    clearError,
    isAuthenticated,
    getToken,
    checkAuth,
    requiresVerification
  };
}

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