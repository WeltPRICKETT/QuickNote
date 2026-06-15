import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const iconDir = join(root, 'src-tauri', 'icons')
mkdirSync(iconDir, { recursive: true })

function makePixels(size) {
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
      const stripe = Math.abs(dx + dy) < size * 0.078 || Math.abs(dx + dy - size * 0.164) < size * 0.035
      const fill = stripe ? accent : distance < radius * 0.62 ? paper : ink

      pixels[i] = fill[2]
      pixels[i + 1] = fill[1]
      pixels[i + 2] = fill[0]
      pixels[i + 3] = edge <= 0 ? 0 : 255
    }
  }

  return pixels
}

const size = 256
const pixels = makePixels(size)

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

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  const crc = Buffer.alloc(4)
  length.writeUInt32BE(data.length, 0)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0)
  return Buffer.concat([length, typeBuffer, data, crc])
}

function writePng(path, width, height, rgba) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.writeUInt8(8, 8)
  header.writeUInt8(6, 9)
  header.writeUInt8(0, 10)
  header.writeUInt8(0, 11)
  header.writeUInt8(0, 12)

  const rows = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1)
    rows[rowStart] = 0
    rgba.copy(rows, rowStart + 1, y * width * 4, (y + 1) * width * 4)
  }

  writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(rows)),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  )
}

function bgraToRgba(bgra) {
  const rgba = Buffer.alloc(bgra.length)
  for (let i = 0; i < bgra.length; i += 4) {
    rgba[i] = bgra[i + 2]
    rgba[i + 1] = bgra[i + 1]
    rgba[i + 2] = bgra[i]
    rgba[i + 3] = bgra[i + 3]
  }
  return rgba
}

writePng(join(iconDir, 'icon.png'), size, size, bgraToRgba(pixels))
writePng(join(iconDir, '32x32.png'), 32, 32, bgraToRgba(makePixels(32)))
writePng(join(iconDir, '128x128.png'), 128, 128, bgraToRgba(makePixels(128)))
writePng(join(iconDir, '128x128@2x.png'), 256, 256, bgraToRgba(pixels))

const iconsetDir = join(iconDir, 'icon.iconset')
rmSync(iconsetDir, { recursive: true, force: true })
mkdirSync(iconsetDir, { recursive: true })
writePng(join(iconsetDir, 'icon_16x16.png'), 16, 16, bgraToRgba(makePixels(16)))
writePng(join(iconsetDir, 'icon_16x16@2x.png'), 32, 32, bgraToRgba(makePixels(32)))
writePng(join(iconsetDir, 'icon_32x32.png'), 32, 32, bgraToRgba(makePixels(32)))
writePng(join(iconsetDir, 'icon_32x32@2x.png'), 64, 64, bgraToRgba(makePixels(64)))
writePng(join(iconsetDir, 'icon_128x128.png'), 128, 128, bgraToRgba(makePixels(128)))
writePng(join(iconsetDir, 'icon_128x128@2x.png'), 256, 256, bgraToRgba(pixels))
