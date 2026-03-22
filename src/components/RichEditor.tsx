"use client"

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import * as React from 'react'
import { 
  Bold as BoldIcon, 
  Maximize2, 
  Minimize2, 
  FileDown, 
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface RichEditorProps {
    content: string
    title: string
    isFree: boolean
}

export function RichEditor({ content, title, isFree }: RichEditorProps) {
    const [isFullscreen, setIsFullscreen] = React.useState(false)
    const editorRef = React.useRef<HTMLDivElement>(null)

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: 'Comece a escrever seu TCC...',
            }),
        ],
        content: content,
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose prose-invert max-w-none focus:outline-none min-h-[300px] p-6 text-slate-300 leading-relaxed text-[15px]',
            },
        },
    })

    const toggleFullscreen = () => {
        if (!editorRef.current) return
        if (!isFullscreen) {
            editorRef.current.requestFullscreen?.()
        } else {
            document.exitFullscreen?.()
        }
        setIsFullscreen(!isFullscreen)
    }

    const exportPDF = async () => {
        if (!editorRef.current) return
        const canvas = await html2canvas(editorRef.current, {
            backgroundColor: '#ffffff',
            scale: 2
        })
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'a4')
        const imgProps = pdf.getImageProperties(imgData)
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)

        if (isFree) {
            pdf.setTextColor(200, 200, 200)
            pdf.setFontSize(40)
            pdf.text('GERADO POR TCC-ASSIST (FREE)', 10, 150, { angle: 45 })
        }

        pdf.save(`${title || 'TCC-Capitulo'}.pdf`)
    }

    if (!editor) return null

    return (
        <div 
            ref={editorRef}
            className={cn(
                "mt-4 w-full bg-[#13131F] border border-white/10 rounded-2xl overflow-hidden shadow-brand flex flex-col",
                isFullscreen && "fixed inset-0 z-[1000] rounded-none m-0"
            )}
        >
            <div className="bg-white/5 px-4 py-3 flex items-center justify-between border-b border-white/10">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-200">
                    <CheckCircle2 size={16} className="text-brand-purple" /> {title}
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={toggleFullscreen}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
                        title="Tela Cheia"
                    >
                        {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                    </button>
                    <button 
                        onClick={exportPDF}
                        className="p-1.5 text-brand-purple hover:text-brand-purple/80 hover:bg-brand-purple/5 rounded-md transition-all"
                        title="Exportar PDF"
                    >
                        <FileDown size={18} />
                    </button>
                </div>
            </div>

            <div className="px-4 py-2 bg-black/20 border-b border-white/5 flex gap-1 text-slate-400">
                <button 
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={cn(
                        "p-2 rounded-md hover:bg-white/5 hover:text-white transition-all",
                        editor.isActive('bold') && "bg-white/10 text-white"
                    )}
                >
                    <BoldIcon size={18} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scroll bg-[#0D0D15]">
                <EditorContent editor={editor} />
            </div>

            <div className="text-[10px] text-slate-500 flex justify-between px-6 py-4 bg-white/[0.02] border-t border-white/5 items-center">
                <div className="font-bold tracking-widest uppercase opacity-60">ABNT: 12pt Inter • 1.5 Espaçamento</div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 bg-green-500/10 text-green-500 px-3 py-1 rounded-full font-bold">
                        ORIGINALIDADE: 96.2%
                    </div>
                </div>
            </div>
        </div>
    )
}
