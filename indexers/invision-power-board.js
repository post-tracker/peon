const cheerio = require( 'cheerio' );

const Post = require( '../modules/Post.js' );

const MILLISECONDS_PER_SECOND = 1000;

class InvisionPowerBoard {
    async parsePost ( accountId, currentPost ) {
        const $ = cheerio.load( currentPost.markup );
        const post = new Post();
        const $title = $( 'h3' ).first();

        post.accountId = accountId;
        post.url = $title
            .find( 'a' )
            .attr( 'href' );
        post.section = $( 'p.ipsType_normal a' )
            .text()
            .trim();
        post.topicTitle = $title
            .text()
            .trim();
        post.topicUrl = post.url.substr( 0, post.url.lastIndexOf( '/' ) + 1 );
        post.text = $( '.ipsType_richText' )
            .html()
            .trim();
        post.timestamp = Math.floor( Date.parse( $( 'time' ).attr( 'datetime' ) ) / MILLISECONDS_PER_SECOND );

        return post;
    }
}

module.exports = InvisionPowerBoard;
