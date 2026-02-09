# Storage & Sync

SpacekitVM supports local persistence and remote sync.

## IndexedDB (local)
Use `IndexedDbStorageAdapter` for browser persistence:
```ts
const storage = new IndexedDbStorageAdapter("spacekitvm", "kv");
await storage.init();
```

## Auto-sync + snapshots
Use `VmAutoSync` to periodically persist VM state:
```ts
const autosync = new VmAutoSync(vm, { storage });
await autosync.initFromSnapshot();
autosync.start();
```

## Remote sync (storage-node)
`StorageNodeAdapter` connects to `spacekit-storage-node`:
```ts
const remote = new StorageNodeAdapter({ baseUrl: "http://localhost:3030", did: "did:spacekit:demo" });
await syncWithStorageNode(storage, remote);
```

## Conflict resolution
Default merge strategy is LWW (last-write-wins) based on version stamps.
