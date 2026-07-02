"use client";

import { useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  tripId: string;
  onClose: () => void;
}

export default function ChatBot({ tripId, onClose }: Props) {
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([
    { role: "ai", text: "안녕하세요! TripPilot AI 여행 비서입니다. 여행 중 궁금한 점을 물어보세요." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      const { reply, suggestions: sug } = await api.chat(text, tripId);
      setMessages((prev) => [...prev, { role: "ai", text: reply }]);
      setSuggestions(sug);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "ai", text: "죄송합니다. 응답을 생성하지 못했습니다." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-bold">AI 여행 챗봇</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-600 text-white rounded-br-md"
                    : "bg-slate-100 text-slate-800 rounded-bl-md"
                }`}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 px-4 py-2.5 rounded-2xl">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="px-5 pb-2 flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => send(s)}
                className="text-xs bg-blue-50 text-brand-600 px-3 py-1.5 rounded-full hover:bg-blue-100"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <div className="px-5 py-4 border-t flex gap-2">
          <input
            className="input-field flex-1"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="예: 오늘 아이가 힘들어해"
            disabled={loading}
          />
          <button
            onClick={() => send(input)}
            disabled={loading || !input.trim()}
            className="btn-primary px-3"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
