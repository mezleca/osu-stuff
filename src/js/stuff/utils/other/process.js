const { exec } = require("child_process");

export const open_folder = (path) => {

    const cmd = `start "" "${path}"`;

    exec(cmd, (err, stdout, stderr) => {
        if (err) {
            console.log(err);
        }
    });
};

export const is_running = (query, cb) => {

    let platform = process.platform;
    let cmd = '';

    switch (platform) {
        case 'win32' : cmd = `tasklist`; break;
        case 'darwin' : cmd = `ps -ax | grep ${query}`; break;
        case 'linux' : cmd = `ps -A`; break;
        default: break;
    }

    return new Promise(res => {
        exec(cmd, (err, stdout, stderr) => {
            const result = stdout.toLowerCase().indexOf(query.toLowerCase()) > -1;
            res(result);
        });
    });
};