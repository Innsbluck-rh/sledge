import { saveProject } from '~/io/project/out/save';
import { fileStore } from '~/stores/EditorStores';

export class AutoSaveManager {
  private static instance: AutoSaveManager;
  private currentInterval: number | undefined = undefined;
  private intervalId: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): AutoSaveManager {
    if (!AutoSaveManager.instance) {
      AutoSaveManager.instance = new AutoSaveManager();
    }
    return AutoSaveManager.instance;
  }

  public getCurrentInterval(): number | undefined {
    return this.currentInterval;
  }

  public startAutoSave(interval: number): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    this.currentInterval = interval;
    this.intervalId = setInterval(async () => {
      if (fileStore.location.name && fileStore.location.path) {
        await saveProject(fileStore.location.name, fileStore.location.path);
      } else {
        console.log('Auto-save skipped: No valid file location.');
      }
    }, interval * 1000);
  }

  public stopAutoSave(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
