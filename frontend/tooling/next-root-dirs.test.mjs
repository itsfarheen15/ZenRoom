import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { getRootDirs } = require("@next/eslint-plugin-next/dist/utils/get-root-dirs");

test("Next lint root discovery retains glob behavior with the scoped override", () => {
    const root = mkdtempSync(path.join(tmpdir(), "zen-lint-"));
    try {
        const first = path.join(root, "apps", "first");
        const second = path.join(root, "apps", "second");
        mkdirSync(first, { recursive: true });
        mkdirSync(second, { recursive: true });
        const context = { cwd: root, settings: {} };
        const discover = rootDir => getRootDirs({ ...context, settings: { next: { rootDir } } }).map(dir => path.resolve(dir)).sort();
        assert.deepEqual(getRootDirs(context), [root]);
        assert.deepEqual(discover(path.join(root, "apps", "*")), [first, second].sort());
        assert.deepEqual(discover(path.join(root, "apps", "{first,second}")), [first, second].sort());
        assert.deepEqual(discover([first, second, null]), [first, second].sort());
        assert.deepEqual(discover(path.join(root, "missing", "*")), []);
    } finally {
        rmSync(root, { recursive: true, force: true });
    }
});
