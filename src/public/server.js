"use strict";

/* -------- Games Sessions -------- */

	/**
	 * Games sessions
	 * @param {array} Games
	 */
	var games = [];

	/**
	 * List Rooms for UI and selection
	 */
		function listRooms() {
			return games.map(function(game) {
				return game.toJSON();
			});
		}

		function findByDungeonId(id) {
			for (var i = 0; i < games.length; i++) {
				for (var x = 0; i < games[i].dungeons.length; x++) {
					if (games[i].dungeons[x].id === id) return games[i];
				}
			}
			return undefined;
		}
	
/* -------- End Games Sessions -------- */

/* -------- Dungeon Class -------- */

	/**
	 * Dungeon Class
	 * @param {id}
	 */
	function Dungeon(socket) {
		this.socket = socket;
		this.id = this.socket.id;
		this.area = [];
		this.life = 20;
		this.money = 100;
		this.init();
	}

	Dungeon.prototype = {
		init: function() {
			var self = this;

			this.socket.on('new-game', function () {
				games.push(new Game(self.socket));
				var game = find(games, self.socket.id);
				game.addDungeon(self);
				self.socket.emit('game-created', game.toJSON());
			});

			this.socket.on('list-games', function () {
				self.socket.emit("room-list", listRooms());
			});

			this.socket.on("disconnect", function () {
				var game = find(games, self.socket.id);
				game = game || findByDungeonId(self.socket.id);
				if (game) {
					if (game.dungeons.length <= 1) remove(games, game);
					game.removeDungeon(self.socket.id);
					game.broadcast('update', game.toJSON());
				}
				console.log("Disconnected: " + self.socket.id);
			});

			this.socket.on('join-game', function (gameId) {
				var game = find(games, gameId);
				self.joinRoom(game);
			});	
		},
		toJSON: function() {
			return {
				id: this.id,
				area: this.area,
				life: this.life,
				money: this.money,
			};
		},
		joinRoom: function(game) {
			this.socket.join(game.id);
			game.addDungeon(this);
			game.broadcast('update', game.toJSON());
			console.log(this.socket.id + " has joined: " + game.id);
		}
	};

/* -------- End Dungeon Class -------- */


/**
 * Socket.IO on connect event
 * @param {Socket} socket
 */
module.exports = function (socket) {
	var user = new Dungeon(socket);

	console.log("Connected: " + socket.id);
};