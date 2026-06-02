const got = require( 'got' );
const {
    AllHtmlEntities,
    XmlEntities,
} = require( 'html-entities' );

const Post = require( '../modules/Post.js' );
const redditAuth = require( '../modules/reddit-auth.js' );

const xmlEntities = new XmlEntities();
const htmlEntities = new AllHtmlEntities();

const UNAUTHORIZED_STATUS_CODE = 401;

const IMAGE_DOMAINS = [
    'i.redd.it',
    'i.imgflip.com',
    'imgur.com',
    'i.imgur.com',
];

class Reddit {
    constructor () {
        // The unauthenticated .json endpoints are blocked, so we talk to the
        // OAuth API host with a bearer token (see modules/reddit-auth).
        this.apiBase = 'https://oauth.reddit.com';
        this.singleCommentUrl = '/comments/{topicID}?limit=1000';

        this.requestCount = 0;
    }

    decodeHtml ( encodedHtml ) {
        return xmlEntities.decode( htmlEntities.decode( encodedHtml ) );
    }

    parseId ( id ) {
        return id.replace( 't1_', '' ).replace( 't3_', '' );
    }

    getTopicLink ( topicID ) {
        return this.apiBase + this.singleCommentUrl.replace( '{topicID}', this.parseId( topicID ) );
    }

    async authedGet ( url ) {
        const token = await redditAuth.getToken();

        return got( url, {
            headers: {
                authorization: `bearer ${ token }`,
                'user-agent': redditAuth.userAgent(),
            },
            json: true,
        } );
    }

    async getTopic ( topicID ) {
        this.requestCount = this.requestCount + 1;

        const url = this.getTopicLink( topicID );

        try {
            return await this.authedGet( url );
        } catch ( requestError ) {
            const statusCode = requestError.statusCode || ( requestError.response && requestError.response.statusCode );

            // A 401 means the token was rejected (expired or revoked early).
            // Drop it and retry once with a fresh one before giving up.
            if ( statusCode === UNAUTHORIZED_STATUS_CODE ) {
                redditAuth.invalidateToken();

                return await this.authedGet( url );
            }

            throw requestError;
        }
    }

    findComment ( listing, commentID ) {
        if ( !listing ) {
            console.log( 'Got invalid listing data' );

            return false;
        }

        for ( let i = 0; i < listing.length; i = i + 1 ) {
            if ( listing[ i ].data.id === commentID ) {
                return listing[ i ];
            }

            if ( listing[ i ].data.replies ) {
                const post = this.findComment( listing[ i ].data.replies.data.children, commentID );

                if ( post ) {
                    return post;
                }
            }
        }

        return false;
    }

    findCommentInTopic ( topicData, commentID ) {
        if ( !topicData ) {
            console.log( 'Got invalid topic data' );

            return false;
        }

        for ( let i = 0; i < topicData.length; i = i + 1 ) {
            const post = this.findComment( topicData[ i ].data.children, this.parseId( commentID ) );

            if ( post ) {
                return post;
            }
        }

        return false;
    }

    async getParentPostHTML ( topicID, commentID ) {
        const topicResponse = await this.getTopic( topicID );
        const commentData = this.findCommentInTopic( topicResponse.body, commentID );

        if ( !commentData ) {
            // This happens in very large threads

            return '';
            //throw new Error( `Unable to find post with id ${ commentID } in ${ this.getTopicLink( topicID ) }` );
        }

        let text = commentData.data.body_html || commentData.data.selftext_html;

        if ( !text && commentData.data.secure_media_embed && commentData.data.secure_media_embed.content ) {
            text = commentData.data.secure_media_embed.content;
        }

        if ( !text ) {
            if ( IMAGE_DOMAINS.includes( commentData.data.domain ) ) {
                text = htmlEntities.encode( `<img src="${ commentData.data.url }" title="${ commentData.data.title }" />` );
            } else {
                text = htmlEntities.encode( `<a href="${ commentData.data.url }">${ commentData.data.title }</a>` );
            }
        }

        if ( !text ) {
            return '';
        }

        if ( text.indexOf( '&lt;div class="md"&gt;&lt;p&gt;[deleted]&lt;/p&gt;' ) > -1 ) {
            // If the parent post was deleted, don't include that part

            return '';
        }

        return `<blockquote>
            <div class="bb_quoteauthor">
                Originally posted by
                <b>
                    <a href="${ topicResponse.body[ 0 ].data.children[ 0 ].data.permalink }${ commentData.data.id }">
                        ${ commentData.data.author }
                    </a>
                </b>
            </div>
            ${ this.decodeHtml( text ) }
        </blockquote>`;
    }

    async parsePost ( accountId, currentPost ) {
        const post = new Post();
        let parentPost = '';

        switch ( currentPost.kind ) {
            case 't1':
                // Posted a reply (probably)
                post.topicTitle = currentPost.data.link_title;
                post.topicUrl = currentPost.data.link_permalink || currentPost.data.link_url;
                post.url = `${ post.topicUrl }${ currentPost.data.id }/`;
                parentPost = await this.getParentPostHTML( currentPost.data.link_id, currentPost.data.parent_id );
                post.text = parentPost + this.decodeHtml( currentPost.data.body_html );
                post.text = post.text.replace( /href="\/(.+?)\//gim, 'href="https://reddit.com/$1/' );

                break;
            case 't3':
                // Posted a topic (probably)
                post.topicTitle = currentPost.data.title;
                post.topicUrl = currentPost.data.url;

                if ( currentPost.data.selftext_html || ( currentPost.data.secure_media_embed && currentPost.data.secure_media_embed.content ) ) {
                    if ( currentPost.data.selftext_html ) {
                        post.text = this.decodeHtml( currentPost.data.selftext_html );
                    } else if ( currentPost.data.secure_media_embed.content ) {
                        post.text = this.decodeHtml( currentPost.data.secure_media_embed.content );
                    }
                    // For t3 the individual URL is the same as the topic
                    post.url = post.topicUrl;
                } else {
                    post.url = `https://www.reddit.com${ currentPost.data.permalink }`;

                    if ( IMAGE_DOMAINS.includes( currentPost.data.domain ) ) {
                        post.text = `<img src="${ currentPost.data.url }" title="${ currentPost.data.title }" />`;

                        // For images the link in the title should point to the reddit page
                        post.topicUrl = post.url;
                    } else {
                        post.text = `<a href="${ currentPost.data.url }">${ currentPost.data.title }</a>`;
                    }
                }

                break;
            default:
                console.error( `Unkown reddit type ${ currentPost.kind }` );
                break;
        }

        post.accountId = accountId;
        post.section = currentPost.data.subreddit;
        post.timestamp = currentPost.data.created_utc;

        return post;
    }
}

module.exports = Reddit;
