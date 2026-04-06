"use client"

import * as React from "react"
import { EditorContent, useEditor, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Image from "@tiptap/extension-image"
import { cn } from "@/lib/utils"
import {
  Bold as BoldIcon, Italic, Strikethrough, Heading1, Heading2,
  List, ListOrdered, Quote, Undo, Redo, ImageIcon, Loader2
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenuBarProps {
  editor: Editor | null
  tccId?: string
  onImageInserted?: () => void
  imageCount?: number
}

// ─── MenuBar ─────────────────────────────────────────────────────────────────

const MenuBar = ({ editor, tccId, onImageInserted, imageCount = 0 }: MenuBarProps) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const IMAGE_LIMIT = 10

  if (!editor) return null

  const Btn = ({
    onClick, isActive, disabled, title, children,
  }: {
    onClick: () => void
    isActive?: boolean
    disabled?: boolean
    title?: string
    children: React.ReactNode
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-1.5 rounded transition-colors text-[var(--brand-muted)] hover:text-[var(--brand-text)] hover:bg-[var(--brand-hover)]",
        isActive && "bg-[var(--brand-hover)] text-[var(--brand-text)]",
        disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-[var(--brand-muted)]"
      )}
    >
      {children}
    </button>
  )

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !tccId) return
    if (imageCount >= IMAGE_LIMIT) {
      alert(`Limite de ${IMAGE_LIMIT} imagens por TCC atingido.`)
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch(`/api/tcc/${tccId}/image`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.url) {
        editor.chain().focus().setImage({ src: data.url, alt: file.name }).run()
        onImageInserted?.()
      } else {
        alert(data.error ?? "Erro ao fazer upload da imagem.")
      }
    } catch {
      alert("Falha ao carregar imagem. Tente novamente.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const canInsertImage = !!tccId && imageCount < IMAGE_LIMIT

  return (
    <div className="flex flex-wrap items-center gap-1 px-3 py-2 bg-[var(--brand-surface)] border-b border-[var(--brand-border)] sticky top-0 z-20">
      {/* Text formatting */}
      <div className="flex items-center gap-0.5 border-r border-[var(--brand-border)] pr-2 mr-1">
        <Btn onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive("bold")} title="Negrito (Ctrl+B)">
          <BoldIcon size={14} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive("italic")} title="Itálico (Ctrl+I)">
          <Italic size={14} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive("strike")} title="Tachado">
          <Strikethrough size={14} />
        </Btn>
      </div>

      {/* Headings */}
      <div className="flex items-center gap-0.5 border-r border-[var(--brand-border)] pr-2 mr-1">
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive("heading", { level: 1 })} title="Título H1">
          <Heading1 size={14} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive("heading", { level: 2 })} title="Título H2">
          <Heading2 size={14} />
        </Btn>
      </div>

      {/* Lists */}
      <div className="flex items-center gap-0.5 border-r border-[var(--brand-border)] pr-2 mr-1">
        <Btn onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive("bulletList")} title="Lista com marcadores">
          <List size={14} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive("orderedList")} title="Lista numerada">
          <ListOrdered size={14} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive("blockquote")} title="Citação">
          <Quote size={14} />
        </Btn>
      </div>

      {/* History */}
      <div className="flex items-center gap-0.5 border-r border-[var(--brand-border)] pr-2 mr-1">
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Desfazer (Ctrl+Z)">
          <Undo size={14} />
        </Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Refazer (Ctrl+Y)">
          <Redo size={14} />
        </Btn>
      </div>

      {/* Image upload */}
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={() => tccId && fileInputRef.current?.click()}
          disabled={!canInsertImage || uploading}
          title={
            !tccId ? "Salve o documento primeiro" :
            imageCount >= IMAGE_LIMIT ? `Limite de ${IMAGE_LIMIT} imagens atingido` :
            `Inserir imagem (${imageCount}/${IMAGE_LIMIT})`
          }
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors",
            canInsertImage && !uploading
              ? "text-[var(--brand-muted)] hover:text-[var(--brand-accent)] hover:bg-[var(--brand-hover)] cursor-pointer"
              : "text-[var(--brand-muted)]/30 cursor-not-allowed"
          )}
        >
          {uploading
            ? <Loader2 size={13} className="animate-spin" />
            : <ImageIcon size={13} />
          }
          <span className="hidden sm:inline">
            {uploading ? "Enviando..." : `Imagem ${imageCount}/${IMAGE_LIMIT}`}
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function EditableRichText({
  value,
  onChange,
  className,
  editorRef,
  tccId,
  imageCount,
  onImageInserted,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
  editorRef?: React.MutableRefObject<Editor | null>
  tccId?: string
  imageCount?: number
  onImageInserted?: () => void
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Comece a escrever ou use a IA para gerar conteúdo..." }),
      Image.configure({
        inline: false,
        allowBase64: false,
        HTMLAttributes: {
          class: "rounded-lg max-w-full my-4 shadow-sm border border-[var(--brand-border)]",
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[400px] p-8 sm:px-14 sm:py-12 text-[15.5px] sm:text-[16px] leading-[1.9] focus:outline-none text-[var(--brand-text)] font-serif max-w-none " +
          "[&_p]:my-4 [&_p]:text-justify " +
          "[&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:font-sans [&_h1]:mb-6 [&_h1]:mt-10 [&_h1]:text-[var(--brand-text)] " +
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:font-sans [&_h2]:mb-4 [&_h2]:mt-8 [&_h2]:text-[var(--brand-text)] " +
          "[&_h3]:text-lg [&_h3]:font-bold [&_h3]:font-sans [&_h3]:mb-3 [&_h3]:mt-6 [&_h3]:text-[var(--brand-text)] " +
          "[&_ul]:list-disc [&_ul]:ml-7 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:ml-7 [&_ol]:my-4 [&_li]:mb-1.5 [&_li]:pl-1 " +
          "[&_blockquote]:border-l-4 [&_blockquote]:border-[var(--brand-accent)]/30 [&_blockquote]:pl-6 [&_blockquote]:pr-2 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:my-6 [&_blockquote]:text-[var(--brand-muted)] " +
          "[&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-6 [&_img]:shadow-sm",
      },
    },
  })

  React.useEffect(() => {
    if (editorRef) editorRef.current = editor
  }, [editor, editorRef])

  React.useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) editor.commands.setContent(value)
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={cn("flex flex-col w-full", className)}>
      <MenuBar
        editor={editor}
        tccId={tccId}
        imageCount={imageCount}
        onImageInserted={onImageInserted}
      />
      <div className="flex-1 w-full">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
