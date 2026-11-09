import { createContext, useContext } from 'react'
import type { DocumentRecord } from './backend'
export const DocumentContext = createContext<Record<string, DocumentRecord>>({})
export const useDocuments = () => useContext(DocumentContext)
