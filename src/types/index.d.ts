/**
 * The generic Sitemap entry. Used for top-level article sitemaps.
 */
interface SiteMapEntry {
    loc: string,
    lastmod: string;
}

/**
 * Extension of the main sitemap. There is an extra attribute which the library
 * does not seem to parse correctly. For completeness we'll keep the type here.
 */
interface SiteMapEntryExtended extends SiteMapEntry {
    'xhtml:link': Array<string>
}

/**
 * The main site map when traversing the top sitemap path.
 *
 * @param ?xml seems to always be empty
 * @param sitemapindex always has a key of "sitemap" when parsed by the library. If this is missing then it
 *                     should be assumed that it was not parsed correctly. Or twitch has updated their help-page.
 */
type MainSiteMap = {
    '?xml': '',
    sitemapindex: {
        sitemap: Array<SiteMapEntry>
    }
}

/**
 * The secondary site maps under all the article paths.
 *
 * @param ?xml always seems to be empty.
 * @param urlset contains a list of all the urls under this article.
 */
type SecondarySiteMap = {
    '?xml': '',
    urlset: {
        url: Array<SiteMapEntry | SiteMapEntryExtended>
    }
}
