// Helpers for nested folders (folder > subfolder > sub-subfolder, up to 3 levels).
export const MAX_FOLDER_DEPTH = 3;

export function folderMap(folders) {
  return new Map(folders.map((f) => [f.id, f]));
}

// [root, ..., folder] for breadcrumbs.
export function folderPath(folders, id) {
  const byId = folderMap(folders);
  const path = [];
  let cur = byId.get(id);
  while (cur && path.length < 10) { path.unshift(cur); cur = cur.parent_id ? byId.get(cur.parent_id) : null; }
  return path;
}

export function folderDepth(folders, id) {
  return folderPath(folders, id).length;
}

// Folders flattened depth-first in name order, each with a `depth` (1 = top level).
export function flattenFolders(folders, parentId = null, depth = 1, out = []) {
  const ids = new Set(folders.map((f) => f.id));
  const kids = folders
    .filter((f) => (parentId === null ? !f.parent_id || !ids.has(f.parent_id) : f.parent_id === parentId))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const f of kids) {
    out.push({ ...f, depth });
    flattenFolders(folders, f.id, depth + 1, out);
  }
  return out;
}

// Every folder id inside `id` (children, grandchildren), not including `id`.
export function descendantIds(folders, id) {
  const out = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop();
    for (const f of folders) if (f.parent_id === cur) { out.push(f.id); stack.push(f.id); }
  }
  return out;
}
