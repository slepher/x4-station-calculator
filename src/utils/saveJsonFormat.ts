import type { SaveArchive, SectorData, SaveSource } from '@/types/saveArchive'

export interface ExportJsonData {
  meta: SaveArchive['meta']
  sectors: Record<string, SectorData>
}

export function validateImportJson(data: unknown): { valid: boolean; error?: string; data?: ExportJsonData } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid JSON format' }
  }

  const obj = data as Record<string, unknown>

  if (!obj.meta || typeof obj.meta !== 'object') {
    return { valid: false, error: 'Missing meta information' }
  }

  const meta = obj.meta as Record<string, unknown>

  if (typeof meta.guid !== 'string' || !meta.guid) {
    return { valid: false, error: 'Missing or invalid guid' }
  }

  if (typeof meta.seed !== 'number') {
    return { valid: false, error: 'Missing or invalid seed' }
  }

  if (typeof meta.time !== 'number') {
    return { valid: false, error: 'Missing or invalid time' }
  }

  if (typeof meta.version !== 'string' || !meta.version) {
    return { valid: false, error: 'Missing or invalid version' }
  }

  if (!obj.sectors || typeof obj.sectors !== 'object') {
    return { valid: false, error: 'Missing sectors data' }
  }

  return {
    valid: true,
    data: {
      meta: {
        guid: meta.guid,
        seed: meta.seed,
        time: meta.time,
        playerName: typeof meta.playerName === 'string' ? meta.playerName : '',
        version: meta.version,
        filename: typeof meta.filename === 'string' ? meta.filename : '',
        parser_version: meta.parser_version === 'v1' ? 'v1' : 'v1',
        source: (typeof meta.source === 'string' ? meta.source : 'imported') as SaveSource
      },
      sectors: obj.sectors as Record<string, SectorData>
    }
  }
}

export function createExportData(archive: SaveArchive): ExportJsonData {
  return {
    meta: archive.meta,
    sectors: archive.sectors
  }
}

export function generateExportFileName(meta: SaveArchive['meta']): string {
  const safeName = meta.playerName.replace(/[^\w\-]/g, '_')
  const shortGuid = meta.guid.slice(0, 8)
  return `${safeName}_${shortGuid}_${meta.seed}.json`
}
