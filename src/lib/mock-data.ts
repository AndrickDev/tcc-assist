export const mockHistory = [
  { id: "1", title: "TCC Direito Penal LGBT", date: "Hoje" },
  { id: "2", title: "TCC ADM Marketing", date: "Ontem" },
  { id: "3", title: "TCC TI DevOps", date: "Anterior" },
]

export const mockTemplates = [
  "Direito", "ADM", "TI", "Saúde", "Educação"
]

export const mockRefs = [
  { id: "1", author: "Silva, J.", year: "2023", title: "Introdução ao Direito." },
  { id: "2", author: "Costa, M.", year: "2022", title: "Marketing Digital Moderno." },
  { id: "3", author: "ABNT NBR", year: "2024", title: "Normas para TCCs." },
]

export interface ChatMessage {
  id: string
  role: "user" | "bot"
  content: string
  timestamp?: string
  hasEditor?: boolean
  chapterTitle?: string
  editorContent?: string
}

export const initialChatMessages: ChatMessage[] = [
  {
    id: "bot-1",
    role: "bot",
    content: "Olá! Qual é o tema do seu TCC?",
  }
]
