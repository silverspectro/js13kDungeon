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
    this.game.time++;
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
    this.addBonus(this.game.time);
    broadcast(this.game, 'update', this.game.toJSON());
  },
  addBonus: function (time) {
    var self = this;
    this.game.dungeons.forEach(function (dungeon) {
      var randState = bonusMapState[Math.ceil(Math.random() * bonusMapState.length - 1)];
      var randX = Math.floor(Math.random() * parseInt(self.game.dungeons[0].area.columns, 10));
      var randY = Math.floor(Math.random() * parseInt(self.game.dungeons[0].area.rows, 10));
      if (time % parseInt(dungeon.config.bonusInterval, 10) === 0) {
        dungeon.applyState(randX, randY, randState, dungeon);
      };
    });
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
        setTimeout(function () {
          broadcast(self.game, 'game-lost', {
            dungeonId: dungeon.id,
            message: "Lost - OUT OF TIME",
          });
        }, 300);
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
  for (var i = 0; i < controllers.length; i++) {
    if (controllers[i].game.dungeons.length === 0) {
      remove(controllers, i);
    } 
  }
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

/**
 * Dungeon Class
 * @param {id}
 */
function Dungeon(socket, config) {

  this.socket = socket;
  this.id = socket.id;
  this.area = new Area();
  this.life = 100;
  this.money = 100;
  this.lastUpdateTime = 0;

  config = config || {};
  this.config = {
    name: config.name || socket.id,
    dynamiteFeedback: config.dynamiteFeedback || 3,
    dynamiteCost: config.dynamiteCost || 15,
    wallCost: config.wallCost || 5,
    timeLimit: config.timeLimit || 10,
    timeLimitMalus: config.timeLimitMalus || 1,
    bonusInterval: config.bonusInterval || 5,
    rhumBonusValue: config.rhumBonusValue || 10,
    moneyBonusValue: config.moneyBonusValue || 15,
  };

  this.modifiers = {
    timeLimitMalus: 0,
  };

  this.init();
}

Dungeon.prototype = {
  init: function () {
    var self = this;

    this.socket.on('new-g', function (payload) {
      var controller = findByDungeonId(self.id);

      if(!controller) {
        
        // @TODO : add some type check from client input.
        self.config.name = payload.name || self.id;
        var columns = payload.areaColumns || 11;
        var rows = payload.areaRows || 15;

        self.createArea(columns, rows);
        controller = new ServerController(self.socket);
        controller.game.addDungeon(self);

        controllers.push(controller);
        self.socket.emit('game-created', controller.game.toJSON());
      } // else, player is already in a game.
    });

    this.socket.on('refresh-gl', function () {
      self.socket.emit("game-l", listRooms());
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

    this.socket.on('join-g', function (payload) {
      var syncId = payload.gameId;
      var controller = find(controllers, syncId);
      var refGame = controller ? controller.game : undefined;

      if (refGame && !refGame.started) {
        var refDungeon = find(refGame.dungeons, syncId);
        if(refDungeon) {
          self.config.name = payload.dungeonName || syncId;
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
    var originalState = this.area.getState(x, y);

    if(this.id === bullyDungeon.id) {
      if ( (requestedState & STATE_MONEY) && !(originalState & STATE_WALL)
        || (requestedState & STATE_RHUM) && !(originalState & STATE_WALL) ) {
        this.area.setState(x, y, (originalState & STATE_DYNAMITE) | requestedState);
        return true;
      } else if ( (requestedState & STATE_DYNAMITE) && (originalState & STATE_WALL) ) {
        this.area.setState(x, y, originalState & STATE_DEFAULT);
        return true;
      }
    } else {
      if( (requestedState & STATE_WALL) && !(originalState & (STATE_WALL | STATE_PLAYER)) && (bullyDungeon.money >= this.config.wallCost) ) {
        this.area.setState(x, y, requestedState);
        return true;
      } else if ( (requestedState & STATE_DYNAMITE) && !(originalState & (STATE_WALL | STATE_DYNAMITE | STATE_PLAYER)) && (bullyDungeon.money >= this.config.dynamiteCost) ) {
        this.area.setState(x, y, originalState | requestedState);
        return true;
      }
    }
    
    return false;
  },
  // This method should not be called if player doesn't have enough money
  deduceMoney: function (requestedState) {
    /// @TODO make a global cell state object to centralize label, cost, etc.
    if (requestedState & STATE_WALL) {
      this.money -= this.config.wallCost;
    } else if (requestedState & STATE_DYNAMITE) {
      this.money -= this.config.dynamiteCost;
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
    
    // we check / transform requested position to allow crossing limits
    requestedX = requestedX % this.area.columns + 1 ? requestedX % this.area.columns : this.area.columns - 1;
    requestedY = requestedY % this.area.rows + 1 ? requestedY % this.area.rows : this.area.rows - 1;

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

    if( requestedPositionState & STATE_RHUM ) {
      this.life += this.config.rhumBonusValue;
    }

    if( requestedPositionState & STATE_MONEY ) {
      this.money += this.config.moneyBonusValue;
    }


    // apply requested cell
    if( requestedPositionState & STATE_DYNAMITE ) {
      this.applyTrap(direction);
    }

  },
  applyTrap: function (direction) {

    var oppositeDirection;
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

    for (var i = 0; i <= this.config.dynamiteFeedback; i++) {
      this.movePlayer(oppositeDirection);
    }
  },
  createArea: function (columns, rows) {
    this.area.reset(columns, rows);
    
    // set player position, -1 is esthetic choice for placement if no middle cell 
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
  }
};

/* -------- End Dungeon Class -------- */

/**
 * Socket.IO on connect event
 * @param {Socket} socket
 */
module.exports = function (socket) {
  new Dungeon(socket);
  console.log("Connected: " + socket.id);
};