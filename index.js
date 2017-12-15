const Queue = require( 'bull' );

const reddit = require( './indexers/Reddit' );

const QUEUE = JSON.parse( process.env.QUEUE );

if ( !QUEUE ) {
    throw new Error( 'Got no queue, exiting' );
}

const redditQueue = new Queue(
    'reddit',
    {
        limiter: {
            max: 1,
            duration: 3000, // Might be 3 request / post (content, redirect & parent)
        },
        redis: QUEUE,
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
