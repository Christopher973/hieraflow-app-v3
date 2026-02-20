import "server-only";

import {
  type BucketLocationConstraint,
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type StorageEnv = {
  endpoint?: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  signedUrlsEnabled: boolean;
  signedUrlExpiresIn: number;
};

const ENV_KEYS = {
  endpoint: "S3_ENDPOINT",
  region: "S3_REGION",
  accessKeyId: "S3_ACCESS_KEY",
  secretAccessKey: "S3_SECRET_KEY",
  bucketName: "S3_BUCKET_NAME",
  signedUrlsEnabled: "S3_SIGNED_URLS_ENABLED",
  signedUrlExpiresIn: "S3_SIGNED_URLS_EXPIRES_IN",
} as const;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const encodeObjectKey = (key: string) =>
  key
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

const parseBoolean = (value: string | undefined) => {
  if (!value) {
    return false;
  }

  return value.trim().toLowerCase() === "true";
};

const parseOptionalBoolean = (value: string | undefined) => {
  if (value === undefined) {
    return undefined;
  }

  return parseBoolean(value);
};

const parseExpiresIn = (value: string | undefined) => {
  if (!value) {
    return 900;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 900;
  }

  return parsed;
};

function getStorageEnv(): StorageEnv {
  const region = process.env[ENV_KEYS.region]?.trim();
  const accessKeyId = process.env[ENV_KEYS.accessKeyId]?.trim();
  const secretAccessKey = process.env[ENV_KEYS.secretAccessKey]?.trim();
  const bucketName = process.env[ENV_KEYS.bucketName]?.trim();
  const endpoint = process.env[ENV_KEYS.endpoint]?.trim();
  const signedUrlsEnabledFromEnv = parseOptionalBoolean(
    process.env[ENV_KEYS.signedUrlsEnabled],
  );
  const signedUrlsEnabled = signedUrlsEnabledFromEnv ?? true;
  const signedUrlExpiresIn = parseExpiresIn(
    process.env[ENV_KEYS.signedUrlExpiresIn],
  );

  if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error(
      "Configuration S3 incomplète. Variables requises: S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET_NAME.",
    );
  }

  return {
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucketName,
    signedUrlsEnabled,
    signedUrlExpiresIn,
  };
}

const globalForStorage = globalThis as typeof globalThis & {
  __hieraflowStorageClient?: S3Client;
  __hieraflowStorageConfigKey?: string;
  __hieraflowStorageBucketReady?: boolean;
};

function toStorageConfigKey(env: StorageEnv) {
  return [
    env.endpoint ?? "",
    env.region,
    env.accessKeyId,
    env.secretAccessKey,
    env.bucketName,
  ].join("|");
}

function getS3Client() {
  const env = getStorageEnv();
  const configKey = toStorageConfigKey(env);

  if (
    !globalForStorage.__hieraflowStorageClient ||
    globalForStorage.__hieraflowStorageConfigKey !== configKey
  ) {
    globalForStorage.__hieraflowStorageClient = new S3Client({
      region: env.region,
      endpoint: env.endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
      },
    });
    globalForStorage.__hieraflowStorageConfigKey = configKey;
    globalForStorage.__hieraflowStorageBucketReady = false;
  }

  return {
    client: globalForStorage.__hieraflowStorageClient,
    env,
  };
}

export async function uploadFile(
  file: Buffer,
  key: string,
  contentType?: string,
): Promise<void> {
  const { client, env } = getS3Client();

  if (!globalForStorage.__hieraflowStorageBucketReady) {
    try {
      await client.send(
        new HeadBucketCommand({
          Bucket: env.bucketName,
        }),
      );
      globalForStorage.__hieraflowStorageBucketReady = true;
    } catch {
      await client.send(
        new CreateBucketCommand({
          Bucket: env.bucketName,
          ...(env.region === "us-east-1"
            ? {}
            : {
                CreateBucketConfiguration: {
                  LocationConstraint: env.region as BucketLocationConstraint,
                },
              }),
        }),
      );
      globalForStorage.__hieraflowStorageBucketReady = true;
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: env.bucketName,
      Key: key,
      Body: file,
      ContentType: contentType,
    }),
  );
}

export async function deleteFile(key: string): Promise<void> {
  const { client, env } = getS3Client();

  await client.send(
    new DeleteObjectCommand({
      Bucket: env.bucketName,
      Key: key,
    }),
  );
}

const getPublicFileUrl = (key: string, env: StorageEnv) => {
  const encodedKey = encodeObjectKey(key);

  if (env.endpoint) {
    const endpoint = trimTrailingSlash(env.endpoint);
    return `${endpoint}/${env.bucketName}/${encodedKey}`;
  }

  return `https://${env.bucketName}.s3.${env.region}.amazonaws.com/${encodedKey}`;
};

export async function getFileUrl(key: string): Promise<string> {
  const { env } = getS3Client();

  if (!env.signedUrlsEnabled) {
    return getPublicFileUrl(key, env);
  }

  const { client } = getS3Client();

  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: env.bucketName,
      Key: key,
    }),
    { expiresIn: env.signedUrlExpiresIn },
  );
}

export function isSignedUrlEnabled() {
  const { env } = getS3Client();
  return env.signedUrlsEnabled;
}
