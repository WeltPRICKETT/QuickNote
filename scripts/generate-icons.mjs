import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const iconDir = join(root, 'src-tauri', 'icons')
mkdirSync(iconDir, { recursive: true })

const size = 256
const pixels = Buffer.alloc(size * size * 4)

for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const dx = x - size / 2
    const dy = y - size / 2
    const distance = Math.sqrt(dx * dx + dy * dy)
    const radius = size * 0.43
    const edge = Math.max(0, Math.min(1, radius - distance))
    const i = (y * size + x) * 4

    const paper = [255, 253, 247]
    const accent = [188, 77, 39]
    const ink = [22, 18, 12]
    const stripe = Math.abs(dx + dy) < 20 || Math.abs(dx + dy - 42) < 9
    const fill = stripe ? accent : distance < radius * 0.62 ? paper : ink

    pixels[i] = fill[2]
    pixels[i + 1] = fill[1]
    pixels[i + 2] = fill[0]
    pixels[i + 3] = edge <= 0 ? 0 : 255
  }
}

const xor = Buffer.alloc(size * size * 4)
for (let y = 0; y < size; y += 1) {
  const sourceStart = (size - 1 - y) * size * 4
  pixels.copy(xor, y * size * 4, sourceStart, sourceStart + size * 4)
}

const maskStride = Math.ceil(size / 32) * 4
const mask = Buffer.alloc(maskStride * size)
const dib = Buffer.alloc(40)
dib.writeUInt32LE(40, 0)
dib.writeInt32LE(size, 4)
dib.writeInt32LE(size * 2, 8)
dib.writeUInt16LE(1, 12)
dib.writeUInt16LE(32, 14)
dib.writeUInt32LE(0, 16)
dib.writeUInt32LE(xor.length + mask.length, 20)

const image = Buffer.concat([dib, xor, mask])
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)

const directory = Buffer.alloc(16)
directory.writeUInt8(0, 0)
directory.writeUInt8(0, 1)
directory.writeUInt8(0, 2)
directory.writeUInt8(0, 3)
directory.writeUInt16LE(1, 4)
directory.writeUInt16LE(32, 6)
directory.writeUInt32LE(image.length, 8)
directory.writeUInt32LE(header.length + directory.length, 12)

writeFileSync(join(iconDir, 'icon.ico'), Buffer.concat([header, directory, image]))
