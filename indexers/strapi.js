const {
    AllHtmlEntities,
} = require( 'html-entities' );

const Post = require( '../modules/Post.js' );

const htmlEntities = new AllHtmlEntities();

const MILLISECONDS_PER_SECOND = 1000;

// Builds a Post from a Strapi news stub produced by grunt's generic strapi
// indexer. The stub already carries everything (title/body/url/date/section),
// so this parser is service-agnostic and never talks to Strapi itself. The
// body is plain text from the CMS; site content renders as HTML, so we escape
// it, keep line breaks, and link to the full article.
class Strapi {
    async parsePost ( accountId, currentPost ) {
        const data = currentPost.data || {};
        const post = new Post();

        const bodyHtml = htmlEntities.encode( data.body || '' ).replace( /\n/g, '<br>' );

        post.topicTitle = data.title;
        post.topicUrl = data.url;
        post.url = data.url;
        post.text = `<p>${ bodyHtml }</p><p><a href="${ data.url }">Read full article</a></p>`;
        post.section = data.section;
        post.accountId = accountId;
        post.timestamp = Math.floor( new Date( data.publishDate ).getTime() / MILLISECONDS_PER_SECOND );

        return post;
    }
}

module.exports = Strapi;
