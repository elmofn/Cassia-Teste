import React, { useState, useRef, useEffect } from 'react';
import { Message, LoadingState } from '../types';
import { GeminiService } from '../services/geminiService';
import { MessageBubble } from './MessageBubble';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: 'Oi! Sou a Cassia, da TravelCash.',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [status, setStatus] = useState<LoadingState>(LoadingState.IDLE);
  const [userLocation, setUserLocation] = useState<string | undefined>(undefined);
  
  // Ref to hold the service instance to persist across renders
  const geminiServiceRef = useRef<GeminiService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize service and get location once
  useEffect(() => {
    geminiServiceRef.current = new GeminiService();

    // Request location immediately for better suggestions
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation(`Localização do usuário: Lat ${latitude}, Long ${longitude}`);
        },
        (error) => {
          console.log("Location access denied or error:", error);
        }
      );
    }
  }, []);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, status]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!inputValue.trim() || status === LoadingState.THINKING) return;

    const userText = inputValue;
    setInputValue(''); // Clear input immediately
    setStatus(LoadingState.THINKING);

    // Add user message
    const newUserMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      if (!geminiServiceRef.current) {
         throw new Error("Service not initialized");
      }

      // Pass userText AND the captured location context
      const { text: responseText, groundingMetadata } = await geminiServiceRef.current.sendMessage(userText, userLocation);

      // Remove artificial delay to make search results feel faster, 
      // or keep a small one for UI smoothing. Search takes time anyway.
      // Keeping a small constant delay for animation smoothness.
      await new Promise(resolve => setTimeout(resolve, 600));

      const modelMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: responseText,
        timestamp: new Date(),
        groundingMetadata: groundingMetadata // Pass metadata to message
      };

      setMessages(prev => [...prev, modelMsg]);
      setStatus(LoadingState.IDLE);

    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Eita, minha net oscilou. Manda de novo?",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
      setStatus(LoadingState.ERROR);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 relative max-w-2xl mx-auto shadow-2xl border-x border-slate-200">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 p-4 flex items-center gap-3 sticky top-0 z-10">
            <div className="w-10 h-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold shadow-md">
                TC
            </div>
            <div>
                <h1 className="font-semibold text-slate-800">TravelCash</h1>
                <p className="text-xs text-teal-600 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500 block"></span>
                    Cassia Online
                </p>
            </div>
        </header>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 pb-24">
            {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
            ))}
            
            {status === LoadingState.THINKING && (
                <div className="flex justify-start mb-4 animate-pulse">
                     <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm flex items-center gap-1">
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                        <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                     </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4">
            <form onSubmit={handleSendMessage} className="relative flex items-center gap-2">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Digite sua mensagem..."
                    className="flex-1 bg-slate-100 text-slate-800 placeholder-slate-500 rounded-full px-5 py-3 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-all border border-transparent"
                    disabled={status === LoadingState.THINKING}
                />
                <button
                    type="submit"
                    disabled={!inputValue.trim() || status === LoadingState.THINKING}
                    className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-full p-3 transition-colors shadow-sm flex-shrink-0"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                    </svg>
                </button>
            </form>
            <p className="text-center text-[10px] text-slate-400 mt-2">
                A Cassia pode cometer erros.
            </p>
        </div>
    </div>
  );
};

export default ChatInterface;