import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export async function traverseFileWork(traverse_path, ignore_files) {
    let ignored_file_count = 0;
    let all_files_unfiltered = await readdir(traverse_path, { recursive: true });
    let all_files = (await Promise.all(all_files_unfiltered.map(path => (async () => {
        path = join(traverse_path, path);
        let file_stat = await stat(path);
        if (!file_stat.isFile()) {
            ignored_file_count++;
            return null;
        }
        if (ignore_files.includes(path)) {
            ignored_file_count++;
            return null;
        }
        return path;
    })()))).filter(Boolean);
    return [all_files, ignored_file_count];
}