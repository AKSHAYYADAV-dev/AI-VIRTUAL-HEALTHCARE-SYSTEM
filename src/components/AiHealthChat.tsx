import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  PlusCircle,
  MessageSquare,
  AlertTriangle,
  Bot,
  User as UserIcon,
  ShieldAlert,
  Sparkles,
  Clock,
  PhoneCall,
  Mic,
  MicOff,
  Volume2,
  Square,
} from 'lucide-react';
import { ChatSession, ChatMessage, SupportedLanguage, User } from '../types/healthcare';
import { UI_TRANSLATIONS } from '../utils/i18n';
import { MandatoryAiFooter } from './MandatoryAiFooter';

interface AiHealthChatProps {
  currentUser: User;
  language: SupportedLanguage;
  chatSessions: ChatSession[];
  onSessionsUpdate: (sessions: ChatSession[]) => void;
  onBookAppointment: (prefillSymptoms?: string) => void;
}

const LIFE_THREATENING_KEYWORDS = [
  'chest pain',
  'heart attack',
  'trouble breathing',
  'difficulty breathing',
  'shortness of breath',
  "can't breathe",
  'cannot breathe',
  'stroke',
  'facial droop',
  'slurred speech',
  'severe bleeding',
  'unconscious',
  'suicidal',
  'suicide',
  'kill myself',
  'self harm',
  'overdose',
  'seizure',
  'ఛాతీ నొప్పి',
  'శ్వాస తీసుకోవడంలో ఇబ్బంది',
  'सीने में दर्द',
  'सांस लेने में तकलीफ',
];

const SAMPLE_SYMPTOM_CHIPS: Array<{ label: string; isRedFlag?: boolean }> = [
  { label: 'Mild fever & body ache for 2 days' },
  { label: 'Acidity after meals' },
  { label: 'Sudden chest pain & sweating', isRedFlag: true },
];

function isLifeThreateningUserMessage(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower || lower.length < 4) return false;
  return LIFE_THREATENING_KEYWORDS.some((kw) => lower.includes(kw.toLowerCase()));
}

function getEmergencyTriageReply(language: SupportedLanguage): string {
  if (language === 'Telugu') {
    return (
      '**తక్షణ వైద్య అత్యవసర సూచన (రెడ్-ఫ్లాగ్ ట్రయాజ్):**\n' +
      '- మీరు వివరించిన లక్షణాలు తక్షణ వైద్య పరీక్ష అవసరమయ్యే అత్యవసర పరిస్థితిని సూచించవచ్చు.\n' +
      '- **ఇంటి చిట్కాలు లేదా సొంత వైద్యం ప్రయత్నించకండి.**\n' +
      '- దయచేసి వెంటనే **108 (అంబులెన్స్)** లేదా **112** కు కాల్ చేయండి లేదా సమీపంలోని ఆసుపత్రి అత్యవసర విభాగానికి వెళ్లండి.\n' +
      '- సహాయం వచ్చేవరకు ప్రశాంతంగా విశ్రాంతి తీసుకోండి మరియు మీ వద్ద ఉన్న వ్యక్తి సహాయంతో అంబులెన్స్ కోసం వేచి ఉండండి.'
    );
  }
  if (language === 'Hindi') {
    return (
      '**तत्काल चिकित्सा आपातकालीन निर्देश (रेड-फ्लैग ट्राइएज):**\n' +
      '- आपके द्वारा बताए गए लक्षण एक गंभीर चिकित्सा आपातकाल का संकेत दे सकते हैं।\n' +
      '- **कृपया किसी भी घरेलू उपाय या स्व-दवा का प्रयास न करें।**\n' +
      '- तुरंत **108 (एम्बुलेंस)** या **112** पर कॉल करें, या नजदीकी अस्पताल के आपातकालीन कक्ष में जाएं।\n' +
      '- सहायता आने तक शांत रहें, स्वयं गाड़ी न चलाएं और किसी परिजन को साथ रखें।'
    );
  }
  return (
    '**Immediate Emergency Action Required (Clinical Red-Flag Triage):**\n' +
    '- The symptoms you described may indicate a life-threatening medical emergency.\n' +
    '- **Do NOT attempt home remedies or wait for symptoms to pass.**\n' +
    '- Call **108 (Ambulance)** or **112** immediately, or have someone take you to the nearest hospital emergency department.\n' +
    '- Sit or rest calmly while waiting for emergency responders and do not drive yourself.'
  );
}

// Client-side cache for repeated questions
const clientQuestionCache = new Map<string, string>();

export const AiHealthChat: React.FC<AiHealthChatProps> = ({
  currentUser,
  language,
  chatSessions,
  onSessionsUpdate,
  onBookAppointment,
}) => {
  const [activeSessionId, setActiveSessionId] = useState<string>(
    chatSessions[0]?.id || `chat-${Date.now()}`
  );
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState<string>('');
  const [streamingIsEmergency, setStreamingIsEmergency] = useState<boolean>(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const chatSessionsRef = useRef<ChatSession[]>(chatSessions);
  chatSessionsRef.current = chatSessions;

  const t = UI_TRANSLATIONS[language];

  const activeSession = chatSessions.find((s) => s.id === activeSessionId) || {
    id: activeSessionId,
    patientId: currentUser.id,
    title: 'New Health Consultation',
    updatedAt: new Date().toISOString(),
    messages: [],
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession.messages.length, streamingText, loading]);

  // 2-second per-user cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  // Clean up speech synthesis & microphone on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop?.();
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
      } catch {
        // ignore cleanup errors
      }
    };
  }, []);

  const speechLocale =
    language === 'Telugu' ? 'te-IN' : language === 'Hindi' ? 'hi-IN' : 'en-IN';

  const handleToggleVoiceInput = () => {
    if (typeof window === 'undefined') return;
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRec) {
      setStatusNotice(
        'Voice input is not supported in this browser. Please type your symptoms or use Chrome/Edge.'
      );
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current?.stop?.();
      } catch {
        // ignore
      }
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRec();
      rec.lang = speechLocale;
      rec.interimResults = true;
      rec.continuous = false;

      rec.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0]?.transcript || '';
        }
        if (transcript.trim()) {
          setInput(transcript.trim());
        }
      };

      rec.onerror = () => {
        setIsListening(false);
        setStatusNotice('Microphone access unavailable or timed out. You can type your question below.');
      };

      rec.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = rec;
      setStatusNotice(`Listening in ${language} (${speechLocale})... speak your symptoms.`);
      setIsListening(true);
      rec.start();
    } catch {
      setIsListening(false);
      setStatusNotice('Could not start voice recognition.');
    }
  };

  const handleToggleSpeakReply = (msgId: string, rawText: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      setStatusNotice('Text-to-Speech read-aloud is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    if (speakingMsgId === msgId) {
      setSpeakingMsgId(null);
      return;
    }

    const cleanText = rawText
      .replace(/\*\*/g, '')
      .replace(/^[-*•]\s*/gm, '')
      .replace(/\n+/g, '. ');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = speechLocale;
    utterance.rate = 0.98;
    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);
    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const handleStartNewChat = () => {
    const newId = `chat-${Date.now()}`;
    setActiveSessionId(newId);
    setError(null);
    setStatusNotice(null);
    setInput('');
  };

  const handleSendMessage = async (textOverride?: string, isTellMeMore = false) => {
    const question = (textOverride ?? input).trim();
    if (!question || loading) return;

    if (cooldownSeconds > 0) {
      setStatusNotice(`Please wait a moment (${cooldownSeconds}s cooldown between messages)...`);
      return;
    }

    setError(null);
    setStatusNotice(null);
    if (!textOverride) {
      setInput('');
    }
    setLoading(true);
    setStreamingText('');
    setCooldownSeconds(2); // 2-second cooldown per user

    const userEmergency = isLifeThreateningUserMessage(question);
    setStreamingIsEmergency(userEmergency);

    // Send only the last 8 messages as history
    const existingHistory = activeSession.messages.slice(-8).map((m) => ({
      role: m.role,
      text: m.text,
    }));

    // Optimistic user message
    const tempUserMsg: ChatMessage = {
      id: `temp-u-${Date.now()}`,
      role: 'user',
      text: question,
      timestamp: new Date().toISOString(),
      language,
    };

    const updatedMessages = [...activeSession.messages, tempUserMsg];
    const optimisticSession: ChatSession = {
      ...activeSession,
      title:
        activeSession.messages.length === 0
          ? question.slice(0, 46) + (question.length > 46 ? '...' : '')
          : activeSession.title,
      updatedAt: new Date().toISOString(),
      messages: updatedMessages,
    };

    const otherSessions = chatSessionsRef.current.filter((s) => s.id !== activeSession.id);
    onSessionsUpdate([optimisticSession, ...otherSessions]);

    // Red-Flag Clinical Safety Triage: immediately trigger emergency card & omit home remedies
    if (userEmergency) {
      const emergencyReply = getEmergencyTriageReply(language);
      const emergencyModelMsg: ChatMessage = {
        id: `emergency-m-${Date.now()}`,
        role: 'model',
        text: emergencyReply,
        timestamp: new Date().toISOString(),
        language,
        isEmergency: true,
        detectedSymptoms: question.slice(0, 140),
      };
      const completedSession: ChatSession = {
        ...optimisticSession,
        updatedAt: new Date().toISOString(),
        messages: [...updatedMessages, emergencyModelMsg],
      };
      onSessionsUpdate([completedSession, ...otherSessions]);
      setStreamingText('');
      setLoading(false);
      return;
    }

    const cacheKey = `${language.toLowerCase()}::${question.toLowerCase().replace(/\s+/g, ' ').trim()}`;

    // Check client-side cache first for repeated questions (unless "Tell me more")
    if (!isTellMeMore && clientQuestionCache.has(cacheKey)) {
      const cachedAnswer = clientQuestionCache.get(cacheKey)!;
      const modelMsg: ChatMessage = {
        id: `cached-m-${Date.now()}`,
        role: 'model',
        text: cachedAnswer,
        timestamp: new Date().toISOString(),
        language,
        isEmergency: userEmergency,
        detectedSymptoms: question.slice(0, 140),
      };
      const completedSession: ChatSession = {
        ...optimisticSession,
        updatedAt: new Date().toISOString(),
        messages: [...updatedMessages, modelMsg],
      };
      onSessionsUpdate([completedSession, ...otherSessions]);
      setLoading(false);
      // Persist asynchronously in background
      fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: currentUser.id,
          sessionId: activeSession.id,
          message: question,
          history: existingHistory,
          language,
          stream: false,
        }),
      }).catch(() => {});
      return;
    }

    // Stream response with automatic short backoff retry on 429 rate-limit errors
    const maxRetries = 2;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: currentUser.id,
            sessionId: activeSession.id,
            message: question,
            history: existingHistory,
            language,
            stream: true,
            bypassCache: isTellMeMore,
          }),
        });

        if (response.status === 429) {
          if (attempt < maxRetries) {
            setStatusNotice('Please wait a moment... retrying your request.');
            await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
            continue;
          } else {
            const errData = await response.json().catch(() => ({}));
            throw new Error(
              errData.error || 'Please wait a moment before sending another question.'
            );
          }
        }

        if (!response.ok || !response.body) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(
            errData.error || 'Please wait a moment and try sending your question again.'
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let finalSession: ChatSession | null = null;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            const jsonStr = line.replace(/^data:\s*/, '');
            try {
              const evt = JSON.parse(jsonStr);
              if (evt.type === 'status') {
                setStatusNotice(evt.message || 'Please wait a moment...');
              } else if (evt.type === 'chunk') {
                setStatusNotice(null);
                accumulated += evt.text || '';
                setStreamingText(accumulated);
              } else if (evt.type === 'done') {
                setStatusNotice(null);
                accumulated = evt.reply || accumulated;
                finalSession = evt.session || null;
              } else if (evt.type === 'error') {
                throw new Error(evt.error || 'Please wait a moment and try again.');
              }
            } catch (parseErr: any) {
              if (parseErr?.message && !parseErr.message.includes('JSON')) {
                throw parseErr;
              }
            }
          }
        }

        if (accumulated && !isTellMeMore) {
          clientQuestionCache.set(cacheKey, accumulated);
        }

        if (finalSession) {
          const remaining = chatSessionsRef.current.filter((s) => s.id !== finalSession!.id);
          onSessionsUpdate([finalSession, ...remaining]);
          setActiveSessionId(finalSession.id);
        } else if (accumulated) {
          const fallbackModelMsg: ChatMessage = {
            id: `model-${Date.now()}`,
            role: 'model',
            text: accumulated,
            timestamp: new Date().toISOString(),
            language,
            isEmergency: userEmergency,
            detectedSymptoms: question.slice(0, 140),
          };
          const completedSession: ChatSession = {
            ...optimisticSession,
            updatedAt: new Date().toISOString(),
            messages: [...updatedMessages, fallbackModelMsg],
          };
          const remaining = chatSessionsRef.current.filter((s) => s.id !== completedSession.id);
          onSessionsUpdate([completedSession, ...remaining]);
        }

        break; // Success
      } catch (err: any) {
        if (attempt < maxRetries && String(err?.message || '').toLowerCase().includes('wait')) {
          setStatusNotice('Please wait a moment... retrying.');
          await new Promise((r) => setTimeout(r, 1200));
          continue;
        }
        setError(
          err.message ||
            'Please wait a moment and try again, or book an appointment directly with a doctor.'
        );
      }
    }

    setStreamingText('');
    setLoading(false);
  };

  // Format markdown bold/bullet lines cleanly
  const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} className="h-2" />;

      const parts = line.split(/(\*\*.*?\*\*)/g).map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={idx} className="font-semibold text-[var(--color-forest)]">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return <span key={idx}>{part}</span>;
      });

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={i} className="flex items-start gap-2 pl-2 my-1">
            <span className="text-[var(--color-forest)] font-bold select-none">•</span>
            <span className="flex-1">{parts}</span>
          </div>
        );
      }

      return (
        <p key={i} className="my-1 leading-relaxed">
          {parts}
        </p>
      );
    });
  };

  return (
    <div className="fade-slide-up grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:h-[calc(100vh-9.5rem)] lg:min-h-[620px]">
      {/* Left Sidebar: Conversation History & Safety Rules */}
      <div className="lg:col-span-4 bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs flex flex-col overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-[var(--color-leaf-border)] flex items-center justify-between gap-2 bg-[var(--color-leaf-soft)]">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--color-forest)] truncate">Consultation Threads</h2>
            <p className="text-xs text-[var(--color-text-muted)] truncate">Last 8 messages context · Cached speed</p>
          </div>
          <button
            type="button"
            onClick={handleStartNewChat}
            className="btn-forest-primary inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Chat</span>
          </button>
        </div>

        <div className="flex-1 max-h-52 lg:max-h-none overflow-y-auto divide-y divide-[var(--color-leaf-border)]/40 p-2.5 space-y-1">
          {chatSessions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[var(--color-text-muted)]">
              No previous conversations yet. Ask your first health question on the right.
            </div>
          ) : (
            chatSessions.map((session) => (
              <button
                key={session.id}
                type="button"
                onClick={() => {
                  setActiveSessionId(session.id);
                  setError(null);
                  setStatusNotice(null);
                }}
                className={`w-full text-left p-3.5 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                  session.id === activeSession.id
                    ? 'bg-[var(--color-leaf)] text-[var(--color-forest)] border border-[var(--color-leaf-border)] shadow-2xs'
                    : 'hover:bg-[var(--color-leaf-soft)] text-[var(--color-text-dark)]'
                }`}
              >
                <MessageSquare className="w-4 h-4 text-[var(--color-forest)] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold truncate">{session.title}</div>
                  <div className="text-[11px] text-[var(--color-text-muted)] font-mono-tabular mt-0.5">
                    {session.messages.length} messages ·{' '}
                    {new Date(session.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Clinical Guardrail Box */}
        <div className="p-4 bg-[var(--color-leaf-soft)] border-t border-[var(--color-leaf-border)] text-xs text-[var(--color-text-dark)] space-y-1.5">
          <div className="flex items-center gap-1.5 font-bold text-[var(--color-forest)]">
            <ShieldAlert className="w-4 h-4 text-[var(--color-forest)]" />
            <span>Clinical Safety Protocol</span>
          </div>
          <p className="leading-relaxed">
            Provides concise (~150 words) common causes, plain-language explanations, safe home remedy tips, and educational uses of tablets with real-time streaming. Replies in English, Telugu (తెలుగు), or Hindi (हिन्दी).
          </p>
        </div>
      </div>

      {/* Right Main Chat Area */}
      <div className="lg:col-span-8 bg-white border border-[var(--color-leaf-border)] rounded-2xl shadow-xs flex flex-col min-h-[480px] sm:min-h-[540px] lg:min-h-0 overflow-hidden">
        {/* Clean Modern Clinic Chat Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-[var(--color-leaf-border)] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 bg-[var(--color-forest)] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-leaf)] text-[var(--color-forest)] flex items-center justify-center shrink-0 shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                AI Virtual Healthcare Assistant
              </h2>
              <p className="text-xs text-white/80">
                Flash-Lite Live Streaming · Language: {language}
              </p>
            </div>
          </div>

          <div className="text-xs text-[var(--color-forest)] font-bold flex items-center gap-1.5 bg-[var(--color-leaf)] px-3 py-1.5 rounded-xl border border-[var(--color-leaf-border)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--color-forest)]" />
            <span>Instant Streaming Active</span>
          </div>
        </div>

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[var(--color-leaf-soft)]/60">
          {activeSession.messages.length === 0 && !loading ? (
            <div className="max-w-xl mx-auto my-6 bg-white border border-[var(--color-leaf-border)] rounded-2xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-[var(--color-forest)]">
                How can I help with your health question today?
              </h3>
              <p className="text-xs text-[var(--color-text-dark)] leading-relaxed">
                Ask about any symptom, condition, home remedy, or tablet use in {language}. Answers stream live and include causes, home remedy tips, and general tablet uses (under ~150 words) with a &ldquo;Tell me more&rdquo; option.
              </p>
              <div className="space-y-2">
                <div className="text-xs font-bold text-[var(--color-forest)]">
                  Quick Prompts ({language}):
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {t.sampleQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendMessage(q)}
                      disabled={cooldownSeconds > 0 || loading}
                      className="card-hover-lift text-left text-xs p-3.5 rounded-xl bg-[var(--color-leaf-soft)] hover:bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] hover:border-[var(--color-forest)] text-[var(--color-text-dark)] font-medium transition-all cursor-pointer disabled:opacity-50"
                    >
                      &ldquo;{q}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            activeSession.messages.map((msg, index) => {
              // Find the user question that preceded this model message for "Tell me more"
              const prevUserMsg =
                index > 0 && activeSession.messages[index - 1]?.role === 'user'
                  ? activeSession.messages[index - 1].text
                  : msg.detectedSymptoms || '';

              // Strictly check if that specific user message had life-threatening symptoms
              const showLifeThreateningTopBanner =
                msg.role === 'model' &&
                Boolean(msg.isEmergency && isLifeThreateningUserMessage(prevUserMsg));

              return (
                <div
                  key={msg.id}
                  className={`fade-slide-up flex items-start gap-3 ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-xl bg-[var(--color-forest)] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl rounded-2xl p-4 sm:p-5 shadow-xs ${
                      msg.role === 'user'
                        ? 'bg-[var(--color-forest)] text-white rounded-br-md'
                        : 'bg-[var(--color-leaf)]/65 border border-[var(--color-leaf-border)] text-[var(--color-text-dark)] rounded-bl-md'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] opacity-80 font-mono-tabular">
                      <span className="font-semibold">
                        {msg.role === 'user' ? currentUser.name : 'AI Healthcare Assistant'}
                      </span>
                      <span>
                        {new Date(msg.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* High-contrast red emergency alert card at top when life-threatening red-flag symptoms are detected */}
                    {showLifeThreateningTopBanner && (
                      <div className="mb-3.5 rounded-xl bg-red-50 border-2 border-red-500 overflow-hidden shadow-xs">
                        <div className="bg-red-600 text-white px-3.5 py-2 flex items-center justify-between gap-2 text-xs font-extrabold">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{t.emergencyBannerTitle}</span>
                          </div>
                          <span className="inline-flex items-center gap-1 bg-white text-red-700 px-2 py-0.5 rounded-md font-mono-tabular">
                            <PhoneCall className="w-3 h-3" />
                            108 / 112
                          </span>
                        </div>
                        <p className="p-3.5 text-xs font-semibold text-red-950 leading-relaxed">
                          {t.emergencyBannerText}
                        </p>
                      </div>
                    )}

                    <div className="text-sm leading-relaxed">{renderFormattedText(msg.text)}</div>

                    {/* Audio Read-Aloud & "Tell me more" controls for AI responses */}
                    {msg.role === 'model' && (
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleSpeakReply(msg.id, msg.text)}
                          className="btn-forest-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          {speakingMsgId === msg.id ? (
                            <>
                              <Square className="w-3.5 h-3.5 text-red-600" />
                              <span>Stop Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-[var(--color-forest)]" />
                              <span>Listen ({language})</span>
                            </>
                          )}
                        </button>
                        {!showLifeThreateningTopBanner && (
                          <button
                            type="button"
                            disabled={loading || cooldownSeconds > 0}
                            onClick={() =>
                              handleSendMessage(
                                `Tell me more about ${
                                  prevUserMsg
                                    ? `"${prevUserMsg.slice(0, 80)}"`
                                    : 'this health topic'
                                } including more details on causes, home remedy tips, and the general use of tablets.`,
                                true
                              )
                            }
                            className="btn-forest-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl cursor-pointer disabled:opacity-50"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-[var(--color-forest)]" />
                            <span>Tell me more</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* MANDATORY AI ANSWER FOOTER (Calm emergency note + AI disclaimer + Book Appointment) */}
                    {msg.role === 'model' && (
                      <MandatoryAiFooter
                        language={language}
                        symptomsToPrefill={msg.detectedSymptoms}
                        onBookAppointment={onBookAppointment}
                      />
                    )}
                  </div>

                  {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-xl bg-[var(--color-forest-dark)] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                      <UserIcon className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* Live Streaming Message Bubble & Typing Indicator */}
          {loading && (
            <div className="fade-slide-up flex items-start gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-forest)] text-white flex items-center justify-center shrink-0 mt-1 shadow-xs">
                <Bot className="w-4 h-4" />
              </div>
              <div className="max-w-2xl rounded-2xl rounded-bl-md p-4 sm:p-5 bg-[var(--color-leaf)]/65 border border-[var(--color-leaf-border)] text-[var(--color-text-dark)] shadow-xs space-y-3">
                {streamingIsEmergency && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-900 flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong className="block font-bold text-red-800">
                        {t.emergencyBannerTitle} — Call 108 or 112 Immediately
                      </strong>
                      <p className="mt-0.5">{t.emergencyBannerText}</p>
                    </div>
                  </div>
                )}

                {streamingText ? (
                  <div className="text-sm leading-relaxed">
                    {renderFormattedText(streamingText)}
                  </div>
                ) : null}

                {/* Animated Typing Dots Indicator */}
                <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] pt-1">
                  <div className="flex items-center gap-1">
                    <span className="typing-dot w-2 h-2 rounded-full bg-[var(--color-forest)] inline-block" />
                    <span className="typing-dot w-2 h-2 rounded-full bg-[var(--color-forest)] inline-block [animation-delay:150ms]" />
                    <span className="typing-dot w-2 h-2 rounded-full bg-[var(--color-forest)] inline-block [animation-delay:300ms]" />
                  </div>
                  <span className="font-medium">
                    {statusNotice ||
                      (streamingText ? 'Streaming response...' : 'AI Assistant is typing...')}
                  </span>
                </div>
              </div>
            </div>
          )}

          {!loading && statusNotice && (
            <div className="p-3.5 rounded-xl bg-[var(--color-leaf)] border border-[var(--color-leaf-border)] text-xs text-[var(--color-forest)] font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--color-forest)] shrink-0" />
              <span>{statusNotice}</span>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">Please wait a moment</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3 Clickable "Try Sample Symptom" Quick-Fill Chips above Chat Input */}
        <div className="px-4 pt-3 pb-2 bg-[var(--color-leaf-soft)]/80 border-t border-[var(--color-leaf-border)] flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[var(--color-forest)] shrink-0">
            Try Sample Symptom:
          </span>
          {SAMPLE_SYMPTOM_CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              disabled={loading}
              onClick={() => {
                setInput(chip.label);
                inputRef.current?.focus();
              }}
              className={`px-3 py-1 rounded-xl border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
                chip.isRedFlag
                  ? 'bg-red-50 hover:bg-red-100 border-red-300 text-red-800'
                  : 'bg-white hover:bg-[var(--color-leaf)] border-[var(--color-leaf-border)] text-[var(--color-forest)]'
              }`}
            >
              {chip.isRedFlag ? `⚠ ${chip.label}` : chip.label}
            </button>
          ))}
        </div>

        {/* Message Input Bar with Voice Microphone & 2s Cooldown Feedback */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="p-4 bg-white border-t border-[var(--color-leaf-border)] flex items-center gap-2.5"
        >
          <button
            type="button"
            onClick={handleToggleVoiceInput}
            disabled={loading}
            title={`Speak symptoms in ${language}`}
            className={`inline-flex items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
              isListening
                ? 'bg-red-600 text-white border-red-700 shadow-xs'
                : 'bg-[var(--color-leaf-soft)] hover:bg-[var(--color-leaf)] text-[var(--color-forest)] border-[var(--color-leaf-border)]'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.chatPlaceholder}
            disabled={loading}
            className="flex-1 px-4 py-3 text-sm bg-white border border-[var(--color-leaf-border)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--color-forest)] transition-all"
          />
          <button
            type="submit"
            disabled={loading || cooldownSeconds > 0 || !input.trim()}
            className="btn-forest-primary inline-flex items-center gap-2 px-5 py-3 disabled:opacity-50 text-sm font-semibold rounded-xl shadow-xs cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>{cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send'}</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
