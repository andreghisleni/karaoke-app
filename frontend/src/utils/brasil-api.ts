import axios from "axios";

export const brasil_api = axios.create({
  baseURL: "https://brasilapi.com.br/api",
  headers: {
    "Content-Type": "application/json",
  },
});

type CepType = {
  cep: string;
  state: string;
  city: string;
  neighborhood: string;
  street: string;
  service: string;
};

export const getCEP = async (cep: string): Promise<CepType | null> => {
  try {
    const response = await brasil_api.get<CepType>(`/cep/v1/${cep}`);
    return response.data;
  } catch {
    return null;
  }
};

type BankType = {
  ispb: string;
  name: string;
  code?: number;
  fullName: string;
};

export const getBanks = async (): Promise<BankType[] | null> => {
  try {
    const response = await brasil_api.get("/banks/v1");
    return response.data;
  } catch {
    return null;
  }
};
