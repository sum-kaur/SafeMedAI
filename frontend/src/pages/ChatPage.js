import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, MessageCircle, Bot, User, Loader2, Shield } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function ChatPage() {
  const { patientId } = useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef(null);
  const isPractitioner = user?.role === 'medical_practitioner';

  useEffect(() => { fetchMessages(); }, [patientId]);
  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/chat/${patientId}/messages`, { withCredentials: true });
      setMessages(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input;
    setInput('');
    setSending(true);
    setMessages(prev => [...prev, { message_id: 'temp', role: 'user', content: text, created_at: new Date().toISOString() }]);
    try {
      const res = await axios.post(`${API}/chat/${patientId}/messages`, { message: text }, { withCredentials: true });
      setMessages(prev => [
        ...prev.filter(m => m.message_id !== 'temp'),
        res.data.user_message,
        res.data.ai_message
      ]);
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { message_id: 'error', role: 'assistant', content: 'Sorry, I was unable to process your question. Please try again.', created_at: new Date().toISOString() }
      ]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestions = isPractitioner ? [
    "What are the key risk factors for this patient?",
    "Which medications should be reviewed first?",
    "Summarise the discharge plan and follow-up",
    "What deprescribing considerations exist?",
  ] : [
    "What does the risk level mean?",
    "Which medicines may need review?",
    "What should I ask the GP?",
    "What warning signs should I watch for?",
  ];

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--sma-bg)' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col" data-testid="chat-page">
        {/* Header */}
        <div className="p-6 border-b" style={{ borderColor: 'var(--sma-border)', backgroundColor: 'var(--sma-surface)' }}>
          <div className="max-w-4xl mx-auto flex items-center gap-3">
            <MessageCircle className="w-6 h-6" style={{ color: 'var(--sma-brand)' }} />
            <div>
              <h1 className="text-xl font-semibold" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                {isPractitioner ? 'Clinical Q&A' : 'Ask About This Report'}
              </h1>
              <p className="text-xs" style={{ color: 'var(--sma-text-muted)' }}>
                Questions are answered based on this patient's uploaded documents only
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-4">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--sma-brand)' }} /></div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12 animate-fade-in">
                <Bot className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--sma-brand)' }} />
                <h2 className="text-xl font-medium mb-2" style={{ fontFamily: 'Outfit', color: 'var(--sma-text-primary)' }}>
                  {isPractitioner ? 'Ask about this patient\'s medications and risk' : 'Ask about the discharge summary'}
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--sma-text-muted)' }}>Try one of these questions to get started:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      data-testid={`suggestion-${i}`}
                      onClick={() => { setInput(s); }}
                      className="p-3 rounded-lg text-sm text-left transition-all duration-200 hover:-translate-y-0.5 cursor-pointer"
                      style={{ backgroundColor: 'var(--sma-surface)', border: '1px solid var(--sma-border)', color: 'var(--sma-text-secondary)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.message_id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`} data-testid={`chat-msg-${msg.message_id}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
                      <Bot className="w-4 h-4" style={{ color: 'var(--sma-brand)' }} />
                    </div>
                  )}
                  <div
                    className="max-w-[75%] p-4 rounded-xl"
                    style={msg.role === 'user'
                      ? { backgroundColor: 'var(--sma-brand)', color: 'white' }
                      : { backgroundColor: 'var(--sma-surface-alt)', color: 'var(--sma-text-primary)' }
                    }
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <p className="text-[10px] mt-2 opacity-60">{new Date(msg.created_at).toLocaleTimeString()}</p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--sma-brand)' }}>
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              ))
            )}
            {sending && (
              <div className="flex gap-3 justify-start" data-testid="chat-typing-indicator">
                <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
                  <Bot className="w-4 h-4" style={{ color: 'var(--sma-brand)' }} />
                </div>
                <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--sma-surface-alt)' }}>
                  <div className="flex gap-1"><span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--sma-brand)', animationDelay: '0ms' }} /><span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--sma-brand)', animationDelay: '150ms' }} /><span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--sma-brand)', animationDelay: '300ms' }} /></div>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        {/* Input */}
        <div className="p-4 border-t" style={{ borderColor: 'var(--sma-border)', backgroundColor: 'var(--sma-surface)' }}>
          <div className="max-w-4xl mx-auto">
            <div className="flex items-end gap-3">
              <Textarea
                data-testid="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isPractitioner ? "Ask a clinical question about this patient..." : "Ask about the discharge summary in plain language..."}
                className="min-h-[60px] max-h-[120px] resize-none rounded-xl text-base"
                style={{ borderColor: 'var(--sma-border)' }}
              />
              <Button
                data-testid="chat-send-btn"
                onClick={handleSend}
                disabled={!input.trim() || sending}
                className="h-14 w-14 rounded-xl flex-shrink-0 transition-all duration-200"
                style={{ backgroundColor: input.trim() ? 'var(--sma-brand)' : 'var(--sma-border)', color: 'var(--sma-text-inverse)' }}
              >
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </Button>
            </div>
            <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--sma-text-muted)' }}>
              Decision support only. Does not replace professional medical judgment. Do not use in emergencies.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
