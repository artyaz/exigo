"use client";

import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Upload,
  BrainCircuit,
  Loader2,
  BookOpen,
} from "lucide-react";
import { addKnowledgePieceAction, bulkImportKnowledgeAction } from "../../actions/knowledge";
import {
  appearsToBeCsvWithWrongHeaders,
  parseCsvKnowledgePieces,
  parseDelimiterKnowledgePieces,
  type BulkImportPiece,
} from "~/lib/bulkImportParser";

const MAX_BULK_UPLOAD_BYTES = 9 * 1024 * 1024;

interface KnowledgeTabProps {
  spaceId: Id<"spaces">;
  userId: string | null | undefined;
  pieces: Doc<"knowledgePieces">[];
  onViewPiece: (pieceId: string) => void;
}

export function KnowledgeTab({
  spaceId,
  userId,
  pieces,
  onViewPiece,
}: KnowledgeTabProps) {
  const updateTitle = useMutation(api.knowledgePieces.updateTitle);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const [knowledgeMode, setKnowledgeMode] = useState<"add" | "bulk">("add");
  const [content, setContent] = useState("");
  const [title, setTitle] = useState("");
  const [source, setSource] = useState("");
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkFileContent, setBulkFileContent] = useState("");
  const [delimiter, setDelimiter] = useState(String.raw`\n\n`);
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsAdding(true);

    try {
      const pieceId = await addKnowledgePieceAction(
        spaceId,
        content,
        title.trim() || undefined,
        source.trim() || undefined,
      );

      // Auto-generate title if not provided
      if (!title.trim()) {
        fetch("/api/knowledge/title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.slice(0, 2000) }),
        })
          .then((res) => res.json() as Promise<{ title?: string }>)
          .then((data) => {
            if (!userId) {
              return;
            }
            if (data.title && data.title !== "Untitled") {
              void updateTitle({
                id: pieceId as Id<"knowledgePieces">,
                title: data.title,
              });
            }
          })
          .catch(() => {
            /* silent */
          });
      }

      setContent("");
      setTitle("");
      setSource("");
    } catch (err) {
      console.error("Failed to add piece", err);
      alert((err as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBulkFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      setBulkFileName("");
      setBulkFileContent("");
      return;
    }

    if (file.size > MAX_BULK_UPLOAD_BYTES) {
      setBulkFileName("");
      setBulkFileContent("");
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = "";
      }
      alert("File is too large. Maximum supported upload size is 9 MB.");
      return;
    }

    try {
      const text = await file.text();
      setBulkFileName(file.name);
      setBulkFileContent(text);
    } catch (error) {
      console.error("Failed to read bulk import file", error);
      setBulkFileName("");
      setBulkFileContent("");
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = "";
      }
      alert("Could not read selected file. Please try another file.");
    }
  };

  const handleBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkFileContent.trim()) return;
    setIsAdding(true);
    try {
      const resolvedSource = source.trim() || undefined;
      const csvPieces = parseCsvKnowledgePieces(
        bulkFileContent,
        resolvedSource,
      );
      if (!csvPieces && appearsToBeCsvWithWrongHeaders(bulkFileContent)) {
        throw new Error("CSV format is invalid. Expected headers: Content,Name");
      }

      const structuredPieces: BulkImportPiece[] =
        csvPieces ??
        parseDelimiterKnowledgePieces(
          bulkFileContent,
          delimiter,
          resolvedSource,
        );
      if (structuredPieces.length === 0) {
        throw new Error("No importable knowledge pieces found.");
      }

      const ids = await bulkImportKnowledgeAction(spaceId, structuredPieces);

      // Auto-generate titles only for entries that did not provide a title.
      structuredPieces.forEach((piece, i) => {
        if (ids[i] && !piece.title?.trim()) {
          void fetch("/api/knowledge/title", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: piece.content.slice(0, 2000) }),
          })
            .then((res) => res.json() as Promise<{ title?: string }>)
            .then((data) => {
              if (userId && data.title && data.title !== "Untitled") {
                void updateTitle({
                  id: ids[i] as Id<"knowledgePieces">,
                  title: data.title,
                });
              }
            })
            .catch(() => {
              /* silent */
            });
        }
      });

      setBulkFileContent("");
      setBulkFileName("");
      if (bulkFileInputRef.current) {
        bulkFileInputRef.current.value = "";
      }
      setKnowledgeMode("add");
    } catch (error) {
      console.error("Failed to bulk import knowledge", error);
      alert((error as Error).message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Add / Bulk mode toggle */}
      <section className="glass-card rounded-2xl p-6 space-y-5">
        <div className="flex gap-4 border-b border-white/10 pb-3">
          <button
            onClick={() => setKnowledgeMode("add")}
            className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[13px] flex items-center gap-1.5 ${knowledgeMode === "add" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
          >
            <Plus className="w-3 h-3" /> Add Piece
          </button>
          <button
            onClick={() => setKnowledgeMode("bulk")}
            className={`pb-2 font-medium text-sm transition-colors border-b-2 -mb-[13px] flex items-center gap-1.5 ${knowledgeMode === "bulk" ? "border-white text-primary" : "border-transparent text-secondary hover:text-primary"}`}
          >
            <Upload className="w-3 h-3" /> Bulk Import
          </button>
        </div>

        <AnimatePresence mode="wait">
          {knowledgeMode === "add" ? (
            <motion.form
              key="add"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              onSubmit={handleAdd}
              className="space-y-4"
            >
              <input
                type="text"
                placeholder="Title (auto-generated if empty)"
                className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                placeholder="Type or paste a piece of knowledge here..."
                className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl p-4 focus-ring spring-interact min-h-[150px] resize-y text-sm placeholder:text-neutral-600"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Source (Optional)"
                  className="flex-1 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
                <button
                  disabled={isAdding || !content.trim()}
                  type="submit"
                  className="bg-white text-black font-medium px-6 py-2.5 rounded-xl spring-interact flex items-center justify-center gap-2 disabled:opacity-50 text-sm hover:opacity-90"
                >
                  {isAdding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Add
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="bulk"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              onSubmit={handleBulkImport}
              className="space-y-4"
            >
              <p className="text-secondary text-xs">
                Upload a text or CSV file. CSV format must use headers:{" "}
                <span className="text-primary">Content,Name</span>.
              </p>
              <div className="space-y-2">
                <input
                  ref={bulkFileInputRef}
                  type="file"
                  accept=".csv,.txt,.md,text/csv,text/plain"
                  className="w-full bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm file:mr-3 file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black hover:file:opacity-90"
                  onChange={handleBulkFileChange}
                />
                {bulkFileName && (
                  <p className="text-[11px] text-white/50 truncate">
                    Selected file:{" "}
                    <span className="text-white/75">{bulkFileName}</span>
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Delimiter"
                  className="w-1/3 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Source (Optional)"
                  className="w-2/3 bg-neutral-950 border border-white/10 text-primary rounded-xl px-4 py-2.5 focus-ring spring-interact text-sm placeholder:text-neutral-600"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                />
              </div>
              <button
                disabled={isAdding || !bulkFileContent.trim()}
                type="submit"
                className="w-full bg-white text-black font-medium py-3 rounded-xl spring-interact flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 text-sm"
              >
                {isAdding ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                Process & Import
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      {/* Knowledge pieces list */}
      <section className="space-y-4">
        <h2 className="text-sm font-medium flex items-center gap-2 text-secondary">
          <BookOpen className="w-4 h-4" /> Knowledge Base
          <span className="text-[10px] font-mono text-tertiary bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-md">
            {pieces.length}
          </span>
        </h2>
        {pieces.length === 0 ? (
          <div className="glass-card border-dashed rounded-2xl p-12 text-center text-secondary flex flex-col items-center gap-4">
            <BrainCircuit className="w-10 h-10 opacity-30" />
            <p className="text-sm">
              This space is empty. Add some knowledge above.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {pieces
              .slice()
              .reverse()
              .map((piece) => (
                <button
                  key={piece._id}
                  type="button"
                  onClick={() => onViewPiece(String(piece._id))}
                  className="glass-card rounded-xl p-4 hover:bg-white/5 transition-colors cursor-pointer relative group text-left"
                >
                  {piece.title && (
                    <p className="text-xs text-white/50 font-semibold uppercase tracking-widest mb-1.5 pr-24">
                      {piece.title}
                    </p>
                  )}
                  <p className="text-secondary text-sm leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {piece.content}
                  </p>
                  {piece.source && (
                    <p className="text-xs text-tertiary mt-2 font-mono truncate">
                      Src: <span className="text-secondary">{piece.source}</span>
                    </p>
                  )}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="px-2 py-1 rounded-md bg-white/5 text-white/40 border border-white/10 flex items-center gap-1.5 text-[10px] uppercase font-semibold tracking-widest hover:text-white hover:bg-white/10 transition-colors">
                      <BrainCircuit className="w-3 h-3" />
                      Nodes
                    </div>
                  </div>
                </button>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
