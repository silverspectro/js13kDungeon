"use strict";


/* -------- Global variables -------- */

/// @TODO : is controller list necessary ?
var controllers = [],
  games = [];

/* -------- End global variables ---- */



/* -------- global functions ---- */

/**
 * Transmit event to game dungeons
 * @param {Game} game origine game
 * @param {String} eventName event name
 * @param {String} payload event content
 */
function broadcast(game, eventName, payload) {
  game.socket.broadcast.to(game.socket.id).emit(eventName, payload);
  game.socket.emit(eventName, payload); // for itself
}

/**
 * List Rooms for client and selection
 */
function listRooms(status) {
  return games.filter( function (game) {
    return game.status == status 
  }).map(function (game) {
    return game.toJSON();
  });
}

function findGameByDungeonId(id) {
  for (var i = 0; i < games.length; i++) {
    if(find(games[i].dungeons, id)) return games[i];
  }
  return undefined;
}

/* -------- End global functions -------- */


/* -------- ServerController Class -------- */

/**
 * ServerController Class
 * @param {socket} socket
 */
function ServerController(socket) {
  this.socket = socket;
  this.id = socket.id;
  this.init();
}

ServerController.prototype = {
  init: function () {
    var self = this;

    this.socket.on(GR_CREATE, function (payload) {
      
      var game = find(games, self.id);
      
      if (!game) {
        game = new Game(self.socket, payload.name || self.id, new Config(payload) /*, options*/ );
        var dungeon = new Dungeon(self.id, game.configTemplate);

        game.addDungeon(dungeon);
        games.push(game);

        self.socket.emit(GE_CREATE, game.toJSON());
      } else {
        console.warn("A game already exists for given id.")
      }
    });

    this.socket.on(GR_LIST, function () {
      self.socket.emit(GE_LIST, listRooms(GS_SETUP));
    });

    this.socket.on("disconnect", function () {

      // ensure all dungeons are removed (should not happen)
      var game = findGameByDungeonId(self.id);
      while (game) {
        game.removeDungeon(self.id);
        // if last dungeon removed, destroy game
        if (game.dungeons.length <= 0) {
          games.splice(findIndex(games, game.id), 1)
        } else {
          broadcast(game, GE_EDIT, game.toJSON());
        }

        game = findGameByDungeonId(self.id);
      }

      var controllerIndex = findIndex(controllers, self.id);
      if (controllerIndex) controllers.splice(controllerIndex, 1);

      console.log("Disconnected: " + self.socket.id);
    });

    this.socket.on(GR_JOIN, function (payload) {
      var refGame = find(games, payload.gameId);

      if (refGame && (refGame.status === GS_SETUP)) {

        self.socket.join(payload.gameId)
        var dungeon = new Dungeon(
          self.id,
          refGame.configTemplate,
          payload.dungeonName
        );

        if (refGame.addDungeon(dungeon)) {
          broadcast(refGame, GE_EDIT, refGame.toJSON());
          broadcast(self, DE_JOIN, dungeon.toJSON());
          console.log(self.id + " has joined: " + refGame.id);
        }

      } else {
        console.log("Error : can't connect to game " + payload.gameId);
      }
    });

    this.socket.on(PR_MOVE, function (direction) {
      var game = findGameByDungeonId(self.id);
      if (game && (game.status === GS_RUNNING)) {
        var dungeon = find(game.dungeons, self.id);
        if (dungeon) {
          if(dungeon.movePlayer(direction)) {
            dungeon.lastUpdateTime = 0;
            broadcast(game, GE_EDIT, game.toJSON());
          }
        }
      }
    });

    this.socket.on(PR_APPLY, function (data) {
      var game = findGameByDungeonId(self.id);

      if (game && (game.status === GS_RUNNING)) {
        var dungeon = find(game.dungeons, self.id);
        var opponent = find(game.dungeons, data.opponentId);

        if (dungeon && opponent && opponent.applyState(data.x, data.y, data.state, dungeon)) {
          dungeon.deduceMoney(data.state);
          broadcast(game, GE_EDIT, game.toJSON());
        }

      }
    });

    this.socket.on(GR_START, function (payload) {
      var game = findGameByDungeonId(self.id);

      if (game && (game.status === GS_SETUP)) {
        var dungeon = find(game.dungeons, self.id);
        dungeon.status = DS_READY;
        dungeon.name = payload.name || ( dungeon.name || self.id );
        var readyPlayers = game.startIfReady();
        broadcast(game, GE_EDIT, game.toJSON());
        if (readyPlayers < game.dungeons.length) broadcast(game, DS_READY, { dungeon: dungeon, readyPlayers: readyPlayers });
      }
    });
  },
}

/* -------- End ServerController Class -------- */



/* -------- Game Class -------- */

/**
 * Game Class
 * @param {socket} socket
 * 
 * @TODO : should this class be shared ?
 */
function Game(socket, name, configTemplate, options) {
  this.socket = socket;
  this.id = this.socket.id;
  this.name = name;
  this.dungeons = [];
  this.status = GS_SETUP;
  this.time = 0;
  /// @TODO : should be dungeon config
  this.options = options || [CS_WALL, CS_DYNAMITE, ];
  this.configTemplate = configTemplate || new Config();
}

Game.prototype = {
  removeDungeon: function (dungeonId) {
    var dungeonIndex = findIndex(this.dungeons, dungeonId);
    if (dungeonIndex >= 0) {
      broadcast(this, DE_LEAVE, this.dungeons[dungeonIndex].toJSON());
      this.dungeons.splice(dungeonIndex, 1);
    }
  },
  addDungeon: function (dungeon) {
    var self = this;
    var refDungeon = find(this.dungeons, dungeon.id);
    if (!refDungeon) {
      this.socket.join(dungeon.id); // manage rooms
      this.dungeons.push(dungeon);
      return true;
    } else {
      console.warn(dungeon.id + ' already in game ' + this.id);
      return false;
    }
  },
  startIfReady: function () {
    var playerReady = 1;
    if (this.status === GS_SETUP) {
      for (var i = 0; i < this.dungeons.length; i++) {
        if (this.dungeons[i].status !== DS_READY) return playerReady;
        playerReady++;
      }

      // all dungeons are ready => start
      this.status = GS_RUNNING;
      this.dungeons.map(function (dungeon) {
        dungeon.status = DS_PLAYING;
      });
      this.time = 0;
      this.clock = setInterval(this.checkClock.bind(this), 1000);

      broadcast(this, GR_START, this.toJSON());
    }
    return playerReady;
  },
  stop: function () {
    var self = this;
    self.status = GS_FINISHED;
    clearInterval(self.clock);
    broadcast(self, GE_FINISH, self.toJSON());
  },
  stopIfFinishedOnClock: function () {
    var self = this;
    var isUpdated = false;
    var activeDungeonCount = 0;
    var lastActiveDungeon;

    self.dungeons.forEach(function (dungeon) {

      if (dungeon.reduceLifeOnClock()) isUpdated = true;
      if (dungeon.addBonusOnClock(self.time)) isUpdated = true;
      
      if (dungeon.updateStatus() && !dungeon.hasLost) {
        isUpdated = true;
        if (dungeon.status === DS_LOST) broadcast(self, DE_LOST, dungeon.toJSON());
        dungeon.hasLost = true;
      }

      if (dungeon.status === DS_PLAYING) {
        lastActiveDungeon = dungeon;
        activeDungeonCount++;
      }
    });

    if (isUpdated) broadcast(self, GE_EDIT, self.toJSON());

    if ((activeDungeonCount <= 1)) {
      if (lastActiveDungeon) {
        lastActiveDungeon.status = DS_WON;
        broadcast(self, DE_WIN, lastActiveDungeon.toJSON());
      }
      this.stop();
    }
  },
  checkClock: function () {
    this.time++;

    if (this.time > MAX_CLOCK_TIME) {
      this.stop();
    }

    this.stopIfFinishedOnClock();
    this.startIfReady();
  },
  toJSON: function () {
    return {
      id: this.id,
      name: this.name,
      status: this.status,
      dungeons: this.dungeons.map(function (dungeon) {
        return dungeon.toJSON ? dungeon.toJSON() : dungeon;
      }),
      options: this.options,
    }
  }
}

/* -------- End Game Class -------- */


/* -------- Dungeon Class -------- */

/**
 * Dungeon Class
 * @param {id}
 * 
 * @TODO : shouldn't this class be shared ?
 */
function Dungeon(id, config, name) {
  this.id = id;
  this.status = DS_SETUP;
  this.area = new Area();
  this.life = 100;
  this.money = 100;
  this.lastUpdateTime = 0;
  this.name = name || id;
  this.player;

  this.config = new Config(config);

  this.createArea(this.config.areaColumns, this.config.areaRows);

  this.modifiers = {
    timeLimitMalus: 0,
  };
}

Dungeon.prototype = {

  // return true if state applyed, false otherwise
  applyState: function (x, y, requestedState, bullyDungeon) {
    if( (this.status != DS_PLAYING) || (bullyDungeon.status != DS_PLAYING) ) return false;

    var originalState = this.area.getCS(x, y);

    if(this.id === bullyDungeon.id) {
      if ( (requestedState & CS_MONEY) && !(originalState & CS_WALL) && !(originalState & CS_PLAYER)
        || (requestedState & CS_RHUM) && !(originalState & CS_WALL) && !(originalState & CS_PLAYER) ) {
          this.area.setCS(x, y, (originalState & CS_DYNAMITE) | requestedState);
          return true;
      } else if ( (requestedState & CS_DYNAMITE) && (originalState & CS_WALL) && (bullyDungeon.money >= this.config.dynamiteCost) ) {
        this.area.setCS(x, y, CS_DEFAULT | CS_BOUM);
        return true;
      }
    } else {
      if( (requestedState & CS_WALL) && !(originalState & (CS_WALL | CS_PLAYER)) && (bullyDungeon.money >= this.config.wallCost) ) {
        this.area.setCS(x, y, requestedState);
        return true;
      } else if ( (requestedState & CS_DYNAMITE) && !(originalState & (CS_WALL | CS_DYNAMITE | CS_PLAYER)) && (bullyDungeon.money >= this.config.dynamiteCost) ) {
        this.area.setCS(x, y, originalState | requestedState);
        return true;
      }
    }

    return false;
  },
  // This method should not be called if player doesn't have enough money
  deduceMoney: function (requestedState) {
    if (requestedState & CS_WALL) {
      this.money -= this.config.wallCost;
    } else if (requestedState & CS_DYNAMITE) {
      this.money -= this.config.dynamiteCost;
    }
  },
  movePlayer: function (direction) {

    if(this.status != DS_PLAYING) return false;

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

    var requestedPositionState = this.area.getCS(requestedX, requestedY);
    if(requestedPositionState & CS_WALL) {
      return false;
    }

    // apply basic movement, update cells
    this.area.setCS(originalX, originalY, CS_DEFAULT);
    this.area.setCS(requestedX, requestedY, CS_PLAYER);
    this.player.x = requestedX;
    this.player.y = requestedY;
    this.life--;
    this.lastUpdateTime = 0;

    // apply specific cell bonus / effect
    if( requestedPositionState & CS_RHUM ) {
      this.life += this.config.rhumBonusValue;
    }

    if( requestedPositionState & CS_MONEY ) {
      this.money += this.config.moneyBonusValue;
    }

    if( requestedPositionState & CS_DYNAMITE ) {
      this.applyTrap(originalX, originalY, direction);
    }

    return true;
  },
  applyTrap: function (x, y, direction) {

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

    this.area.setCS(x, y, CS_BOUM);
  },
  createArea: function (columns, rows) {
    this.area.reset(columns, rows);

    // set player position, -1 is esthetic choice for placement if no middle cell
    /// @TODO should it be done here ? I think we should manage player attribute independently
    var playerXPos = Math.floor( (columns-1) / 2);
    var playerYPos = Math.floor( (rows-1) / 2);

    this.player = {
      x: playerXPos,
      y: playerYPos,
    };

    this.area.setCS(playerXPos, playerYPos, CS_PLAYER);
  },
  applyModifier: function (key) {
    return this.config[key] + this.modifiers[key];
  },

  // time controlled functions
  reduceLifeOnClock: function () {
    var lut = this.lastUpdateTime++;
    var tl = this.config.timeLimit;

    // console.log(this.id, this.lastUpdateTime, this.config.timeLimit, this.modifiers);

    var isUpdated = false;

    if ((lut >= tl) && (lut % tl === 0)) {
      this.life -= this.applyModifier('timeLimitMalus');
      this.modifiers.timeLimitMalus++;
      isUpdated = true;
    }

    // reset modifier if last update is recent enough
    if (lut < tl) {
      this.modifiers.timeLimitMalus = 0;
    }

    if (this.life <= 0) {
      this.status = DS_LOST;
      isUpdated = true;
    }

    return isUpdated;
  },
  addBonusOnClock: function (time) {
    var isUpdated = false;

    if (time % parseInt(this.config.bonusInterval, 10) == 0) {
      isUpdated = true;
      var randState = bonusMapState[Math.ceil(Math.random() * bonusMapState.length - 1)];
      var randX = Math.floor(Math.random() * parseInt(this.area.columns, 10));
      var randY = Math.floor(Math.random() * parseInt(this.area.rows, 10));
      this.applyState(randX, randY, randState, this);
    };

    return isUpdated;
  },
  updateStatus: function () {
    if(this.life <= 0) {
      this.status = DS_LOST;
      return true;
    }
    return false;
  },

  toJSON: function () {
    return {
      id: this.id,
      name: this.name,
      area: this.area.toJSON(),
      life: this.life,
      money: this.money,
      status: this.status,
      config: this.config.toJSON(),
    };
  }
};

/* -------- End Dungeon Class -------- */


/* -------- Area Class -------- */

/**
 * Area Class
 * 
 * @param {Int} columns
 * @param {Int} rows
 * 
 * @notice Please be carefull with indexes x et y are inversed according common sens in states storage object
 */
function Area(columns, rows) {
  this.reset(columns, rows);
}

Area.prototype = {
  reset: function (columns, rows) {
    this.columns = columns || 0;
    this.rows = rows || 0;
    this.states = [];
    for(var row = 0; row < this.rows; row++) {
      this.states.push([]);
      for(var column = 0; column < this.columns; column++) {
        this.states[row].push({state: CS_DEFAULT});
      }
    }
  },
  getCS: function (x, y) {
    return this.states[y][x].state;
  },
  setCS: function (x, y, state) {
    this.states[y][x].state = state;
  },
  toJSON: function() {
    return {
      columns: this.columns,
      rows: this.rows,
      states: this.states,
    }
  }
}

/* -------- End Area Class -------- */



/* -------- Config Class -------- */

/**
 * Config Class
 * @param {Config} Config
 */
function Config(config) {
  this.fromJSON(config);
}

Config.prototype = {
  // override if given; initialize with default value if not given and not defined 
  fromJSON: function (config) {
    config = config || {};
    this.dynamiteFeedback = config.dynamiteFeedback || (this.dynamiteFeedback || 3);
    this.dynamiteCost = config.dynamiteCost || (this.dynamiteCost || 15);
    this.wallCost = config.wallCost || (this.wallCost || 5);
    this.timeLimit = config.timeLimit || (this.timeLimit || 5);
    this.timeLimitMalus = config.timeLimitMalus || (this.timeLimitMalus || 1);
    this.bonusInterval = config.bonusInterval || (this.bonusInterval || 5);
    this.rhumBonusValue = config.rhumBonusValue || (this.rhumBonusValue || 10);
    this.moneyBonusValue = config.moneyBonusValue || (this.moneyBonusValue || 15);
    this.areaColumns = config.areaColumns || (this.areaColumns || 11);
    this.areaRows = config.areaRows || (this.areaRows || 15);
  },
  toJSON: function () {
    return {
      dynamiteFeedback: this.dynamiteFeedback,
      dynamiteCost: this.dynamiteCost,
      wallCost: this.wallCost,
      timeLimit: this.timeLimit,
      timeLimitMalus: this.timeLimitMalus,
      bonusInterval: this.bonusInterval,
      rhumBonusValue: this.rhumBonusValue,
      moneyBonusValue: this.moneyBonusValue,
      areaColumns: this.areaColumns,
      areaRows: this.areaRows,
    }
  }
}

/* -------- End Config Class -------- */



/**
 * Socket.IO on connect event
 * @param {Socket} socket
 */
module.exports = function (socket) {
  var controller = new ServerController(socket);
  controllers.push(controller);
  console.log("Connected: " + socket.id);
};