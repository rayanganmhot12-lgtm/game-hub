"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Send } from "lucide-react";
import { isFirebaseConfigured } from "@/lib/firebase";
import { CosmeticBadge } from "@/components/CosmeticFrame";
import ProfileAvatar from "@/components/ProfileAvatar";
import { conversationId, sendChatMessage, listenForChatMessages, removeChatMessage } from "@/lib/chatRealtime";
import { listenForReactions, toggleReaction, type ReactionMap } from "@/lib/reactionsRealtime";
import { listenToPresence } from "@/lib/presence";
import { getModerationState, isRestricted } from "@/lib/moderationRealtime";
import { useToast } from "@/context/ToastContext";
import MessageReactions from "@/components/MessageReactions";

interface ChatMessage {
  id: string;
  direction: string;
  text: string;
  sentAt: string | Date;
  clientId?: string | null;
}

export default function ChatWindow({
  myCode,
  myDisplayName,
  peerCode,
  peerDisplayName,
  peerBadge,
  initialMessages,
}: {
  myCode: string;
  myDisplayName: string;
  peerCode: string;
  peerDisplayName: string;
  peerBadge?: string | null;
  initialMessages: ChatMessage[];
}) {
  const { showToast } = useToast();
  const [messages, setMessages] = useState(initialMessages);
  const [text, setText] = useState("");
  const [online, setOnline] = useState(false);
  const [reactions, setReactions] = useState<ReactionMap>({});
  const bottomRef = useRef<HTMLDivElement>(null);
  const convId = conversationId(myCode, peerCode);
  const reactionsPath = `chatReactions/${convId}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return listenToPresence(peerCode, (state) => setOnline(Boolean(state?.online)));
  }, [peerCode]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    return listenForReactions(reactionsPath, setReactions);
  }, [reactionsPath]);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    return listenForChatMessages(convId, myCode, async (message, messageId) => {
      const res = await fetch(`/api/chat/${peerCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direction: "received",
          text: message.text,
          peerDisplayName: message.fromDisplayName,
          clientId: message.clientId,
        }),
      });
      if (res.ok) {
        const { message: saved } = await res.json();
        setMessages((prev) => [...prev, saved]);
      }
      await removeChatMessage(convId, messageId);
    });
  }, [convId, myCode, peerCode]);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;

    const myState = await getModerationState(myCode);
    const { restricted, reason } = isRestricted(myState);
    if (restricted) {
      showToast(reason, "error");
      return;
    }

    setText("");
    const clientId = crypto.randomUUID();

    try {
      await sendChatMessage(convId, myCode, myDisplayName, trimmed, clientId);
      const res = await fetch(`/api/chat/${peerCode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction: "sent", text: trimmed, peerDisplayName, clientId }),
      });
      if (res.ok) {
        const { message: saved } = await res.json();
        setMessages((prev) => [...prev, saved]);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Couldn't send message.", "error");
    }
  }

  return (
    <div className="panel flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2.5 border-b border-border p-4">
        <div className="relative">
          <ProfileAvatar code={peerCode} displayName={peerDisplayName} size={30} />
          <span
            className={`absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full ring-2 ring-surface ${
              online ? "bg-emerald-400" : "bg-surface-2"
            }`}
          />
        </div>
        <h1 className="text-sm font-semibold text-foreground">{peerDisplayName}</h1>
        <CosmeticBadge badgeId={peerBadge} />
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted">No messages yet — say hi!</p>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((m) => {
              const isMine = m.direction === "sent";
              return (
                <div key={m.id} className={`flex flex-col ${isMine ? "items-end" : "items-start"}`}>
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 34 }}
                    className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                      isMine ? "bg-gradient-to-br from-accent-bright to-accent text-black" : "bg-surface-2 text-foreground"
                    }`}
                  >
                    {m.text}
                  </motion.div>
                  {m.clientId && (
                    <MessageReactions
                      reactions={reactions[m.clientId]}
                      myCode={myCode}
                      align={isMine ? "end" : "start"}
                      onToggle={(emoji) => toggleReaction(reactionsPath, m.clientId!, emoji, myCode)}
                    />
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        {!isFirebaseConfigured ? (
          <p className="text-center text-xs text-muted">
            Chat isn&apos;t set up yet — add your Firebase config to <code>.env</code> to send messages.
          </p>
        ) : (
          <div className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message…"
              className="input-field flex-1"
            />
            <button onClick={handleSend} className="btn-primary !px-4">
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
