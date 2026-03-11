"use client";

import { memo, useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  CircleDotIcon,
  SendIcon,
  UserIcon,
  BotIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  CheckIcon,
} from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, timeAgo } from "@/lib/utils";
import type { Thread, Comment } from "@/types";

/**
 * Lightweight markdown renderer for comment bodies.
 * Supports GFM: bold, italic, strikethrough, inline code,
 * fenced code blocks, links, lists, and task lists.
 */
const MarkdownBody = memo(function MarkdownBody({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Inline code — always renders as inline span
        code({ children, ...props }) {
          return (
            <code className="bg-muted/50 rounded px-1 py-0.5 text-[12px] font-mono" {...props}>
              {children}
            </code>
          );
        },
        // Fenced code blocks — pre wraps the code element
        pre({ children }) {
          return (
            <pre className="bg-muted/50 rounded-md p-2 text-[12px] font-mono overflow-x-auto my-1.5">
              {children}
            </pre>
          );
        },
        // Links open in new tab
        a({ href, children, ...props }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              {...props}
            >
              {children}
            </a>
          );
        },
        // Paragraphs: no extra margin for single-paragraph comments
        p({ children }) {
          return <p className="mb-1.5 last:mb-0">{children}</p>;
        },
        // Lists
        ul({ children }) {
          return <ul className="list-disc list-inside mb-1.5 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside mb-1.5 space-y-0.5">{children}</ol>;
        },
        // Blockquotes
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-primary/30 pl-2 italic text-muted-foreground my-1.5">
              {children}
            </blockquote>
          );
        },
      }}
    >
      {content}
    </Markdown>
  );
});

interface CommentThreadProps {
  thread: Thread;
  onAddComment: (threadId: string, body: string) => void;
  onEditComment?: (commentId: string, body: string) => void;
  onDeleteComment?: (commentId: string) => void;
  onResolve: (threadId: string, resolved: boolean) => void;
  isNew?: boolean;
  onCancelNew?: () => void;
  onSubmitNew?: (body: string) => void;
}

function CommentBubble({
  comment,
  onEdit,
  onDelete,
}: {
  comment: Comment;
  onEdit?: (commentId: string, body: string) => void;
  onDelete?: (commentId: string) => void;
}) {
  const isAI = comment.author === "ai";
  const canModify = !isAI && onEdit && onDelete;
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.body);

  useEffect(() => {
    if (!editing) return;
    editTextareaRef.current?.focus();
  }, [editing]);

  function handleSaveEdit() {
    if (!editText.trim()) return;
    onEdit?.(comment.id, editText.trim());
    setEditing(false);
  }

  function handleDelete() {
    if (!window.confirm("Delete this comment?")) return;
    onDelete?.(comment.id);
  }

  function handleEditKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
      setEditText(comment.body);
    }
  }

  return (
    <div className="flex gap-2.5 group/comment">
      <Avatar className="size-6 shrink-0 mt-0.5">
        <AvatarFallback
          className={cn(
            "text-[10px] font-bold",
            isAI ? "bg-violet-500/15 text-violet-400" : "bg-primary/15 text-primary",
          )}
        >
          {isAI ? <BotIcon className="size-3" /> : <UserIcon className="size-3" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={cn("text-[11px] font-semibold", isAI ? "text-violet-400" : "text-primary")}
          >
            {isAI ? "AI" : "You"}
          </span>
          <span className="text-[10px] text-muted-foreground/50">
            {timeAgo(comment.createdAt, true)}
          </span>

          {/* Edit/Delete actions — only for user comments */}
          {canModify && !editing && (
            <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover/comment:opacity-100 transition-opacity">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="size-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent transition-colors"
                      onClick={() => {
                        setEditing(true);
                        setEditText(comment.body);
                      }}
                    />
                  }
                >
                  <PencilIcon className="size-2.5" />
                </TooltipTrigger>
                <TooltipContent>Edit</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="size-5 rounded flex items-center justify-center text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      onClick={handleDelete}
                    />
                  }
                >
                  <Trash2Icon className="size-2.5" />
                </TooltipTrigger>
                <TooltipContent>Delete</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {editing ? (
          <div>
            <Textarea
              ref={editTextareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="min-h-[40px] text-[13px] bg-transparent border border-border/40 shadow-none resize-none focus-visible:ring-1 focus-visible:ring-ring/50 p-2 rounded-md"
              onKeyDown={handleEditKeyDown}
            />
            <div className="flex items-center justify-end gap-1.5 mt-1.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={() => {
                  setEditing(false);
                  setEditText(comment.body);
                }}
              >
                <XIcon className="size-3 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 text-[11px] px-2"
                onClick={handleSaveEdit}
                disabled={!editText.trim() || editText.trim() === comment.body}
              >
                <CheckIcon className="size-3 mr-1" />
                Save
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-[13px] text-foreground/90 leading-relaxed break-words">
            <MarkdownBody content={comment.body} />
          </div>
        )}
      </div>
    </div>
  );
}

export const CommentThread = memo(function CommentThread({
  thread,
  onAddComment,
  onEditComment,
  onDeleteComment,
  onResolve,
  isNew,
  onCancelNew,
  onSubmitNew,
}: CommentThreadProps) {
  const newTextareaRef = useRef<HTMLTextAreaElement>(null);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [replyText, setReplyText] = useState("");
  const [newText, setNewText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isResolved = thread.status === "resolved";
  const isMac = typeof navigator !== "undefined" && navigator.platform?.includes("Mac");
  const modKey = isMac ? "\u2318" : "Ctrl";

  useEffect(() => {
    if (isNew) {
      newTextareaRef.current?.focus();
    }
  }, [isNew]);

  useEffect(() => {
    if (!showReply) return;
    replyTextareaRef.current?.focus();
  }, [showReply]);

  function handleSubmitReply() {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    onAddComment(thread.id, replyText.trim());
    setReplyText("");
    setShowReply(false);
    // Reset submitting after a short delay (parent will refetch)
    setTimeout(() => setSubmitting(false), 500);
  }

  function handleSubmitNew() {
    if (!newText.trim() || submitting) return;
    setSubmitting(true);
    onSubmitNew?.(newText.trim());
    setNewText("");
    setTimeout(() => setSubmitting(false), 500);
  }

  function handleKeyDown(e: React.KeyboardEvent, onSubmit: () => void, onCancel?: () => void) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel?.();
    }
  }

  // Line range label
  const rangeLabel =
    thread.startLine && thread.endLine && thread.startLine !== thread.endLine
      ? `${thread.filePath.split("/").pop()}:${thread.startLine}-${thread.endLine}`
      : `${thread.filePath.split("/").pop()}:${thread.lineNumber}`;

  // New comment form (not yet created thread)
  if (isNew) {
    return (
      <div className="mx-4 my-2 rounded-lg border border-blue-500/30 bg-card/80 backdrop-blur-sm overflow-hidden shadow-lg shadow-blue-500/5">
        {/* Range label header */}
        <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
          <span className="text-[10px] font-mono text-muted-foreground/50">{rangeLabel}</span>
        </div>
        <div className="p-3 pt-2">
          <Textarea
            ref={newTextareaRef}
            placeholder="Leave a comment..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="min-h-[60px] text-[13px] bg-transparent border-none shadow-none resize-none focus-visible:ring-0 p-0"
            onKeyDown={(e) => handleKeyDown(e, handleSubmitNew, onCancelNew)}
          />
        </div>
        <div className="flex items-center justify-between px-3 pb-3">
          <span className="text-[10px] text-muted-foreground/50">
            {modKey}+Enter to submit &middot; Esc to cancel
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancelNew}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSubmitNew}
              disabled={!newText.trim() || submitting}
            >
              <SendIcon data-icon="inline-start" />
              Comment
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-4 my-2 rounded-lg border bg-card/80 backdrop-blur-sm overflow-hidden transition-all duration-200",
        isResolved ? "border-border/30 opacity-60 hover:opacity-100" : "border-border/60",
      )}
    >
      {/* Comments */}
      <div className="flex flex-col gap-3 p-3">
        {thread.comments.map((comment) => (
          <CommentBubble
            key={comment.id}
            comment={comment}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
          />
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between border-t border-border/30 px-3 py-2 bg-muted/20">
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => onResolve(thread.id, !isResolved)}
                />
              }
            >
              {isResolved ? (
                <CircleDotIcon className="size-3.5 text-muted-foreground" />
              ) : (
                <CheckCircle2Icon className="size-3.5 text-emerald-400" />
              )}
            </TooltipTrigger>
            <TooltipContent>{isResolved ? "Unresolve" : "Resolve"}</TooltipContent>
          </Tooltip>
        </div>

        {!isResolved && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-muted-foreground"
            onClick={() => setShowReply(!showReply)}
          >
            Reply
          </Button>
        )}
      </div>

      {/* Reply form */}
      {showReply && !isResolved && (
        <div className="border-t border-border/30 p-3">
          <Textarea
            ref={replyTextareaRef}
            placeholder="Reply to this thread..."
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="min-h-[48px] text-[13px] bg-transparent border-none shadow-none resize-none focus-visible:ring-0 p-0 mb-2"
            onKeyDown={(e) =>
              handleKeyDown(e, handleSubmitReply, () => {
                setShowReply(false);
                setReplyText("");
              })
            }
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/50">
              {modKey}+Enter &middot; Esc to cancel
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  setShowReply(false);
                  setReplyText("");
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSubmitReply}
                disabled={!replyText.trim() || submitting}
              >
                <SendIcon data-icon="inline-start" />
                Reply
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
