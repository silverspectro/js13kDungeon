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
				for (var x = 0; x < games[i].dungeons.length; x++) {
					if (games[i].dungeons[x].id === id) return games[i];
				}
			}
			return undefined;
		}
	
/* -------- End Games Sessions -------- */

/* -------- Dungeon Class -------- */

	var squareStates = {
		p: 'square player',
		0: 'square',
	};

	/**
	 * Dungeon Class
	 * @param {id}
	 */
	function Dungeon(socket) {
		this.socket = socket;
		this.id = this.socket.id;
		this.area = [];
		this.life = 100;
		this.money = 100;
		this.init();
	}

	Dungeon.prototype = {
		init: function() {
			var self = this;

			this.createArea();

			this.socket.on('new-game', function () {
				var newGame = new Game(self.socket, true);
				games.push(newGame);
				var game = find(games, self.socket.id);
				game.addDungeon(self);
				self.socket.emit('game-created', game.toJSON());
			});

			this.socket.on('list-games', function () {
				self.socket.emit("room-list", listRooms());
			});

			this.socket.on("disconnect", function () {
				var game = find(games, self.socket.id);
				if (self) game = game || findByDungeonId(self.socket.id);
				if (game) {
					if (game.dungeons.length <= 1) remove(games, game);
					game.removeDungeon(self.socket.id);
					game.broadcast('update', game.toJSON());
				}
				console.log("Disconnected: " + self.socket.id);
			});

			this.socket.on('join-game', function (gameId) {
				var game = find(games, gameId);
				if (game) self.joinRoom(game);
			});

			this.socket.on('move-player', function (direction) {
				self.movePlayer(direction);
				var game = findByDungeonId(self.id);
				game.broadcast('update', game.toJSON());
			});

			this.socket.on('apply-option', function (data) {
				var game = findByDungeonId(data.dungeonId);
				var dungeon = find(game.dungeons, data.dungeonId);
				if (dungeon.id !== self.id) dungeon.applyOption(data.x, data.y, data.option);
				game.broadcast('update', game.toJSON());
			});

		},
		applyOption: function(x, y, optionName) {
			if (this.area[x][y].state === 'square') {
				this.area[x][y].state += optionName;
			}
		},
		movePlayer: function(direction) {
			var movementValue = 0;
			var squareY = this.player.y;
			var squareX = this.player.x;
			switch(direction) {
				case 'up': {
					movementValue -= squareY - 1 >= 0 ? 1 : 0;
					if (!this.area[squareY + movementValue][squareX].state.includes('wall')) {
						this.area[squareY + movementValue][squareX].state = 'square player';
						this.area[squareY][squareX].state = 'square';
						this.player.y += movementValue;
						this.life--;
					}
					break;
				}
				case 'down': {
					movementValue += squareY + 1 <= this.area.length - 1 ? 1 : 0;
					if (!this.area[squareY + movementValue][squareX].state.includes('wall')) {						
						this.area[squareY + movementValue][squareX].state = 'square player';
						this.area[squareY][squareX].state = 'square';
						this.player.y += movementValue;
						this.life--;
					}
					break;
				}
				case 'left': {
					movementValue -= squareX - 1 >= 0 ? 1 : 0;
					if (!this.area[squareY][squareX + movementValue].state.includes('wall')) {
						this.area[squareY][squareX + movementValue].state = 'square player';
						this.area[squareY][squareX].state = 'square';
						this.player.x += movementValue;
						this.life--;
					}
					break;
				}
				case 'right': {
					movementValue += squareX + 1 >= 0 ? 1 : 0;
					if (!this.area[squareY][squareX + movementValue].state.includes('wall')) {
						this.area[squareY][squareX + movementValue].state = 'square player';
						this.area[squareY][squareX].state = 'square';
						this.player.x += movementValue;
						this.life--;
					}
					break;
				}
			}
		},
		toJSON: function() {
			return {
				id: this.id,
				area: this.area,
				life: this.life,
				money: this.money,
				player: this.player,
			};
		},
		createArea: function(x, y, numberOfCells) {
			x = x || 300;
			y = y || 400;
			numberOfCells = numberOfCells || 30;
			
			var cellSize = x / numberOfCells;
			var rows = Math.floor(y / cellSize);

			for(var row = 0; row < rows; row++) {
				this.area.push([]);
				for(var column = numberOfCells; column > 0; column--) {
					this.area[row].push({
						style: {
							width: cellSize - 1 + 'px',
							height: cellSize - 1 + 'px',
						},
						state: squareStates[0],
					});
				}
			}
			this.player = {
				x: Math.ceil(numberOfCells/2),
				y: 0,
			};
			this.area[this.player.y][this.player.x].state = squareStates['p'];
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