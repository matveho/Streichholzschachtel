import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  renameSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

if (!process.argv[2])
  throw new Error('Supply the local verifier model directory explicitly.')
const directory = resolve(process.argv[2])
mkdirSync(directory, { recursive: true })
const repo = 'cross-encoder/nli-deberta-v3-small'
const revision = 'fa2804872c3b4bd748f38c0185cc85775361e735'
const files = [
  [
    'config.json',
    'config.json',
    '885d0dceae8fa5c136da9209121ec9eb11160488e840de3bc1f29353674e5712',
  ],
  [
    'tokenizer.json',
    'tokenizer.json',
    '5124ef2ead1a10a717703bc436de7f353da76d6340e4587719b42b1693707964',
  ],
  [
    'onnx/model_quint8_avx2.onnx',
    'model.onnx',
    '03c2221313dc0c3eac9cec1f746d1319d33f2c2901fcce1c0f08f4daac9b6dae',
  ],
]
async function digest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}
for (const [remote, name, expected] of files) {
  const destination = resolve(directory, name)
  if (existsSync(destination) && (await digest(destination)) === expected)
    continue
  const disk = statfsSync(directory)
  if (Number(disk.bavail) * Number(disk.bsize) < 512 * 1024 * 1024)
    throw new Error(
      'At least 512 MB of free space is required on the selected cache drive.',
    )
  const response = await fetch(
    `https://huggingface.co/${repo}/resolve/${revision}/${remote}`,
  )
  if (!response.ok)
    throw new Error(`Verifier download failed: ${response.status}`)
  const temporary = destination + '.download'
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary))
  if ((await digest(temporary)) !== expected)
    throw new Error(
      'Verifier file checksum does not match the pinned revision.',
    )
  renameSync(temporary, destination)
  console.log('Prepared', name)
}
writeFileSync(
  resolve(directory, 'source.json'),
  JSON.stringify(
    {
      repo,
      revision,
      localOnly: true,
      files: Object.fromEntries(
        files.map(([, name, sha256]) => [name, sha256]),
      ),
    },
    null,
    2,
  ),
)
console.log('Local verifier files passed their checksum checks.')
