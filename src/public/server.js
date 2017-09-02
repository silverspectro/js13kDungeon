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
  start: function () {
    if (this.game.checkReady()) {
      this.clock = setInterval(this.checkClock.bind(this), 1000);
      return true;
    }
    return false;
  },
  destroy: function () {
    clearInterval(this.clock);
  },
  checkClock: function () {
    // check if a timer exceed the max time
    // just in case to not overload the server in case
    // a 'disconnect' event get lost
    if (this.game.time > MAX_CLOCK_TIME) {
      clearInterval(this.clock);
      broadcast(this.game, 'game-lost', {
        message: "Lost - OUT OF TIME",
      });
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
  this.area = new Area();
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
      if(game) {
        self.createArea(payload.areaColumns, payload.areaRows);
        game.addDungeon(self);
        self.socket.emit('game-created', game.toJSON());
      }
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
      var syncId = payload.gameId;
      var controller = find(controllers, syncId);
      var refGame = controller ? controller.game : undefined;

      if (refGame && !refGame.started) {
        var refDungeon = find(refGame.dungeons, syncId);
        if(refDungeon) {
          self.createArea(refDungeon.area.columns, refDungeon.area.rows);
          self.joinRoom(refGame);
        } else {
          console.log("Error : can't connect to game " + syncId);
        }
      }
      
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

        if(dungeon.applyState(data.x, data.y, data.state, opponent)) {
          opponent.deduceMoney(data.state);
          broadcast(game, 'update', game.toJSON());
        }
        
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
  // return true if state applyed, false otherwise
  applyState: function (x, y, requestedState, bullyDungeon) {

    if(this.id === bullyDungeon.id) return false;

    var originalState = this.area.getState(x, y);
    
    if( (requestedState & STATE_WALL) && (originalState & STATE_DEFAULT) && (bullyDungeon.money >= this.config.wallCost) ) {
      this.area.setState(x, y, originalState | requestedState);
      return true;
    } else if ( (requestedState & STATE_TRAP) && (originalState & STATE_DEFAULT) && (bullyDungeon.money >= this.config.trapCost) ) {
      this.area.setState(x, y, originalState | requestedState);
      return true;
    }
    
    return false;
  },
  // This method should not be called if player doesn't have enough money
  deduceMoney: function (requestedState) {
    /// @TODO make a global cell state object to centralize label, cost, etc.
    if (requestedState & STATE_WALL) {
      this.money -= this.config.wallCost;
    } else if (requestedState & STATE_TRAP) {
      this.money -= this.config.trapCost;
    }
  },
  movePlayer: function (direction) {

    var originalY = this.player.y;
    var originalX = this.player.x;
    
    var requestedY = originalY;
    var requestedX = originalX;

    switch (direction) {
      case MOVE_UP:
        requestedY--;
        break;
        
      case MOVE_DOWN:
        requestedY++;
        break;
      
      case MOVE_LEFT:
        requestedX--;
        break;

      case MOVE_RIGHT:
        requestedX++;
        break;

      default :
        console.log("Error can't move " + direction);
    }
    
    // check forbidden movement
    if( 
      (requestedX < 0) ||
      (requestedY < 0) ||
      (requestedX >= this.area.columns) ||
      (requestedY >= this.area.rows)
    ) {
      return;
    }

    var requestedPositionState = this.area.getState(requestedX, requestedY);
    if(requestedPositionState & STATE_WALL) {
      return;
    }

    // apply basic movement, update cells
    this.area.setState(originalX, originalY, STATE_DEFAULT);
    this.area.setState(requestedX, requestedY, STATE_PLAYER);
    this.player.x = requestedX;
    this.player.y = requestedY;
    this.life--;

    // apply requested cell
    if( requestedPositionState & STATE_TRAP ) {
      this.applyTrap(direction)
    }

  },
  applyTrap: function (direction) {

    var oppositeDirection
    switch (direction) {
      case MOVE_UP:
        oppositeDirection = MOVE_DOWN;
        break;
        
      case MOVE_DOWN:
        oppositeDirection = MOVE_UP;
        break;
      
      case MOVE_LEFT:
        oppositeDirection = MOVE_RIGHT;
        break;

      case MOVE_RIGHT:
        oppositeDirection = MOVE_LEFT;
        break;

      default :
        console.log("Error can't move " + direction);
    }

    for (var i = 0; i <= this.config.trapFeedback; i++) {
      this.movePlayer(oppositeDirection);
    }
  },
  toJSON: function () {
    return {
      id: this.id,
      area: this.area.toJSON(),
      life: this.life,
      money: this.money,
      lastUpdateTime: this.lastUpdateTime,
      player: this.player,
      config: this.config,
      modifiers: this.modifiers,
    };
  },
  createArea: function (columns, rows) {
    this.area.reset(columns, rows);
    
    // set player position
    var playerXPos = Math.floor( (columns-1) / 2);
    var playerYPos = Math.floor( (rows-1) / 2);

    this.player = {
      x: playerXPos,
      y: playerYPos,
      ready: false,
      lost: false,
    };

    this.area.setState(playerXPos, playerYPos, STATE_PLAYER);
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