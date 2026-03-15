"use client"

import * as React from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import Bold from "@tiptap/extension-bold"
import { cn } from "@/lib/utils"

export function EditableRichText({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (next: string) => void
  className?: string
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Bold,
      Placeholder.configure({ placeholder: "Edite o texto com suas palavras..." }),
    ],
    content: value,
    immediatelyRender: false,
    onUpdate({ editor }) {
      // Store as plain text to keep autosave/simple stats predictable
      onChange(editor.getText())
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[300px] p-5 text-[15px] leading-relaxed focus:outline-none text-brand-text",
      },
    },
  })

  React.useEffect(() => {
    if (!editor) return
    const current = editor.getText()
    if (current !== value) editor.commands.setContent(value)
  }, [editor, value])

  if (!editor) return null

  return (
    <div className={cn("rounded-2xl overflow-hidden border border-brand-border bg-brand-bg shadow-brand", className)}>
      <EditorContent editor={editor} />
    </div>
  )
}
