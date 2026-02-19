import fs from "fs";
import * as esbuild from "esbuild";

if (!fs.existsSync("smartedu.user.ts")) {
    console.error("Error: smartedu.user.ts not found.");
    process.exit(1);
}

const content = fs.readFileSync("smartedu.user.ts", "utf-8");

// Extract the header (metadata block)
// It usually starts with // ==UserScript== and ends with // ==/UserScript==
const match = content.match(/(\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==)/);
if (!match) {
    console.error("Error: UserScript header not found.");
    process.exit(1);
}
const header = match[1];

// Plugin to map imports to global variables
const globalExternalsPlugin = {
    name: "global-externals",
    setup(build) {
        build.onResolve({ filter: /^idb$/ }, (args) => {
            return { path: args.path, namespace: "global-external" };
        });
        build.onLoad({ filter: /.*/, namespace: "global-external" }, (args) => {
            // Map 'idb' import to the global 'idb' variable provided by @require
            return {
                contents: `module.exports = window.idb || self.idb || globalThis.idb;`,
                loader: "js",
            };
        });
    },
};

async function build() {
    await esbuild.build({
        entryPoints: ["smartedu.user.ts"],
        outfile: "smartedu.user.js",
        bundle: true,
        format: "iife",
        banner: {
            js: header,
        },
        plugins: [globalExternalsPlugin],
        // 'coco-message' and 'crypto-js' are not imported in TS, so esbuild ignores them.
        external: ["coco-message", "crypto-js"],
    });
    console.log("Build complete: smartedu.user.js created.");
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
