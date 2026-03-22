"use client"

import * as React from "react"
import { EditorContent, useEditor, Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { cn } from "@/lib/utils"
import { 
  Bold as BoldIcon, Italic, Strikethrough, Heading1, Heading2, 
  List, ListOrdered, Quote, Undo, Redo 
} from "lucide-react"

const MenuBar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) return null

  const EditorButton = ({ onClick, isActive, disabled, children }: { onClick: () => void, isActive?: boolean, disabled?: boolean, children: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "p-1.5 rounded transition-colors text-slate-400 hover:text-white hover:bg-white/[0.08]",
        isActive ? "bg-white/[0.12] text-white" : "",
        disabled ? "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-slate-400" : ""
      )}
    >
      {children}
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-[#1A1A18]/95 backdrop-blur-md border-b border-white/[0.06] rounded-t-2xl sticky top-0 z-20 shadow-sm">
      <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
        <EditorButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')}>
          <BoldIcon size={15} />
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')}>
          <Italic size={15} />
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')}>
          <Strikethrough size={15} />
        </EditorButton>
      </div>

      <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
        <EditorButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })}>
          <Heading1 size={15} />
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })}>
          <Heading2 size={15} />
        </EditorButton>
      </div>

      <div className="flex items-center gap-1 border-r border-white/10 pr-2 mr-1">
        <EditorButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')}>
          <List size={15} />
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')}>
          <ListOrdered size={15} />
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')}>
          <Quote size={15} />
        </EditorButton>
      </div>

      <div className="flex items-center gap-1">
        <EditorButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().chain().focus().undo().run()}>
          <Undo size={15} />
        </EditorButton>
        <EditorButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().chain().focus().redo().run()}>
          <Redo size={15} />
        </EditorButton>
      </div>
    </div>
  )
}

export function EditableRichText({
  value,
  onChange,
  className,
  editorRef,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
  editorRef?: React.MutableRefObject<Editor | null>
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Edite o texto com suas palavras..." }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[400px] p-8 sm:px-14 sm:py-12 text-[15.5px] sm:text-[16px] leading-[1.85] focus:outline-none text-white/90 font-serif max-w-none " +
          "[&_p]:my-4 [&_p]:text-justify [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:tracking-tight [&_h1]:font-sans [&_h1]:mb-6 [&_h1]:mt-8 " +
          "[&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-tight [&_h2]:font-sans [&_h2]:mb-4 [&_h2]:mt-8 " +
          "[&_h3]:text-lg [&_h3]:font-bold [&_h3]:font-sans [&_h3]:mb-3 [&_h3]:mt-6 " +
          "[&_ul]:list-disc [&_ul]:ml-7 [&_ul]:my-4 [&_ol]:list-decimal [&_ol]:ml-7 [&_ol]:my-4 [&_li]:mb-1.5 [&_li]:pl-1 " +
          "[&_blockquote]:border-l-4 [&_blockquote]:border-amber-500/40 [&_blockquote]:pl-6 [&_blockquote]:pr-2 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:my-6 [&_blockquote]:text-white/60",
      },
    },
  })

  React.useEffect(() => {
    if (editorRef) {
      editorRef.current = editor
    }
  }, [editor, editorRef])

  React.useEffect(() => {
    if (!editor) return
    const current = editor.getHTML()
    if (current !== value) editor.commands.setContent(value)
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={cn("rounded-2xl overflow-hidden border border-white/[0.08] bg-[#111110] shadow-brand flex flex-col", className)}>
      <MenuBar editor={editor} />
      <div className="flex-1 overflow-y-auto w-full custom-scroll bg-[#111110]">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
