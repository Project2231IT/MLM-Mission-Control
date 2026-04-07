import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const CACHE_DIR = join(process.cwd(), 'data', 'timeline-cache')

export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return new NextResponse('Unauthorized', { status: 401 })

  const sp = req.nextUrl.searchParams
  const file = sp.get('file') // just the filename

  if (!file || file.includes('..') || file.includes('/')) {
    return new NextResponse('Invalid file', { status: 400 })
  }

  const filePath = join(CACHE_DIR, file)
  if (!existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const data = readFileSync(filePath)
  if (data.length < 1000 || data[0] !== 0xFF || data[1] !== 0xD8) {
    return new NextResponse('Invalid image', { status: 400 })
  }

  return new NextResponse(data, {
    headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'public, max-age=300' },
  })
}
