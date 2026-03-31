import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  timeout: 10_000,
  withCredentials: true, // Importante para enviar cookies junto com as requisições
});

// Interceptor para lidar com respostas de erro
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expirado ou inválido
      // biome-ignore lint/suspicious/noConsole: test
      console.warn('Token inválido ou expirado');
      // Aqui você pode implementar logout automático ou refresh token
      // await auth.signOut();
    }
    return Promise.reject(error);
  }
);

export default api;