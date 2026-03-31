import { describe, it, expect } from '@jest/globals'
import { parseFigmaUrl, figmaResourceKey } from '../lib/figma-url.js'
import { ResourceType } from '@figma-jira/shared-types'

describe('parseFigmaUrl', () => {
  describe('FILE links', () => {
    it('parses a /design/ URL with no node-id as FILE', () => {
      const result = parseFigmaUrl('https://www.figma.com/design/abc123/My-File')
      expect(result.fileKey).toBe('abc123')
      expect(result.nodeId).toBeNull()
      expect(result.resourceType).toBe(ResourceType.FILE)
    })

    it('parses a legacy /file/ URL as FILE', () => {
      const result = parseFigmaUrl('https://www.figma.com/file/abc123/My-File')
      expect(result.fileKey).toBe('abc123')
      expect(result.nodeId).toBeNull()
      expect(result.resourceType).toBe(ResourceType.FILE)
    })

    it('strips trailing slashes gracefully', () => {
      const result = parseFigmaUrl('https://www.figma.com/design/abc123/My-File/')
      expect(result.fileKey).toBe('abc123')
    })
  })

  describe('FRAME links', () => {
    it('parses a /design/ URL with node-id as FRAME', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/abc123/My-File?node-id=45-67',
      )
      expect(result.fileKey).toBe('abc123')
      expect(result.nodeId).toBe('45:67')  // hyphens normalized to colons
      expect(result.resourceType).toBe(ResourceType.FRAME)
    })

    it('normalizes node-id hyphens to colons', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/abc123/My-File?node-id=1-2',
      )
      expect(result.nodeId).toBe('1:2')
    })

    it('handles node-id already using colons', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/abc123/My-File?node-id=45:67',
      )
      expect(result.nodeId).toBe('45:67')
    })

    it('handles multi-segment node IDs', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/abc123/My-File?node-id=123-456',
      )
      expect(result.nodeId).toBe('123:456')
    })
  })

  describe('PROTOTYPE links', () => {
    it('parses a /proto/ URL as PROTOTYPE', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/proto/abc123/My-File?node-id=10-20',
      )
      expect(result.fileKey).toBe('abc123')
      expect(result.nodeId).toBe('10:20')
      expect(result.resourceType).toBe(ResourceType.PROTOTYPE)
    })

    it('parses a /proto/ URL with no node-id as PROTOTYPE', () => {
      const result = parseFigmaUrl('https://www.figma.com/proto/abc123/My-File')
      expect(result.resourceType).toBe(ResourceType.PROTOTYPE)
      expect(result.nodeId).toBeNull()
    })
  })

  describe('FIGJAM links', () => {
    it('parses a /board/ URL as FIGJAM', () => {
      const result = parseFigmaUrl('https://www.figma.com/board/abc123/My-Board')
      expect(result.fileKey).toBe('abc123')
      expect(result.nodeId).toBeNull()
      expect(result.resourceType).toBe(ResourceType.FIGJAM)
    })
  })

  describe('branch URLs', () => {
    it('extracts the branchKey as fileKey for branch URLs', () => {
      const result = parseFigmaUrl(
        'https://www.figma.com/design/abc123/branch/branch456/My-Branch',
      )
      expect(result.fileKey).toBe('branch456')
      expect(result.resourceType).toBe(ResourceType.FILE)
    })
  })

  describe('figma.com (without www) hostname', () => {
    it('accepts figma.com as a valid hostname', () => {
      const result = parseFigmaUrl('https://figma.com/design/abc123/My-File')
      expect(result.fileKey).toBe('abc123')
    })
  })

  describe('error cases', () => {
    it('throws InvalidFigmaUrlError for non-Figma URLs', () => {
      expect(() => parseFigmaUrl('https://example.com/foo')).toThrow()
    })

    it('throws for completely invalid strings', () => {
      expect(() => parseFigmaUrl('not a url')).toThrow()
    })

    it('throws for figma.com URLs with unknown path type', () => {
      expect(() =>
        parseFigmaUrl('https://www.figma.com/unknown/abc123/My-File'),
      ).toThrow()
    })

    it('throws for figma.com root URL with no path', () => {
      expect(() => parseFigmaUrl('https://www.figma.com/')).toThrow()
    })

    it('throws for empty string', () => {
      expect(() => parseFigmaUrl('')).toThrow()
    })
  })
})

describe('figmaResourceKey', () => {
  it('produces a stable key for a file-level link', () => {
    const parts = { fileKey: 'abc123', nodeId: null, resourceType: ResourceType.FILE }
    expect(figmaResourceKey(parts)).toBe('abc123:file:FILE')
  })

  it('produces a stable key for a frame link', () => {
    const parts = { fileKey: 'abc123', nodeId: '45:67', resourceType: ResourceType.FRAME }
    expect(figmaResourceKey(parts)).toBe('abc123:45:67:FRAME')
  })

  it('produces different keys for same fileKey but different resource types', () => {
    const frame = { fileKey: 'abc', nodeId: '1:2', resourceType: ResourceType.FRAME }
    const proto = { fileKey: 'abc', nodeId: '1:2', resourceType: ResourceType.PROTOTYPE }
    expect(figmaResourceKey(frame)).not.toBe(figmaResourceKey(proto))
  })
})
