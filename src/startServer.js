import os from "os";
import cluster from "cluster";
import GraphQLHTTPServer from "graphql-http-ws-server";
import quoteCacheSchema from "./quoteCacheSchema";
import RedisDBCollection from "./RedisDBCollection";
import LocalDBCollection from "./LocalDBCollection";

export default (config) => {
	const workers = config.hasOwnProperty('workers') ? config.workers : os.cpus().length;

	if(workers > 1 && cluster.isMaster) {
		for(let ctr = 0; ctr < workers; ctr++)
			cluster.fork();

		cluster.on('exit', (worker, code, signal) => {
			console.log(`worker ${worker.process.pid} died`);
		});
	}
	else {
		const collections = new Map();
		let defaultCollection = config.hasOwnProperty('defaultCollection') ? config.defaultCollection : null;

		for(let collectionKey in config.collections) {
			if(config.collections.hasOwnProperty(collectionKey)) {
				const collectionConfig = config.collections[collectionKey];

				if(collectionConfig.type === 'redis')
					collections.set(collectionKey, new RedisDBCollection(collectionConfig.hasOwnProperty('options') ? collectionConfig.options : {}));
				else if(collectionConfig.type === 'local') {
					if(workers > 1)
						throw new Error(`Running local collection with more than one worker thread`)
					collections.set(collectionKey, new LocalDBCollection());
				}
				else
					throw new Error(`Unknown collection type '${collectionConfig.type}' in '${collectionKey}'`)

				// Set default collection to be first valid collection, if not already set
				if(defaultCollection === null)
					defaultCollection = collectionKey;
			}
		}

		if(!collections.has(defaultCollection))
			throw new Error(`Default collection ${defaultCollection} not in collection list`);

		const schema = quoteCacheSchema(collections, defaultCollection);
		const server = new GraphQLHTTPServer(schema, Object.assign({}, config.server));
	}

	function debug() {
		if(typeof config.debug === 'function')
			config.debug.apply(this, Array.prototype.slice.call(arguments));
		else if(config.debug)
			console.log.apply(console, Array.prototype.slice.call(arguments));
	}
}

