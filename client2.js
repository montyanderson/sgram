const Server = require('./');

(async () => {
	const server = await Server.create(3011);

	server.connect(3010, 'localhost');

	server.on('peer', peer => {
		peer.on('message', message => {
			console.log(`peer says: ${message}`);
		});
	});
})();
