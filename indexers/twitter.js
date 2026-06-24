require( 'dotenv' ).config();

const moment = require( 'moment' );
const TwitterAPI = require( 'twitter' );
const tweet2html = require( 'tweet-html' );
const cheerio = require( 'cheerio' );

const Post = require( '../modules/Post.js' );

class Twitter {
    constructor () {
        this.client = new TwitterAPI( {
            // eslint-disable-next-line camelcase
            bearer_token: process.env.TWITTER_BEARER_TOKEN,
            // eslint-disable-next-line camelcase
            consumer_key: process.env.TWITTER_CONSUMER_KEY,
            // eslint-disable-next-line camelcase
            consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        } );
    }

    async getParentTweet ( tweetId ) {
        let parentTweetData = false;

        try {
            parentTweetData = await this.getTweet( tweetId );
        } catch ( parentLoadError ) {
            console.error( parentLoadError );
        }

        if ( !parentTweetData ) {
            return false;
        }

        return `<blockquote>
            <div>
                <b>
                    <a href="https://twitter.com/${ parentTweetData.user.screen_name }/status/${ parentTweetData.id_str }/">
                        @${ parentTweetData.user.screen_name }
                    </a>
                </b>
            </div>
            ${ this.tweetToHTML( parentTweetData ) }
        </blockquote>`;
    }

    async getTweet ( tweetId ) {
        let tweetData = false;

        try {
            tweetData = await this.client.get( '/statuses/show', {
                id: tweetId,
                tweet_mode: 'extended',
            } );
        } catch ( loadError ) {
            console.error( loadError );
        }

        return tweetData;
    }

    tweetToHTML ( tweet ) {
        const html = tweet2html( tweet, tweet.user.screen_name );
        if ( html.indexOf( '…' ) > -1 ) {
            console.log( JSON.stringify( tweet, null, 4 ) );
        }

        const $ = cheerio.load( html );

        $( '.date' ).remove();

        return $( 'body' ).html();
    }

    async parsePost ( accountId, currentPost ) {
        const post = new Post();

        post.accountId = accountId;
        post.url = `https://twitter.com/${ currentPost.user.screen_name }/status/${ currentPost.id_str }/`;
        post.text = this.tweetToHTML( currentPost );

        if ( currentPost.in_reply_to_status_id_str ) {
            let parentPost = false;

            if ( currentPost.quoted_status ) {
                parentPost = this.tweetToHTML( currentPost, currentPost.quoted_status );
            } else {
                try {
                    parentPost = await this.getParentTweet( currentPost.in_reply_to_status_id_str );
                } catch ( parentLoadError ) {
                    console.error( parentLoadError );
                }
            }

            if ( parentPost === false ) {
                return false;
            }

            post.text = `${ parentPost }${ post.text }`;
        }

        post.timestamp = moment( currentPost.created_at, 'ddd MMM DD, HH:mm:ss ZZ YYYY' ).unix();
        post.topicTitle = 'tweeted';

        return post;
    }
}

module.exports = new Twitter();
