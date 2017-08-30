"use strict";

/**
 * Transmit event to game dungeons
 * @param {Game} game origine game
 * @param {String} eventName event name
 * @param {String} payload event content
 */
function broadcast(game, eventName, payload) {
  game.room.broadcast.to(game.room.id).emit(eventName, payload);
  game.room.emit(eventName, payload); // for itself
}


/* -------- ServerController Class -------- */

var MAX_CLOCK_TIME = 60 * 30;

/**
 * ServerController Class
 * @param {socket} socket
 * @TODO : remove controller if socket closed
 */
function ServerController(socket, options) {
  this.id = socket.id;
  this.game = new Game(socket, options);
}

ServerController.prototype = {
  start: function() {
    if (this.game.checkReady()) {
      this.clock = setInterval(this.checkClock.bind(this), 1000);
      return true;
    } 
    return false;
  },
  destroy: function() {
    clearInterval(this.clock);
  },
  checkClock: function () {
    // check if a timer exceed the max time
    // just in case to not overload the server in case
    // a 'disconnect' event get lost
    if (this.game.time > MAX_CLOCK_TIME) {
      clearInterval(this.clock);
      broadcast(this.game, 'game-lost', { message: "Lost - OUT OF TIME", });
    }

    this.reduceLifeOnClock(this.game.time);
    broadcast(this.game, 'update', this.game.toJSON());
  },
  reduceLifeOnClock: function (time) {
    var self = this;
    this.game.dungeons.forEach(function (dungeon) {
      dungeon.lastUpdateTime++;
      if ((dungeon.lastUpdateTime >= dungeon.config.timeLimit) &&
        (dungeon.lastUpdateTime % dungeon.config.timeLimit === 0)
      ) {
        dungeon.life -= self.game.applyModifiers('timeLimitMalus', dungeon);
        dungeon.modifiers.timeLimitMalus++;
      }
      if (dungeon.lastUpdateTime < dungeon.config.timeLimit) {
        dungeon.modifiers.timeLimitMalus = 0;
      }
      if (dungeon.life <= 0 && !dungeon.player.lost) {
        broadcast(self.game, 'game-lost', {
          dungeonId: dungeon.id,
          message: "Lost - OUT OF TIME",
        });
        dungeon.player.lost = true;
      }
    });
  }
}

/* -------- End ServerController Class -------- */


/* -------- controllers Sessions -------- */

/**
 * controllers sessions
 * @param {array} controllers
 */
var controllers = [];

/**
 * List Rooms for UI and selection
 */
function listRooms() {
  return controllers.map(function (controller) {
    return controller.game.toJSON();
  });
}

function findByDungeonId(id) {
  for (var i = 0; i < controllers.length; i++) {
    for (var x = 0; x < controllers[i].game.dungeons.length; x++) {
      if (controllers[i].game.dungeons[x].id === id) return controllers[i];
    }
  }
  return undefined;
}

/* -------- End controllers Sessions -------- */

/* -------- Dungeon Class -------- */

var squareStates = {
  p: 'square player',
  0: 'square',
};

/**
 * Dungeon Class
 * @param {id}
 */
function Dungeon(socket, config) {

  this.socket = socket;
  this.id = this.socket.id;
  this.area = [];
  this.life = 100;
  this.money = 100;
  this.lastUpdateTime = 0;

  config = config || {};
  this.config = {
    trapFeedback: config.trapFeedback || 3,
    trapCost: config.trapCost || 15,
    wallCost: config.wallCost || 5,
    timeLimit: config.timeLimit || 10,
    timeLimitMalus: config.timeLimitMalus || 1,
  };

  this.modifiers = {
    timeLimitMalus: 0,
  };

  this.init();
}

Dungeon.prototype = {
  init: function () {
    var self = this;

    this.socket.on('new-game', function (payload) {
      var newController = new ServerController(self.socket);
      controllers.push(newController);
      var controller = find(controllers, self.socket.id);
      var game = controller ? controller.game : undefined;
      self.createArea(payload.areaWidth, payload.areaHeight);
      game.addDungeon(self);
      self.socket.emit('game-created', game.toJSON());
    });

    this.socket.on('list-games', function () {
      self.socket.emit("room-list", listRooms());
    });

    this.socket.on("disconnect", function () {
      var controller = find(controllers, self.socket.id);
      if (!controller) {
        controller = controller || findByDungeonId(self.socket.id);
      }
      var game = controller ? controller.game : undefined;
      if (game) {
        game.removeDungeon(self.socket.id);
        if (game.dungeons.length === 0) {
          controller.destroy();
          remove(controllers, findIndex(controllers, game.id));
          console.log("Deleted: " + game.id);
        } else {
          game.removeDungeon(self.socket.id);
          broadcast(game, 'update', game.toJSON());
        }
      }
      console.log("Disconnected: " + self.socket.id);
    });

    this.socket.on('join-game', function (payload) {
      var controller = find(controllers, payload.gameId);
      var game = controller ? controller.game : undefined;
      self.createArea(payload.areaWidth, payload.areaHeight);
      if (game && !game.started) self.joinRoom(game);
    });

    this.socket.on('move-player', function (direction) {
      var controller = findByDungeonId(self.id);
      var game = controller ? controller.game : undefined;
      if (game && game.started) {
        self.movePlayer(direction);
        self.lastUpdateTime = 0;
        broadcast(game, 'update', game.toJSON());
      }
    });

    this.socket.on('apply-option', function (data) {
      var controller = findByDungeonId(data.dungeonId);
      var game = controller ? controller.game : undefined;
      if (game && game.started) {
        var dungeon = find(game.dungeons, data.dungeonId);
        var opponent = find(game.dungeons, data.opponentId);
        if (opponent.id !== dungeon.id) opponent.deduceMoney(data.x, data.y, data.option.trim(), dungeon);
        dungeon.applyOption(data.x, data.y, data.option.trim(), opponent);
        broadcast(game, 'update', game.toJSON());
      }
    });

    this.socket.on('ready', function (dungeonId) {
      var controller = findByDungeonId(dungeonId);
      var game = controller ? controller.game : undefined;
      if (game && !game.started) {
        var dungeon = find(game.dungeons, dungeonId);
        dungeon.player.ready = !dungeon.player.ready;
        controller.start();
        broadcast(game, 'update', game.toJSON());
      }
    });

  },
  applyOption: function (x, y, optionName, bully) {
    switch (optionName) {
      case 'wall':
        {
          if (this.area[x][y].state === 'square' &&
            bully.money >= this.config.wallCost &&
            this.id !== bully.id) {
            this.area[x][y].state += ' wall';
          }
          break;
        }
        case 'trap': {
          if (this.area[x][y].state === 'square'
            && bully.money >= this.config.trapCost 
            && this.id !== bully.id) {
            this.player.trapped = true;
            this.area[x][y].state += ' trap';
          }
          break;
        }
    }
  },
  deduceMoney: function (x, y, optionName, victim) {
    var moneyToDeduce = 0;
    switch (optionName) {
      case 'wall':
        {
          if (victim.area[x][y].state === 'square') {
            if (this.money >= this.config.wallCost) moneyToDeduce += this.config.wallCost;
          }
          break;
        }
        case 'trap': {
          if (victim.area[x][y].state === 'square') {
            if (this.money >= this.config.trapCost) moneyToDeduce += this.config.trapCost;
          }
          break;
        }
    }
    this.money -= moneyToDeduce;
  },
  movePlayer: function (direction) {
    var movementValue = 0;
    var squareY = this.player.y;
    var squareX = this.player.x;
    switch (direction) {
      case 'up': {
        movementValue += (squareY - 1) >= 0 ? 1 : 0;
        if (movementValue > 0) {
          if (!this.area[squareY - movementValue][squareX].state.includes('wall')) {
            if (this.area[squareY - movementValue][squareX].state.includes('trap')) {
              this.applyTrap(direction);
              this.area[squareY - movementValue][squareX].state = 'square';
            } else {
              this.area[squareY - movementValue][squareX].state = 'square player';
              this.area[squareY][squareX].state = 'square';
              this.player.y -= movementValue;
              this.life--;
            }
          }	
        }
        break;
      }
      case 'down':{
        movementValue += (squareY + 1) < this.area.length ? 1 : 0;
        if (movementValue > 0) {
          if (!this.area[squareY + movementValue][squareX].state.includes('wall')) {
            if (this.area[squareY + movementValue][squareX].state.includes('trap')) {
              this.applyTrap(direction);
              this.area[squareY + movementValue][squareX].state = 'square';		
            } else {
              this.area[squareY + movementValue][squareX].state = 'square player';
              this.area[squareY][squareX].state = 'square';
              this.player.y += movementValue;
              this.life--;
            }
          }
        }
        break;
      }
      case 'left': {
        movementValue += (squareX - 1) >= 0 ? 1 : 0;
        if (movementValue > 0) {
          if (!this.area[squareY][squareX - movementValue].state.includes('wall')) {
            if (this.area[squareY][squareX - movementValue].state.includes('trap')) {
              this.applyTrap(direction);
              this.area[squareY][squareX - movementValue].state = 'square';
            } else {
              this.area[squareY][squareX - movementValue].state = 'square player';
              this.area[squareY][squareX].state = 'square';
              this.player.x -= movementValue;
              this.life--;
            }
          }
        }
        break;
      }
      case 'right': {
        movementValue += (squareX + 1) < this.area[0].length ? 1 : 0;
        if (movementValue > 0) {
          if (!this.area[squareY][squareX + movementValue].state.includes('wall')) {
            if (this.area[squareY][squareX + movementValue].state.includes('trap')) {
              this.applyTrap(direction);
              this.area[squareY][squareX + movementValue].state = 'square';
            } else {
              this.area[squareY][squareX + movementValue].state = 'square player';
              this.area[squareY][squareX].state = 'square';
              this.player.x += movementValue;
              this.life--;
            }
          }
        }
        break;
      }
    }
  },
  applyTrap: function(direction) {
    if (this.player.trapped) {
      for(var i = 0; i <= this.config.trapFeedback; i++) {
        var movementValue = 0;
        var squareY = this.player.y;
        var squareX = this.player.x;
        switch(direction) {
          case 'up': {
            movementValue += (squareY + 1) < this.area.length ? 1 : 0;
            if (movementValue > 0) {
              if (!this.area[squareY + movementValue][squareX].state.includes('wall')) {
                this.area[squareY + movementValue][squareX].state = 'square player';
                this.area[squareY][squareX].state = 'square';
                this.player.y += movementValue;
                this.life--;
              }	
            }
            break;
          }
          case 'down': {
            movementValue += (squareY - 1) >= 0 ? 1 : 0;
            if (movementValue > 0) {
              if (!this.area[squareY - movementValue][squareX].state.includes('wall')) {
                this.area[squareY - movementValue][squareX].state = 'square player';
                this.area[squareY][squareX].state = 'square';
                this.player.y -= movementValue;
                this.life--;
              }
            }
            break;
          }
          case 'left': {
            movementValue += (squareX + 1) < this.area[0].length ? 1 : 0;
            if (movementValue > 0) {
              if (!this.area[squareY][squareX + movementValue].state.includes('wall')) {
                this.area[squareY][squareX + movementValue].state = 'square player';
                this.area[squareY][squareX].state = 'square';
                this.player.x += movementValue;
                this.life--;
              }
            }
            break;
          }
          case 'right':{
            movementValue += (squareX - 1) >= 0 ? 1 : 0;
            if (movementValue > 0) {
              if (!this.area[squareY][squareX - movementValue].state.includes('wall')) {
                this.area[squareY][squareX - movementValue].state = 'square player';
                this.area[squareY][squareX].state = 'square';
                this.player.x -= movementValue;
                this.life--;
              }
            }
            break;
          }
        }
      }
    }
  },
  toJSON: function() {
    return {
      id: this.id,
      area: this.area,
      life: this.life,
      money: this.money,
      lastUpdateTime: this.lastUpdateTime,
      player: this.player,
      config: this.config,
      modifiers: this.modifiers,
    };
  },
  createArea: function(x, y, numberOfCells) {
    this.area = [];
    x = typeof x === 'undefined' ? 800 : x;
    y = typeof y === 'undefined' ? 600 : y;
    numberOfCells = typeof numberOfCell === 'undefined' ? 30 : numberOfcell;   
    var cellSize = x / numberOfCells;
    var rows = (y - (y % cellSize)) / cellSize;

    for(var row = 0; row < rows; row++) {
      this.area.push([]);
      for(var column = 0; column < numberOfCells; column++) {
        this.area[row].push({
          style: {
            width: cellSize + 'px',
            height: cellSize + 'px',
          },
          state: squareStates[0],
        });
      }
    }
    this.player = {
      x: Math.ceil(numberOfCells / 2),
      y: 0,
      trapped: false,
      ready: false,
      lost: false,
    };
    this.area[this.player.y][this.player.x].state = squareStates['p'];
  },
  joinRoom: function (game) {
    this.socket.join(game.id);
    game.addDungeon(this);
    broadcast(game, 'update', game.toJSON());
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