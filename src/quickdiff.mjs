import { readFile } from "./lib/read.mjs";

export async function App(argv = ['Console Argument']) {
    console.log('Config path:', argv[2]);

    // 读取配置文件
    let config = await readFile(argv[2]);

    let { DiffFrom, DiffTo, DiffTarget } = config;
    if (!DiffFrom || !DiffTo || !DiffTarget) {
        throw new Error(`Config error`);
    }

    let diff_from = await readFile(DiffFrom);
    let diff_to = await readFile(DiffTo);

    let diff_from_target = diff_from[DiffTarget];
    if (!diff_from_target) {
        throw new Error(`Diff section ${DiffTarget} does not exist in ${DiffFrom}`);
    }

    let diff_to_target = diff_to[DiffTarget];
    if (!diff_to_target) {
        throw new Error(`Diff section ${DiffTarget} does not exist in ${DiffTo}`);
    }

    let diff_result = {
        "more": [], // DiffFrom has more than DiffTo
        "less": [] // DiffTo has more than DiffFrom
    };
    let diff_from_values = Object.values(diff_from_target);
    let diff_to_values = Object.values(diff_to_target);
    diff_from_values.forEach(value => {
        if (!diff_to_values.includes(value)) {
            diff_result.more.push(value);
        }
    });
    diff_to_values.forEach(value => {
        if (!diff_from_values.includes(value)) {
            diff_result.less.push(value);
        }
    });

    console.log(diff_result);
}

await App(process.argv);