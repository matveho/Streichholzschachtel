import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

if (!process.argv[2])
  throw new Error('Supply the model-cache directory explicitly.')
const directory = resolve(process.argv[2])
mkdirSync(directory, { recursive: true })
const files = [
  {
    name: 'llama-b12196-cpu-x64.zip',
    url: 'https://github.com/ggml-org/llama.cpp/releases/download/b12196/llama-b12196-bin-win-cpu-x64.zip',
    sha256: '688354b5a7c125e88b3b05c67de1728fc7580e539d6647a729dffc6f724be098',
    size: 24758999,
  },
  {
    name: 'llama-b12196-vulkan-x64.zip',
    url: 'https://github.com/ggml-org/llama.cpp/releases/download/b12196/llama-b12196-bin-win-vulkan-x64.zip',
    sha256: '0a42c15e235b3cefe535e93dc9fef85a22b6934d5014f0a528acf1e302975054',
    size: 37715732,
  },
  {
    name: 'qwen3.5-4b.gguf',
    url: 'https://registry.ollama.ai/v2/library/qwen3.5/blobs/sha256:a9d0a3e1d8c91732a3812becd31f8d4a8ff57414903f226306069f0437e2ac50',
    sha256: 'a9d0a3e1d8c91732a3812becd31f8d4a8ff57414903f226306069f0437e2ac50',
    size: 2648593216,
  },
  {
    name: 'qwen3.5-license.txt',
    url: 'https://registry.ollama.ai/v2/library/qwen3.5/blobs/sha256:50cbab8a892c5f2993b8c7351a99182507472def3b1374558308605d99b86b32',
    sha256: '50cbab8a892c5f2993b8c7351a99182507472def3b1374558308605d99b86b32',
    size: 11343,
  },
]
async function digest(file) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(file)) hash.update(chunk)
  return hash.digest('hex')
}
for (const file of files) {
  const destination = resolve(directory, file.name)
  if (existsSync(destination) && (await digest(destination)) === file.sha256) {
    console.log(`Verified ${file.name}`)
    continue
  }
  const disk = statfsSync(directory)
  if (Number(disk.bavail) * Number(disk.bsize) < file.size + 512 * 1024 * 1024)
    throw new Error('Insufficient space on the selected cache drive.')
  const response = await fetch(file.url, {
    signal: AbortSignal.timeout(900000),
  })
  if (!response.ok || !response.body)
    throw new Error(`Download failed: ${file.name} (${response.status})`)
  const pending = destination + '.download'
  await pipeline(Readable.fromWeb(response.body), createWriteStream(pending))
  if ((await digest(pending)) !== file.sha256)
    throw new Error(`Checksum mismatch: ${file.name}`)
  renameSync(pending, destination)
  console.log(`Prepared ${file.name}`)
}
writeFileSync(
  resolve(directory, 'qwen35-source.json'),
  JSON.stringify(
    {
      model: 'Qwen/Qwen3.5-4B',
      runtime: 'ggml-org/llama.cpp b12196',
      localOnly: true,
      files,
    },
    null,
    2,
  ),
)
