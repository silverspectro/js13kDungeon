"use strict";

/* -------- Game Class -------- */
var MAX_CLOCK_TIME = 60 * 30;
/**
 * Game Class
 * @param {socket} socket
 */
function Game(socket, isServer, options) {
  this.isServer = !!isServer;
  this.room = socket;
  this.id = this.room.id;
  this.dungeons = [];
  this.dungeonsUI = [];
  this.clock = false;
  this.started = false;
  this.time = 0;
  this.options = options || [
    'Wall',
    'Trap',
  ];
}

Game.prototype = {
  destroy: function () {
    if (this.isServer) {
      clearInterval(this.clock);
      this.started = false;
    }
  },
  start: function () {
    if (this.isServer && !this.started) {
      this.started = new Date().now;
      this.broadcast('start');
      this.clock = setInterval(this.checkClock.bind(this), 1000);
    }
  },
  checkClock: function () {
    var self = this;
    this.time++;

    // check if a timer exceed the max time
    // just in case to not overload the server in case
    // a 'disconnect' event get lost
    if (this.time > MAX_CLOCK_TIME) {
      clearInterval(this.clock);
      this.broadcast('game-lost', {
        message: "Lost - OUT OF TIME",
      });

    }

    this.reduceLifeOnClock(this.time);
    // @TODO
    // Check clock time to reduce life
    // client can't unready the party
    this.broadcast('update', self.toJSON());
  },
  reduceLifeOnClock: function (time) {
    var self = this;
    this.dungeons.forEach(function (dungeon) {
      dungeon.lastUpdateTime++;
      if (dungeon.lastUpdateTime >= dungeon.config.timeLimit && (dungeon.lastUpdateTime % dungeon.config.timeLimit === 0)) {
        dungeon.life -= self.applyModifiers('timeLimitMalus', dungeon);
        dungeon.modifiers.timeLimitMalus++;
      }
      if (dungeon.lastUpdateTime < dungeon.config.timeLimit) {
        dungeon.modifiers.timeLimitMalus = 0;
      }
      if (dungeon.life <= 0 && !dungeon.player.lost && self.isServer) {
        self.room.to(dungeon.id).emit('game-lost', {
          message: "Lost - OUT OF TIME",
        });
        dungeon.play.lost = true;
      }
    });
  },
  applyModifiers: function (key, dungeon) {
    return dungeon.config[key] + dungeon.modifiers[key];
  },
  removeDungeon: function (dungeonId) {
    var dungeon = find(this.dungeons, dungeonId);
    if (dungeon) var index = this.dungeons.indexOf(dungeon);
    if (index >= 0) {
      this.dungeons.splice(index, 1);
    }
  },
  addDungeon: function (dungeon) {
    var refDungeon = find(this.dungeons, dungeon.id);
    if (!refDungeon) this.dungeons.push(dungeon);
    else {
      console.warn(dungeon.id + 'already exist in thsi game');
    }
  },
  checkReady: function () {
    if (!this.started && this.isServer) {
      var isReady = false;
      for (var i = 0; i < this.dungeons.length; i++) {
        isReady = this.dungeons[i].player.ready;
        if (isReady === false) break;
      }
      if (isReady) this.start();
    }
  },
  updateGame: function (game) {
    this.options = game.options;
    this.updateDungeons(game.dungeons);
    this.checkReady();
  },
  updateDungeons: function (dungeons) {
    var self = this;
    var index = Math.max(Math.max(self.dungeons.length - 1, dungeons.length - 1), 0);
    var dungeonsToAdd = [];

    function treatDungeons() {
      var dungeon = dungeons[index];
      var refIndex = dungeon ? findIndex(self.dungeons, dungeon.id) : undefined;
      var refDungeon = refIndex >= 0 ? self.dungeons[refIndex] : undefined;
      // console.log(dungeon, refIndex, refDungeon);
      if (refDungeon && dungeon && refDungeon.id === dungeon.id) {
        refDungeon.area = dungeon.area;
        refDungeon.life = dungeon.life;
        refDungeon.money = dungeon.money;
        refDungeon.player = dungeon.player;
      } else if (!refDungeon && dungeon) {
        self.dungeons.push(dungeon);
        if (!self.isServer) self.addDungeonUI(dungeon);
      } else if (self.dungeons[index] && !dungeon && !find(dungeons, self.dungeons[index].id)) {
        var deletedDungeon = self.dungeons.splice(index, 1)[0];
        self.dungeonsUI.splice(index, 1);
        if (!self.isServer) self.deleteDungeonUI(deletedDungeon.id);
      }
      index--;

      if (index < 0) {
        return;
      } else {
        treatDungeons();
      }
    }
    treatDungeons();
    if (!self.isServer) self.updateUI();
  },
  deleteDungeonUI: function (dungeonId) {
    var dungeonUI = document.getElementById(dungeonId);
    document.getElementsByTagName('main')[0].removeChild(dungeonUI);
  },
  applyOptionEvent: function (event) {
    var selectedSquare = event.target;
    var dungeonId = selectedSquare.getAttribute('data-dungeon-id');
    var x = parseInt(selectedSquare.getAttribute('data-area-x'), 10);
    var y = parseInt(selectedSquare.getAttribute('data-area-y'), 10);
    var dungeon = find(this.dungeons, dungeonId);
    this.broadcast('apply-option', {
      dungeonId: dungeonId,
      opponentId: this.id,
      option: ' ' + this.selectedOption.toLowerCase(),
      x: x,
      y: y,
    });
  },
  addDungeonUI: function (dungeon) {
    var self = this;
    var uiDungeon = {
      id: dungeon.id,
      area: [],
    };

    // initialize the UI elements

    var areaContainer = createUIElement('div', {
      class: 'area-container',
      id: dungeon.id,
    });
    var dungeonName = createUIElement('h1', {
      class: 'dungeon-name',
    });
    var area = createUIElement('div', {
      class: 'area',
    });
    var lifeContainer = createUIElement('div', {
      class: 'life-container',
    });
    var lifeBar = createUIElement('div', {
      class: 'life-bar',
    });
    var lifeCount = createUIElement('p', {
      class: 'life-count',
    });
    var moneyCount = createUIElement('p', {
      class: 'money-count',
    });
    var readyButton = createUIElement('div', {
      class: 'ready',
      'data-dungeon-id': dungeon.id,
    }, {
      click: function (event) {
        var dungeonId = event.target.getAttribute('data-dungeon-id');
        if (dungeonId === self.id) self.broadcast('ready', dungeonId);
      },
    });

    // Create the area DOM squares
    // and associate it to the new uiDungeon
    // for update loop and performance

    dungeon.area.forEach(function (row, rowIndex) {
      var areaRow = [];
      row.forEach(function (squareState, columnIndex) {
        var square = createUIElement('div', {
          class: squareState,
          'data-area-x': rowIndex,
          'data-area-y': columnIndex,
          'data-dungeon-id': dungeon.id,
        }, {
          click: self.applyOptionEvent.bind(self),
        });
        area.appendChild(square);
        areaRow.push(square);
      });
      uiDungeon.area.push(areaRow);
    });

    // append the elements to the DOM
    lifeContainer.appendChild(lifeBar);
    lifeContainer.appendChild(lifeCount);
    lifeContainer.appendChild(moneyCount);

    areaContainer.appendChild(dungeonName);
    areaContainer.appendChild(lifeContainer);
    areaContainer.appendChild(readyButton);
    areaContainer.appendChild(area);

    document.getElementsByTagName('main')[0].appendChild(areaContainer);

    // map the element to the uiDungeon
    uiDungeon.lifeBar = lifeBar;
    uiDungeon.lifeCount = lifeCount;
    uiDungeon.moneyCount = moneyCount;
    uiDungeon.readyButton = readyButton;
    this.dungeonsUI.push(uiDungeon);
  },
  updateUI: function (game) {
    var self = this;
    this.dungeons.forEach(function (dungeon, index) {
      const dungeonUI = find(self.dungeonsUI, dungeon.id);
      // update lifeBar height
      applyStyleOn(self.dungeonsUI[index].lifeBar, {
        height: dungeon.life + '%',
      });

      // update life count
      dungeonUI.lifeCount.innerHTML = dungeon.life;

      // update money count
      dungeonUI.moneyCount.innerHTML = dungeon.money;

      // ready button
      var otherUi = find(self.dungeonsUI, dungeon.id);
      if (dungeon.player.ready) {
        otherUi.readyButton.classList.add('btn-ready');
      } else {
        otherUi.readyButton.classList.remove('btn-ready');
      }

      // update area state
      dungeon.area.forEach(function (row, rowIndex) {
        row.forEach(function (column, columnIndex) {
          applyAttributesOn(dungeonUI.area[rowIndex][columnIndex], {
            class: column.state,
          });
          applyStyleOn(dungeonUI.area[rowIndex][columnIndex], column.style);
        });
      });
    });
  },
  broadcast: function (eventName, data) {
    if (this.isServer) this.room.broadcast.to(this.room.id).emit(eventName, data);
    this.room.emit(eventName, data);
  },
  toJSON: function () {
    return {
      id: this.id,
      time: this.time,
      started: this.started,
      dungeons: this.dungeons.map(function (dungeon) {
        return dungeon.toJSON ? dungeon.toJSON() : dungeon;
      }),
      options: this.options,
    }
  }
}

/* -------- End Game Class -------- */


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
  return games.map(function (game) {
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
function Dungeon(socket, config) {
  this.socket = socket;
  this.id = this.socket.id;
  this.area = [];
  this.life = 100;
  this.money = 100;
  config = config || {};
  this.lastUpdateTime = 0;
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
        game.removeDungeon(self.socket.id);
        if (game.dungeons.length === 0) {
          game.destroy();
          remove(games, findIndex(games, game.id));
        } else {
          game.removeDungeon(self.socket.id);
          game.broadcast('update', game.toJSON());
        }
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
      self.lastUpdateTime = 0;
      game.broadcast('update', game.toJSON());
    });

    this.socket.on('apply-option', function (data) {
      var game = findByDungeonId(data.dungeonId);
      var dungeon = find(game.dungeons, data.dungeonId);
      var opponent = find(game.dungeons, data.opponentId);
      if (opponent.id !== dungeon.id) opponent.deduceMoney(data.x, data.y, data.option.trim(), dungeon);
      dungeon.applyOption(data.x, data.y, data.option.trim(), opponent);
      game.broadcast('update', game.toJSON());
    });

    this.socket.on('ready', function (dungeonId) {
      var game = findByDungeonId(dungeonId);
      var dungeon = find(game.dungeons, dungeonId);
      dungeon.player.ready = !dungeon.player.ready;
      game.checkReady();
      game.broadcast('update', game.toJSON());
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
      case 'trap':
        {
          if (this.area[x][y].state.includes('player') &&
            bully.money >= this.config.trapCost &&
            this.id !== bully.id) {
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
      case 'trap':
        {
          if (victim.area[x][y].state.includes('player') && !victim.area[x][y].state.includes('trap')) {
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
      case 'up':
        {
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
      case 'down':
        {
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
      case 'left':
        {
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
      case 'right':
        {
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
    }
    this.applyTrap(direction);
  },
  applyTrap: function (direction) {
    if (this.player.trapped) {
      for (var i = 0; i <= this.config.trapFeedback; i++) {
        var movementValue = 0;
        var squareY = this.player.y;
        var squareX = this.player.x;
        switch (direction) {
          case 'up':
            {
              movementValue += (squareY + 1) < this.area.length ? 1 : 0;
              if (movementValue > 0) {
                if (!this.area[squareY + movementValue][squareX].state.includes('wall')) {
                  this.area[squareY + movementValue][squareX].state = 'square player';
                  this.area[squareY][squareX].state = 'square';
                  this.player.y += movementValue;
                }
              }
              break;
            }
          case 'down':
            {
              movementValue += (squareY - 1) >= 0 ? 1 : 0;
              if (movementValue > 0) {
                if (!this.area[squareY - movementValue][squareX].state.includes('wall')) {
                  this.area[squareY - movementValue][squareX].state = 'square player';
                  this.area[squareY][squareX].state = 'square';
                  this.player.y -= movementValue;
                }
              }
              break;
            }
          case 'left':
            {
              movementValue += (squareX + 1) < this.area[0].length ? 1 : 0;
              if (movementValue > 0) {
                if (!this.area[squareY][squareX + movementValue].state.includes('wall')) {
                  this.area[squareY][squareX + movementValue].state = 'square player';
                  this.area[squareY][squareX].state = 'square';
                  this.player.x += movementValue;
                }
              }
              break;
            }
          case 'right':
            {
              movementValue += (squareX - 1) >= 0 ? 1 : 0;
              if (movementValue > 0) {
                if (!this.area[squareY][squareX - movementValue].state.includes('wall')) {
                  this.area[squareY][squareX - movementValue].state = 'square player';
                  this.area[squareY][squareX].state = 'square';
                  this.player.x -= movementValue;
                }
              }
              break;
            }
        }
      }
      this.player.trapped = false;
    }
  },
  toJSON: function () {
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
  createArea: function (x, y, numberOfCells) {
    x = x || 300;
    y = y || 400;
    numberOfCells = numberOfCells || 30;

    var cellSize = x / numberOfCells;
    var rows = Math.floor(y / cellSize);

    for (var row = 0; row < rows; row++) {
      this.area.push([]);
      for (var column = numberOfCells; column > 0; column--) {
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
    };
    this.area[this.player.y][this.player.x].state = squareStates['p'];
  },
  joinRoom: function (game) {
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