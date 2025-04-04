import { create } from 'zustand';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

interface User {
  _id: string;
  name: string;
  email: string;
  isVerified: boolean;
  token: string;
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
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Initialize state from localStorage (if available)
const getInitialState = () => {
  if (typeof window === 'undefined') {
    return { user: null, token: null };
  }
  
  try {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    
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
    
    setToken: (newToken: string) => {
      // Store token in localStorage
      localStorage.setItem('token', newToken);
      
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
        set({ isLoading: true, error: null });
        
        // Make login request
        const response = await axios.post(`${API_URL}/auth/login`, { email, password });
        const userData = response.data;
        
        // Store user data and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userData.token);
        
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
        const message = error.response?.data?.error 
          || error.response?.data?.message 
          || 'An error occurred during login';
          
        set({ error: message, isLoading: false });
      }
    },
    
    register: async (name: string, email: string, password: string) => {
      try {
        set({ isLoading: true, error: null });
        
        // Make registration request
        const response = await axios.post(`${API_URL}/auth/register`, { 
          name, 
          email, 
          password 
        });
        
        const userData = response.data;
        
        // Store user data and token
        localStorage.setItem('user', JSON.stringify(userData));
        localStorage.setItem('token', userData.token);
        
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
        const message = error.response?.data?.error 
          || error.response?.data?.message 
          || 'An error occurred during registration';
          
        set({ error: message, isLoading: false });
      }
    },
    
    logout: () => {
      // Clear localStorage
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      
      // Clear auth header
      delete axios.defaults.headers.common['Authorization'];
      
      // Update state
      set({ user: null, token: null });
    },
    
    clearError: () => set({ error: null })
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
    getToken 
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
    getToken
  };
}

// Create a hook for protection in client components
export function useAuthProtection() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  
  useEffect(() => {
    // If not loading and not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);
  
  return { isAuthenticated, isLoading };
} 