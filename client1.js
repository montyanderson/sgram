const Server = require('./');

(async () => {
	const server = await Server.create(3010);

	server.on('peer', peer => {
		console.log('peer connected');

		setTimeout(() => peer.send('Hello, peer!'), 200);
	});
})();
