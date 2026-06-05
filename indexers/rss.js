const Post = require( '../modules/Post.js' );

const MILLISECONDS_PER_SECOND = 1000;

// Builds a Post from an RSS stub produced by grunt's generic rss indexer. The
// stub already carries everything (title/body/url/date/section), so this parser
// is service-agnostic and never talks to the feed itself. Unlike the Strapi
// reader, an RSS body is already HTML (e.g. <content:encoded>), so it is kept
// as-is rather than escaped; a "Read full article" link is appended.
class RSS {
    async parsePost ( accountId, currentPost ) {
        const data = currentPost.data || {};
        const post = new Post();

        const body = data.body || '';

        post.topicTitle = data.title;
        post.topicUrl = data.url;
        post.url = data.url;
        post.text = `${ body }<p><a href="${ data.url }">Read full article</a></p>`;
        post.section = data.section;
        post.accountId = accountId;
        post.timestamp = Math.floor( new Date( data.publishDate ).getTime() / MILLISECONDS_PER_SECOND );

        return post;
    }
}

module.exports = RSS;
