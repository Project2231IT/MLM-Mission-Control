import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { createHash } from 'crypto'

const CONFIG_FILE = join(process.cwd(), 'nvrs.json')
const CACHE_DIR = join(process.cwd(), 'data', 'timeline-cache')

function loadConfig() {
  try { return JSON.parse(readFileSync(CONFIG_FILE, 'utf-8')) }
  catch { return { nvrs: [], cameras: [] } }
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'"
}

function hashKey(nvrId: string, channel: number, date: string, startTime: string, endTime: string): string {
  return createHash('md5').update(`${nvrId}-${channel}-${date}-${startTime}-${endTime}`).digest('hex')
}

async function fetchSnapshot(nvr: any, channel: number, date: string, timeHHMM: string, outFile: string): Promise<boolean> {
  const ip = nvr.ip as string
  const username = nvr.username as string
  const password = nvr.password as string
  const auth = username && password ? `${username}:${password}` : ''
  const prot = ((nvr.protocol as string) || '').toLowerCase()
  const model = ((nvr.model as string) || '').toLowerCase()
  const isTVT = prot === 'tvt' || prot === 'onvif' || model.includes('superlive') || model.includes('tvt') || model.includes('nvms')
  const isHik = prot === 'hikvision' || prot === 'isapi' || model.includes('hik') || model.includes('nr710')

  if (isTVT) {
    const rtsp = auth ? `rtsp://${auth}@${ip}:554/chID=${channel}&streamType=sub` : `rtsp://${ip}:554/chID=${channel}&streamType=sub`
    const cmd = `ffmpeg -rtsp_transport tcp -i ${shellEscape(rtsp)} -ss 1 -frames:v 1 -q:v 5 -y ${shellEscape(outFile)} 2>/dev/null`
    try {
      execSync(cmd, { timeout: 15000 })
      const stat = existsSync(outFile) ? readFileSync(outFile) : null
      return !!(stat && stat.length > 1000 && stat[0] === 0xFF && stat[1] === 0xD8)
    } catch { return false }
  }

  if (isHik) {
    const url = `http://${ip}/ISAPI/Streaming/channels/${channel * 100 + 1}/picture`
    const cmd = `curl -s --digest -u ${shellEscape(auth)} --connect-timeout 5 --max-time 10 -o ${shellEscape(outFile)} ${shellEscape(url)}`
    try {
      execSync(cmd, { timeout: 15000 })
      const stat = existsSync(outFile) ? readFileSync(outFile) : null
      return !!(stat && stat.length > 1000 && stat[0] === 0xFF && stat[1] === 0xD8)
    } catch { return false }
  }

  // Uniview / LAPI
  const snapshotUrl = `http://${ip}/LAPI/V1.0/Channels/${channel}/Media/Video/Streams/0/Snapshot`
  const cmd = `curl -s --digest -u ${shellEscape(auth)} --connect-timeout 5 --max-time 10 -o ${shellEscape(outFile)} ${shellEscape(snapshotUrl)}`
  try {
    execSync(cmd, { timeout: 15000 })
    const stat = existsSync(outFile) ? readFileSync(outFile) : null
    return !!(stat && stat.length > 1000 && stat[0] === 0xFF && stat[1] === 0xD8)
  } catch { return false }
}

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const sp = req.nextUrl.searchParams
  const nvrId = sp.get('nvrId')
  const channel = sp.get('channel')
  const date = sp.get('date')
  const startTime = sp.get('start') || '00:00'
  const endTime = sp.get('end') || '23:59'

  if (!nvrId || !channel || !date) {
    return new NextResponse('Missing nvrId, channel, or date', { status: 400 })
  }

  const config = loadConfig()
  const nvr = config.nvrs.find((n: any) => n.id === nvrId)
  if (!nvr) return new NextResponse('NVR not found', { status: 404 })

  const ch = parseInt(channel)
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true })

  const cacheKey = hashKey(nvrId, ch, date, startTime, endTime)
  const manifestFile = join(CACHE_DIR, `${cacheKey}.json`)

  // Return cached manifest if fresh (< 5 min old)
  if (existsSync(manifestFile)) {
    const age = Date.now() - require('fs').statSync(manifestFile).mtimeMs
    if (age < 300000) {
      const cached = JSON.parse(readFileSync(manifestFile, 'utf-8'))
      return NextResponse.json(cached)
    }
  }

  const [sh, sm] = (startTime || '00:00').split(':').map(Number)
  const [eh, em] = (endTime || '23:59').split(':').map(Number)
  const startMin = sh * 60 + sm
  const endMin = eh * 60 + em
  const intervalSec = 5

  const frames: Array<{ time: string; url: string; label: string }> = []
  const missing: string[] = []

  for (let min = startMin; min <= endMin; min += intervalSec) {
    const hh = String(Math.floor(min / 60)).padStart(2, '0')
    const mm = String(min % 60).padStart(2, '0')
    const timeStr = `${hh}:${mm}`
    const frameHash = createHash('md5').update(`${nvrId}-${ch}-${date}-${timeStr}`).digest('hex')
    const imgFile = join(CACHE_DIR, `${cacheKey}-${frameHash}.jpg`)

    if (existsSync(imgFile)) {
      const stat = require('fs').statSync(imgFile)
      if (stat.size > 1000 && stat.mtimeMs > Date.now() - 300000) {
        frames.push({ time: timeStr, url: `/api/timeline-img?file=${cacheKey}-${frameHash}.jpg`, label: `${hh}:${mm}` })
        continue
      }
    }
    missing.push(timeStr)
  }

  // Fetch missing snapshots in parallel batches of 4
  const BATCH = 4
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH)
    await Promise.all(batch.map(async (timeStr) => {
      const hh = timeStr.split(':')[0]
      const mm = timeStr.split(':')[1]
      const frameHash = createHash('md5').update(`${nvrId}-${ch}-${date}-${timeStr}`).digest('hex')
      const imgFile = join(CACHE_DIR, `${cacheKey}-${frameHash}.jpg`)
      const ok = await fetchSnapshot(nvr, ch, date, timeStr, imgFile)
      if (ok) {
        frames.push({ time: timeStr, url: `/api/timeline-img?file=${cacheKey}-${frameHash}.jpg`, label: `${hh}:${mm}` })
      }
    }))
    frames.sort((a, b) => a.time.localeCompare(b.time))
  }

  const manifest = { nvrId, channel: ch, date, startTime, endTime, intervalSec, generated: new Date().toISOString(), frames }
  writeFileSync(manifestFile, JSON.stringify(manifest))

  return NextResponse.json(manifest)
}
