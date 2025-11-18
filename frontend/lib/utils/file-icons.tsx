import { FileText, FileCode, Table, File } from 'lucide-react'
import { LucideIcon } from 'lucide-react'

export function getFileIcon(fileName: string): LucideIcon {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'pdf':
      return FileText
    case 'doc':
    case 'docx':
      return FileText
    case 'txt':
      return FileText
    case 'md':
    case 'markdown':
      return FileCode
    case 'csv':
      return Table
    default:
      return File
  }
}

export function getFileIconColor(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase()
  
  switch (extension) {
    case 'pdf':
      return 'text-red-500'
    case 'doc':
    case 'docx':
      return 'text-blue-500'
    case 'txt':
      return 'text-gray-500'
    case 'md':
    case 'markdown':
      return 'text-purple-500'
    case 'csv':
      return 'text-green-500'
    default:
      return 'text-muted-foreground'
  }
}


