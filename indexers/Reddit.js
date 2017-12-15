const got = require( 'got' );
const {
    AllHtmlEntities,
    XmlEntities,
} = require( 'html-entities' );

const Post = require( '../modules/Post.js' );

const xmlEntities = new XmlEntities();
const htmlEntities = new AllHtmlEntities();

const USER_AGENT = 'Peon 1.0.0 by /u/Kokarn';

class Reddit {
    constructor () {
        this.apiBase = 'https://www.reddit.com';
        this.singleCommentUrl = '/comments/{topicID}.json?limit=1000';

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

    async getTopic ( topicID ) {
        this.requestCount = this.requestCount + 1;

        return await got( this.getTopicLink( topicID ), {
            headers: {
                'user-agent': USER_AGENT,
            },
            json: true,
        } );
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

        const text = commentData.data.body_html || commentData.data.selftext_html;

        if ( !text ) {
            // If we reply directly to a topic, this might be the case

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

    async getRedirectUrl ( url ) {
        let response;

        try {
            response = await got( url,
                {
                    headers: {
                        'user-agent': USER_AGENT,
                    },
                }
            );
        } catch ( urlLoadError ) {
            console.log( `${ url } could not be resolved as. It returned a ${ urlLoadError.statusCode }` );

            return false;
        }

        return response.url;
    }

    async parsePost ( accountId, currentPost ) {
        const post = new Post();
        let parentPost = '';

        switch ( currentPost.kind ) {
            case 't1':
                // Posted a reply (probably)
                post.topicTitle = currentPost.data.link_title;
                post.topicUrl = currentPost.data.link_url;

                if ( currentPost.data.link_url.indexOf( 'www.reddit.com' ) === -1 ) {
                    const redirectUrl = await this.getRedirectUrl( `${ this.apiBase }/comments/${ this.parseId( currentPost.data.link_id ) }/` );

                    if ( redirectUrl ) {
                        post.topicUrl = redirectUrl;
                    } else {
                        // If the redirect is broken, we don't want to store the post right now
                        throw new Error( `Got no redirect for ${ currentPost.data.link_url }` );
                    }
                }

                post.url = `${ post.topicUrl }${ currentPost.data.id }/`;
                parentPost = await this.getParentPostHTML( currentPost.data.link_id, currentPost.data.parent_id );
                post.text = parentPost + this.decodeHtml( currentPost.data.body_html );
                post.text = post.text.replace( /href="\/(.+?)\//gim, 'href="https://reddit.com/$1/' );

                break;
            case 't3':
                // Posted a topic (probably)
                post.topicTitle = currentPost.data.title;
                post.topicUrl = currentPost.data.url;

                if ( !currentPost.data.selftext_html ) {
                    // User posted a link to somewhere
                    console.log( 'Post to link' );

                    return false;
                }

                post.text = this.decodeHtml( currentPost.data.selftext_html );
                post.url = currentPost.data.url;

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

module.exports = new Reddit();
