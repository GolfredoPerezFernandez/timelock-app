// Professional (Freelancer) model
export interface Professional {
  id: string;
  name: string;
  role: string;
  description: string;
  resumeUrl?: string; // URL to CV PDF file
  wallet: string;
  observations?: string;
  createdAt: string;
}

// Contract model
export interface Contract {
  id: string;
  professionalId: string;
  professionalName?: string; // For display purposes
  contractUrl: string; // URL to contract PDF file
  startDate: string;
  endDate?: string; // Optional for ongoing contracts
  status: 'active' | 'completed' | 'terminated';
  createdAt: string;
}

// Invoice model
export interface Invoice {
  id: string;
  professionalId: string;
  professionalName?: string; // For display purposes
  contractId: string;
  invoiceUrl: string; // URL to invoice PDF file
  amount: number;
  currency: Currency;
  status: 'pending' | 'paid';
  issueDate: string;
  paidDate?: string;
  createdAt: string;
}

// Settlement model (liquidación)
export interface Settlement {
  id: string;
  professionalId: string;
  professionalName?: string; // For display purposes
  projectId: string;
  projectName: string;
  projectDescription: string;
  hours: number;
  hourlyRate: number;
  currency: Currency;
  totalAmount: number; // hours * hourlyRate
  totalInKNRT: number; // converted amount in KNRT
  observations?: string;
  status: 'pending' | 'paid';
  createdAt: string;
  paidDate?: string;
}

// Payment model
export interface Payment {
  id: string;
  professionalId: string;
  invoiceId?: string;
  settlementId?: string;
  amount: number;
  currency: Currency;
  transactionId: string;
  paymentDate: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: string;
}

// Scheduled Payment model
export interface ScheduledPayment {
  id: string;
  professionalId: string;
  frequency: 'weekly' | 'biweekly' | 'monthly';
  amount: number;
  currency: Currency;
  startDate: string;
  nextPaymentDate: string;
  active: boolean;
  createdAt: string;
}

// User model
export interface User {
  id: string;
  email: string;
  type: 'freelancer' | 'admin' | 'super_admin'; // super_admin is the first admin
  createdAt: string;
}

// Currency type
export type Currency = 'EUR' | 'USD' | 'KNRT';

// Conversion rates (for simplicity stored here, could be moved to a service)
export const conversionRates = {
  EUR: 1.1, // 1 EUR = 1.1 KNRT
  USD: 1.0, // 1 USD = 1 KNRT
  KNRT: 1.0 // 1 KNRT = 1 KNRT (base currency)
};

// Helper function to convert currency to KNRT
export function convertToKNRT(amount: number, currency: Currency): number {
  return amount * conversionRates[currency];
}

// Helper function to format currency
export function formatCurrency(amount: number, currency: Currency): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency === 'KNRT' ? 'USD' : currency, // Using USD format for KNRT
    minimumFractionDigits: 2
  });
  
  const formatted = formatter.format(amount);
  return currency === 'KNRT' ? formatted.replace('$', '') + ' KNRT' : formatted;
}
