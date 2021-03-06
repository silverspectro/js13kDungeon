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
    for (var x = 0; x < games[i].dungeons.length; x++) {
      if (games[i].dungeons[x].id === id) return games[i];
    }
  }
  return undefined;
}

function findGameById(id) {
  return find(games, id);
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

    this.socket.on(GECD, function (payload) {
      var game = findGameById(self.id);

      if (!game) {
        game = new Game(self.socket, payload.name || self.id, new Config(payload) /*, options*/ );
        var dungeon = new Dungeon(self.id, game.configTemplate);

        game.addDungeon(dungeon);
        games.push(game);

        self.socket.emit(GECDD, game.toJSON());
      } else {
        console.warn("A game already exists for given id.")
      }
    });

    this.socket.on(GELD, function () {
      self.socket.emit(GELDED, listRooms(G_STATUS_SETUP));
    });

    this.socket.on("disconnect", function () {

      // ensure all dungeons are removed (should not happen)
      var game = findGameByDungeonId(self.id);
      while (game) {
        game.removeDungeon(self.id);
        // if last dungeon removed, destroy game
        if (game.dungeons.length <= 0) {
          games.splice(findIndex(games, game.id), 1)
        }

        broadcast(game, GEEDT, game.toJSON());

        game = findGameByDungeonId(self.id);
      }

      var controllerIndex = findIndex(controllers, self.id);
      if (controllerIndex) controllers.splice(controllerIndex, 1);

      console.log("Disconnected: " + self.socket.id);
    });

    this.socket.on(GEJN, function (payload) {
      var refGame = findGameById(payload.gameId);

      if (refGame && (refGame.status === G_STATUS_SETUP)) {

        self.socket.join(payload.gameId)
        var dungeon = new Dungeon(
          self.id,
          refGame.configTemplate,
          payload.dungeonName
        );

        if (refGame.addDungeon(dungeon)) {
          broadcast(refGame, GEEDT, refGame.toJSON());
          console.log(self.id + " has joined: " + refGame.id);
        }

      } else {
        console.log("Error : can't connect to game " + payload.gameId);
      }
    });

    this.socket.on(PEMV, function (direction) {
      var game = findGameByDungeonId(self.id);
      if (game && (game.status === G_STATUS_RUNNING)) {
        var dungeon = find(game.dungeons, self.id);
        if (dungeon) {
          if(dungeon.movePlayer(direction)) {
            dungeon.lastUpdateTime = 0;
            broadcast(game, PEEU, game.toJSON());
          }
        }
      }
    });

    this.socket.on(PEAP, function (data) {
      var game = findGameByDungeonId(self.id);

      if (game && (game.status === G_STATUS_RUNNING)) {
        var dungeon = find(game.dungeons, self.id);
        var opponent = find(game.dungeons, data.opponentId);

        if (dungeon && opponent && opponent.applyState(data.x, data.y, data.state, dungeon)) {
          dungeon.deduceMoney(data.state);
          broadcast(game, PEEU, game.toJSON());
        }

      }
    });

    this.socket.on(GESTD, function (payload) {
      var game = findGameByDungeonId(self.id);

      if (game && (game.status === G_STATUS_SETUP)) {
        var dungeon = find(game.dungeons, self.id);
        dungeon.status = D_STATUS_READY;
        dungeon.name = payload.name || ( dungeon.name || self.id );
        var readyPlayers = game.startIfReady();
        broadcast(game, GEEDT, game.toJSON());
        if (readyPlayers < game.dungeons.length) broadcast(game, D_STATUS_READY, { dungeon: dungeon, readyPlayers: readyPlayers });
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
  this.status = G_STATUS_SETUP;
  this.time = 0;
  /// @TODO : should be dungeon config
  this.options = options || [SWL, STDY, ];
  this.configTemplate = configTemplate || new Config();
}

Game.prototype = {
  removeDungeon: function (dungeonId) {
    var dungeonIndex = findIndex(this.dungeons, dungeonId);
    if (dungeonIndex >= 0) {
      broadcast(this, GELV, this.dungeons[dungeonIndex].toJSON());
      this.dungeons.splice(dungeonIndex, 1);
    }
  },
  addDungeon: function (dungeon) {
    var self = this;
    var refDungeon = find(this.dungeons, dungeon.id);
    if (!refDungeon) {
      this.socket.join(dungeon.id); // manage rooms
      this.dungeons.push(dungeon);
      setTimeout(function() {
        broadcast(self, GEJN, dungeon.toJSON());
      }, 1000);
      return true;
    } else {
      console.warn(dungeon.id + ' already in game ' + this.id);
      return false;
    }
  },
  startIfReady: function () {
    var playerReady = 1;
    if (this.status === G_STATUS_SETUP) {
      for (var i = 0; i < this.dungeons.length; i++) {
        if (this.dungeons[i].status !== D_STATUS_READY) return playerReady;
        playerReady++;
      }

      // all dungeons are ready => start
      this.status = G_STATUS_RUNNING;
      this.dungeons.map(function (dungeon) {
        dungeon.status = D_STATUS_PLAYING;
      });
      this.time = 0;
      this.clock = setInterval(this.checkClock.bind(this), 1000);

      broadcast(this, GESTDED, this.toJSON());
      broadcast(this, PEEU, this.toJSON());
    }
    return playerReady;
  },
  stop: function () {
    var self = this;
    self.status = G_STATUS_FINISHED;
    clearInterval(self.clock);
    broadcast(self, GEFD, self.toJSON());
    setTimeout(function () {
      self.socket.disconnect(false)
    }, 60000); // force disconnect after 1 minute
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
        if (dungeon.status === D_STATUS_LOST) broadcast(self, PELS, self.toJSON());
        dungeon.hasLost = true;
      }

      if (dungeon.status === D_STATUS_PLAYING) {
        lastActiveDungeon = dungeon;
        activeDungeonCount++;
      }
    });

    if (isUpdated) broadcast(self, PEEU, self.toJSON());

    if ((activeDungeonCount <= 1)) {
      if (lastActiveDungeon) {
        lastActiveDungeon.status = DSW;
        broadcast(self, DSW, self.toJSON());
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
  this.status = D_STATUS_SETUP;
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
    if( (this.status != D_STATUS_PLAYING) || (bullyDungeon.status != D_STATUS_PLAYING) ) return false;

    var originalState = this.area.getState(x, y);

    if(this.id === bullyDungeon.id) {
      if ( (requestedState & STMO) && !(originalState & SWL) && !(originalState & SPL)
        || (requestedState & STRH) && !(originalState & SWL) && !(originalState & SPL) ) {
          this.area.setState(x, y, (originalState & STDY) | requestedState);
          return true;
      } else if ( (requestedState & STDY) && (originalState & SWL) && (bullyDungeon.money >= this.config.dynamiteCost) ) {
        this.area.setState(x, y, STD | STBM);
        return true;
      }
    } else {
      if( (requestedState & SWL) && !(originalState & (SWL | SPL)) && (bullyDungeon.money >= this.config.wallCost) ) {
        this.area.setState(x, y, requestedState);
        return true;
      } else if ( (requestedState & STDY) && !(originalState & (SWL | STDY | SPL)) && (bullyDungeon.money >= this.config.dynamiteCost) ) {
        this.area.setState(x, y, originalState | requestedState);
        return true;
      }
    }

    return false;
  },
  // This method should not be called if player doesn't have enough money
  deduceMoney: function (requestedState) {
    if (requestedState & SWL) {
      this.money -= this.config.wallCost;
    } else if (requestedState & STDY) {
      this.money -= this.config.dynamiteCost;
    }
  },
  movePlayer: function (direction) {

    if(this.status != D_STATUS_PLAYING) return false;

    var originalY = this.player.y;
    var originalX = this.player.x;

    var requestedY = originalY;
    var requestedX = originalX;

    switch (direction) {
      case MUP:
        requestedY--;
        break;

      case MDW:
        requestedY++;
        break;

      case MLT:
        requestedX--;
        break;

      case MRH:
        requestedX++;
        break;

      default :
        console.log("Error can't move " + direction);
    }

    // we check / transform requested position to allow crossing limits
    requestedX = requestedX % this.area.columns + 1 ? requestedX % this.area.columns : this.area.columns - 1;
    requestedY = requestedY % this.area.rows + 1 ? requestedY % this.area.rows : this.area.rows - 1;

    var requestedPositionState = this.area.getState(requestedX, requestedY);
    if(requestedPositionState & SWL) {
      return false;
    }

    // apply basic movement, update cells
    this.area.setState(originalX, originalY, STD);
    this.area.setState(requestedX, requestedY, SPL);
    this.player.x = requestedX;
    this.player.y = requestedY;
    this.life--;
    this.lastUpdateTime = 0;

    // apply specific cell bonus / effect
    if( requestedPositionState & STRH ) {
      this.life += this.config.rhumBonusValue;
    }

    if( requestedPositionState & STMO ) {
      this.money += this.config.moneyBonusValue;
    }

    if( requestedPositionState & STDY ) {
      this.applyTrap(originalX, originalY, direction);
    }

    return true;
  },
  applyTrap: function (x, y, direction) {

    var oppositeDirection;
    switch (direction) {
      case MUP:
        oppositeDirection = MDW;
        break;

      case MDW:
        oppositeDirection = MUP;
        break;

      case MLT:
        oppositeDirection = MRH;
        break;

      case MRH:
        oppositeDirection = MLT;
        break;

      default :
        console.log("Error can't move " + direction);
    }

    for (var i = 0; i <= this.config.dynamiteFeedback; i++) {
      this.movePlayer(oppositeDirection);
    }

    this.area.setState(x, y, STBM);
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

    this.area.setState(playerXPos, playerYPos, SPL);
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
      this.status = D_STATUS_LOST;
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
      this.status = D_STATUS_LOST;
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
      lastUpdateTime: this.lastUpdateTime,
      player: this.player,
      status: this.status,
      config: this.config.toJSON(),
      modifiers: this.modifiers,
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
        this.states[row].push({state: STD});
      }
    }
  },
  getState: function (x, y) {
    return this.states[y][x].state;
  },
  setState: function (x, y, state) {
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