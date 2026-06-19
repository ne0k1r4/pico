import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import type { WorkerConfig } from "../config";

export class S3Storage {
  readonly client: S3Client;

  constructor(config: WorkerConfig) {
    this.client = new S3Client({
      region: config.S3_REGION,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE
    });
  }

  async download(bucket: string, key: string): Promise<Uint8Array> {
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) throw new Error(`S3 object ${bucket}/${key} has no body`);
    return response.Body.transformToByteArray();
  }

  async uploadFile(
    bucket: string,
    key: string,
    filePath: string,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<number> {
    const size = (await stat(filePath)).size;
    await new Upload({
      client: this.client,
      params: {
        Bucket: bucket,
        Key: key,
        Body: createReadStream(filePath),
        ContentType: contentType,
        Metadata: metadata
      }
    }).done();
    return size;
  }

  async uploadBuffer(
    bucket: string,
    key: string,
    body: Buffer,
    contentType: string,
    metadata: Record<string, string>
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata
      })
    );
  }
}
