import React from 'react';
import ChatInterface from './components/ChatInterface';

const App: React.FC = () => {
  return (
    <div className="h-screen w-full bg-slate-200 flex items-center justify-center">
      <div className="w-full h-full md:h-[800px] md:max-w-md md:rounded-2xl md:overflow-hidden bg-white shadow-2xl">
        <ChatInterface />
      </div>
    </div>
  );
};

export default App;