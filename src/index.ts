import fetch from 'node-fetch'
import findName from './codes';
import { XMLParser } from 'fast-xml-parser'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import TableBuilder from "./tablebuilder";

const SITEMAP_URL = 'https://help.twitch.tv/s/sitemap.xml';
const XML_PARSER = new XMLParser();

/**
 * Handle the main sitemap.
 *
 * @param sitemap the incoming sitemap to be parsed.
 */
async function handleSitemap(sitemap: string) {
    const parsedMap : MainSiteMap = XML_PARSER.parse(sitemap, {allowBooleanAttributes: true})

    const objects = parsedMap?.sitemapindex?.sitemap;

    if (objects === undefined || objects.length === 0) {
        console.error('Unable to find sitemap!!')

        return;
    }

    // We really should not be using any here.
    // It might be better to use a different type since using any stops us making use of eslint and typescript's
    // type validation. In the future this will need to be changed.
    //
    // Current format:
    //  {
    //      "en": {
    //          "article-1": {
    //              loc: "https://.../"
    //              values: [
    //                  {
    //                      title: "Hello World",
    //                      modified: "2023-01-16T08:13:35.000Z",
    //                      loc: "https://.../"
    //                  }
    //              ]
    //          }
    //      }...
    //  }
    const markdownInfo : any = {};

    for (let i = 0; i < objects.length; i++) {
        const siteMapObject = objects[i]

        // Retrieve a topic name from the url provided by the sitemap
        let articleTopic = siteMapObject.loc.replace(/https:\/\/help\.twitch\.tv\/s\/sitemap-(topic)?((view)?([a-zA-Z0-9-]+))\.xml/, '$2');
        // Capitalise the first letter of this topic name.
        articleTopic = articleTopic.substring(0, 1).toUpperCase() + articleTopic.substring(1)

        const siteMapData = await fetch(siteMapObject.loc).then((res) => {return res.text()});
        const parsedObject: SecondarySiteMap = XML_PARSER.parse(siteMapData, {allowBooleanAttributes: true});

        for (let i = 0; i < parsedObject.urlset.url.length; i++) {
            const siteMapEntry : SiteMapEntry | SiteMapEntryExtended = parsedObject.urlset.url[i];
            // Retrieve the name and language code for this article
            const matched : RegExpMatchArray = siteMapEntry.loc.match(/https:\/\/help\.twitch\.tv\/s\/(article\/)?(?<name>[A-Za-z0-9-]+)?\?language=(?<language>[A-Za-z_]+)/)

            const title = matched && matched.groups.name ? matched.groups.name : 'generic'; // article name
            const region = matched && matched.groups.language ? matched.groups.language : 'general'; // language code

            // remove all slashes between each character
            let readableTitle = title.replace(/-/g, ' ')
            // capitalize each letter.
            readableTitle = readableTitle.split(' ').map((value) => { return value.substring(0, 1).toUpperCase() + value.substring(1)} ).join(' ')

            // Could be undefined for first element.
            if (markdownInfo[region] === undefined) {
                markdownInfo[region] = {};
            }
            // Same as above. Ensure that this article topic exists in our dataset.
            if (markdownInfo[region][articleTopic] === undefined) {
                markdownInfo[region][articleTopic] = {
                    loc: siteMapObject.loc,
                    values: [] as Array<StoredArticle>
                };
            }

            let modifiedParsed;

            if (siteMapEntry.loc.toLowerCase().includes('/s/article/')) {
                try {
                    modifiedParsed = new Date(siteMapEntry.lastmod)
                } catch (e) {
                    console.error(`Failed to parse modified date for ${region} > ${articleTopic} > ${readableTitle}`)

                    modifiedParsed = new Date()
                }
            } else {
                // don't use modification date on files which change every day
                modifiedParsed = new Date(0, 0, 0, 0, 0, 0, 0);
            }

            // add a new entry to our data list.
            markdownInfo[region][articleTopic].values.push({
                title: readableTitle,
                modified: modifiedParsed,
                loc: siteMapEntry.loc
            });
        }
    }

    // make dir if not exists.
    if (!existsSync('./docs')) {
        mkdirSync('./docs/')
    }

    // make the data actually readable!
    writeResultsToMarkdown(markdownInfo)
}

function writeResultsToMarkdown(markdownInfo: any) {
    const languages = Object.keys(markdownInfo);

    // Sort by country display name.
    languages.sort((a: string , b: string) : number => {
        return findName(a).localeCompare(findName(b));
    });

    // Set up the initial README.md markdown with some flavour text.
    let mainMarkdown = '# Twitch Knowledge-base Tracker\n'
    mainMarkdown += '> Tracking twitch\'s help pages. \n\n'

    mainMarkdown += '## Note\n'
    mainMarkdown += 'This repository does not provide the diff of the articles. All it does it show when articles have changed based\n'
    mainMarkdown += 'off the automatically generated sitemaps provided by twitch. Articles are separated by language code.\n\n'

    mainMarkdown += '## Languages\n\n'

    const mainTable = new TableBuilder('Name', 'Last Updated (dd/mm/yyyy)', 'Articles', 'Link')

    // iterate through all the language codes.
    for (const languageCode of languages) {
        const languageName = findName(languageCode)

        let markdown = `# ${languageName}\n`;
        markdown += `> All articles written under the ${languageCode} language code. \n\n`

        // I wonder what this is for...
        let articleCount = 0;

        // when was the last article updated? use a date at the start of time to force this being overriden.
        let lastUpdated = {
            time: new Date(0, 0, 0, 0, 0, 0, 0),
            str: 'Never'
        }

        // sort it
        let segments = Object.keys(markdownInfo[languageCode]);
        segments = segments.sort();

        // iterate through all the article types (topicarticle-1, topicarticle-2...)
        for (const segmentName of segments) {
            const segment = markdownInfo[languageCode][segmentName];

            markdown += `## ${segmentName}\n`;
            markdown += `> [Go back](../README.md) to the main page | [Go to](${segment.loc}) this sitemap\n\n`

            const articleTable = new TableBuilder('Name', 'Last Updated (dd/mm/yyyy)', 'Link')

            // markdown += '| Name | Last Updated (dd/mm/yyyy) | Link |\n'
            // markdown += '|------|---------------------------|------|\n'

            const values = segment.values as Array<StoredArticle>;

            // sort by modification time, newest to oldest
            values.sort((a: StoredArticle, b: StoredArticle) => {
                return a.modified == b.modified ? 0 : a.modified > b.modified ? -1 : 1;
            })

            for (let i = 0; i < values.length; i++) {
                // Increment article count.
                articleCount += 1;

                const nextSegment = values[i];
                const modifiedStr = nextSegment.modified.toLocaleString('en-GB', { timeZone: 'Australia/Victoria', hour12: true });

                // If the date is newer than the last updated date, consider this the most
                // recently changed article, and store the previous locale string format result too.
                if (nextSegment.modified > lastUpdated.time) {
                    lastUpdated.time = nextSegment.modified
                    lastUpdated.str = modifiedStr
                }

                // Insert this article into the table
                articleTable.insertRow(nextSegment.title, modifiedStr, `[Link](${nextSegment.loc})`)
            }

            markdown += articleTable.build()
            markdown += '\n\n'
        }

        // Create a new entry on the README for this country, with the amount of articles and a link to the markdown file.
        mainTable.insertRow(languageName, lastUpdated.str, `${articleCount} article(s)`, `[View](docs/${languageCode}.md)`)

        writeFileSync(`./docs/${languageCode}.md`, markdown)
    }

    mainMarkdown += mainTable.build();

    mainMarkdown += '### Dumping\n'
    mainMarkdown += 'A dump of articles can be found [here](docs/RAW.md)'

    writeFileSync('./README.md', mainMarkdown);
}

if (process.env.RAW_URL) {
    console.log('Running raw code.')

    try {
        // @ts-ignore
        import('./downloaded').catch(() => {
            console.error('Unable to import raw module. ')
        })
    } catch (e) {
        console.error('Failed to run raw dump', e.message)
    }
}

console.log('Running sitemap check!')

fetch(SITEMAP_URL).then(async (response) => {
    if (!response.ok) {
        console.error(`Received a bad status code [${response.status}] when attempting to read sitemap...`);

        return;
    }

    await handleSitemap(await response.text())

    console.log('Files written, check out the README! <3')
})
