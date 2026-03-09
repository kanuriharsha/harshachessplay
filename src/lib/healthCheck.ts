// Health check utility to wake up backend on Render free tier

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

export const pingHealth = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Health check successful:', data);
      return true;
    }
    
    console.warn('Health check failed with status:', response.status);
    return false;
  } catch (error) {
    console.error('Health check error:', error);
    return false;
  }
};

// Automatically ping health on import (for critical pages like login/dashboard)
export const initHealthCheck = () => {
  pingHealth();
};
