import * as fs from 'fs';
import * as path from 'path';
import { ZipArchive, TarArchive, type ZipOptions, type TarOptions, type Archiver } from 'archiver';
import { VirtualFileSystem, normalizeVirtualPath } from './virtual-fs.js';

export interface CommitToDiskOptions {
  targetDir: string;
  overwrite?: boolean | undefined;
  cleanTarget?: boolean | undefined;
  filter?: ((filePath: string) => boolean) | undefined;
  dryRun?: boolean | undefined;
}

export interface CommitResult {
  success: boolean;
  targetDir: string;
  filesWritten: string[];
  filesSkipped: string[];
  totalBytes: number;
  durationMs: number;
}

export interface BaseArchiveOptions {
  prefix?: string | undefined;
  filter?: ((filePath: string) => boolean) | undefined;
}

export interface ZipArchiveOptions extends BaseArchiveOptions {
  level?: number | undefined;
  zipOptions?: ZipOptions | undefined;
}

export interface TarArchiveOptions extends BaseArchiveOptions {
  gzip?: boolean | undefined;
  tarOptions?: TarOptions | undefined;
}

export interface StreamArchiveOptions {
  format?: 'zip' | 'tar' | undefined;
  prefix?: string | undefined;
  filter?: ((filePath: string) => boolean) | undefined;
  level?: number | undefined;
  gzip?: boolean | undefined;
}

export interface ArchiveFileResult {
  targetPath: string;
  format: 'zip' | 'tar';
  totalBytes: number;
  fileCount: number;
  durationMs: number;
}

/**
 * Commits an in-memory VirtualFileSystem tree to the physical disk.
 */
export async function commitToDisk(
  vfs: VirtualFileSystem,
  options: CommitToDiskOptions
): Promise<CommitResult> {
  const startTime = Date.now();
  const targetDir = path.resolve(options.targetDir);
  const overwrite = options.overwrite ?? true;
  const dryRun = options.dryRun ?? false;

  const filesWritten: string[] = [];
  const filesSkipped: string[] = [];
  let totalBytes = 0;

  if (options.cleanTarget && !dryRun && fs.existsSync(targetDir)) {
    await fs.promises.rm(targetDir, { recursive: true, force: true });
  }

  const vfsFiles = vfs.listFiles('/');

  for (const virtualPath of vfsFiles) {
    if (options.filter && !options.filter(virtualPath)) {
      continue;
    }

    // Relative path without leading slash
    const relativePath = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;
    const diskPath = path.join(targetDir, relativePath);

    if (!overwrite && fs.existsSync(diskPath)) {
      filesSkipped.push(diskPath);
      continue;
    }

    const content = vfs.readBuffer(virtualPath);
    totalBytes += content.length;

    if (!dryRun) {
      const diskDir = path.dirname(diskPath);
      if (!fs.existsSync(diskDir)) {
        await fs.promises.mkdir(diskDir, { recursive: true });
      }
      await fs.promises.writeFile(diskPath, content);
    }

    filesWritten.push(diskPath);
  }

  return {
    success: true,
    targetDir,
    filesWritten,
    filesSkipped,
    totalBytes,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Creates an in-memory ZIP archive Buffer from a VirtualFileSystem.
 */
export async function createZipArchive(
  vfs: VirtualFileSystem,
  options?: ZipArchiveOptions
): Promise<Buffer> {
  const level = options?.level ?? 9;
  const zipOpts: ZipOptions = {
    ...(options?.zipOptions ?? {}),
    zlib: { level, ...(options?.zipOptions?.zlib ?? {}) },
  };

  const archive = new ZipArchive(zipOpts);
  return streamToBuffer(archive, vfs, options);
}

/**
 * Creates an in-memory TAR archive Buffer from a VirtualFileSystem.
 */
export async function createTarArchive(
  vfs: VirtualFileSystem,
  options?: TarArchiveOptions
): Promise<Buffer> {
  const gzip = options?.gzip ?? true;
  const tarOpts: TarOptions = {
    gzip,
    ...(options?.tarOptions ?? {}),
  };

  const archive = new TarArchive(tarOpts);
  return streamToBuffer(archive, vfs, options);
}

/**
 * Internal helper to stream files into an archiver and collect the result as a Buffer.
 */
function streamToBuffer(
  archive: Archiver,
  vfs: VirtualFileSystem,
  options?: BaseArchiveOptions
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    archive.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.on('end', () => {
      resolve(Buffer.concat(chunks));
    });

    const files = vfs.listFiles('/');
    const prefix = options?.prefix ? normalizeVirtualPath(options.prefix).replace(/^\//, '') : '';

    for (const virtualPath of files) {
      if (options?.filter && !options.filter(virtualPath)) {
        continue;
      }

      const content = vfs.readBuffer(virtualPath);
      let entryName = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;
      if (prefix) {
        entryName = `${prefix.replace(/\/+$/, '')}/${entryName}`;
      }

      archive.append(content, { name: entryName });
    }

    archive.finalize().catch(reject);
  });
}

/**
 * Streams a VirtualFileSystem into an archive file written directly to disk.
 */
export async function streamArchiveToFile(
  vfs: VirtualFileSystem,
  targetArchivePath: string,
  options?: StreamArchiveOptions
): Promise<ArchiveFileResult> {
  const startTime = Date.now();
  const format = options?.format ?? (targetArchivePath.endsWith('.tar.gz') || targetArchivePath.endsWith('.tgz') ? 'tar' : 'zip');
  const resolvedPath = path.resolve(targetArchivePath);
  const parentDir = path.dirname(resolvedPath);

  if (!fs.existsSync(parentDir)) {
    await fs.promises.mkdir(parentDir, { recursive: true });
  }

  const output = fs.createWriteStream(resolvedPath);

  let archive: Archiver;
  if (format === 'tar') {
    archive = new TarArchive({ gzip: options?.gzip ?? true });
  } else {
    archive = new ZipArchive({ zlib: { level: options?.level ?? 9 } });
  }

  return new Promise<ArchiveFileResult>((resolve, reject) => {
    let fileCount = 0;

    output.on('close', () => {
      resolve({
        targetPath: resolvedPath,
        format,
        totalBytes: archive.pointer(),
        fileCount,
        durationMs: Date.now() - startTime,
      });
    });

    archive.on('error', (err: Error) => {
      reject(err);
    });

    archive.pipe(output);

    const files = vfs.listFiles('/');
    const prefix = options?.prefix ? normalizeVirtualPath(options.prefix).replace(/^\//, '') : '';

    for (const virtualPath of files) {
      if (options?.filter && !options.filter(virtualPath)) {
        continue;
      }

      const content = vfs.readBuffer(virtualPath);
      let entryName = virtualPath.startsWith('/') ? virtualPath.slice(1) : virtualPath;
      if (prefix) {
        entryName = `${prefix.replace(/\/+$/, '')}/${entryName}`;
      }

      archive.append(content, { name: entryName });
      fileCount++;
    }

    archive.finalize().catch(reject);
  });
}
