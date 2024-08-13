// NOTE: you can't run this with Node!
// Keeping here for safekeeping, need to copy/paste this and run in browser console.

async function clearDirectory(directoryHandle) {
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file') {
      await entry.remove();
    } else if (entry.kind === 'directory') {
      await clearDirectory(entry);
      await entry.remove({ recursive: true });
    }
  }
}

// Usage example
async function clearOriginPrivateFileSystem() {
  try {
    const rootHandle = await navigator.storage.getDirectory();
    await clearDirectory(rootHandle);
    console.log('File system cleared.');
  } catch (error) {
    console.error('Failed to clear file system:', error);
  }
}

clearOriginPrivateFileSystem();
