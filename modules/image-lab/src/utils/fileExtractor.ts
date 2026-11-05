/**
 * Recursively extracts files from DataTransferItemList (drag-and-drop),
 * traversing folders and subfolders with relative path metadata.
 */
export async function extractFilesFromDataTransfer(
  items: DataTransferItemList
): Promise<File[]> {
  const fileEntries: File[] = [];

  const traverseEntry = async (entry: any, currentPath = ''): Promise<void> => {
    if (!entry) return;

    if (entry.isFile) {
      return new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            // Assign relative path if webkitRelativePath is empty
            const rel = currentPath ? `${currentPath}/${file.name}` : file.name;
            try {
              Object.defineProperty(file, 'webkitRelativePath', {
                value: rel,
                writable: true,
              });
            } catch {}
            fileEntries.push(file);
            resolve();
          },
          () => resolve()
        );
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      const readAllEntries = async (): Promise<any[]> => {
        const result: any[] = [];
        let batch: any[] = [];
        do {
          batch = await new Promise<any[]>((resolve) => {
            dirReader.readEntries((entries: any[]) => resolve(entries || []), () => resolve([]));
          });
          result.push(...batch);
        } while (batch.length > 0);
        return result;
      };

      const entries = await readAllEntries();
      const dirPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      for (const child of entries) {
        await traverseEntry(child, dirPath);
      }
    }
  };

  const promises: Promise<void>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.webkitGetAsEntry) {
      const entry = item.webkitGetAsEntry();
      if (entry) {
        promises.push(traverseEntry(entry, ''));
      }
    } else {
      const f = item.getAsFile();
      if (f) fileEntries.push(f);
    }
  }

  await Promise.all(promises);
  return fileEntries;
}
