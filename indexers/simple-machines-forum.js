const cheerio = require( 'cheerio' );
const moment = require( 'moment' );

const Post = require( '../modules/Post.js' );

const MILLISECONDS_PER_SECOND = 1000;

class SimpleMachinesForum {
    async parsePost ( accountId, currentPost ) {
        const $ = cheerio.load( currentPost.markup );
        const post = new Post();
        const $topicLink = $( 'a' ).eq( 1 );

        const timestampMatches = $( 'span.smalltext' )
            .text()
            .match( /on: (.+?).{2}$/m );

        // March 09, 2017, 05:53:06 PM
        // Today at 05:53:06 PM
        post.timestamp = moment( timestampMatches[ 1 ].replace( 'Today at', '' ), [
            'MMMM DD, YYYY, h:m:s a',
            'H:m:s a',
        ] ).unix();

        post.text = $( 'div.list_posts' )
            .html()
            .trim();

        post.url = $topicLink.attr( 'href' );
        post.topicTitle = $topicLink.text().replace( /^Re: /, '' );
        post.topicUrl = $topicLink.attr( 'href' ).match( /(.+?topic=\d+)/ )[ 1 ];

        return post;
    }
}

module.exports = SimpleMachinesForum;
