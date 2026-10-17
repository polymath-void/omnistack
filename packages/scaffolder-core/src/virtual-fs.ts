import { Volume, createFsFromVolume } from 'memfs';
import * as path from 'path';

export interface VfsStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  mtime: Date;
}

export interface VfsEntry {
  path: string;
  isDirectory: boolean;
  size: number;
}

/**
 * Normalizes any Windows or POSIX path to a clean, absolute virtual UNIX-style path.
 * e.g. "src\\index.ts" -> "/src/index.ts", "C:/app/page.tsx" -> "/app/page.tsx"
 */
export function normalizeVirtualPath(filePath: string): string {
  if (!filePath || filePath === '.' || filePath === '/') {
    return '/';
  }

  // Strip Windows drive letters like C: or D:
  let normalized = filePath.replace(/^[a-zA-Z]:/, '');

  // Convert backslashes to forward slashes
  normalized = normalized.replace(/\\/g, '/');

  // Collapse multiple slashes
  normalized = normalized.replace(/\/+/g, '/');

  // Ensure leading slash
  if (!normalized.startsWith('/')) {
    normalized = '/' + normalized;
  }

  // Remove trailing slash unless it's root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }

  return path.posix.normalize(normalized);
}

/**
 * In-memory Virtual File System wrapping memfs.
 * Stages project trees in RAM before disk commit or archive emission.
 */
export class VirtualFileSystem {
  private volume: InstanceType<typeof Volume>;
  private fs: ReturnType<typeof createFsFromVolume>;

  constructor(initialFiles?: Record<string, string | null>) {
    this.volume = new Volume();
    this.fs = createFsFromVolume(this.volume);

    if (initialFiles) {
      this.fromJSON(initialFiles);
    }
  }

  /**
   * Retrieves the raw memfs Volume instance.
   */
  public getVolume(): InstanceType<typeof Volume> {
    return this.volume;
  }

  /**
   * Retrieves the Node.js-compatible fs instance bound to the Volume.
   */
  public getFs(): ReturnType<typeof createFsFromVolume> {
    return this.fs;
  }

  /**
   * Checks if a file or directory exists at the given path.
   */
  public exists(targetPath: string): boolean {
    const norm = normalizeVirtualPath(targetPath);
    return this.volume.existsSync(norm);
  }

  /**
   * Writes content to a file in the virtual filesystem.
   * Parent directories are created automatically if they do not exist.
   */
  public writeFile(filePath: string, content: string | Buffer): void {
    const norm = normalizeVirtualPath(filePath);
    const parentDir = path.posix.dirname(norm);

    if (parentDir && parentDir !== '/' && !this.volume.existsSync(parentDir)) {
      this.volume.mkdirSync(parentDir, { recursive: true });
    }

    this.volume.writeFileSync(norm, content);
  }

  /**
   * Alias for writeFile
   */
  public write(filePath: string, content: string | Buffer): void {
    this.writeFile(filePath, content);
  }

  /**
   * Reads a file from the virtual filesystem as a UTF-8 string or specified encoding.
   */
  public readFile(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    const norm = normalizeVirtualPath(filePath);
    const result = this.volume.readFileSync(norm, { encoding });
    return typeof result === 'string' ? result : result.toString(encoding);
  }

  /**
   * Alias for readFile
   */
  public read(filePath: string, encoding: BufferEncoding = 'utf8'): string {
    return this.readFile(filePath, encoding);
  }

  /**
   * Reads a file from the virtual filesystem as a Buffer.
   */
  public readBuffer(filePath: string): Buffer {
    const norm = normalizeVirtualPath(filePath);
    const result = this.volume.readFileSync(norm);
    if (Buffer.isBuffer(result)) {
      return result;
    }
    return Buffer.from(result);
  }

  /**
   * Retrieves file or directory metadata.
   */
  public stat(targetPath: string): VfsStat {
    const norm = normalizeVirtualPath(targetPath);
    const stats = this.volume.statSync(norm);
    return {
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      size: Number(stats.size),
      mtime: stats.mtime instanceof Date ? stats.mtime : new Date(stats.mtime),
    };
  }

  /**
   * Creates a directory in the virtual filesystem.
   */
  public mkdir(dirPath: string, recursive = true): void {
    const norm = normalizeVirtualPath(dirPath);
    if (!this.volume.existsSync(norm)) {
      this.volume.mkdirSync(norm, { recursive });
    }
  }

  /**
   * Deletes a file from the virtual filesystem.
   */
  public unlink(filePath: string): void {
    const norm = normalizeVirtualPath(filePath);
    if (this.volume.existsSync(norm)) {
      this.volume.unlinkSync(norm);
    }
  }

  /**
   * Removes a file or directory.
   */
  public rm(targetPath: string, options?: { recursive?: boolean; force?: boolean }): void {
    const norm = normalizeVirtualPath(targetPath);
    if (!this.volume.existsSync(norm)) {
      if (options?.force) return;
      throw new Error(`Path does not exist: ${norm}`);
    }

    const stats = this.volume.statSync(norm);
    if (stats.isDirectory()) {
      this.volume.rmdirSync(norm, { recursive: options?.recursive ?? true });
    } else {
      this.volume.unlinkSync(norm);
    }
  }

  /**
   * Lists file and directory entries inside a given directory.
   */
  public readdir(dirPath: string): string[] {
    const norm = normalizeVirtualPath(dirPath);
    if (!this.volume.existsSync(norm)) {
      return [];
    }
    const entries = this.volume.readdirSync(norm);
    return entries.map((e) => (typeof e === 'string' ? e : e.toString()));
  }

  /**
   * Recursively walks and returns all file paths staged in the virtual filesystem.
   * All returned paths are normalized virtual paths (starting with /).
   */
  public listFiles(baseDir = '/'): string[] {
    const normBase = normalizeVirtualPath(baseDir);
    const fileList: string[] = [];

    if (!this.volume.existsSync(normBase)) {
      return fileList;
    }

    const walk = (currentPath: string) => {
      const stats = this.volume.statSync(currentPath);
      if (stats.isFile()) {
        fileList.push(currentPath);
        return;
      }

      if (stats.isDirectory()) {
        const entries = this.volume.readdirSync(currentPath);
        for (const entry of entries) {
          const entryStr = typeof entry === 'string' ? entry : entry.toString();
          const nextPath = currentPath === '/' ? `/${entryStr}` : `${currentPath}/${entryStr}`;
          walk(nextPath);
        }
      }
    };

    walk(normBase);
    return fileList.sort();
  }

  /**
   * Copies a file from source to destination inside the virtual filesystem.
   */
  public copyFile(srcPath: string, destPath: string): void {
    const content = this.readBuffer(srcPath);
    this.writeFile(destPath, content);
  }

  /**
   * Moves / renames a file or directory within the virtual filesystem.
   */
  public move(srcPath: string, destPath: string): void {
    const normSrc = normalizeVirtualPath(srcPath);
    const normDest = normalizeVirtualPath(destPath);
    const destParent = path.posix.dirname(normDest);

    if (destParent && destParent !== '/' && !this.volume.existsSync(destParent)) {
      this.volume.mkdirSync(destParent, { recursive: true });
    }

    this.volume.renameSync(normSrc, normDest);
  }

  /**
   * Serializes the virtual filesystem into a flat JSON dictionary of { [path]: content }.
   */
  public toJSON(targetPath = '/'): Record<string, string | null> {
    const norm = normalizeVirtualPath(targetPath);
    return this.volume.toJSON(norm) as Record<string, string | null>;
  }

  /**
   * Populates the virtual filesystem from a flat JSON dictionary.
   */
  public fromJSON(files: Record<string, string | null>, targetPath = '/'): void {
    const norm = normalizeVirtualPath(targetPath);
    this.volume.fromJSON(files, norm);
  }

  /**
   * Returns total count of all staged files.
   */
  public totalFiles(baseDir = '/'): number {
    return this.listFiles(baseDir).length;
  }

  /**
   * Computes the total byte size of all files staged in the virtual filesystem.
   */
  public totalBytes(baseDir = '/'): number {
    const files = this.listFiles(baseDir);
    let total = 0;
    for (const f of files) {
      const stat = this.stat(f);
      total += stat.size;
    }
    return total;
  }

  /**
   * Resets and wipes all files and directories in the virtual filesystem.
   */
  public reset(): void {
    this.volume.reset();
  }

  /**
   * Generates a readable ASCII tree structure of the staged files.
   */
  public dumpStructure(baseDir = '/'): string {
    const files = this.listFiles(baseDir);
    if (files.length === 0) {
      return '(empty)';
    }

    return files.join('\n');
  }
}

/**
 * Helper factory to create a new VirtualFileSystem.
 */
export function createVirtualFileSystem(initialFiles?: Record<string, string | null>): VirtualFileSystem {
  return new VirtualFileSystem(initialFiles);
}
