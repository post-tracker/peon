const Queue = require( 'bull' );

const reddit = require( './indexers/Reddit' );

if ( !process.env.REDIS_URL ) {
    throw new Error( 'Got no queue, exiting' );
}

const redditQueue = new Queue(
    'reddit',
    process.env.REDIS_URL,
    {
        limiter: {
            max: 1,
            duration: 2000, // Might be 2 requests / post (content & parent)
        },
    }
);

redditQueue.on( 'error', ( queueError ) => {
    console.error( queueError );
} );

redditQueue.on( 'failed', ( job, jobError ) => {
    console.error( jobError );
} );

redditQueue.process( ( job ) => {
    console.log( `Running job ${ job.id } for ${ job.data.game }` );

    if ( !job.data.accountId ) {
        return job.discard();
    }

    return reddit.parsePost( job.data.accountId, job.data.post )
        .then( ( post ) => {
            if ( !post ) {
                console.log( `Discarding job ${ job.id } because we didn't get a post` );
                job.discard();

                return false;
            }

            return post.save( job.data.game );
        } )
        .catch( ( someError ) => {
            console.log( someError );
            throw someError;
        } );
} );
