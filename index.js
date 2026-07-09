require( 'dotenv' ).config();

const Queue = require( 'bull' );

const indexers = require( './indexers' );

if ( !process.env.REDIS_URL ) {
    throw new Error( 'Got no queue, exiting' );
}

const postsQueue = new Queue(
    'posts',
    process.env.REDIS_URL,
    {
        limiter: {
            max: 1,
            duration: 10000,
        },
    }
);

postsQueue.on( 'error', ( queueError ) => {
    console.error( queueError );
} );

postsQueue.on( 'failed', ( job, jobError ) => {
    // If the API returns duplicate, don't keep it around
    if(jobError.message.includes('returned 409')){
        console.log(`Removed job ${job.id} as the content is a duplicate`);
        job.remove();

        return true;
    }

    console.error( jobError );
} );

// Same parse-and-save flow for every service; the per-service difference lives
// in the indexer's parsePost. Each job name needs its own registration because
// the single 'posts' consumer fails any name it has no handler for.
const processPost = function processPost ( job ) {
    console.log( `Running ${ job.name } job ${ job.id } for ${ job.data.game }` );

    if ( !indexers[ job.name ] ) {
        console.error( `No indexer specified for ${ job.name }` );

        return Promise.reject();
    }

    if ( !job.data.accountId ) {
        return job.discard();
    }

    const postIndexer = new indexers[ job.name ]( job.data.post.indexerConfig );

    return postIndexer.parsePost( job.data.accountId, job.data.post )
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
};

postsQueue.process( 'reddit', processPost );
postsQueue.process( 'rss', processPost );
postsQueue.process( 'bluesky', processPost );
postsQueue.process( 'strapi', processPost );
postsQueue.process( 'discourse', processPost );
