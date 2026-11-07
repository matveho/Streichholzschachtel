import { createContext, useContext } from 'react'
import { documents } from './data'
import type { DocumentRecord } from './backend'
export const DocumentContext =
  createContext<Record<string, DocumentRecord>>(documents)
export const useDocuments = () => useContext(DocumentContext)
