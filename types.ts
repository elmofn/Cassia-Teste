export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  groundingMetadata?: any; // To store search sources
}

export enum LoadingState {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  ERROR = 'ERROR'
}

export interface ChatState {
  messages: Message[];
  status: LoadingState;
}