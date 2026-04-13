"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  Trash2,
  Plus,
  Brain,
} from "lucide-react";
import { useMutation } from "convex/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface CourseTutorProps {
  spaceId: Id<"spaces">;
  courseId?: Id<"courses">;
}

type ToolAction = {
  id: string;
  name: string;
  success?: boolean;
  message?: string;
};

function getSseString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function CourseTutor({ spaceId, courseId }: CourseTutorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState<Id<"courseTutorChats"> | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [toolActions, setToolActions] = useState<ToolAction[]>([]);
  const [showChatList, setShowChatList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use course-scoped or space-scoped chat list depending on context
  const courseChats = useQuery(
    api.courseTutor.getChatsForCourse,
    courseId ? { courseId } : "skip",
  );
  const spaceChats = useQuery(
    api.courseTutor.getChatsForSpace,
    !courseId ? { spaceId } : "skip",
  );
  const chats = courseId ? courseChats : spaceChats;
  const messages = useQuery(
    api.courseTutor.getMessages,
    activeChatId ? { chatId: activeChatId } : "skip",
  );
  const deleteChat = useMutation(api.courseTutor.deleteChat);

  // Auto-select most recent chat on initial load only
  const hasAutoSelectedRef = useRef(false);
  useEffect(() => {
    if (chats && chats.length > 0 && !hasAutoSelectedRef.current) {
      hasAutoSelectedRef.current = true;
      setActiveChatId(chats[0]!._id);
    }
  }, [chats]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setInput(e.target.value);
      const ta = e.target;
      ta.style.height = "auto";
      ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    // Abort any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setInput("");
    setIsStreaming(true);
    setStreamingContent("");
    setToolActions([]);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const res = await fetch("/api/learn/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          spaceId,
          courseId: courseId ?? undefined,
          chatId: activeChatId ?? undefined,
          message: text,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Tutor request failed: ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";
      let nextToolActionIndex = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const eventBlocks = buffer.split("\n\n");
        // Keep last incomplete block in buffer
        buffer = eventBlocks.pop() ?? "";

        for (const block of eventBlocks) {
          if (!block.trim()) continue;
          let eventType = "";
          let dataStr = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) dataStr = line.slice(6);
          }
          if (!eventType || !dataStr) continue;

          try {
            const data = JSON.parse(dataStr) as Record<string, unknown>;
            if (eventType === "delta" && typeof data.text === "string") {
              accumulated += data.text;
              setStreamingContent(accumulated);
            } else if (eventType === "chat_created" && typeof data.chatId === "string") {
              setActiveChatId(data.chatId as Id<"courseTutorChats">);
            } else if (eventType === "tool_call") {
              const toolName = getSseString(data.name) ?? "tool";
              const toolId =
                getSseString(data.id) ?? `${toolName}-${nextToolActionIndex++}`;

              setToolActions((prev) => [
                ...prev,
                { id: toolId, name: toolName },
              ]);
            } else if (eventType === "tool_result") {
              const toolName = getSseString(data.name) ?? "tool";
              const toolId = getSseString(data.id);
              const toolMessage = getSseString(data.message) ?? "";

              setToolActions((prev) => {
                const updated = [...prev];
                const targetIndex = toolId
                  ? updated.findIndex((action) => action.id === toolId)
                  : updated.findIndex(
                      (action) =>
                        action.name === toolName &&
                        action.success === undefined,
                    );

                if (targetIndex >= 0) {
                  updated[targetIndex] = {
                    ...updated[targetIndex]!,
                    success: data.success === true,
                    message: toolMessage,
                  };
                }

                return updated;
              });
            } else if (eventType === "error") {
              // Error already shown via streaming UI
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch {
      // Stream aborted or network error — UI resets via finally
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [input, isStreaming, spaceId, courseId, activeChatId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleNewChat = useCallback(() => {
    setActiveChatId(null);
    setShowChatList(false);
    setInput("");
    setStreamingContent("");
    setToolActions([]);
  }, []);

  const handleDeleteChat = useCallback(
    async (chatId: Id<"courseTutorChats">) => {
      await deleteChat({ chatId });
      if (activeChatId === chatId) {
        setActiveChatId(null);
      }
    },
    [deleteChat, activeChatId],
  );

  // Filter out system messages from display
  const visibleMessages = (messages ?? []).filter(
    (m: { role: string }) => m.role !== "system",
  );

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-40 rounded-full p-3.5 bg-white/10 border border-white/10 backdrop-blur-md
          hover:bg-white/15 hover:border-white/20 transition-all shadow-lg ${isOpen ? "hidden" : ""}`}
        title="Ask AI Tutor"
      >
        <Brain className="w-5 h-5 text-white" />
      </button>

      {/* Slide-out panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[420px] z-50 flex flex-col bg-[#0a0a0a] border-l border-white/10"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-violet-400" />
                <span className="text-sm font-semibold text-white">AI Tutor</span>
                {activeChatId && (
                  <button
                    onClick={() => setShowChatList(!showChatList)}
                    className="text-xs text-white/40 hover:text-white/60 ml-2 transition-colors"
                  >
                    {showChatList ? "Hide chats" : "All chats"}
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleNewChat}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  title="New chat"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-md hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Chat list dropdown */}
            <AnimatePresence>
              {showChatList && chats && chats.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b border-white/10"
                >
                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                    {chats.map((chat: { _id: Id<"courseTutorChats">; title: string }) => (
                      <button
                        key={chat._id}
                        type="button"
                        className={`flex items-center justify-between w-full text-left px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                          activeChatId === chat._id
                            ? "bg-white/10 text-white"
                            : "text-white/60 hover:bg-white/5 hover:text-white/80"
                        }`}
                        onClick={() => {
                          setActiveChatId(chat._id);
                          setShowChatList(false);
                          setToolActions([]);
                          setStreamingContent("");
                        }}
                      >
                        <span className="truncate flex-1 mr-2">
                          <MessageCircle className="w-3 h-3 inline mr-1.5 opacity-50" />
                          {chat.title}
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDeleteChat(chat._id);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleDeleteChat(chat._id);
                            }
                          }}
                          className="p-1 rounded hover:bg-white/10 text-white/30 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {visibleMessages.length === 0 && !streamingContent && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
                  <Brain className="w-10 h-10 text-violet-400/50" />
                  <p className="text-white/50 text-sm">
                    {courseId
                      ? "Ask me anything about this course — concepts, clarifications, practice problems, or study strategies."
                      : "Ask me anything about your learning — I have context across all your courses, knowledge, and progress."}
                  </p>
                  <p className="text-white/30 text-xs">
                    I remember what you&apos;ve learned and where you&apos;ve struggled.
                  </p>
                </div>
              )}

              {visibleMessages.map((msg: { _id: string; role: string; content: string }) => (
                <div
                  key={msg._id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-violet-500/20 text-white/90 rounded-br-md"
                        : "bg-white/5 text-white/80 rounded-bl-md"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="tutor-response prose prose-invert prose-sm max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Tool action indicators */}
              {toolActions.length > 0 && (
                <div className="space-y-1.5">
                  {toolActions.map((action) => (
                    <div key={action.id} className="flex items-center gap-2 text-xs text-white/50 px-2">
                      {action.success === undefined ? (
                        <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
                      ) : action.success ? (
                        <span className="text-emerald-400">✓</span>
                      ) : (
                        <span className="text-red-400">✗</span>
                      )}
                      <span className="text-white/40">
                        {action.name.replace(/_/g, " ")}
                        {action.message ? `: ${action.message}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Streaming response */}
              {streamingContent && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed bg-white/5 text-white/80 rounded-bl-md">
                    <div className="tutor-response prose prose-invert prose-sm max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {isStreaming && !streamingContent && (
                <div className="flex justify-start">
                  <div className="rounded-2xl px-4 py-2.5 bg-white/5 rounded-bl-md">
                    <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="border-t border-white/10 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask something..."
                  rows={1}
                  disabled={isStreaming}
                  className="flex-1 resize-none bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30
                    focus:outline-none focus:border-white/20 disabled:opacity-50 max-h-[120px]"
                />
                <button
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isStreaming}
                  className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[10px] text-white/20 mt-1.5 text-center">
                Shift+Enter for new line · Enter to send
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/40 z-40 sm:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
