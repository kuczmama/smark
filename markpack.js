const fs = require('fs');
const path = require("path");

var args = process.argv.slice(2);

let ENTRY_PATH = "src/root.js";
let OUTPUT_PATH = "bundle/bundle.js";
let CONFIG = "";
let MODE = "development";

for (let i = 0; i < args.length; i++) {
    let arg = args[i];
    if (/--config/.test(arg)) {
        if (arg.indexOf("=") != -1) {
            let splitted = arg.split("=");
            CONFIG = splitted[1];
        } else {
            CONFIG = args[i + 1];
        }
    } else if (/--mode/.test(arg)) {
        if (arg.indexOf("=") != -1) {
            let splitted = arg.split("=");
            MODE = splitted[1];
        } else {
            MODE = args[i + 1];
        }
    } else if (/--entry-path/.test(arg)) {
        if (arg.indexOf("=") != -1) {
            let splitted = arg.split("=");
            ENTRY_PATH = splitted[1];
        } else {
            ENTRY_PATH = args[i + 1];
        }
    } else if (/--output-path/.test(arg)) {
        if (arg.indexOf("=") != -1) {
            let splitted = arg.split("=");
            OUTPUT_PATH = splitted[1];
        } else {
            OUTPUT_PATH = args[i + 1];
        }
    }

}

const exportsDeclarations = {
    ExportDefaultDeclaration: true,
    DeclareExportDeclaration: true,
    DeclareExportAllDeclaration: true,
    ExportNamedDeclaration: true,
}

function createAsset(filename) {
    const dependencies = [];
    let content = "";
    try {
        content = fs.readFileSync(filename, 'utf-8');
    } catch (err) {
        console.log("caught error reading " + filename);
        console.log(err);
    }

    console.log(filename);
    const ast = require("@babel/parser").parse(content, {
        sourceType: "module",
    });
    let code = "";
    ast.program.body.map((node) => {
        if (node.type === "ImportDeclaration") {
            dependencies.push(node.source.value)
        } else if (exportsDeclarations[node.type]) {
            // skip
            // console.log(JSON.stringify(node));
        } else {
            code += content.slice(node.start, node.end);
        }
    })

    return {
        filename,
        dependencies,
        code
    }

}

function bundle(entry) {
    const initialAsset = createAsset(entry);
    const assets = [initialAsset];
    let result = initialAsset.code;
    const loadedDependencies = {};
    loadedDependencies[initialAsset.filename] = true;


    for (const asset of assets) {
        const dirname = path.dirname(asset.filename);

        asset.dependencies.forEach(relativePath => {
            const extname = path.extname(asset.filename);
            const absolutePath = path.join(dirname, relativePath + extname);
            const childAsset = createAsset(absolutePath);
            if (!loadedDependencies[childAsset.filename]) {
                childAsset.filename = relativePath + extname;

                result = childAsset.code + "\n" + result;
                assets.push(childAsset);
                loadedDependencies[childAsset.filename] = true;
            }
        });
    }

    return result;
}

function ensureDirectoryExistence(filePath) {
    var dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

function createBundle() {
    ensureDirectoryExistence(OUTPUT_PATH);
    if (fs.existsSync(OUTPUT_PATH)) {
        fs.unlinkSync(OUTPUT_PATH);
    }

    fs.appendFile(OUTPUT_PATH, bundle(ENTRY_PATH), err => {
        console.log(`${OUTPUT_PATH} created`);
    });
}

createBundle();

console.log("Watching for file changes...");

fs.watch('src', {
    recursive: true
}, function(event, filename) {
    if (filename) {
        console.log("File changed... Regenerating bundle")
        createBundle();

    } else {
        console.log('filename not provided');
    }
});