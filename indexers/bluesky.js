const {
    AllHtmlEntities,
} = require( 'html-entities' );

const Post = require( '../modules/Post.js' );

const htmlEntities = new AllHtmlEntities();

const MILLISECONDS_PER_SECOND = 1000;

// Builds a Post from a Bluesky post stub produced by grunt's bluesky indexer.
// The stub already carries everything (text/url/date/section + an optional
// external link-card), so this parser is service-agnostic and never talks to
// the AppView itself. A Bluesky post body is plain text (facets are byte-range
// overlays we don't expand), so we escape it, keep line breaks, and append the
// external link-card when present.
class Bluesky {
    async parsePost ( accountId, currentPost ) {
        const data = currentPost.data || {};
        const post = new Post();

        const bodyHtml = htmlEntities.encode( data.body || '' ).replace( /\n/g, '<br>' );

        // When the post embeds an external link-card (dev logs / announcements
        // almost always do), surface it as its own linked line so the card's
        // destination isn't lost — the plain text usually only carries a
        // truncated "modrinth.com/datapack/viv..." display string.
        let embedHtml = '';

        if ( data.embedUrl ) {
            const label = htmlEntities.encode( data.embedTitle || data.embedUrl );

            embedHtml = `<p><a href="${ data.embedUrl }">${ label }</a></p>`;
        }

        post.topicTitle = data.title;
        post.topicUrl = data.url;
        post.url = data.url;
        post.text = `<p>${ bodyHtml }</p>${ embedHtml }`;
        post.section = data.section;
        post.accountId = accountId;
        post.timestamp = Math.floor( new Date( data.publishDate ).getTime() / MILLISECONDS_PER_SECOND );

        return post;
    }
}

module.exports = Bluesky;
