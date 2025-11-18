// src/context/AuthContext.tsx
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from "react"; // 1. Importe useCallback
import { setCookie, parseCookies, destroyCookie } from "nookies";
import { useNavigate, useLocation } from "react-router-dom";
import axios from "axios";
import { API_URL } from "@/config/BackendUrl";

// Interface do Usuário (atualizada)
interface User {
  _id: string;
  name: string;
  email: string;
  stripeAccountId?: string;
  stripeOnboardingComplete: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // 2. Estabilize 'fetchUser' com useCallback
  const fetchUser = useCallback(
    async (authToken: string) => {
      try {
        axios.defaults.headers.common["Authorization"] = `Bearer ${authToken}`;
        const response = await axios.get(`${API_URL}/auth/me`);
        setUser(response.data);
      } catch (error) {
        // Token inválido
        destroyCookie(null, "auth_token", { path: "/" });
        setToken(null);
        setUser(null);
        delete axios.defaults.headers.common["Authorization"];
        navigate("/login", { state: { from: location }, replace: true });
      }
    },
    [navigate, location]
  ); // Dependências: navigate, location

  // 3. Estabilize 'refreshUser' com useCallback
  const refreshUser = useCallback(async () => {
    if (token) {
      await fetchUser(token);
    }
  }, [token, fetchUser]); // Dependências: token, fetchUser

  // 4. Estabilize 'login' com useCallback
  const login = useCallback(
    async (email: string, password: string) => {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token } = response.data;

      setCookie(null, "auth_token", token, {
        maxAge: 7 * 24 * 60 * 60,
        path: "/",
      });
      setToken(token);

      await fetchUser(token);

      const from = location.state?.from?.pathname || "/";
      navigate(from, { replace: true });
    },
    [fetchUser, location, navigate]
  ); // Dependências: fetchUser, location, navigate

  // 5. Estabilize 'logout' com useCallback
  const logout = useCallback(() => {
    destroyCookie(null, "auth_token", { path: "/" });
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
    navigate("/login");
  }, [navigate]); // Dependência: navigate

  // Efeito principal (para carregar o usuário)
  useEffect(() => {
    const cookies = parseCookies();
    const storedToken = cookies.auth_token;

    if (storedToken) {
      setToken(storedToken);
      fetchUser(storedToken).finally(() => setIsLoading(false));
    } else {
      setIsLoading(false); // Não há token
    }
  }, [fetchUser]); // Dependência: fetchUser (agora estável)

  return <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>{children}</AuthContext.Provider>;
}

// Hook customizado
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
};
