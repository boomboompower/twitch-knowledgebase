
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

(async () => {
    let value = undefined;

    let url = process.env.RAW_URL;

    if (!url) {
        console.error('Unable to download - no raw URL.')

        return;
    }

    if (url.indexOf('http') < 0) {
        value = fs.readFileSync(path.resolve('src', url), {encoding: 'utf-8'})
    } else {
        value = await fetch(`${url}?cachebuster=${Math.floor(Math.random() * 100)}`).then(async (res) => {
            if (!res.ok) {
                console.error(`Response not okay, got code ${res.status}`)

                return undefined;
            }

            return await res.text()
        })
    }

    if (value === undefined || String(value).trim().length === 0) {
        console.error('No value found at raw url')

        return;
    }

    fs.writeFileSync(path.resolve('src', 'downloaded.ts'), String(value), {encoding: 'utf-8'})

    console.log('Written.')
})()
