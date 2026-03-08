/**
 * Generate PNG logo variants and favicons from SVG sources.
 *
 * Usage: npx --package=sharp -c "node media/generate.mjs"
 *
 * All logos use the same single-line wordmark: "stripe" + "402"
 * matching the website header style.
 */
import sharp from 'sharp'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Brand colors
const NAVY = '#0A2540'
const WHITE = '#FFFFFF'
const BLACK = '#000000'
const PURPLE = '#635BFF'

// ── SVG builders ──

/** Rectangular / minimal wordmark — wide aspect ratio with tight padding */
function makeRectSvg({ textFill, accentFill, width = 960, height = 200 }) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <text x="32" y="136" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="600" font-size="112" letter-spacing="-2">
    <tspan fill="${textFill}">stripe</tspan><tspan fill="${accentFill}">402</tspan>
  </text>
</svg>`)
}

/** Square wordmark — same horizontal text, centered in a square canvas */
function makeSquareSvg({ textFill, accentFill, size = 1024 }) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <text x="512" y="556" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="600" font-size="180" letter-spacing="-4">
    <tspan fill="${textFill}">stripe</tspan><tspan fill="${accentFill}">402</tspan>
  </text>
</svg>`)
}

// ── Helpers ──

async function generatePng(svgBuffer, outPath, opts = {}) {
  const { bg, width, height } = opts
  let pipeline = sharp(svgBuffer)

  if (bg) {
    pipeline = pipeline.flatten({ background: bg })
  }

  if (width || height) {
    pipeline = pipeline.resize(width, height, { fit: 'contain', background: bg || { r: 0, g: 0, b: 0, alpha: 0 } })
  }

  await pipeline.png().toFile(outPath)
  console.log(`  ✓ ${outPath}`)
}

/** Create a minimal ICO file from PNG buffers */
function createIco(pngBuffers, sizes) {
  const numImages = pngBuffers.length
  const headerSize = 6
  const dirEntrySize = 16
  const dataOffset = headerSize + numImages * dirEntrySize

  let totalSize = dataOffset
  for (const buf of pngBuffers) totalSize += buf.length

  const ico = Buffer.alloc(totalSize)

  ico.writeUInt16LE(0, 0)       // reserved
  ico.writeUInt16LE(1, 2)       // type: ICO
  ico.writeUInt16LE(numImages, 4)

  let offset = dataOffset
  for (let i = 0; i < numImages; i++) {
    const dirOffset = headerSize + i * dirEntrySize
    const size = sizes[i] >= 256 ? 0 : sizes[i]
    ico.writeUInt8(size, dirOffset)
    ico.writeUInt8(size, dirOffset + 1)
    ico.writeUInt8(0, dirOffset + 2)
    ico.writeUInt8(0, dirOffset + 3)
    ico.writeUInt16LE(1, dirOffset + 4)
    ico.writeUInt16LE(32, dirOffset + 6)
    ico.writeUInt32LE(pngBuffers[i].length, dirOffset + 8)
    ico.writeUInt32LE(offset, dirOffset + 12)

    pngBuffers[i].copy(ico, offset)
    offset += pngBuffers[i].length
  }

  return ico
}

// ── Main ──

async function main() {
  const outDir = __dirname

  // ── Rectangular logos ──
  console.log('Generating rectangular logos...')

  // Dark text — transparent (text only, no background)
  const rectDark = makeRectSvg({ textFill: NAVY, accentFill: PURPLE })
  await generatePng(rectDark, join(outDir, 'logo-rectangular-transparent.png'))

  // Dark text on white background
  await generatePng(rectDark, join(outDir, 'logo-rectangular-on-white.png'), { bg: WHITE })

  // Light text on dark backgrounds
  const rectLight = makeRectSvg({ textFill: WHITE, accentFill: PURPLE })
  await generatePng(rectLight, join(outDir, 'logo-rectangular-on-navy.png'), { bg: NAVY })
  await generatePng(rectLight, join(outDir, 'logo-rectangular-on-black.png'), { bg: BLACK })

  // ── Square logos ──
  console.log('\nGenerating square logos...')

  // Dark text — transparent (text only, no background)
  const sqDark = makeSquareSvg({ textFill: NAVY, accentFill: PURPLE })
  await generatePng(sqDark, join(outDir, 'logo-square-transparent.png'))

  // Dark text on white background
  await generatePng(sqDark, join(outDir, 'logo-square-on-white.png'), { bg: WHITE })

  // Light text on dark backgrounds
  const sqLight = makeSquareSvg({ textFill: WHITE, accentFill: PURPLE })
  await generatePng(sqLight, join(outDir, 'logo-square-on-navy.png'), { bg: NAVY })
  await generatePng(sqLight, join(outDir, 'logo-square-on-black.png'), { bg: BLACK })

  // ── Favicons ──
  console.log('\nGenerating favicons...')

  const faviconDir = join(dirname(__dirname), 'apps', 'website', 'public')
  mkdirSync(faviconDir, { recursive: true })

  // SVG favicon — transparent background, dark text wordmark
  const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
  <text x="16" y="21.5" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="13" letter-spacing="-0.3">
    <tspan fill="${NAVY}">s</tspan><tspan fill="${PURPLE}">402</tspan>
  </text>
</svg>`
  writeFileSync(join(faviconDir, 'favicon.svg'), faviconSvg)
  console.log(`  ✓ ${join(faviconDir, 'favicon.svg')}`)

  // PNG favicons — transparent background, dark text wordmark
  const faviconBaseSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <text x="256" y="310" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="120" letter-spacing="-3">
    <tspan fill="${NAVY}">stripe</tspan><tspan fill="${PURPLE}">402</tspan>
  </text>
</svg>`)

  for (const size of [16, 32, 48, 180, 192, 512]) {
    const name = size === 180 ? 'apple-touch-icon.png' : `favicon-${size}x${size}.png`
    await sharp(faviconBaseSvg)
      .resize(size, size)
      .png()
      .toFile(join(faviconDir, name))
    console.log(`  ✓ ${join(faviconDir, name)}`)
  }

  // ICO
  const ico16 = await sharp(faviconBaseSvg).resize(16, 16).png().toBuffer()
  const ico32 = await sharp(faviconBaseSvg).resize(32, 32).png().toBuffer()
  const icoBuffer = createIco([ico16, ico32], [16, 32])
  writeFileSync(join(faviconDir, 'favicon.ico'), icoBuffer)
  console.log(`  ✓ ${join(faviconDir, 'favicon.ico')}`)

  // OG image
  const ogSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${NAVY}"/>
  <text x="600" y="340" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="600" font-size="96" letter-spacing="-2">
    <tspan fill="${WHITE}">stripe</tspan><tspan fill="${PURPLE}">402</tspan>
  </text>
  <text x="600" y="420" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="400" font-size="32" fill="#ADBDCC">HTTP 402 Payments with Stripe</text>
</svg>`)
  await generatePng(ogSvg, join(faviconDir, 'og-image.png'))

  // ── Twitter/X banner (1500x500) ──
  console.log('\nGenerating Twitter banner...')

  const TEAL = '#00D4AA'
  const TEXT_SECONDARY = '#ADBDCC'
  const TEXT_TERTIARY = '#7B8FA0'
  const PURPLE_DIM = 'rgba(99,91,255,0.12)'
  const TEAL_DIM = 'rgba(0,212,170,0.06)'
  const CYAN_DIM = 'rgba(128,233,255,0.06)'

  const twitterSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500" viewBox="0 0 1500 500">
  <defs>
    <radialGradient id="g1" cx="75%" cy="20%" r="50%">
      <stop offset="0%" stop-color="${PURPLE_DIM}"/>
      <stop offset="40%" stop-color="${TEAL_DIM}"/>
      <stop offset="70%" stop-color="transparent"/>
    </radialGradient>
    <radialGradient id="g2" cx="20%" cy="90%" r="45%">
      <stop offset="0%" stop-color="${CYAN_DIM}"/>
      <stop offset="60%" stop-color="transparent"/>
    </radialGradient>
  </defs>

  <!-- Background -->
  <rect width="1500" height="500" fill="${NAVY}"/>
  <rect width="1500" height="500" fill="url(#g1)"/>
  <rect width="1500" height="500" fill="url(#g2)"/>

  <!-- Left side: wordmark + tagline -->
  <text x="100" y="200" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="700" font-size="72" letter-spacing="-2">
    <tspan fill="${WHITE}">stripe</tspan><tspan fill="${PURPLE}">402</tspan>
  </text>
  <text x="100" y="255" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-weight="400" font-size="26" fill="${TEXT_SECONDARY}" letter-spacing="0">Agentic payments made easy.</text>

  <!-- Divider line -->
  <line x1="100" y1="290" x2="700" y2="290" stroke="#1D3A56" stroke-width="1"/>

  <!-- Three feature pills -->
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="17" font-weight="500">
    <text x="120" y="338" fill="${TEAL}">No signup</text>
    <text x="320" y="338" fill="${TEXT_TERTIARY}">Identity from card fingerprint via HMAC</text>

    <text x="120" y="378" fill="${TEAL}">Credit card rails</text>
    <text x="320" y="378" fill="${TEXT_TERTIARY}">Powered by Stripe. No crypto, no wallets.</text>

    <text x="120" y="418" fill="${TEAL}">Agent-native</text>
    <text x="320" y="418" fill="${TEXT_TERTIARY}">AI agents pay for APIs on first request</text>
  </g>

  <!-- Bullet dots -->
  <circle cx="104" cy="333" r="3" fill="${TEAL}"/>
  <circle cx="104" cy="373" r="3" fill="${TEAL}"/>
  <circle cx="104" cy="413" r="3" fill="${TEAL}"/>

  <!-- Right side: protocol snippet -->
  <g transform="translate(830, 120)">
    <!-- Code card background -->
    <rect width="570" height="280" rx="12" fill="#0E2F4F" stroke="#1D3A56" stroke-width="1"/>

    <!-- Title bar -->
    <rect width="570" height="40" rx="12" fill="#0E2F4F"/>
    <rect y="28" width="570" height="12" fill="#0E2F4F"/>
    <line x1="0" y1="40" x2="570" y2="40" stroke="#1D3A56" stroke-width="1"/>
    <circle cx="24" cy="20" r="4.5" fill="#1D4D74"/>
    <circle cx="40" cy="20" r="4.5" fill="#1D4D74"/>
    <circle cx="56" cy="20" r="4.5" fill="#1D4D74"/>
    <text x="84" y="25" font-family="JetBrains Mono, SF Mono, Fira Code, monospace" font-size="11" fill="${TEXT_TERTIARY}">server.ts</text>

    <!-- Code lines -->
    <g font-family="JetBrains Mono, SF Mono, Fira Code, monospace" font-size="14.5">
      <text x="24" y="75">
        <tspan fill="#FF7B72">import</tspan><tspan fill="${TEXT_SECONDARY}"> { paymentRequired } </tspan><tspan fill="#FF7B72">from</tspan>
      </text>
      <text x="24" y="100">
        <tspan fill="#A5D6FF">'@stripe402/express'</tspan>
      </text>

      <text x="24" y="140" fill="${TEXT_TERTIARY}">// One middleware. $0.01 per request.</text>

      <text x="24" y="175">
        <tspan fill="${TEXT_SECONDARY}">app.</tspan><tspan fill="#D2A8FF">use</tspan><tspan fill="${TEXT_SECONDARY}">(</tspan><tspan fill="#A5D6FF">'/api/weather'</tspan><tspan fill="${TEXT_SECONDARY}">,</tspan>
      </text>
      <text x="24" y="200">
        <tspan fill="${TEXT_SECONDARY}">  </tspan><tspan fill="#D2A8FF">paymentRequired</tspan><tspan fill="${TEXT_SECONDARY}">({ </tspan><tspan fill="#FFA657">price</tspan><tspan fill="${TEXT_SECONDARY}">: </tspan><tspan fill="#79C0FF">100</tspan><tspan fill="${TEXT_SECONDARY}"> })</tspan>
      </text>
      <text x="24" y="225">
        <tspan fill="${TEXT_SECONDARY}">)</tspan>
      </text>
    </g>
  </g>

  <!-- Bottom-right: URL -->
  <text x="1400" y="475" text-anchor="end" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="16" font-weight="500" fill="${TEXT_TERTIARY}">stripe402.com</text>
</svg>`)

  await generatePng(twitterSvg, join(outDir, 'twitter-banner.png'))

  console.log('\nDone!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
