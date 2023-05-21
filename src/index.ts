import fetch from 'node-fetch'
import findName from './codes';
import { XMLParser } from 'fast-xml-parser'
import { writeFileSync, mkdirSync, existsSync } from 'fs'

const SITEMAP_URL = 'https://help.twitch.tv/s/sitemap.xml';
const XML_PARSER = new XMLParser();

interface SiteMapEntry {
    loc: string,
    lastmod: string;
}

interface SiteMapEntryExtended extends SiteMapEntry {
    'xhtml:link': Array<object>
}

type MainSiteMap = {
    '?xml': '',
    sitemapindex: {
        sitemap: Array<SiteMapEntry>
    }
}
type SecondarySiteMap = {
    '?xml': '',
    urlset: {
        url: Array<SiteMapEntry | SiteMapEntryExtended>
    }
}

async function handleSitemap(sitemap: string) {
    const parsedMap : MainSiteMap = XML_PARSER.parse(sitemap, {allowBooleanAttributes: true})

    const objects = parsedMap?.sitemapindex?.sitemap;

    if (objects === undefined || objects.length === 0) {
        console.error('Unable to find sitemap!!')

        return;
    }

    const writtenHTML : any = {};

    // Skip the basic sitemaps. We only want actual articles.
    for (let i = 1; i < objects.length; i++) {
        const siteMapObject = objects[i]
        let viewLocation = siteMapObject.loc.replace(/https:\/\/help\.twitch\.tv\/s\/sitemap-topic([a-zA-Z0-9-]+)\.xml/, '$1');
        viewLocation = viewLocation.substring(0, 1).toUpperCase() + viewLocation.substring(1)

        const siteMapData = await fetch(siteMapObject.loc).then((res) => {return res.text()});
        const parsedObject: SecondarySiteMap = XML_PARSER.parse(siteMapData, {allowBooleanAttributes: true});

        for (let i = 0; i < parsedObject.urlset.url.length; i++) {
            const siteMapEntry : SiteMapEntry | SiteMapEntryExtended = parsedObject.urlset.url[i];
            const matched : RegExpMatchArray = siteMapEntry.loc.match(/https:\/\/help\.twitch\.tv\/s\/article\/([A-Za-z0-9-]+)\?language=([A-Za-z_]+)/)

            const title = matched[1];
            const region = matched[2]

            let readableTitle = title.replace(/-/g, ' ')
            readableTitle = readableTitle.split(' ').map((value) => {return value.substring(0, 1).toUpperCase() + value.substring(1)}).join(' ')

            // Set up for this region.
            if (writtenHTML[region] === undefined) {
                writtenHTML[region] = {};
            }
            // Set up for this segment
            // segments don't matter too much, but for the sake of
            if (writtenHTML[region][viewLocation] === undefined) {
                writtenHTML[region][viewLocation] = {
                    loc: siteMapObject.loc,
                    values: []
                };
            }

            writtenHTML[region][viewLocation].values.push({ title: readableTitle, modified: siteMapEntry.lastmod, loc: siteMapEntry.loc })
        }
    }

    // make dir if not exists.
    if (!existsSync('./docs')) {
        mkdirSync('./docs/')
    }

    const languages = Object.keys(writtenHTML);

    let mainMarkdown = '# Twitch Help Page\n'
    mainMarkdown += '> Tracking twitch\'s help pages. \n\n'

    mainMarkdown += '## Note\n'
    mainMarkdown += 'This repository does not provide the diff of the articles. All it does it show when articles have changed based\n'
    mainMarkdown += 'off the automatically generated sitemaps provided by twitch. Articles are separated by language code.\n\n'

    mainMarkdown += '## Languages\n\n'
    mainMarkdown += '| Name | Last Updated (dd/mm/yyyy) | Articles | Link |\n'
    mainMarkdown += '|------|---------------------------|----------|------|\n'


    for (const languageCode of languages) {
        const languageName = findName(languageCode)

        let markdown = `# ${languageName}\n`;
        markdown += `> All articles written under the ${languageCode} language code. \n\n`

        let articleCount = 0;
        let lastUpdated = {
            time: new Date(0, 0, 0, 0, 0, 0, 0),
            str: 'Never'
        }

        for (const segmentName of Object.keys(writtenHTML[languageCode])) {
            const segment = writtenHTML[languageCode][segmentName];

            markdown += `## ${segmentName}\n`;
            markdown += `> [Go to](${segment.loc}) this sitemap\n\n`

            markdown += '| Name | Last Updated (dd/mm/yyyy) | Link |\n'
            markdown += '|------|---------------------------|------|\n'

            for (let i = 0; i < segment.values.length; i++) {
                articleCount += 1;

                const nextMeme = segment.values[i];
                const modified = new Date(nextMeme.modified);
                const modifiedStr = modified.toLocaleString('en-GB', { timeZone: 'Australia/Victoria', hour12: true });

                if (modified > lastUpdated.time) {
                    lastUpdated.time = modified
                    lastUpdated.str = modifiedStr
                }

                markdown += `| ${nextMeme.title} | ${modifiedStr} | [Link](${nextMeme.loc}) |\n`
            }

            markdown += '\n\n'
        }

        mainMarkdown += `| ${languageName} | ${lastUpdated.str} | ${articleCount} article(s) | [View](docs/${languageCode}.md) |\n`

        writeFileSync(`./docs/${languageCode}.md`, markdown)
    }

    writeFileSync('./README.md', mainMarkdown);
}

fetch(SITEMAP_URL).then(async (response) => {
    if (!response.ok) {
        console.error('Failed to follow sitemap...');

        return;
    }

    handleSitemap(await response.text())
})
