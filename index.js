const crypto = require('crypto');
const dgram = require('dgram');
const EventEmitter = require('events');
const util = require('util');

const generateKeyPair = util.promisify(crypto.generateKeyPair);
const publicEncrypt = util.promisify(crypto.publicEncrypt);
const privateDecrypt = util.promisify(crypto.privateDecrypt);

module.exports = class Server extends EventEmitter {
	constructor() {
		super();
	}

	async _create(port) {
		const {publicKey, privateKey} = await generateKeyPair('rsa', {
			modulusLength: 4096,
			publicKeyEncoding: {
				type: 'spki',
				format: 'pem'
			},
			privateKeyEncoding: {
				type: 'pkcs8',
				format: 'pem'
			}
		});

		this.publicKey = publicKey;
		this.privateKey = privateKey;

		this.peerKeys = {};
		this.peers = {};

		this.server = dgram.createSocket('udp4');

		this.server.on('message', this._handlePacket.bind(this));

		this.server.bind(port);

		return this;
	}

	async _setPeerKey(port, host, key) {
		this.peerKeys[`${host}:${port}`] = key;
	}

	async _getPeerKey(port, host) {
		return this.peerKeys[`${host}:${port}`];
	}

	_createPeer(port, host) {
		const key = `${host}:${port}`;

		if(typeof this.peers[key] !== 'object') {
			const peer = new EventEmitter();

			peer.send = async message => {
				const cipherText = await publicEncrypt(this._getPeerKey(port, host), Buffer.from(message));

				const msg = Buffer.alloc(1 + cipherText.length);

				msg[0] = 3;

				cipherText.copy(msg, 1);
				this.server.send(msg, port, host);
			};

			this.peers[key] = peer;
		}

		return this.peers[key];
	}

	static async create(...args) {
		return (new this)._create(...args);
	}

	connect(port, host, sendKey = true) {
		const message = Buffer.alloc(1 + this.publicKey.length);

		message[0] = sendKey === true ? 1 : 2;

		Buffer.from(this.publicKey).copy(message, 1);

		this.server.send(message, port, host);
	}

	async _handlePacket(msg, rinfo) {
		if(msg[0] === 1 || msg[0] === 2) {
			this._setPeerKey(rinfo.port, rinfo.address, msg.slice(1).toString());
			const peer = this._createPeer(rinfo.port, rinfo.address);

			this.emit('peer', peer);

			if(msg[0] === 1) {
				this.connect(rinfo.port, rinfo.address, false);
			}
		}

		if(msg[1] === 3) {
			console.log(msg);
			const cipherText = msg.slice(1);

			const message = await privateDecrypt(this.privateKey, cipherText);

			this._createPeer(rinfo.port, rinfo.address).emit('message', message);
		}
	}
};
