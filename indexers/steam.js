const cheerio = require( 'cheerio' );
const moment = require( 'moment' );

const Post = require( '../modules/Post.js' );

class Steam {
    async parsePost ( accountId, currentPost ) {
        const $ = cheerio.load( currentPost.markup );
        const forumLink = $( 'a.searchresult_forum_link' ).attr( 'href' );
        const post = new Post();

        post.accountId = accountId;
        post.timestamp = $( 'div.searchresult_timestamp' )
            .text()
            .trim();

        if ( post.timestamp.indexOf( 'Just now' ) > -1 ) {
            post.timestamp = moment().unix();
        } else if ( post.timestamp.indexOf( 'ago' ) > -1 ) {
            const numberOffset = post.timestamp.match( /\d+/g )[ 0 ];

            if ( post.timestamp.indexOf( 'hour' ) > -1 ) {
                post.timestamp = moment()
                    .subtract( Number( numberOffset ), 'hours' )
                    .unix();
            } else if ( post.timestamp.indexOf( 'minute' ) > -1 ) {
                post.timestamp = moment()
                    .subtract( Number( numberOffset ), 'minutes' )
                    .unix();
            }
        } else {
            post.timestamp = moment( post.timestamp, [
                'D MMM, YYYY @ h:ma',
                'D MMM @ h:ma',
            ] ).unix();
        }

        if ( Number.isNaN( post.timestamp ) ) {
            const timeString = $( 'div.searchresult_timestamp' )
                .text()
                .trim();

            console.error( `Unable to parse Steam time ${ timeString }` );
        }

        post.url = $( 'div.post_searchresult_simplereply' )
            .attr( 'onclick' )
            .replace( 'window.location=', '' )
            .replace( /'/g, '' );

        post.topicTitle = $( 'a.forum_topic_link' )
            .text();

        post.topicUrl = $( 'a.forum_topic_link' )
            .attr( 'href' );

        post.text = $( 'div.post_searchresult_simplereply' )
            .html()
            .trim();

        // Fix some links pointing to topic id's with #
        post.text = post.text.replace( /href="#(.+?)"/gim, `href="${ post.topicUrl }#$1"` );

        let sectionUrlMatches = forumLink.match( /steamcommunity\.com\/app\/(\d*)\/discussions\/\d+\//i );

        if ( !sectionUrlMatches || !sectionUrlMatches[ 1 ] ) {
            sectionUrlMatches = forumLink.match( /steamcommunity\.com\/workshop\/discussions\/.*\?appid=(\d*)/i );
        }

        if ( !sectionUrlMatches || !sectionUrlMatches[ 1 ] ) {
            console.log( forumLink );
            post.section = false;
        } else {
            post.section = sectionUrlMatches[ 1 ];
        }

        return post;
    }
}

module.exports = Steam;
