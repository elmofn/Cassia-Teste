import React from 'react';
import Markdown from 'react-markdown';
import { Message } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  
  // Extract sources if present
  const sources = message.groundingMetadata?.groundingChunks?.map((chunk: any, index: number) => {
    if (chunk.web?.uri && chunk.web?.title) {
        return {
            title: chunk.web.title,
            uri: chunk.web.uri
        };
    }
    return null;
  }).filter(Boolean);

  return (
    <div className={`flex w-full mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-5 py-3 shadow-sm flex flex-col gap-2 ${
          isUser
            ? 'bg-teal-600 text-white rounded-br-none'
            : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
        }`}
      >
        <div className="text-sm leading-relaxed prose prose-sm max-w-none prose-p:my-1 prose-a:text-blue-600 prose-a:underline hover:prose-a:text-blue-800">
            {isUser ? (
                message.text
            ) : (
                <Markdown
                    components={{
                        a: ({node, ...props}) => <a {...props} target="_blank" rel="noopener noreferrer" className="font-semibold underline break-all" />
                    }}
                >
                    {message.text}
                </Markdown>
            )}
        </div>

        {/* Display Search Sources (Grounding) */}
        {!isUser && sources && sources.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-semibold text-slate-500 mb-1 uppercase tracking-wide">Fontes consultadas:</p>
                <div className="flex flex-wrap gap-2">
                    {sources.map((source: any, idx: number) => (
                        <a 
                            key={idx}
                            href={source.uri}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded-md transition-colors truncate max-w-[200px]"
                        >
                            {source.title}
                        </a>
                    ))}
                </div>
            </div>
        )}

        <div className={`text-[10px] mt-1 ${isUser ? 'text-teal-100' : 'text-slate-400'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
};