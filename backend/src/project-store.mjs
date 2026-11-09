import {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} from 'node:fs'
import { resolve, basename } from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { demoProjects } from '../demo/manifest.mjs'
import { referenceCollections } from './reference-collections.mjs'
import { SearchIndex } from './search.mjs'
import { describeProject } from './project-description.mjs'
import { finishImport } from './project-imports.mjs'

export function problem(status, message) {
  return Object.assign(new Error(message), { status })
}
export function scopedCorpus(corpus, ids) {
  if (!Array.isArray(ids)) throw problem(400, 'A document scope is required.')
  const allowed = new Set(ids)
  return {
    ...corpus,
    documents: corpus.documents.filter((d) => allowed.has(d.id)),
    passages: corpus.passages.filter((p) => allowed.has(p.doc)),
    units: (corpus.units || []).filter((u) => allowed.has(u.doc)),
    failures: [],
  }
}
export class ProjectStore {
  constructor(corpus, directory) {
    this.corpus = corpus
    this.directory = resolve(directory)
    mkdirSync(this.directory, { recursive: true })
    this.file = resolve(this.directory, 'projects.json')
    this.collections = referenceCollections(corpus)
    this.documents = new Map(corpus.documents.map((d) => [d.id, d]))
    this.restoreSeeds()
    const existing = this.read()
    let migrated = false
    for (const project of existing.projects) {
      if (typeof project.persistOnReset !== 'boolean') {
        project.persistOnReset = !!project.protectedDemo
        migrated = true
      }
      if (project.descriptionMode) continue
      project.descriptionMode = project.description?.trim() ? 'manual' : 'auto'
      if (project.descriptionMode === 'auto')
        project.description = describeProject(
          project.documentIds
            .map((id) => this.documents.get(id))
            .filter(Boolean),
          this.collections.filter((c) => project.collectionIds.includes(c.id)),
        )
      migrated = true
    }
    if (migrated) this.write(existing)
    const pending = corpus.documents.filter(
      (d) => d.importPending && d.ownerProjectId,
    )
    for (const doc of pending) {
      const project = this.list().find((p) => p.id === doc.ownerProjectId)
      if (!project) continue
      if (!project.documentIds.includes(doc.id))
        this.attach(project.id, [doc], corpus)
      finishImport(project.id, doc.filePath)
    }
  }
  read() {
    if (!existsSync(this.file)) return { version: 1, projects: [] }
    for (const file of [this.file, this.file + '.bak']) {
      try {
        const value = JSON.parse(readFileSync(file, 'utf8'))
        if (value.version === 1 && Array.isArray(value.projects)) return value
      } catch {
        /* Try the previous complete write before declaring corruption. */
      }
    }
    throw problem(
      503,
      'Project storage could not be read. Restore projects.json from its backup.',
    )
  }
  write(value) {
    if (existsSync(this.file)) {
      try {
        const previous = readFileSync(this.file, 'utf8')
        JSON.parse(previous)
        writeFileSync(this.file + '.bak', previous)
      } catch {
        /* Never overwrite a valid backup with corrupt data. */
      }
    }
    writeFileSync(this.file + '.tmp', JSON.stringify(value, null, 2))
    renameSync(this.file + '.tmp', this.file)
  }
  selection(collectionIds, documentIds, privateIds = []) {
    if (
      !Array.isArray(collectionIds) ||
      collectionIds.some((id) => !this.collections.some((c) => c.id === id))
    )
      throw problem(400, 'Choose known Reference Collections.')
    const candidates = new Set([
      ...this.collections
        .filter((c) => collectionIds.includes(c.id))
        .flatMap((c) => c.documentIds),
      ...privateIds,
    ])
    const ids = documentIds === undefined ? [...candidates] : documentIds
    if (
      !Array.isArray(ids) ||
      ids.some((id) => !candidates.has(id) || !this.documents.has(id))
    )
      throw problem(
        400,
        'Selected documents must belong to the chosen collections or this project.',
      )
    return [...new Set(ids)]
  }
  seed(spec) {
    const privateIds = this.corpus.documents
      .filter((d) => d.ownerProjectId === spec.id)
      .map((d) => d.id)
    return {
      id: spec.id,
      name: spec.name,
      client: spec.client,
      description: spec.description,
      descriptionMode: 'manual',
      location: spec.location,
      discipline: spec.discipline,
      protectedDemo: true,
      persistOnReset: true,
      collectionIds: [...spec.collectionIds],
      documentIds: this.selection(spec.collectionIds, undefined, privateIds),
      issueStates: {},
      savedQueryIds: [],
      revision: 1,
      createdAt: '2026-11-06T16:00:00.000Z',
      updatedAt: '2026-11-06T16:00:00.000Z',
    }
  }
  restoreSeeds() {
    const data = this.read()
    let changed = false
    for (const spec of demoProjects) {
      const canonical = this.seed(spec),
        matches = data.projects.filter((p) => p.id === spec.id)
      if (!matches.length) {
        data.projects.push(canonical)
        changed = true
        continue
      }
      const previous = matches[0]
      const documentIds = [
        ...new Set([
          ...canonical.documentIds,
          ...(previous.documentIds || []).filter(
            (id) =>
              this.documents.has(id) &&
              (!this.documents.get(id).ownerProjectId ||
                this.documents.get(id).ownerProjectId === spec.id),
          ),
        ]),
      ]
      const collectionIds = [
        ...new Set([
          ...canonical.collectionIds,
          ...(previous.collectionIds || []).filter((id) =>
            this.collections.some((c) => c.id === id),
          ),
        ]),
      ]
      const restored = {
        ...previous,
        ...canonical,
        documentIds,
        collectionIds,
        issueStates: previous.issueStates || {},
        savedQueryIds: previous.savedQueryIds || [],
        description:
          previous.descriptionMode === 'auto'
            ? describeProject(
                documentIds.map((id) => this.documents.get(id)),
                this.collections.filter((c) => collectionIds.includes(c.id)),
              )
            : previous.descriptionMode === 'manual'
              ? previous.description
              : canonical.description,
        descriptionMode: previous.descriptionMode || 'manual',
        revision: previous.revision || 1,
        createdAt: previous.createdAt || canonical.createdAt,
        updatedAt: previous.updatedAt || canonical.updatedAt,
      }
      if (
        JSON.stringify(previous) !== JSON.stringify(restored) ||
        matches.length !== 1
      ) {
        restored.revision++
        data.projects = data.projects.filter((p) => p.id !== spec.id)
        data.projects.push(restored)
        changed = true
      }
    }
    if (changed || !existsSync(this.file)) this.write(data)
  }
  list() {
    const order = new Map(demoProjects.map((p, i) => [p.id, i]))
    return this.read().projects.sort(
      (a, b) =>
        (order.get(a.id) ?? demoProjects.length) -
        (order.get(b.id) ?? demoProjects.length),
    )
  }
  get(id) {
    const project = this.list().find((p) => p.id === id)
    if (!project) throw problem(404, 'Project not found.')
    return project
  }
  create(input) {
    if (
      input.persistOnReset !== undefined &&
      typeof input.persistOnReset !== 'boolean'
    )
      throw problem(400, 'persistOnReset must be a boolean.')
    const name = String(input.name || '').trim()
    if (!name || name.length > 100)
      throw problem(400, 'Enter a project name of 1 to 100 characters.')
    const collectionIds = input.collectionIds || []
    const documentIds = this.selection(collectionIds, input.documentIds)
    const now = new Date().toISOString()
    const project = {
      id: randomUUID(),
      name,
      client: String(input.client || '')
        .trim()
        .slice(0, 150),
      location: String(input.location || '')
        .trim()
        .slice(0, 150),
      description: String(
        input.description ||
          describeProject(
            documentIds.map((id) => this.documents.get(id)),
            this.collections.filter((c) => collectionIds.includes(c.id)),
          ),
      )
        .trim()
        .slice(0, 1000),
      discipline: 'Engineering research',
      descriptionMode: input.description?.trim() ? 'manual' : 'auto',
      protectedDemo: false,
      persistOnReset: input.persistOnReset === true,
      collectionIds: [...new Set(collectionIds)],
      documentIds,
      issueStates: {},
      savedQueryIds: [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    }
    const data = this.read()
    data.projects.push(project)
    this.write(data)
    return project
  }
  update(id, input) {
    const project = this.get(id)
    if (
      input.persistOnReset !== undefined &&
      typeof input.persistOnReset !== 'boolean'
    )
      throw problem(400, 'persistOnReset must be a boolean.')
    if (project.protectedDemo && input.persistOnReset === false)
      throw problem(
        403,
        'Built-in demonstration projects must persist on reset.',
      )
    if (input.protectedDemo !== undefined || input.id !== undefined)
      throw problem(400, 'Project identity and protection cannot be changed.')
    const collections = input.collectionIds ?? project.collectionIds
    const privateIds = project.documentIds.filter(
      (id) => this.documents.get(id)?.ownerProjectId === project.id,
    )
    const documentIds = this.selection(
      collections,
      input.documentIds ??
        (input.collectionIds ? undefined : project.documentIds),
      privateIds,
    )
    if (project.protectedDemo) {
      const required = this.seed(demoProjects.find((p) => p.id === id))
      if (required.documentIds.some((id) => !documentIds.includes(id)))
        throw problem(
          403,
          'The demonstration document set is protected. Create a project to customize it.',
        )
    }
    const next = {
      ...project,
      persistOnReset:
        project.protectedDemo ||
        (input.persistOnReset ?? project.persistOnReset ?? false),
      collectionIds: [...new Set(collections)],
      documentIds,
      revision: project.revision + 1,
      updatedAt: new Date().toISOString(),
    }
    for (const field of ['name', 'client', 'description', 'location'])
      if (input[field] !== undefined) {
        if (project.protectedDemo && field !== 'description')
          throw problem(403, 'Demonstration metadata is protected.')
        if (
          typeof input[field] !== 'string' ||
          input[field].length > (field === 'description' ? 1000 : 150)
        )
          throw problem(400, 'Invalid project metadata.')
        next[field] = input[field].trim()
        if (field === 'description')
          next.descriptionMode = next.description ? 'manual' : 'auto'
      }
    if (!next.name) throw problem(400, 'Project name is required.')
    if (next.descriptionMode === 'auto')
      next.description = describeProject(
        documentIds.map((id) => this.documents.get(id)),
        this.collections.filter((c) => collections.includes(c.id)),
      )
    const data = this.read()
    data.projects = data.projects.map((p) => (p.id === id ? next : p))
    this.write(data)
    return next
  }
  remove(id) {
    const project = this.get(id)
    if (project.protectedDemo)
      throw problem(403, 'Demonstration projects cannot be deleted.')
    const data = this.read()
    data.projects = data.projects.filter((p) => p.id !== id)
    this.write(data)
  }
  attach(id, records, corpus) {
    if (records.some((d) => d.ownerProjectId !== id))
      throw problem(400, 'Imported documents must belong to this project.')
    const data = this.read(),
      project = data.projects.find((p) => p.id === id)
    if (!project) throw problem(404, 'Project not found.')
    project.documentIds = [
      ...new Set([...project.documentIds, ...records.map((d) => d.id)]),
    ]
    project.revision++
    if (project.descriptionMode === 'auto')
      project.description = describeProject(
        project.documentIds.map((id) =>
          corpus.documents.find((d) => d.id === id),
        ),
        this.collections.filter((c) => project.collectionIds.includes(c.id)),
      )
    this.write(data)
    this.corpus = corpus
    this.documents = new Map(corpus.documents.map((d) => [d.id, d]))
    return project
  }
  reset(id) {
    const spec = demoProjects.find((p) => p.id === id)
    if (!spec)
      throw problem(400, 'Only demonstration projects have a reset state.')
    const data = this.read(),
      previous = this.get(id),
      seed = this.seed(spec)
    seed.revision = previous.revision + 1
    data.projects = data.projects.map((p) => (p.id === id ? seed : p))
    this.write(data)
    return seed
  }
  setIssue(id, issueId, status, comparisonIds = []) {
    if (!['open', 'dismissed'].includes(status))
      throw problem(400, 'Issue status must be open or dismissed.')
    if (
      !comparisonIds.includes(issueId) &&
      !demoProjects
        .find((p) => p.id === id)
        ?.issues.some((i) => i.id === issueId)
    )
      throw problem(404, 'Finding not found.')
    const data = this.read(),
      project = data.projects.find((p) => p.id === id)
    if (!project) throw problem(404, 'Project not found.')
    project.issueStates[issueId] = {
      status,
      updatedAt: new Date().toISOString(),
    }
    this.write(data)
    return project.issueStates[issueId]
  }
  saveQuery(id, queryId, saved) {
    if (typeof saved !== 'boolean')
      throw problem(400, 'saved must be a boolean.')
    const data = this.read(),
      project = data.projects.find((p) => p.id === id)
    if (!project) throw problem(404, 'Project not found.')
    project.savedQueryIds = saved
      ? [...new Set([...project.savedQueryIds, queryId])]
      : project.savedQueryIds.filter((q) => q !== queryId)
    this.write(data)
  }
  scope(id, selection) {
    const project = this.get(id),
      ids = selection === undefined ? project.documentIds : selection
    if (
      !Array.isArray(ids) ||
      ids.some(
        (doc) =>
          !project.documentIds.includes(doc) ||
          !this.documents.has(doc) ||
          (this.documents.get(doc).ownerProjectId &&
            this.documents.get(doc).ownerProjectId !== id),
      )
    )
      throw problem(
        400,
        'Query documents must be associated with this project.',
      )
    const corpus = scopedCorpus(this.corpus, [...new Set(ids)])
    const version = createHash('sha256')
      .update(
        JSON.stringify([
          project.id,
          [...project.documentIds].sort(),
          corpus.documents
            .map((d) => [d.id, d.version, d.extractionVersion || '',d.category || ''])
            .sort(),
        ]),
      )
      .digest('hex')
    let index
    return {
      project,
      corpus,
      get index() {
        return (index ||= new SearchIndex(corpus))
      },
      version,
    }
  }
  document(id, docId) {
    if (!this.get(id).documentIds.includes(docId))
      throw problem(404, 'Document is not part of this project.')
    const doc = this.documents.get(docId)
    if (!doc || (doc.ownerProjectId && doc.ownerProjectId !== id))
      throw problem(404, 'Document not found.')
    const { filePath, ...record } = doc
    return {
      ...record,
      filename: doc.originalFilename || basename(filePath),
      category: doc.projectArtifact ? doc.category : 'reference',
      file: `/v1/projects/${id}/documents/${docId}/file`,
      ...(doc.modelFile
        ? { model: `/v1/projects/${id}/documents/${docId}/model` }
        : {}),
    }
  }
}
