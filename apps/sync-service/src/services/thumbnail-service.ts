import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config.js'

const s3 = new S3Client({ region: config.awsRegion })

const SIGNED_URL_TTL_SECONDS = 3600  // 1 hour

/**
 * Derives the S3 key for a thumbnail.
 * Format: thumbnails/{figmaFileKey}/{nodeId|"file"}.png
 */
export function thumbnailS3Key(figmaFileKey: string, figmaNodeId: string | null): string {
  const nodeSegment = figmaNodeId ?? 'file'
  return `thumbnails/${figmaFileKey}/${nodeSegment}.png`
}

/**
 * Downloads a thumbnail from a temporary Figma-hosted URL and stores it
 * in the private S3 bucket. Returns the S3 key on success, null on failure.
 *
 * Failure is non-fatal — the link is saved with thumbnail_s3_key = null.
 * The sync job will retry on the next sweep.
 */
export async function storeThumbnail(
  figmaFileKey: string,
  figmaNodeId: string | null,
  figmaImageUrl: string,
): Promise<string | null> {
  try {
    const imageResponse = await fetch(figmaImageUrl)
    if (!imageResponse.ok) {
      console.warn(
        `[thumbnail] Failed to download from Figma (${imageResponse.status}): ${figmaImageUrl}`,
      )
      return null
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer())
    const s3Key = thumbnailS3Key(figmaFileKey, figmaNodeId)

    await s3.send(
      new PutObjectCommand({
        Bucket: config.thumbnailBucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: 'image/png',
        // No ACL — bucket is private, access is via pre-signed URLs only
      }),
    )

    return s3Key
  } catch (err) {
    console.warn('[thumbnail] Failed to store thumbnail in S3:', err)
    return null
  }
}

/**
 * Generates a pre-signed GET URL for a thumbnail in S3.
 * Returns null if no thumbnail is stored yet (s3Key is null).
 * TTL: 1 hour — sufficient for a single Jira page session.
 *
 * The Jira panel uses an onError handler to re-fetch if the signed URL expires.
 */
export async function getSignedThumbnailUrl(s3Key: string | null): Promise<string | null> {
  if (!s3Key) return null

  try {
    const command = new GetObjectCommand({
      Bucket: config.thumbnailBucketName,
      Key: s3Key,
    })

    return await getSignedUrl(s3, command, { expiresIn: SIGNED_URL_TTL_SECONDS })
  } catch (err) {
    console.warn('[thumbnail] Failed to generate signed URL:', err)
    return null
  }
}
