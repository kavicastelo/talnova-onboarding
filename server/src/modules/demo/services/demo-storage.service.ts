import fs from "fs";
import path from "path";

export class DemoStorageService {
  private localSandboxDir: string;

  constructor() {
    this.localSandboxDir = path.resolve(process.cwd(), "scratch", "demo_storage");
    if (!fs.existsSync(this.localSandboxDir)) {
      fs.mkdirSync(this.localSandboxDir, { recursive: true });
    }
  }

  /**
   * Cleans demo storage assets during reset.
   * Strictly limited to the demo sandbox; never touches production buckets or files.
   */
  async cleanDemoStorage(): Promise<{ filesRemoved: number }> {
    let filesRemoved = 0;
    try {
      if (fs.existsSync(this.localSandboxDir)) {
        const files = fs.readdirSync(this.localSandboxDir);
        for (const file of files) {
          const filePath = path.join(this.localSandboxDir, file);
          if (fs.lstatSync(filePath).isFile()) {
            fs.unlinkSync(filePath);
            filesRemoved++;
          }
        }
      }
    } catch (err: any) {
      console.warn("[DemoStorageService] Warning cleaning local demo sandbox:", err.message);
    }
    return { filesRemoved };
  }

  /**
   * Stores a demo-generated file in the isolated sandbox.
   */
  async saveDemoFile(fileName: string, content: Buffer | string): Promise<{ fileKey: string; localPath: string }> {
    const safeName = `${Date.now()}_${path.basename(fileName)}`;
    const targetPath = path.join(this.localSandboxDir, safeName);
    fs.writeFileSync(targetPath, content);
    return {
      fileKey: `demo/${safeName}`,
      localPath: targetPath,
    };
  }
}

export const demoStorageService = new DemoStorageService();
export default demoStorageService;
