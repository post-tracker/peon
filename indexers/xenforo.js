const Post = require( '../modules/Post.js' );

const MILLISECONDS_PER_SECOND = 1000;

// Builds a Post from a stub produced by grunt's xenforo indexer. The stub
// already carries everything (title/body/url/date/section); the body is the
// search-result snippet's rendered HTML, so it is kept as-is and a "View on
// forum" link is appended. Mirrors the Discourse reader.
class XenForo {
    async parsePost ( accountId, currentPost ) {
        const data = currentPost.data || {};
        const post = new Post();

        const body = data.body || '';

        post.topicTitle = data.title;
        post.topicUrl = data.url;
        post.url = data.url;
        post.text = `${ body }<p><a href="${ data.url }">View on forum</a></p>`;
        post.section = data.section;
        post.accountId = accountId;
        post.timestamp = Math.floor( new Date( data.publishDate ).getTime() / MILLISECONDS_PER_SECOND );

        return post;
    }
}

module.exports = XenForo;
